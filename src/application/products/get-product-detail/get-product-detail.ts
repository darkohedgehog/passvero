import { ApplicationError } from "@/src/application/errors/application-error";
import {
  hasProductPermission,
  PRODUCT_READ,
} from "@/src/application/permissions/product-permissions";
import type {
  GetProductDetail,
  ProductDetailDraft,
  ProductDetailPublished,
} from "@/src/application/products/get-product-detail/contracts";
import type {
  GetProductDetailPersistence,
  ProductDetailRecord,
  ProductDetailVersionRecord,
} from "@/src/application/products/get-product-detail/ports";

const CANONICAL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function createGetProductDetailService(dependencies: {
  readonly persistence: GetProductDetailPersistence;
}): GetProductDetail {
  return async (query, context) => {
    if (context === null) {
      throw productDetailError(
        "UNAUTHENTICATED",
        "GET_PRODUCT_DETAIL_UNAUTHENTICATED",
      );
    }

    if (
      context.membershipStatus !== "ACTIVE"
      || !hasProductPermission(context, PRODUCT_READ)
    ) {
      throw productDetailError(
        "FORBIDDEN",
        "GET_PRODUCT_DETAIL_FORBIDDEN",
        context.correlationId,
      );
    }

    if (!CANONICAL_UUID_PATTERN.test(query.productId)) {
      throw productDetailError(
        "VALIDATION",
        "GET_PRODUCT_DETAIL_ID_INVALID",
        context.correlationId,
      );
    }

    let record: ProductDetailRecord | null;
    try {
      record = await dependencies.persistence.findByIdAndOrganization({
        productId: query.productId,
        organizationId: context.organizationId,
      });
    } catch {
      throw internalProductDetailError(context.correlationId);
    }

    if (record === null) {
      throw productDetailError(
        "NOT_FOUND",
        "GET_PRODUCT_DETAIL_NOT_FOUND",
        context.correlationId,
      );
    }

    if (
      record.productId !== query.productId
      || record.organizationId !== context.organizationId
    ) {
      throw internalProductDetailError(context.correlationId);
    }

    const currentDraft = mapCurrentDraft(record, context.correlationId);
    const currentPublished = mapCurrentPublished(record, context.correlationId);

    return {
      productId: record.productId,
      internalName: record.internalName,
      organizationSku: record.sku,
      publicCode: record.publicCode,
      lifecycleStatus: record.lifecycleStatus,
      currentDraft,
      currentPublished,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  };
}

function mapCurrentDraft(
  record: ProductDetailRecord,
  correlationId: string,
): ProductDetailDraft | null {
  const version = validatePointedVersion(
    record,
    record.currentDraftVersionId,
    record.currentDraftVersion,
    ["DRAFT", "READY_FOR_REVIEW"],
    correlationId,
  );
  if (version === null) return null;

  return {
    productVersionId: version.productVersionId,
    status: version.status as ProductDetailDraft["status"],
    sourceLocale: version.sourceLocale,
    sourceProductName: sourceProductName(version, correlationId),
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
  };
}

function mapCurrentPublished(
  record: ProductDetailRecord,
  correlationId: string,
): ProductDetailPublished | null {
  const version = validatePointedVersion(
    record,
    record.currentPublishedVersionId,
    record.currentPublishedVersion,
    ["PUBLISHED"],
    correlationId,
  );
  if (version === null) return null;

  return {
    productVersionId: version.productVersionId,
    status: "PUBLISHED",
    sourceLocale: version.sourceLocale,
    sourceProductName: sourceProductName(version, correlationId),
    versionNumber: version.versionNumber,
    publishedAt: version.publishedAt,
  };
}

function validatePointedVersion(
  record: ProductDetailRecord,
  pointerId: string | null,
  version: ProductDetailVersionRecord | null,
  allowedStatuses: readonly ProductDetailVersionRecord["status"][],
  correlationId: string,
): ProductDetailVersionRecord | null {
  if (pointerId === null && version === null) return null;
  if (
    pointerId === null
    || version === null
    || version.productVersionId !== pointerId
    || version.productId !== record.productId
    || version.organizationId !== record.organizationId
    || !allowedStatuses.includes(version.status)
  ) {
    throw internalProductDetailError(correlationId);
  }
  return version;
}

function sourceProductName(
  version: ProductDetailVersionRecord,
  correlationId: string,
): string {
  const translation = version.translations.find((candidate) =>
    candidate.productVersionId === version.productVersionId
    && candidate.locale === version.sourceLocale
  );
  if (translation === undefined) {
    throw internalProductDetailError(correlationId);
  }
  return translation.productName;
}

function internalProductDetailError(correlationId: string): ApplicationError {
  return productDetailError(
    "INTERNAL",
    "GET_PRODUCT_DETAIL_INTERNAL",
    correlationId,
  );
}

function productDetailError(
  category: "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "INTERNAL",
  code: string,
  correlationId?: string,
): ApplicationError {
  const message = category === "NOT_FOUND"
    ? "The requested product was not found."
    : "The product detail request could not be completed.";
  return new ApplicationError(category, code, message, false, correlationId);
}
