import assert from "node:assert/strict";
import test from "node:test";

import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { ApplicationError } from "../../src/application/errors/application-error";
import { createGetProductDetailService } from "../../src/application/products/get-product-detail/get-product-detail";
import type {
  GetProductDetailPersistence,
  ProductDetailRecord,
  ProductDetailVersionRecord,
} from "../../src/application/products/get-product-detail/ports";

const organizationId = "11111111-1111-4111-8111-111111111111";
const foreignOrganizationId = "99999999-9999-4999-8999-999999999999";
const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const draftId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const publishedId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const context: AuthenticatedUserContext = {
  userId: "22222222-2222-4222-8222-222222222222",
  organizationId,
  membershipId: "33333333-3333-4333-8333-333333333333",
  membershipRole: "VIEWER",
  membershipStatus: "ACTIVE",
  permissions: ["PRODUCT_READ"],
  correlationId: "product-detail-correlation",
};

function version(
  kind: "draft" | "published",
  overrides: Partial<ProductDetailVersionRecord> = {},
): ProductDetailVersionRecord {
  const isDraft = kind === "draft";
  const id = isDraft ? draftId : publishedId;
  const sourceLocale = isDraft ? "hr" : "en";
  return {
    productVersionId: id,
    productId,
    organizationId,
    status: isDraft ? "DRAFT" : "PUBLISHED",
    sourceLocale,
    versionNumber: isDraft ? null : 1,
    createdAt: new Date(isDraft
      ? "2026-08-30T10:00:00.000Z"
      : "2026-08-20T10:00:00.000Z"),
    updatedAt: new Date(isDraft
      ? "2026-08-30T11:00:00.000Z"
      : "2026-08-20T12:00:00.000Z"),
    publishedAt: isDraft ? null : new Date("2026-08-20T12:00:00.000Z"),
    translations: [{
      productVersionId: id,
      locale: sourceLocale,
      productName: isDraft ? "Industrijska stolica" : "Industrial chair",
    }],
    ...overrides,
  };
}

function record(overrides: Partial<ProductDetailRecord> = {}): ProductDetailRecord {
  return {
    organizationId,
    productId,
    internalName: "Industrial chair",
    sku: "CHAIR-1",
    publicCode: "AbCdEfGhIjKlMnOpQrStUv",
    lifecycleStatus: "ACTIVE",
    currentDraftVersionId: draftId,
    currentPublishedVersionId: publishedId,
    currentDraftVersion: version("draft"),
    currentPublishedVersion: version("published"),
    createdAt: new Date("2026-08-20T09:00:00.000Z"),
    updatedAt: new Date("2026-08-30T11:00:00.000Z"),
    ...overrides,
  };
}

function harness(result: ProductDetailRecord | null = record()) {
  const calls: Parameters<GetProductDetailPersistence["findByIdAndOrganization"]>[0][] = [];
  const persistence: GetProductDetailPersistence = {
    async findByIdAndOrganization(input) {
      calls.push(input);
      return result;
    },
  };
  return {
    calls,
    getProductDetail: createGetProductDetailService({ persistence }),
  };
}

function assertApplicationError(
  error: unknown,
  category: ApplicationError["category"],
  code: string,
  correlationId: string | null = context.correlationId,
): boolean {
  assert.ok(error instanceof ApplicationError);
  assert.equal(error.category, category);
  assert.equal(error.code, code);
  assert.equal(error.retryable, false);
  assert.equal(error.correlationId, correlationId ?? undefined);
  assert.doesNotMatch(error.message, new RegExp(`${productId}|${foreignOrganizationId}`));
  return true;
}

test("returns only the authorized product projection from trusted tenant context", async () => {
  const fixture = harness();

  const result = await fixture.getProductDetail({ productId }, context);

  assert.deepEqual(fixture.calls, [{ productId, organizationId }]);
  assert.deepEqual(result, {
    productId,
    internalName: "Industrial chair",
    organizationSku: "CHAIR-1",
    publicCode: "AbCdEfGhIjKlMnOpQrStUv",
    lifecycleStatus: "ACTIVE",
    currentDraft: {
      productVersionId: draftId,
      status: "DRAFT",
      sourceLocale: "hr",
      sourceProductName: "Industrijska stolica",
      createdAt: new Date("2026-08-30T10:00:00.000Z"),
      updatedAt: new Date("2026-08-30T11:00:00.000Z"),
    },
    currentPublished: {
      productVersionId: publishedId,
      status: "PUBLISHED",
      sourceLocale: "en",
      sourceProductName: "Industrial chair",
      versionNumber: 1,
      publishedAt: new Date("2026-08-20T12:00:00.000Z"),
    },
    createdAt: new Date("2026-08-20T09:00:00.000Z"),
    updatedAt: new Date("2026-08-30T11:00:00.000Z"),
  });
  for (const forbidden of [
    "organizationId",
    "createdById",
    "updatedById",
    "membershipId",
    "storageKey",
    "translations",
  ]) {
    assert.equal(forbidden in result, false, forbidden);
  }
});

test("denies unauthenticated, inactive, and missing PRODUCT_READ contexts before persistence", async () => {
  const fixture = harness();

  await assert.rejects(
    fixture.getProductDetail({ productId }, null),
    (error) => assertApplicationError(
      error,
      "UNAUTHENTICATED",
      "GET_PRODUCT_DETAIL_UNAUTHENTICATED",
      null,
    ),
  );
  await assert.rejects(
    fixture.getProductDetail({ productId }, { ...context, membershipStatus: "SUSPENDED" }),
    (error) => assertApplicationError(error, "FORBIDDEN", "GET_PRODUCT_DETAIL_FORBIDDEN"),
  );
  await assert.rejects(
    fixture.getProductDetail({ productId }, { ...context, permissions: [] }),
    (error) => assertApplicationError(error, "FORBIDDEN", "GET_PRODUCT_DETAIL_FORBIDDEN"),
  );
  assert.equal(fixture.calls.length, 0);
});

test("rejects malformed product IDs before persistence without accepting tenant authority", async () => {
  const fixture = harness();

  for (const malformed of ["", "not-a-uuid", productId.toUpperCase(), `${productId}?organizationId=${foreignOrganizationId}`]) {
    await assert.rejects(
      fixture.getProductDetail({ productId: malformed }, context),
      (error) => assertApplicationError(error, "VALIDATION", "GET_PRODUCT_DETAIL_ID_INVALID"),
    );
  }
  assert.equal(fixture.calls.length, 0);
});

test("same-tenant missing and cross-tenant products return the identical safe NOT_FOUND", async () => {
  const missing = harness(null);
  const crossTenant = harness(null);

  const outcomes = await Promise.all([
    missing.getProductDetail({ productId }, context).catch((error: unknown) => error),
    crossTenant.getProductDetail({ productId }, context).catch((error: unknown) => error),
  ]);

  for (const outcome of outcomes) {
    assertApplicationError(outcome, "NOT_FOUND", "GET_PRODUCT_DETAIL_NOT_FOUND");
  }
  assert.deepEqual(
    outcomes.map((error) => error instanceof ApplicationError
      ? [error.category, error.code, error.message, error.retryable]
      : null),
    [
      ["NOT_FOUND", "GET_PRODUCT_DETAIL_NOT_FOUND", "The requested product was not found.", false],
      ["NOT_FOUND", "GET_PRODUCT_DETAIL_NOT_FOUND", "The requested product was not found.", false],
    ],
  );
});

test("uses only pointer-selected versions and renders null pointers safely", async () => {
  const fixture = harness(record({
    currentDraftVersionId: null,
    currentPublishedVersionId: null,
    currentDraftVersion: null,
    currentPublishedVersion: null,
  }));

  const result = await fixture.getProductDetail({ productId }, context);

  assert.equal(result.currentDraft, null);
  assert.equal(result.currentPublished, null);
});

test("accepts READY_FOR_REVIEW only through the current draft pointer", async () => {
  const fixture = harness(record({
    currentPublishedVersionId: null,
    currentPublishedVersion: null,
    currentDraftVersion: version("draft", { status: "READY_FOR_REVIEW" }),
  }));

  const result = await fixture.getProductDetail({ productId }, context);

  assert.equal(result.currentDraft?.productVersionId, draftId);
  assert.equal(result.currentDraft?.status, "READY_FOR_REVIEW");
});

for (const [name, overrides] of [
  ["draft pointer ID mismatch", {
    currentDraftVersion: version("draft", { productVersionId: publishedId }),
  }],
  ["draft product mismatch", {
    currentDraftVersion: version("draft", { productId: publishedId }),
  }],
  ["draft organization mismatch", {
    currentDraftVersion: version("draft", { organizationId: foreignOrganizationId }),
  }],
  ["invalid draft status", {
    currentDraftVersion: version("draft", { status: "PUBLISHED" }),
  }],
  ["published pointer ID mismatch", {
    currentPublishedVersion: version("published", { productVersionId: draftId }),
  }],
  ["published product mismatch", {
    currentPublishedVersion: version("published", { productId: draftId }),
  }],
  ["published organization mismatch", {
    currentPublishedVersion: version("published", { organizationId: foreignOrganizationId }),
  }],
  ["invalid published status", {
    currentPublishedVersion: version("published", { status: "SUPERSEDED" }),
  }],
] satisfies ReadonlyArray<readonly [string, Partial<ProductDetailRecord>]>) {
  test(`fails closed on ${name}`, async () => {
    const fixture = harness(record(overrides));

    await assert.rejects(
      fixture.getProductDetail({ productId }, context),
      (error) => assertApplicationError(error, "INTERNAL", "GET_PRODUCT_DETAIL_INTERNAL"),
    );
  });
}

test("selects the exact source-locale translation for each pointed version", async () => {
  const fixture = harness(record({
    currentDraftVersion: version("draft", {
      translations: [
        { productVersionId: draftId, locale: "en", productName: "Chair" },
        { productVersionId: draftId, locale: "hr", productName: "Izvorna stolica" },
      ],
    }),
  }));

  const result = await fixture.getProductDetail({ productId }, context);

  assert.equal(result.currentDraft?.sourceLocale, "hr");
  assert.equal(result.currentDraft?.sourceProductName, "Izvorna stolica");
});

test("fails closed when the source translation is missing or belongs to another version", async () => {
  for (const translations of [
    [{ productVersionId: draftId, locale: "en", productName: "Chair" }],
    [{ productVersionId: publishedId, locale: "hr", productName: "Foreign" }],
  ]) {
    const fixture = harness(record({
      currentDraftVersion: version("draft", { translations }),
    }));

    await assert.rejects(
      fixture.getProductDetail({ productId }, context),
      (error) => assertApplicationError(error, "INTERNAL", "GET_PRODUCT_DETAIL_INTERNAL"),
    );
  }
});

test("maps persistence failures to one safe internal error", async () => {
  const persistence: GetProductDetailPersistence = {
    async findByIdAndOrganization() {
      throw new Error(`database failure for ${productId}`);
    },
  };
  const getProductDetail = createGetProductDetailService({ persistence });

  await assert.rejects(
    getProductDetail({ productId }, context),
    (error) => assertApplicationError(error, "INTERNAL", "GET_PRODUCT_DETAIL_INTERNAL"),
  );
});
