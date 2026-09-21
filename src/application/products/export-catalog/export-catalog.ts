import { hasProductPermission, PRODUCT_READ } from "@/src/application/permissions/product-permissions";
import { productSearchSchema } from "../product-search";
import { CatalogExportError, EXPORT_TIMEOUT_MS, type CatalogExportPersistence, type ExportCatalog } from "./contracts";
import { createCatalogCsv } from "./csv";

export function createExportCatalog(persistence: CatalogExportPersistence): ExportCatalog {
  return async (query, context) => {
    if (!context || context.membershipStatus !== "ACTIVE" || !hasProductPermission(context, PRODUCT_READ)) throw new CatalogExportError("FORBIDDEN");
    const parsed = productSearchSchema.safeParse(query ?? "");
    if (!parsed.success) throw new CatalogExportError("INVALID_SEARCH");
    const deadline = performance.now() + EXPORT_TIMEOUT_MS;
    const csv = createCatalogCsv();
    try {
      await persistence.readSnapshot(context.organizationId, parsed.data, rows => {
        for (const row of rows) {
          if (performance.now() > deadline) throw new CatalogExportError("LIMIT");
          const version = row.currentDraftVersion ?? row.currentPublishedVersion;
          if (row.organizationId !== context.organizationId || (version && (version.organizationId !== context.organizationId || version.productId !== row.id || (version.manufacturer && version.manufacturer.organizationId !== context.organizationId)))) throw new CatalogExportError("FAILED");
          const gtins = version?.identifiers.filter(i => i.type === "GTIN") ?? [];
          const cns = version?.identifiers.filter(i => i.type === "CN") ?? [];
          if (gtins.length > 1 || cns.length > 1) throw new CatalogExportError("FAILED");
          csv.append([row.id, row.internalName, row.sku, row.lifecycleStatus,
            version?.versionNumber, version?.status, version?.sourceLocale,
            gtins[0]?.value, cns[0]?.value, cns[0]?.nomenclatureYear,
            version?.manufacturer?.name, version?.manufacturer?.countryCode,
            row.updatedAt.toISOString(), version?.updatedAt.toISOString()]);
        }
      });
      if (performance.now() > deadline) throw new CatalogExportError("LIMIT");
      return csv.finish();
    } catch (error) {
      if (error instanceof CatalogExportError) throw error;
      throw new CatalogExportError("FAILED");
    }
  };
}
