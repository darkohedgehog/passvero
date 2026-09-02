import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";

import { PublishProductSection, type PublishProductLabels } from "../../src/components/application/products/publish-product-section";

const labels: PublishProductLabels = { title: "Publish product", publish: "Publish", confirm: "Publish this product?", publishing: "Publishing…", success: "Product published.", noChange: "This version is already published.", staleWrite: "Product changed. Reload it.", notReady: "Complete the required product information before publishing.", sourceTranslation: "Add a valid source translation.", productName: "Add a valid product name.", publicAsset: "Make every public asset available.", invalidState: "This product cannot be published.", forbidden: "You cannot publish this product.", failure: "The product could not be published.", reload: "Reload product" };
const data = { productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", expectedDraftVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", expectedProductUpdatedAt: "2026-09-02T08:00:00.000Z", expectedDraftUpdatedAt: "2026-09-02T08:01:00.000Z", expectedCurrentPublishedVersionId: null } as const;

test("renders one bounded publish control without exposing evidence", () => {
  const html = renderToStaticMarkup(createElement(PublishProductSection, { data, labels }));
  assert.match(html, /<button[^>]*>Publish<\/button>/);
  assert.match(html, /aria-busy="false"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /tabindex="-1"/);
  assert.match(html, /Publish product/);
  assert.doesNotMatch(html, /bbbbbbbb|expectedDraft|organizationId|versionNumber|QR|public DPP/i);
});

test("all six locales provide the publication message contract", () => {
  const root = new URL("../../", import.meta.url);
  for (const locale of ["hr", "sr", "en", "de", "sl", "pl"]) {
    const namespace = (JSON.parse(readFileSync(new URL(`messages/${locale}.json`, root), "utf8")) as { PublishProduct?: Record<string, unknown> }).PublishProduct;
    assert.deepEqual(Object.keys(namespace ?? {}).sort(), Object.keys(labels).sort(), locale);
  }
});
