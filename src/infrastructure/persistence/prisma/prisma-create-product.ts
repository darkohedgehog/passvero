import type {
  CreateProductPersistence,
  CreatedProductIdentity,
  ProductCreationEligibility,
  TransactionRunner,
} from "@/src/application/products/create-product/ports";
import { CreateProductPersistenceError } from "@/src/application/products/create-product/ports";
import type { PassveroLocale } from "@/src/domain/values/passvero-locale";
import {
  Prisma,
  type PrismaClient,
} from "@/src/generated/prisma/client";
import {
  translatePrismaCreateProductError,
  type CreateProductPrismaOperation,
} from "@/src/infrastructure/persistence/prisma/prisma-create-product-errors";

export type CreateProductPrismaTransaction = Prisma.TransactionClient;

export class PrismaTransactionRunner
implements TransactionRunner<CreateProductPrismaTransaction> {
  constructor(private readonly prisma: PrismaClient) {}

  run<Result>(
    work: (transaction: CreateProductPrismaTransaction) => Promise<Result>,
  ): Promise<Result> {
    return this.prisma.$transaction((transaction) => work(transaction));
  }
}

export class PrismaCreateProductPersistence
implements CreateProductPersistence<CreateProductPrismaTransaction> {
  async readEligibility(
    transaction: CreateProductPrismaTransaction,
    input: {
      readonly organizationId: string;
      readonly userId: string;
      readonly membershipId: string;
    },
  ): Promise<ProductCreationEligibility | null> {
    try {
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

      if (membership === null) {
        return null;
      }

      return {
        organizationStatus: membership.organization.status,
        membershipStatus: membership.status,
        membershipRole: membership.role,
      };
    } catch (error) {
      throw translateUnclassifiedPrismaCreateProductError(error);
    }
  }

  async createProductIdentity(
    transaction: CreateProductPrismaTransaction,
    input: {
      readonly organizationId: string;
      readonly internalName: string;
      readonly sku: string | null;
      readonly normalizedSku: string | null;
      readonly publicCode: string;
      readonly actorId: string;
    },
  ): Promise<CreatedProductIdentity> {
    try {
      const product = await transaction.product.create({
        data: {
          organizationId: input.organizationId,
          internalName: input.internalName,
          sku: input.sku,
          normalizedSku: input.normalizedSku,
          publicCode: input.publicCode,
          lifecycleStatus: "ACTIVE",
          currentDraftVersionId: null,
          currentPublishedVersionId: null,
          createdById: input.actorId,
          updatedById: input.actorId,
          archivedById: null,
          archivedAt: null,
          lastPublishedAt: null,
        },
        select: { id: true, createdAt: true },
      });

      return {
        productId: product.id,
        createdAt: product.createdAt,
      };
    } catch (error) {
      throw translatePrismaPgCreateProductError(error, "createProductIdentity");
    }
  }

  async createInitialProductVersion(
    transaction: CreateProductPrismaTransaction,
    input: {
      readonly productId: string;
      readonly organizationId: string;
      readonly sourceLocale: PassveroLocale;
      readonly actorId: string;
    },
  ): Promise<{ readonly productVersionId: string }> {
    try {
      const product = await transaction.product.findFirst({
        where: {
          id: input.productId,
          organizationId: input.organizationId,
        },
        select: { id: true },
      });

      if (product === null) {
        throw new CreateProductPersistenceError("NOT_FOUND");
      }

      const productVersion = await transaction.productVersion.create({
        data: {
          productId: input.productId,
          organizationId: input.organizationId,
          status: "DRAFT",
          sourceLocale: input.sourceLocale,
          versionNumber: null,
          versionLabel: null,
          changeSummary: null,
          clonedFromVersionId: null,
          createdById: input.actorId,
          updatedById: input.actorId,
          publishedById: null,
          reviewReadyAt: null,
          publishedAt: null,
          supersededAt: null,
          discardedAt: null,
        },
        select: { id: true },
      });

      return { productVersionId: productVersion.id };
    } catch (error) {
      if (error instanceof CreateProductPersistenceError) {
        throw error;
      }

      throw translatePrismaPgCreateProductError(error, "createInitialProductVersion");
    }
  }

  async createInitialProductTranslation(
    transaction: CreateProductPrismaTransaction,
    input: {
      readonly productVersionId: string;
      readonly locale: PassveroLocale;
      readonly productName: string;
    },
  ): Promise<{ readonly productTranslationId: string }> {
    try {
      const translation = await transaction.productTranslation.create({
        data: {
          productVersionId: input.productVersionId,
          locale: input.locale,
          productName: input.productName,
        },
        select: { id: true },
      });

      return { productTranslationId: translation.id };
    } catch (error) {
      throw translateUnclassifiedPrismaCreateProductError(error);
    }
  }

  async assignCurrentDraftVersionIfUnset(
    transaction: CreateProductPrismaTransaction,
    input: {
      readonly productId: string;
      readonly organizationId: string;
      readonly productVersionId: string;
    },
  ): Promise<boolean> {
    try {
      const result = await transaction.product.updateMany({
        where: {
          id: input.productId,
          organizationId: input.organizationId,
          currentDraftVersionId: null,
          versions: {
            some: {
              id: input.productVersionId,
              organizationId: input.organizationId,
            },
          },
        },
        data: { currentDraftVersionId: input.productVersionId },
      });

      return result.count === 1;
    } catch (error) {
      throw translatePrismaPgCreateProductError(error, "assignCurrentDraft");
    }
  }

  async insertProductCreatedAuditEvent(
    transaction: CreateProductPrismaTransaction,
    input: {
      readonly organizationId: string;
      readonly actorId: string;
      readonly productId: string;
      readonly initialProductVersionId: string;
      readonly skuSupplied: boolean;
      readonly correlationId: string;
    },
  ): Promise<{ readonly auditLogId: string }> {
    try {
      const auditLog = await transaction.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorId: input.actorId,
          action: "PRODUCT_CREATED",
          entityType: "PRODUCT",
          entityId: input.productId,
          summary: "Product created.",
          metadata: {
            initialProductVersionId: input.initialProductVersionId,
            skuSupplied: input.skuSupplied,
          },
          correlationId: input.correlationId,
        },
        select: { id: true },
      });

      return { auditLogId: auditLog.id };
    } catch (error) {
      throw translatePrismaPgCreateProductError(error, "insertAudit");
    }
  }
}

function translatePrismaPgCreateProductError(
  error: unknown,
  operation: CreateProductPrismaOperation,
) {
  const directTranslation = translatePrismaCreateProductError(error, operation);

  if (directTranslation.kind !== "UNKNOWN") {
    return directTranslation;
  }

  const inspected = inspectPrismaPgUniqueConstraint(error);

  if (inspected === null) {
    return directTranslation;
  }

  const target = operation === "createInitialProductVersion"
    && inspected.modelName === "ProductVersion"
    && hasExactFields(inspected.fields, ["productId"])
    ? "ux_product_version_one_active_draft"
    : inspected.fields;

  return translatePrismaCreateProductError(
    { code: "P2002", meta: { target } },
    operation,
  );
}

function translateUnclassifiedPrismaCreateProductError(error: unknown) {
  // Task 4 has no discriminator for operations without an approved uniqueness mapping.
  return translatePrismaCreateProductError(error, "insertAudit");
}

function inspectPrismaPgUniqueConstraint(
  error: unknown,
): { readonly modelName: string; readonly fields: readonly string[] } | null {
  if (!isRecord(error) || error.code !== "P2002" || !isRecord(error.meta)) {
    return null;
  }

  const { driverAdapterError, modelName } = error.meta;

  if (
    typeof modelName !== "string"
    || !isRecord(driverAdapterError)
    || !isRecord(driverAdapterError.cause)
    || driverAdapterError.cause.kind !== "UniqueConstraintViolation"
    || !isRecord(driverAdapterError.cause.constraint)
    || !Array.isArray(driverAdapterError.cause.constraint.fields)
  ) {
    return null;
  }

  const fields = driverAdapterError.cause.constraint.fields.map(normalizePostgreSqlIdentifier);

  if (fields.some((field) => field === null)) {
    return null;
  }

  return {
    modelName,
    fields: fields.filter((field): field is string => field !== null),
  };
}

function normalizePostgreSqlIdentifier(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const match = /^(?:"([A-Za-z][A-Za-z0-9]*)"|([A-Za-z][A-Za-z0-9]*))$/.exec(value);

  return match?.[1] ?? match?.[2] ?? null;
}

function hasExactFields(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return actual.length === expected.length
    && actual.every((field, index) => field === expected[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
