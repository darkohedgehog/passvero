import { attachmentDto } from "../document-attachments/contracts";
import { parseCanonicalAppOrigin } from "@/src/application/config/canonical-app-origin";
import type { GetPublicDpp } from "@/src/application/public-dpp/contracts";
import { isPassveroLocale } from "@/src/domain/values/passvero-locale";
import { ApplicationError } from "@/src/application/errors/application-error";
import {
  hasProductPermission,
  PRODUCT_READ,
} from "@/src/application/permissions/product-permissions";
import type {
  GetProductDetail,
  ProductDetailDraft,
  ProductDetailPublished,
  ProductDetailResult,
  ProductDetailSnapshot,
} from "@/src/application/products/get-product-detail/contracts";
import type {
  GetProductDetailPersistence,
  ProductDetailRecord,
  ProductDetailVersionRecord,
} from "@/src/application/products/get-product-detail/ports";

const CANONICAL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function createGetProductDetailService(dependencies: {
  readonly persistence: GetProductDetailPersistence;
  readonly canonicalOrigin: string;
  readonly getPublicDpp: GetPublicDpp;
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

    try {
      if (!/^[A-Za-z0-9_-]{22}$/.test(record.publicCode)) {
        throw internalProductDetailError(context.correlationId);
      }
      const currentDraft = mapCurrentDraft(record, context.correlationId);
      const currentPublished = mapCurrentPublished(record, context.correlationId);
      // Reuse anonymous eligibility without exposing its DTO as private detail.
      // A changed publication between reads must not produce a misleading link.
      const publicResult = await dependencies.getPublicDpp({
        publicCode: record.publicCode,
        requestedLocale: currentPublished?.sourceLocale,
        acceptLanguage: null,
      });
      let publicAvailability: ProductDetailResult["publicAvailability"];
      if (publicResult.kind === "TEMPORARILY_UNAVAILABLE") {
        throw internalProductDetailError(context.correlationId);
      } else if (publicResult.kind === "PUBLIC") {
        if (record.lifecycleStatus !== "ACTIVE" || currentPublished === null
          || publicResult.dpp.version.number !== currentPublished.versionNumber
          || publicResult.dpp.version.publishedAt !== currentPublished.publishedAt.toISOString()
          || publicResult.dpp.locale !== currentPublished.sourceLocale) {
          throw internalProductDetailError(context.correlationId);
        }
        const origin = parseCanonicalAppOrigin(dependencies.canonicalOrigin);
        publicAvailability = { status: "PUBLIC", url: new URL(`/p/${record.publicCode}`, origin).toString() };
      } else {
        publicAvailability = { status: publicResult.kind === "WITHDRAWN" ? "WITHDRAWN" : "NOT_PUBLIC" };
      }
      return {
        productId: record.productId,
        internalName: record.internalName,
        organizationSku: record.sku,
        publicCode: record.publicCode,
        lifecycleStatus: record.lifecycleStatus,
        publicationState: currentPublished !== null
          ? currentDraft !== null ? "CHANGES_IN_DRAFT" : "PUBLISHED"
          : currentDraft !== null ? "DRAFT" : null,
        publicAvailability,
        currentDraft,
        currentPublished,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      };
    } catch {
      throw internalProductDetailError(context.correlationId);
    }
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

  const snapshot = mapSnapshot(version, correlationId);
  return {
    ...snapshot,
    kind: "CURRENT_DRAFT",
    productVersionId: version.productVersionId,
    status: version.status as ProductDetailDraft["status"],
    sourceLocale: version.sourceLocale,
    sourceProductName: snapshot.content.productName,
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
  if (version.versionNumber === null || !Number.isSafeInteger(version.versionNumber)
    || version.versionNumber < 1 || version.publishedAt === null
    || !Number.isFinite(version.publishedAt.getTime())) {
    throw internalProductDetailError(correlationId);
  }

  const snapshot = mapSnapshot(version, correlationId);
  return {
    ...snapshot,
    kind: "CURRENT_PUBLISHED",
    productVersionId: version.productVersionId,
    status: "PUBLISHED",
    sourceLocale: version.sourceLocale,
    sourceProductName: snapshot.content.productName,
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
    || !isPassveroLocale(version.sourceLocale)
    || !allowedStatuses.includes(version.status)
  ) {
    throw internalProductDetailError(correlationId);
  }
  return version;
}

function mapSnapshot(version: ProductDetailVersionRecord, correlationId: string): ProductDetailSnapshot {
  const translations = version.translations.filter((row) => row.locale === version.sourceLocale);
  const translation = translations[0];
  if (translations.length !== 1 || translation.productVersionId !== version.productVersionId
    || !translation.productName.trim() || version.cnRows.length > 1
    || version.materials.some((row) => row.productVersionId !== version.productVersionId)) {
    throw internalProductDetailError(correlationId);
  }
  const cn = version.cnRows[0];
  if (cn !== undefined && (cn.productVersionId !== version.productVersionId
    || !/^[0-9]{8}$/.test(cn.value) || cn.nomenclatureYear === null
    || !Number.isInteger(cn.nomenclatureYear) || cn.nomenclatureYear < 1988)) {
    throw internalProductDetailError(correlationId);
  }
  return {
    documents: version.documents.map(row => attachmentDto(row, version.productVersionId, version.organizationId)),
    content: {
      productName: translation.productName,
      shortDescription: translation.shortDescription,
      description: translation.description,
      technicalDescription: translation.technicalDescription,
      repairInstructions: translation.repairInstructions,
      sparePartsInformation: translation.sparePartsInformation,
      recyclingInstructions: translation.recyclingInstructions,
      disposalInstructions: translation.disposalInstructions,
      packagingInformation: translation.packagingInformation,
      safetyInformation: translation.safetyInformation,
      warrantyInformation: translation.warrantyInformation,
      publicNotes: translation.publicNotes,
    },
    cn: cn === undefined ? null : { code: cn.value, nomenclatureYear: cn.nomenclatureYear! },
    materials: version.materials.map((row) => ({
      materialName: row.materialName, category: row.category,
      percentage: row.percentage, isRecycled: row.isRecycled,
      recycledPercentage: row.recycledPercentage,
    })),
  };
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
