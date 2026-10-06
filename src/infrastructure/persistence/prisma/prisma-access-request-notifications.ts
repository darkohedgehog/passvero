import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@/src/generated/prisma/client";
import { accessRequestIdSchema } from "@/src/application/auth/access-request";
import type { AuthEmailSender } from "@/src/application/auth/auth-email";
import { AuthEmailDeliveryError } from "@/src/infrastructure/auth/nodemailer-auth-email-sender-core";
export async function prepareAdminNotification(tx: Prisma.TransactionClient, requestId: string) {
  const settings = await tx.onboardingNotificationSettings.findUnique({ where: { id: 1 } });
  if (!settings)
    return false;
  await tx.accessRequestAdminNotification.createMany({ data: [{ requestId, recipientEmail: settings.recipientEmail }], skipDuplicates: true });
  return true;
}
export class PrismaAccessRequestNotifications {
  constructor(private readonly db: PrismaClient, private readonly canonicalOrigin: string) { }
  async prepare(requestId: string) {
    accessRequestIdSchema.parse(requestId);
    return this.db.$transaction(async (tx) => {
      if (!await tx.accessRequest.findUnique({ where: { id: requestId }, select: { id: true } }))
        throw Error("REQUEST_NOT_FOUND");
      return prepareAdminNotification(tx, requestId);
    });
  }
  async deliver(requestId: string, sender: AuthEmailSender, retry = false, operator?: string) {
    accessRequestIdSchema.parse(requestId);
    const prepared = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw `SELECT "requestId" FROM "AccessRequestAdminNotification" WHERE "requestId"=${requestId}::uuid FOR UPDATE`;
      const row = await tx.accessRequestAdminNotification.findUnique({ where: { requestId } });
      if (!row)
        return { send: false as const, status: "NOT_PREPARED" };
      const settings = await tx.onboardingNotificationSettings.findUnique({ where: { id: 1 } });
      // The privileged, explicit operator path may send one prepared notice while
      // automatic dispatch remains disabled. Public submissions supply no operator.
      if (!settings || (!settings.enabled && !operator) || settings.recipientEmail !== row.recipientEmail)
        return { send: false as const, status: row.status };
      if (!retry && row.status !== "PENDING")
        return { send: false as const, status: row.status };
      if (retry && (row.attempts >= 3 || row.status === "SENT" || (row.status === "IN_PROGRESS" && row.startedAt && Date.now() - row.startedAt.getTime() < 600000)))
        throw Error("DELIVERY_RECONCILIATION_REQUIRED");
      const attemptId = randomUUID();
      await tx.accessRequestAdminNotification.update({ where: { requestId }, data: { status: "IN_PROGRESS", attemptId, attempts: { increment: 1 }, startedAt: new Date(), sentAt: null } });
      await notificationAudit(tx, requestId, "ACCESS_ADMIN_NOTIFICATION_STARTED", operator);
      return { send: true as const, attemptId, recipient: row.recipientEmail };
    });
    if (!prepared.send)
      return { status: prepared.status };
    let status: "SENT" | "REJECTED" | "DELIVERY_UNKNOWN" = "DELIVERY_UNKNOWN";
    try {
      await sender.send({ type: "ACCESS_REQUEST_ADMIN", recipient: prepared.recipient, locale: "hr", requestId, reviewUrl: new URL("/platform/access-requests", this.canonicalOrigin).href });
      status = "SENT";
    }
    catch (error) {
      if (error instanceof AuthEmailDeliveryError && error.code === "REJECTED")
        status = "REJECTED";
    }
    try {
      await this.db.$transaction(async (tx) => {
        const result = await tx.accessRequestAdminNotification.updateMany({ where: { requestId, attemptId: prepared.attemptId, status: "IN_PROGRESS" }, data: { status, sentAt: status === "SENT" ? new Date() : null } });
        if (result.count !== 1)
          throw Error("DELIVERY_RECONCILIATION_REQUIRED");
        await notificationAudit(tx, requestId, `ACCESS_ADMIN_NOTIFICATION_${status}`, operator);
      });
    }
    catch {
      return { status: "DELIVERY_RECONCILIATION_REQUIRED" };
    }
    return { status };
  }
}
async function notificationAudit(tx: Prisma.TransactionClient, requestId: string, action: string, operator?: string) {
  await tx.authAuditEvent.create({ data: { action, correlationId: requestId, ...(operator ? { metadata: { operator } } : {}), summary: "Access request admin notification outcome." } });
}
