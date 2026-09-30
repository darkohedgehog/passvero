import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma, PrismaClient } from "@/src/generated/prisma/client";
import type { CommercialActor } from "@/src/application/subscriptions/contracts";
import { commercialError } from "@/src/application/subscriptions/service";
import { ApplicationError } from "@/src/application/errors/application-error";
import { normalizedEmail } from "./reminder-recipients";
const evidence = z.string().trim().min(8).max(200).regex(/^[\p{L}\p{N} ._:/@-]+$/u);
export const confirmBillingEmailSchema = z.object({ organizationId: z.uuid(), email: normalizedEmail, profileRevision: z.number().int().positive(), evidenceReference: evidence }).strict();
export const resolveReminderSchema = z.object({ reminderId: z.uuid(), action: z.enum(["CONFIRM_ACCEPTED", "CONFIRM_NOT_ACCEPTED", "CONFIRM_RECEIPT"]), evidenceReference: evidence }).strict();
type Authorize = (tx: Prisma.TransactionClient, actor: CommercialActor) => Promise<boolean>;
function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) throw new ApplicationError("VALIDATION", "VALIDATION_ERROR", "Invalid reminder operation.", false);
  return result.data;
}
export class ReminderOperations {
  constructor(private readonly db: PrismaClient, private readonly authorize: Authorize) {}
  private run<T>(actor: CommercialActor, work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.db.$transaction(async tx => {
      if (!await this.authorize(tx, actor)) throw commercialError("COMMERCIAL_FORBIDDEN", "FORBIDDEN");
      return work(tx);
    });
  }
  overview(actor: CommercialActor) {
    return this.run(actor, async tx => {
      const [campaigns, counts, deliveries] = await Promise.all([
        tx.reminderCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 25, select: { id: true, enabled: true, expiresAt: true, maxDispatches: true, dispatches: true, lastStartedAt: true, lastSuccessAt: true, lastError: true } }),
        tx.subscriptionReminder.groupBy({ by: ["status"], _count: true }),
        tx.subscriptionReminder.findMany({ orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 100, select: { id: true, organization: { select: { displayName: true } }, recipient: true, kind: true, threshold: true, deadline: true, status: true, attempts: true, lastError: true, nextAttemptAt: true, acceptedAt: true, receiptConfirmedAt: true } }),
      ]);
      await tx.authAuditEvent.create({ data: { userId: actor.currentUser.userId, action: "REMINDER_DELIVERY_OVERVIEW_READ", summary: "Billing-authorized delivery overview.", correlationId: randomUUID() } });
      return { campaigns, counts, deliveries };
    });
  }
  confirmBillingEmail(actor: CommercialActor, raw: unknown) {
    const input = parse(confirmBillingEmailSchema, raw);
    return this.run(actor, async tx => {
      await tx.$queryRaw`SELECT "organizationId" FROM "OrganizationBillingProfile" WHERE "organizationId"=${input.organizationId}::uuid FOR UPDATE`;
      const profile = await tx.organizationBillingProfile.findUnique({ where: { organizationId: input.organizationId }, include: { organization: { select: { status: true } } } });
      if (!profile || profile.organization.status !== "ACTIVE" || profile.revision !== input.profileRevision || normalizedEmail.parse(profile.billingEmail) !== input.email) throw commercialError("REMINDER_PROFILE_CHANGED");
      const data = { email: input.email, profileRevision: input.profileRevision, evidenceReference: input.evidenceReference, confirmedById: actor.currentUser.userId, confirmedAt: new Date(), revokedAt: null };
      await tx.billingEmailConfirmation.upsert({ where: { organizationId: input.organizationId }, create: { organizationId: input.organizationId, ...data }, update: data });
      await tx.auditLog.create({ data: { organizationId: input.organizationId, actorId: actor.currentUser.userId, action: "BILLING_EMAIL_EXPLICITLY_CONFIRMED", entityType: "ORGANIZATION_BILLING_PROFILE", entityId: input.organizationId, metadata: { profileRevision: input.profileRevision, evidenceReference: input.evidenceReference }, correlationId: randomUUID() } });
      return { status: "CONFIRMED" as const };
    });
  }
  resolve(actor: CommercialActor, raw: unknown) {
    const input = parse(resolveReminderSchema, raw);
    return this.run(actor, async tx => {
      await tx.$queryRaw`SELECT id FROM "SubscriptionReminder" WHERE id=${input.reminderId}::uuid FOR UPDATE`;
      const row = await tx.subscriptionReminder.findUnique({ where: { id: input.reminderId } });
      if (!row || (input.action === "CONFIRM_RECEIPT" ? row.status !== "SENT" : row.status !== "DELIVERY_UNKNOWN")) throw commercialError("REMINDER_RESOLUTION_CONFLICT");
      const now = new Date();
      const data = input.action === "CONFIRM_RECEIPT" ? { receiptConfirmedAt: now } : input.action === "CONFIRM_ACCEPTED" ? { status: "SENT", acceptedAt: now, lastError: "OPERATOR_CONFIRMED_ACCEPTANCE" } : { status: "FAILED", lastError: "OPERATOR_CONFIRMED_NOT_ACCEPTED" };
      await tx.subscriptionReminder.update({ where: { id: row.id }, data });
      await tx.auditLog.create({ data: { organizationId: row.organizationId, actorId: actor.currentUser.userId, action: "REMINDER_OPERATOR_RESOLVED", entityType: "SUBSCRIPTION_REMINDER", entityId: row.id, metadata: { action: input.action, evidenceReference: input.evidenceReference }, correlationId: randomUUID() } });
      return { status: "RESOLVED" as const };
    });
  }
}
