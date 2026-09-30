// Approved synthetic fixture setup only; no credentials, sessions, payments or email created.
import { randomUUID } from "node:crypto";
import { hostname, userInfo } from "node:os";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { activateOrganizationTrial, lockEntitlementOrganization } from "../src/infrastructure/subscriptions/entitlement-runtime";
const ownerId = "cbb590fa-1c67-41bf-883d-c2eb96bf6edb";
const operatorId = "40e51001-912c-4bcf-aa45-d866632aac85";
const scenarios = ["trial-active", "trial-expired", "paid-grace-active", "paid-grace-expired", "upgrade", "downgrade-blocked", "downgrade-allowed"] as const;
const db = new PrismaClient({ adapter: new PrismaPg({ host: "/var/run/postgresql", port: 5433, database: "passvero_acceptance", user: "postgres", options: "-c role=passvero_migrator" }) });
async function main() {
  if (hostname() !== "srv1834647" || userInfo().username !== "postgres") throw new Error("STAGING_OPERATOR_REQUIRED");
  const [scope] = await db.$queryRaw<Array<{ database: string; port: string }>>`SELECT current_database() AS database,current_setting('port') AS port`;
  if (scope.database !== "passvero_acceptance" || scope.port !== "5433") throw new Error("DATABASE_SCOPE_MISMATCH");
  const result = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(9302026, 930)::text`;
    for (const [id, email] of [[ownerId, "prodaja@zivic-elektro.com"], [operatorId, "zivic.darko79@gmail.com"]]) {
      if (!await tx.user.findFirst({ where: { id, email } })) throw new Error("IDENTITY_DRIFT");
      const identities = await tx.authIdentity.findMany({ where: { userId: id, provider: "BETTER_AUTH", revokedAt: null } });
      if (identities.length !== 1 || !await tx.authProviderUser.findFirst({ where: { id: identities[0].providerSubject, email, emailVerified: true } })) throw new Error("VERIFIED_IDENTITY_REQUIRED");
    }
    const rows = [];
    for (const scenario of scenarios) {
      const slug = `synthetic-entitlements-20260930-${scenario}`;
      const displayName = `SYNTHETIC — Entitlements ${scenario}`;
      const existing = await tx.organization.findUnique({ where: { slug }, include: { memberships: true, entitlementEnrollment: true } });
      if (existing) {
        if (existing.displayName !== displayName || existing.memberships.length !== 1 || existing.memberships[0].userId !== ownerId || existing.memberships[0].role !== "OWNER" || existing.memberships[0].status !== "ACTIVE" || !existing.entitlementEnrollment) throw new Error("FIXTURE_DRIFT");
        rows.push({ scenario, organizationId: existing.id, status: "NO_CHANGE" }); continue;
      }
      const org = await tx.organization.create({ data: { displayName, slug, status: "ACTIVE", timezone: "Europe/Zagreb", defaultLocale: "hr" } });
      await lockEntitlementOrganization(tx, org.id);
      await tx.membership.create({ data: { organizationId: org.id, userId: ownerId, role: "OWNER", status: "ACTIVE", joinedAt: new Date() } });
      await tx.organizationBillingProfile.create({ data: { organizationId: org.id, legalName: "SYNTHETIC TEST — NOT A LEGAL CUSTOMER", addressLine1: "Synthetic test address 1", city: "Synthetic", countryCode: "HR", billingEmail: "prodaja@zivic-elektro.com", revision: 1 } });
      if (scenario.startsWith("trial-")) await activateOrganizationTrial(tx, org.id, scenario === "trial-expired" ? new Date("2026-01-01T11:00:00Z") : new Date());
      else await tx.organizationEntitlementEnrollment.create({ data: { organizationId: org.id, enrolledAt: new Date(), reason: "Approved synthetic entitlement acceptance; no trial or paid rights until explicit simulated commercial fixture" } });
      await tx.auditLog.create({ data: { organizationId: org.id, actorId: operatorId, action: "SYNTHETIC_ENTITLEMENT_FIXTURE_CREATED", entityType: "ORGANIZATION", entityId: org.id, summary: "Explicitly approved synthetic acceptance fixture. No actual payment.", metadata: { scenario, synthetic: true, ownerId, controlledFixtureDate: scenario === "trial-expired" }, correlationId: randomUUID() } });
      rows.push({ scenario, organizationId: org.id, status: "CREATED" });
    }
    return rows;
  }, { timeout: 15000 });
  console.log(JSON.stringify({ fixtures: result, paymentRecorded: false, existingOrganizations: "UNCHANGED", productionChanges: "NONE" }));
}
void main().catch((error: unknown) => { console.error(JSON.stringify({ result: "STOP", reason: error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "FIXTURE_SETUP_FAILED", retry: "MANUAL_REVIEW_REQUIRED" })); process.exitCode = 1; }).finally(() => db.$disconnect());
