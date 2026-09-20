import { ApplicationError } from "@/src/application/errors/application-error";
import { hasProductPermission, PRODUCT_EDIT, roleHasProductPermission } from "@/src/application/permissions/product-permissions";
import { isPassveroLocale } from "@/src/domain/values/passvero-locale";
import type { CreateDraftFromPublished, CreateDraftFromPublishedCommand } from "./contracts";
import { DraftCreationConflict, type CreateDraftFromPublishedDependencies } from "./ports";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function validCreateDraftCommand(value: CreateDraftFromPublishedCommand): boolean {
  const keys = ["productId", "expectedCurrentPublishedVersionId", "expectedProductUpdatedAt"];
  if (Object.keys(value).length !== 3 || Object.keys(value).some(key => !keys.includes(key))) return false;
  if (typeof value.productId !== "string" || !UUID.test(value.productId)
    || typeof value.expectedCurrentPublishedVersionId !== "string" || !UUID.test(value.expectedCurrentPublishedVersionId)
    || typeof value.expectedProductUpdatedAt !== "string") return false;
  const at = new Date(value.expectedProductUpdatedAt);
  return Number.isFinite(at.getTime()) && at.toISOString() === value.expectedProductUpdatedAt;
}

export function createDraftFromPublishedService<T>(dependencies: CreateDraftFromPublishedDependencies<T>): CreateDraftFromPublished {
  return async (command, context) => {
    const trusted = new WeakSet<ApplicationError>();
    const fail = (category: ApplicationError["category"], suffix: string) => {
      const error = new ApplicationError(category, `CREATE_DRAFT_${suffix}`,
        suffix === "IMAGES_UNSUPPORTED"
          ? "Editing published products with images is not supported yet. The published product has not changed."
          : "The draft could not be opened. Reload the product and try again.", false, context?.correlationId);
      trusted.add(error);
      return error;
    };
    try {
      if (context === null) throw fail("UNAUTHENTICATED", "FORBIDDEN");
      if (context.membershipStatus !== "ACTIVE" || !hasProductPermission(context, PRODUCT_EDIT)) throw fail("FORBIDDEN", "FORBIDDEN");
      if (!validCreateDraftCommand(command)) throw fail("VALIDATION", "VALIDATION_ERROR");
      return await dependencies.transactionRunner.run(async tx => {
        const membership = await dependencies.persistence.readEligibility(tx, context);
        if (membership === null || membership.organizationStatus !== "ACTIVE" || membership.membershipStatus !== "ACTIVE"
          || !roleHasProductPermission(membership.membershipRole, PRODUCT_EDIT)) throw fail("FORBIDDEN", "FORBIDDEN");
        // Same Product row lock as publication: a concurrent caller observes the winner.
        const product = await dependencies.persistence.readProductForPublication(tx, { productId: command.productId, organizationId: context.organizationId });
        if (product === null) throw fail("NOT_FOUND", "NOT_FOUND");
        if (product.productId !== command.productId || product.organizationId !== context.organizationId) throw fail("INTERNAL", "INVARIANT_FAILURE");
        if (product.lifecycleStatus !== "ACTIVE" || product.currentPublishedVersionId === null) throw fail("INVALID_STATE", "INVALID_STATE");
        if (product.currentPublishedVersionId !== command.expectedCurrentPublishedVersionId) throw fail("CONFLICT", "CONFLICT");
        const versionInput = { productId: product.productId, organizationId: product.organizationId };
        const source = await dependencies.persistence.readVersion(tx, { ...versionInput, productVersionId: product.currentPublishedVersionId });
        if (source === null || source.productVersionId !== product.currentPublishedVersionId || source.productId !== product.productId
          || source.organizationId !== product.organizationId || source.status !== "PUBLISHED" || !isPassveroLocale(source.sourceLocale)
          || source.versionNumber === null || !Number.isSafeInteger(source.versionNumber) || source.versionNumber < 1
          || source.publishedAt === null || source.publishedById === null || source.supersededAt !== null || source.discardedAt !== null) throw fail("INVALID_STATE", "INVALID_STATE");
        const copy = await dependencies.persistence.readCopyEligibility(tx, { productVersionId: source.productVersionId, organizationId: source.organizationId, sourceLocale: source.sourceLocale });
        // All image associations clone onto immutable, tenant-owned assets.
        if (!copy.imageReferencesValid) throw fail("INVALID_STATE", "INVALID_STATE");
        if (!Number.isSafeInteger(copy.imageCount) || copy.imageCount < 0 || !copy.sourceTranslationValid || !copy.documentOwnershipValid) throw fail("INVALID_STATE", "INVALID_STATE");
        if (product.currentDraftVersionId !== null) {
          const draft = await dependencies.persistence.readVersion(tx, { ...versionInput, productVersionId: product.currentDraftVersionId });
          if (draft === null || draft.productVersionId !== product.currentDraftVersionId || draft.productId !== product.productId
            || draft.organizationId !== product.organizationId || (draft.status !== "DRAFT" && draft.status !== "READY_FOR_REVIEW")
            || draft.clonedFromVersionId !== source.productVersionId || draft.sourceLocale !== source.sourceLocale
            || draft.versionNumber !== null || draft.publishedAt !== null || draft.publishedById !== null
            || draft.supersededAt !== null || draft.discardedAt !== null) throw fail("CONFLICT", "CONFLICT");
          return { status: "EXISTING_DRAFT" as const };
        }
        if (product.updatedAt.toISOString() !== command.expectedProductUpdatedAt) throw fail("CONFLICT", "CONFLICT");
        await dependencies.persistence.createDraft(tx, {
          ...versionInput, sourceVersionId: source.productVersionId, sourceLocale: source.sourceLocale,
          expectedProductUpdatedAt: product.updatedAt, actorId: context.userId, correlationId: context.correlationId,
        });
        return { status: "CREATED_NEW_DRAFT" as const };
      });
    } catch (error) {
      if (error instanceof ApplicationError && trusted.has(error)) throw error;
      if (error instanceof DraftCreationConflict) throw fail("CONFLICT", "CONFLICT");
      throw fail("INTERNAL", "OPERATIONAL_FAILURE");
    }
  };
}
