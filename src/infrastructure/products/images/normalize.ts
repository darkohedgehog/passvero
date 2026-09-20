import sharp from "sharp";
import { createHash } from "node:crypto";
import { imageError, MAX_IMAGE_BYTES, type NormalizedImage } from "@/src/application/products/images/contracts";
// PNG APNG control chunks are checked explicitly: decoders can expose only frame 0.
function isAnimatedPng(bytes: Buffer): boolean {
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const size = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (type === "acTL" || type === "fcTL" || type === "fdAT") return true;
    if (size > bytes.length - offset - 12) throw new Error();
    offset += size + 12;
    if (type === "IEND") break;
  }
  return false;
}
let active = 0;
export async function normalizeProductImage(input: Uint8Array): Promise<NormalizedImage> {
  if (active >= 2) throw imageError("INTERNAL", "BUSY");
  active++;
  try {
    if (!input.length || input.length > MAX_IMAGE_BYTES) throw new Error();
    const bytes = Buffer.from(input);
    const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    // Multi-picture JPEG (MPO) must not be flattened silently to the first image.
    if (jpeg && bytes.includes(Buffer.from("MPF\0"))) throw new Error();
    if ((!png && !jpeg) || (png && isAnimatedPng(bytes))) throw new Error();
    const image = sharp(bytes, { failOn: "warning", limitInputPixels: 24_000_000, sequentialRead: true }).timeout({ seconds: 5 });
    const meta = await image.metadata();
    if (meta.format !== (png ? "png" : "jpeg") || !meta.width || !meta.height || meta.width > 8192 || meta.height > 8192
      || meta.width * meta.height > 24_000_000 || (meta.pages ?? 1) !== 1 || meta.pageHeight || meta.delay) throw new Error();
    const pipeline = image.rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).toColourspace("srgb");
    // No keepMetadata/withMetadata: Sharp strips EXIF, ICC, XMP and orientation.
    const { data, info } = await (png ? pipeline.png({ compressionLevel: 6 }) : pipeline.jpeg({ quality: 85, progressive: false })).toBuffer({ resolveWithObject: true });
    if (!data.length || data.length > MAX_IMAGE_BYTES) throw new Error();
    return { bytes: data, mimeType: png ? "image/png" : "image/jpeg", sizeBytes: data.length, checksumSha256: createHash("sha256").update(data).digest("hex"), width: info.width, height: info.height };
  } catch { throw imageError("VALIDATION", "INVALID_IMAGE"); }
  finally { active--; }
}
