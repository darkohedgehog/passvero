import assert from "node:assert/strict";
import test from "node:test";

import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { ApplicationError } from "../../src/application/errors/application-error";
import { PRODUCT_PUBLISH } from "../../src/application/permissions/product-permissions";
import type { PublishProductCommand } from "../../src/application/products/publish-product/contracts";
import { createPublishProductService } from "../../src/application/products/publish-product/publish-product";
import type { PublishProductPersistence } from "../../src/application/products/publish-product/ports";

const organizationId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const membershipId = "33333333-3333-4333-8333-333333333333";
const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const draftId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const previousId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const passportId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const productUpdatedAt = new Date("2026-09-02T08:00:00.000Z");
const draftUpdatedAt = new Date("2026-09-02T08:01:00.000Z");
const publishedAt = new Date("2026-09-02T09:00:00.000Z");

const context: AuthenticatedUserContext = {
  userId, organizationId, membershipId, membershipRole: "ADMIN", membershipStatus: "ACTIVE",
  permissions: ["PRODUCT_READ", PRODUCT_PUBLISH], correlationId: "publish-correlation",
};
const command: PublishProductCommand = {
  productId,
  expectedDraftVersionId: draftId,
  expectedProductUpdatedAt: productUpdatedAt.toISOString(),
  expectedDraftUpdatedAt: draftUpdatedAt.toISOString(),
  expectedCurrentPublishedVersionId: null,
};

type Tx = symbol;

function fixture(overrides: Partial<{
  product: Awaited<ReturnType<PublishProductPersistence<Tx>["readProductForPublication"]>>;
  draft: Awaited<ReturnType<PublishProductPersistence<Tx>["readVersion"]>>;
  previous: Awaited<ReturnType<PublishProductPersistence<Tx>["readVersion"]>>;
  readiness: Awaited<ReturnType<PublishProductPersistence<Tx>["readReadiness"]>>;
  passport: Awaited<ReturnType<PublishProductPersistence<Tx>["readPassport"]>>;
  eligibility: Awaited<ReturnType<PublishProductPersistence<Tx>["readEligibility"]>>;
  mutationResult: Awaited<ReturnType<PublishProductPersistence<Tx>["applyPublication"]>>;
}> = {}) {
  const tx = Symbol("transaction");
  const calls: Array<{ name: string; input?: unknown }> = [];
  let committed = false;
  const product = overrides.product === undefined ? {
    productId, organizationId, lifecycleStatus: "ACTIVE" as const, publicCode: "ABCDEFGHIJKLMNOPQRSTUV",
    currentDraftVersionId: draftId, currentPublishedVersionId: null, updatedAt: productUpdatedAt,
  } : overrides.product;
  const draft = overrides.draft === undefined ? {
    productVersionId: draftId, productId, organizationId, status: "DRAFT" as const, sourceLocale: "hr",
    versionNumber: null, updatedAt: draftUpdatedAt, publishedAt: null, publishedById: null,
    supersededAt: null, discardedAt: null, reviewReadyAt: null,
  } : overrides.draft;
  const persistence: PublishProductPersistence<Tx> = {
    async readEligibility(received, input) { assert.strictEqual(received, tx); calls.push({ name: "eligibility", input }); return overrides.eligibility === undefined ? { organizationStatus: "ACTIVE", membershipStatus: "ACTIVE", membershipRole: "ADMIN" } : overrides.eligibility; },
    async readProductForPublication(received, input) { assert.strictEqual(received, tx); calls.push({ name: "product", input }); return product; },
    async readVersion(received, input) { assert.strictEqual(received, tx); calls.push({ name: "version", input }); return input.productVersionId === draftId ? draft : (overrides.previous ?? null); },
    async readReadiness(received, input) { assert.strictEqual(received, tx); calls.push({ name: "readiness", input }); return overrides.readiness ?? { sourceTranslationExists: true, sourceProductName: "Chair", unavailablePublicAsset: false, invalidAuthoredAggregate: false }; },
    async readPassport(received, input) { assert.strictEqual(received, tx); calls.push({ name: "passport", input }); return overrides.passport ?? null; },
    async nextVersionNumber(received, input) { assert.strictEqual(received, tx); calls.push({ name: "number", input }); return overrides.previous === undefined ? 1 : 2; },
    async applyPublication(received, input) { assert.strictEqual(received, tx); calls.push({ name: "apply", input }); return overrides.mutationResult ?? "APPLIED"; },
  };
  return {
    calls,
    committed: () => committed,
    publish: createPublishProductService({
      transactionRunner: { async run(work) { calls.push({ name: "transaction:start" }); const result = await work(tx); committed = true; calls.push({ name: "transaction:commit" }); return result; } },
      persistence,
      now: () => publishedAt,
      generateQrCode: () => "QR_CODE_00000001",
      canonicalOrigin: "https://passvero.eu",
    }),
  };
}

function isError(error: unknown, category: ApplicationError["category"], code: string) {
  assert.ok(error instanceof ApplicationError);
  assert.equal(error.category, category);
  assert.equal(error.code, code);
  assert.doesNotMatch(error.message, /aaaaaaaa|bbbbbbbb|Prisma|constraint/i);
  return true;
}

test("publishes the server-resolved draft with one bounded atomic mutation", async () => {
  const subject = fixture();
  assert.deepEqual(await subject.publish(command, context), { productId, status: "PUBLISHED", versionNumber: 1 });
  assert.equal(subject.committed(), true);
  const apply = subject.calls.find((call) => call.name === "apply");
  assert.deepEqual(apply?.input, {
    organizationId, actorId: userId, productId, draftVersionId: draftId,
    previousPublishedVersionId: null, expectedProductUpdatedAt: productUpdatedAt,
    expectedDraftUpdatedAt: draftUpdatedAt, expectedCurrentPublishedVersionId: null,
    versionNumber: 1, publishedAt, sourceLocale: "hr", passport: null,
    qrCode: "QR_CODE_00000001", qrTargetUrl: "https://passvero.eu/p/ABCDEFGHIJKLMNOPQRSTUV",
    correlationId: "publish-correlation",
  });
});

test("publishes READY_FOR_REVIEW and reuses active Passport and QR during republication", async () => {
  const previous = { productVersionId: previousId, productId, organizationId, status: "PUBLISHED" as const, sourceLocale: "hr", versionNumber: 1, updatedAt: new Date(), publishedAt: new Date(), publishedById: userId, supersededAt: null, discardedAt: null, reviewReadyAt: null };
  const passport = { passportId, organizationId, productId, status: "ACTIVE" as const, qrCode: { qrCodeId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", code: "QR_CODE_EXISTING", targetUrl: "https://passvero.eu/p/ABCDEFGHIJKLMNOPQRSTUV", status: "ACTIVE" as const } };
  const actual = fixture({
    product: { productId, organizationId, lifecycleStatus: "ACTIVE", publicCode: "ABCDEFGHIJKLMNOPQRSTUV", currentDraftVersionId: draftId, currentPublishedVersionId: previousId, updatedAt: productUpdatedAt },
    draft: { productVersionId: draftId, productId, organizationId, status: "READY_FOR_REVIEW", sourceLocale: "hr", versionNumber: null, updatedAt: draftUpdatedAt, publishedAt: null, publishedById: null, supersededAt: null, discardedAt: null, reviewReadyAt: new Date("2026-09-02T08:30:00Z") },
    previous, passport,
  });
  assert.deepEqual(await actual.publish({ ...command, expectedCurrentPublishedVersionId: previousId }, context), { productId, status: "PUBLISHED", versionNumber: 2 });
  const input = actual.calls.find((call) => call.name === "apply")?.input as { passport: unknown; qrCode: unknown; previousPublishedVersionId: string };
  assert.equal(input.previousPublishedVersionId, previousId);
  assert.deepEqual(input.passport, passport);
  assert.equal(input.qrCode, null);
});

test("returns NO_CHANGE for an exact authorized replay without readiness or mutation", async () => {
  const subject = fixture({ product: { productId, organizationId, lifecycleStatus: "ACTIVE", publicCode: "ABCDEFGHIJKLMNOPQRSTUV", currentDraftVersionId: null, currentPublishedVersionId: draftId, updatedAt: new Date("2026-09-02T09:00:00Z") }, draft: { productVersionId: draftId, productId, organizationId, status: "PUBLISHED", sourceLocale: "hr", versionNumber: 1, updatedAt: publishedAt, publishedAt, publishedById: userId, supersededAt: null, discardedAt: null, reviewReadyAt: null }, passport: { passportId, organizationId, productId, status: "ACTIVE", qrCode: { qrCodeId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", code: "QR_CODE_EXISTING", targetUrl: "https://passvero.eu/p/ABCDEFGHIJKLMNOPQRSTUV", status: "PENDING" } } });
  assert.deepEqual(await subject.publish(command, context), { productId, status: "NO_CHANGE", versionNumber: 1 });
  assert.deepEqual(subject.calls.map((call) => call.name), ["transaction:start", "eligibility", "product", "version", "passport", "transaction:commit"]);
});

test("returns NO_CHANGE for an exact republication replay only when the prior pointer was superseded", async () => {
  const published = { productVersionId: draftId, productId, organizationId, status: "PUBLISHED" as const, sourceLocale: "hr", versionNumber: 2, updatedAt: publishedAt, publishedAt, publishedById: userId, supersededAt: null, discardedAt: null, reviewReadyAt: null };
  const previous = { productVersionId: previousId, productId, organizationId, status: "SUPERSEDED" as const, sourceLocale: "hr", versionNumber: 1, updatedAt: publishedAt, publishedAt: new Date("2026-09-01T09:00:00.000Z"), publishedById: userId, supersededAt: publishedAt, discardedAt: null, reviewReadyAt: null };
  const passport = { passportId, organizationId, productId, status: "ACTIVE" as const, qrCode: { qrCodeId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", code: "QR_CODE_EXISTING", targetUrl: "https://passvero.eu/p/ABCDEFGHIJKLMNOPQRSTUV", status: "ACTIVE" as const } };
  const subject = fixture({ product: { productId, organizationId, lifecycleStatus: "ACTIVE", publicCode: "ABCDEFGHIJKLMNOPQRSTUV", currentDraftVersionId: null, currentPublishedVersionId: draftId, updatedAt: publishedAt }, draft: published, previous, passport });
  assert.deepEqual(await subject.publish({ ...command, expectedCurrentPublishedVersionId: previousId }, context), { productId, status: "NO_CHANGE", versionNumber: 2 });
  assert.equal(subject.calls.some((call) => call.name === "apply" || call.name === "readiness" || call.name === "number"), false);
});

test("maps every changed aggregate evidence to STALE_WRITE", async () => {
  for (const changed of [
    { product: { productId, organizationId, lifecycleStatus: "ACTIVE" as const, publicCode: "ABCDEFGHIJKLMNOPQRSTUV", currentDraftVersionId: previousId, currentPublishedVersionId: null, updatedAt: productUpdatedAt } },
    { product: { productId, organizationId, lifecycleStatus: "ACTIVE" as const, publicCode: "ABCDEFGHIJKLMNOPQRSTUV", currentDraftVersionId: draftId, currentPublishedVersionId: previousId, updatedAt: productUpdatedAt } },
    { product: { productId, organizationId, lifecycleStatus: "ACTIVE" as const, publicCode: "ABCDEFGHIJKLMNOPQRSTUV", currentDraftVersionId: draftId, currentPublishedVersionId: null, updatedAt: new Date() } },
    { draft: { productVersionId: draftId, productId, organizationId, status: "DRAFT" as const, sourceLocale: "hr", versionNumber: null, updatedAt: new Date(), publishedAt: null, publishedById: null, supersededAt: null, discardedAt: null, reviewReadyAt: null } },
  ]) {
    const subject = fixture(changed);
    await assert.rejects(subject.publish(command, context), (error) => isError(error, "CONFLICT", "PUBLISH_PRODUCT_STALE_WRITE"));
    assert.equal(subject.calls.some((call) => call.name === "apply"), false);
  }
});

test("requires source translation product name and available public assets", async () => {
  for (const [readiness, code] of [
    [{ sourceTranslationExists: false, sourceProductName: null, unavailablePublicAsset: false, invalidAuthoredAggregate: false }, "PUBLISH_PRODUCT_NOT_READY_SOURCE_TRANSLATION"],
    [{ sourceTranslationExists: true, sourceProductName: "   ", unavailablePublicAsset: false, invalidAuthoredAggregate: false }, "PUBLISH_PRODUCT_NOT_READY_PRODUCT_NAME"],
    [{ sourceTranslationExists: true, sourceProductName: " Chair ", unavailablePublicAsset: false, invalidAuthoredAggregate: false }, "PUBLISH_PRODUCT_NOT_READY_PRODUCT_NAME"],
    [{ sourceTranslationExists: true, sourceProductName: "Chair", unavailablePublicAsset: true, invalidAuthoredAggregate: false }, "PUBLISH_PRODUCT_NOT_READY_PUBLIC_ASSET"],
  ] as const) {
    const subject = fixture({ readiness });
    await assert.rejects(subject.publish(command, context), (error) => isError(error, "INVALID_STATE", code));
  }
});

test("rejects invalid stored authored invariants and malformed public identity", async () => {
  const invalidAggregate = fixture({ readiness: { sourceTranslationExists: true, sourceProductName: "Chair", unavailablePublicAsset: false, invalidAuthoredAggregate: true } as unknown as Awaited<ReturnType<PublishProductPersistence<Tx>["readReadiness"]>> });
  await assert.rejects(invalidAggregate.publish(command, context), (error) => isError(error, "INVALID_STATE", "PUBLISH_PRODUCT_INVALID_STATE"));

  const invalidPublicCode = fixture({ product: { productId, organizationId, lifecycleStatus: "ACTIVE", publicCode: "not valid", currentDraftVersionId: draftId, currentPublishedVersionId: null, updatedAt: productUpdatedAt } });
  await assert.rejects(invalidPublicCode.publish(command, context), (error) => isError(error, "INVALID_STATE", "PUBLISH_PRODUCT_INVALID_STATE"));
});

test("does not classify unrelated current draft or incomplete publication state as replay", async () => {
  const published = { productVersionId: draftId, productId, organizationId, status: "PUBLISHED" as const, sourceLocale: "hr", versionNumber: 1, updatedAt: publishedAt, publishedAt, publishedById: userId, supersededAt: null, discardedAt: null, reviewReadyAt: null };
  const newDraft = fixture({ product: { productId, organizationId, lifecycleStatus: "ACTIVE", publicCode: "ABCDEFGHIJKLMNOPQRSTUV", currentDraftVersionId: previousId, currentPublishedVersionId: draftId, updatedAt: publishedAt }, draft: published });
  await assert.rejects(newDraft.publish(command, context), (error) => isError(error, "CONFLICT", "PUBLISH_PRODUCT_STALE_WRITE"));

  const missingPassport = fixture({ product: { productId, organizationId, lifecycleStatus: "ACTIVE", publicCode: "ABCDEFGHIJKLMNOPQRSTUV", currentDraftVersionId: null, currentPublishedVersionId: draftId, updatedAt: publishedAt }, draft: published, passport: null });
  await assert.rejects(missingPassport.publish(command, context), (error) => isError(error, "INVALID_STATE", "PUBLISH_PRODUCT_INVALID_STATE"));
});

test("returns safe source-state outcomes for missing foreign and terminal versions", async () => {
  await assert.rejects(fixture({ product: null }).publish(command, context), (error) => isError(error, "NOT_FOUND", "PUBLISH_PRODUCT_NOT_FOUND"));
  await assert.rejects(fixture({ product: { productId, organizationId, lifecycleStatus: "ACTIVE", publicCode: "ABCDEFGHIJKLMNOPQRSTUV", currentDraftVersionId: null, currentPublishedVersionId: null, updatedAt: productUpdatedAt } }).publish(command, context), (error) => isError(error, "CONFLICT", "PUBLISH_PRODUCT_STALE_WRITE"));
  for (const status of ["PUBLISHED", "SUPERSEDED", "DISCARDED"] as const) {
    const terminal = fixture({ draft: { productVersionId: draftId, productId, organizationId, status, sourceLocale: "hr", versionNumber: status === "PUBLISHED" ? 1 : null, updatedAt: draftUpdatedAt, publishedAt: status === "PUBLISHED" ? publishedAt : null, publishedById: status === "PUBLISHED" ? userId : null, supersededAt: status === "SUPERSEDED" ? publishedAt : null, discardedAt: status === "DISCARDED" ? publishedAt : null, reviewReadyAt: null } });
    await assert.rejects(terminal.publish(command, context), (error) => isError(error, "INVALID_STATE", "PUBLISH_PRODUCT_INVALID_STATE"));
  }
});

test("denies unauthorized or transactionally ineligible actors", async () => {
  const unauthenticated = fixture();
  await assert.rejects(unauthenticated.publish(command, null), (error) => isError(error, "UNAUTHENTICATED", "PUBLISH_PRODUCT_UNAUTHENTICATED"));
  assert.deepEqual(unauthenticated.calls, []);
  const inactiveContext = fixture();
  await assert.rejects(inactiveContext.publish(command, { ...context, membershipStatus: "SUSPENDED" }), (error) => isError(error, "FORBIDDEN", "PUBLISH_PRODUCT_FORBIDDEN"));
  assert.deepEqual(inactiveContext.calls, []);
  const forbidden = fixture();
  await assert.rejects(forbidden.publish(command, { ...context, permissions: ["PRODUCT_READ"] }), (error) => isError(error, "FORBIDDEN", "PUBLISH_PRODUCT_FORBIDDEN"));
  assert.deepEqual(forbidden.calls, []);
  for (const eligibility of [null, { organizationStatus: "SUSPENDED" as const, membershipStatus: "ACTIVE" as const, membershipRole: "ADMIN" as const }, { organizationStatus: "ACTIVE" as const, membershipStatus: "SUSPENDED" as const, membershipRole: "ADMIN" as const }, { organizationStatus: "ACTIVE" as const, membershipStatus: "ACTIVE" as const, membershipRole: "EDITOR" as const }]) {
    const subject = fixture({ eligibility });
    await assert.rejects(subject.publish(command, context), (error) => isError(error, "FORBIDDEN", "PUBLISH_PRODUCT_FORBIDDEN"));
    assert.equal(subject.committed(), false);
  }
});

test("rejects inactive products invalid source state and inactive existing Passport", async () => {
  for (const options of [
    { product: { productId, organizationId, lifecycleStatus: "ARCHIVED" as const, publicCode: "ABCDEFGHIJKLMNOPQRSTUV", currentDraftVersionId: draftId, currentPublishedVersionId: null, updatedAt: productUpdatedAt } },
    { draft: { productVersionId: draftId, productId, organizationId, status: "DISCARDED" as const, sourceLocale: "hr", versionNumber: null, updatedAt: draftUpdatedAt, publishedAt: null, publishedById: null, supersededAt: null, discardedAt: new Date(), reviewReadyAt: null } },
    { passport: { passportId, organizationId, productId, status: "WITHDRAWN" as const, qrCode: null } },
  ]) {
    const subject = fixture(options);
    await assert.rejects(subject.publish(command, context), (error) => isError(error, "INVALID_STATE", "PUBLISH_PRODUCT_INVALID_STATE"));
  }
});

test("requires first-publication Passport absence and republication Passport plus QR presence", async () => {
  const unexpectedFirstPassport = fixture({ passport: { passportId, organizationId, productId, status: "ACTIVE", qrCode: null } });
  await assert.rejects(unexpectedFirstPassport.publish(command, context), (error) => isError(error, "INVALID_STATE", "PUBLISH_PRODUCT_INVALID_STATE"));

  const previous = { productVersionId: previousId, productId, organizationId, status: "PUBLISHED" as const, sourceLocale: "hr", versionNumber: 1, updatedAt: publishedAt, publishedAt, publishedById: userId, supersededAt: null, discardedAt: null, reviewReadyAt: null };
  const republishProduct = { productId, organizationId, lifecycleStatus: "ACTIVE" as const, publicCode: "ABCDEFGHIJKLMNOPQRSTUV", currentDraftVersionId: draftId, currentPublishedVersionId: previousId, updatedAt: productUpdatedAt };
  for (const passport of [null, { passportId, organizationId, productId, status: "ACTIVE" as const, qrCode: null }]) {
    const subject = fixture({ product: republishProduct, previous, passport });
    await assert.rejects(subject.publish({ ...command, expectedCurrentPublishedVersionId: previousId }, context), (error) => isError(error, "INVALID_STATE", "PUBLISH_PRODUCT_INVALID_STATE"));
    assert.equal(subject.calls.some((call) => call.name === "apply"), false);
  }
});

test("turns a failed conditional mutation into STALE_WRITE without commit", async () => {
  const subject = fixture({ mutationResult: "STALE" });
  await assert.rejects(subject.publish(command, context), (error) => isError(error, "CONFLICT", "PUBLISH_PRODUCT_STALE_WRITE"));
  assert.equal(subject.committed(), false);
  assert.equal(subject.calls.filter((call) => call.name === "product").length, 1);
  assert.equal(subject.calls.filter((call) => call.name === "apply").length, 1);
});
