import assert from "node:assert/strict";
import test from "node:test";

import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { ApplicationError } from "../../src/application/errors/application-error";
import type { DraftTranslationContentPersistence } from "../../src/application/products/draft-translation-content/ports";
import { createUpdateDraftTranslationContentService } from "../../src/application/products/draft-translation-content/update-draft-translation-content";
import { normalizeDraftTranslationContentCommand } from "../../src/application/products/draft-translation-content/normalize-command";

const organizationId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const membershipId = "33333333-3333-4333-8333-333333333333";
const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const draftId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const productUpdatedAt = new Date("2026-09-01T10:00:00.000Z");
const draftUpdatedAt = new Date("2026-09-01T10:01:00.000Z");
const translationUpdatedAt = new Date("2026-09-01T10:02:00.000Z");

const context: AuthenticatedUserContext = {
  userId, organizationId, membershipId, membershipRole: "EDITOR",
  membershipStatus: "ACTIVE", permissions: ["PRODUCT_READ", "PRODUCT_EDIT"],
  correlationId: "content-correlation",
};

const values = {
  shortDescription: "  Kratak opis  ", description: "Opis", technicalDescription: null,
  repairInstructions: "Popravak", sparePartsInformation: "Dijelovi",
  recyclingInstructions: "Recikliranje", disposalInstructions: "Odlaganje",
  packagingInformation: "Pakiranje", safetyInformation: "Sigurnost",
} as const;

const command = {
  productId, ...values, expectedDraftVersionId: draftId,
  expectedProductUpdatedAt: productUpdatedAt.toISOString(),
  expectedDraftUpdatedAt: draftUpdatedAt.toISOString(),
  expectedSourceTranslationUpdatedAt: translationUpdatedAt.toISOString(),
};

test("normalizes nullable plain text conservatively and counts Unicode code points", () => {
  const normalized = normalizeDraftTranslationContentCommand({
    ...command,
    technicalDescription: "   ",
    safetyInformation: `${"😀".repeat(5_000)}`,
  }, context.correlationId);
  assert.equal(normalized.shortDescription, "Kratak opis");
  assert.equal(normalized.technicalDescription, null);
  assert.equal(normalized.safetyInformation, "😀".repeat(5_000));
  assert.throws(
    () => normalizeDraftTranslationContentCommand({ ...command, safetyInformation: "😀".repeat(5_001) }, context.correlationId),
    (error) => error instanceof ApplicationError && error.category === "VALIDATION",
  );
});

test("sets and clears each authorized nullable field without changing Unicode content", () => {
  for (const field of ["shortDescription", "description", "technicalDescription", "repairInstructions", "sparePartsInformation", "recyclingInstructions", "disposalInstructions", "packagingInformation", "safetyInformation"] as const) {
    const set = normalizeDraftTranslationContentCommand({ ...command, [field]: "  Čuvaj 😀  " }, context.correlationId);
    const cleared = normalizeDraftTranslationContentCommand({ ...command, [field]: "   " }, context.correlationId);
    assert.equal(set[field], "Čuvaj 😀");
    assert.equal(cleared[field], null);
  }
});

function fixture(overrides: {
  product?: null | Record<string, unknown>;
  draft?: null | Record<string, unknown>;
  translation?: null | Record<string, unknown>;
  eligibility?: null | Record<string, unknown>;
  cas?: "product" | "draft" | "translation";
} = {}) {
  const transaction = Symbol("transaction");
  const calls: Array<{ name: string; input?: unknown }> = [];
  let committed = false;
  const product = overrides.product === undefined ? {
    productId, organizationId, lifecycleStatus: "ACTIVE" as const,
    currentDraftVersionId: draftId, updatedAt: productUpdatedAt,
  } : overrides.product;
  const draft = overrides.draft === undefined ? {
    productVersionId: draftId, productId, organizationId, status: "DRAFT" as const,
    sourceLocale: "hr", updatedAt: draftUpdatedAt,
  } : overrides.draft;
  const translation = overrides.translation === undefined ? {
    productVersionId: draftId, locale: "hr", updatedAt: translationUpdatedAt,
    shortDescription: null, description: "Stari opis", technicalDescription: null,
    repairInstructions: null, sparePartsInformation: null, recyclingInstructions: null,
    disposalInstructions: null, packagingInformation: null, safetyInformation: null,
  } : overrides.translation;
  const persistence: DraftTranslationContentPersistence<typeof transaction> = {
    async readEligibility(_tx, input) { calls.push({ name: "eligibility", input }); return overrides.eligibility === undefined ? { organizationStatus: "ACTIVE", membershipStatus: "ACTIVE", membershipRole: "EDITOR" } : overrides.eligibility as never; },
    async readProduct(_tx, input) { calls.push({ name: "product:read", input }); return product as never; },
    async readDraftVersion(_tx, input) { calls.push({ name: "draft:read", input }); return draft as never; },
    async readSourceTranslation(_tx, input) { calls.push({ name: "translation:read", input }); return translation as never; },
    async touchProductIfCurrent(_tx, input) { calls.push({ name: "product:update", input }); return overrides.cas !== "product"; },
    async touchDraftVersionIfCurrent(_tx, input) { calls.push({ name: "draft:update", input }); return overrides.cas !== "draft"; },
    async updateSourceTranslationIfCurrent(_tx, input) { calls.push({ name: "translation:update", input }); return overrides.cas !== "translation"; },
    async insertProductUpdatedAuditEvent(_tx, input) { calls.push({ name: "audit", input }); },
  };
  return {
    calls, committed: () => committed,
    update: createUpdateDraftTranslationContentService({
      transactionRunner: { async run(work) { calls.push({ name: "transaction:start" }); const result = await work(transaction); committed = true; calls.push({ name: "transaction:commit" }); return result; } },
      persistence,
    }),
  };
}

function isError(error: unknown, category: ApplicationError["category"], code: string) {
  assert.ok(error instanceof ApplicationError);
  assert.equal(error.category, category);
  assert.equal(error.code, code);
  assert.doesNotMatch(error.message, /Kratak|Opis|Sigurnost|11111111|bbbbbbbb/);
  return true;
}

test("updates only the exact source translation through one fail-closed transaction and safe audit", async () => {
  const subject = fixture();
  assert.deepEqual(await subject.update(command, context), { productId, status: "UPDATED" });
  assert.equal(subject.committed(), true);
  assert.deepEqual(subject.calls.map(({ name }) => name), [
    "transaction:start", "eligibility", "product:read", "draft:read", "translation:read",
    "product:update", "draft:update", "translation:update", "audit", "transaction:commit",
  ]);
  const productWrite = subject.calls.find(({ name }) => name === "product:update");
  assert.equal(JSON.stringify(productWrite).includes("internalName"), false);
  assert.equal(JSON.stringify(productWrite).includes("sku"), false);
  const translationWrite = subject.calls.find(({ name }) => name === "translation:update")!;
  assert.deepEqual(translationWrite.input, {
    productVersionId: draftId, locale: "hr", expectedUpdatedAt: translationUpdatedAt,
    values: { ...values, shortDescription: "Kratak opis" },
  });
  const audit = subject.calls.find(({ name }) => name === "audit")!;
  assert.deepEqual((audit.input as { changedFields: string[] }).changedFields, [
    "shortDescription", "description", "repairInstructions", "sparePartsInformation",
    "recyclingInstructions", "disposalInstructions", "packagingInformation", "safetyInformation",
  ]);
  assert.equal(JSON.stringify(audit).includes("Kratak opis"), false);
});

test("validates all concurrency evidence before a true no-op and performs no writes or audit", async () => {
  const currentValues = { ...values, shortDescription: "Kratak opis" };
  const subject = fixture({ translation: { productVersionId: draftId, locale: "hr", updatedAt: translationUpdatedAt, ...currentValues } });
  assert.deepEqual(await subject.update(command, context), { productId, status: "NO_CHANGE" });
  assert.deepEqual(subject.calls.map(({ name }) => name), ["transaction:start", "eligibility", "product:read", "draft:read", "translation:read", "transaction:commit"]);

  const stale = fixture({ translation: { productVersionId: draftId, locale: "hr", updatedAt: new Date("2026-09-01T11:00:00.000Z"), ...currentValues } });
  await assert.rejects(stale.update(command, context), (error) => isError(error, "CONFLICT", "DRAFT_TRANSLATION_CONTENT_STALE_WRITE"));
});

test("denies absent authority inactive state terminal drafts and invalid ownership safely", async () => {
  await assert.rejects(fixture().update(command, null), (error) => isError(error, "UNAUTHENTICATED", "DRAFT_TRANSLATION_CONTENT_UNAUTHENTICATED"));
  await assert.rejects(fixture().update(command, { ...context, permissions: ["PRODUCT_READ"] }), (error) => isError(error, "FORBIDDEN", "DRAFT_TRANSLATION_CONTENT_FORBIDDEN"));
  await assert.rejects(fixture({ eligibility: { organizationStatus: "ACTIVE", membershipStatus: "ACTIVE", membershipRole: "VIEWER" } }).update(command, context), (error) => isError(error, "FORBIDDEN", "DRAFT_TRANSLATION_CONTENT_FORBIDDEN"));
  await assert.rejects(fixture({ eligibility: { organizationStatus: "ACTIVE", membershipStatus: "SUSPENDED", membershipRole: "EDITOR" } }).update(command, context), (error) => isError(error, "FORBIDDEN", "DRAFT_TRANSLATION_CONTENT_FORBIDDEN"));
  await assert.rejects(fixture({ eligibility: { organizationStatus: "SUSPENDED", membershipStatus: "ACTIVE", membershipRole: "EDITOR" } }).update(command, context), (error) => isError(error, "FORBIDDEN", "DRAFT_TRANSLATION_CONTENT_FORBIDDEN"));
  await assert.rejects(fixture({ product: null }).update(command, context), (error) => isError(error, "NOT_FOUND", "DRAFT_TRANSLATION_CONTENT_NOT_FOUND"));
  await assert.rejects(fixture({ product: { productId, organizationId, lifecycleStatus: "ACTIVE", currentDraftVersionId: null, updatedAt: productUpdatedAt } }).update(command, context), (error) => isError(error, "INVALID_STATE", "DRAFT_TRANSLATION_CONTENT_NOT_EDITABLE"));
  for (const status of ["PUBLISHED", "SUPERSEDED", "DISCARDED"] as const) {
    await assert.rejects(fixture({ draft: { productVersionId: draftId, productId, organizationId, status, sourceLocale: "hr", updatedAt: draftUpdatedAt } }).update(command, context), (error) => isError(error, "INVALID_STATE", "DRAFT_TRANSLATION_CONTENT_NOT_EDITABLE"));
  }
  await assert.rejects(fixture({ translation: null }).update(command, context), (error) => isError(error, "INTERNAL", "DRAFT_TRANSLATION_CONTENT_INVARIANT_FAILURE"));
  await assert.rejects(fixture({ translation: { productVersionId: draftId, locale: "en", updatedAt: translationUpdatedAt, ...values } }).update(command, context), (error) => isError(error, "INTERNAL", "DRAFT_TRANSLATION_CONTENT_INVARIANT_FAILURE"));
  assert.deepEqual(await fixture({ draft: { productVersionId: draftId, productId, organizationId, status: "READY_FOR_REVIEW", sourceLocale: "hr", updatedAt: draftUpdatedAt } }).update(command, context), { productId, status: "UPDATED" });
});

test("maps pointer and CAS races to stale write without audit or commit", async () => {
  const pointer = fixture({ product: { productId, organizationId, lifecycleStatus: "ACTIVE", currentDraftVersionId: productId, updatedAt: productUpdatedAt } });
  await assert.rejects(pointer.update(command, context), (error) => isError(error, "CONFLICT", "DRAFT_TRANSLATION_CONTENT_STALE_WRITE"));
  await assert.rejects(fixture({ product: { productId, organizationId, lifecycleStatus: "ACTIVE", currentDraftVersionId: draftId, updatedAt: new Date("2026-09-01T12:00:00.000Z") } }).update(command, context), (error) => isError(error, "CONFLICT", "DRAFT_TRANSLATION_CONTENT_STALE_WRITE"));
  await assert.rejects(fixture({ draft: { productVersionId: draftId, productId, organizationId, status: "DRAFT", sourceLocale: "hr", updatedAt: new Date("2026-09-01T12:00:00.000Z") } }).update(command, context), (error) => isError(error, "CONFLICT", "DRAFT_TRANSLATION_CONTENT_STALE_WRITE"));
  for (const cas of ["product", "draft", "translation"] as const) {
    const subject = fixture({ cas });
    await assert.rejects(subject.update(command, context), (error) => isError(error, "CONFLICT", "DRAFT_TRANSLATION_CONTENT_STALE_WRITE"));
    assert.equal(subject.committed(), false);
    assert.equal(subject.calls.some(({ name }) => name === "audit"), false);
  }
});
