import assert from "node:assert/strict";
import test from "node:test";
import { renderGtinBarcode } from "../../src/infrastructure/products/gtin-barcode";
for (const value of ["95200002", "012345000058", "6291041500213", "09520123456788"]) test(`renders locally with intrinsic dimensions: ${value}`, () => {
  const image = renderGtinBarcode(value);
  assert.ok(image.width > 0 && image.height > 0);
  assert.match(image.svg, /<svg/);
  assert.doesNotMatch(image.svg, /<script|<foreignObject|href=/);
});
test("barcode renderer rejects invalid input instead of generating another check digit", () => {
  assert.throws(() => renderGtinBarcode("012345000059"));
  assert.throws(() => renderGtinBarcode('<svg onload="alert(1)">'));
});
