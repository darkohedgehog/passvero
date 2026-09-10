import { DraftCreationConflict, type CreateDraftFromPublishedPersistence } from "@/src/application/products/create-draft-from-published/ports";
import { Prisma, type PrismaClient } from "@/src/generated/prisma/client";
import { PrismaPublishProductPersistence } from "./prisma-publish-product";

type Transaction = Prisma.TransactionClient;
export class PrismaCreateDraftFromPublishedPersistence extends PrismaPublishProductPersistence implements CreateDraftFromPublishedPersistence<Transaction> {
  async readVersion(tx: Transaction, input: { productVersionId: string; productId: string; organizationId: string }) {
    const row = await tx.productVersion.findFirst({
      where: { id: input.productVersionId, productId: input.productId, organizationId: input.organizationId },
      select: { id: true, productId: true, organizationId: true, status: true, sourceLocale: true, versionNumber: true, clonedFromVersionId: true, updatedAt: true, reviewReadyAt: true, publishedAt: true, publishedById: true, supersededAt: true, discardedAt: true },
    });
    return row === null ? null : { ...row, productVersionId: row.id };
  }

  async readCopyEligibility(tx: Transaction, input: { productVersionId: string; organizationId: string; sourceLocale: string }) {
    const [imageCount, source, foreignDocuments] = await Promise.all([
      tx.productImage.count({ where: { productVersionId: input.productVersionId } }),
      tx.productTranslation.findUnique({ where: { productVersionId_locale: { productVersionId: input.productVersionId, locale: input.sourceLocale } }, select: { productName: true } }),
      tx.productDocument.count({ where: { productVersionId: input.productVersionId, document: { organizationId: { not: input.organizationId } } } }),
    ]);
    return { imageCount, sourceTranslationValid: source !== null && source.productName === source.productName.trim() && source.productName.length > 0 && Array.from(source.productName).length <= 200, documentOwnershipValid: foreignDocuments === 0 };
  }

  async createDraft(tx: Transaction, input: Parameters<CreateDraftFromPublishedPersistence<Transaction>["createDraft"]>[1]) {
    const where = { productVersionId: input.sourceVersionId };
    // Explicit authoring allowlists. No row IDs or lifecycle/actor history are copied.
    const [translations, materials, identifiers, documents] = await Promise.all([
      tx.productTranslation.findMany({ where, select: {
        locale: true, productName: true, shortDescription: true, description: true, technicalDescription: true,
        repairInstructions: true, sparePartsInformation: true, recyclingInstructions: true,
        disposalInstructions: true, packagingInformation: true, safetyInformation: true, warrantyInformation: true, publicNotes: true,
      } }),
      tx.productMaterial.findMany({ where, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: {
        materialName: true, category: true, percentage: true, isRecycled: true, recycledPercentage: true, supplier: true, notes: true,
      } }),
      tx.productIdentifier.findMany({ where, select: { type: true, value: true, issuingAuthority: true, notes: true, nomenclatureYear: true } }),
      tx.productDocument.findMany({ where, select: { documentId: true, category: true, locale: true, displayLabel: true, description: true, isPublic: true, isPrimary: true, sortOrder: true } }),
    ]);
    const draft = await tx.productVersion.create({ data: {
      productId: input.productId, organizationId: input.organizationId, sourceLocale: input.sourceLocale,
      status: "DRAFT", versionNumber: null, clonedFromVersionId: input.sourceVersionId,
      createdById: input.actorId, updatedById: input.actorId,
    }, select: { id: true, createdAt: true } });
    if (translations.length) await tx.productTranslation.createMany({ data: translations.map(row => ({ ...row, productVersionId: draft.id })) });
    // Materials have no sortOrder: preserve their established createdAt/id ordering
    // with distinct fresh timestamps, without retaining old row creation metadata.
    if (materials.length) await tx.productMaterial.createMany({ data: materials.map((row, index) => ({ ...row, productVersionId: draft.id, createdAt: new Date(draft.createdAt.getTime() + index) })) });
    if (identifiers.length) await tx.productIdentifier.createMany({ data: identifiers.map(row => ({ ...row, productVersionId: draft.id })) });
    if (documents.length) await tx.productDocument.createMany({ data: documents.map(row => ({ ...row, productVersionId: draft.id })) });
    const assigned = await tx.product.updateMany({ where: {
      id: input.productId, organizationId: input.organizationId, lifecycleStatus: "ACTIVE",
      currentDraftVersionId: null, currentPublishedVersionId: input.sourceVersionId, updatedAt: input.expectedProductUpdatedAt,
    }, data: { currentDraftVersionId: draft.id, updatedById: input.actorId } });
    if (assigned.count !== 1) throw new DraftCreationConflict();
    await tx.auditLog.create({ data: {
      organizationId: input.organizationId, actorId: input.actorId, action: "PRODUCT_UPDATED",
      entityType: "PRODUCT", entityId: input.productId, summary: "Private draft created from published product.",
      metadata: { operation: "CREATE_DRAFT_FROM_PUBLISHED" }, correlationId: input.correlationId,
    }, select: { id: true } });
  }
}

export function createPrismaCreateDraftFromPublishedDependencies(prisma: PrismaClient) {
  return {
    persistence: new PrismaCreateDraftFromPublishedPersistence(prisma),
    transactionRunner: {
      async run<R>(work: (tx: Transaction) => Promise<R>): Promise<R> {
        try { return await prisma.$transaction(work); }
        catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) throw new DraftCreationConflict();
          throw error;
        }
      },
    },
  };
}
