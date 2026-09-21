import { Prisma, type PrismaClient } from "@/src/generated/prisma/client";
import { CatalogExportError, EXPORT_TIMEOUT_MS, MAX_EXPORT_ROWS, type CatalogExportPersistence } from "@/src/application/products/export-catalog/contracts";
import { productCatalogSearchWhere } from "./product-catalog-search";

const versionProjection = {
  organizationId: true, productId: true, versionNumber: true, status: true, sourceLocale: true, updatedAt: true,
  identifiers: { where: { type: { in: ["GTIN", "CN"] } }, select: { type: true, value: true, nomenclatureYear: true } },
  manufacturer: { select: { organizationId: true, name: true, countryCode: true } },
} satisfies Prisma.ProductVersionSelect;

export class PrismaExportCatalogPersistence implements CatalogExportPersistence {
  constructor(private readonly prisma: Pick<PrismaClient, "$transaction">) {}
  async readSnapshot(organizationId: string, search: string, consume: Parameters<CatalogExportPersistence["readSnapshot"]>[2]): Promise<void> {
    try {
      await this.prisma.$transaction(async tx => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        await tx.$executeRaw`SET LOCAL statement_timeout = '10000ms'`;
        let after: { id: string; updatedAt: Date } | undefined;
        let count = 0;
        while (true) {
          const rows = await tx.product.findMany({
            where: { ...productCatalogSearchWhere(organizationId, search), ...(after ? { OR: [
              { updatedAt: { lt: after.updatedAt } }, { updatedAt: after.updatedAt, id: { lt: after.id } },
            ] } : {}) },
            select: { id: true, organizationId: true, internalName: true, sku: true, lifecycleStatus: true, updatedAt: true,
              currentDraftVersion: { select: versionProjection }, currentPublishedVersion: { select: versionProjection } },
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 100,
          });
          count += rows.length;
          if (count > MAX_EXPORT_ROWS) throw new CatalogExportError("LIMIT");
          await consume(rows);
          if (rows.length < 100) break;
          const last = rows[rows.length - 1]!;
          after = { id: last.id, updatedAt: last.updatedAt };
        }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 2000, timeout: EXPORT_TIMEOUT_MS });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2028" || error.code === "P2024" || error.meta?.code === "57014")) throw new CatalogExportError("LIMIT");
      throw error;
    }
  }
}
