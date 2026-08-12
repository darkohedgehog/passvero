import { hasProductPermission, PRODUCT_CREATE, roleHasProductPermission } from "@/src/application/permissions/product-permissions";
import type {
  CreateProduct,
  CreateProductDependencies,
} from "@/src/application/products/create-product/ports";
import { normalizeCreateProductCommand } from "@/src/application/products/create-product/normalize-command";
import { assertValidProductPublicCode } from "@/src/application/products/create-product/public-code";

export function createCreateProductService<Transaction>(
  dependencies: CreateProductDependencies<Transaction>,
): CreateProduct {
  return async (command, context) => {
    const startedAt = dependencies.monotonicNow();

    if (
      context === null ||
      context.membershipStatus !== "ACTIVE" ||
      !hasProductPermission(context)
    ) {
      throw new Error("Create product context is not eligible.");
    }

    const normalizedCommand = normalizeCreateProductCommand(command, context.correlationId);
    const publicCode = assertValidProductPublicCode(
      dependencies.publicCodeGenerator.generate(),
      context.correlationId,
    );

    const result = await dependencies.transactionRunner.run(async (transaction) => {
      const eligibility = await dependencies.persistence.readEligibility(transaction, {
        organizationId: context.organizationId,
        userId: context.userId,
        membershipId: context.membershipId,
      });

      if (
        eligibility === null ||
        eligibility.organizationStatus !== "ACTIVE" ||
        eligibility.membershipStatus !== "ACTIVE" ||
        !roleHasProductPermission(eligibility.membershipRole, PRODUCT_CREATE)
      ) {
        throw new Error("Create product eligibility is not valid.");
      }

      const product = await dependencies.persistence.createProductIdentity(transaction, {
        organizationId: context.organizationId,
        internalName: normalizedCommand.internalName,
        sku: normalizedCommand.sku,
        normalizedSku: normalizedCommand.normalizedSku,
        publicCode,
        actorId: context.userId,
      });
      const version = await dependencies.persistence.createInitialProductVersion(transaction, {
        productId: product.productId,
        organizationId: context.organizationId,
        sourceLocale: normalizedCommand.sourceLocale,
        actorId: context.userId,
      });

      await dependencies.persistence.createInitialProductTranslation(transaction, {
        productVersionId: version.productVersionId,
        locale: normalizedCommand.sourceLocale,
        productName: normalizedCommand.productName,
      });

      const assigned = await dependencies.persistence.assignCurrentDraftVersionIfUnset(
        transaction,
        {
          productId: product.productId,
          organizationId: context.organizationId,
          productVersionId: version.productVersionId,
        },
      );

      if (!assigned) {
        throw new Error("Create product draft pointer was not assigned.");
      }

      await dependencies.persistence.insertProductCreatedAuditEvent(transaction, {
        organizationId: context.organizationId,
        actorId: context.userId,
        productId: product.productId,
        initialProductVersionId: version.productVersionId,
        skuSupplied: normalizedCommand.sku !== null,
        correlationId: context.correlationId,
      });

      return {
        productId: product.productId,
        initialProductVersionId: version.productVersionId,
        publicCode,
        productStatus: "ACTIVE" as const,
        draftStatus: "DRAFT" as const,
        organizationSku: normalizedCommand.sku,
        createdAt: product.createdAt,
      };
    });

    dependencies.telemetry.recordSuccess({
      durationMs: dependencies.monotonicNow() - startedAt,
    });

    return result;
  };
}
