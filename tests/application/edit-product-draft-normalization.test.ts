import assert from "node:assert/strict";
import test from "node:test";

import { ApplicationError } from "../../src/application/errors/application-error";
import { normalizeEditProductDraftCommand } from "../../src/application/products/edit-product-draft/normalize-command";

const concurrency = {
  expectedDraftVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  expectedProductUpdatedAt: "2026-08-31T10:00:00.000Z",
  expectedDraftUpdatedAt: "2026-08-31T10:01:00.000Z",
  expectedSourceTranslationUpdatedAt: "2026-08-31T10:02:00.000Z",
};

test("normalizes the one product name and organization SKU with CreateProduct semantics", () => {
  assert.deepEqual(normalizeEditProductDraftCommand({
    productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    productName: "  Industrijska stolica  ",
    organizationSku: "  Chair-X  ",
    ...concurrency,
  }, "correlation-1"), {
    productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    productName: "Industrijska stolica",
    sku: "Chair-X",
    normalizedSku: "Chair-X",
    expectedDraftVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    expectedProductUpdatedAt: new Date("2026-08-31T10:00:00.000Z"),
    expectedDraftUpdatedAt: new Date("2026-08-31T10:01:00.000Z"),
    expectedSourceTranslationUpdatedAt: new Date("2026-08-31T10:02:00.000Z"),
  });
});

test("maps blank and null organization SKU to null without case folding", () => {
  for (const organizationSku of ["  ", null, undefined]) {
    const result = normalizeEditProductDraftCommand({
      productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      productName: "Product",
      organizationSku,
      ...concurrency,
    }, "correlation-1");
    assert.equal(result.sku, null);
    assert.equal(result.normalizedSku, null);
  }
});

test("rejects invalid names, SKUs, IDs, and non-canonical concurrency timestamps safely", () => {
  const cases = [
    [{ productName: " " }, "EDIT_PRODUCT_DRAFT_NAME_INVALID"],
    [{ productName: "x".repeat(201) }, "EDIT_PRODUCT_DRAFT_NAME_INVALID"],
    [{ organizationSku: "x".repeat(129) }, "EDIT_PRODUCT_DRAFT_SKU_INVALID"],
    [{ productId: "not-a-uuid" }, "EDIT_PRODUCT_DRAFT_ID_INVALID"],
    [{ expectedDraftVersionId: "not-a-uuid" }, "EDIT_PRODUCT_DRAFT_CONCURRENCY_INVALID"],
    [{ expectedProductUpdatedAt: "2026-08-31" }, "EDIT_PRODUCT_DRAFT_CONCURRENCY_INVALID"],
    [{ expectedDraftUpdatedAt: "invalid" }, "EDIT_PRODUCT_DRAFT_CONCURRENCY_INVALID"],
    [{ expectedSourceTranslationUpdatedAt: "2026-08-31T10:02:00Z" }, "EDIT_PRODUCT_DRAFT_CONCURRENCY_INVALID"],
  ] as const;

  for (const [override, code] of cases) {
    assert.throws(
      () => normalizeEditProductDraftCommand({
        productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        productName: "Product",
        organizationSku: "SKU-1",
        ...concurrency,
        ...override,
      }, "correlation-1"),
      (error: unknown) => {
        assert.ok(error instanceof ApplicationError);
        assert.equal(error.category, "VALIDATION");
        assert.equal(error.code, code);
        assert.equal(error.correlationId, "correlation-1");
        return true;
      },
    );
  }
});
