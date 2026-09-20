// Optional independent proof: decoder installed outside the project dependency tree.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import sharp from "sharp";
import { renderGtinBarcode } from "../../src/infrastructure/products/gtin-barcode.ts";

const path = process.env.GTIN_DECODER_MODULE;
if (!path?.startsWith("/private/tmp/")) throw new Error("Use a separately installed temporary ZXing module.");
const require = createRequire(import.meta.url);
const decoder = require(path);
for (const [value, format] of [
  ["95200002", decoder.BarcodeFormat.EAN_8],
  ["012345000058", decoder.BarcodeFormat.UPC_A],
  ["6291041500213", decoder.BarcodeFormat.EAN_13],
  ["09520123456788", decoder.BarcodeFormat.ITF],
]) {
  const image = renderGtinBarcode(value);
  const { data, info } = await sharp(Buffer.from(image.svg)).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
  const reader = new decoder.MultiFormatReader();
  reader.setHints(new Map([[decoder.DecodeHintType.POSSIBLE_FORMATS, [format]]]));
  const result = reader.decode(new decoder.BinaryBitmap(new decoder.HybridBinarizer(new decoder.RGBLuminanceSource(new Uint8ClampedArray(data), info.width, info.height))));
  assert.equal(result.getText(), value);
  assert.equal(result.getBarcodeFormat(), format);
  console.log(`INDEPENDENT_DECODE=${value.length}_DIGITS_PASS`);
}
