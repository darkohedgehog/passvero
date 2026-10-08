import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID, createHash } from "node:crypto";
import { createTestPrismaClient, requireSafeTestDatabaseConfig } from "../helpers/test-database";
import { ReminderWorker } from "../../src/infrastructure/subscriptions/reminder-worker";
import { ReminderOperations } from "../../src/infrastructure/subscriptions/reminder-operations";
import { PrismaCommercial } from "../../src/infrastructure/subscriptions/prisma-commercial";
import type { CommercialActor } from "../../src/application/subscriptions/contracts";
import type { ReminderTransport } from "../../src/infrastructure/subscriptions/reminder-transport";
import { reminderRecipients, campaignScopeSchema } from "../../src/infrastructure/subscriptions/reminder-recipients";
import { calendarAnchor } from "../../src/application/subscriptions/calendar";
import { TRIAL_LIMITS } from "../../src/application/subscriptions/entitlements";
import { PrismaVerifiedActivationPersistence } from "../../src/infrastructure/auth/prisma-controlled-activation";
import { readReminderCoverage } from "../../src/infrastructure/subscriptions/entitlement-runtime";
const db = createTestPrismaClient(requireSafeTestDatabaseConfig(process.env));
test.after(() => db.$disconnect());
test("automatic recipient mode follows verified owners rather than a historic address snapshot", async () => {
  const f = await fixture();
  const scope = campaignScopeSchema.parse({ ...f.campaign, automaticRecipients: true, recipientEmails: ["old@example.invalid"], operatorEmails: [] });
  const result = await db.$transaction(tx => reminderRecipients(tx, db, f.org.id, scope));
  assert.deepEqual(result.recipients.map(r => r.email), [f.owner.user.email]);
});
const at = new Date("2027-03-25T11:00:00Z");
const options = { canonicalOrigin: "https://staging.passvero.eu", runtimeEnvironment: "staging", now: () => at };
async function person() {
  const email = `${randomUUID()}@example.invalid`, user = await db.user.create({ data: { email, preferredLocale: "hr" } });
  const provider = await db.authProviderUser.create({ data: { id: randomUUID(), email, name: "Synthetic", emailVerified: true } });
  await db.authIdentity.create({ data: { userId: user.id, provider: "BETTER_AUTH", providerSubject: provider.id } });
  const session = await db.authProviderSession.create({ data: { id: randomUUID(), userId: provider.id, token: randomUUID(), expiresAt: new Date(Date.now() + 3600000) } });
  const actor: CommercialActor = { status: "AUTHENTICATED", currentUser: { userId: user.id }, providerSession: { provider: "BETTER_AUTH", providerSessionId: session.id } };
  return { user, provider, actor };
}
async function fixture(maxDispatches = 10, trial = true, enrolled = true) {
  const owner = await person(), operator = await person();
  await db.platformBillingGrant.create({ data: { userId: operator.user.id } });
  const org = await db.organization.create({ data: { displayName: "SYNTHETIC reminder", defaultLocale: "hr" } });
  const membership = await db.membership.create({ data: { organizationId: org.id, userId: owner.user.id, role: "OWNER" } });
  if (enrolled) await db.organizationEntitlementEnrollment.create({ data: { organizationId: org.id, enrolledAt: at, trialStartedAt: trial ? new Date("2026-09-30T10:00:00Z") : null, trialEndsAt: trial ? new Date("2027-03-31T10:00:00Z") : null, reason: "Synthetic reminder proof" } });
  await db.organizationBillingProfile.create({ data: { organizationId: org.id, legalName: "Synthetic", addressLine1: "Test", city: "Test", countryCode: "HR", billingEmail: owner.user.email } });
  const campaign = await db.reminderCampaign.create({ data: { organizationIds: [org.id], recipientEmails: [owner.user.email, operator.user.email], operatorEmails: [operator.user.email], messageKinds: ["SUBSCRIPTION"], maxDispatches, enabled: true, expiresAt: new Date("2027-04-01T00:00:00Z"), approvalReference: "Synthetic local proof" } });
  const api = new PrismaCommercial(db, db, options);
  const operations = new ReminderOperations(db, (tx, actor) => api.authorize(actor, tx));
  return { owner, operator, org, membership, campaign, operations };
}
test("durable dedup, competing workers and persistent global staging budget", async () => {
  const f = await fixture(2);
  await f.operations.confirmBillingEmail(f.operator.actor, { organizationId: f.org.id, email: f.owner.user.email, profileRevision: 1, evidenceReference: "Local possession proof" });
  const recipients: string[] = [];
  const sender: ReminderTransport = { async send(mail) { recipients.push(mail.recipient); return { status: "ACCEPTED" }; } };
  const a = new ReminderWorker(db, db, sender, options), b = new ReminderWorker(db, db, sender, options);
  await Promise.all([a.run(f.campaign.id), b.run(f.campaign.id)]);
  await b.run(f.campaign.id);
  assert.equal(recipients.length, 2); assert.equal(new Set(recipients).size, 2);
  assert.equal(await db.subscriptionReminder.count({ where: { campaignId: f.campaign.id } }), 2);
  assert.equal(await db.reminderAttempt.count({ where: { reminder: { campaignId: f.campaign.id } } }), 2);
  assert.equal((await db.reminderCampaign.findUniqueOrThrow({ where: { id: f.campaign.id } })).dispatches, 2);
  const view = await f.operations.overview(f.operator.actor);
  assert.ok(view.campaigns.some(c => c.id === f.campaign.id && c.lastSuccessAt));
  assert.ok(view.deliveries.every(d => !('operatorEmails' in d)));
  await assert.rejects(f.operations.overview(f.owner.actor), { code: "COMMERCIAL_FORBIDDEN" });
  await db.platformBillingGrant.update({ where: { userId: f.operator.user.id }, data: { revokedAt: new Date() } });
  await assert.rejects(f.operations.overview(f.operator.actor), { code: "COMMERCIAL_FORBIDDEN" });
});
test("enqueue then revoke OWNER and billing grant cancels pending messages", async () => {
  const f = await fixture(); let sends = 0;
  const worker = new ReminderWorker(db, db, { async send() { sends++; return { status: "ACCEPTED" }; } }, options);
  await worker.enqueue(f.campaign.id);
  await db.membership.update({ where: { id: f.membership.id }, data: { status: "SUSPENDED" } });
  await db.platformBillingGrant.update({ where: { userId: f.operator.user.id }, data: { revokedAt: new Date() } });
  await worker.run(f.campaign.id);
  assert.equal(sends, 0);
  assert.equal(await db.subscriptionReminder.count({ where: { campaignId: f.campaign.id, status: "CANCELLED" } }), 2);
});
test("safe retry backs off; ambiguous delivery and abandoned sends never automatically retry", async () => {
  const f = await fixture(); let now = at, sends = 0;
  const worker = new ReminderWorker(db, db, { async send() { sends++; return sends === 1 ? { status: "SAFE_RETRY", reason: "SMTP_CONNECT_FAILED" } : { status: "UNKNOWN", reason: "SMTP_OUTCOME_UNKNOWN" }; } }, { ...options, now: () => now });
  await worker.run(f.campaign.id); assert.equal(sends, 2);
  await worker.run(f.campaign.id); assert.equal(sends, 2);
  now = new Date(at.getTime() + 300001);
  await worker.run(f.campaign.id); assert.equal(sends, 3);
  await worker.run(f.campaign.id); assert.equal(sends, 3);
  assert.equal(await db.subscriptionReminder.count({ where: { campaignId: f.campaign.id, status: "DELIVERY_UNKNOWN" } }), 2);
  const row = await db.subscriptionReminder.findFirstOrThrow({ where: { campaignId: f.campaign.id } });
  assert.throws(() => f.operations.resolve(f.operator.actor, { reminderId: row.id, action: "RETRY", evidenceReference: "Not supported" }));
  await f.operations.resolve(f.operator.actor, { reminderId: row.id, action: "CONFIRM_ACCEPTED", evidenceReference: "Provider accepted evidence" });
  assert.equal((await db.subscriptionReminder.findUniqueOrThrow({ where: { id: row.id } })).status, "SENT");
  assert.equal((await db.subscriptionReminder.findUniqueOrThrow({ where: { id: row.id } })).receiptConfirmedAt, null);
});

async function paid(f: Awaited<ReturnType<typeof fixture>>, start: Date, end: Date) {
  const request = await db.commercialRequest.create({ data: { organizationId: f.org.id, idempotencyKey: randomUUID(), payloadHash: randomUUID(), planSlug: "start", months: 3, createdById: f.owner.user.id } });
  const profile = await db.organizationBillingProfile.findUniqueOrThrow({ where: { organizationId: f.org.id } });
  const { organizationId: _organizationId, revision: _revision, createdAt: _createdAt, updatedAt: _updatedAt, ...billingProfile } = profile;
  void _organizationId; void _revision; void _createdAt; void _updatedAt;
  const snapshot = { version: 1, offerIssuedAt: start.toISOString(), planSlug: "start", months: 3, currency: "EUR", netAmountCents: 14700, totalAmountCents: 14700, taxTreatment: "Synthetic", termsVersion: "test", limits: TRIAL_LIMITS, billingProfile, billingRevision: 1, timezone: "Europe/Zagreb", startPolicy: "ON_PAYMENT", scheduledStart: null, scheduledEnd: null, anchor: null, publicRetentionMonths: 6, privateRetentionMonths: 12 };
  const offer = await db.commercialOffer.create({ data: { requestId: request.id, revision: 1, issuer: f.org.id, referenceYear: 2027, referenceNumber: randomUUID(), snapshot, createdById: f.operator.user.id, createdAt: start, expiresAt: end } });
  await db.commercialRequest.update({ where: { id: request.id }, data: { status: "OFFERED" } });
  await db.commercialRequest.update({ where: { id: request.id }, data: { status: "ACCEPTED", acceptedOfferId: offer.id, acceptedAt: start } });
  const period = await db.subscriptionPaidPeriod.create({ data: { organizationId: f.org.id, requestId: request.id, offerId: offer.id, planSlug: "start", startsAt: start, endsAt: end, anchor: calendarAnchor(start), snapshot, paymentKind: "SIMULATED_PAYMENT", issuer: f.org.id, referenceYear: 2027, referenceNumber: randomUUID(), confirmedById: f.operator.user.id } });
  await db.commercialRequest.update({ where: { id: request.id }, data: { status: "PAID" } });
  return period;
}
test("renewal between enqueue and send cancels the old deadline without touching sent history", async () => {
  const f = await fixture(); let sends = 0;
  const worker = new ReminderWorker(db, db, { async send() { sends++; return { status: "ACCEPTED" }; } }, options);
  await worker.enqueue(f.campaign.id);
  const original = await db.subscriptionReminder.findMany({ where: { campaignId: f.campaign.id } });
  assert.equal(original.length, 2);
  await paid(f, new Date("2027-03-31T10:00:00Z"), new Date("2027-06-30T10:00:00Z"));
  await worker.run(f.campaign.id); assert.equal(sends, 0);
  assert.equal(await db.subscriptionReminder.count({ where: { id: { in: original.map(r => r.id) }, status: "CANCELLED" } }), 2);
});
test("billing email must be explicitly confirmed and profile revision changes revoke that eligibility", async () => {
  const f = await fixture(), billing = "billing-" + randomUUID() + "@example.invalid";
  await db.organizationBillingProfile.update({ where: { organizationId: f.org.id }, data: { billingEmail: billing, revision: 2 } });
  const campaign = await db.reminderCampaign.update({ where: { id: f.campaign.id }, data: { recipientEmails: [f.owner.user.email, f.operator.user.email, billing] } });
  const get = () => db.$transaction(tx => reminderRecipients(tx, db, f.org.id, campaignScopeSchema.parse(campaign)));
  assert.equal((await get()).recipients.length, 2);
  await f.operations.confirmBillingEmail(f.operator.actor, { organizationId: f.org.id, email: billing.toUpperCase(), profileRevision: 2, evidenceReference: "Synthetic possession verified" });
  assert.equal((await get()).recipients.length, 3);
  await db.organizationBillingProfile.update({ where: { organizationId: f.org.id }, data: { revision: 3 } });
  assert.equal((await get()).recipients.length, 2);
  await db.authProviderUser.update({ where: { id: f.owner.provider.id }, data: { emailVerified: false } });
  assert.equal((await get()).recipients.length, 1);
});
test("crash recovery fences SENDING and safely reclaims CLAIMED; finite retries stop at three", async () => {
  const f = await fixture(); let sends = 0, now = at;
  const worker = new ReminderWorker(db, db, { async send() { sends++; return { status: "SAFE_RETRY", reason: "SMTP_CONNECT_FAILED" }; } }, { ...options, now: () => now });
  await worker.enqueue(f.campaign.id);
  const rows = await db.subscriptionReminder.findMany({ where: { campaignId: f.campaign.id }, orderBy: { id: "asc" } });
  const token = randomUUID();
  await db.subscriptionReminder.update({ where: { id: rows[0].id }, data: { status: "SENDING", attempts: 1, leaseToken: token, leaseUntil: new Date(at.getTime() - 1) } });
  await db.reminderAttempt.create({ data: { reminderId: rows[0].id, number: 1, token } });
  await db.subscriptionReminder.update({ where: { id: rows[1].id }, data: { status: "CLAIMED", leaseToken: randomUUID(), leaseUntil: new Date(at.getTime() - 1) } });
  await worker.run(f.campaign.id); assert.equal(sends, 1);
  now = new Date(at.getTime() + 300000); await worker.run(f.campaign.id); assert.equal(sends, 2);
  now = new Date(at.getTime() + 2100000); await worker.run(f.campaign.id); assert.equal(sends, 3);
  now = new Date(at.getTime() + 9900000); await worker.run(f.campaign.id); assert.equal(sends, 3);
  assert.equal((await db.subscriptionReminder.findUniqueOrThrow({ where: { id: rows[0].id } })).status, "DELIVERY_UNKNOWN");
  assert.equal((await db.subscriptionReminder.findUniqueOrThrow({ where: { id: rows[1].id } })).status, "FAILED");
  assert.equal((await db.reminderAttempt.findUniqueOrThrow({ where: { token } })).reason, "ATTEMPT_OUTCOME_NOT_RECORDED");
});
test("public reminders require a real current VOLUNTARY publication and reuse the paid deadline", async () => {
  const f = await fixture(10, false);
  await paid(f, new Date("2026-07-01T10:00:00Z"), new Date("2026-09-30T10:00:00Z"));
  await db.reminderCampaign.update({ where: { id: f.campaign.id }, data: { messageKinds: ["PUBLIC_AVAILABILITY"] } });
  const product = await db.product.create({ data: { organizationId: f.org.id, internalName: "Synthetic voluntary", publicCode: randomUUID(), regulatoryClassification: "UNRESOLVED" } });
  const version = await db.productVersion.create({ data: { organizationId: f.org.id, productId: product.id, status: "PUBLISHED", sourceLocale: "hr", versionNumber: 1, publishedAt: new Date("2026-08-01T10:00:00Z") } });
  await db.product.update({ where: { id: product.id }, data: { currentPublishedVersionId: version.id } });
  await db.passport.create({ data: { organizationId: f.org.id, productId: product.id, status: "ACTIVE", firstPublishedAt: version.publishedAt! } });
  const deliveries: string[] = [];
  const worker = new ReminderWorker(db, db, { async send(mail) { deliveries.push(mail.text); return { status: "ACCEPTED" }; } }, options);
  await worker.run(f.campaign.id); assert.equal(deliveries.length, 0);
  await db.product.update({ where: { id: product.id }, data: { regulatoryClassification: "MANDATORY", regulatoryClassifiedAt: at, regulatoryClassifiedById: f.operator.user.id, regulatoryReason: "Synthetic classification proof" } });
  await worker.run(f.campaign.id); assert.equal(deliveries.length, 0);
  await db.product.update({ where: { id: product.id }, data: { regulatoryClassification: "VOLUNTARY" } });
  await worker.run(f.campaign.id); assert.equal(deliveries.length, 2);
  assert.ok(deliveries.every(text => text.includes("VOLUNTARY") && text.includes("2027-03-31T10:00:00.000Z")));
});
test("production, disabled campaigns and addresses outside the approval cannot send", async () => {
  const f = await fixture(1); let sends = 0;
  const sender: ReminderTransport = { async send() { sends++; return { status: "ACCEPTED" }; } };
  const worker = new ReminderWorker(db, db, sender, options);
  await db.reminderCampaign.update({ where: { id: f.campaign.id }, data: { enabled: false } });
  await worker.run(f.campaign.id); assert.equal(sends, 0);
  await db.reminderCampaign.update({ where: { id: f.campaign.id }, data: { enabled: true, recipientEmails: [f.owner.user.email] } });
  await worker.run(f.campaign.id); assert.equal(sends, 1);
  await assert.rejects(new ReminderWorker(db, db, sender, { ...options, runtimeEnvironment: "production" }).run(f.campaign.id), /STAGING_REQUIRED/);
  assert.equal(sends, 1);
});
test("expired and disabled approvals still recover abandoned sends without sending", async () => {
  const f = await fixture(); let sends = 0;
  const worker = new ReminderWorker(db, db, { async send() { sends++; return { status: "ACCEPTED" }; } }, options);
  await worker.enqueue(f.campaign.id);
  const row = await db.subscriptionReminder.findFirstOrThrow({ where: { campaignId: f.campaign.id } });
  const token = randomUUID();
  await db.subscriptionReminder.update({ where: { id: row.id }, data: { status: "SENDING", attempts: 1, leaseToken: token, leaseUntil: new Date(at.getTime() - 1) } });
  await db.reminderAttempt.create({ data: { reminderId: row.id, number: 1, token } });
  await db.reminderCampaign.update({ where: { id: f.campaign.id }, data: { enabled: false, expiresAt: new Date(at.getTime() - 1) } });
  await worker.run(f.campaign.id);
  assert.equal(sends, 0);
  assert.equal((await db.subscriptionReminder.findUniqueOrThrow({ where: { id: row.id } })).status, "DELIVERY_UNKNOWN");
});
test("a new explicit approval adopts stranded pending messages without new logical rows", async () => {
  const f = await fixture(); let sends = 0;
  const worker = new ReminderWorker(db, db, { async send() { sends++; return { status: "ACCEPTED" }; } }, options);
  await worker.enqueue(f.campaign.id);
  const ids = (await db.subscriptionReminder.findMany({ where: { campaignId: f.campaign.id } })).map(r => r.id).sort();
  await db.reminderCampaign.update({ where: { id: f.campaign.id }, data: { enabled: false } });
  const next = await db.reminderCampaign.create({ data: { organizationIds: [f.org.id], recipientEmails: [f.owner.user.email, f.operator.user.email], operatorEmails: [f.operator.user.email], messageKinds: ["SUBSCRIPTION"], maxDispatches: 2, enabled: true, expiresAt: f.campaign.expiresAt, approvalReference: "New explicit local approval" } });
  await worker.run(next.id);
  assert.equal(sends, 2);
  assert.deepEqual((await db.subscriptionReminder.findMany({ where: { campaignId: next.id } })).map(r => r.id).sort(), ids);
  assert.equal(await db.auditLog.count({ where: { organizationId: f.org.id, action: "REMINDER_APPROVAL_REPLACED" } }), 2);
  await worker.run(next.id); assert.equal(sends, 2);
});
test("runtime role sends with narrow ACL but cannot create or expand delivery approvals", async () => {
  const f = await fixture(); let sends = 0;
  await db.$executeRawUnsafe('CREATE ROLE reminder_runtime_proof NOLOGIN');
  await db.$executeRawUnsafe('GRANT USAGE ON SCHEMA public TO reminder_runtime_proof');
  await db.$executeRawUnsafe('GRANT SELECT ON "User","Organization","Membership","AuthIdentity","PlatformBillingGrant","OrganizationBillingProfile","SubscriptionPaidPeriod","SubscriptionPaidPeriodActivation","SubscriptionUpgradeReceipt","OrganizationEntitlementEnrollment","Product","ProductVersion","Passport","ReminderCampaign" TO reminder_runtime_proof');
  await db.$executeRawUnsafe('GRANT SELECT,INSERT,UPDATE ON "SubscriptionReminder","ReminderAttempt","BillingEmailConfirmation" TO reminder_runtime_proof');
  await db.$executeRawUnsafe('GRANT SELECT,INSERT ON "AuditLog","AuthAuditEvent" TO reminder_runtime_proof');
  await db.$executeRawUnsafe('GRANT UPDATE ("dispatches","leaseToken","leaseUntil","lastStartedAt","lastSuccessAt","lastError") ON "ReminderCampaign" TO reminder_runtime_proof');
  const url = new URL(process.env.TEST_DATABASE_URL!); url.searchParams.set("options", "-c role=reminder_runtime_proof");
  const restricted = createTestPrismaClient(requireSafeTestDatabaseConfig({ NODE_ENV: "test", TEST_DATABASE_URL: url.toString() }));
  try {
    await new ReminderWorker(restricted, db, { async send() { sends++; return { status: "ACCEPTED" }; } }, options).run(f.campaign.id);
    assert.equal(sends, 2);
    await assert.rejects(restricted.reminderCampaign.update({ where: { id: f.campaign.id }, data: { maxDispatches: 100 } }));
    await assert.rejects(restricted.reminderCampaign.update({ where: { id: f.campaign.id }, data: { enabled: true } }));
    await assert.rejects(restricted.platformBillingGrant.update({ where: { userId: f.operator.user.id }, data: { revokedAt: new Date() } }));
  } finally { await restricted.$disconnect(); }
});
test("provider acceptance followed by failed database finalization becomes unknown on restart", async () => {
  const f = await fixture(); let now = at, sends = 0;
  const worker = new ReminderWorker(db, db, { async send() { sends++; return { status: "ACCEPTED" }; } }, { ...options, now: () => now });
  await db.$executeRawUnsafe(`CREATE FUNCTION reminder_proof_finalize_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status='SENT' THEN RAISE EXCEPTION 'synthetic finalization failure'; END IF; RETURN NEW; END $$`);
  await db.$executeRawUnsafe('CREATE TRIGGER reminder_proof_finalize_fail BEFORE UPDATE ON "SubscriptionReminder" FOR EACH ROW EXECUTE FUNCTION reminder_proof_finalize_fail()');
  try { await assert.rejects(worker.run(f.campaign.id), /REMINDER_WORKER_FAILED/); }
  finally {
    await db.$executeRawUnsafe('DROP TRIGGER reminder_proof_finalize_fail ON "SubscriptionReminder"');
    await db.$executeRawUnsafe('DROP FUNCTION reminder_proof_finalize_fail()');
  }
  assert.equal(sends, 1);
  now = new Date(at.getTime() + 300001); await worker.run(f.campaign.id);
  assert.equal(sends, 2);
  assert.equal(await db.subscriptionReminder.count({ where: { campaignId: f.campaign.id, status: "DELIVERY_UNKNOWN" } }), 1);
  await worker.run(f.campaign.id); assert.equal(sends, 2);
});
test("expiry reminder retains the last effective upgraded plan", async () => {
  const f = await fixture(10, false);
  await paid(f, new Date("2027-01-01T11:00:00Z"), new Date("2027-03-31T10:00:00Z"));
  const api = new PrismaCommercial(db, db, options);
  const requested = await api.request(f.owner.actor, f.org.id, { idempotencyKey: randomUUID(), planSlug: "business", months: 3, changeKind: "UPGRADE" });
  const request = requested.requests.find(r => r.status === "REQUESTED")!;
  const offered = await api.offer(f.operator.actor, { requestId: request.id, issuedAtLocal: "2027-03-25T12:00", reference: { issuer: f.org.id, year: 2027, number: "upgrade-offer" }, netAmountCents: 10000, totalAmountCents: 10000, taxTreatment: "Synthetic", termsVersion: "test" });
  const offer = offered.requests.find(r => r.id === request.id)!.offer!;
  await api.accept(f.owner.actor, f.org.id, { requestId: request.id, offerId: offer.id });
  await api.pay(f.operator.actor, { requestId: request.id, offerId: offer.id, reference: { issuer: f.org.id, year: 2027, number: "upgrade-payment" }, kind: "SIMULATED_PAYMENT" });
  const coverage = await db.$transaction(tx => readReminderCoverage(tx, f.org.id, new Date("2027-03-31T10:01:00Z")));
  assert.equal(coverage.periods[0].planSlug, "business");
});
test("pending downgrade warns conditionally; blocked activation does not suppress expiry", async () => {
  const f = await fixture(10, false); let now = at;
  const end = new Date("2027-03-31T10:00:00Z");
  await paid(f, new Date("2027-01-01T11:00:00Z"), end);
  const future = await paid(f, end, new Date("2027-06-30T10:00:00Z"));
  await db.subscriptionPaidPeriodActivation.create({ data: { periodId: future.id } });
  await db.product.createMany({ data: Array.from({ length: 4 }, () => ({ organizationId: f.org.id, internalName: "Synthetic quota", publicCode: randomUUID() })) });
  const bodies: string[] = [];
  const worker = new ReminderWorker(db, db, { async send(mail) { bodies.push(mail.text); return { status: "ACCEPTED" }; } }, { ...options, now: () => now });
  await worker.run(f.campaign.id); assert.equal(bodies.length, 2);
  assert.ok(bodies.every(body => body.includes("provjeri kvota")));
  now = end; await worker.run(f.campaign.id);
  assert.equal(bodies.length, 4);
  assert.ok(bodies.slice(2).every(body => body.includes("Razdoblje je isteklo")));
  assert.equal((await db.subscriptionPaidPeriodActivation.findUniqueOrThrow({ where: { periodId: future.id } })).status, "BLOCKED_REQUIRES_OPERATOR");
});

async function activationFixture(boundAt = new Date("2026-09-30T10:00:00Z")) {
  const f = await fixture(10, true, false);
  await db.organization.update({ where: { id: f.org.id }, data: { createdAt: new Date(boundAt.getTime() - 7200000) } });
  await db.$executeRaw`INSERT INTO "ReminderEnrollmentPolicy" (id,enabled,"enabledAt","approvalReference","excludedOrganizationIds") VALUES (1,true,'2025-01-01', 'Local enrollment proof','[]') ON CONFLICT (id) DO UPDATE SET enabled=true,"enabledAt"='2025-01-01'`;
  const intent = await db.accountActivationIntent.create({ data: { userId: f.owner.user.id, createdAt: new Date(boundAt.getTime() - 3600000), status: "EMAIL_VERIFIED", providerSubject: f.owner.provider.id, tokenDigest: createHash("sha256").update(randomUUID()).digest("base64url"), intendedEmailDigest: createHash("sha256").update(f.owner.user.email).digest("base64url"), emailVerifiedAt: boundAt, authAccountCreatedAt: new Date(boundAt.getTime() - 1800000), expiresAt: new Date("2027-01-01T00:00:00Z") } });
  await db.accessRequest.create({ data: { email: f.owner.user.email, contactName: "Synthetic", organizationDisplayName: "Synthetic", locale: "hr", status: "APPROVED", deliveryStatus: "SENT", deliveryAttempts: 1, deliveryAttemptId: randomUUID(), deliveryStartedAt: new Date(boundAt.getTime() - 3600000), deliveredAt: new Date(boundAt.getTime() - 3540000), decidedAt: new Date(boundAt.getTime() - 3600000), decidedBy: "LOCAL_PROOF", createdAt: new Date(boundAt.getTime() - 5400000), organizationId: f.org.id, userId: f.owner.user.id, activationId: intent.id } });
  const binding = { intentId: intent.id, providerSubject: f.owner.provider.id, boundAt: boundAt };
  const persistence = new PrismaVerifiedActivationPersistence();
  return { ...f, intent, binding, bind: (tx: Parameters<typeof persistence.markActivationBound>[0]) => persistence.markActivationBound(tx, binding) };
}
test("controlled trial and reminder enrollment commit atomically and replay creates no duplicate", async () => {
  const f = await activationFixture();
  assert.equal(await db.$transaction(f.bind), true);
  assert.equal(await db.$transaction(f.bind), false);
  const rows = await db.$queryRaw<{ organizationId: string; activationId: string }[]>`SELECT * FROM "OrganizationReminderEnrollment" WHERE "organizationId"=${f.org.id}::uuid`;
  assert.equal(rows.length, 1); assert.equal(rows[0].activationId, f.intent.id);
});
test("rolled back and excluded activation produce no reminder enrollment", async () => {
  const f = await activationFixture();
  await assert.rejects(db.$transaction(async tx => { await f.bind(tx); throw new Error("ROLLBACK_PROOF"); }), /ROLLBACK_PROOF/);
  assert.equal(await db.organizationEntitlementEnrollment.count({ where: { organizationId: f.org.id } }), 0);
  await db.$executeRaw`UPDATE "ReminderEnrollmentPolicy" SET "excludedOrganizationIds"=${JSON.stringify([f.org.id])}::jsonb WHERE id=1`;
  await db.$transaction(f.bind);
  assert.equal((await db.$queryRaw<unknown[]>`SELECT * FROM "OrganizationReminderEnrollment" WHERE "organizationId"=${f.org.id}::uuid`).length, 0);
});

test("competing reconciliation repairs missed campaign creation and follows paid renewals", async () => {
  const f = await activationFixture(); await db.$transaction(f.bind);
  const worker = new ReminderWorker(db, db, { async send() { return { status: "ACCEPTED" }; } }, options);
  await Promise.all([worker.reconcileEnrollments(), worker.reconcileEnrollments()]);
  const trial = await db.reminderCampaign.findMany({ where: { enrollmentOrganizationId: f.org.id } });
  assert.equal(trial.length, 1); assert.equal(trial[0].maxDispatches, 384);
  assert.equal(trial[0].expiresAt.toISOString(), "2027-04-07T10:00:00.000Z");
  await worker.enqueue(trial[0].id);
  const renewal = await paid(f, new Date("2027-03-31T10:00:00Z"), new Date("2027-06-30T10:00:00Z"));
  await worker.reconcileEnrollments();
  assert.equal(await db.subscriptionReminder.count({ where: { campaignId: trial[0].id, status: "PENDING" } }), 0);
  const next = new ReminderWorker(db, db, { async send() { return { status: "ACCEPTED" }; } }, { ...options, now: () => new Date("2027-06-24T10:00:00Z") });
  await next.reconcileEnrollments();
  const campaigns = await db.reminderCampaign.findMany({ where: { enrollmentOrganizationId: f.org.id } });
  assert.equal(campaigns.length, 2); assert.ok(campaigns.some(c => c.periodKey === `paid:${renewal.id}`));
});
test("recipient verification resumes current unsent key; policy disable and budget exhaustion stop sends", async () => {
  const f = await activationFixture(); await db.$transaction(f.bind); let sends = 0;
  const worker = new ReminderWorker(db, db, { async send() { sends++; return { status: "ACCEPTED" }; } }, options);
  await worker.reconcileEnrollments();
  const campaign = await db.reminderCampaign.findFirstOrThrow({ where: { enrollmentOrganizationId: f.org.id } });
  await worker.enqueue(campaign.id);
  await db.authProviderUser.update({ where: { id: f.owner.provider.id }, data: { emailVerified: false } });
  await worker.run(campaign.id); assert.equal(sends, 0);
  await db.authProviderUser.update({ where: { id: f.owner.provider.id }, data: { emailVerified: true } });
  await worker.run(campaign.id); assert.equal(sends, 1);
  await worker.run(campaign.id); assert.equal(sends, 1);
  await db.reminderCampaign.update({ where: { id: campaign.id }, data: { dispatches: 384 } });
  await worker.run(campaign.id); assert.equal(sends, 1);
  await db.reminderEnrollmentPolicy.update({ where: { id: 1 }, data: { enabled: false } });
  await worker.reconcileEnrollments(); await worker.run(campaign.id); assert.equal(sends, 1);
});

test("managed runtime reconciliation has no policy, budget or arbitrary campaign write authority", async () => {
  const f = await activationFixture(); await db.$transaction(f.bind);
  await db.$executeRawUnsafe('GRANT SELECT ON "ReminderEnrollmentPolicy","OrganizationReminderEnrollment" TO reminder_runtime_proof');
  await db.$executeRawUnsafe('GRANT UPDATE ("lastCheckedAt","lastError") ON "OrganizationReminderEnrollment" TO reminder_runtime_proof');
  await db.$executeRawUnsafe('GRANT EXECUTE ON FUNCTION record_reminder_enrollment(UUID,UUID),create_period_reminder_campaign(UUID,TEXT,TIMESTAMP),lock_reminder_enrollment_gate() TO reminder_runtime_proof');
  const url = new URL(process.env.TEST_DATABASE_URL!); url.searchParams.set("options", "-c role=reminder_runtime_proof");
  const restricted = createTestPrismaClient(requireSafeTestDatabaseConfig({ NODE_ENV: "test", TEST_DATABASE_URL: url.toString() }));
  try {
    const worker = new ReminderWorker(restricted, db, { async send() { return { status: "ACCEPTED" }; } }, options);
    await worker.reconcileEnrollments();
    const campaign = await db.reminderCampaign.findFirstOrThrow({ where: { enrollmentOrganizationId: f.org.id } });
    await worker.run(campaign.id);
    assert.equal((await db.reminderCampaign.findUniqueOrThrow({ where: { id: campaign.id } })).dispatches, 1);
    await assert.rejects(restricted.reminderEnrollmentPolicy.update({ where: { id: 1 }, data: { enabled: false } }));
    await assert.rejects(restricted.organizationReminderEnrollment.update({ where: { organizationId: f.org.id }, data: { enabled: true } }));
    await assert.rejects(restricted.reminderCampaign.update({ where: { id: campaign.id }, data: { maxDispatches: 500 } }));
    await assert.rejects(restricted.reminderCampaign.create({ data: { organizationIds: [f.org.id], recipientEmails: [f.owner.user.email], operatorEmails: [], messageKinds: ["SUBSCRIPTION"], maxDispatches: 10, expiresAt: at, approvalReference: "Unapproved" } }));
    const invalid = await restricted.$queryRaw<{ id: string | null }[]>`SELECT create_period_reminder_campaign(${f.org.id}::uuid,'paid:00000000-0000-0000-0000-000000000001',${at}::timestamp) AS id`;
    assert.equal(invalid[0].id, null);
  } finally { await restricted.$disconnect(); }
});
test("disabled tenants/campaigns stay disabled and next scheduler skips exhausted approvals", async () => {
  const f = await activationFixture(); await db.$transaction(f.bind);
  const worker = new ReminderWorker(db, db, { async send() { assert.fail("No approved dispatch"); } }, options);
  await worker.reconcileEnrollments();
  const campaign = await db.reminderCampaign.findFirstOrThrow({ where: { enrollmentOrganizationId: f.org.id } });
  await db.reminderCampaign.update({ where: { id: campaign.id }, data: { enabled: false } });
  await worker.reconcileEnrollments(); await worker.run(campaign.id);
  assert.equal((await db.reminderCampaign.findUniqueOrThrow({ where: { id: campaign.id } })).enabled, false);
  await db.organizationReminderEnrollment.update({ where: { organizationId: f.org.id }, data: { enabled: false, excludedAt: at } });
  await db.reminderCampaign.update({ where: { id: campaign.id }, data: { enabled: true } });
  await worker.reconcileEnrollments(); await worker.run(campaign.id);
  assert.equal((await db.reminderCampaign.findUniqueOrThrow({ where: { id: campaign.id } })).dispatches, 0);
  await db.reminderCampaign.updateMany({ data: { dispatches: 10 }, where: { maxDispatches: 10 } });
  const selected = await worker.nextCampaignId();
  assert.notEqual(selected, campaign.id);
  if (selected) { const row = await db.reminderCampaign.findUniqueOrThrow({ where: { id: selected } }); assert.ok(row.dispatches < row.maxDispatches); }
});
test("no missed thresholds or expiry backfill beyond seven days; confirmed requests alone never enroll", async () => {
  const f = await activationFixture();
  const worker = new ReminderWorker(db, db, { async send() { assert.fail("No expiry backfill"); } }, { ...options, now: () => new Date("2027-04-07T10:00:00Z") });
  await worker.reconcileEnrollments();
  assert.equal(await db.organizationReminderEnrollment.count({ where: { organizationId: f.org.id } }), 0);
  await db.$transaction(f.bind); await worker.reconcileEnrollments();
  const campaign = await db.reminderCampaign.findFirstOrThrow({ where: { enrollmentOrganizationId: f.org.id } });
  await worker.run(campaign.id);
  assert.equal(await db.subscriptionReminder.count({ where: { campaignId: campaign.id } }), 0);
});
test("existing explicit campaign is retained for its trial and renewal gets a distinct managed budget", async () => {
  const f = await fixture(12);
  await db.reminderEnrollmentPolicy.update({ where: { id: 1 }, data: { enabled: true } });
  await db.organizationReminderEnrollment.create({ data: { organizationId: f.org.id, enrolledAt: at, origin: "EXISTING_APPROVED", approvalReference: "Explicit local continuity proof" } });
  await db.reminderCampaign.update({ where: { id: f.campaign.id }, data: { enrollmentOrganizationId: f.org.id, periodKey: "trial:2026-09-30T10:00:00.000Z" } });
  const worker = new ReminderWorker(db, db, { async send() { return { status: "ACCEPTED" }; } }, options);
  await worker.reconcileEnrollments();
  assert.equal(await db.reminderCampaign.count({ where: { enrollmentOrganizationId: f.org.id } }), 1);
  assert.equal((await db.reminderCampaign.findUniqueOrThrow({ where: { id: f.campaign.id } })).maxDispatches, 12);
  const period = await paid(f, new Date("2027-03-31T10:00:00Z"), new Date("2027-06-30T10:00:00Z"));
  const future = new ReminderWorker(db, db, { async send() { return { status: "ACCEPTED" }; } }, { ...options, now: () => new Date("2027-04-01T10:00:00Z") });
  await future.reconcileEnrollments();
  const next = await db.reminderCampaign.findUniqueOrThrow({ where: { enrollmentOrganizationId_periodKey: { enrollmentOrganizationId: f.org.id, periodKey: `paid:${period.id}` } } });
  assert.equal(next.maxDispatches, 384); assert.equal(next.dispatches, 0);
});

test("managed plan change keeps spent budget; blocked downgrade cannot enroll a period but executed replacement can", async () => {
  const f = await activationFixture(); await db.$transaction(f.bind);
  let now = new Date("2027-01-10T11:00:00Z"), sequence = 0;
  const api = new PrismaCommercial(db, db, { ...options, now: () => now });
  const worker = new ReminderWorker(db, db, { async send() { return { status: "ACCEPTED" }; } }, { ...options, now: () => now });
  async function purchase(planSlug: "business" | "pro" | "start", changeKind: "STANDARD" | "UPGRADE" | "DOWNGRADE" | "REPLACEMENT", amount: number) {
    const requested = await api.request(f.owner.actor, f.org.id, { idempotencyKey: randomUUID(), planSlug, months: 3, changeKind });
    const request = requested.requests.find(r => r.status === "REQUESTED")!;
    const local = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Zagreb", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(now).replace(" ", "T");
    const offered = await api.offer(f.operator.actor, { requestId: request.id, issuedAtLocal: local, reference: { issuer: f.org.id, year: 2027, number: `O-${++sequence}` }, netAmountCents: amount, totalAmountCents: amount, taxTreatment: "Synthetic", termsVersion: "v2" });
    const offer = offered.requests.find(r => r.id === request.id)!.offer!;
    await api.accept(f.owner.actor, f.org.id, { requestId: request.id, offerId: offer.id });
    const state = await api.pay(f.operator.actor, { requestId: request.id, offerId: offer.id, reference: { issuer: f.org.id, year: 2027, number: `P-${sequence}` }, kind: "SIMULATED_PAYMENT" });
    return { request, state };
  }
  const initial = await purchase("business", "STANDARD", 29700);
  const base = await db.subscriptionPaidPeriod.findUniqueOrThrow({ where: { requestId: initial.request.id } });
  now = new Date("2027-04-04T10:00:00Z"); await worker.reconcileEnrollments();
  const campaign = await db.reminderCampaign.findUniqueOrThrow({ where: { enrollmentOrganizationId_periodKey: { enrollmentOrganizationId: f.org.id, periodKey: `paid:${base.id}` } } });
  await worker.run(campaign.id);
  const upgrade = await purchase("pro", "UPGRADE", 1234); assert.equal(upgrade.state.currentPeriod!.end, base.endsAt.toISOString());
  await worker.reconcileEnrollments(); await worker.run(campaign.id);
  assert.equal((await db.reminderCampaign.findUniqueOrThrow({ where: { id: campaign.id } })).dispatches, 1);
  await db.product.createMany({ data: Array.from({ length: 101 }, () => ({ organizationId: f.org.id, internalName: "Synthetic quota", publicCode: randomUUID() })) });
  const downgrade = await purchase("start", "DOWNGRADE", 14700);
  const blocked = await db.subscriptionPaidPeriod.findUniqueOrThrow({ where: { requestId: downgrade.request.id } });
  now = base.endsAt; await worker.reconcileEnrollments();
  assert.equal((await db.subscriptionPaidPeriodActivation.findUniqueOrThrow({ where: { periodId: blocked.id } })).status, "BLOCKED_REQUIRES_OPERATOR");
  assert.equal(await db.reminderCampaign.count({ where: { enrollmentOrganizationId: f.org.id, periodKey: `paid:${blocked.id}` } }), 0);
  assert.equal((await db.organizationReminderEnrollment.findUniqueOrThrow({ where: { organizationId: f.org.id } })).lastError, "BLOCKED_REQUIRES_OPERATOR");
  const replacement = await purchase("business", "REPLACEMENT", 29700);
  const replacementPeriod = await db.subscriptionPaidPeriod.findUniqueOrThrow({ where: { requestId: replacement.request.id } });
  await worker.reconcileEnrollments();
  const next = await db.reminderCampaign.findUniqueOrThrow({ where: { enrollmentOrganizationId_periodKey: { enrollmentOrganizationId: f.org.id, periodKey: `paid:${replacementPeriod.id}` } } });
  assert.equal(next.maxDispatches, 384); assert.equal(next.dispatches, 0);
});
test("automatic recipients deduplicate owner/billing and block oversized scope without truncation", async () => {
  const f = await fixture();
  await f.operations.confirmBillingEmail(f.operator.actor, { organizationId: f.org.id, email: f.owner.user.email, profileRevision: 1, evidenceReference: "Synthetic possession proof" });
  const scope = campaignScopeSchema.parse({ ...f.campaign, automaticRecipients: true, recipientEmails: [], operatorEmails: [] });
  const get = () => db.$transaction(tx => reminderRecipients(tx, db, f.org.id, scope));
  assert.equal((await get()).recipients.length, 1);
  for (let i = 0; i < 32; i++) { const owner = await person(); await db.membership.create({ data: { organizationId: f.org.id, userId: owner.user.id, role: "OWNER" } }); }
  const result = await get(); assert.equal(result.blocked, true); assert.equal(result.recipients.length, 0);
});

test("boundary and activation evidence exclude old tenants; concurrent bind/reconcile eventually creates one campaign", async () => {
  const f = await activationFixture();
  const worker = new ReminderWorker(db, db, { async send() { return { status: "ACCEPTED" }; } }, options);
  assert.equal(await db.$transaction(tx => new PrismaVerifiedActivationPersistence().markActivationBound(tx, { ...f.binding, providerSubject: "wrong-subject" })), false);
  assert.equal(await db.organizationReminderEnrollment.count({ where: { organizationId: f.org.id } }), 0);
  await Promise.all([db.$transaction(f.bind), worker.reconcileEnrollments()]);
  await Promise.all([worker.reconcileEnrollments(), worker.reconcileEnrollments()]);
  assert.equal(await db.reminderCampaign.count({ where: { enrollmentOrganizationId: f.org.id } }), 1);
  assert.equal(await db.auditLog.count({ where: { organizationId: f.org.id, action: "REMINDER_PERIOD_CAMPAIGN_CREATED" } }), 1);
  const campaign = await db.reminderCampaign.findFirstOrThrow({ where: { enrollmentOrganizationId: f.org.id } });
  await Promise.all([worker.run(campaign.id), worker.run(campaign.id)]);
  assert.equal(await db.reminderAttempt.count({ where: { reminder: { campaignId: campaign.id } } }), 1);
  await assert.rejects(db.reminderEnrollmentPolicy.update({ where: { id: 1 }, data: { enabledAt: new Date("2026-01-01") } }), /boundary/);
  await assert.rejects(db.organizationReminderEnrollment.delete({ where: { organizationId: f.org.id } }), /retained/);
  const old = await fixture(10, true, false);
  const intent = await db.accountActivationIntent.create({ data: { userId: old.owner.user.id, status: "EMAIL_VERIFIED", providerSubject: old.owner.provider.id, tokenDigest: createHash("sha256").update(randomUUID()).digest("base64url"), intendedEmailDigest: createHash("sha256").update(old.owner.user.email).digest("base64url"), emailVerifiedAt: at, authAccountCreatedAt: at, createdAt: at, expiresAt: new Date("2027-04-01") } });
  await db.accessRequest.create({ data: { email: old.owner.user.email, contactName: "Synthetic", organizationDisplayName: "Old tenant", locale: "hr", status: "APPROVED", deliveryStatus: "SENT", deliveryAttempts: 1, deliveryAttemptId: randomUUID(), deliveryStartedAt: at, deliveredAt: at, decidedAt: at, decidedBy: "LOCAL_PROOF", organizationId: old.org.id, userId: old.owner.user.id, activationId: intent.id } });
  // New activation on an organization that predates the boundary: not a new tenant.
  await db.organization.update({ where: { id: old.org.id }, data: { createdAt: new Date("2024-01-01") } });
  await db.$transaction(tx => new PrismaVerifiedActivationPersistence().markActivationBound(tx, { intentId: intent.id, providerSubject: old.owner.provider.id, boundAt: at }));
  assert.equal(await db.organizationReminderEnrollment.count({ where: { organizationId: old.org.id } }), 0);
});

test("seven-day expiry window preserves Zagreb earlier DST overlap", async () => {
  const f = await activationFixture(new Date("2026-04-18T00:30:00Z")); await db.$transaction(f.bind);
  const worker = new ReminderWorker(db, db, { async send() { return { status: "ACCEPTED" }; } }, { ...options, now: () => new Date("2026-10-18T00:30:00Z") });
  await worker.reconcileEnrollments();
  const campaign = await db.reminderCampaign.findFirstOrThrow({ where: { enrollmentOrganizationId: f.org.id } });
  assert.equal(campaign.expiresAt.toISOString(), "2026-10-25T00:30:00.000Z");
});
