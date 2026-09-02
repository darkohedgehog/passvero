import { ApplicationError } from "@/src/application/errors/application-error";
import { hasProductPermission, PRODUCT_PUBLISH, roleHasProductPermission } from "@/src/application/permissions/product-permissions";
import type { PublishProduct, PublishProductCommand } from "@/src/application/products/publish-product/contracts";
import type { PublishProductDependencies } from "@/src/application/products/publish-product/ports";
import { isPassveroLocale } from "@/src/domain/values/passvero-locale";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_CODE = /^[A-Za-z0-9_-]{22}$/;

export function createPublishProductService<Transaction>(
  dependencies: PublishProductDependencies<Transaction>,
): PublishProduct {
  return async (command, context) => {
    const trusted = new WeakSet<ApplicationError>();
    const fail = (category: ApplicationError["category"], code: string, correlationId?: string) => {
      const message = category === "NOT_FOUND" ? "The requested product was not found." : category === "CONFLICT" ? "The product changed and must be reloaded." : "The product could not be published.";
      const error = new ApplicationError(category, code, message, false, correlationId);
      trusted.add(error);
      return error;
    };
    try {
      if (context === null) throw fail("UNAUTHENTICATED", "PUBLISH_PRODUCT_UNAUTHENTICATED");
      if (context.membershipStatus !== "ACTIVE" || !hasProductPermission(context, PRODUCT_PUBLISH)) {
        throw fail("FORBIDDEN", "PUBLISH_PRODUCT_FORBIDDEN", context.correlationId);
      }
      const normalized = normalize(command, context.correlationId, fail);
      return await dependencies.transactionRunner.run(async (transaction) => {
        const eligibility = await dependencies.persistence.readEligibility(transaction, { organizationId: context.organizationId, userId: context.userId, membershipId: context.membershipId });
        if (eligibility === null || eligibility.organizationStatus !== "ACTIVE" || eligibility.membershipStatus !== "ACTIVE" || !roleHasProductPermission(eligibility.membershipRole, PRODUCT_PUBLISH)) {
          throw fail("FORBIDDEN", "PUBLISH_PRODUCT_FORBIDDEN", context.correlationId);
        }
        const product = await dependencies.persistence.readProductForPublication(transaction, { productId: normalized.productId, organizationId: context.organizationId });
        if (product === null) throw fail("NOT_FOUND", "PUBLISH_PRODUCT_NOT_FOUND", context.correlationId);
        if (product.productId !== normalized.productId || product.organizationId !== context.organizationId) throw fail("INTERNAL", "PUBLISH_PRODUCT_INVARIANT_FAILURE", context.correlationId);
        if (product.lifecycleStatus !== "ACTIVE" || !PUBLIC_CODE.test(product.publicCode)) throw fail("INVALID_STATE", "PUBLISH_PRODUCT_INVALID_STATE", context.correlationId);
        const qrTargetUrl = new URL(`/p/${product.publicCode}`, dependencies.canonicalOrigin).toString();

        if (product.currentPublishedVersionId === normalized.expectedDraftVersionId) {
          if (product.currentDraftVersionId !== null) throw fail("CONFLICT", "PUBLISH_PRODUCT_STALE_WRITE", context.correlationId);
          const published = await dependencies.persistence.readVersion(transaction, { productVersionId: normalized.expectedDraftVersionId, productId: product.productId, organizationId: product.organizationId });
          if (published === null || published.status !== "PUBLISHED" || published.versionNumber === null || published.publishedAt === null || published.publishedById === null || published.supersededAt !== null || published.discardedAt !== null) {
            throw fail("INVALID_STATE", "PUBLISH_PRODUCT_INVALID_STATE", context.correlationId);
          }
          if (normalized.expectedCurrentPublishedVersionId === null) {
            if (published.versionNumber !== 1) throw fail("CONFLICT", "PUBLISH_PRODUCT_STALE_WRITE", context.correlationId);
          } else {
            const previous = await dependencies.persistence.readVersion(transaction, { productVersionId: normalized.expectedCurrentPublishedVersionId, productId: product.productId, organizationId: product.organizationId });
            if (previous === null || previous.status !== "SUPERSEDED" || previous.versionNumber !== published.versionNumber - 1 || previous.supersededAt === null) {
              throw fail("CONFLICT", "PUBLISH_PRODUCT_STALE_WRITE", context.correlationId);
            }
          }
          const passport = await dependencies.persistence.readPassport(transaction, { productId: product.productId, organizationId: product.organizationId });
          if (passport === null || passport.status !== "ACTIVE" || passport.qrCode === null || passport.qrCode.targetUrl !== qrTargetUrl) {
            throw fail("INVALID_STATE", "PUBLISH_PRODUCT_INVALID_STATE", context.correlationId);
          }
          return { productId: product.productId, status: "NO_CHANGE" as const, versionNumber: published.versionNumber };
        }

        if (product.currentDraftVersionId !== normalized.expectedDraftVersionId || product.currentPublishedVersionId !== normalized.expectedCurrentPublishedVersionId || !same(product.updatedAt, normalized.expectedProductUpdatedAt)) {
          throw fail("CONFLICT", "PUBLISH_PRODUCT_STALE_WRITE", context.correlationId);
        }
        if (product.currentDraftVersionId === null) throw fail("INVALID_STATE", "PUBLISH_PRODUCT_INVALID_STATE", context.correlationId);
        const draft = await dependencies.persistence.readVersion(transaction, { productVersionId: product.currentDraftVersionId, productId: product.productId, organizationId: product.organizationId });
        if (draft === null || draft.productVersionId !== product.currentDraftVersionId || draft.productId !== product.productId || draft.organizationId !== product.organizationId) throw fail("INTERNAL", "PUBLISH_PRODUCT_INVARIANT_FAILURE", context.correlationId);
        if ((draft.status !== "DRAFT" && draft.status !== "READY_FOR_REVIEW") || draft.versionNumber !== null || draft.publishedAt !== null || draft.publishedById !== null || draft.supersededAt !== null || draft.discardedAt !== null || !isPassveroLocale(draft.sourceLocale)) {
          throw fail("INVALID_STATE", "PUBLISH_PRODUCT_INVALID_STATE", context.correlationId);
        }
        if (!same(draft.updatedAt, normalized.expectedDraftUpdatedAt)) throw fail("CONFLICT", "PUBLISH_PRODUCT_STALE_WRITE", context.correlationId);

        let previous = null;
        if (product.currentPublishedVersionId !== null) {
          previous = await dependencies.persistence.readVersion(transaction, { productVersionId: product.currentPublishedVersionId, productId: product.productId, organizationId: product.organizationId });
          if (previous === null || previous.status !== "PUBLISHED" || previous.versionNumber === null || previous.productId !== product.productId || previous.organizationId !== product.organizationId) throw fail("INTERNAL", "PUBLISH_PRODUCT_INVARIANT_FAILURE", context.correlationId);
        }
        const timestamp = dependencies.now();
        const readiness = await dependencies.persistence.readReadiness(transaction, { productVersionId: draft.productVersionId, organizationId: product.organizationId, sourceLocale: draft.sourceLocale, currentUtcYear: timestamp.getUTCFullYear() });
        if (!readiness.sourceTranslationExists) throw fail("INVALID_STATE", "PUBLISH_PRODUCT_NOT_READY_SOURCE_TRANSLATION", context.correlationId);
        if (!validProductName(readiness.sourceProductName)) throw fail("INVALID_STATE", "PUBLISH_PRODUCT_NOT_READY_PRODUCT_NAME", context.correlationId);
        if (readiness.unavailablePublicAsset) throw fail("INVALID_STATE", "PUBLISH_PRODUCT_NOT_READY_PUBLIC_ASSET", context.correlationId);
        if (readiness.invalidAuthoredAggregate) throw fail("INVALID_STATE", "PUBLISH_PRODUCT_INVALID_STATE", context.correlationId);
        const passport = await dependencies.persistence.readPassport(transaction, { productId: product.productId, organizationId: product.organizationId });
        if (passport !== null && (passport.productId !== product.productId || passport.organizationId !== product.organizationId)) throw fail("INTERNAL", "PUBLISH_PRODUCT_INVARIANT_FAILURE", context.correlationId);
        if (previous === null && passport !== null) throw fail("INVALID_STATE", "PUBLISH_PRODUCT_INVALID_STATE", context.correlationId);
        if (previous !== null && (passport === null || passport.status !== "ACTIVE" || passport.qrCode === null || passport.qrCode.targetUrl !== qrTargetUrl)) throw fail("INVALID_STATE", "PUBLISH_PRODUCT_INVALID_STATE", context.correlationId);
        const versionNumber = await dependencies.persistence.nextVersionNumber(transaction, { productId: product.productId, organizationId: product.organizationId });
        if (!Number.isSafeInteger(versionNumber) || versionNumber < 1) throw fail("INTERNAL", "PUBLISH_PRODUCT_INVARIANT_FAILURE", context.correlationId);
        const result = await dependencies.persistence.applyPublication(transaction, {
          organizationId: product.organizationId, actorId: context.userId, productId: product.productId,
          draftVersionId: draft.productVersionId, previousPublishedVersionId: previous?.productVersionId ?? null,
          expectedProductUpdatedAt: normalized.expectedProductUpdatedAt, expectedDraftUpdatedAt: normalized.expectedDraftUpdatedAt,
          expectedCurrentPublishedVersionId: normalized.expectedCurrentPublishedVersionId, versionNumber, publishedAt: timestamp,
          sourceLocale: draft.sourceLocale, passport, qrCode: passport === null ? dependencies.generateQrCode() : null,
          qrTargetUrl, correlationId: context.correlationId,
        });
        if (result !== "APPLIED") throw fail("CONFLICT", "PUBLISH_PRODUCT_STALE_WRITE", context.correlationId);
        return { productId: product.productId, status: "PUBLISHED" as const, versionNumber };
      });
    } catch (error) {
      if (error instanceof ApplicationError && trusted.has(error)) throw error;
      throw fail("INTERNAL", "PUBLISH_PRODUCT_OPERATIONAL_FAILURE", context?.correlationId);
    }
  };
}

function normalize(command: PublishProductCommand, correlationId: string, fail: (category: ApplicationError["category"], code: string, correlationId?: string) => ApplicationError) {
  if (!UUID.test(command.productId) || !UUID.test(command.expectedDraftVersionId) || (command.expectedCurrentPublishedVersionId !== null && !UUID.test(command.expectedCurrentPublishedVersionId))) throw fail("VALIDATION", "PUBLISH_PRODUCT_VALIDATION_ERROR", correlationId);
  const productAt = instant(command.expectedProductUpdatedAt);
  const draftAt = instant(command.expectedDraftUpdatedAt);
  if (productAt === null || draftAt === null) throw fail("VALIDATION", "PUBLISH_PRODUCT_VALIDATION_ERROR", correlationId);
  return { ...command, expectedProductUpdatedAt: productAt, expectedDraftUpdatedAt: draftAt };
}

function instant(value: string): Date | null {
  const result = new Date(value);
  return Number.isNaN(result.getTime()) || result.toISOString() !== value ? null : result;
}

function same(left: Date, right: Date): boolean { return left.getTime() === right.getTime(); }
function validProductName(value: string | null): value is string {
  return value !== null && value === value.trim() && Array.from(value).length >= 1 && Array.from(value).length <= 200;
}
