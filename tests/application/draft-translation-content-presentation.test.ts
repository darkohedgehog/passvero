import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { DraftTranslationContentForm } from "../../src/components/application/products/draft-translation-content-form";

const fields = ["shortDescription", "description", "technicalDescription", "repairInstructions", "sparePartsInformation", "recyclingInstructions", "disposalInstructions", "packagingInformation", "safetyInformation"] as const;
test("renders nine labeled textareas and source language as read-only context", () => {
  const initialValues = Object.fromEntries(fields.map((field) => [field, null]));
  const labels = Object.fromEntries([...fields, "sourceLocale", "save", "saving", "cancel", "reload", "validationError", "staleWrite", "draftNotEditable", "forbidden", "failure"].map((key) => [key, key]));
  const html = renderToStaticMarkup(createElement(DraftTranslationContentForm, { productId: "product-id", sourceLocale: "hr", initialValues: initialValues as never, evidence: { expectedDraftVersionId: "draft-id", expectedProductUpdatedAt: "p", expectedDraftUpdatedAt: "d", expectedSourceTranslationUpdatedAt: "t" }, detailHref: "/dashboard/products/product-id", labels: labels as never }));
  assert.equal((html.match(/<textarea/g) ?? []).length, 9);
  for (const field of fields) { assert.match(html, new RegExp(`name="${field}"`)); assert.match(html, new RegExp(`for="content-${field}"`)); }
  assert.doesNotMatch(html, /name="(?:sourceLocale|productName|organizationSku|versionId|translationId)"/);
  assert.match(html, />HR</); assert.match(html, /aria-live="assertive"/); assert.match(html, /aria-live="polite"/);
});
