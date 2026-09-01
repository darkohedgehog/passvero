import type { DraftTranslationContentPersistence, GetDraftTranslationContentPersistence } from "@/src/application/products/draft-translation-content/ports";
import { DRAFT_TRANSLATION_CONTENT_FIELDS } from "@/src/application/products/draft-translation-content/contracts";
import { DraftTranslationContentPersistenceError } from "@/src/application/products/draft-translation-content/ports";
import { Prisma, type PrismaClient } from "@/src/generated/prisma/client";

type Tx = Prisma.TransactionClient;
const productSelect = { id: true, organizationId: true, lifecycleStatus: true, currentDraftVersionId: true, updatedAt: true } as const;
const versionSelect = { id: true, productId: true, organizationId: true, status: true, sourceLocale: true, updatedAt: true } as const;
const translationSelect = { productVersionId: true, locale: true, shortDescription: true, description: true, technicalDescription: true, repairInstructions: true, sparePartsInformation: true, recyclingInstructions: true, disposalInstructions: true, packagingInformation: true, safetyInformation: true, updatedAt: true } as const;

export class PrismaDraftTranslationContentTransactionRunner {
  constructor(private readonly prisma: PrismaClient) {}
  run<Result>(work: (transaction: Tx) => Promise<Result>) { return this.prisma.$transaction((transaction) => work(transaction)); }
}

export class PrismaDraftTranslationContentPersistence implements GetDraftTranslationContentPersistence, DraftTranslationContentPersistence<Tx> {
  constructor(private readonly prisma: PrismaClient) {}
  async findByIdAndOrganization(input: { productId: string; organizationId: string }) {
    return this.safe(async () => {
      const product = await this.prisma.product.findFirst({ where: { id: input.productId, organizationId: input.organizationId }, select: productSelect });
      if (product === null) return null;
      const version = product.currentDraftVersionId === null ? null : await this.prisma.productVersion.findFirst({ where: { id: product.currentDraftVersionId, productId: product.id, organizationId: product.organizationId }, select: versionSelect });
      const translation = version === null ? null : await this.prisma.productTranslation.findFirst({ where: { productVersionId: version.id, locale: version.sourceLocale }, select: translationSelect });
      return { productId: product.id, organizationId: product.organizationId, lifecycleStatus: product.lifecycleStatus, currentDraftVersionId: product.currentDraftVersionId, updatedAt: product.updatedAt, currentDraftVersion: version === null ? null : { productVersionId: version.id, productId: version.productId, organizationId: version.organizationId, status: version.status, sourceLocale: version.sourceLocale, updatedAt: version.updatedAt, sourceTranslation: translation } };
    });
  }
  async readEligibility(tx: Tx, input: { organizationId: string; userId: string; membershipId: string }) { return this.safe(async () => { const row = await tx.membership.findFirst({ where: { id: input.membershipId, organizationId: input.organizationId, userId: input.userId }, select: { role: true, status: true, organization: { select: { status: true } } } }); return row === null ? null : { organizationStatus: row.organization.status, membershipStatus: row.status, membershipRole: row.role }; }); }
  async readProduct(tx: Tx, input: { productId: string; organizationId: string }) { return this.safe(async () => { const row = await tx.product.findFirst({ where: { id: input.productId, organizationId: input.organizationId }, select: productSelect }); return row === null ? null : { productId: row.id, organizationId: row.organizationId, lifecycleStatus: row.lifecycleStatus, currentDraftVersionId: row.currentDraftVersionId, updatedAt: row.updatedAt }; }); }
  async readDraftVersion(tx: Tx, input: { productVersionId: string; productId: string; organizationId: string }) { return this.safe(async () => { const row = await tx.productVersion.findFirst({ where: { id: input.productVersionId, productId: input.productId, organizationId: input.organizationId }, select: versionSelect }); return row === null ? null : { productVersionId: row.id, productId: row.productId, organizationId: row.organizationId, status: row.status, sourceLocale: row.sourceLocale, updatedAt: row.updatedAt }; }); }
  async readSourceTranslation(tx: Tx, input: { productVersionId: string; locale: string }) { return this.safe(() => tx.productTranslation.findFirst({ where: input, select: translationSelect })); }
  async touchProductIfCurrent(tx: Tx, input: { productId: string; organizationId: string; currentDraftVersionId: string; expectedUpdatedAt: Date; actorId: string }) { return this.safe(async () => (await tx.product.updateMany({ where: { id: input.productId, organizationId: input.organizationId, lifecycleStatus: "ACTIVE", currentDraftVersionId: input.currentDraftVersionId, updatedAt: input.expectedUpdatedAt }, data: { updatedById: input.actorId } })).count === 1); }
  async touchDraftVersionIfCurrent(tx: Tx, input: { productVersionId: string; productId: string; organizationId: string; expectedUpdatedAt: Date; actorId: string }) { return this.safe(async () => (await tx.productVersion.updateMany({ where: { id: input.productVersionId, productId: input.productId, organizationId: input.organizationId, status: { in: ["DRAFT", "READY_FOR_REVIEW"] }, updatedAt: input.expectedUpdatedAt }, data: { updatedById: input.actorId } })).count === 1); }
  async updateSourceTranslationIfCurrent(tx: Tx, input: Parameters<DraftTranslationContentPersistence<Tx>["updateSourceTranslationIfCurrent"]>[1]) { return this.safe(async () => (await tx.productTranslation.updateMany({ where: { productVersionId: input.productVersionId, locale: input.locale, updatedAt: input.expectedUpdatedAt }, data: { ...input.values } })).count === 1); }
  async insertProductUpdatedAuditEvent(tx: Tx, input: Parameters<DraftTranslationContentPersistence<Tx>["insertProductUpdatedAuditEvent"]>[1]) { await this.safe(async () => { await tx.auditLog.create({ data: { organizationId: input.organizationId, actorId: input.actorId, action: "PRODUCT_UPDATED", entityType: "PRODUCT", entityId: input.productId, summary: "Product updated.", metadata: { changedFields: [...input.changedFields] }, correlationId: input.correlationId }, select: { id: true } }); }); }
  private async safe<Result>(work: () => Promise<Result>): Promise<Result> { try { return await work(); } catch { throw new DraftTranslationContentPersistenceError("UNKNOWN"); } }
}

void DRAFT_TRANSLATION_CONTENT_FIELDS;
