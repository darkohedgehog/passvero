import assert from "node:assert/strict";
import test from "node:test";

import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { ApplicationError } from "../../src/application/errors/application-error";
import { PRODUCT_EDIT } from "../../src/application/permissions/product-permissions";
import type { EditProductDraftCommand } from "../../src/application/products/edit-product-draft/contracts";
import { createEditProductDraftService } from "../../src/application/products/edit-product-draft/edit-product-draft";
import {
  EditProductDraftPersistenceError,
  type EditProductDraftPersistence,
  type ProductDraftEditSourceTranslationRecord,
  type ProductDraftEditVersionRecord,
} from "../../src/application/products/edit-product-draft/ports";

const organizationId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const membershipId = "33333333-3333-4333-8333-333333333333";
const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const draftId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const productUpdatedAt = new Date("2026-08-31T10:00:00.000Z");
const draftUpdatedAt = new Date("2026-08-31T10:01:00.000Z");
const translationUpdatedAt = new Date("2026-08-31T10:02:00.000Z");

const context: AuthenticatedUserContext = {
  userId,
  organizationId,
  membershipId,
  membershipRole: "EDITOR",
  membershipStatus: "ACTIVE",
  permissions: ["PRODUCT_READ", PRODUCT_EDIT],
  correlationId: "edit-correlation",
};

const command: EditProductDraftCommand = {
  productId,
  productName: "  Updated chair  ",
  organizationSku: "  Chair-X  ",
  expectedDraftVersionId: draftId,
  expectedProductUpdatedAt: productUpdatedAt.toISOString(),
  expectedDraftUpdatedAt: draftUpdatedAt.toISOString(),
  expectedSourceTranslationUpdatedAt: translationUpdatedAt.toISOString(),
};

const productRecord = {
  productId,
  organizationId,
  internalName: "Industrial chair",
  sku: "CHAIR-1",
  normalizedSku: "CHAIR-1",
  lifecycleStatus: "ACTIVE" as const,
  currentDraftVersionId: draftId,
  updatedAt: productUpdatedAt,
};

const draftRecord: Omit<ProductDraftEditVersionRecord, "sourceTranslation"> = {
  productVersionId: draftId,
  productId,
  organizationId,
  status: "DRAFT",
  sourceLocale: "hr",
  updatedAt: draftUpdatedAt,
};

const translationRecord: ProductDraftEditSourceTranslationRecord = {
  productVersionId: draftId,
  locale: "hr",
  productName: "Industrial chair",
  updatedAt: translationUpdatedAt,
};

interface FixtureOptions {
  readonly eligibility?: Awaited<ReturnType<EditProductDraftPersistence<symbol>["readEligibility"]>>;
  readonly product?: Awaited<ReturnType<EditProductDraftPersistence<symbol>["readProduct"]>>;
  readonly draft?: Awaited<ReturnType<EditProductDraftPersistence<symbol>["readDraftVersion"]>>;
  readonly translation?: Awaited<ReturnType<EditProductDraftPersistence<symbol>["readSourceTranslation"]>>;
  readonly productUpdated?: boolean;
  readonly draftUpdated?: boolean;
  readonly translationUpdated?: boolean;
  readonly operationError?: unknown;
}

function fixture(options: FixtureOptions = {}) {
  const transaction = Symbol("transaction");
  const calls: Array<{ readonly name: string; readonly input?: unknown }> = [];
  let committed = false;
  const persistence: EditProductDraftPersistence<typeof transaction> = {
    async readEligibility(received, input) {
      assert.strictEqual(received, transaction);
      calls.push({ name: "eligibility", input });
      return options.eligibility === undefined
        ? { organizationStatus: "ACTIVE", membershipStatus: "ACTIVE", membershipRole: "EDITOR" }
        : options.eligibility;
    },
    async readProduct(received, input) {
      assert.strictEqual(received, transaction);
      calls.push({ name: "product:read", input });
      return options.product === undefined ? productRecord : options.product;
    },
    async readDraftVersion(received, input) {
      assert.strictEqual(received, transaction);
      calls.push({ name: "draft:read", input });
      return options.draft === undefined ? draftRecord : options.draft;
    },
    async readSourceTranslation(received, input) {
      assert.strictEqual(received, transaction);
      calls.push({ name: "translation:read", input });
      return options.translation === undefined ? translationRecord : options.translation;
    },
    async updateProductIfCurrent(received, input) {
      assert.strictEqual(received, transaction);
      calls.push({ name: "product:update", input });
      if (options.operationError !== undefined) throw options.operationError;
      return options.productUpdated ?? true;
    },
    async touchDraftVersionIfCurrent(received, input) {
      assert.strictEqual(received, transaction);
      calls.push({ name: "draft:update", input });
      return options.draftUpdated ?? true;
    },
    async updateSourceTranslationIfCurrent(received, input) {
      assert.strictEqual(received, transaction);
      calls.push({ name: "translation:update", input });
      return options.translationUpdated ?? true;
    },
    async insertProductUpdatedAuditEvent(received, input) {
      assert.strictEqual(received, transaction);
      calls.push({ name: "audit", input });
    },
  };
  return {
    calls,
    committed: () => committed,
    edit: createEditProductDraftService({
      transactionRunner: {
        async run(work) {
          calls.push({ name: "transaction:start" });
          const result = await work(transaction);
          committed = true;
          calls.push({ name: "transaction:commit" });
          return result;
        },
      },
      persistence,
    }),
  };
}

function matchesError(
  error: unknown,
  category: ApplicationError["category"],
  code: string,
  correlationId: string | null = context.correlationId,
) {
  assert.ok(error instanceof ApplicationError);
  assert.equal(error.category, category);
  assert.equal(error.code, code);
  assert.equal(error.retryable, false);
  assert.equal(error.correlationId, correlationId ?? undefined);
  assert.doesNotMatch(error.message, new RegExp(`${productId}|${organizationId}|${draftId}|Chair-X`));
  return true;
}

test("atomically synchronizes both names and updates Product-owned SKU with one safe audit", async () => {
  const subject = fixture();

  assert.deepEqual(await subject.edit(command, context), { productId, status: "UPDATED" });
  assert.equal(subject.committed(), true);
  assert.deepEqual(subject.calls, [
    { name: "transaction:start" },
    { name: "eligibility", input: { organizationId, userId, membershipId } },
    { name: "product:read", input: { productId, organizationId } },
    { name: "draft:read", input: { productVersionId: draftId, productId, organizationId } },
    { name: "translation:read", input: { productVersionId: draftId, locale: "hr" } },
    { name: "product:update", input: {
      productId,
      organizationId,
      currentDraftVersionId: draftId,
      expectedUpdatedAt: productUpdatedAt,
      internalName: "Updated chair",
      sku: "Chair-X",
      normalizedSku: "Chair-X",
      actorId: userId,
    } },
    { name: "draft:update", input: {
      productVersionId: draftId,
      productId,
      organizationId,
      expectedUpdatedAt: draftUpdatedAt,
      actorId: userId,
    } },
    { name: "translation:update", input: {
      productVersionId: draftId,
      locale: "hr",
      expectedUpdatedAt: translationUpdatedAt,
      productName: "Updated chair",
    } },
    { name: "audit", input: {
      organizationId,
      actorId: userId,
      productId,
      changedFields: ["productName", "organizationSku"],
      correlationId: "edit-correlation",
    } },
    { name: "transaction:commit" },
  ]);
  assert.equal(JSON.stringify(subject.calls).includes("Industrial chair"), false);
  assert.equal(JSON.stringify(subject.calls).includes("CHAIR-1"), false);
});

test("allows READY_FOR_REVIEW without changing status", async () => {
  const subject = fixture({ draft: { ...draftRecord, status: "READY_FOR_REVIEW" } });
  assert.deepEqual(await subject.edit(command, context), { productId, status: "UPDATED" });
  const draftUpdate = subject.calls.find((call) => call.name === "draft:update");
  assert.equal(JSON.stringify(draftUpdate).includes("status"), false);
});

test("returns a validated true no-op without writes or audit", async () => {
  const subject = fixture({
    product: { ...productRecord, internalName: "Updated chair", sku: "Chair-X", normalizedSku: "Chair-X" },
    translation: { ...translationRecord, productName: "Updated chair" },
  });

  assert.deepEqual(await subject.edit(command, context), { productId, status: "NO_CHANGE" });
  assert.equal(subject.committed(), true);
  assert.deepEqual(subject.calls.map((call) => call.name), [
    "transaction:start", "eligibility", "product:read", "draft:read", "translation:read", "transaction:commit",
  ]);
});

test("denies unauthenticated and context-level missing PRODUCT_EDIT before the transaction", async () => {
  for (const [receivedContext, category, code, correlationId] of [
    [null, "UNAUTHENTICATED", "EDIT_PRODUCT_DRAFT_UNAUTHENTICATED", null],
    [{ ...context, membershipStatus: "SUSPENDED" }, "FORBIDDEN", "EDIT_PRODUCT_DRAFT_FORBIDDEN", context.correlationId],
    [{ ...context, permissions: ["PRODUCT_READ"] }, "FORBIDDEN", "EDIT_PRODUCT_DRAFT_FORBIDDEN", context.correlationId],
  ] as const) {
    const subject = fixture();
    await assert.rejects(
      subject.edit(command, receivedContext as AuthenticatedUserContext | null),
      (error) => matchesError(error, category, code, correlationId),
    );
    assert.deepEqual(subject.calls, []);
  }
});

test("revalidates active Membership Organization and PRODUCT_EDIT role inside the transaction", async () => {
  for (const eligibility of [
    null,
    { organizationStatus: "ACTIVE" as const, membershipStatus: "SUSPENDED" as const, membershipRole: "EDITOR" as const },
    { organizationStatus: "SUSPENDED" as const, membershipStatus: "ACTIVE" as const, membershipRole: "EDITOR" as const },
    { organizationStatus: "ACTIVE" as const, membershipStatus: "ACTIVE" as const, membershipRole: "VIEWER" as const },
  ]) {
    const subject = fixture({ eligibility });
    await assert.rejects(
      subject.edit(command, context),
      (error) => matchesError(error, "FORBIDDEN", "EDIT_PRODUCT_DRAFT_FORBIDDEN"),
    );
    assert.equal(subject.committed(), false);
    assert.deepEqual(subject.calls.map((call) => call.name), ["transaction:start", "eligibility"]);
  }
});

test("preserves identical tenant-safe NOT_FOUND for missing persistence results", async () => {
  for (const subject of [fixture({ product: null }), fixture({ product: null })]) {
    await assert.rejects(
      subject.edit(command, context),
      (error) => matchesError(error, "NOT_FOUND", "EDIT_PRODUCT_DRAFT_NOT_FOUND"),
    );
  }
});

test("denies inactive products no draft and every non-editable pointed status", async () => {
  for (const options of [
    { product: { ...productRecord, lifecycleStatus: "ARCHIVED" as const } },
    { product: { ...productRecord, currentDraftVersionId: null } },
    { draft: { ...draftRecord, status: "PUBLISHED" as const } },
    { draft: { ...draftRecord, status: "SUPERSEDED" as const } },
    { draft: { ...draftRecord, status: "DISCARDED" as const } },
  ]) {
    await assert.rejects(
      fixture(options).edit(command, context),
      (error) => matchesError(error, "INVALID_STATE", "EDIT_PRODUCT_DRAFT_NOT_EDITABLE"),
    );
  }
});

test("validates all four concurrency values before no-op detection", async () => {
  const noOpProduct = {
    ...productRecord,
    internalName: "Updated chair",
    sku: "Chair-X",
    normalizedSku: "Chair-X",
  };
  const noOpTranslation = { ...translationRecord, productName: "Updated chair" };
  const cases: FixtureOptions[] = [
    { product: { ...noOpProduct, currentDraftVersionId: productId }, translation: noOpTranslation },
    { product: { ...noOpProduct, updatedAt: new Date("2026-08-31T11:00:00.000Z") }, translation: noOpTranslation },
    { product: noOpProduct, draft: { ...draftRecord, updatedAt: new Date("2026-08-31T11:00:00.000Z") }, translation: noOpTranslation },
    { product: noOpProduct, translation: { ...noOpTranslation, updatedAt: new Date("2026-08-31T11:00:00.000Z") } },
  ];
  for (const options of cases) {
    const subject = fixture(options);
    await assert.rejects(
      subject.edit(command, context),
      (error) => matchesError(error, "CONFLICT", "EDIT_PRODUCT_DRAFT_STALE_WRITE"),
    );
    assert.equal(subject.calls.some((call) => call.name.endsWith(":update") || call.name === "audit"), false);
  }
});

test("fails closed on pointed draft and source translation ownership invariants", async () => {
  const foreignOrganizationId = "99999999-9999-4999-8999-999999999999";
  for (const options of [
    { draft: null },
    { draft: { ...draftRecord, productId: draftId } },
    { draft: { ...draftRecord, organizationId: foreignOrganizationId } },
    { translation: null },
    { translation: { ...translationRecord, productVersionId: productId } },
    { translation: { ...translationRecord, locale: "en" } },
  ]) {
    await assert.rejects(
      fixture(options).edit(command, context),
      (error) => matchesError(error, "INTERNAL", "EDIT_PRODUCT_DRAFT_INVARIANT_FAILURE"),
    );
  }
});

test("rolls back and returns STALE_WRITE when any conditional update loses its race", async () => {
  for (const options of [
    { productUpdated: false },
    { draftUpdated: false },
    { translationUpdated: false },
  ]) {
    const subject = fixture(options);
    await assert.rejects(
      subject.edit(command, context),
      (error) => matchesError(error, "CONFLICT", "EDIT_PRODUCT_DRAFT_STALE_WRITE"),
    );
    assert.equal(subject.committed(), false);
    assert.equal(subject.calls.some((call) => call.name === "audit"), false);
  }
});

test("maps only the organization SKU persistence conflict and hides unknown failures", async () => {
  for (const [operationError, category, code] of [
    [new EditProductDraftPersistenceError("ORGANIZATION_SKU_CONFLICT"), "CONFLICT", "EDIT_PRODUCT_DRAFT_SKU_CONFLICT"],
    [new EditProductDraftPersistenceError("UNKNOWN"), "INTERNAL", "EDIT_PRODUCT_DRAFT_OPERATIONAL_FAILURE"],
    [new Error("database detail"), "INTERNAL", "EDIT_PRODUCT_DRAFT_OPERATIONAL_FAILURE"],
  ] as const) {
    const subject = fixture({ operationError });
    await assert.rejects(
      subject.edit(command, context),
      (error) => matchesError(error, category, code),
    );
    assert.equal(subject.committed(), false);
    assert.equal(subject.calls.some((call) => call.name === "audit"), false);
  }
});
