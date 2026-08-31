import type {
  EditProductDraftPersistence,
  EditProductDraftTransactionRunner,
  GetProductDraftForEditPersistence,
  ProductDraftEditVersionRecord,
} from "@/src/application/products/edit-product-draft/ports";
import {
  Prisma,
  type PrismaClient,
} from "@/src/generated/prisma/client";
import {
  translatePrismaEditProductDraftError,
  type EditProductDraftPrismaOperation,
} from "@/src/infrastructure/persistence/prisma/prisma-edit-product-draft-errors";

export type EditProductDraftPrismaTransaction = Prisma.TransactionClient;

const translationProjection = {
  productVersionId: true,
  locale: true,
  productName: true,
  updatedAt: true,
} as const;

const versionProjection = {
  id: true,
  productId: true,
  organizationId: true,
  status: true,
  sourceLocale: true,
  updatedAt: true,
} as const;

const productProjection = {
  id: true,
  organizationId: true,
  internalName: true,
  sku: true,
  normalizedSku: true,
  lifecycleStatus: true,
  currentDraftVersionId: true,
  updatedAt: true,
} as const;

const productLoaderProjection = {
  ...productProjection,
  currentDraftVersion: {
    select: {
      ...versionProjection,
      translations: { select: translationProjection },
    },
  },
} as const;

export class PrismaEditProductDraftTransactionRunner
implements EditProductDraftTransactionRunner<EditProductDraftPrismaTransaction> {
  constructor(private readonly prisma: PrismaClient) {}

  run<Result>(
    work: (transaction: EditProductDraftPrismaTransaction) => Promise<Result>,
  ): Promise<Result> {
    return this.prisma.$transaction((transaction) => work(transaction));
  }
}

export class PrismaEditProductDraftPersistence
implements
  GetProductDraftForEditPersistence,
  EditProductDraftPersistence<EditProductDraftPrismaTransaction> {
  constructor(private readonly prisma: PrismaClient) {}

  async findByIdAndOrganization(
    input: Parameters<GetProductDraftForEditPersistence["findByIdAndOrganization"]>[0],
  ) {
    try {
      const row = await this.prisma.product.findFirst({
        where: { id: input.productId, organizationId: input.organizationId },
        select: productLoaderProjection,
      });
      if (row === null) return null;

      const version = row.currentDraftVersion;
      const sourceTranslation = version?.translations.find((translation) =>
        translation.productVersionId === version.id
        && translation.locale === version.sourceLocale
      ) ?? null;

      return {
        productId: row.id,
        organizationId: row.organizationId,
        internalName: row.internalName,
        sku: row.sku,
        normalizedSku: row.normalizedSku,
        lifecycleStatus: row.lifecycleStatus,
        currentDraftVersionId: row.currentDraftVersionId,
        updatedAt: row.updatedAt,
        currentDraftVersion: version === null
          ? null
          : {
              productVersionId: version.id,
              productId: version.productId,
              organizationId: version.organizationId,
              status: version.status,
              sourceLocale: version.sourceLocale,
              updatedAt: version.updatedAt,
              sourceTranslation,
            },
      };
    } catch (error) {
      throw translatePrismaEditProductDraftError(error, "read");
    }
  }

  async readEligibility(
    transaction: EditProductDraftPrismaTransaction,
    input: Parameters<EditProductDraftPersistence<EditProductDraftPrismaTransaction>["readEligibility"]>[1],
  ) {
    return this.read("read", async () => {
      const membership = await transaction.membership.findFirst({
        where: {
          id: input.membershipId,
          organizationId: input.organizationId,
          userId: input.userId,
        },
        select: {
          role: true,
          status: true,
          organization: { select: { status: true } },
        },
      });
      return membership === null
        ? null
        : {
            organizationStatus: membership.organization.status,
            membershipStatus: membership.status,
            membershipRole: membership.role,
          };
    });
  }

  async readProduct(
    transaction: EditProductDraftPrismaTransaction,
    input: Parameters<EditProductDraftPersistence<EditProductDraftPrismaTransaction>["readProduct"]>[1],
  ) {
    return this.read("read", async () => {
      const row = await transaction.product.findFirst({
        where: { id: input.productId, organizationId: input.organizationId },
        select: productProjection,
      });
      return row === null
        ? null
        : {
            productId: row.id,
            organizationId: row.organizationId,
            internalName: row.internalName,
            sku: row.sku,
            normalizedSku: row.normalizedSku,
            lifecycleStatus: row.lifecycleStatus,
            currentDraftVersionId: row.currentDraftVersionId,
            updatedAt: row.updatedAt,
          };
    });
  }

  async readDraftVersion(
    transaction: EditProductDraftPrismaTransaction,
    input: Parameters<EditProductDraftPersistence<EditProductDraftPrismaTransaction>["readDraftVersion"]>[1],
  ) {
    return this.read("read", async () => {
      const row = await transaction.productVersion.findFirst({
        where: {
          id: input.productVersionId,
          productId: input.productId,
          organizationId: input.organizationId,
        },
        select: versionProjection,
      });
      return row === null ? null : mapVersion(row);
    });
  }

  async readSourceTranslation(
    transaction: EditProductDraftPrismaTransaction,
    input: Parameters<EditProductDraftPersistence<EditProductDraftPrismaTransaction>["readSourceTranslation"]>[1],
  ) {
    return this.read("read", async () => {
      const row = await transaction.productTranslation.findFirst({
        where: {
          productVersionId: input.productVersionId,
          locale: input.locale,
        },
        select: translationProjection,
      });
      return row;
    });
  }

  async updateProductIfCurrent(
    transaction: EditProductDraftPrismaTransaction,
    input: Parameters<EditProductDraftPersistence<EditProductDraftPrismaTransaction>["updateProductIfCurrent"]>[1],
  ): Promise<boolean> {
    return this.update("updateProduct", async () => {
      const result = await transaction.product.updateMany({
        where: {
          id: input.productId,
          organizationId: input.organizationId,
          lifecycleStatus: "ACTIVE",
          currentDraftVersionId: input.currentDraftVersionId,
          updatedAt: input.expectedUpdatedAt,
        },
        data: {
          internalName: input.internalName,
          sku: input.sku,
          normalizedSku: input.normalizedSku,
          updatedById: input.actorId,
        },
      });
      return result.count === 1;
    });
  }

  async touchDraftVersionIfCurrent(
    transaction: EditProductDraftPrismaTransaction,
    input: Parameters<EditProductDraftPersistence<EditProductDraftPrismaTransaction>["touchDraftVersionIfCurrent"]>[1],
  ): Promise<boolean> {
    return this.update("updateDraft", async () => {
      const result = await transaction.productVersion.updateMany({
        where: {
          id: input.productVersionId,
          productId: input.productId,
          organizationId: input.organizationId,
          status: { in: ["DRAFT", "READY_FOR_REVIEW"] },
          updatedAt: input.expectedUpdatedAt,
        },
        data: { updatedById: input.actorId },
      });
      return result.count === 1;
    });
  }

  async updateSourceTranslationIfCurrent(
    transaction: EditProductDraftPrismaTransaction,
    input: Parameters<EditProductDraftPersistence<EditProductDraftPrismaTransaction>["updateSourceTranslationIfCurrent"]>[1],
  ): Promise<boolean> {
    return this.update("updateTranslation", async () => {
      const result = await transaction.productTranslation.updateMany({
        where: {
          productVersionId: input.productVersionId,
          locale: input.locale,
          updatedAt: input.expectedUpdatedAt,
        },
        data: { productName: input.productName },
      });
      return result.count === 1;
    });
  }

  async insertProductUpdatedAuditEvent(
    transaction: EditProductDraftPrismaTransaction,
    input: Parameters<EditProductDraftPersistence<EditProductDraftPrismaTransaction>["insertProductUpdatedAuditEvent"]>[1],
  ): Promise<void> {
    await this.update("insertAudit", async () => {
      await transaction.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorId: input.actorId,
          action: "PRODUCT_UPDATED",
          entityType: "PRODUCT",
          entityId: input.productId,
          summary: "Product updated.",
          metadata: { changedFields: [...input.changedFields] },
          correlationId: input.correlationId,
        },
        select: { id: true },
      });
    });
  }

  private async read<Result>(
    operation: EditProductDraftPrismaOperation,
    work: () => Promise<Result>,
  ): Promise<Result> {
    try {
      return await work();
    } catch (error) {
      throw translatePrismaEditProductDraftError(error, operation);
    }
  }

  private async update<Result>(
    operation: EditProductDraftPrismaOperation,
    work: () => Promise<Result>,
  ): Promise<Result> {
    return this.read(operation, work);
  }
}

function mapVersion(version: {
  readonly id: string;
  readonly productId: string;
  readonly organizationId: string;
  readonly status: ProductDraftEditVersionRecord["status"];
  readonly sourceLocale: string;
  readonly updatedAt: Date;
}): Omit<ProductDraftEditVersionRecord, "sourceTranslation"> {
  return {
    productVersionId: version.id,
    productId: version.productId,
    organizationId: version.organizationId,
    status: version.status,
    sourceLocale: version.sourceLocale,
    updatedAt: version.updatedAt,
  };
}
