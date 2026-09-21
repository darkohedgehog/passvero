import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { AuthenticatedUserContext } from "@/src/application/context/authenticated-user-context";
import { hasProductPermission } from "@/src/application/permissions/product-permissions";
import { CatalogImportError, IMPORT_FIELDS, IMPORT_BATCH_SIZE, importOptionsSchema, importValuesSchema, type ImportBatchState, type ImportRow, type ImportValues, type ImportPreview } from "./contracts";
import { mapImportRows, parseImportFile, validateImportValues } from "./parse";

export interface CatalogImportPersistence {
  inspect(context: AuthenticatedUserContext, hash: string, rows: ImportRow[]): Promise<{ existing: ImportBatchState | null; skus: string[]; gtins: string[]; names: string[] }>;
  confirm(context: AuthenticatedUserContext, input: { contentHash: string; selectionHash: string; acceptGtinMatches: boolean; totalRows: number; rows: { number: number; hash: string }[] }): Promise<ImportBatchState>;
  execute(context: AuthenticatedUserContext, id: string, rows: { number: number; values: ImportValues; hash: string }[]): Promise<ImportBatchState>;
  cancel(context: AuthenticatedUserContext, id: string): Promise<ImportBatchState>;
}
export const hashImportRow = (values: ImportValues) => createHash("sha256").update(JSON.stringify(IMPORT_FIELDS.map(field => values[field]))).digest("hex");
export function requireImportContext(context: AuthenticatedUserContext | null): asserts context is AuthenticatedUserContext {
  if (!context || context.membershipStatus !== "ACTIVE" || !hasProductPermission(context, "PRODUCT_CREATE") || !hasProductPermission(context, "PRODUCT_EDIT")) throw new CatalogImportError("FORBIDDEN");
}
export function createCatalogImportService(persistence: CatalogImportPersistence, secret: string, now: () => number = Date.now) {
  function signature(context: AuthenticatedUserContext, hash: string, expires: string) {
    return createHmac("sha256", secret).update(JSON.stringify(["CSV_IMPORT_PREVIEW_V1", context.organizationId, context.userId, context.membershipId, hash, expires])).digest("hex");
  }
  function prepare(bytes: Uint8Array, optionsInput: unknown) {
    const parsed = importOptionsSchema.safeParse(optionsInput); if (!parsed.success) throw new CatalogImportError("MAPPING");
    const options = parsed.data;
    const file = parseImportFile(bytes, options.delimiter);
    const mapped = mapImportRows(file, options, new Date(now()).getUTCFullYear());
    const hash = createHash("sha256").update(bytes).update(JSON.stringify([options.delimiter, options.defaultLocale, IMPORT_FIELDS.map(f => options.mapping[f])])).digest("hex");
    return { ...mapped, headers: file.headers, hash };
  }
  async function assess(bytes: Uint8Array, optionsInput: unknown, context: AuthenticatedUserContext) {
    const prepared = prepare(bytes, optionsInput);
    const found = await persistence.inspect(context, prepared.hash, prepared.rows);
    const skus = new Set(found.skus), gtins = new Set(found.gtins), names = new Set(found.names);
    for (const row of prepared.rows) {
      row.skuConflict ||= skus.has(row.values.sku);
      row.gtinMatch ||= !!row.values.gtin && gtins.has(row.values.gtin.padStart(14, "0"));
      row.similarName = names.has(row.values.internal_name.toLowerCase());
    }
    return { ...prepared, existing: found.existing };
  }
  return {
    async preview(bytes: Uint8Array, options: unknown, context: AuthenticatedUserContext | null): Promise<ImportPreview> {
      requireImportContext(context);
      const data = await assess(bytes, options, context);
      const expires = String(now() + 30 * 60_000);
      const errorCount = data.rows.reduce((n, r) => n + r.errors.length + Number(r.skuConflict), 0);
      let detailed = 0;
      const rows = data.rows.map(row => ({ ...row, errors: row.errors.filter(() => detailed++ < 100) }));
      return { headers: data.headers, ignored: data.ignored, contentHash: data.hash, token: expires + "." + signature(context, data.hash, expires), rows, errorCount,
        invalidCount: rows.filter(r => !r.valid || r.skuConflict).length, existing: data.existing };
    },
    async confirm(bytes: Uint8Array, options: unknown, input: unknown, context: AuthenticatedUserContext | null) {
      requireImportContext(context);
      const parsed = z.object({ token: z.string().max(128), selected: z.array(z.number().int().min(1).max(10000)).min(1).max(10000), acceptGtinMatches: z.boolean() }).strict().safeParse(input);
      if (!parsed.success) throw new CatalogImportError("SELECTION");
      const data = prepare(bytes, options); const [expires, mac] = parsed.data.token.split(".");
      if (!expires || !mac || !/^\d{13}$/.test(expires) || !/^[0-9a-f]{64}$/.test(mac) || Number(expires) < now() || !timingSafeEqual(Buffer.from(mac), Buffer.from(signature(context, data.hash, expires)))) throw new CatalogImportError("STALE_PREVIEW");
      const assessed = await assess(bytes, options, context);
      const selected = [...parsed.data.selected].sort((a,b) => a-b);
      if (new Set(selected).size !== selected.length) throw new CatalogImportError("SELECTION");
      const rows = selected.map(number => assessed.rows[number - 1]);
      if (rows.some(r => !r || !r.valid || r.skuConflict || (r.gtinMatch && !parsed.data.acceptGtinMatches))) throw new CatalogImportError("SELECTION");
      const selectionHash = createHash("sha256").update(JSON.stringify([selected, parsed.data.acceptGtinMatches])).digest("hex");
      return persistence.confirm(context, { contentHash: data.hash, selectionHash, acceptGtinMatches: parsed.data.acceptGtinMatches, totalRows: data.rows.length, rows: rows.map(r => ({ number: r!.number, hash: hashImportRow(r!.values) })) });
    },
    async execute(input: unknown, context: AuthenticatedUserContext | null) {
      requireImportContext(context);
      const parsed = z.object({ id: z.uuid(), rows: z.array(z.object({ number: z.number().int().min(1).max(10000), values: importValuesSchema }).strict()).min(1).max(IMPORT_BATCH_SIZE) }).strict().safeParse(input);
      if (!parsed.success || new Set(parsed.data.rows.map(r => r.number)).size !== parsed.data.rows.length) throw new CatalogImportError("VALIDATION");
      const rows = parsed.data.rows.map(row => {
        const checked = validateImportValues(row.values, new Date(now()).getUTCFullYear());
        if (checked.errors.length) throw new CatalogImportError("VALIDATION");
        return { number: row.number, values: checked.values, hash: hashImportRow(checked.values) };
      });
      return persistence.execute(context, parsed.data.id, rows);
    },
    async cancel(id: unknown, context: AuthenticatedUserContext | null) {
      requireImportContext(context); if (!z.uuid().safeParse(id).success) throw new CatalogImportError("VALIDATION");
      return persistence.cancel(context, id as string);
    },
  };
}
