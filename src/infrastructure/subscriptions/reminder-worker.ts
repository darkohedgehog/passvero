import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient, type SubscriptionReminder } from "@/src/generated/prisma/client";
import { reminderDecision, type ReminderDecision } from "@/src/application/subscriptions/reminders";
import { readReminderCoverage } from "./entitlement-runtime";
import { campaignScopeSchema, reminderRecipients } from "./reminder-recipients";
import { renderReminderEmail } from "./reminder-email";
import type { ReminderTransport, ReminderTransportOutcome } from "./reminder-transport";

const LEASE_MS = 300000;
type Tx = Prisma.TransactionClient;
export class ReminderWorker {
  constructor(private readonly db: PrismaClient, private readonly auth: Pick<PrismaClient, "authProviderUser">, private readonly transport: ReminderTransport,
    private readonly options: { canonicalOrigin: string; runtimeEnvironment: string; now?: () => Date }) {}
  private now() { return this.options.now?.() ?? new Date(); }
  private assertStaging() {
    if (this.options.runtimeEnvironment !== "staging" || this.options.canonicalOrigin !== "https://staging.passvero.eu") throw new Error("REMINDER_STAGING_REQUIRED");
  }
  private async campaign(tx: Tx, id: string, now: Date) {
    const row = await tx.reminderCampaign.findUnique({ where: { id } });
    if (!row || !row.enabled || row.expiresAt <= now) return null;
    return { ...row, ...campaignScopeSchema.parse(row) };
  }
  private audit(tx: Tx, row: Pick<SubscriptionReminder, "id" | "organizationId">, action: string, metadata: Prisma.InputJsonObject = {}) {
    return tx.auditLog.create({ data: { organizationId: row.organizationId, actorId: null, action, entityType: "SUBSCRIPTION_REMINDER", entityId: row.id, metadata, correlationId: randomUUID() } });
  }
  private async decision(tx: Tx, organizationId: string, now: Date) {
    return Object.values(reminderDecision(await readReminderCoverage(tx, organizationId, now))).filter((value): value is ReminderDecision => value !== null);
  }
  async enqueue(campaignId: string) {
    this.assertStaging();
    const campaign = await this.campaign(this.db, campaignId, this.now());
    if (!campaign) return;
    for (const organizationId of campaign.organizationIds) await this.db.$transaction(async tx => {
      const now = this.now(), current = await this.campaign(tx, campaignId, now);
      if (!current || !current.organizationIds.includes(organizationId)) return;
      const decisions = (await this.decision(tx, organizationId, now)).filter(d => current.messageKinds.includes(d.kind));
      const { recipients } = await reminderRecipients(tx, this.auth, organizationId, current);
      const pending = await tx.subscriptionReminder.findMany({ where: { organizationId, campaignId, status: "PENDING" }, take: 250 });
      for (const row of pending) if (!decisions.some(d => this.matches(row, d)) || !recipients.some(r => r.email === row.recipient)) {
        const changed = await tx.subscriptionReminder.updateMany({ where: { id: row.id, status: "PENDING" }, data: { status: "CANCELLED", nextAttemptAt: null, lastError: "STALE_OR_UNAUTHORIZED" } });
        if (changed.count) await this.audit(tx, row, "REMINDER_CANCELLED", { reason: "STALE_OR_UNAUTHORIZED" });
      }
      const stranded = await tx.subscriptionReminder.findMany({ where: { organizationId, campaignId: { not: campaignId }, status: "PENDING" }, include: { campaign: true }, take: 250 });
      for (const row of stranded) {
        if (row.campaign.enabled && row.campaign.expiresAt > now && row.campaign.dispatches < row.campaign.maxDispatches) continue;
        if (!decisions.some(d => this.matches(row, d)) || !recipients.some(r => r.email === row.recipient)) continue;
        const adopted = await tx.subscriptionReminder.updateMany({ where: { id: row.id, campaignId: row.campaignId, status: "PENDING" }, data: { campaignId, lastError: null } });
        if (adopted.count) await this.audit(tx, row, "REMINDER_APPROVAL_REPLACED", { previousCampaignId: row.campaignId, campaignId });
      }
      // ON CONFLICT protects logical uniqueness across processes and campaigns.
      await tx.subscriptionReminder.createMany({ skipDuplicates: true, data: decisions.flatMap(d => recipients.map(recipient => ({ organizationId, campaignId, revision: d.revision, kind: d.kind, threshold: d.threshold, deadline: d.deadline, recipient: recipient.email, nextAttemptAt: now }))) });
    }, { timeout: 15000 });
  }
  private matches(row: SubscriptionReminder, decision: ReminderDecision) {
    return row.kind === decision.kind && row.revision === decision.revision && row.threshold === decision.threshold && row.deadline.getTime() === decision.deadline.getTime();
  }
  private async recover(campaignId: string) {
    await this.db.$transaction(async tx => {
      const now = this.now();
      const rows = await tx.subscriptionReminder.findMany({ where: { campaignId, status: { in: ["CLAIMED", "SENDING"] }, leaseUntil: { lte: now } }, take: 50 });
      for (const row of rows) {
        const unknown = row.status === "SENDING";
        const changed = await tx.subscriptionReminder.updateMany({ where: { id: row.id, status: row.status, leaseToken: row.leaseToken, leaseUntil: { lte: now } }, data: { status: unknown ? "DELIVERY_UNKNOWN" : "PENDING", leaseToken: null, leaseUntil: null, nextAttemptAt: unknown ? null : now, lastError: unknown ? "ATTEMPT_OUTCOME_NOT_RECORDED" : null } });
        if (!changed.count) continue;
        if (unknown) await tx.reminderAttempt.updateMany({ where: { reminderId: row.id, token: row.leaseToken!, status: "SENDING" }, data: { status: "DELIVERY_UNKNOWN", reason: "ATTEMPT_OUTCOME_NOT_RECORDED", finishedAt: now } });
        await this.audit(tx, row, unknown ? "REMINDER_DELIVERY_UNKNOWN" : "REMINDER_LEASE_RECOVERED");
      }
    });
  }
  private async claim(campaignId: string) {
    return this.db.$transaction(async tx => {
      const now = this.now();
      const rows = await tx.$queryRaw<SubscriptionReminder[]>(Prisma.sql`SELECT * FROM "SubscriptionReminder" WHERE "campaignId"=${campaignId}::uuid AND status='PENDING' AND attempts<3 AND ("nextAttemptAt" IS NULL OR "nextAttemptAt"<=${now}) ORDER BY "createdAt",id FOR UPDATE SKIP LOCKED LIMIT 1`);
      const row = rows[0];
      if (!row) return null;
      return tx.subscriptionReminder.update({ where: { id: row.id }, data: { status: "CLAIMED", leaseToken: randomUUID(), leaseUntil: new Date(now.getTime() + LEASE_MS) } });
    });
  }
  private async prepare(row: SubscriptionReminder, campaignToken: string) {
    return this.db.$transaction(async tx => {
      // Consistent order: organization entitlement lock, then campaign budget and outbox row.
      const now = this.now(), decisions = await this.decision(tx, row.organizationId, now);
      await tx.$queryRaw`SELECT id FROM "ReminderCampaign" WHERE id=${row.campaignId}::uuid FOR UPDATE`;
      const campaign = await this.campaign(tx, row.campaignId, now);
      const live = await tx.subscriptionReminder.findUniqueOrThrow({ where: { id: row.id } });
      if (live.status !== "CLAIMED" || live.leaseToken !== row.leaseToken || !live.leaseUntil || live.leaseUntil <= now) return null;
      const decision = decisions.find(d => this.matches(row, d));
      const recipients = campaign ? await reminderRecipients(tx, this.auth, row.organizationId, campaign) : null;
      const recipient = recipients?.recipients.find(r => r.email === row.recipient);
      if (!campaign || campaign.leaseToken !== campaignToken || !campaign.leaseUntil || campaign.leaseUntil <= now || !decision || !recipient || !campaign.messageKinds.includes(decision.kind)) {
        await tx.subscriptionReminder.update({ where: { id: row.id }, data: { status: "CANCELLED", leaseToken: null, leaseUntil: null, nextAttemptAt: null, lastError: "STALE_OR_UNAUTHORIZED" } });
        await this.audit(tx, row, "REMINDER_CANCELLED", { reason: "STALE_OR_UNAUTHORIZED" });
        return null;
      }
      if (campaign.dispatches >= campaign.maxDispatches) {
        await tx.subscriptionReminder.update({ where: { id: row.id }, data: { status: "PENDING", leaseToken: null, leaseUntil: null, lastError: "CAMPAIGN_BUDGET_EXHAUSTED" } });
        return null;
      }
      const email = renderReminderEmail({ organizationName: recipients!.organizationName, locale: recipient.locale, operator: recipient.operator, decision }, this.options.canonicalOrigin);
      await tx.reminderCampaign.update({ where: { id: campaign.id }, data: { dispatches: { increment: 1 }, leaseUntil: new Date(now.getTime() + LEASE_MS) } });
      const attempt = row.attempts + 1;
      await tx.subscriptionReminder.update({ where: { id: row.id }, data: { status: "SENDING", attempts: attempt, nextAttemptAt: null, lastError: null, leaseUntil: new Date(now.getTime() + LEASE_MS) } });
      await tx.reminderAttempt.create({ data: { reminderId: row.id, number: attempt, token: row.leaseToken!, startedAt: now } });
      await this.audit(tx, row, "REMINDER_DISPATCH_STARTED", { attempt, kind: decision.kind, threshold: decision.threshold });
      return { ...email, recipient: row.recipient, messageId: `<reminder-${row.id}@staging.passvero.eu>`, attempt };
    }, { timeout: 15000 });
  }
  private async finish(row: SubscriptionReminder, attempt: number, outcome: ReminderTransportOutcome) {
    await this.db.$transaction(async tx => {
      const now = this.now();
      const status = outcome.status === "ACCEPTED" ? "SENT" : outcome.status === "UNKNOWN" ? "DELIVERY_UNKNOWN" : outcome.status === "SAFE_RETRY" && attempt < 3 ? "PENDING" : "FAILED";
      const reason = "reason" in outcome ? outcome.reason : null;
      const changed = await tx.subscriptionReminder.updateMany({ where: { id: row.id, status: "SENDING", leaseToken: row.leaseToken }, data: { status, lastError: reason, acceptedAt: status === "SENT" ? now : null, nextAttemptAt: status === "PENDING" ? new Date(now.getTime() + (attempt === 1 ? 300000 : 1800000)) : null, leaseToken: null, leaseUntil: null } });
      // A recovered attempt is fenced. Late transport completion never requeues or overwrites it.
      if (!changed.count) return;
      await tx.reminderAttempt.update({ where: { token: row.leaseToken! }, data: { status: outcome.status === "UNKNOWN" ? "DELIVERY_UNKNOWN" : outcome.status, reason, finishedAt: now } });
      await this.audit(tx, row, `REMINDER_${status}`, { attempt, reason });
    });
  }
  private async send(message: Parameters<ReminderTransport["send"]>[0]): Promise<ReminderTransportOutcome> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([this.transport.send(message), new Promise<ReminderTransportOutcome>(resolve => { timer = setTimeout(() => resolve({ status: "UNKNOWN", reason: "SMTP_OUTCOME_UNKNOWN" }), 45000); })]);
    } catch { return { status: "UNKNOWN", reason: "SMTP_OUTCOME_UNKNOWN" }; }
    finally { if (timer) clearTimeout(timer); }
  }
  async run(campaignId: string) {
    this.assertStaging();
    // Recovery records uncertainty, never sends. It remains required after approval expires.
    await this.recover(campaignId);
    const now = this.now(), token = randomUUID();
    const acquired = await this.db.reminderCampaign.updateMany({ where: { id: campaignId, enabled: true, expiresAt: { gt: now }, OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] }, data: { leaseToken: token, leaseUntil: new Date(now.getTime() + LEASE_MS), lastStartedAt: now } });
    if (!acquired.count) return { status: "SKIPPED" as const };
    try {
      await this.enqueue(campaignId);
      const started = Date.now();
      for (let n = 0; n < 10 && Date.now() - started < 120000; n++) {
        const row = await this.claim(campaignId);
        if (!row) break;
        const message = await this.prepare(row, token);
        if (message) await this.finish(row, message.attempt, await this.send(message));
      }
      await this.db.reminderCampaign.updateMany({ where: { id: campaignId, leaseToken: token }, data: { lastSuccessAt: this.now(), lastError: null, leaseUntil: null, leaseToken: null } });
      return { status: "COMPLETED" as const };
    } catch {
      await this.db.reminderCampaign.updateMany({ where: { id: campaignId, leaseToken: token }, data: { lastError: "WORKER_FAILED", leaseUntil: null, leaseToken: null } });
      throw new Error("REMINDER_WORKER_FAILED");
    }
  }
}
