/** Approved synthetic fixtures only. No transport, auth sessions, existing period edits or real payments. */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "../../src/generated/prisma/client";
import proposal from "../../codex/evidence/subscription-reminders/delivery-proposal.json";
import { addCalendarMonths, calendarAnchor } from "../../src/application/subscriptions/calendar";
import { quotePlan } from "../../src/application/subscriptions/catalog";
import { snapshotSchema } from "../../src/application/subscriptions/contracts";
import { trialWindow } from "../../src/application/subscriptions/entitlements";
import { reminderDecision, reminderThreshold } from "../../src/application/subscriptions/reminders";
import { readReminderCoverage } from "../../src/infrastructure/subscriptions/entitlement-runtime";

import { NodeProductPublicCodeGenerator } from "../../src/infrastructure/crypto/node-product-public-code-generator";
import { createGetPublicDppService } from "../../src/application/public-dpp/get-public-dpp";
import { PrismaPublicDppPersistence } from "../../src/infrastructure/persistence/prisma/prisma-public-dpp";

export const approval = proposal;
const [trial, renewal, publicFixture] = proposal.fixtureOrganizations;
const [subscriptionCampaign, publicCampaign] = proposal.campaigns;
const operator = proposal.operators[0];
const reference = "APPROVED_SUBSCRIPTION_REMINDERS_STAGING_20260930";
type Tx = Prisma.TransactionClient;
const emails = [proposal.owner.email, operator.email];

export function assertApproval(now: Date) {
  assert.equal(proposal.status, "APPROVED_BY_USER");
  assert.equal(proposal.maximumSmtpDispatches, 4);
  assert.ok(now < new Date(proposal.expiresAt), "APPROVAL_EXPIRED");
  assert.equal(reminderThreshold(new Date(trial.trialEndsAt!), now, true), 1, "APPROVED_WINDOW_REQUIRED");
}
async function identities(tx: Tx) {
  for (const person of [proposal.owner, operator]) {
    const user = await tx.user.findUniqueOrThrow({ where: { id: person.userId } });
    assert.equal(user.email, person.email);
    const matches = await tx.authIdentity.findMany({ where: { userId: user.id, provider: "BETTER_AUTH", revokedAt: null } });
    assert.equal(matches.length, 1);
    const provider = await tx.authProviderUser.findUniqueOrThrow({ where: { id: matches[0].providerSubject } });
    assert.ok(provider.emailVerified && provider.email === person.email, "VERIFIED_APPROVED_RECIPIENT_REQUIRED");
  }
  assert.equal((await tx.platformBillingGrant.findUniqueOrThrow({ where: { userId: operator.userId } })).revokedAt, null);
  assert.equal((await tx.platformRegulatoryGrant.findUniqueOrThrow({ where: { userId: operator.userId } })).revokedAt, null);
}
async function audit(tx: Tx, organizationId: string, action: string, metadata: Prisma.InputJsonObject = {}) {
  await tx.auditLog.create({ data: { organizationId, actorId: operator.userId, action, entityType: "SYNTHETIC_REMINDER_ACCEPTANCE", entityId: organizationId, correlationId: randomUUID(), metadata: { approvalReference: reference, ...metadata } } });
}
async function paid(tx: Tx, organizationId: string, startText: string, endText: string, now: Date) {
  const start = new Date(startText), end = new Date(endText), quote = quotePlan("start", 3);
  assert.equal(addCalendarMonths(start, 3).toISOString(), end.toISOString());
  const profile = await tx.organizationBillingProfile.findUniqueOrThrow({ where: { organizationId } });
  const { organizationId: _org, revision: _revision, createdAt: _created, updatedAt: _updated, ...billingProfile } = profile;
  void _org; void _revision; void _created; void _updated;
  const snapshot = snapshotSchema.parse({ version: 1, offerIssuedAt: now.toISOString(), planSlug: "start", months: 3, currency: "EUR", netAmountCents: quote.priceCents, totalAmountCents: quote.priceCents, taxTreatment: "SYNTHETIC ONLY - no actual payment", termsVersion: reference, limits: quote.limits, billingProfile, billingRevision: profile.revision, timezone: "Europe/Zagreb", startPolicy: "ON_PAYMENT", scheduledStart: null, scheduledEnd: null, anchor: null, publicRetentionMonths: 6, privateRetentionMonths: 12 });
  const request = await tx.commercialRequest.create({ data: { organizationId, idempotencyKey: randomUUID(), payloadHash: createHash("sha256").update(JSON.stringify({ organizationId, startText, endText, reference })).digest("hex"), planSlug: "start", months: 3, createdById: proposal.owner.userId } });
  const offer = await tx.commercialOffer.create({ data: { requestId: request.id, revision: 1, issuer: reference, referenceYear: 2026, referenceNumber: "OFFER-" + organizationId, snapshot, createdById: operator.userId, createdAt: now, expiresAt: new Date(proposal.expiresAt) } });
  await tx.commercialRequest.update({ where: { id: request.id }, data: { status: "OFFERED" } });
  await tx.commercialRequest.update({ where: { id: request.id }, data: { status: "ACCEPTED", acceptedOfferId: offer.id, acceptedAt: now } });
  const period = await tx.subscriptionPaidPeriod.create({ data: { organizationId, requestId: request.id, offerId: offer.id, planSlug: "start", startsAt: start, endsAt: end, anchor: calendarAnchor(start), snapshot, paymentKind: "SIMULATED_PAYMENT", issuer: reference, referenceYear: 2026, referenceNumber: "PAYMENT-" + organizationId, confirmedById: operator.userId, confirmedAt: now } });
  await tx.commercialRequest.update({ where: { id: request.id }, data: { status: "PAID" } });
  await audit(tx, organizationId, "REMINDER_SYNTHETIC_PERIOD_CREATED", { periodId: period.id, startsAt: startText, endsAt: endText, paymentKind: "SIMULATED_PAYMENT" });
  return period.id;
}
export async function createApprovedFixtures(db: PrismaClient, now = new Date()) {
  assertApproval(now);
  return db.$transaction(async tx => {
    await identities(tx);
    assert.equal(await tx.reminderCampaign.count(), 0, "NO_EXISTING_CAMPAIGNS_EXPECTED");
    assert.equal(await tx.organization.count({ where: { OR: [{ id: { in: proposal.fixtureOrganizations.map(f => f.id) } }, { slug: { in: proposal.fixtureOrganizations.map(f => f.slug) } }] } }), 0, "DO_NOT_RECREATE_FIXTURES");
    for (const fixture of proposal.fixtureOrganizations) {
      await tx.organization.create({ data: { id: fixture.id, displayName: fixture.name, slug: fixture.slug, defaultLocale: "hr", timezone: "Europe/Zagreb", countryCode: "HR" } });
      await tx.membership.create({ data: { organizationId: fixture.id, userId: proposal.owner.userId, role: "OWNER", joinedAt: now } });
      await tx.organizationBillingProfile.create({ data: { organizationId: fixture.id, legalName: fixture.name, addressLine1: "SYNTHETIC test fixture", city: "Zagreb", countryCode: "HR", billingEmail: proposal.owner.email } });
      const window = fixture.trialStartsAt ? trialWindow(new Date(fixture.trialStartsAt)) : null;
      if (window) assert.equal(window.end.toISOString(), fixture.trialEndsAt);
      await tx.organizationEntitlementEnrollment.create({ data: { organizationId: fixture.id, enrolledAt: now, trialStartedAt: window?.start, trialEndsAt: window?.end, reason: reference + "; new synthetic fixture with explicitly approved controlled dates" } });
      await audit(tx, fixture.id, "REMINDER_SYNTHETIC_FIXTURE_CREATED");
    }
    const periodId = await paid(tx, publicFixture.id, publicFixture.newSimulatedPeriodStartsAt!, publicFixture.newSimulatedPeriodEndsAt!, now);
    const product = await tx.product.create({ data: { organizationId: publicFixture.id, internalName: "SYNTHETIC voluntary reminder fixture", publicCode: new NodeProductPublicCodeGenerator().generate(), regulatoryClassification: "VOLUNTARY", regulatoryClassifiedAt: now, regulatoryClassifiedById: operator.userId, regulatoryReason: reference, createdById: operator.userId } });
    const version = await tx.productVersion.create({ data: { organizationId: publicFixture.id, productId: product.id, status: "PUBLISHED", sourceLocale: "hr", versionNumber: 1, publishedAt: now, createdById: operator.userId, publishedById: operator.userId, translations: { create: { locale: "hr", productName: "SYNTHETIC — podsjetnik javnog roka", publicNotes: "Namjenski staging fixture; nije stvarni proizvod." } } } });
    await tx.product.update({ where: { id: product.id }, data: { currentPublishedVersionId: version.id, lastPublishedAt: now } });
    const passport = await tx.passport.create({ data: { organizationId: publicFixture.id, productId: product.id, status: "ACTIVE", defaultLocale: "hr", firstPublishedAt: now, lastPublishedAt: now } });
    assert.equal((await createGetPublicDppService({ persistence: new PrismaPublicDppPersistence(tx) })({ publicCode: product.publicCode, requestedLocale: "hr", acceptLanguage: null })).kind, "PUBLIC", "REAL_PUBLIC_FIXTURE_REQUIRED");
    for (const campaign of proposal.campaigns) await tx.reminderCampaign.create({ data: { id: campaign.id, organizationIds: campaign.initialOrganizationIds, recipientEmails: emails, operatorEmails: [operator.email], messageKinds: campaign.messageKinds, maxDispatches: campaign.maxDispatches, enabled: true, expiresAt: new Date(proposal.expiresAt), approvalReference: reference } });
    for (const f of [trial, renewal]) {
      const decision = reminderDecision(await readReminderCoverage(tx, f.id, now)).subscription;
      assert.ok(decision); assert.equal(decision.threshold, 1); assert.equal(decision.deadline.toISOString(), f.trialEndsAt);
    }
    const decision = reminderDecision(await readReminderCoverage(tx, publicFixture.id, now)).publicAvailability;
    assert.ok(decision); assert.equal(decision.threshold, 1); assert.equal(decision.deadline.toISOString(), publicFixture.publicEndsAt); assert.equal(decision.eligiblePublications, 1);
    await audit(tx, publicFixture.id, "REMINDER_SYNTHETIC_PUBLICATION_CREATED", { productId: product.id, versionId: version.id, passportId: passport.id });
    return { organizationIds: proposal.fixtureOrganizations.map(f => f.id), campaignIds: proposal.campaigns.map(c => c.id), publicPeriodId: periodId, productId: product.id, publicCode: product.publicCode, versionId: version.id, passportId: passport.id, billingEmailConfirmed: false, transportCalls: 0 };
  }, { timeout: 20000 });
}
async function approvedCampaigns(tx: Tx, narrow: boolean, enabled = true) {
  assert.equal(await tx.reminderCampaign.count(), 2, "CAMPAIGN_SET_DRIFT");
  for (const expected of proposal.campaigns) {
    const row = await tx.reminderCampaign.findUniqueOrThrow({ where: { id: expected.id } });
    assert.deepEqual(row.organizationIds, narrow ? expected.sendOrganizationIds : expected.initialOrganizationIds);
    assert.deepEqual(row.recipientEmails, emails); assert.deepEqual(row.operatorEmails, [operator.email]); assert.deepEqual(row.messageKinds, expected.messageKinds);
    assert.equal(row.maxDispatches, 2); assert.equal(row.expiresAt.toISOString(), proposal.expiresAt); assert.equal(row.approvalReference, reference);
    assert.equal(row.enabled, enabled); assert.equal(row.leaseToken, null); assert.equal(row.leaseUntil, null);
  }
}
export async function appendApprovedRenewal(db: PrismaClient, now = new Date()) {
  assertApproval(now);
  return db.$transaction(async tx => {
    await identities(tx); await approvedCampaigns(tx, false);
    assert.equal(await tx.reminderAttempt.count(), 0, "NO_SEND_BEFORE_CANCELLATION_PROOF");
    assert.equal(await tx.subscriptionReminder.count(), 4);
    for (const f of [trial, renewal]) {
      const rows = await tx.subscriptionReminder.findMany({ where: { organizationId: f.id } });
      assert.equal(rows.length, 2); assert.deepEqual(rows.map(r => r.recipient).sort(), [...emails].sort());
      assert.ok(rows.every(r => r.status === "PENDING" && r.attempts === 0 && r.threshold === 1 && r.kind === "SUBSCRIPTION" && r.deadline.toISOString() === f.trialEndsAt));
    }
    assert.equal(await tx.subscriptionPaidPeriod.count({ where: { organizationId: renewal.id } }), 0);
    const periodId = await paid(tx, renewal.id, renewal.newSimulatedRenewalStartsAt!, renewal.newSimulatedRenewalEndsAt!, now);
    assert.equal(reminderDecision(await readReminderCoverage(tx, renewal.id, now)).subscription, null);
    return { renewalPeriodId: periodId, transportCalls: 0 };
  }, { timeout: 20000 });
}
export async function narrowApprovedScope(db: PrismaClient, now = new Date()) {
  assertApproval(now);
  return db.$transaction(async tx => {
    await approvedCampaigns(tx, false);
    assert.equal(await tx.reminderAttempt.count(), 0);
    const cancelled = await tx.subscriptionReminder.findMany({ where: { organizationId: renewal.id } });
    assert.equal(cancelled.length, 2); assert.ok(cancelled.every(r => r.status === "CANCELLED" && r.attempts === 0 && r.lastError === "STALE_OR_UNAUTHORIZED"));
    assert.equal(await tx.auditLog.count({ where: { organizationId: renewal.id, action: "REMINDER_CANCELLED" } }), 2);
    await tx.reminderCampaign.update({ where: { id: subscriptionCampaign.id }, data: { organizationIds: subscriptionCampaign.sendOrganizationIds } });
    await audit(tx, renewal.id, "REMINDER_APPROVED_SCOPE_NARROWED", { campaignId: subscriptionCampaign.id });
    return { cancelled: 2, transportCalls: 0 };
  });
}
export async function approvedSummary(db: PrismaClient) {
  return db.$transaction(async tx => {
    await approvedCampaigns(tx, true);
    const campaigns = await tx.reminderCampaign.findMany({ orderBy: { id: "asc" }, select: { id: true, enabled: true, dispatches: true, maxDispatches: true, lastStartedAt: true, lastSuccessAt: true, lastError: true } });
    const deliveries = await tx.subscriptionReminder.findMany({ orderBy: [{ organizationId: "asc" }, { recipient: "asc" }], select: { id: true, organizationId: true, campaignId: true, recipient: true, kind: true, threshold: true, status: true, attempts: true, deadline: true, acceptedAt: true, receiptConfirmedAt: true, lastError: true } });
    const attempts = await tx.reminderAttempt.findMany({ orderBy: { startedAt: "asc" }, select: { reminderId: true, number: true, status: true, reason: true } });
    assert.ok(campaigns.reduce((n, c) => n + c.dispatches, 0) <= 4); assert.ok(attempts.length <= 4);
    assert.ok(deliveries.every(r => proposal.fixtureOrganizations.some(f => f.id === r.organizationId) && emails.includes(r.recipient)));
    return { campaigns, deliveries, attempts, subscriptionCampaignId: subscriptionCampaign.id, publicCampaignId: publicCampaign.id };
  });
}

/** Resume only the retained, never-dispatched fixture set after the operator launcher repair. */
export async function resumeApprovedFixtures(db: PrismaClient, expected: Awaited<ReturnType<typeof createApprovedFixtures>>, now = new Date()) {
  assertApproval(now);
  assert.deepEqual(expected.organizationIds, proposal.fixtureOrganizations.map(f => f.id));
  assert.deepEqual(expected.campaignIds, proposal.campaigns.map(c => c.id));
  assert.equal(expected.transportCalls, 0); assert.equal(expected.billingEmailConfirmed, false);
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "ReminderCampaign" ORDER BY id FOR UPDATE`;
    await identities(tx); await approvedCampaigns(tx, false, false);
    assert.equal(await tx.subscriptionReminder.count(), 0, "EXISTING_OUTBOX_REQUIRES_REVIEW");
    assert.equal(await tx.reminderAttempt.count(), 0, "EXISTING_ATTEMPT_REQUIRES_REVIEW");
    for (const c of await tx.reminderCampaign.findMany()) {
      assert.equal(c.dispatches, 0, "NEVER_RESET_DISPATCH_BUDGET");
      assert.equal(c.lastStartedAt, null); assert.equal(c.lastSuccessAt, null); assert.equal(c.lastError, null);
    }
    for (const fixture of proposal.fixtureOrganizations) {
      const org = await tx.organization.findUniqueOrThrow({ where: { id: fixture.id } });
      assert.equal(org.displayName, fixture.name); assert.equal(org.slug, fixture.slug); assert.equal(org.status, "ACTIVE"); assert.equal(org.defaultLocale, "hr");
      const members = await tx.membership.findMany({ where: { organizationId: org.id } });
      assert.equal(members.length, 1); assert.equal(members[0].userId, proposal.owner.userId); assert.equal(members[0].role, "OWNER"); assert.equal(members[0].status, "ACTIVE");
      const profile = await tx.organizationBillingProfile.findUniqueOrThrow({ where: { organizationId: org.id } });
      assert.equal(profile.billingEmail, proposal.owner.email); assert.equal(profile.revision, 1);
      assert.equal(await tx.billingEmailConfirmation.count({ where: { organizationId: org.id } }), 0);
      const enrollment = await tx.organizationEntitlementEnrollment.findUniqueOrThrow({ where: { organizationId: org.id } });
      assert.equal(enrollment.trialStartedAt?.toISOString(), fixture.trialStartsAt);
      assert.equal(enrollment.trialEndsAt?.toISOString(), fixture.trialEndsAt);
      assert.equal(enrollment.exceptionStartsAt, null); assert.equal(enrollment.exceptionEndsAt, null);
    }
    const periods = await tx.subscriptionPaidPeriod.findMany({ where: { organizationId: { in: expected.organizationIds } } });
    assert.equal(periods.length, 1);
    const period = periods[0];
    assert.equal(period.id, expected.publicPeriodId); assert.equal(period.organizationId, publicFixture.id); assert.equal(period.paymentKind, "SIMULATED_PAYMENT");
    assert.equal(period.startsAt.toISOString(), publicFixture.newSimulatedPeriodStartsAt); assert.equal(period.endsAt.toISOString(), publicFixture.newSimulatedPeriodEndsAt);
    assert.equal(snapshotSchema.parse(period.snapshot).termsVersion, reference);
    assert.equal(await tx.subscriptionUpgradeReceipt.count({ where: { organizationId: { in: expected.organizationIds } } }), 0);
    const products = await tx.product.findMany({ where: { organizationId: { in: expected.organizationIds } }, include: { passport: true } });
    assert.equal(products.length, 1);
    const product = products[0];
    assert.equal(product.id, expected.productId); assert.equal(product.organizationId, publicFixture.id); assert.equal(product.publicCode, expected.publicCode);
    assert.equal(product.currentPublishedVersionId, expected.versionId); assert.equal(product.passport?.id, expected.passportId); assert.equal(product.regulatoryClassification, "VOLUNTARY");
    assert.equal((await createGetPublicDppService({ persistence: new PrismaPublicDppPersistence(tx) })({ publicCode: product.publicCode, requestedLocale: "hr", acceptLanguage: null })).kind, "PUBLIC");
    for (const f of [trial, renewal]) {
      const decision = reminderDecision(await readReminderCoverage(tx, f.id, now)).subscription;
      assert.ok(decision); assert.equal(decision.threshold, 1); assert.equal(decision.deadline.toISOString(), f.trialEndsAt);
    }
    const decision = reminderDecision(await readReminderCoverage(tx, publicFixture.id, now)).publicAvailability;
    assert.ok(decision); assert.equal(decision.threshold, 1); assert.equal(decision.deadline.toISOString(), publicFixture.publicEndsAt); assert.equal(decision.eligiblePublications, 1);
    const resumed = await tx.reminderCampaign.updateMany({ where: { id: { in: expected.campaignIds }, enabled: false, dispatches: 0 }, data: { enabled: true } });
    assert.equal(resumed.count, 2);
    for (const organizationId of expected.organizationIds) await audit(tx, organizationId, "REMINDER_APPROVED_SCOPE_RESUMED", { reason: "OPERATOR_LAUNCHER_REPAIRED", retainedFixtures: true, dispatchBudgetUnchanged: true });
    return expected;
  }, { timeout: 20000 });
}
