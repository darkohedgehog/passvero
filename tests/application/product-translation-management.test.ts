import assert from "node:assert/strict";
import test from "node:test";
import { emptyTranslation, normalizeTranslation, translationReady, canLeaveTranslation } from "../../src/application/products/translation-management/content";

test("new translation is empty, not a source copy, and cannot publish", () => {
  const value = emptyTranslation();
  assert.equal(value.productName, "");
  assert.equal(Object.keys(value).length, 12);
  assert.ok(Object.entries(value).every(([key, v]) => key === "productName" ? v === "" : v === null));
  assert.equal(translationReady(value), false);
});
test("only the required name determines completeness; optional content is normalized", () => {
  const value = normalizeTranslation({ ...emptyTranslation(), productName: " Chair ", description: "  " });
  assert.equal(value.productName, "Chair");
  assert.equal(value.description, null);
  assert.equal(translationReady(value), true);
  assert.equal(translationReady({ ...value, productName: " " }), false);
});
test("length limits count Unicode code points and reject invalid types", () => {
  assert.equal(normalizeTranslation({ ...emptyTranslation(), productName: "😀".repeat(200) }).productName.length, 400);
  assert.throws(() => normalizeTranslation({ ...emptyTranslation(), productName: "a".repeat(201) }));
  assert.throws(() => normalizeTranslation({ ...emptyTranslation(), safetyInformation: "a".repeat(5001) }));
  assert.throws(() => normalizeTranslation({ ...emptyTranslation(), warrantyInformation: 123 }));
});
test("content-locale navigation needs confirmation only for dirty edits", () => {
  let calls = 0;
  const reject = () => { calls++; return false; };
  assert.equal(canLeaveTranslation(false, reject), true);
  assert.equal(calls, 0);
  assert.equal(canLeaveTranslation(true, reject), false);
  assert.equal(calls, 1);
  assert.equal(canLeaveTranslation(true, () => true), true);
});
