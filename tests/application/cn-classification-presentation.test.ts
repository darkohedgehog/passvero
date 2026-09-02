import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";

import { CnClassificationSection, type CnClassificationLabels } from "../../src/components/application/products/cn-classification-section";

const labels: CnClassificationLabels = {
  title: "CN classification", code: "CN code", year: "Combined Nomenclature year",
  addClassification: "Add CN classification", editClassification: "Edit CN classification", removeClassification: "Remove CN classification",
  save: "Save", add: "Add", remove: "Remove", cancel: "Cancel", saving: "Saving…", removing: "Removing…", reload: "Reload product",
  empty: "No CN classification has been added.", noDraft: "No current draft is available.",
  invalidCode: "Enter 8 digits or use DDDD DD DD.", invalidYear: "Enter a valid CN year.", conflict: "A CN classification already exists.", staleWrite: "The product changed. Reload it.",
  draftNotEditable: "The current draft cannot be edited.", forbidden: "You cannot edit this classification.", failure: "The CN classification could not be updated.",
  helper: "Record the 8-digit Combined Nomenclature code applicable to this product and the CN year used. Passvero checks the format only; it does not determine or verify the correct customs classification.",
  confirmRemove: "Remove this CN classification?",
};
const data = {
  productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  cn: { identifierId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", value: "01012100", nomenclatureYear: 2026, updatedAt: "2026-09-01T10:02:00.000Z" },
  expectedDraftVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", expectedProductUpdatedAt: "2026-09-01T10:00:00.000Z", expectedDraftUpdatedAt: "2026-09-01T10:01:00.000Z",
} as const;

test("renders one semantic current-draft CN row without mutation controls for VIEWER", () => {
  const html = renderToStaticMarkup(createElement(CnClassificationSection, { data, canEdit: false, labels, detailHref: "/en/dashboard/products/id", currentUtcYear: 2026 }));
  assert.match(html, /<section[^>]*aria-labelledby="cn-classification-heading"/);
  assert.match(html, /01012100/);
  assert.match(html, /Combined Nomenclature year/);
  assert.match(html, />2026</);
  assert.doesNotMatch(html, /<button|<form|<input|<details/);
  assert.doesNotMatch(html, /organizationId|productVersionId|issuingAuthority|notes/);
});

test("shows only Add for an empty CN and only Edit Remove for an existing CN", () => {
  const empty = renderToStaticMarkup(createElement(CnClassificationSection, { data: { ...data, cn: null }, canEdit: true, labels, detailHref: "/en/dashboard/products/id", currentUtcYear: 2026 }));
  assert.match(empty, /Add CN classification/);
  assert.doesNotMatch(empty, /Edit CN classification|Remove CN classification/);
  const existing = renderToStaticMarkup(createElement(CnClassificationSection, { data, canEdit: true, labels, detailHref: "/en/dashboard/products/id", currentUtcYear: 2026 }));
  assert.doesNotMatch(existing, /Add CN classification/);
  assert.match(existing, /Edit CN classification/);
  assert.match(existing, /Remove CN classification/);
});

test("uses an accessible text CN input with format-only help and bounded year input", () => {
  const html = renderToStaticMarkup(createElement(CnClassificationSection, { data, canEdit: true, labels, detailHref: "/en/dashboard/products/id", currentUtcYear: 2026 }));
  assert.match(html, /<input(?=[^>]*name="value")(?=[^>]*type="text")(?=[^>]*inputMode="numeric")[^>]*value="01012100"/);
  assert.match(html, /<input(?=[^>]*name="nomenclatureYear")(?=[^>]*type="number")(?=[^>]*min="1988")(?=[^>]*max="2026")[^>]*>/);
  assert.match(html, /aria-describedby="cn-edit-helper"/);
  assert.match(html, /checks the format only/);
  assert.match(html, /does not determine or verify/);
  assert.match(html, /aria-live="assertive"/);
  assert.match(html, /aria-live="polite"/);
  assert.doesNotMatch(html, /name="(?:organizationId|productVersionId|type|issuingAuthority|notes|actorId|publishedTarget)"/);
});

test("renders safe no-draft load-failure and empty states", () => {
  assert.match(renderToStaticMarkup(createElement(CnClassificationSection, { data: null, canEdit: false, labels, detailHref: "/en/dashboard/products/id", currentUtcYear: 2026 })), /No current draft/);
  assert.match(renderToStaticMarkup(createElement(CnClassificationSection, { data: { ...data, cn: null }, canEdit: true, labels, detailHref: "/en/dashboard/products/id", currentUtcYear: 2026 })), /No CN classification/);
  assert.match(renderToStaticMarkup(createElement(CnClassificationSection, { data, canEdit: false, labels, detailHref: "/en/dashboard/products/id", currentUtcYear: 2026, loadFailed: true })), /could not be updated/);
});

test("all six locales provide the complete identical CN message contract", () => {
  const root = new URL("../../", import.meta.url);
  const locales = ["hr", "sr", "en", "de", "sl", "pl"];
  const namespaces = locales.map((locale) => (JSON.parse(readFileSync(new URL(`messages/${locale}.json`, root), "utf8")) as { CnClassification?: Record<string, unknown> }).CnClassification);
  assert.ok(namespaces[0]);
  const keys = Object.keys(labels).sort();
  for (const [index, locale] of locales.entries()) {
    assert.deepEqual(Object.keys(namespaces[index] ?? {}).sort(), keys, locale);
    for (const value of Object.values(namespaces[index] ?? {})) assert.equal(typeof value === "string" && value.length > 0, true, locale);
  }
});
