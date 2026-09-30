import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createTestPrismaClient, requireSafeTestDatabaseConfig } from "../helpers/test-database";
import { ReminderWorker } from "../../src/infrastructure/subscriptions/reminder-worker";
import { ReminderOperations } from "../../src/infrastructure/subscriptions/reminder-operations";
import { PrismaCommercial } from "../../src/infrastructure/subscriptions/prisma-commercial";
import type { CommercialActor } from "../../src/application/subscriptions/contracts";
import type { ReminderTransport } from "../../src/infrastructure/subscriptions/reminder-transport";
import { reminderRecipients, campaignScopeSchema } from "../../src/infrastructure/subscriptions/reminder-recipients";
import { calendarAnchor } from "../../src/application/subscriptions/calendar";
import { TRIAL_LIMITS } from "../../src/application/subscriptions/entitlements";
import { readReminderCoverage } from "../../src/infrastructure/subscriptions/entitlement-runtime";
const db = createTestPrismaClient(requireSafeTestDatabaseConfig(process.env));
test.after(() => db.$disconnect());
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
async function fixture(maxDispatches = 10, trial = true) {
  const owner = await person(), operator = await person();
  await db.platformBillingGrant.create({ data: { userId: operator.user.id } });
  const org = await db.organization.create({ data: { displayName: "SYNTHETIC reminder", defaultLocale: "hr" } });
  const membership = await db.membership.create({ data: { organizationId: org.id, userId: owner.user.id, role: "OWNER" } });
  await db.organizationEntitlementEnrollment.create({ data: { organizationId: org.id, enrolledAt: at, trialStartedAt: trial ? new Date("2026-09-30T10:00:00Z") : null, trialEndsAt: trial ? new Date("2027-03-31T10:00:00Z") : null, reason: "Synthetic reminder proof" } });
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
