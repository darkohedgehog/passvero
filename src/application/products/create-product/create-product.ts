import { hasProductPermission, PRODUCT_CREATE, roleHasProductPermission } from "@/src/application/permissions/product-permissions";
import { ApplicationError, type ApplicationErrorCategory } from "@/src/application/errors/application-error";
import type {
  CreateProduct,
  CreateProductDependencies,
} from "@/src/application/products/create-product/ports";
import { CreateProductPersistenceError } from "@/src/application/products/create-product/ports";
import { normalizeCreateProductCommand } from "@/src/application/products/create-product/normalize-command";
import { assertValidProductPublicCode } from "@/src/application/products/create-product/public-code";

export function createCreateProductService<Transaction>(
  dependencies: CreateProductDependencies<Transaction>,
): CreateProduct {
  return async (command, context) => {
    const trustedApplicationErrors = new WeakSet<ApplicationError>();
    const createProductError = createProductErrorFactory(trustedApplicationErrors);
    let startedAt: number | null = null;

    try {
      startedAt = dependencies.monotonicNow();

      if (context === null) {
        throw createProductError(
          "UNAUTHENTICATED",
          "CREATE_PRODUCT_UNAUTHENTICATED",
        );
      }

      if (
        context.membershipStatus !== "ACTIVE" ||
        !hasProductPermission(context)
      ) {
        throw createProductError(
          "FORBIDDEN",
          "CREATE_PRODUCT_FORBIDDEN",
          context.correlationId,
        );
      }

      const normalizedCommand = normalizeTrustedCreateProductCommand(
        command,
        context.correlationId,
        trustedApplicationErrors,
      );
      for (const attempt of [1, 2, 3] as const) {
        const publicCode = generateTrustedProductPublicCode(
          dependencies,
          context.correlationId,
          trustedApplicationErrors,
        );
        let result: Awaited<ReturnType<CreateProduct>>;

        try {
          result = await dependencies.transactionRunner.run(async (transaction) => {
            const eligibility = await dependencies.persistence.readEligibility(transaction, {
              organizationId: context.organizationId,
              userId: context.userId,
              membershipId: context.membershipId,
            });

            if (eligibility === null) {
              throw createProductError(
                "NOT_FOUND",
                "CREATE_PRODUCT_CONTEXT_NOT_FOUND",
                context.correlationId,
              );
            }

            if (
              eligibility.membershipStatus !== "ACTIVE" ||
              !roleHasProductPermission(eligibility.membershipRole, PRODUCT_CREATE)
            ) {
              throw createProductError(
                "FORBIDDEN",
                "CREATE_PRODUCT_FORBIDDEN",
                context.correlationId,
              );
            }

            if (eligibility.organizationStatus !== "ACTIVE") {
              throw createProductError(
                "INVALID_STATE",
                "CREATE_PRODUCT_ORGANIZATION_INELIGIBLE",
                context.correlationId,
              );
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
              throw createProductError(
                "INVALID_STATE",
                "CREATE_PRODUCT_POINTER_CONFLICT",
                context.correlationId,
              );
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

        } catch (error) {
          if (
            error instanceof CreateProductPersistenceError
            && error.kind === "PUBLIC_CODE_CONFLICT"
          ) {
            dependencies.telemetry.recordPublicCodeCollision({ attempt });

            if (attempt === 3) {
              dependencies.telemetry.recordPublicCodeExhaustion();
              throw createProductError(
                "INTERNAL",
                "CREATE_PRODUCT_PUBLIC_CODE_EXHAUSTED",
                context.correlationId,
              );
            }

            continue;
          }

          throw error;
        }

        recordCreateProductSuccess(dependencies, startedAt);

        return result;
      }

      throw createProductError(
        "INTERNAL",
        "CREATE_PRODUCT_PUBLIC_CODE_EXHAUSTED",
        context.correlationId,
      );
    } catch (error) {
      const applicationError = mapCreateProductError(
        error,
        context?.correlationId,
        trustedApplicationErrors,
        createProductError,
      );

      recordCreateProductFailure(dependencies, applicationError.category, startedAt);

      throw applicationError;
    }
  };
}

function recordCreateProductSuccess<Transaction>(
  dependencies: CreateProductDependencies<Transaction>,
  startedAt: number | null,
): void {
  try {
    dependencies.telemetry.recordSuccess({
      durationMs: getCreateProductDuration(dependencies, startedAt),
    });
  } catch {
    // Telemetry is observational after a committed transaction.
  }
}

function recordCreateProductFailure<Transaction>(
  dependencies: CreateProductDependencies<Transaction>,
  category: ApplicationErrorCategory,
  startedAt: number | null,
): void {
  try {
    dependencies.telemetry.recordFailure({
      category,
      durationMs: getCreateProductDuration(dependencies, startedAt),
    });
  } catch {
    // Failure telemetry must not replace the mapped safe error.
  }
}

function getCreateProductDuration<Transaction>(
  dependencies: CreateProductDependencies<Transaction>,
  startedAt: number | null,
): number {
  if (startedAt === null) {
    return 0;
  }

  try {
    return dependencies.monotonicNow() - startedAt;
  } catch {
    return 0;
  }
}

function normalizeTrustedCreateProductCommand(
  command: Parameters<CreateProduct>[0],
  correlationId: string,
  trustedApplicationErrors: WeakSet<ApplicationError>,
) {
  try {
    return normalizeCreateProductCommand(command, correlationId);
  } catch (error) {
    if (error instanceof ApplicationError) {
      throw trustApplicationError(trustedApplicationErrors, error);
    }

    throw error;
  }
}

function generateTrustedProductPublicCode<Transaction>(
  dependencies: CreateProductDependencies<Transaction>,
  correlationId: string,
  trustedApplicationErrors: WeakSet<ApplicationError>,
): string {
  const generatedCode = dependencies.publicCodeGenerator.generate();

  try {
    return assertValidProductPublicCode(generatedCode, correlationId);
  } catch (error) {
    if (error instanceof ApplicationError) {
      throw trustApplicationError(trustedApplicationErrors, error);
    }

    throw error;
  }
}

function mapCreateProductError(
  error: unknown,
  correlationId: string | undefined,
  trustedApplicationErrors: WeakSet<ApplicationError>,
  createProductError: CreateProductError,
): ApplicationError {
  if (error instanceof ApplicationError && trustedApplicationErrors.has(error)) {
    return error;
  }

  if (error instanceof CreateProductPersistenceError) {
    switch (error.kind) {
      case "NOT_FOUND":
        return createProductError(
          "NOT_FOUND",
          "CREATE_PRODUCT_CONTEXT_NOT_FOUND",
          correlationId,
        );
      case "ORGANIZATION_SKU_CONFLICT":
        return createProductError(
          "CONFLICT",
          "CREATE_PRODUCT_SKU_CONFLICT",
          correlationId,
        );
      case "ACTIVE_DRAFT_CONFLICT":
      case "POINTER_CONFLICT":
        return createProductError(
          "INVALID_STATE",
          "CREATE_PRODUCT_POINTER_CONFLICT",
          correlationId,
        );
      case "PUBLIC_CODE_CONFLICT":
      case "UNKNOWN":
        return createProductError("INTERNAL", "CREATE_PRODUCT_INTERNAL", correlationId);
    }
  }

  return createProductError("INTERNAL", "CREATE_PRODUCT_INTERNAL", correlationId);
}

type CreateProductError = (
  category: ApplicationErrorCategory,
  code: string,
  correlationId?: string,
) => ApplicationError;

function createProductErrorFactory(
  trustedApplicationErrors: WeakSet<ApplicationError>,
): CreateProductError {
  return (category, code, correlationId) => trustApplicationError(
    trustedApplicationErrors,
    new ApplicationError(
      category,
      code,
      "The product could not be created.",
      false,
      correlationId,
    ),
  );
}

function trustApplicationError(
  trustedApplicationErrors: WeakSet<ApplicationError>,
  error: ApplicationError,
): ApplicationError {
  trustedApplicationErrors.add(error);

  return error;
}
