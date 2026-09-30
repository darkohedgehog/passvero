// Approved staging-only synthetic scenario runner. Uses existing verified sessions;
// never creates sessions, credentials, actual payments, assets or emails.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { hostname, userInfo } from "node:os";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaCommercial } from "../src/infrastructure/subscriptions/prisma-commercial";
import { RegulatoryService } from "../src/infrastructure/subscriptions/regulatory";
import { readEntitlements } from "../src/infrastructure/subscriptions/entitlement-runtime";
import type { CommercialActor } from "../src/application/subscriptions/contracts";
import ids from "../codex/evidence/subscription-entitlements/staging-fixture-ids.json";
const connection = { host: "/var/run/postgresql", port: 5433, database: "passvero_acceptance", user: "postgres" };
const admin = new PrismaClient({ adapter: new PrismaPg({ ...connection, options: "-c role=passvero_migrator" }) });
const auth = new PrismaClient({ adapter: new PrismaPg({ ...connection, options: "-c role=passvero_auth" }) });
const app = new PrismaClient({ adapter: new PrismaPg({ ...connection, options: "-c role=passvero_app" }) });
let phase = "PRECHECK";
const ownerId = "cbb590fa-1c67-41bf-883d-c2eb96bf6edb", operatorId = "40e51001-912c-4bcf-aa45-d866632aac85";
function stableKey(value: string) { const hex = createHash("sha256").update(value).digest("hex"); return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`; }
async function actor(id: string, email: string): Promise<CommercialActor> {
  assert.ok(await admin.user.findFirst({ where: { id, email } }), "IDENTITY_DRIFT");
  const identities = await admin.authIdentity.findMany({ where: { userId: id, provider: "BETTER_AUTH", revokedAt: null } });
  assert.equal(identities.length, 1, "IDENTITY_DRIFT");
  const session = await auth.authProviderSession.findFirst({ where: { userId: identities[0].providerSubject, expiresAt: { gt: new Date() }, createdAt: { gt: new Date(Date.now()-30*86400000) }, authprovideruser: { email, emailVerified: true } }, orderBy: { createdAt: "desc" }, select: { id: true } });
  assert.ok(session, id === ownerId ? "OWNER_LOGIN_REQUIRED" : "OPERATOR_LOGIN_REQUIRED");
  return { status: "AUTHENTICATED", currentUser: { userId: id }, providerSession: { provider: "BETTER_AUTH", providerSessionId: session.id } };
}
async function main() {
  assert.equal(hostname(), "srv1834647"); assert.equal(userInfo().username, "postgres");
  const [scope] = await admin.$queryRaw<Array<{ database: string; port: string }>>`SELECT current_database() AS database,current_setting('port') AS port`;
  assert.deepEqual(scope, { database: "passvero_acceptance", port: "5433" });
  const owner = await actor(ownerId, "prodaja@zivic-elektro.com"), operator = await actor(operatorId, "zivic.darko79@gmail.com");
  for (const [scenario, id] of Object.entries(ids)) {
    const org = await admin.organization.findUniqueOrThrow({ where: { id }, include: { memberships: true } });
    assert.equal(org.slug, `synthetic-entitlements-20260930-${scenario}`);
    assert.equal(org.memberships.length, 1); assert.equal(org.memberships[0].userId, ownerId);
    assert.equal(org.memberships[0].role, "OWNER"); assert.equal(org.memberships[0].status, "ACTIVE");
  }
  const regulatory = new RegulatoryService(app, auth); await regulatory.requireAccess(operator);
  const results: Record<string, unknown>[] = [];
  async function purchase(organizationId: string, date: Date, planSlug: "start" | "business", changeKind: "STANDARD" | "UPGRADE" | "DOWNGRADE", cents: number) {
    phase = `${organizationId}:${changeKind}`;
    const api = new PrismaCommercial(app, auth, { canonicalOrigin: "https://staging.passvero.eu", runtimeEnvironment: "staging", now: () => date });
    const idempotencyKey = stableKey(`${organizationId}-${changeKind}`);
    const state = await api.request(owner, organizationId, { idempotencyKey, planSlug, months: 3, changeKind });
    // DTO intentionally omits idempotency keys: resolve only this approved fixture's request.
    const receipt = await admin.commercialRequest.findUniqueOrThrow({ where: { organizationId_idempotencyKey: { organizationId, idempotencyKey } }, select: { id: true } });
    let request = state.requests.find(r => r.id === receipt.id); assert.ok(request);
    const reference = { issuer: `SYNTHETIC ENTITLEMENTS ${organizationId}`, year: date.getUTCFullYear(), number: `SIM-${changeKind}` };
    if (request.status === "REQUESTED") {
      const local = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Zagreb", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date).replace(" ", "T");
      const offered = await api.offer(operator, { requestId: request.id, issuedAtLocal: local, reference: { ...reference, number: `OFFER-${reference.number}` }, netAmountCents: cents, totalAmountCents: cents, taxTreatment: "SYNTHETIC — NO ACTUAL PAYMENT OR TAX", termsVersion: "SYNTHETIC-NONBINDING-ENTITLEMENTS-v1" });
      request = offered.requests.find(r => r.id === receipt.id)!;
    }
    assert.ok(request.offer);
    if (request.status === "OFFERED") await api.accept(owner, organizationId, { requestId: request.id, offerId: request.offer.id });
    const paid = await api.pay(operator, { requestId: request.id, offerId: request.offer.id, reference, kind: "SIMULATED_PAYMENT" });
    return { state: paid, requestId: request.id };
  }
  async function publicFixture(organizationId: string, scenario: string) {
    phase = `PUBLIC_FIXTURE:${scenario}`;
    const publicCode = createHash("sha256").update(`synthetic-entitlements-${scenario}`).digest().subarray(0,16).toString("base64url");
    const product = await admin.$transaction(async tx => {
      const existing = await tx.product.findUnique({ where: { publicCode } });
      if (existing) { assert.equal(existing.organizationId, organizationId); return existing; }
      const at = new Date(scenario === "paid-grace-active" ? "2026-02-02T11:00:00Z" : scenario === "paid-grace-expired" ? "2025-11-02T11:00:00Z" : "2026-01-02T11:00:00Z");
      const p = await tx.product.create({ data: { organizationId, internalName: `SYNTHETIC ${scenario} public fixture`, publicCode } });
      const v = await tx.productVersion.create({ data: { organizationId, productId: p.id, sourceLocale: "hr", status: "PUBLISHED", versionNumber: 1, publishedAt: at, publishedById: ownerId } });
      await tx.productTranslation.create({ data: { productVersionId: v.id, locale: "hr", productName: `SYNTHETIC — ${scenario}`, description: "Synthetic entitlement acceptance; not a real customer product." } });
      await tx.product.update({ where: { id: p.id }, data: { currentPublishedVersionId: v.id, lastPublishedAt: at } });
      await tx.passport.create({ data: { productId: p.id, organizationId, status: "ACTIVE", defaultLocale: "hr", firstPublishedAt: at, lastPublishedAt: at } });
      await tx.auditLog.create({ data: { organizationId, actorId: operatorId, action: "SYNTHETIC_PUBLIC_FIXTURE_CREATED", entityType: "PRODUCT", entityId: p.id, metadata: { scenario, controlledFixture: true }, correlationId: randomUUID() } });
      return p;
    });
    await regulatory.classify(operator, { productId: product.id, expectedClassification: "UNRESOLVED", classification: "VOLUNTARY", reason: "Approved synthetic commercial-expiry demonstration; no regulatory determination about existing customer products." });
    return { productId: product.id, publicCode };
  }
  for (const [scenario, date] of [["paid-grace-active", "2026-02-01T11:00:00Z"], ["paid-grace-expired", "2025-11-01T11:00:00Z"]] as const) {
    const payment = await purchase(ids[scenario], new Date(date), "start", "STANDARD", 14700);
    results.push({ scenario, requestId: payment.requestId, ...await publicFixture(ids[scenario], scenario) });
  }
  results.push({ scenario: "trial-expired", ...await publicFixture(ids["trial-expired"], "trial-expired") });
  // Fixed dates keep retries stable; no server clock change or historical receipt update.
  const initial = await purchase(ids.upgrade, new Date("2026-09-30T12:00:00Z"), "start", "STANDARD", 14700);
  const end = initial.state.currentPeriod!.end;
  const upgraded = await purchase(ids.upgrade, new Date("2026-09-30T12:01:00Z"), "business", "UPGRADE", 1234);
  assert.equal(upgraded.state.currentPeriod!.planSlug, "business"); assert.equal(upgraded.state.currentPeriod!.end, end);
  results.push({ scenario: "upgrade", endUnchanged: end, requestId: upgraded.requestId });
  for (const scenario of ["downgrade-blocked", "downgrade-allowed"] as const) {
    const organizationId = ids[scenario];
    await purchase(organizationId, new Date("2026-06-30T10:00:00Z"), "business", "STANDARD", 29700);
    if (scenario === "downgrade-blocked") await admin.$transaction(async tx => {
      const count = await tx.product.count({ where: { organizationId } });
      if (count === 101) return;
      assert.equal(count, 0, "FIXTURE_PRODUCT_DRIFT");
      await tx.product.createMany({ data: Array.from({ length: 101 }, (_,i) => ({ organizationId, internalName: `SYNTHETIC retained quota fixture ${i+1}`, publicCode: createHash("sha256").update(`synthetic-blocked-${i+1}`).digest().subarray(0,16).toString("base64url") })) });
      await tx.auditLog.create({ data: { organizationId, actorId: operatorId, action: "SYNTHETIC_QUOTA_FIXTURE_CREATED", entityType: "ORGANIZATION", entityId: organizationId, metadata: { storedProducts: 101, controlledFixture: true }, correlationId: randomUUID() } });
    });
    const lower = await purchase(organizationId, new Date("2026-06-30T10:01:00Z"), "start", "DOWNGRADE", 14700);
    const rights = await app.$transaction(tx => readEntitlements(tx, organizationId));
    assert.equal(rights.kind, scenario === "downgrade-blocked" ? "EXPIRED" : "PAID");
    if (scenario === "downgrade-blocked") assert.ok(rights.blockedReasons.includes("STORED_PRODUCT_LIMIT"));
    else assert.equal(rights.planSlug, "start");
    results.push({ scenario, requestId: lower.requestId, rights: rights.kind, blockedReasons: rights.blockedReasons });
  }
  console.log(JSON.stringify({ stagingServiceProof: "PASS", results, paymentKind: "SIMULATED_PAYMENT", actualPayment: false, evidence: "Runtime-role services with controlled fixture dates; browser/HTTP acceptance separate", productionChanges: "NONE" }));
}
void main().catch((error: unknown) => { console.error(JSON.stringify({ result: "STOP", phase, errorCode: error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : null, reason: error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "STAGING_SCENARIO_FAILED", retry: "MANUAL_REVIEW_REQUIRED" })); process.exitCode=1; }).finally(async () => { await app.$disconnect(); await admin.$disconnect(); await auth.$disconnect(); });
