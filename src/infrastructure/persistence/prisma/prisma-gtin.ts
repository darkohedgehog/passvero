import { Prisma, type PrismaClient } from "@/src/generated/prisma/client";
import type { GtinDependencies, GtinPersistence } from "@/src/application/products/gtin/contracts";
import { gtinError } from "@/src/application/products/gtin/service";
import { authorizeDocumentActor } from "./prisma-document-assets";
import { DocumentError } from "@/src/application/documents/contracts";
import { PrismaTranslationManagementPersistence } from "./prisma-translation-management";

type Tx = Prisma.TransactionClient;
const identifiers = { where: { type: "GTIN" as const }, take: 2, select: { value: true } };
function single(rows: readonly { value: string }[]): string | null {
  if (rows.length > 1) throw gtinError("INTERNAL", "OPERATIONAL_FAILURE");
  return rows[0]?.value ?? null;
}
export class PrismaGtinPersistence implements GtinPersistence<Tx> {
  private readonly existing: PrismaTranslationManagementPersistence;
  constructor(prisma: PrismaClient) { this.existing = new PrismaTranslationManagementPersistence(prisma); }
  async authorize(tx: Tx, context: Parameters<GtinPersistence<Tx>["authorize"]>[1], edit: boolean) {
    try { await authorizeDocumentActor(tx, context, edit ? "PRODUCT_EDIT" : "PRODUCT_READ"); }
    catch (error) { if (error instanceof DocumentError && error.code === "FORBIDDEN") throw gtinError("FORBIDDEN", "FORBIDDEN"); throw error; }
  }
  async load(tx: Tx, productId: string, organizationId: string, lock: boolean) {
    if (lock) await tx.$queryRaw(Prisma.sql`SELECT id FROM "Product" WHERE id=${productId}::uuid AND "organizationId"=${organizationId}::uuid FOR UPDATE`);
    const row = await tx.product.findFirst({ where: { id: productId, organizationId }, select: {
      id: true, organizationId: true, lifecycleStatus: true, updatedAt: true,
      currentDraftVersion: { select: { id: true, productId: true, organizationId: true, status: true, updatedAt: true, identifiers } },
      currentPublishedVersion: { select: { identifiers } },
    } });
    if (!row) return null;
    const draft = row.currentDraftVersion;
    return {
      productId: row.id, organizationId: row.organizationId, lifecycleStatus: row.lifecycleStatus, updatedAt: row.updatedAt.toISOString(),
      draft: draft ? { id: draft.id, productId: draft.productId, organizationId: draft.organizationId, status: draft.status, updatedAt: draft.updatedAt.toISOString(), gtin: single(draft.identifiers) } : null,
      published: single(row.currentPublishedVersion?.identifiers ?? []),
    };
  }
  async write(tx: Tx, productId: string, context: Parameters<GtinPersistence<Tx>["write"]>[2], command: Parameters<GtinPersistence<Tx>["write"]>[3]) {
    if (!await this.existing.touch(tx, { productId, organizationId: context.organizationId, draftId: command.expectedDraftVersionId, productAt: new Date(command.expectedProductUpdatedAt), draftAt: new Date(command.expectedDraftUpdatedAt), actorId: context.userId })) throw gtinError("CONFLICT", "STALE_WRITE");
    const where = { productVersionId: command.expectedDraftVersionId, type: "GTIN" as const };
    if (command.operation === "REMOVE") await tx.productIdentifier.deleteMany({ where });
    else {
      // The locked product + draft CAS serializes SET; the partial index also
      // protects concurrent inserts outside this service. No other type is touched.
      const current = await tx.productIdentifier.findFirst({ where, select: { id: true } });
      const data = { value: command.value, issuingAuthority: null, notes: null };
      if (current) await tx.productIdentifier.update({ where: { id: current.id }, data });
      else await tx.productIdentifier.create({ data: { ...where, ...data } });
    }
    await tx.auditLog.create({ data: {
      organizationId: context.organizationId, actorId: context.userId, action: "PRODUCT_UPDATED", entityType: "PRODUCT", entityId: productId,
      summary: "GTIN updated.", metadata: { operation: `GTIN_${command.operation}` }, correlationId: context.correlationId,
    } });
  }
}
export function createPrismaGtinDependencies(prisma: PrismaClient): GtinDependencies<Tx> {
  return { persistence: new PrismaGtinPersistence(prisma), run: async work => {
    try { return await prisma.$transaction(work); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) throw gtinError("CONFLICT", "STALE_WRITE");
      throw error;
    }
  } };
}
