import { ApplicationError } from "@/src/application/errors/application-error";
import { hasProductPermission, PRODUCT_EDIT } from "@/src/application/permissions/product-permissions";
import { DRAFT_TRANSLATION_CONTENT_FIELDS, type GetDraftTranslationContentForEdit } from "@/src/application/products/draft-translation-content/contracts";
import type { GetDraftTranslationContentPersistence } from "@/src/application/products/draft-translation-content/ports";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function createGetDraftTranslationContentForEditService(dependencies: { readonly persistence: GetDraftTranslationContentPersistence }): GetDraftTranslationContentForEdit {
  return async ({ productId }, context) => {
    const error = (category: ApplicationError["category"], code: string) => new ApplicationError(category, code, category === "NOT_FOUND" ? "The requested product was not found." : "The draft content request could not be completed.", false, context?.correlationId);
    if (context === null) throw error("UNAUTHENTICATED", "GET_DRAFT_TRANSLATION_CONTENT_UNAUTHENTICATED");
    if (context.membershipStatus !== "ACTIVE" || !hasProductPermission(context, PRODUCT_EDIT)) throw error("FORBIDDEN", "GET_DRAFT_TRANSLATION_CONTENT_FORBIDDEN");
    if (!UUID.test(productId)) throw error("VALIDATION", "GET_DRAFT_TRANSLATION_CONTENT_ID_INVALID");
    let record;
    try { record = await dependencies.persistence.findByIdAndOrganization({ productId, organizationId: context.organizationId }); }
    catch { throw error("INTERNAL", "GET_DRAFT_TRANSLATION_CONTENT_OPERATIONAL_FAILURE"); }
    if (record === null) throw error("NOT_FOUND", "GET_DRAFT_TRANSLATION_CONTENT_NOT_FOUND");
    if (record.productId !== productId || record.organizationId !== context.organizationId) throw error("INTERNAL", "GET_DRAFT_TRANSLATION_CONTENT_INVARIANT_FAILURE");
    if (record.lifecycleStatus !== "ACTIVE" || record.currentDraftVersionId === null) throw error("INVALID_STATE", "GET_DRAFT_TRANSLATION_CONTENT_NOT_EDITABLE");
    const draft = record.currentDraftVersion;
    if (draft === null || draft.productVersionId !== record.currentDraftVersionId || draft.productId !== record.productId || draft.organizationId !== record.organizationId) throw error("INTERNAL", "GET_DRAFT_TRANSLATION_CONTENT_INVARIANT_FAILURE");
    if (draft.status !== "DRAFT" && draft.status !== "READY_FOR_REVIEW") throw error("INVALID_STATE", "GET_DRAFT_TRANSLATION_CONTENT_NOT_EDITABLE");
    const translation = draft.sourceTranslation;
    if (translation === null || translation.productVersionId !== draft.productVersionId || translation.locale !== draft.sourceLocale) throw error("INTERNAL", "GET_DRAFT_TRANSLATION_CONTENT_INVARIANT_FAILURE");
    const values = Object.fromEntries(DRAFT_TRANSLATION_CONTENT_FIELDS.map((field) => [field, translation[field]]));
    return { productId: record.productId, sourceLocale: draft.sourceLocale, ...values, expectedDraftVersionId: draft.productVersionId, expectedProductUpdatedAt: record.updatedAt, expectedDraftUpdatedAt: draft.updatedAt, expectedSourceTranslationUpdatedAt: translation.updatedAt } as Awaited<ReturnType<GetDraftTranslationContentForEdit>>;
  };
}
