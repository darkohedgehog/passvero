import type { PublishProductPersistence } from "@/src/application/products/publish-product/ports";
import { Prisma, type PrismaClient } from "@/src/generated/prisma/client";

export type PublishProductPrismaTransaction = Prisma.TransactionClient;

export class PrismaPublishProductTransactionRunner {
  constructor(private readonly prisma: PrismaClient) {}
  run<Result>(work: (transaction: PublishProductPrismaTransaction) => Promise<Result>): Promise<Result> {
    return this.prisma.$transaction((transaction) => work(transaction));
  }
}

export class PrismaPublishProductPersistence implements PublishProductPersistence<PublishProductPrismaTransaction> {
  constructor(private readonly prisma: PrismaClient) {}

  async readEligibility(tx: PublishProductPrismaTransaction, input: { organizationId: string; userId: string; membershipId: string }) {
    const membership = await tx.membership.findFirst({ where: { id: input.membershipId, userId: input.userId, organizationId: input.organizationId }, select: { status: true, role: true, organization: { select: { status: true } } } });
    return membership === null ? null : { organizationStatus: membership.organization.status, membershipStatus: membership.status, membershipRole: membership.role };
  }

  async readProductForPublication(tx: PublishProductPrismaTransaction, input: { productId: string; organizationId: string }) {
    const [row] = await tx.$queryRaw<Array<{ id: string; organizationId: string; lifecycleStatus: "ACTIVE" | "ARCHIVED"; publicCode: string; currentDraftVersionId: string | null; currentPublishedVersionId: string | null; updatedAt: Date }>>(Prisma.sql`
      SELECT "id", "organizationId", "lifecycleStatus", "publicCode", "currentDraftVersionId", "currentPublishedVersionId", "updatedAt"
      FROM "Product"
      WHERE "id" = ${input.productId}::uuid AND "organizationId" = ${input.organizationId}::uuid
      FOR UPDATE
    `);
    return row === undefined ? null : { ...row, productId: row.id };
  }

  async readVersion(tx: PublishProductPrismaTransaction, input: { productVersionId: string; productId: string; organizationId: string }) {
    const row = await tx.productVersion.findFirst({ where: { id: input.productVersionId, productId: input.productId, organizationId: input.organizationId }, select: { id: true, productId: true, organizationId: true, status: true, sourceLocale: true, versionNumber: true, updatedAt: true, reviewReadyAt: true, publishedAt: true, publishedById: true, supersededAt: true, discardedAt: true } });
    return row === null ? null : { ...row, productVersionId: row.id };
  }

  async readReadiness(tx: PublishProductPrismaTransaction, input: { productVersionId: string; organizationId: string; sourceLocale: string; currentUtcYear: number }) {
    const [translation, unavailableDocument, unavailableImage, materials, cnRows] = await Promise.all([
      tx.productTranslation.findUnique({ where: { productVersionId_locale: { productVersionId: input.productVersionId, locale: input.sourceLocale } }, select: { productName: true } }),
      tx.productDocument.findFirst({ where: { productVersionId: input.productVersionId, isPublic: true, OR: [{ document: { organizationId: { not: input.organizationId } } }, { document: { status: { not: "AVAILABLE" } } }] }, select: { id: true } }),
      tx.productImage.findFirst({ where: { productVersionId: input.productVersionId, isPublic: true, uploadedAt: null }, select: { id: true } }),
      tx.productMaterial.findMany({ where: { productVersionId: input.productVersionId }, select: { materialName: true, category: true, percentage: true, isRecycled: true, recycledPercentage: true } }),
      tx.productIdentifier.findMany({ where: { productVersionId: input.productVersionId, type: "CN" }, select: { type: true, value: true, nomenclatureYear: true, issuingAuthority: true, notes: true } }),
    ]);
    return {
      sourceTranslationExists: translation !== null,
      sourceProductName: translation?.productName ?? null,
      unavailablePublicAsset: unavailableDocument !== null || unavailableImage !== null,
      invalidAuthoredAggregate: !validMaterials(materials) || !validCnRows(cnRows, input.currentUtcYear),
    };
  }

  async readPassport(tx: PublishProductPrismaTransaction, input: { productId: string; organizationId: string }) {
    const row = await tx.passport.findUnique({ where: { productId: input.productId }, select: { id: true, productId: true, organizationId: true, status: true, qrCode: { select: { id: true, code: true, targetUrl: true, status: true } } } });
    return row === null ? null : { passportId: row.id, productId: row.productId, organizationId: row.organizationId, status: row.status, qrCode: row.qrCode === null ? null : { qrCodeId: row.qrCode.id, code: row.qrCode.code, targetUrl: row.qrCode.targetUrl, status: row.qrCode.status } };
  }

  async nextVersionNumber(tx: PublishProductPrismaTransaction, input: { productId: string; organizationId: string }) {
    const result = await tx.productVersion.aggregate({ where: { productId: input.productId, organizationId: input.organizationId }, _max: { versionNumber: true } });
    return (result._max.versionNumber ?? 0) + 1;
  }

  async applyPublication(tx: PublishProductPrismaTransaction, input: Parameters<PublishProductPersistence<PublishProductPrismaTransaction>["applyPublication"]>[1]) {
    if (input.previousPublishedVersionId !== null) {
      const previous = await tx.productVersion.updateMany({ where: { id: input.previousPublishedVersionId, productId: input.productId, organizationId: input.organizationId, status: "PUBLISHED", supersededAt: null }, data: { status: "SUPERSEDED", supersededAt: input.publishedAt, updatedById: input.actorId } });
      if (previous.count !== 1) throw new Error("Previous publication invariant failed.");
    }
    const draft = await tx.productVersion.updateMany({ where: { id: input.draftVersionId, productId: input.productId, organizationId: input.organizationId, status: { in: ["DRAFT", "READY_FOR_REVIEW"] }, versionNumber: null, publishedAt: null, supersededAt: null, discardedAt: null, updatedAt: input.expectedDraftUpdatedAt }, data: { status: "PUBLISHED", versionNumber: input.versionNumber, publishedAt: input.publishedAt, publishedById: input.actorId, updatedById: input.actorId } });
    if (draft.count !== 1) throw new Error("Draft publication invariant failed.");
    const product = await tx.product.updateMany({ where: { id: input.productId, organizationId: input.organizationId, lifecycleStatus: "ACTIVE", currentDraftVersionId: input.draftVersionId, currentPublishedVersionId: input.expectedCurrentPublishedVersionId, updatedAt: input.expectedProductUpdatedAt }, data: { currentDraftVersionId: null, currentPublishedVersionId: input.draftVersionId, lastPublishedAt: input.publishedAt, updatedById: input.actorId } });
    if (product.count !== 1) return "STALE" as const;

    let passportId: string;
    if (input.passport === null) {
      const passport = await tx.passport.create({ data: { productId: input.productId, organizationId: input.organizationId, status: "ACTIVE", defaultLocale: input.sourceLocale, firstPublishedAt: input.publishedAt, lastPublishedAt: input.publishedAt }, select: { id: true } });
      passportId = passport.id;
    } else {
      passportId = input.passport.passportId;
      const passport = await tx.passport.updateMany({ where: { id: passportId, productId: input.productId, organizationId: input.organizationId, status: "ACTIVE" }, data: { lastPublishedAt: input.publishedAt } });
      if (passport.count !== 1) throw new Error("Passport publication invariant failed.");
    }
    if (input.qrCode !== null) {
      await tx.qRCode.create({ data: { passportId, code: input.qrCode, targetUrl: input.qrTargetUrl, status: "PENDING", generatedAt: input.publishedAt, activatedAt: null, revokedAt: null }, select: { id: true } });
    }
    await tx.auditLog.create({ data: { organizationId: input.organizationId, actorId: input.actorId, action: "VERSION_PUBLISHED", entityType: "PRODUCT", entityId: input.productId, summary: "Product version published.", metadata: { versionNumber: input.versionNumber, previousVersionSuperseded: input.previousPublishedVersionId !== null }, correlationId: input.correlationId, occurredAt: input.publishedAt }, select: { id: true } });
    return "APPLIED" as const;
  }
}

function validMaterials(materials: readonly { materialName: string; category: string | null; percentage: { toString(): string } | string | null; isRecycled: boolean; recycledPercentage: { toString(): string } | string | null }[]): boolean {
  let total = BigInt(0);
  for (const material of materials) {
    if (!canonicalText(material.materialName, 200) || (material.category !== null && !canonicalText(material.category, 100))) return false;
    const percentage = hundredths(material.percentage);
    const recycledPercentage = hundredths(material.recycledPercentage);
    if (percentage === null || recycledPercentage === null || (!material.isRecycled && material.recycledPercentage !== null)) return false;
    total += percentage;
  }
  return total <= BigInt(10_000);
}

function validCnRows(rows: readonly { type: string; value: string; nomenclatureYear: number | null; issuingAuthority: string | null; notes: string | null }[], currentUtcYear: number): boolean {
  return rows.length <= 1 && rows.every((row) => row.type === "CN" && /^[0-9]{8}$/.test(row.value) && row.nomenclatureYear !== null && Number.isInteger(row.nomenclatureYear) && row.nomenclatureYear >= 1988 && row.nomenclatureYear <= currentUtcYear && row.issuingAuthority === null && row.notes === null);
}

function canonicalText(value: string, maximum: number): boolean {
  return value === value.trim() && Array.from(value).length >= 1 && Array.from(value).length <= maximum;
}

function hundredths(value: { toString(): string } | string | null): bigint | null {
  if (value === null) return BigInt(0);
  const match = /^(0|[1-9]\d?|100)(?:\.(\d{1,2}))?$/.exec(value.toString());
  if (match === null) return null;
  return BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? "").padEnd(2, "0"));
}
