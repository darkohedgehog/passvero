import type {
  ProductMaterialRecord,
  ProductMaterialsCurrentDraftPersistence,
} from "@/src/application/products/product-materials-current-draft/ports";
import { ProductMaterialsCurrentDraftPersistenceError } from "@/src/application/products/product-materials-current-draft/ports";
import { Prisma, type PrismaClient } from "@/src/generated/prisma/client";

type Transaction = Prisma.TransactionClient;

const materialProjection = {
  id: true,
  productVersionId: true,
  materialName: true,
  category: true,
  percentage: true,
  isRecycled: true,
  recycledPercentage: true,
  createdAt: true,
  updatedAt: true,
} as const;

const versionProjection = {
  id: true,
  productId: true,
  organizationId: true,
  status: true,
  updatedAt: true,
} as const;

const productProjection = {
  id: true,
  organizationId: true,
  lifecycleStatus: true,
  currentDraftVersionId: true,
  updatedAt: true,
} as const;

export class PrismaProductMaterialsCurrentDraftTransactionRunner {
  constructor(private readonly prisma: PrismaClient) {}

  run<Result>(work: (transaction: Transaction) => Promise<Result>): Promise<Result> {
    return this.prisma.$transaction((transaction) => work(transaction));
  }
}

export class PrismaProductMaterialsCurrentDraftPersistence
implements ProductMaterialsCurrentDraftPersistence<Transaction> {
  constructor(private readonly prisma: PrismaClient) {}

  async findCurrentDraftByProductAndOrganization(input: {
    readonly productId: string;
    readonly organizationId: string;
  }) {
    return this.safe(async () => {
      const row = await this.prisma.product.findFirst({
        where: { id: input.productId, organizationId: input.organizationId },
        select: {
          ...productProjection,
          currentDraftVersion: {
            select: {
              ...versionProjection,
              materials: {
                select: materialProjection,
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              },
            },
          },
        },
      });
      if (row === null) return null;
      return {
        productId: row.id,
        organizationId: row.organizationId,
        lifecycleStatus: row.lifecycleStatus,
        currentDraftVersionId: row.currentDraftVersionId,
        updatedAt: row.updatedAt,
        currentDraftVersion: row.currentDraftVersion === null ? null : {
          productVersionId: row.currentDraftVersion.id,
          productId: row.currentDraftVersion.productId,
          organizationId: row.currentDraftVersion.organizationId,
          status: row.currentDraftVersion.status,
          updatedAt: row.currentDraftVersion.updatedAt,
          materials: row.currentDraftVersion.materials.map(mapMaterial),
        },
      };
    });
  }

  async readEligibility(transaction: Transaction, input: {
    readonly organizationId: string;
    readonly userId: string;
    readonly membershipId: string;
  }) {
    return this.safe(async () => {
      const row = await transaction.membership.findFirst({
        where: { id: input.membershipId, organizationId: input.organizationId, userId: input.userId },
        select: { role: true, status: true, organization: { select: { status: true } } },
      });
      return row === null ? null : {
        organizationStatus: row.organization.status,
        membershipStatus: row.status,
        membershipRole: row.role,
      };
    });
  }

  async readProduct(transaction: Transaction, input: { readonly productId: string; readonly organizationId: string }) {
    return this.safe(async () => {
      const row = await transaction.product.findFirst({
        where: { id: input.productId, organizationId: input.organizationId },
        select: productProjection,
      });
      return row === null ? null : {
        productId: row.id,
        organizationId: row.organizationId,
        lifecycleStatus: row.lifecycleStatus,
        currentDraftVersionId: row.currentDraftVersionId,
        updatedAt: row.updatedAt,
      };
    });
  }

  async readDraftVersion(transaction: Transaction, input: {
    readonly productVersionId: string;
    readonly productId: string;
    readonly organizationId: string;
  }) {
    return this.safe(async () => {
      const row = await transaction.productVersion.findFirst({
        where: { id: input.productVersionId, productId: input.productId, organizationId: input.organizationId },
        select: versionProjection,
      });
      return row === null ? null : {
        productVersionId: row.id,
        productId: row.productId,
        organizationId: row.organizationId,
        status: row.status,
        updatedAt: row.updatedAt,
      };
    });
  }

  async readMaterial(transaction: Transaction, input: { readonly materialId: string; readonly productVersionId: string }) {
    return this.safe(async () => {
      const row = await transaction.productMaterial.findFirst({
        where: { id: input.materialId, productVersionId: input.productVersionId },
        select: materialProjection,
      });
      return row === null ? null : mapMaterial(row);
    });
  }

  async readMaterials(transaction: Transaction, input: { readonly productVersionId: string }) {
    return this.safe(async () => {
      const rows = await transaction.productMaterial.findMany({
        where: { productVersionId: input.productVersionId },
        select: materialProjection,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      return rows.map(mapMaterial);
    });
  }

  async touchProductIfCurrent(transaction: Transaction, input: {
    readonly productId: string;
    readonly organizationId: string;
    readonly currentDraftVersionId: string;
    readonly expectedUpdatedAt: Date;
    readonly actorId: string;
  }): Promise<boolean> {
    return this.safe(async () => (await transaction.product.updateMany({
      where: {
        id: input.productId,
        organizationId: input.organizationId,
        lifecycleStatus: "ACTIVE",
        currentDraftVersionId: input.currentDraftVersionId,
        updatedAt: input.expectedUpdatedAt,
      },
      data: { updatedById: input.actorId },
    })).count === 1);
  }

  async touchDraftVersionIfCurrent(transaction: Transaction, input: {
    readonly productVersionId: string;
    readonly productId: string;
    readonly organizationId: string;
    readonly expectedUpdatedAt: Date;
    readonly actorId: string;
  }): Promise<boolean> {
    return this.safe(async () => (await transaction.productVersion.updateMany({
      where: {
        id: input.productVersionId,
        productId: input.productId,
        organizationId: input.organizationId,
        status: { in: ["DRAFT", "READY_FOR_REVIEW"] },
        updatedAt: input.expectedUpdatedAt,
      },
      data: { updatedById: input.actorId },
    })).count === 1);
  }

  async insertMaterial(transaction: Transaction, input: Parameters<ProductMaterialsCurrentDraftPersistence<Transaction>["insertMaterial"]>[1]) {
    return this.safe(async () => {
      const row = await transaction.productMaterial.create({
        data: { productVersionId: input.productVersionId, ...input.values },
        select: { id: true },
      });
      return { materialId: row.id };
    });
  }

  async updateMaterialIfCurrent(transaction: Transaction, input: Parameters<ProductMaterialsCurrentDraftPersistence<Transaction>["updateMaterialIfCurrent"]>[1]): Promise<boolean> {
    return this.safe(async () => (await transaction.productMaterial.updateMany({
      where: {
        id: input.materialId,
        productVersionId: input.productVersionId,
        updatedAt: input.expectedUpdatedAt,
      },
      data: { ...input.values },
    })).count === 1);
  }

  async deleteMaterialIfCurrent(transaction: Transaction, input: Parameters<ProductMaterialsCurrentDraftPersistence<Transaction>["deleteMaterialIfCurrent"]>[1]): Promise<boolean> {
    return this.safe(async () => (await transaction.productMaterial.deleteMany({
      where: {
        id: input.materialId,
        productVersionId: input.productVersionId,
        updatedAt: input.expectedUpdatedAt,
      },
    })).count === 1);
  }

  async insertProductUpdatedAuditEvent(transaction: Transaction, input: Parameters<ProductMaterialsCurrentDraftPersistence<Transaction>["insertProductUpdatedAuditEvent"]>[1]): Promise<void> {
    await this.safe(async () => {
      await transaction.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorId: input.actorId,
          action: "PRODUCT_UPDATED",
          entityType: "PRODUCT",
          entityId: input.productId,
          summary: "Product updated.",
          metadata: {
            changedCollection: "materials",
            operation: input.operation,
            ...(input.changedFields === undefined ? {} : { changedFields: [...input.changedFields] }),
          },
          correlationId: input.correlationId,
        },
        select: { id: true },
      });
    });
  }

  private async safe<Result>(work: () => Promise<Result>): Promise<Result> {
    try {
      return await work();
    } catch {
      throw new ProductMaterialsCurrentDraftPersistenceError();
    }
  }
}

function mapMaterial(row: {
  readonly id: string;
  readonly productVersionId: string;
  readonly materialName: string;
  readonly category: string | null;
  readonly percentage: unknown;
  readonly isRecycled: boolean;
  readonly recycledPercentage: unknown;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}): ProductMaterialRecord {
  return {
    materialId: row.id,
    productVersionId: row.productVersionId,
    materialName: row.materialName,
    category: row.category,
    percentage: decimalString(row.percentage),
    isRecycled: row.isRecycled,
    recycledPercentage: decimalString(row.recycledPercentage),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function decimalString(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toFixed" in value && typeof value.toFixed === "function") {
    return (value.toFixed as (places: number) => string)(2);
  }
  throw new ProductMaterialsCurrentDraftPersistenceError();
}
