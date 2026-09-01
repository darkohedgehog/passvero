import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";

import {
  ProductMaterialsSection,
  type ProductMaterialsLabels,
} from "../../src/components/application/products/product-materials-section";

const labels: ProductMaterialsLabels = {
  title: "Materials",
  empty: "No materials have been added.",
  noDraft: "No current draft is available.",
  addMaterial: "Add material",
  editMaterial: "Edit material",
  removeMaterial: "Remove material",
  materialName: "Material name",
  category: "Category",
  optional: "optional",
  percentage: "Share of product composition (%)",
  percentageDescription: "Percentage of the total product composition.",
  containsRecycled: "Contains recycled content",
  recycledPercentage: "Recycled content within this material (%)",
  recycledPercentageDescription: "Percentage of this material that consists of recycled content.",
  save: "Save",
  add: "Add",
  remove: "Remove",
  cancel: "Cancel",
  saving: "Saving…",
  removing: "Removing…",
  reload: "Reload product",
  staleWrite: "Materials changed. Reload the product.",
  collectionInvalid: "The material percentages exceed 100%.",
  validationError: "Enter valid material information.",
  draftNotEditable: "The current draft cannot be edited.",
  forbidden: "You cannot edit materials.",
  failure: "Materials could not be updated.",
  confirmRemove: "Remove this material?",
  yes: "Yes",
  no: "No",
  notSpecified: "Not specified",
};

const data = {
  productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  expectedDraftVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  expectedProductUpdatedAt: "2026-09-01T10:00:00.000Z",
  expectedDraftUpdatedAt: "2026-09-01T10:01:00.000Z",
  materials: [{
    materialId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    materialName: "Recycled steel",
    category: "Metal",
    percentage: "40.00",
    isRecycled: true,
    recycledPercentage: "75.00",
    updatedAt: "2026-09-01T10:02:00.000Z",
  }],
} as const;

test("renders a semantic current-draft material table without mutation controls for VIEWER", () => {
  const html = renderToStaticMarkup(createElement(ProductMaterialsSection, {
    data,
    canEdit: false,
    labels,
    detailHref: "/en/dashboard/products/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  }));
  assert.match(html, /<section[^>]*aria-labelledby="materials-heading"/);
  assert.match(html, /<table/);
  assert.match(html, /Recycled steel/);
  assert.match(html, /Metal/);
  assert.match(html, /40\.00%/);
  assert.match(html, /75\.00%/);
  assert.match(html, />Yes</);
  assert.doesNotMatch(html, /<button|<form|<input|<details/);
  assert.doesNotMatch(html, /organizationId|productVersionId|supplier|notes/);
});

test("renders accessible one-row ADD EDIT REMOVE forms with exact recycled wording for editors", () => {
  const html = renderToStaticMarkup(createElement(ProductMaterialsSection, {
    data,
    canEdit: true,
    labels,
    detailHref: "/en/dashboard/products/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  }));
  assert.match(html, /Add material/);
  assert.match(html, /Edit material/);
  assert.match(html, /Remove material/);
  assert.match(html, /Share of product composition \(%\)/);
  assert.match(html, /Recycled content within this material \(%\)/);
  assert.match(html, /Percentage of this material that consists of recycled content/);
  assert.doesNotMatch(html, /total recycled|supplier|notes|taxonomy|quantity|unit/i);
  assert.match(html, /aria-live="assertive"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-describedby="material-add-percentage-description"/);
  assert.match(html, /aria-describedby="material-add-recycled-percentage-description"/);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /inputMode="decimal"/);
  assert.match(html, /maxLength="200"|maxlength="200"/i);
  assert.match(html, /maxLength="100"|maxlength="100"/i);
  assert.doesNotMatch(html, /name="(?:organizationId|productVersionId|supplier|notes|createdAt|updatedAt)"/);
});

test("disables recycled percentage when a non-recycled material is edited", () => {
  const html = renderToStaticMarkup(createElement(ProductMaterialsSection, {
    data: {
      ...data,
      materials: [{ ...data.materials[0], isRecycled: false, recycledPercentage: null }],
    },
    canEdit: true,
    labels,
    detailHref: "/en/dashboard/products/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  }));
  assert.match(html, /<input(?=[^>]*name="recycledPercentage")(?=[^>]*disabled)[^>]*>/);
});

test("renders safe no-draft and empty collection states", () => {
  const noDraft = renderToStaticMarkup(createElement(ProductMaterialsSection, {
    data: null,
    canEdit: false,
    labels,
    detailHref: "/en/dashboard/products/product-id",
  }));
  assert.match(noDraft, /No current draft is available/);
  const empty = renderToStaticMarkup(createElement(ProductMaterialsSection, {
    data: { ...data, materials: [] },
    canEdit: true,
    labels,
    detailHref: "/en/dashboard/products/product-id",
  }));
  assert.match(empty, /No materials have been added/);
  assert.match(empty, /Add material/);
});

test("all six locales provide the identical complete ProductMaterials message contract", () => {
  const root = new URL("../../", import.meta.url);
  const locales = ["hr", "sr", "en", "de", "sl", "pl"] as const;
  const namespaces = locales.map((locale) => {
    const messages = JSON.parse(readFileSync(new URL(`messages/${locale}.json`, root), "utf8")) as {
      ProductMaterials?: Record<string, unknown>;
    };
    return messages.ProductMaterials;
  });
  assert.ok(namespaces[0]);
  const keys = Object.keys(namespaces[0]).sort();
  assert.deepEqual(keys, Object.keys(labels).sort());
  for (const [index, locale] of locales.entries()) {
    assert.deepEqual(Object.keys(namespaces[index] ?? {}).sort(), keys, locale);
    for (const value of Object.values(namespaces[index] ?? {})) {
      assert.equal(typeof value, "string", locale);
      assert.notEqual(value, "", locale);
    }
  }
});
