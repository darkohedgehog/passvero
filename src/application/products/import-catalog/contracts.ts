import { z } from "zod";
import { PASSVERO_LOCALES } from "@/src/domain/values/passvero-locale";

export const IMPORT_FIELDS = ["internal_name", "sku", "source_locale", "gtin", "cn_code", "cn_nomenclature_year"] as const;
export type ImportField = typeof IMPORT_FIELDS[number];
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 10_000;
export const IMPORT_BATCH_SIZE = 25;
export const importOptionsSchema = z.object({
  delimiter: z.enum([",", ";"]), defaultLocale: z.enum(PASSVERO_LOCALES),
  mapping: z.record(z.enum(IMPORT_FIELDS), z.number().int().min(0).max(63).nullable()),
}).strict();
export type ImportOptions = z.infer<typeof importOptionsSchema>;
export const importValuesSchema = z.object({
  internal_name: z.string().max(800), sku: z.string().max(512), source_locale: z.string().max(16),
  gtin: z.string().max(64), cn_code: z.string().max(64), cn_nomenclature_year: z.string().max(16),
}).strict();
export type ImportValues = z.infer<typeof importValuesSchema>;
export type ImportRow = { number: number; values: ImportValues; valid: boolean; errors: string[]; skuConflict: boolean; gtinMatch: boolean; similarName: boolean; apostrophe: boolean; numericSku: boolean };
export type ImportOutcome = { number: number; status: string; productId: string | null; error: string | null };
export type ImportBatchState = { id: string; status: string; selected: number[]; outcomes: ImportOutcome[] };
export type ImportPreview = { headers: string[]; ignored: string[]; contentHash: string; token: string; rows: ImportRow[]; errorCount: number; invalidCount: number; existing: ImportBatchState | null };
export class CatalogImportError extends Error {
  constructor(readonly code: "FORBIDDEN" | "FILE" | "MAPPING" | "VALIDATION" | "STALE_PREVIEW" | "SELECTION" | "NOT_FOUND" | "FAILED" | "CANCELLED") { super(code); }
}
