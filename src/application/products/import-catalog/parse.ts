import { parse } from "csv-parse/sync";
import { z } from "zod";
import { ApplicationError } from "@/src/application/errors/application-error";
import { normalizeCreateProductCommand } from "../create-product/normalize-command";
import { gtinSchema } from "../gtin/validation";
import { normalizeCnCode, validateCnNomenclatureYear } from "../cn-classification-current-draft/normalize-command";
import { CatalogImportError, IMPORT_FIELDS, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, importOptionsSchema, type ImportOptions, type ImportRow, type ImportValues } from "./contracts";

export function parseImportFile(bytes: Uint8Array, delimiter: "," | ";") {
  if (bytes.byteLength > MAX_IMPORT_BYTES || bytes.byteLength === 0) throw new CatalogImportError("FILE");
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (text.includes("\0")) throw new Error("NUL");
    let count = 0;
    const parsed: unknown = parse(text, { delimiter, bom: true, cast: false, skip_empty_lines: false, max_record_size: 32768,
      on_record(record: string[]) { if (++count > MAX_IMPORT_ROWS + 1) throw new Error("ROWS"); return record; } });
    const records = z.array(z.array(z.string().max(4096)).min(1).max(64)).min(1).max(MAX_IMPORT_ROWS + 1).parse(parsed);
    const headers = records[0]!.map(h => h.trim());
    if (headers.some(h => !h || h.length > 128) || new Set(headers).size !== headers.length) throw new Error("HEADER");
    return { headers, records: records.slice(1) };
  } catch { throw new CatalogImportError("FILE"); }
}

export function validateImportValues(raw: ImportValues, year: number): { values: ImportValues; errors: string[] } {
  const values = { ...raw };
  const errors: string[] = [];
  try {
    const normalized = normalizeCreateProductCommand({ initialProductName: raw.internal_name, organizationSku: raw.sku, initialLocale: raw.source_locale }, "csv-import");
    values.internal_name = normalized.internalName; values.sku = normalized.sku ?? ""; values.source_locale = normalized.sourceLocale;
  } catch (error) { errors.push(error instanceof ApplicationError ? error.code : "INVALID_ROW"); }
  values.gtin = raw.gtin.trim(); values.cn_code = raw.cn_code.trim(); values.cn_nomenclature_year = raw.cn_nomenclature_year.trim();
  if (values.gtin && !gtinSchema.safeParse(values.gtin).success) errors.push("INVALID_GTIN");
  if (values.cn_code || values.cn_nomenclature_year) {
    try {
      values.cn_code = normalizeCnCode(values.cn_code, "csv-import");
      if (!/^\d{4}$/.test(values.cn_nomenclature_year)) throw new Error("YEAR");
      validateCnNomenclatureYear(Number(values.cn_nomenclature_year), year, "csv-import");
    } catch { errors.push("INVALID_CN"); }
  }
  if (Object.values(values).some(value => value.includes("\0"))) errors.push("INVALID_ROW");
  return { values, errors };
}

export function mapImportRows(file: ReturnType<typeof parseImportFile>, optionsInput: unknown, year: number) {
  const result = importOptionsSchema.safeParse(optionsInput);
  if (!result.success) throw new CatalogImportError("MAPPING");
  const options: ImportOptions = result.data;
  const indices = Object.values(options.mapping).filter((i): i is number => i !== null);
  if (options.mapping.internal_name === null || new Set(indices).size !== indices.length || indices.some(i => i >= file.headers.length)) throw new CatalogImportError("MAPPING");
  const rows: ImportRow[] = file.records.map((cells, index) => {
    const raw = Object.fromEntries(IMPORT_FIELDS.map(field => [field, options.mapping[field] === null ? (field === "source_locale" ? options.defaultLocale : "") : cells[options.mapping[field]!]!])) as ImportValues;
    const { values, errors } = validateImportValues(raw, year);
    return { number: index + 1, values, errors, valid: errors.length === 0, skuConflict: false, gtinMatch: false, similarName: false,
      apostrophe: Object.values(raw).some(v => v.startsWith("'")), numericSku: /^[+-]?\d+(?:[.,]\d+)?e[+-]?\d+$/i.test(raw.sku.trim()) };
  });
  const skus = new Map<string, number>(); const gtins = new Map<string, number>();
  for (const row of rows) { const sku = row.values.sku.trim(); if (sku) skus.set(sku, (skus.get(sku) ?? 0) + 1); if (gtinSchema.safeParse(row.values.gtin).success) { const key = row.values.gtin.padStart(14, "0"); gtins.set(key, (gtins.get(key) ?? 0) + 1); } }
  for (const row of rows) { row.skuConflict = (skus.get(row.values.sku.trim()) ?? 0) > 1; row.gtinMatch = (gtins.get(row.values.gtin.padStart(14, "0")) ?? 0) > 1; }
  return { rows, options, ignored: file.headers.filter((_, i) => !indices.includes(i)) };
}
