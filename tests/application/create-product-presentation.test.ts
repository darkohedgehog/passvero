import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";

import { CreateProductForm } from "../../src/components/application/products/create-product-form";
import { ProductListCreateAction } from "../../src/components/application/products/product-list-create-action";
import { getPathname } from "../../src/i18n/navigation";

const labels = {
  productName: "Product name",
  sku: "Organization SKU",
  skuOptional: "Optional",
  initialLocale: "Product language",
  create: "Create product",
  creating: "Creating product",
  cancel: "Cancel",
  required: "This field is required.",
  invalidName: "Enter a valid product name.",
  invalidSku: "Enter a valid SKU.",
  invalidLocale: "Choose a valid product language.",
  skuConflict: "This SKU is already used in your organization.",
  forbidden: "You do not have permission to create products.",
  failure: "The product could not be created. Try again.",
};

test("renders only the three canonical labeled form fields with accessible pending status", () => {
  const html = renderToStaticMarkup(createElement(CreateProductForm, {
    initialLocale: "en",
    locales: ["hr", "sr", "en", "de", "sl", "pl"],
    localeLabels: {
      hr: "Croatian",
      sr: "Serbian",
      en: "English",
      de: "German",
      sl: "Slovenian",
      pl: "Polish",
    },
    successHref: "/en/dashboard/products",
    cancelHref: "/en/dashboard/products",
    labels,
  }));

  assert.match(html, /<form/);
  assert.match(html, /name="initialProductName"/);
  assert.match(html, /name="organizationSku"/);
  assert.match(html, /name="initialLocale"/);
  assert.match(html, /autoComplete="off"/);
  assert.match(html, /aria-live="assertive"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /href="\/en\/dashboard\/products"/);
  assert.match(html, /<option value="en" selected=""/);
  assert.doesNotMatch(
    html,
    /name="(?:organizationId|membershipId|userId|permissions|role|providerSubject|providerSessionId)"/,
  );
});

test("renders the product-list create action only for an authorized server projection", () => {
  assert.match(
    renderToStaticMarkup(createElement(ProductListCreateAction, {
      href: "/en/dashboard/products/new",
      label: "Create product",
    })),
    /href="\/en\/dashboard\/products\/new"[^>]*>Create product<\/a>/,
  );
  assert.equal(
    renderToStaticMarkup(createElement(ProductListCreateAction, {
      href: null,
      label: "Create product",
    })),
    "",
  );
});

test("inherits the canonical locale-prefix policy for create and cancel destinations", () => {
  const expectations = {
    hr: ["/dashboard/products/new", "/dashboard/products"],
    sr: ["/sr/dashboard/products/new", "/sr/dashboard/products"],
    en: ["/en/dashboard/products/new", "/en/dashboard/products"],
    de: ["/de/dashboard/products/new", "/de/dashboard/products"],
    sl: ["/sl/dashboard/products/new", "/sl/dashboard/products"],
    pl: ["/pl/dashboard/products/new", "/pl/dashboard/products"],
  } as const;
  for (const [locale, [createHref, cancelHref]] of Object.entries(expectations)) {
    assert.equal(getPathname({ locale: locale as keyof typeof expectations, href: "/dashboard/products/new" }), createHref);
    assert.equal(getPathname({ locale: locale as keyof typeof expectations, href: "/dashboard/products" }), cancelHref);
  }
});

test("all six locales expose one complete CreateProduct message contract", () => {
  const root = new URL("../../", import.meta.url);
  const locales = ["hr", "sr", "en", "de", "sl", "pl"] as const;
  const namespaces = locales.map((locale) => {
    const messages = JSON.parse(readFileSync(new URL(`messages/${locale}.json`, root), "utf8")) as {
      CreateProduct?: Record<string, unknown>;
    };
    return messages.CreateProduct;
  });
  assert.ok(namespaces[0]);
  const keys = flattenKeys(namespaces[0]);
  assert.ok(keys.length >= 25);
  for (const [index, locale] of locales.entries()) {
    assert.deepEqual(flattenKeys(namespaces[index]), keys, locale);
  }
});

function flattenKeys(value: unknown, prefix = ""): readonly string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix.length === 0 ? key : `${prefix}.${key}`;
    return typeof child === "object" && child !== null && !Array.isArray(child)
      ? flattenKeys(child, path)
      : [path];
  }).sort();
}
