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

import type { GetPublicDppResult } from "../../src/application/public-dpp/contracts";

const emptyContent = { shortDescription: null, description: null, technicalDescription: null, repairInstructions: null, sparePartsInformation: null, recyclingInstructions: null, disposalInstructions: null, packagingInformation: null, safetyInformation: null, warrantyInformation: null, publicNotes: null };

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
    cnRows: [],
    materials: [],
    translations: [{
      ...emptyContent,
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

function harness(result: ProductDetailRecord | null = record(), publicResult: GetPublicDppResult = { kind: "NOT_FOUND" }) {
  const calls: Parameters<GetProductDetailPersistence["findByIdAndOrganization"]>[0][] = [];
  const persistence: GetProductDetailPersistence = {
    async findByIdAndOrganization(input) {
      calls.push(input);
      return result;
    },
  };
  return {
    calls,
    getProductDetail: createGetProductDetailService({ persistence, canonicalOrigin: "https://catalog.example", getPublicDpp: async () => publicResult }),
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
    publicationState: "CHANGES_IN_DRAFT",
    publicAvailability: { status: "NOT_PUBLIC" },
    currentDraft: {
      productVersionId: draftId,
      status: "DRAFT",
      kind: "CURRENT_DRAFT",
      content: { ...emptyContent, productName: "Industrijska stolica" },
      cn: null, materials: [],
      sourceLocale: "hr",
      sourceProductName: "Industrijska stolica",
      createdAt: new Date("2026-08-30T10:00:00.000Z"),
      updatedAt: new Date("2026-08-30T11:00:00.000Z"),
    },
    currentPublished: {
      productVersionId: publishedId,
      status: "PUBLISHED",
      kind: "CURRENT_PUBLISHED",
      content: { ...emptyContent, productName: "Industrial chair" },
      cn: null, materials: [],
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
        { ...emptyContent, productVersionId: draftId, locale: "en", productName: "Chair" },
        { ...emptyContent, productVersionId: draftId, locale: "hr", productName: "Izvorna stolica" },
      ],
    }),
  }));

  const result = await fixture.getProductDetail({ productId }, context);

  assert.equal(result.currentDraft?.sourceLocale, "hr");
  assert.equal(result.currentDraft?.sourceProductName, "Izvorna stolica");
});

test("fails closed when the source translation is missing or belongs to another version", async () => {
  for (const translations of [
    [{ ...emptyContent, productVersionId: draftId, locale: "en", productName: "Chair" }],
    [{ ...emptyContent, productVersionId: publishedId, locale: "hr", productName: "Foreign" }],
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
  const getProductDetail = createGetProductDetailService({ persistence, canonicalOrigin: "https://catalog.example", getPublicDpp: async () => ({ kind: "NOT_FOUND" }) });

  await assert.rejects(
    getProductDetail({ productId }, context),
    (error) => assertApplicationError(error, "INTERNAL", "GET_PRODUCT_DETAIL_INTERNAL"),
  );
});

function authoredVersion(kind: "draft" | "published"): ProductDetailVersionRecord {
  const base = version(kind);
  return { ...base,
    translations: [{ ...base.translations[0], description: `${kind} content`, publicNotes: `${kind} note` }],
    cnRows: [{ productVersionId: base.productVersionId, value: kind === "draft" ? "01012100" : "01012900", nomenclatureYear: 2026 }],
    materials: [{ productVersionId: base.productVersionId, materialName: `${kind} wood`, category: null, percentage: "100.00", isRecycled: false, recycledPercentage: null }],
  };
}

function publicResult(): GetPublicDppResult {
  return { kind: "PUBLIC", dpp: {
    locale: "en", availableLocales: ["en"], passport: { status: "ACTIVE", firstPublishedAt: "2026-08-20T12:00:00.000Z" },
    organization: { displayName: "Company" }, version: { number: 1, publishedAt: "2026-08-20T12:00:00.000Z" },
    content: { ...emptyContent, productName: "Industrial chair" }, materials: [], cn: null,
  } };
}

test("published-only detail keeps published content CN and materials without a draft", async () => {
  const result = await harness(record({ currentDraftVersionId: null, currentDraftVersion: null, currentPublishedVersion: authoredVersion("published") }), publicResult()).getProductDetail({ productId }, context);
  assert.equal(result.currentDraft, null);
  assert.equal(result.publicationState, "PUBLISHED");
  assert.equal(result.currentPublished?.content.description, "published content");
  assert.equal(result.currentPublished?.content.publicNotes, "published note");
  assert.deepEqual(result.currentPublished?.cn, { code: "01012900", nomenclatureYear: 2026 });
  assert.deepEqual(result.currentPublished?.materials, [{ materialName: "published wood", category: null, percentage: "100.00", isRecycled: false, recycledPercentage: null }]);
  assert.deepEqual(result.publicAvailability, { status: "PUBLIC", url: "https://catalog.example/p/AbCdEfGhIjKlMnOpQrStUv" });
});

test("both pointer snapshots stay separate while a Viewer reads private draft content", async () => {
  const result = await harness(record({ currentDraftVersion: authoredVersion("draft"), currentPublishedVersion: authoredVersion("published") }), publicResult()).getProductDetail({ productId }, context);
  assert.equal(result.publicationState, "CHANGES_IN_DRAFT");
  assert.equal(result.currentDraft?.kind, "CURRENT_DRAFT");
  assert.equal(result.currentPublished?.kind, "CURRENT_PUBLISHED");
  assert.equal(result.currentDraft?.content.description, "draft content");
  assert.equal(result.currentPublished?.content.description, "published content");
  assert.equal(result.currentDraft?.cn?.code, "01012100");
  assert.equal(result.currentPublished?.cn?.code, "01012900");
  assert.equal(result.currentDraft?.materials[0].materialName, "draft wood");
  assert.equal(result.currentPublished?.materials[0].materialName, "published wood");
});

test("never-published draft displays private snapshot and no public action", async () => {
  const result = await harness(record({ currentDraftVersion: authoredVersion("draft"), currentPublishedVersionId: null, currentPublishedVersion: null })).getProductDetail({ productId }, context);
  assert.equal(result.publicationState, "DRAFT");
  assert.equal(result.currentDraft?.content.description, "draft content");
  assert.equal(result.currentDraft?.cn?.code, "01012100");
  assert.equal(result.currentDraft?.materials[0].materialName, "draft wood");
  assert.deepEqual(result.publicAvailability, { status: "NOT_PUBLIC" });
});

for (const [kind, status] of [["NOT_FOUND", "NOT_PUBLIC"], ["WITHDRAWN", "WITHDRAWN"]] as const) {
  test(`${kind} eligibility never returns a public-content URL`, async () => {
    const result = await harness(record(), kind === "WITHDRAWN" ? { kind, publicMessage: "private to public service" } : { kind }).getProductDetail({ productId }, context);
    assert.deepEqual(result.publicAvailability, { status });
    assert.doesNotMatch(JSON.stringify(result), /private to public service/);
  });
}

test("archived detail retains snapshots without claiming public availability", async () => {
  const result = await harness(record({ lifecycleStatus: "ARCHIVED" })).getProductDetail({ productId }, context);
  assert.equal(result.lifecycleStatus, "ARCHIVED");
  assert.equal(result.currentPublished?.versionNumber, 1);
  assert.deepEqual(result.publicAvailability, { status: "NOT_PUBLIC" });
});

for (const [name, published] of [
  ["foreign CN", { ...authoredVersion("published"), cnRows: [{ productVersionId: draftId, value: "01012900", nomenclatureYear: 2026 }] }],
  ["foreign material", { ...authoredVersion("published"), materials: [{ productVersionId: draftId, materialName: "Foreign", category: null, percentage: null, isRecycled: false, recycledPercentage: null }] }],
  ["missing version number", version("published", { versionNumber: null })],
  ["missing publication time", version("published", { publishedAt: null })],
  ["unsupported source locale", version("published", { sourceLocale: "fr" })],
  ["duplicate CN", { ...authoredVersion("published"), cnRows: [...authoredVersion("published").cnRows, ...authoredVersion("published").cnRows] }],
] satisfies ReadonlyArray<readonly [string, ProductDetailVersionRecord]>) {
  test(`rejects ${name} instead of exposing a mixed or invalid snapshot`, async () => {
    await assert.rejects(harness(record({ currentPublishedVersion: published })).getProductDetail({ productId }, context), (error) => assertApplicationError(error, "INTERNAL", "GET_PRODUCT_DETAIL_INTERNAL"));
  });
}

test("public-read failure and publication changes fail safely rather than generating an enabled link", async () => {
  const changed = publicResult();
  assert.equal(changed.kind, "PUBLIC");
  if (changed.kind !== "PUBLIC") return;
  for (const result of [{ kind: "TEMPORARILY_UNAVAILABLE" } as const, { ...changed, dpp: { ...changed.dpp, version: { ...changed.dpp.version, number: 2 } } }]) {
    await assert.rejects(harness(record(), result).getProductDetail({ productId }, context), (error) => assertApplicationError(error, "INTERNAL", "GET_PRODUCT_DETAIL_INTERNAL"));
  }
});

test("canonical origin and public code are validated before returning a public action", async () => {
  for (const canonicalOrigin of ["http://catalog.example", "https://catalog.example/evil", "https://catalog.example?x=1"]) {
    const service = createGetProductDetailService({ persistence: { findByIdAndOrganization: async () => record() }, canonicalOrigin, getPublicDpp: async () => publicResult() });
    await assert.rejects(service({ productId }, context), (error) => assertApplicationError(error, "INTERNAL", "GET_PRODUCT_DETAIL_INTERNAL"));
  }
  await assert.rejects(harness(record({ publicCode: "../../evil" }), publicResult()).getProductDetail({ productId }, context), (error) => assertApplicationError(error, "INTERNAL", "GET_PRODUCT_DETAIL_INTERNAL"));
});
