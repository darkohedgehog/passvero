import QRCode from "qrcode";
import sharp from "sharp";
import type { QrFormat } from "@/src/application/products/qr/contracts";

const settings = {
  errorCorrectionLevel: "Q" as const,
  margin: 4,
  color: { dark: "#000000FF", light: "#FFFFFFFF" },
};

export async function renderQrArtifact(targetUrl: string, format: QrFormat): Promise<Uint8Array> {
  if (format !== "SVG" && format !== "PNG") throw new Error("QR format is invalid.");
  const symbol = QRCode.create(targetUrl, settings);
  const extent = symbol.modules.size + 8;
  if (format === "SVG") {
    const svg = await QRCode.toString(targetUrl, { ...settings, type: "svg" });
    // The pinned renderer emits exactly two paths. Accept only its fixed grammar,
    // numeric QR geometry, and opaque colors; never sanitize arbitrary SVG.
    const expected = new RegExp(`^<svg xmlns="http://www\\.w3\\.org/2000/svg" viewBox="0 0 ${extent} ${extent}" shape-rendering="crispEdges"><path fill="#FFFFFF" d="M0 0h${extent}v${extent}H0z"/><path stroke="#000000" d="[Mm0-9 .h-]+"/></svg>\\n$`);
    if (!expected.test(svg)) throw new Error("QR SVG shape is invalid.");
    return Buffer.from(svg, "utf8");
  }
  const scale = Math.floor(1024 / extent);
  if (scale < 1) throw new Error("QR raster size is invalid.");
  const png = await QRCode.toBuffer(targetUrl, { ...settings, type: "png", scale });
  const padding = 1024 - extent * scale;
  const near = Math.floor(padding / 2);
  return sharp(png).extend({ top: near, left: near, right: padding - near, bottom: padding - near, background: "#ffffff" }).png().toBuffer();
}
