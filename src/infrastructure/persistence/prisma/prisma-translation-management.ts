import { Prisma, type PrismaClient } from "@/src/generated/prisma/client";
import { PrismaDraftTranslationContentPersistence } from "./prisma-draft-translation-content";
import { TranslationConflict, type TranslationDependencies, type TranslationPersistence } from "@/src/application/products/translation-management/contracts";

type Tx = Prisma.TransactionClient;
export const translationSelect = { id: true, productVersionId: true, locale: true, updatedAt: true,
  productName: true, shortDescription: true, description: true, technicalDescription: true,
  repairInstructions: true, sparePartsInformation: true, recyclingInstructions: true,
  disposalInstructions: true, packagingInformation: true, safetyInformation: true,
  warrantyInformation: true, publicNotes: true } as const;
const versionSelect = { id: true, productId: true, organizationId: true, sourceLocale: true, status: true, updatedAt: true,
  translations: { select: translationSelect, orderBy: { locale: "asc" } } } as const;

export class PrismaTranslationManagementPersistence implements TranslationPersistence<Tx> {
  private readonly existing: PrismaDraftTranslationContentPersistence;
  constructor(prisma: PrismaClient) { this.existing = new PrismaDraftTranslationContentPersistence(prisma); }
  readEligibility(tx: Tx, input: Parameters<TranslationPersistence<Tx>["readEligibility"]>[1]) { return this.existing.readEligibility(tx,input); }
  async readState(tx: Tx, input: Parameters<TranslationPersistence<Tx>["readState"]>[1]) {
    if (input.lock) {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Product" WHERE "id"=${input.productId}::uuid AND "organizationId"=${input.organizationId}::uuid FOR UPDATE`);
    }
    const product = await tx.product.findFirst({ where: { id: input.productId, organizationId: input.organizationId }, select: {
      id: true, organizationId: true, lifecycleStatus: true, currentDraftVersionId: true, currentPublishedVersionId: true, updatedAt: true,
      currentDraftVersion: { select: versionSelect }, currentPublishedVersion: { select: versionSelect },
    } });
    if (!product) return null;
    const map = (v: typeof product.currentDraftVersion) => v === null ? null : ({ productVersionId: v.id, productId: v.productId, organizationId: v.organizationId, sourceLocale: v.sourceLocale, status: v.status, updatedAt: v.updatedAt, translations: v.translations });
    return { productId: product.id, organizationId: product.organizationId, lifecycleStatus: product.lifecycleStatus,
      currentDraftVersionId: product.currentDraftVersionId, currentPublishedVersionId: product.currentPublishedVersionId,
      updatedAt: product.updatedAt, draft: map(product.currentDraftVersion), published: map(product.currentPublishedVersion) };
  }
  async touch(tx: Tx, input: Parameters<TranslationPersistence<Tx>["touch"]>[1]) {
    // Strictly increasing evidence even when two writes share the same millisecond.
    const updatedAt = new Date(Math.max(Date.now(), input.productAt.getTime()+1, input.draftAt.getTime()+1));
    const product = await tx.product.updateMany({ where: { id: input.productId, organizationId: input.organizationId, lifecycleStatus: "ACTIVE", currentDraftVersionId: input.draftId, updatedAt: input.productAt }, data: { updatedAt, updatedById: input.actorId } });
    if (product.count !== 1) return false;
    const draft = await tx.productVersion.updateMany({ where: { id: input.draftId, productId: input.productId, organizationId: input.organizationId, status: { in: ["DRAFT","READY_FOR_REVIEW"] }, updatedAt: input.draftAt }, data: { updatedAt, updatedById: input.actorId } });
    return draft.count === 1;
  }
  async add(tx: Tx, input: Parameters<TranslationPersistence<Tx>["add"]>[1]) {
    try { await tx.productTranslation.create({ data: { productVersionId: input.draftId, locale: input.locale, ...input.content }, select: { id: true } }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new TranslationConflict(); throw error; }
  }
  async edit(tx: Tx, input: Parameters<TranslationPersistence<Tx>["edit"]>[1]) {
    return (await tx.productTranslation.updateMany({ where: { id: input.translationId, productVersionId: input.draftId, locale: input.locale, updatedAt: input.expectedAt }, data: { ...input.content, updatedAt: new Date(Math.max(Date.now(), input.expectedAt.getTime()+1)) } })).count === 1;
  }
  async remove(tx: Tx, input: Parameters<TranslationPersistence<Tx>["remove"]>[1]) {
    return (await tx.productTranslation.deleteMany({ where: { id: input.translationId, productVersionId: input.draftId, locale: input.locale, updatedAt: input.expectedAt } })).count === 1;
  }
  async audit(tx: Tx, input: Parameters<TranslationPersistence<Tx>["audit"]>[1]) {
    await tx.auditLog.create({ data: { organizationId: input.organizationId, actorId: input.actorId, action: "PRODUCT_UPDATED", entityType: "PRODUCT", entityId: input.productId,
      summary: "Product updated.", metadata: { operation: `TRANSLATION_${input.operation}`, locale: input.locale }, correlationId: input.correlationId }, select: { id: true } });
  }
}
export function createPrismaTranslationManagementDependencies(prisma: PrismaClient): TranslationDependencies<Tx> {
  return { persistence: new PrismaTranslationManagementPersistence(prisma), transactionRunner: { run: work => prisma.$transaction(tx => work(tx)) } };
}
