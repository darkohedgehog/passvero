import { randomBytes, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@/src/generated/prisma/client";
import type { AuthenticatedUserContext } from "@/src/application/context/authenticated-user-context";
import { ApplicationError } from "@/src/application/errors/application-error";
import { CatalogImportError, type ImportBatchState, type ImportRow } from "@/src/application/products/import-catalog/contracts";
import type { CatalogImportPersistence } from "@/src/application/products/import-catalog/service";
import { createCreateProductService } from "@/src/application/products/create-product/create-product";
import { createGtinServices } from "@/src/application/products/gtin/service";
import { createCnClassificationCurrentDraftServices } from "@/src/application/products/cn-classification-current-draft/services";
import { PrismaCreateProductPersistence } from "./prisma-create-product";
import { PrismaGtinPersistence } from "./prisma-gtin";
import { PrismaCnClassificationCurrentDraftPersistence } from "./prisma-cn-classification-current-draft";
import { authorizeDocumentActor } from "./prisma-document-assets";
import { DocumentError } from "@/src/application/documents/contracts";

type Tx = Prisma.TransactionClient;
const scope = (c: AuthenticatedUserContext) => ({ organizationId: c.organizationId, userId: c.userId });
async function authorize(tx: Tx, context: AuthenticatedUserContext) {
  try { await authorizeDocumentActor(tx, context, "PRODUCT_CREATE"); await authorizeDocumentActor(tx, context, "PRODUCT_EDIT"); }
  catch (e) { if (e instanceof DocumentError && e.code === "FORBIDDEN") throw new CatalogImportError("FORBIDDEN"); throw e; }
}
async function state(tx: Tx, c: AuthenticatedUserContext, id: string): Promise<ImportBatchState> {
  const batch = await tx.catalogImportBatch.findFirst({ where: { id, ...scope(c) }, select: { id: true, status: true, rows: { orderBy: { rowNumber: "asc" }, select: { rowNumber: true, status: true, productId: true, error: true } } } });
  if (!batch) throw new CatalogImportError("NOT_FOUND");
  return { id: batch.id, status: batch.status, selected: batch.rows.map(r => r.rowNumber), outcomes: batch.rows.map(r => ({ number: r.rowNumber, status: r.status, productId: r.productId, error: r.error })) };
}
async function lockBatch(tx: Tx, c: AuthenticatedUserContext, id: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT id FROM "CatalogImportBatch" WHERE id=${id}::uuid AND "organizationId"=${c.organizationId}::uuid AND "userId"=${c.userId}::uuid FOR UPDATE`);
  if (!rows.length) throw new CatalogImportError("NOT_FOUND");
  return tx.catalogImportBatch.findUniqueOrThrow({ where: { id } });
}
export class PrismaCatalogImportPersistence implements CatalogImportPersistence {
  constructor(private readonly prisma: PrismaClient) {}
  private run<T>(work: (tx: Tx) => Promise<T>, timeout = 5000) {
    return this.prisma.$transaction(async tx => { await tx.$executeRaw`SET LOCAL statement_timeout = '4000ms'`; return work(tx); }, { timeout, maxWait: 2000 });
  }
  async inspect(c: AuthenticatedUserContext, hash: string, rows: ImportRow[]) {
    return this.run(async tx => {
      await authorize(tx, c);
      const batch = await tx.catalogImportBatch.findUnique({ where: { organizationId_userId_contentHash: { ...scope(c), contentHash: hash } } });
      const existing = batch ? await state(tx, c, batch.id) : null;
      const ownIds = existing?.outcomes.flatMap(r => r.productId ? [r.productId] : []) ?? [];
      const skus = [...new Set(rows.map(r => r.values.sku).filter(Boolean))];
      const names = [...new Set(rows.map(r => r.values.internal_name.toLowerCase()))];
      const gtins = [...new Set(rows.map(r => r.values.gtin).filter(Boolean).map(v => v.padStart(14, "0")))];
      const skuRows = skus.length ? await tx.product.findMany({ where: { organizationId: c.organizationId, normalizedSku: { in: skus }, id: { notIn: ownIds } }, select: { normalizedSku: true } }) : [];
      const nameRows = names.length ? await tx.$queryRaw<{ name: string }[]>(Prisma.sql`SELECT DISTINCT lower("internalName") AS name FROM "Product" WHERE "organizationId"=${c.organizationId}::uuid AND lower("internalName")=ANY(${names}::text[]) AND NOT(id=ANY(${ownIds}::uuid[]))`) : [];
      const gtinRows = gtins.length ? await tx.$queryRaw<{ gtin: string }[]>(Prisma.sql`SELECT DISTINCT lpad(i.value,14,'0') AS gtin FROM "Product" p JOIN "ProductVersion" v ON v."productId"=p.id AND v."organizationId"=p."organizationId" JOIN "ProductIdentifier" i ON i."productVersionId"=v.id AND i.type='GTIN' WHERE p."organizationId"=${c.organizationId}::uuid AND NOT(p.id=ANY(${ownIds}::uuid[])) AND ((p."currentDraftVersionId"=v.id AND v.status IN ('DRAFT','READY_FOR_REVIEW')) OR (p."currentPublishedVersionId"=v.id AND v.status='PUBLISHED')) AND lpad(i.value,14,'0')=ANY(${gtins}::text[])`) : [];
      return { existing, skus: skuRows.flatMap(r => r.normalizedSku ? [r.normalizedSku] : []), names: nameRows.map(r => r.name), gtins: gtinRows.map(r => r.gtin) };
    }, 15000);
  }
  async confirm(c: AuthenticatedUserContext, input: Parameters<CatalogImportPersistence["confirm"]>[1]) {
    return this.run(async tx => {
      await authorize(tx, c);
      await tx.$executeRaw(Prisma.sql`INSERT INTO "CatalogImportBatch" (id,"organizationId","userId","contentHash","selectionHash","totalRows","acceptGtinMatches") VALUES (${randomUUID()}::uuid,${c.organizationId}::uuid,${c.userId}::uuid,${input.contentHash},${input.selectionHash},${input.totalRows},${input.acceptGtinMatches}) ON CONFLICT ("organizationId","userId","contentHash") DO NOTHING`);
      const batch = await tx.catalogImportBatch.findUniqueOrThrow({ where: { organizationId_userId_contentHash: { ...scope(c), contentHash: input.contentHash } } });
      await lockBatch(tx, c, batch.id);
      if (batch.selectionHash !== input.selectionHash) throw new CatalogImportError("SELECTION");
      await tx.catalogImportRow.createMany({ data: input.rows.map(r => ({ batchId: batch.id, rowNumber: r.number, rowHash: r.hash })), skipDuplicates: true });
      return state(tx, c, batch.id);
    }, 15000);
  }
  async execute(c: AuthenticatedUserContext, id: string, rows: Parameters<CatalogImportPersistence["execute"]>[2]) {
    const deadline = performance.now() + 10_000;
    for (const row of rows) {
      if (performance.now() >= deadline) break;
      try {
        await this.run(async tx => {
          await authorize(tx, c);
          const batch = await lockBatch(tx, c, id);
          const receipt = await tx.catalogImportRow.findUnique({ where: { batchId_rowNumber: { batchId: id, rowNumber: row.number } } });
          if (!receipt || receipt.rowHash !== row.hash) throw new CatalogImportError("VALIDATION");
          if (batch.status !== "ACTIVE" || receipt.status !== "PENDING") return;
          if (row.values.gtin && !batch.acceptGtinMatches) {
            const matches = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT p.id FROM "Product" p JOIN "ProductVersion" v ON v."productId"=p.id AND v."organizationId"=p."organizationId" JOIN "ProductIdentifier" i ON i."productVersionId"=v.id AND i.type='GTIN' WHERE p."organizationId"=${c.organizationId}::uuid AND (p."currentDraftVersionId"=v.id OR p."currentPublishedVersionId"=v.id) AND lpad(i.value,14,'0')=${row.values.gtin.padStart(14,"0")} LIMIT 1`);
            if (matches.length) { await tx.catalogImportRow.update({ where: { batchId_rowNumber: { batchId: id, rowNumber: row.number } }, data: { status: "FAILED", error: "GTIN_REVIEW_REQUIRED" } }); return; }
          }
          const run = <T>(work: (tx: Tx) => Promise<T>) => work(tx);
          const create = createCreateProductService({ persistence: new PrismaCreateProductPersistence(), transactionRunner: { run }, publicCodeGenerator: { generate: () => randomBytes(16).toString("base64url") }, monotonicNow: () => performance.now(), telemetry: { recordSuccess() {}, recordFailure() {}, recordPublicCodeCollision() {}, recordPublicCodeExhaustion() {} } });
          const product = await create({ initialProductName: row.values.internal_name, initialLocale: row.values.source_locale, organizationSku: row.values.sku }, c);
          const evidence = async () => {
            const p = await tx.product.findUniqueOrThrow({ where: { id: product.productId }, select: { updatedAt: true, currentDraftVersion: { select: { updatedAt: true } } } });
            return { expectedDraftVersionId: product.initialProductVersionId, expectedProductUpdatedAt: p.updatedAt.toISOString(), expectedDraftUpdatedAt: p.currentDraftVersion!.updatedAt.toISOString() };
          };
          if (row.values.gtin) await createGtinServices({ persistence: new PrismaGtinPersistence(this.prisma), run }).mutate(product.productId, { operation: "SET", value: row.values.gtin, ...await evidence() }, c);
          if (row.values.cn_code) await createCnClassificationCurrentDraftServices({ persistence: new PrismaCnClassificationCurrentDraftPersistence(this.prisma), transactionRunner: { run }, currentUtcYear: () => new Date().getUTCFullYear() }).add({ productId: product.productId, value: row.values.cn_code, nomenclatureYear: Number(row.values.cn_nomenclature_year), ...await evidence() }, c);
          await tx.catalogImportRow.update({ where: { batchId_rowNumber: { batchId: id, rowNumber: row.number } }, data: { status: "SUCCEEDED", productId: product.productId } });
        });
      } catch (error) {
        if (error instanceof CatalogImportError) throw error;
        if (error instanceof ApplicationError && ["FORBIDDEN", "UNAUTHENTICATED"].includes(error.category)) throw new CatalogImportError("FORBIDDEN");
        // The failed creation transaction rolled back completely. A separate locked
        // receipt update cannot overwrite another request's successfully committed row.
        await this.run(async tx => {
          await authorize(tx, c); await lockBatch(tx, c, id);
          await tx.catalogImportRow.updateMany({ where: { batchId: id, rowNumber: row.number, rowHash: row.hash, status: "PENDING" }, data: { status: "FAILED", error: error instanceof ApplicationError && error.code === "CREATE_PRODUCT_SKU_CONFLICT" ? "SKU_CONFLICT" : "ROW_FAILED" } });
        });
      }
    }
    return this.run(async tx => {
      await authorize(tx, c); const batch = await lockBatch(tx, c, id);
      if (batch.status === "ACTIVE" && !await tx.catalogImportRow.count({ where: { batchId: id, status: "PENDING" } })) await tx.catalogImportBatch.update({ where: { id }, data: { status: "COMPLETE" } });
      return state(tx, c, id);
    });
  }
  async cancel(c: AuthenticatedUserContext, id: string) {
    return this.run(async tx => { await authorize(tx, c); const batch = await lockBatch(tx, c, id); if (batch.status === "ACTIVE") await tx.catalogImportBatch.update({ where: { id }, data: { status: "CANCELLED" } }); return state(tx, c, id); });
  }
}
