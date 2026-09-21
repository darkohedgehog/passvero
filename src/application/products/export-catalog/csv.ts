import { Buffer } from "node:buffer";
import { CatalogExportError, MAX_EXPORT_BYTES, MAX_EXPORT_ROWS } from "./contracts";

export const CATALOG_CSV_COLUMNS = [
  "product_id", "internal_name", "sku", "lifecycle_status", "version_number",
  "version_status", "source_locale", "gtin", "cn_code", "cn_nomenclature_year",
  "manufacturer_name", "manufacturer_country_code", "product_updated_at", "version_updated_at",
] as const;

// Quote every cell; additionally guard formula, control and disguised formula prefixes.
// The apostrophe is data: future imports must explicitly handle this transformation.
export function csvCell(value: string | number | null | undefined): string {
  let text = value == null ? "" : String(value);
  if (/^[\s]*[\p{Cc}\p{Cf}]|^[\s\p{Cc}\p{Cf}]*[=+@\-＝＋－＠]/u.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function createCatalogCsv() {
  const chunks: Buffer[] = [Buffer.from("\ufeff" + CATALOG_CSV_COLUMNS.join(",") + "\r\n", "utf8")];
  let bytes = chunks[0]!.length;
  let rows = 0;
  return {
    append(values: readonly (string | number | null | undefined)[]) {
      if (++rows > MAX_EXPORT_ROWS) throw new CatalogExportError("LIMIT");
      if (values.length !== CATALOG_CSV_COLUMNS.length) throw new CatalogExportError("FAILED");
      // Avoid constructing an oversized escaped row even when stored data is malformed.
      if (values.reduce<number>((sum, value) => sum + Buffer.byteLength(String(value ?? "")), 0) > MAX_EXPORT_BYTES - bytes) throw new CatalogExportError("LIMIT");
      const chunk = Buffer.from(values.map(csvCell).join(",") + "\r\n", "utf8");
      if (bytes + chunk.length > MAX_EXPORT_BYTES) throw new CatalogExportError("LIMIT");
      bytes += chunk.length;
      chunks.push(chunk);
    },
    finish(): Uint8Array<ArrayBuffer> { return new Uint8Array(Buffer.concat(chunks, bytes)); },
  };
}
