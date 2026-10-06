import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma, type PrismaClient } from "@/src/generated/prisma/client";
import { accessRequestIdSchema, accessRequestSchema } from "@/src/application/auth/access-request";
import type { AuthEmailSender } from "@/src/application/auth/auth-email";
import { createConfiguredOperatorProvisioning } from "@/src/infrastructure/auth/operator-provisioning-runtime";
import { createControlledCustomer } from "./prisma-operator-provisioning";
import type { PlatformActor } from "@/src/application/platform/service";
import { onboardingDenied } from "@/src/application/auth/onboarding-approval";
import { hasOnboardingAccess } from "@/src/infrastructure/platform/onboarding-access";
import { prepareAdminNotification, PrismaAccessRequestNotifications } from "./prisma-access-request-notifications";
import { AuthEmailDeliveryError } from "@/src/infrastructure/auth/nodemailer-auth-email-sender-core";

const operatorSchema = z.string().min(1).max(80).regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/);
const reviewSelect = {
  id: true, email: true, contactName: true, organizationDisplayName: true, locale: true,
  deliveryAttempts: true, status: true, deliveryStatus: true, decidedAt: true, decidedBy: true, createdAt: true,
  organizationId: true, userId: true, activationId: true, deliveryStartedAt: true, deliveredAt: true,
} as const;
export class AccessRequestError extends Error {
  constructor(readonly code: string) { super(code); }
}

export class PrismaAccessRequests {
  constructor(private readonly prisma: PrismaClient, private readonly providerEmailExists?: (email: string) => Promise<boolean>, private readonly notification?: {sender:AuthEmailSender;canonicalOrigin:string;defer?:(task:()=>Promise<void>)=>void}) {}

  async submit(value: unknown): Promise<void> {
    const input = accessRequestSchema.parse(value);
    // Duplicate requests retain the original reviewed statement and produce no mail or identity.
    const id = randomUUID();
    const prepared = await this.prisma.$transaction(async tx => {
      const result = await tx.accessRequest.createMany({ data: [{...input,id}], skipDuplicates: true });
      return result.count === 1 && await prepareAdminNotification(tx, id);
    });
    if (prepared && this.notification) {
      // Saving is authoritative. Mail failure must not turn a retained request into a public error.
      const notification = this.notification;
      const deliver = async () => {
        try { await new PrismaAccessRequestNotifications(this.prisma, notification.canonicalOrigin).deliver(id, notification.sender); }
        catch { /* Retained outbox is reconciled explicitly; duplicates never retry it. */ }
      };
      // Public HTTP responses must not wait on SMTP only for newly created requests.
      try {
        if (notification.defer) notification.defer(deliver);
        else await deliver();
      } catch { /* A scheduling failure leaves the durable notification pending. */ }
    }
  }
  async pending() {
    return this.prisma.accessRequest.findMany({ where: { status: "PENDING" }, select: reviewSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 50 });
  }
  async review(id: string) {
    const request = await this.prisma.accessRequest.findUnique({ where: { id: accessRequestIdSchema.parse(id) }, select: reviewSelect });
    return request ? { ...request, provisioningRole: "OWNER" as const, provisioningScope: "NEW_CUSTOMER_NEW_ORGANIZATION" as const } : null;
  }
  async reject(id: string, operator: string) {
    accessRequestIdSchema.parse(id); operatorSchema.parse(operator);
    return this.prisma.$transaction(async tx => {
      const request = await lockRequest(tx, id);
      if (request.status === "REJECTED") return { status: "REJECTED" };
      if (request.status !== "PENDING") throw new AccessRequestError("DECISION_CONFLICT");
      await tx.accessRequest.update({ where: { id }, data: { status: "REJECTED", decidedBy: operator, decidedAt: new Date() } });
      await audit(tx, id, "ACCESS_REQUEST_REJECTED", operator);
      return { status: "REJECTED" };
    });
  }

  async retryDelivery(id: string, operator: string, env: Readonly<Record<string, string | undefined>>, sender: AuthEmailSender) {
    return this.deliver(id, operator, env, sender, true);
  }
  async approve(id: string, operator: string, env: Readonly<Record<string, string | undefined>>, sender: AuthEmailSender) {
    return this.deliver(id, operator, env, sender, false);
  }
  async approveFromPlatform(id:string, actor:PlatformActor, auth:Pick<PrismaClient,"authProviderSession">, env:Readonly<Record<string,string|undefined>>, sender:AuthEmailSender) {
    return this.deliver(id, actor.currentUser.userId, env, sender, false, async tx => {
      // Fresh authority inside the decision transaction; runtime has no grant-write privilege.
      if (!await hasOnboardingAccess(tx,actor,auth)) throw onboardingDenied();
    });
  }
  private async deliver(id: string, operator: string, env: Readonly<Record<string, string | undefined>>, sender: AuthEmailSender, retry: boolean, authorize?: (tx:Prisma.TransactionClient)=>Promise<void>) {
    accessRequestIdSchema.parse(id); operatorSchema.parse(operator);
    const prepared = await this.prisma.$transaction(async tx => {
      const request = await lockRequest(tx, id);
      if (authorize) await authorize(tx);
      if (!retry && request.status === "APPROVED") return null;
      if (retry ? request.status !== "APPROVED" : request.status !== "PENDING") throw new AccessRequestError("DECISION_CONFLICT");
      if (retry && (request.deliveryAttempts >= 3 || (request.deliveryStatus === "DELIVERY_IN_PROGRESS" && request.deliveryStartedAt && Date.now() - request.deliveryStartedAt.getTime() < 10 * 60_000))) throw new AccessRequestError("DELIVERY_RECONCILIATION_REQUIRED");
      // Do not link an existing provider identity by email, even when business User is absent.
      if (!this.providerEmailExists) throw new AccessRequestError("PROVIDER_LOOKUP_REQUIRED");
      if (await this.providerEmailExists(request.email)) throw new AccessRequestError("EXISTING_PROVIDER_EMAIL");
      const attemptId = randomUUID();
      const provision = createConfiguredOperatorProvisioning(env, { async create(record) {
        if (retry) {
          // Reissue only an unclaimed, unused capability. Never reset provider/verification state.
          const changed = await tx.accountActivationIntent.updateMany({
            where: { id: request.activationId!, userId: request.userId!, status: "ISSUED", providerSubject: null, claimId: null },
            data: { tokenDigest: record.tokenDigest, expiresAt: record.expiresAt },
          });
          if (changed.count !== 1) throw new AccessRequestError("ACTIVATION_RECOVERY_REQUIRED");
          await tx.accessRequest.update({ where: { id }, data: { deliveryStatus: "DELIVERY_IN_PROGRESS", deliveryAttemptId: attemptId, deliveryStartedAt: record.issuedAt, deliveredAt: null, deliveryAttempts: { increment: 1 } } });
          await audit(tx, id, "ACCESS_ACTIVATION_REISSUED", operator);
          return;
        }
        const outcome = await createControlledCustomer(tx, record, { contactName: request.contactName, locale: request.locale });
        await tx.accessRequest.update({ where: { id }, data: { ...outcome, status: "APPROVED", decidedAt: record.issuedAt, decidedBy: operator, deliveryStatus: "DELIVERY_IN_PROGRESS", deliveryAttempts: 1, deliveryAttemptId: attemptId, deliveryStartedAt: record.issuedAt } });
        await audit(tx, id, "ACCESS_REQUEST_APPROVED", operator);
      } });
      // This approval creates a new aggregate only; its first applicant owns the organization.
      // Approved replays return above and never promote existing memberships.
      const result = await provision({ email: request.email, organizationDisplayName: request.organizationDisplayName, role: "OWNER", locale: request.locale });
      return { result, attemptId, locale: accessRequestSchema.shape.locale.parse(request.locale) };
    });
    if (!prepared) return { status: "ALREADY_APPROVED", deliveryStatus: (await this.review(id))?.deliveryStatus };
    // Commit first. The capability exists only in this process and the intended recipient's email.
    let delivered = false;
    let deliveryOutcome: "PROVIDER_ACCEPTED" | "PROVIDER_REJECTED" | "DELIVERY_UNKNOWN" = "DELIVERY_UNKNOWN";
    try {
      await sender.send({ type: "CONTROLLED_ACTIVATION", recipient: prepared.result.user.email, locale: prepared.locale, activationUrl: prepared.result.activation.activationUrl });
      delivered = true;
      deliveryOutcome = "PROVIDER_ACCEPTED";
    } catch (error) {
      if (error instanceof AuthEmailDeliveryError && error.code === "REJECTED") deliveryOutcome = "PROVIDER_REJECTED";
      // Retain the established recovery state; normalized rejection is recorded in audit.
    }
    try {
      await this.prisma.$transaction(async tx => {
        const result = await tx.accessRequest.updateMany({ where: { id, deliveryAttemptId: prepared.attemptId, deliveryStatus: "DELIVERY_IN_PROGRESS" }, data: { deliveryStatus: delivered ? "SENT" : "DELIVERY_UNKNOWN", deliveredAt: delivered ? new Date() : null } });
        if (result.count !== 1) throw new AccessRequestError("DELIVERY_RECONCILIATION_REQUIRED");
        await audit(tx, id, delivered ? "ACCESS_ACTIVATION_SENT" : "ACCESS_ACTIVATION_DELIVERY_UNKNOWN", operator, deliveryOutcome);
      });
    } catch { return { status: "APPROVED", deliveryStatus: "DELIVERY_RECONCILIATION_REQUIRED" }; }
    return { status: "APPROVED", deliveryStatus: delivered ? "SENT" : "DELIVERY_UNKNOWN" };
  }
}
async function lockRequest(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "AccessRequest" WHERE "id" = ${id}::uuid FOR UPDATE`;
  const request = await tx.accessRequest.findUnique({ where: { id }, select: reviewSelect });
  if (!request) throw new AccessRequestError("REQUEST_NOT_FOUND");
  return request;
}
async function audit(tx: Prisma.TransactionClient, id: string, action: string, operator: string, deliveryOutcome?: string) {
  await tx.authAuditEvent.create({ data: { action, correlationId: id, metadata: { operator, ...(deliveryOutcome ? {deliveryOutcome} : {}) }, summary: "Controlled access request operator outcome." } });
}
