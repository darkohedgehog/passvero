import { ApplicationError } from "@/src/application/errors/application-error";
import {
  hasProductPermission,
  PRODUCT_EDIT,
} from "@/src/application/permissions/product-permissions";
import type { GetProductDraftForEdit } from "@/src/application/products/edit-product-draft/contracts";
import type {
  GetProductDraftForEditPersistence,
  ProductDraftEditRecord,
} from "@/src/application/products/edit-product-draft/ports";

const CANONICAL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EDITABLE_STATUSES = ["DRAFT", "READY_FOR_REVIEW"] as const;

export function createGetProductDraftForEditService(dependencies: {
  readonly persistence: GetProductDraftForEditPersistence;
}): GetProductDraftForEdit {
  return async (query, context) => {
    if (context === null) {
      throw editLoaderError("UNAUTHENTICATED", "GET_PRODUCT_DRAFT_FOR_EDIT_UNAUTHENTICATED");
    }
    if (
      context.membershipStatus !== "ACTIVE"
      || !hasProductPermission(context, PRODUCT_EDIT)
    ) {
      throw editLoaderError(
        "FORBIDDEN",
        "GET_PRODUCT_DRAFT_FOR_EDIT_FORBIDDEN",
        context.correlationId,
      );
    }
    if (!CANONICAL_UUID_PATTERN.test(query.productId)) {
      throw editLoaderError(
        "VALIDATION",
        "GET_PRODUCT_DRAFT_FOR_EDIT_ID_INVALID",
        context.correlationId,
      );
    }

    let record: ProductDraftEditRecord | null;
    try {
      record = await dependencies.persistence.findByIdAndOrganization({
        productId: query.productId,
        organizationId: context.organizationId,
      });
    } catch {
      throw invariantFailure(context.correlationId);
    }

    if (record === null) {
      throw editLoaderError(
        "NOT_FOUND",
        "GET_PRODUCT_DRAFT_FOR_EDIT_NOT_FOUND",
        context.correlationId,
      );
    }
    if (
      record.productId !== query.productId
      || record.organizationId !== context.organizationId
    ) {
      throw invariantFailure(context.correlationId);
    }
    if (record.lifecycleStatus !== "ACTIVE" || record.currentDraftVersionId === null) {
      throw notEditable(context.correlationId);
    }

    const version = record.currentDraftVersion;
    if (
      version === null
      || version.productVersionId !== record.currentDraftVersionId
      || version.productId !== record.productId
      || version.organizationId !== record.organizationId
    ) {
      throw invariantFailure(context.correlationId);
    }
    if (!EDITABLE_STATUSES.some((status) => status === version.status)) {
      throw notEditable(context.correlationId);
    }

    const translation = version.sourceTranslation;
    if (
      translation === null
      || translation.productVersionId !== version.productVersionId
      || translation.locale !== version.sourceLocale
    ) {
      throw invariantFailure(context.correlationId);
    }

    return {
      productId: record.productId,
      productName: translation.productName,
      organizationSku: record.sku,
      sourceLocale: version.sourceLocale,
      expectedDraftVersionId: version.productVersionId,
      expectedProductUpdatedAt: record.updatedAt,
      expectedDraftUpdatedAt: version.updatedAt,
      expectedSourceTranslationUpdatedAt: translation.updatedAt,
    };
  };
}

function notEditable(correlationId: string): ApplicationError {
  return editLoaderError(
    "INVALID_STATE",
    "GET_PRODUCT_DRAFT_FOR_EDIT_NOT_EDITABLE",
    correlationId,
  );
}

function invariantFailure(correlationId: string): ApplicationError {
  return editLoaderError(
    "INTERNAL",
    "GET_PRODUCT_DRAFT_FOR_EDIT_INVARIANT_FAILURE",
    correlationId,
  );
}

function editLoaderError(
  category: "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "INVALID_STATE" | "INTERNAL",
  code: string,
  correlationId?: string,
): ApplicationError {
  const message = category === "NOT_FOUND"
    ? "The requested product was not found."
    : "The product edit request could not be completed.";
  return new ApplicationError(category, code, message, false, correlationId);
}
