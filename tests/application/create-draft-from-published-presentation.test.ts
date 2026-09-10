import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CreateDraftFromPublishedAction, type CreateDraftLabels } from "../../src/components/application/products/create-draft-from-published-action";
for (const locale of ["hr", "en", "de", "sr", "sl", "pl"]) test(`${locale} exposes localized creation and temporary image limitation labels`, () => {
  const messages = JSON.parse(readFileSync(new URL(`../../messages/${locale}.json`, import.meta.url), "utf8")) as { CreateDraftFromPublished: CreateDraftLabels };
  const labels = messages.CreateDraftFromPublished;
  for (const value of Object.values(labels)) assert.ok(typeof value === "string" && value.trim().length > 0);
  assert.equal(Object.keys(labels).length, 8);
  assert.ok(labels.imagesUnsupported.length > 50);
  const html = renderToStaticMarkup(createElement(CreateDraftFromPublishedAction, { data: { productId: "internal-product", expectedCurrentPublishedVersionId: "internal-version", expectedProductUpdatedAt: "2026-09-10T12:00:00.000Z" }, labels }));
  assert.ok(html.includes(labels.edit)); assert.doesNotMatch(html, /internal-product|internal-version|disabled=|undefined/);
});
