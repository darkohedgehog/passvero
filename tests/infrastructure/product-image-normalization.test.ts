import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { normalizeProductImage } from "../../src/infrastructure/products/images/normalize";
const fixture = () => sharp({ create: { width: 48, height: 32, channels: 3, background: "#008080" } });
for (const format of ["jpeg", "png"] as const) test(`normalizes decoded ${format}, strips metadata and checksums output`, async () => {
  const bytes = await fixture()[format]().withMetadata({ orientation: 6 }).toBuffer();
  const result = await normalizeProductImage(bytes);
  assert.equal(result.mimeType, `image/${format}`);
  assert.equal(result.width, 32); assert.equal(result.height, 48);
  const meta = await sharp(result.bytes).metadata();
  assert.equal(meta.exif, undefined); assert.equal(meta.orientation, undefined);
  assert.equal(meta.icc, undefined); assert.equal(result.sizeBytes, result.bytes.length);
  assert.match(result.checksumSha256, /^[a-f0-9]{64}$/);
});
test("rejects empty, corrupt, SVG, WebP and oversized input", async () => {
  for (const bytes of [Buffer.alloc(0), Buffer.from('not an image'), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), await fixture().webp().toBuffer(), Buffer.alloc(8 * 1024 * 1024 + 1)]) await assert.rejects(normalizeProductImage(bytes));
});
test("bounds dimensions and total pixels, resizes without stretching", async () => {
  for (const [width,height] of [[8193,1],[5000,5000]]) {
    const bytes = await sharp({create:{width,height,channels:3,background:'white'}}).png().toBuffer();
    await assert.rejects(normalizeProductImage(bytes));
  }
  const bytes = await sharp({create:{width:3000,height:1500,channels:3,background:'white'}}).png().toBuffer();
  const result=await normalizeProductImage(bytes); assert.equal(result.width,2048);assert.equal(result.height,1024);
});
test("rejects animated PNG control chunks and truncated pixel data", async () => {
  const png=await fixture().png().toBuffer();
  // Small deterministic APNG control chunk; rejection occurs before decoder use.
  const chunk=Buffer.alloc(20);chunk.writeUInt32BE(8);chunk.write('acTL',4);chunk.writeUInt32BE(2,8);
  await assert.rejects(normalizeProductImage(Buffer.concat([png.subarray(0,33),chunk,png.subarray(33)])));
  await assert.rejects(normalizeProductImage(png.subarray(0,png.length-30)));
});
