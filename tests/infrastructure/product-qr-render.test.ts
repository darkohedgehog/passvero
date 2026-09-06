import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import jsQR from "jsqr";
import QRCode from "qrcode";
import { renderQrArtifact } from "../../src/infrastructure/products/qr-renderer";
const target = "https://passvero.eu/p/AbCdEfGhIjKlMnOpQrStUv";
for (const format of ["SVG", "PNG"] as const) {
  test(`${format} final artifact decodes exact destination with opaque square modules`, async () => {
    const result = await renderQrArtifact(target, format);
    assert.deepEqual(result, await renderQrArtifact(target, format));
    const input = Buffer.from(result);
    const metadata = await sharp(input).metadata();
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.xmp, undefined);
    const { data, info } = await sharp(input, format === "SVG" ? { density: 600 } : undefined).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, info.height);
    if (format === "PNG") assert.equal(info.width, 1024);
    assert.equal(jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data, target);
    for (let i = 0; i < data.length; i += 4) {
      assert.equal(data[i + 3], 255);
      if (format === "PNG") assert.ok(data[i] === 0 || data[i] === 255);
    }
    if (format === "SVG") {
      const svg = input.toString();
      const symbol = QRCode.create(target, { errorCorrectionLevel: "Q" });
      const extent = symbol.modules.size + 8;
      assert.ok(svg.includes(`viewBox="0 0 ${extent} ${extent}"`));
      assert.doesNotMatch(svg, /script|foreignObject|href|https:\/\/passvero|<text|onload|opacity/);
      assert.match(svg, /fill="#FFFFFF"/);
      assert.match(svg, /stroke="#000000"/);
    } else {
      const symbol = QRCode.create(target, { errorCorrectionLevel: "Q" });
      const n = symbol.modules.size;
      const scale = Math.floor(1024 / (n + 8));
      const offset = Math.floor((1024 - (n + 8) * scale) / 2);
      for (let y = 0; y < 1024; y++) for (let x = 0; x < 1024; x++) {
        const mx = Math.floor((x - offset) / scale) - 4;
        const my = Math.floor((y - offset) / scale) - 4;
        const black = mx >= 0 && mx < n && my >= 0 && my < n && symbol.modules.get(my, mx);
        assert.equal(data[(y * 1024 + x) * 4], black ? 0 : 255);
      }
    }
  });
}
test("renderer rejects unsupported runtime format", async () => {
  await assert.rejects(() => renderQrArtifact(target, "PDF" as "SVG"));
});
