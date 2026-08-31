import { ApplicationError } from "@/src/application/errors/application-error";
import {
  hasProductPermission,
  PRODUCT_EDIT,
  roleHasProductPermission,
} from "@/src/application/permissions/product-permissions";
import type { EditProductDraft } from "@/src/application/products/edit-product-draft/contracts";
import { normalizeEditProductDraftCommand } from "@/src/application/products/edit-product-draft/normalize-command";
import {
  EditProductDraftPersistenceError,
  type EditProductDraftDependencies,
} from "@/src/application/products/edit-product-draft/ports";

const EDITABLE_STATUSES = ["DRAFT", "READY_FOR_REVIEW"] as const;

export function createEditProductDraftService<Transaction>(
  dependencies: EditProductDraftDependencies<Transaction>,
): EditProductDraft {
  return async (command, context) => {
    const trustedErrors = new WeakSet<ApplicationError>();
    const safeError = createSafeErrorFactory(trustedErrors);

    try {
      if (context === null) {
        throw safeError("UNAUTHENTICATED", "EDIT_PRODUCT_DRAFT_UNAUTHENTICATED");
      }
      if (
        context.membershipStatus !== "ACTIVE"
        || !hasProductPermission(context, PRODUCT_EDIT)
      ) {
        throw safeError("FORBIDDEN", "EDIT_PRODUCT_DRAFT_FORBIDDEN", context.correlationId);
      }

      return await dependencies.transactionRunner.run(async (transaction) => {
        const eligibility = await dependencies.persistence.readEligibility(transaction, {
          organizationId: context.organizationId,
          userId: context.userId,
          membershipId: context.membershipId,
        });
        if (
          eligibility === null
          || eligibility.membershipStatus !== "ACTIVE"
          || eligibility.organizationStatus !== "ACTIVE"
          || !roleHasProductPermission(eligibility.membershipRole, PRODUCT_EDIT)
        ) {
          throw safeError("FORBIDDEN", "EDIT_PRODUCT_DRAFT_FORBIDDEN", context.correlationId);
        }

        const normalized = normalizeTrustedCommand(command, context.correlationId, trustedErrors);
        const product = await dependencies.persistence.readProduct(transaction, {
          productId: normalized.productId,
          organizationId: context.organizationId,
        });
        if (product === null) {
          throw safeError("NOT_FOUND", "EDIT_PRODUCT_DRAFT_NOT_FOUND", context.correlationId);
        }
        if (
          product.productId !== normalized.productId
          || product.organizationId !== context.organizationId
        ) {
          throw safeError("INTERNAL", "EDIT_PRODUCT_DRAFT_INVARIANT_FAILURE", context.correlationId);
        }
        if (product.lifecycleStatus !== "ACTIVE" || product.currentDraftVersionId === null) {
          throw safeError("INVALID_STATE", "EDIT_PRODUCT_DRAFT_NOT_EDITABLE", context.correlationId);
        }
        if (
          product.currentDraftVersionId !== normalized.expectedDraftVersionId
          || !sameInstant(product.updatedAt, normalized.expectedProductUpdatedAt)
        ) {
          throw safeError("CONFLICT", "EDIT_PRODUCT_DRAFT_STALE_WRITE", context.correlationId);
        }

        const draft = await dependencies.persistence.readDraftVersion(transaction, {
          productVersionId: product.currentDraftVersionId,
          productId: product.productId,
          organizationId: product.organizationId,
        });
        if (
          draft === null
          || draft.productVersionId !== product.currentDraftVersionId
          || draft.productId !== product.productId
          || draft.organizationId !== product.organizationId
        ) {
          throw safeError("INTERNAL", "EDIT_PRODUCT_DRAFT_INVARIANT_FAILURE", context.correlationId);
        }
        if (!EDITABLE_STATUSES.some((status) => status === draft.status)) {
          throw safeError("INVALID_STATE", "EDIT_PRODUCT_DRAFT_NOT_EDITABLE", context.correlationId);
        }
        if (!sameInstant(draft.updatedAt, normalized.expectedDraftUpdatedAt)) {
          throw safeError("CONFLICT", "EDIT_PRODUCT_DRAFT_STALE_WRITE", context.correlationId);
        }

        const translation = await dependencies.persistence.readSourceTranslation(transaction, {
          productVersionId: draft.productVersionId,
          locale: draft.sourceLocale,
        });
        if (
          translation === null
          || translation.productVersionId !== draft.productVersionId
          || translation.locale !== draft.sourceLocale
        ) {
          throw safeError("INTERNAL", "EDIT_PRODUCT_DRAFT_INVARIANT_FAILURE", context.correlationId);
        }
        if (!sameInstant(translation.updatedAt, normalized.expectedSourceTranslationUpdatedAt)) {
          throw safeError("CONFLICT", "EDIT_PRODUCT_DRAFT_STALE_WRITE", context.correlationId);
        }

        const productNameChanged = product.internalName !== normalized.productName
          || translation.productName !== normalized.productName;
        const organizationSkuChanged = product.sku !== normalized.sku
          || product.normalizedSku !== normalized.normalizedSku;
        if (!productNameChanged && !organizationSkuChanged) {
          return { productId: product.productId, status: "NO_CHANGE" as const };
        }

        const productUpdated = await dependencies.persistence.updateProductIfCurrent(transaction, {
          productId: product.productId,
          organizationId: product.organizationId,
          currentDraftVersionId: draft.productVersionId,
          expectedUpdatedAt: normalized.expectedProductUpdatedAt,
          internalName: normalized.productName,
          sku: normalized.sku,
          normalizedSku: normalized.normalizedSku,
          actorId: context.userId,
        });
        if (!productUpdated) throw staleWrite(safeError, context.correlationId);

        const draftUpdated = await dependencies.persistence.touchDraftVersionIfCurrent(transaction, {
          productVersionId: draft.productVersionId,
          productId: product.productId,
          organizationId: product.organizationId,
          expectedUpdatedAt: normalized.expectedDraftUpdatedAt,
          actorId: context.userId,
        });
        if (!draftUpdated) throw staleWrite(safeError, context.correlationId);

        const translationUpdated = await dependencies.persistence.updateSourceTranslationIfCurrent(
          transaction,
          {
            productVersionId: draft.productVersionId,
            locale: draft.sourceLocale,
            expectedUpdatedAt: normalized.expectedSourceTranslationUpdatedAt,
            productName: normalized.productName,
          },
        );
        if (!translationUpdated) throw staleWrite(safeError, context.correlationId);

        const changedFields: Array<"productName" | "organizationSku"> = [];
        if (productNameChanged) changedFields.push("productName");
        if (organizationSkuChanged) changedFields.push("organizationSku");
        await dependencies.persistence.insertProductUpdatedAuditEvent(transaction, {
          organizationId: product.organizationId,
          actorId: context.userId,
          productId: product.productId,
          changedFields,
          correlationId: context.correlationId,
        });

        return { productId: product.productId, status: "UPDATED" as const };
      });
    } catch (error) {
      if (error instanceof ApplicationError && trustedErrors.has(error)) {
        throw error;
      }
      if (
        error instanceof EditProductDraftPersistenceError
        && error.kind === "ORGANIZATION_SKU_CONFLICT"
      ) {
        throw safeError("CONFLICT", "EDIT_PRODUCT_DRAFT_SKU_CONFLICT", context?.correlationId);
      }
      throw safeError("INTERNAL", "EDIT_PRODUCT_DRAFT_OPERATIONAL_FAILURE", context?.correlationId);
    }
  };
}

type SafeErrorFactory = ReturnType<typeof createSafeErrorFactory>;

function createSafeErrorFactory(trustedErrors: WeakSet<ApplicationError>) {
  return (
    category: ApplicationError["category"],
    code: string,
    correlationId?: string,
  ): ApplicationError => {
    const message = category === "NOT_FOUND"
      ? "The requested product was not found."
      : category === "CONFLICT" && code === "EDIT_PRODUCT_DRAFT_STALE_WRITE"
        ? "The product changed and must be reloaded."
        : "The product edit could not be completed.";
    const error = new ApplicationError(category, code, message, false, correlationId);
    trustedErrors.add(error);
    return error;
  };
}

function normalizeTrustedCommand(
  command: Parameters<EditProductDraft>[0],
  correlationId: string,
  trustedErrors: WeakSet<ApplicationError>,
) {
  try {
    return normalizeEditProductDraftCommand(command, correlationId);
  } catch (error) {
    if (error instanceof ApplicationError) trustedErrors.add(error);
    throw error;
  }
}

function sameInstant(left: Date, right: Date): boolean {
  return left.getTime() === right.getTime();
}

function staleWrite(safeError: SafeErrorFactory, correlationId: string): ApplicationError {
  return safeError("CONFLICT", "EDIT_PRODUCT_DRAFT_STALE_WRITE", correlationId);
}
