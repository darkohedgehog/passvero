import { z } from "zod";
import type { Prisma, PrismaClient } from "@/src/generated/prisma/client";
import { isPassveroLocale } from "@/src/domain/values/passvero-locale";

export const normalizedEmail = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const campaignScopeSchema = z.object({
  organizationIds: z.array(z.uuid()).min(1).max(25),
  recipientEmails: z.array(normalizedEmail).min(1).max(32),
  operatorEmails: z.array(normalizedEmail).max(16),
  messageKinds: z.array(z.enum(["SUBSCRIPTION", "PUBLIC_AVAILABILITY"])).min(1).max(2),
});
export type CampaignScope = z.infer<typeof campaignScopeSchema>;
export type ReminderRecipient = { email: string; locale: string; operator: boolean };
type AuthReader = Pick<PrismaClient, "authProviderUser">;
export async function reminderRecipients(tx: Prisma.TransactionClient, auth: AuthReader, organizationId: string, scope: CampaignScope) {
  const org = await tx.organization.findUnique({ where: { id: organizationId }, select: { status: true, defaultLocale: true, displayName: true, billingProfile: true, billingEmailConfirmation: true } });
  if (!org || org.status !== "ACTIVE" || !scope.organizationIds.includes(organizationId)) return { organizationName: "", recipients: [] as ReminderRecipient[] };
  const fallback = org.defaultLocale && isPassveroLocale(org.defaultLocale) ? org.defaultLocale : "hr";
  const recipients = new Map<string, ReminderRecipient>();
  const add = (email: string, locale: string | null, operator: boolean) => {
    const result = normalizedEmail.safeParse(email);
    if (!result.success || !scope.recipientEmails.includes(result.data)) return;
    // Customer content wins when the same mailbox is also a billing operator.
    if (!recipients.has(result.data) || (recipients.get(result.data)?.operator && !operator)) recipients.set(result.data, { email: result.data, locale: locale && isPassveroLocale(locale) ? locale : fallback, operator });
  };
  const users = await tx.user.findMany({ where: { email: { in: scope.recipientEmails }, OR: [
    { memberships: { some: { organizationId, role: "OWNER", status: "ACTIVE" } } },
    { email: { in: scope.operatorEmails }, billingGrant: { revokedAt: null } },
  ] }, select: { id: true, email: true, preferredLocale: true, memberships: { where: { organizationId, role: "OWNER", status: "ACTIVE" }, select: { id: true } }, billingGrant: { select: { revokedAt: true } }, authIdentities: { where: { provider: "BETTER_AUTH", revokedAt: null }, select: { providerSubject: true } } } });
  // Explicit bound avoids allowing organization membership growth to expand a campaign.
  for (const user of users.filter(u => scope.recipientEmails.includes(u.email)).sort((a, b) => b.memberships.length - a.memberships.length)) {
    if (user.authIdentities.length !== 1 || !await auth.authProviderUser.findFirst({ where: { id: user.authIdentities[0].providerSubject, email: user.email, emailVerified: true }, select: { id: true } })) continue;
    const owner = user.memberships.length > 0;
    if (owner || (user.billingGrant?.revokedAt === null && scope.operatorEmails.includes(user.email))) add(user.email, user.preferredLocale, !owner);
  }
  const profile = org.billingProfile, confirmation = org.billingEmailConfirmation;
  if (profile && confirmation && confirmation.revokedAt === null && confirmation.profileRevision === profile.revision && normalizedEmail.parse(profile.billingEmail) === confirmation.email) add(confirmation.email, fallback, false);
  return { organizationName: org.displayName, recipients: [...recipients.values()] };
}
