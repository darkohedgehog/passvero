import type { CnClassificationRecord, CnClassificationCurrentDraftPersistence } from "@/src/application/products/cn-classification-current-draft/ports";
import { CnClassificationConflictPersistenceError, CnClassificationCurrentDraftPersistenceError } from "@/src/application/products/cn-classification-current-draft/ports";
import { Prisma, type PrismaClient } from "@/src/generated/prisma/client";

type Transaction = Prisma.TransactionClient;

const identifierProjection = {
  id: true,
  productVersionId: true,
  type: true,
  value: true,
  nomenclatureYear: true,
  createdAt: true,
  updatedAt: true,
} as const;
const versionProjection = { id: true, productId: true, organizationId: true, status: true, updatedAt: true } as const;
const productProjection = { id: true, organizationId: true, lifecycleStatus: true, currentDraftVersionId: true, updatedAt: true } as const;

export class PrismaCnClassificationCurrentDraftTransactionRunner {
  constructor(private readonly prisma: PrismaClient) {}
  run<Result>(work: (transaction: Transaction) => Promise<Result>): Promise<Result> {
    return this.prisma.$transaction((transaction) => work(transaction));
  }
}

export class PrismaCnClassificationCurrentDraftPersistence
implements CnClassificationCurrentDraftPersistence<Transaction> {
  constructor(private readonly prisma: PrismaClient) {}

  async findCurrentDraftByProductAndOrganization(input: { readonly productId: string; readonly organizationId: string }) {
    return this.safe(async () => {
      const row = await this.prisma.product.findFirst({
        where: { id: input.productId, organizationId: input.organizationId },
        select: {
          ...productProjection,
          currentDraftVersion: {
            select: {
              ...versionProjection,
              identifiers: { where: { type: "CN" }, select: identifierProjection, take: 2 },
            },
          },
        },
      });
      if (row === null) return null;
      if ((row.currentDraftVersion?.identifiers.length ?? 0) > 1) throw new CnClassificationCurrentDraftPersistenceError();
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
          cn: row.currentDraftVersion.identifiers[0] === undefined ? null : mapIdentifier(row.currentDraftVersion.identifiers[0]),
        },
      };
    });
  }

  async readEligibility(transaction: Transaction, input: { readonly organizationId: string; readonly userId: string; readonly membershipId: string }) {
    return this.safe(async () => {
      const row = await transaction.membership.findFirst({
        where: { id: input.membershipId, organizationId: input.organizationId, userId: input.userId },
        select: { role: true, status: true, organization: { select: { status: true } } },
      });
      return row === null ? null : { organizationStatus: row.organization.status, membershipStatus: row.status, membershipRole: row.role };
    });
  }

  async readProduct(transaction: Transaction, input: { readonly productId: string; readonly organizationId: string }) {
    return this.safe(async () => {
      const row = await transaction.product.findFirst({ where: { id: input.productId, organizationId: input.organizationId }, select: productProjection });
      return row === null ? null : { productId: row.id, organizationId: row.organizationId, lifecycleStatus: row.lifecycleStatus, currentDraftVersionId: row.currentDraftVersionId, updatedAt: row.updatedAt };
    });
  }

  async readDraftVersion(transaction: Transaction, input: { readonly productVersionId: string; readonly productId: string; readonly organizationId: string }) {
    return this.safe(async () => {
      const row = await transaction.productVersion.findFirst({ where: { id: input.productVersionId, productId: input.productId, organizationId: input.organizationId }, select: versionProjection });
      return row === null ? null : { productVersionId: row.id, productId: row.productId, organizationId: row.organizationId, status: row.status, updatedAt: row.updatedAt };
    });
  }

  async readCurrentDraftCn(transaction: Transaction, input: { readonly productVersionId: string; readonly identifierId?: string }) {
    return this.safe(async () => {
      const row = await transaction.productIdentifier.findFirst({
        where: { ...(input.identifierId === undefined ? {} : { id: input.identifierId }), productVersionId: input.productVersionId, type: "CN" },
        select: identifierProjection,
      });
      return row === null ? null : mapIdentifier(row);
    });
  }

  async touchProductIfCurrent(transaction: Transaction, input: { readonly productId: string; readonly organizationId: string; readonly currentDraftVersionId: string; readonly expectedUpdatedAt: Date; readonly actorId: string }): Promise<boolean> {
    return this.safe(async () => (await transaction.product.updateMany({
      where: { id: input.productId, organizationId: input.organizationId, lifecycleStatus: "ACTIVE", currentDraftVersionId: input.currentDraftVersionId, updatedAt: input.expectedUpdatedAt },
      data: { updatedById: input.actorId },
    })).count === 1);
  }

  async touchDraftVersionIfCurrent(transaction: Transaction, input: { readonly productVersionId: string; readonly productId: string; readonly organizationId: string; readonly expectedUpdatedAt: Date; readonly actorId: string }): Promise<boolean> {
    return this.safe(async () => (await transaction.productVersion.updateMany({
      where: { id: input.productVersionId, productId: input.productId, organizationId: input.organizationId, status: { in: ["DRAFT", "READY_FOR_REVIEW"] }, updatedAt: input.expectedUpdatedAt },
      data: { updatedById: input.actorId },
    })).count === 1);
  }

  async insertCn(transaction: Transaction, input: Parameters<CnClassificationCurrentDraftPersistence<Transaction>["insertCn"]>[1]) {
    try {
      const row = await transaction.productIdentifier.create({
        data: { productVersionId: input.productVersionId, type: "CN", ...input.values },
        select: { id: true },
      });
      return { identifierId: row.id };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new CnClassificationConflictPersistenceError();
      }
      throw new CnClassificationCurrentDraftPersistenceError();
    }
  }

  async updateCnIfCurrent(transaction: Transaction, input: Parameters<CnClassificationCurrentDraftPersistence<Transaction>["updateCnIfCurrent"]>[1]): Promise<boolean> {
    return this.safe(async () => (await transaction.productIdentifier.updateMany({
      where: { id: input.identifierId, productVersionId: input.productVersionId, type: "CN", updatedAt: input.expectedUpdatedAt },
      data: { type: "CN", ...input.values },
    })).count === 1);
  }

  async deleteCnIfCurrent(transaction: Transaction, input: Parameters<CnClassificationCurrentDraftPersistence<Transaction>["deleteCnIfCurrent"]>[1]): Promise<boolean> {
    return this.safe(async () => (await transaction.productIdentifier.deleteMany({
      where: { id: input.identifierId, productVersionId: input.productVersionId, type: "CN", updatedAt: input.expectedUpdatedAt },
    })).count === 1);
  }

  async insertProductUpdatedAuditEvent(transaction: Transaction, input: Parameters<CnClassificationCurrentDraftPersistence<Transaction>["insertProductUpdatedAuditEvent"]>[1]): Promise<void> {
    await this.safe(async () => {
      await transaction.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorId: input.actorId,
          action: "PRODUCT_UPDATED",
          entityType: "PRODUCT",
          entityId: input.productId,
          summary: "Product updated.",
          metadata: { changedCollection: "identifiers", operation: input.operation, identifierType: "CN", ...(input.changedFields === undefined ? {} : { changedFields: [...input.changedFields] }) },
          correlationId: input.correlationId,
        },
        select: { id: true },
      });
    });
  }

  private async safe<Result>(work: () => Promise<Result>): Promise<Result> {
    try { return await work(); } catch (error) {
      if (error instanceof CnClassificationCurrentDraftPersistenceError) throw error;
      throw new CnClassificationCurrentDraftPersistenceError();
    }
  }
}

function mapIdentifier(row: { readonly id: string; readonly productVersionId: string; readonly type: string; readonly value: string; readonly nomenclatureYear: number | null; readonly createdAt: Date; readonly updatedAt: Date }): CnClassificationRecord {
  if (row.type !== "CN" || row.nomenclatureYear === null) throw new CnClassificationCurrentDraftPersistenceError();
  return { identifierId: row.id, productVersionId: row.productVersionId, type: "CN", value: row.value, nomenclatureYear: row.nomenclatureYear, createdAt: row.createdAt, updatedAt: row.updatedAt };
}
