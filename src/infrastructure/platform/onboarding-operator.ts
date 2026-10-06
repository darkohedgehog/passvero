import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/src/generated/prisma/client";
import { onboardingOperatorSchema } from "@/src/application/auth/onboarding-operator";
import type { AuthEmailSender } from "@/src/application/auth/auth-email";
import { PrismaAccessRequestNotifications } from "@/src/infrastructure/persistence/prisma/prisma-access-request-notifications";
export async function runOnboardingOperator(db: PrismaClient, auth: Pick<PrismaClient, "authProviderUser">, input: unknown, canonicalOrigin: string, sender: AuthEmailSender) {
  const command = onboardingOperatorSchema.parse(input);
  if (command.action === "prepare-notification")
    return { prepared: await new PrismaAccessRequestNotifications(db, canonicalOrigin).prepare(command.id) };
  if (command.action === "send-notification" || command.action === "retry-notification")
    return new PrismaAccessRequestNotifications(db, canonicalOrigin).deliver(command.id, sender, command.action === "retry-notification", command.operator);
  return db.$transaction(async (tx) => {
    if (command.action === "configure-notifications") {
      await tx.onboardingNotificationSettings.upsert({ where: { id: 1 }, create: { id: 1, recipientEmail: command.recipient, enabled: command.enabled }, update: { recipientEmail: command.recipient, enabled: command.enabled } });
      await tx.authAuditEvent.create({ data: { action: "ONBOARDING_NOTIFICATION_SETTINGS_CONFIGURED", correlationId: randomUUID(), metadata: { operator: command.operator, enabled: command.enabled }, summary: "Explicit operator onboarding notification configuration." } });
      return { status: "CONFIGURED", enabled: command.enabled };
    }
    if (!("email" in command))
      throw Error("INVALID_COMMAND");
    const user = await tx.user.findUnique({ where: { email: command.email }, select: { id: true } });
    if (!user)
      throw Error("USER_NOT_FOUND");
    if (command.action === "grant") {
      const read = await tx.platformGrant.findUnique({ where: { userId: user.id }, select: { revokedAt: true } });
      if (!read || read.revokedAt !== null)
        throw Error("PLATFORM_READ_REQUIRED");
      const identities = await tx.authIdentity.findMany({ where: { userId: user.id, provider: "BETTER_AUTH", revokedAt: null }, select: { providerSubject: true } });
      if (identities.length !== 1 || !await auth.authProviderUser.findFirst({ where: { id: identities[0].providerSubject, email: command.email, emailVerified: true }, select: { id: true } }))
        throw Error("VERIFIED_IDENTITY_REQUIRED");
    }
    const current = await tx.platformOnboardingGrant.findUnique({ where: { userId: user.id } });
    const active = !!current && current.revokedAt === null;
    if (active === (command.action === "grant"))
      return { status: "NO_CHANGE", userId: user.id };
    if (command.action === "grant")
      await tx.platformOnboardingGrant.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: { grantedAt: new Date(), revokedAt: null } });
    else
      await tx.platformOnboardingGrant.update({ where: { userId: user.id }, data: { revokedAt: new Date() } });
    await tx.authAuditEvent.create({ data: { userId: user.id, action: command.action === "grant" ? "ONBOARDING_ACCESS_GRANTED" : "ONBOARDING_ACCESS_REVOKED", correlationId: randomUUID(), metadata: { operator: command.operator }, summary: "Explicit operator onboarding authorization change." } });
    return { status: command.action === "grant" ? "GRANTED" : "REVOKED", userId: user.id };
  });
}
