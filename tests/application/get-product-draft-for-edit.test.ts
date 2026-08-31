import assert from "node:assert/strict";
import test from "node:test";

import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { ApplicationError } from "../../src/application/errors/application-error";
import { PRODUCT_EDIT } from "../../src/application/permissions/product-permissions";
import { createGetProductDraftForEditService } from "../../src/application/products/edit-product-draft/get-product-draft-for-edit";
import type {
  GetProductDraftForEditPersistence,
  ProductDraftEditRecord,
} from "../../src/application/products/edit-product-draft/ports";

const organizationId = "11111111-1111-4111-8111-111111111111";
const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const draftId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const productUpdatedAt = new Date("2026-08-31T10:00:00.000Z");
const draftUpdatedAt = new Date("2026-08-31T10:01:00.000Z");
const translationUpdatedAt = new Date("2026-08-31T10:02:00.000Z");

const context: AuthenticatedUserContext = {
  userId: "22222222-2222-4222-8222-222222222222",
  organizationId,
  membershipId: "33333333-3333-4333-8333-333333333333",
  membershipRole: "EDITOR",
  membershipStatus: "ACTIVE",
  permissions: ["PRODUCT_READ", PRODUCT_EDIT],
  correlationId: "edit-loader-correlation",
};

function record(overrides: Partial<ProductDraftEditRecord> = {}): ProductDraftEditRecord {
  return {
    productId,
    organizationId,
    internalName: "Industrial chair",
    sku: "CHAIR-1",
    normalizedSku: "CHAIR-1",
    lifecycleStatus: "ACTIVE",
    currentDraftVersionId: draftId,
    updatedAt: productUpdatedAt,
    currentDraftVersion: {
      productVersionId: draftId,
      productId,
      organizationId,
      status: "DRAFT",
      sourceLocale: "hr",
      updatedAt: draftUpdatedAt,
      sourceTranslation: {
        productVersionId: draftId,
        locale: "hr",
        productName: "Industrial chair",
        updatedAt: translationUpdatedAt,
      },
    },
    ...overrides,
  };
}

function harness(result: ProductDraftEditRecord | null = record()) {
  const calls: unknown[] = [];
  const persistence: GetProductDraftForEditPersistence = {
    async findByIdAndOrganization(input) {
      calls.push(input);
      return result;
    },
  };
  return {
    calls,
    load: createGetProductDraftForEditService({ persistence }),
  };
}

function matchesError(error: unknown, category: ApplicationError["category"], code: string) {
  assert.ok(error instanceof ApplicationError);
  assert.equal(error.category, category);
  assert.equal(error.code, code);
  assert.equal(error.retryable, false);
  assert.doesNotMatch(error.message, new RegExp(`${productId}|${organizationId}|${draftId}`));
  return true;
}

test("returns only the narrow current-draft edit projection from trusted tenant context", async () => {
  const fixture = harness();

  const result = await fixture.load({ productId }, context);

  assert.deepEqual(fixture.calls, [{ productId, organizationId }]);
  assert.deepEqual(result, {
    productId,
    productName: "Industrial chair",
    organizationSku: "CHAIR-1",
    sourceLocale: "hr",
    expectedDraftVersionId: draftId,
    expectedProductUpdatedAt: productUpdatedAt,
    expectedDraftUpdatedAt: draftUpdatedAt,
    expectedSourceTranslationUpdatedAt: translationUpdatedAt,
  });
  for (const forbidden of [
    "organizationId", "userId", "membershipId", "permissions", "currentPublishedVersionId",
  ]) {
    assert.equal(forbidden in result, false, forbidden);
  }
});

test("denies unauthenticated inactive and missing PRODUCT_EDIT contexts before persistence", async () => {
  const fixture = harness();
  for (const receivedContext of [
    null,
    { ...context, membershipStatus: "SUSPENDED" as const },
    { ...context, permissions: ["PRODUCT_READ"] as const },
  ]) {
    await assert.rejects(
      fixture.load({ productId }, receivedContext),
      (error) => matchesError(
        error,
        receivedContext === null ? "UNAUTHENTICATED" : "FORBIDDEN",
        receivedContext === null
          ? "GET_PRODUCT_DRAFT_FOR_EDIT_UNAUTHENTICATED"
          : "GET_PRODUCT_DRAFT_FOR_EDIT_FORBIDDEN",
      ),
    );
  }
  assert.equal(fixture.calls.length, 0);
});

test("rejects malformed IDs and preserves identical missing and cross-tenant NOT_FOUND", async () => {
  const malformed = harness();
  await assert.rejects(
    malformed.load({ productId: "not-a-uuid" }, context),
    (error) => matchesError(error, "VALIDATION", "GET_PRODUCT_DRAFT_FOR_EDIT_ID_INVALID"),
  );
  assert.equal(malformed.calls.length, 0);

  for (const fixture of [harness(null), harness(null)]) {
    await assert.rejects(
      fixture.load({ productId }, context),
      (error) => matchesError(error, "NOT_FOUND", "GET_PRODUCT_DRAFT_FOR_EDIT_NOT_FOUND"),
    );
  }
});

test("accepts DRAFT and READY_FOR_REVIEW but denies inactive products and non-editable draft states", async () => {
  for (const status of ["DRAFT", "READY_FOR_REVIEW"] as const) {
    const fixture = harness(record({
      currentDraftVersion: { ...record().currentDraftVersion!, status },
    }));
    assert.equal((await fixture.load({ productId }, context)).expectedDraftVersionId, draftId);
  }

  for (const result of [
    record({ lifecycleStatus: "ARCHIVED" }),
    record({ currentDraftVersionId: null, currentDraftVersion: null }),
    record({ currentDraftVersion: { ...record().currentDraftVersion!, status: "PUBLISHED" } }),
    record({ currentDraftVersion: { ...record().currentDraftVersion!, status: "SUPERSEDED" } }),
    record({ currentDraftVersion: { ...record().currentDraftVersion!, status: "DISCARDED" } }),
  ]) {
    await assert.rejects(
      harness(result).load({ productId }, context),
      (error) => matchesError(error, "INVALID_STATE", "GET_PRODUCT_DRAFT_FOR_EDIT_NOT_EDITABLE"),
    );
  }
});

test("fails closed on pointer ownership and exact source-translation invariants", async () => {
  const foreignOrganizationId = "99999999-9999-4999-8999-999999999999";
  for (const result of [
    record({ currentDraftVersion: { ...record().currentDraftVersion!, productVersionId: productId } }),
    record({ currentDraftVersion: { ...record().currentDraftVersion!, productId: draftId } }),
    record({ currentDraftVersion: { ...record().currentDraftVersion!, organizationId: foreignOrganizationId } }),
    record({ currentDraftVersion: null }),
    record({ currentDraftVersion: { ...record().currentDraftVersion!, sourceTranslation: null } }),
    record({ currentDraftVersion: {
      ...record().currentDraftVersion!,
      sourceTranslation: { ...record().currentDraftVersion!.sourceTranslation!, locale: "en" },
    } }),
  ]) {
    await assert.rejects(
      harness(result).load({ productId }, context),
      (error) => matchesError(error, "INTERNAL", "GET_PRODUCT_DRAFT_FOR_EDIT_INVARIANT_FAILURE"),
    );
  }
});
