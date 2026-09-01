import { ApplicationError } from "@/src/application/errors/application-error";
import { hasProductPermission, PRODUCT_EDIT, roleHasProductPermission } from "@/src/application/permissions/product-permissions";
import { DRAFT_TRANSLATION_CONTENT_FIELDS, type DraftTranslationContentValues, type UpdateDraftTranslationContent } from "@/src/application/products/draft-translation-content/contracts";
import { normalizeDraftTranslationContentCommand } from "@/src/application/products/draft-translation-content/normalize-command";
import type { DraftTranslationContentDependencies } from "@/src/application/products/draft-translation-content/ports";

export function createUpdateDraftTranslationContentService<Transaction>(dependencies: DraftTranslationContentDependencies<Transaction>): UpdateDraftTranslationContent {
  return async (command, context) => {
    const trusted = new WeakSet<ApplicationError>();
    const fail = (category: ApplicationError["category"], code: string, correlationId?: string) => {
      const message = category === "NOT_FOUND" ? "The requested product was not found." : code.endsWith("STALE_WRITE") ? "The product changed and must be reloaded." : "The draft content update could not be completed.";
      const error = new ApplicationError(category, code, message, false, correlationId);
      trusted.add(error); return error;
    };
    try {
      if (context === null) throw fail("UNAUTHENTICATED", "DRAFT_TRANSLATION_CONTENT_UNAUTHENTICATED");
      if (context.membershipStatus !== "ACTIVE" || !hasProductPermission(context, PRODUCT_EDIT)) throw fail("FORBIDDEN", "DRAFT_TRANSLATION_CONTENT_FORBIDDEN", context.correlationId);
      return await dependencies.transactionRunner.run(async (transaction) => {
        const eligibility = await dependencies.persistence.readEligibility(transaction, { organizationId: context.organizationId, userId: context.userId, membershipId: context.membershipId });
        if (eligibility === null || eligibility.membershipStatus !== "ACTIVE" || eligibility.organizationStatus !== "ACTIVE" || !roleHasProductPermission(eligibility.membershipRole, PRODUCT_EDIT)) throw fail("FORBIDDEN", "DRAFT_TRANSLATION_CONTENT_FORBIDDEN", context.correlationId);
        let normalized;
        try { normalized = normalizeDraftTranslationContentCommand(command, context.correlationId); }
        catch (error) { if (error instanceof ApplicationError) trusted.add(error); throw error; }
        const product = await dependencies.persistence.readProduct(transaction, { productId: normalized.productId, organizationId: context.organizationId });
        if (product === null) throw fail("NOT_FOUND", "DRAFT_TRANSLATION_CONTENT_NOT_FOUND", context.correlationId);
        if (product.productId !== normalized.productId || product.organizationId !== context.organizationId) throw fail("INTERNAL", "DRAFT_TRANSLATION_CONTENT_INVARIANT_FAILURE", context.correlationId);
        if (product.lifecycleStatus !== "ACTIVE" || product.currentDraftVersionId === null) throw fail("INVALID_STATE", "DRAFT_TRANSLATION_CONTENT_NOT_EDITABLE", context.correlationId);
        if (product.currentDraftVersionId !== normalized.expectedDraftVersionId || product.updatedAt.getTime() !== normalized.expectedProductUpdatedAt.getTime()) throw fail("CONFLICT", "DRAFT_TRANSLATION_CONTENT_STALE_WRITE", context.correlationId);
        const draft = await dependencies.persistence.readDraftVersion(transaction, { productVersionId: product.currentDraftVersionId, productId: product.productId, organizationId: product.organizationId });
        if (draft === null || draft.productVersionId !== product.currentDraftVersionId || draft.productId !== product.productId || draft.organizationId !== product.organizationId) throw fail("INTERNAL", "DRAFT_TRANSLATION_CONTENT_INVARIANT_FAILURE", context.correlationId);
        if (draft.status !== "DRAFT" && draft.status !== "READY_FOR_REVIEW") throw fail("INVALID_STATE", "DRAFT_TRANSLATION_CONTENT_NOT_EDITABLE", context.correlationId);
        if (draft.updatedAt.getTime() !== normalized.expectedDraftUpdatedAt.getTime()) throw fail("CONFLICT", "DRAFT_TRANSLATION_CONTENT_STALE_WRITE", context.correlationId);
        const translation = await dependencies.persistence.readSourceTranslation(transaction, { productVersionId: draft.productVersionId, locale: draft.sourceLocale });
        if (translation === null || translation.productVersionId !== draft.productVersionId || translation.locale !== draft.sourceLocale) throw fail("INTERNAL", "DRAFT_TRANSLATION_CONTENT_INVARIANT_FAILURE", context.correlationId);
        if (translation.updatedAt.getTime() !== normalized.expectedSourceTranslationUpdatedAt.getTime()) throw fail("CONFLICT", "DRAFT_TRANSLATION_CONTENT_STALE_WRITE", context.correlationId);
        const values = Object.fromEntries(DRAFT_TRANSLATION_CONTENT_FIELDS.map((field) => [field, normalized[field]])) as unknown as DraftTranslationContentValues;
        const changedFields = DRAFT_TRANSLATION_CONTENT_FIELDS.filter((field) => values[field] !== translation[field]);
        if (changedFields.length === 0) return { productId: product.productId, status: "NO_CHANGE" as const };
        if (!await dependencies.persistence.touchProductIfCurrent(transaction, { productId: product.productId, organizationId: product.organizationId, currentDraftVersionId: draft.productVersionId, expectedUpdatedAt: normalized.expectedProductUpdatedAt, actorId: context.userId })) throw fail("CONFLICT", "DRAFT_TRANSLATION_CONTENT_STALE_WRITE", context.correlationId);
        if (!await dependencies.persistence.touchDraftVersionIfCurrent(transaction, { productVersionId: draft.productVersionId, productId: product.productId, organizationId: product.organizationId, expectedUpdatedAt: normalized.expectedDraftUpdatedAt, actorId: context.userId })) throw fail("CONFLICT", "DRAFT_TRANSLATION_CONTENT_STALE_WRITE", context.correlationId);
        if (!await dependencies.persistence.updateSourceTranslationIfCurrent(transaction, { productVersionId: draft.productVersionId, locale: draft.sourceLocale, expectedUpdatedAt: normalized.expectedSourceTranslationUpdatedAt, values })) throw fail("CONFLICT", "DRAFT_TRANSLATION_CONTENT_STALE_WRITE", context.correlationId);
        await dependencies.persistence.insertProductUpdatedAuditEvent(transaction, { organizationId: product.organizationId, actorId: context.userId, productId: product.productId, changedFields, correlationId: context.correlationId });
        return { productId: product.productId, status: "UPDATED" as const };
      });
    } catch (error) {
      if (error instanceof ApplicationError && trusted.has(error)) throw error;
      throw fail("INTERNAL", "DRAFT_TRANSLATION_CONTENT_OPERATIONAL_FAILURE", context?.correlationId);
    }
  };
}
