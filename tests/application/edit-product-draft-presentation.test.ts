import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";

import { EditProductDraftForm } from "../../src/components/application/products/edit-product-draft-form";
import { getPathname } from "../../src/i18n/navigation";

const labels = {
  productName: "Product name",
  organizationSku: "Organization SKU",
  optional: "optional",
  sourceLocale: "Source language",
  save: "Save changes",
  saving: "Saving…",
  cancel: "Cancel",
  reload: "Reload product",
  required: "This field is required.",
  invalidName: "Enter a valid product name.",
  invalidSku: "Enter a valid SKU.",
  skuConflict: "This SKU is already used in your organization.",
  staleWrite: "The product changed. Reload it before editing again.",
  draftNotEditable: "The current draft cannot be edited.",
  forbidden: "You do not have permission to edit this product.",
  failure: "The product could not be updated. Try again.",
};

test("renders exactly two editable fields and source locale as read-only context", () => {
  const html = renderToStaticMarkup(createElement(EditProductDraftForm, {
    productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    initialProductName: "Industrial chair",
    initialOrganizationSku: "CHAIR-1",
    sourceLocale: "hr",
    expectedDraftVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    expectedProductUpdatedAt: "2026-08-31T10:00:00.000Z",
    expectedDraftUpdatedAt: "2026-08-31T10:01:00.000Z",
    expectedSourceTranslationUpdatedAt: "2026-08-31T10:02:00.000Z",
    detailHref: "/en/dashboard/products/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    labels,
  }));

  assert.match(html, /<form/);
  assert.match(html, /name="productName"/);
  assert.match(html, /name="organizationSku"/);
  assert.equal((html.match(/<input/g) ?? []).length, 2);
  assert.match(html, /Source language/);
  assert.match(html, />HR</);
  assert.doesNotMatch(html, /name="sourceLocale"|<select/);
  assert.match(html, /aria-live="assertive"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /href="\/en\/dashboard\/products\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"/);
  assert.doesNotMatch(
    html,
    /name="(?:organizationId|membershipId|userId|role|permissions|draftVersionId|translationId|publishedVersionId|status|publicCode)"/,
  );
});

test("inherits all six locale-prefix routes for edit detail and deterministic cancel", () => {
  const expectations = {
    hr: [
      "/dashboard/products/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/edit",
      "/dashboard/products/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ],
    en: [
      "/en/dashboard/products/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/edit",
      "/en/dashboard/products/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ],
    de: [
      "/de/dashboard/products/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/edit",
      "/de/dashboard/products/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ],
    sr: [
      "/sr/dashboard/products/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/edit",
      "/sr/dashboard/products/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ],
    sl: [
      "/sl/dashboard/products/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/edit",
      "/sl/dashboard/products/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ],
    pl: [
      "/pl/dashboard/products/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/edit",
      "/pl/dashboard/products/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ],
  } as const;
  for (const [locale, [editHref, detailHref]] of Object.entries(expectations)) {
    assert.equal(getPathname({
      locale: locale as keyof typeof expectations,
      href: `/dashboard/products/${"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}/edit`,
    }), editHref);
    assert.equal(getPathname({
      locale: locale as keyof typeof expectations,
      href: `/dashboard/products/${"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}`,
    }), detailHref);
  }
});

test("all six locales expose one complete EditProduct message contract", () => {
  const root = new URL("../../", import.meta.url);
  const locales = ["hr", "sr", "en", "de", "sl", "pl"] as const;
  const namespaces = locales.map((locale) => {
    const messages = JSON.parse(readFileSync(new URL(`messages/${locale}.json`, root), "utf8")) as {
      EditProduct?: Record<string, unknown>;
    };
    return messages.EditProduct;
  });
  assert.ok(namespaces[0]);
  const keys = flattenKeys(namespaces[0]);
  assert.deepEqual(keys, [
    "cancel", "description", "draftNotEditable", "failure", "failureTitle", "forbidden",
    "forbiddenTitle", "invalidName", "invalidSku", "metadataDescription", "metadataTitle",
    "optional", "organizationSku", "productName", "reload", "required", "save", "saving",
    "skuConflict", "sourceLocale", "staleWrite", "title",
  ].sort());
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
