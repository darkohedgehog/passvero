import assert from "node:assert/strict";
import test from "node:test";

import { ApplicationError } from "../../src/application/errors/application-error";
import {
  normalizeCreateProductCommand,
  type NormalizedCreateProductCommand,
} from "../../src/application/products/create-product/normalize-command";
import type { CreateProductCommand } from "../../src/application/products/create-product/contracts";
import {
  PASSVERO_LOCALES,
  isPassveroLocale,
} from "../../src/domain/values/passvero-locale";

const correlationId = "corr-create-product-normalization";

function normalize(
  command: Partial<CreateProductCommand> = {},
): NormalizedCreateProductCommand {
  return normalizeCreateProductCommand(
    {
      initialLocale: "hr",
      initialProductName: "Product",
      ...command,
    },
    correlationId,
  );
}

function isValidationError(error: unknown): error is ApplicationError {
  return (
    error instanceof ApplicationError &&
    error.category === "VALIDATION" &&
    error.correlationId === correlationId
  );
}

function assertValidationError(
  callback: () => unknown,
  code:
    | "CREATE_PRODUCT_NAME_INVALID"
    | "CREATE_PRODUCT_LOCALE_INVALID"
    | "CREATE_PRODUCT_SKU_INVALID",
) {
  assert.throws(callback, (error: unknown) => {
    if (!isValidationError(error)) {
      return false;
    }

    assert.equal(error.code, code);
    assert.equal(error.retryable, false);
    return true;
  });
}

test("exports the six Passvero locales in routing order", () => {
  assert.deepEqual(PASSVERO_LOCALES, ["hr", "sr", "en", "de", "sl", "pl"]);

  for (const locale of PASSVERO_LOCALES) {
    assert.equal(isPassveroLocale(locale), true);
  }

  assert.equal(isPassveroLocale("fr"), false);
});

test("accepts every supported locale and trims it before returning sourceLocale", () => {
  for (const locale of PASSVERO_LOCALES) {
    assert.equal(normalize({ initialLocale: ` ${locale} ` }).sourceLocale, locale);
  }
});

test("rejects an unsupported locale", () => {
  assertValidationError(
    () => normalize({ initialLocale: "fr" }),
    "CREATE_PRODUCT_LOCALE_INVALID",
  );
});

test("accepts Product-name boundaries and preserves case", () => {
  assert.equal(
    normalize({ initialProductName: " A ", organizationSku: undefined }).productName,
    "A",
  );
  assert.equal(normalize({ initialProductName: "X".repeat(200) }).productName.length, 200);
  assert.equal(normalize({ initialProductName: "PassVero" }).productName, "PassVero");
});

test("rejects invalid Product-name lengths", () => {
  for (const value of ["", "   ", "X".repeat(201)]) {
    assertValidationError(
      () => normalize({ initialProductName: value }),
      "CREATE_PRODUCT_NAME_INVALID",
    );
  }
});

test("counts astral Product-name characters as Unicode code points", () => {
  assert.equal(
    normalize({ initialProductName: "😀".repeat(200) }).productName,
    "😀".repeat(200),
  );
  assertValidationError(
    () => normalize({ initialProductName: "😀".repeat(201) }),
    "CREATE_PRODUCT_NAME_INVALID",
  );
});

test("normalizes optional SKU at exact boundaries", () => {
  assert.equal(normalize({ organizationSku: undefined }).sku, null);
  assert.equal(normalize({ organizationSku: "   " }).sku, null);
  assert.equal(normalize({ organizationSku: " A " }).sku, "A");
  assert.equal(normalize({ organizationSku: "X".repeat(128) }).sku?.length, 128);
  assertValidationError(
    () => normalize({ organizationSku: "X".repeat(129) }),
    "CREATE_PRODUCT_SKU_INVALID",
  );
});

test("counts astral SKU characters as Unicode code points", () => {
  assert.equal(
    normalize({ organizationSku: "😀".repeat(128) }).sku,
    "😀".repeat(128),
  );
  assertValidationError(
    () => normalize({ organizationSku: "😀".repeat(129) }),
    "CREATE_PRODUCT_SKU_INVALID",
  );
});

test("returns the exact normalized command shape without changing case", () => {
  assert.deepEqual(
    normalize({
      initialLocale: " en ",
      initialProductName: " PassVero Pro ",
      organizationSku: " Sku-Ö1 ",
    }),
    {
      sourceLocale: "en",
      productName: "PassVero Pro",
      internalName: "PassVero Pro",
      sku: "Sku-Ö1",
      normalizedSku: "Sku-Ö1",
    },
  );
});
