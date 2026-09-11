import { ApplicationError } from "../../errors/application-error";
import type { AuthenticatedUserContext } from "../../context/authenticated-user-context";
import { hasProductPermission, roleHasProductPermission, PRODUCT_EDIT, PRODUCT_READ } from "../../permissions/product-permissions";
import { isPassveroLocale } from "@/src/domain/values/passvero-locale";
import { emptyTranslation, normalizeTranslation } from "./content";
import { TranslationConflict, type TranslationDependencies, type TranslationState, type MutateTranslation } from "./contracts";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function timestamp(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) throw new Error("Invalid timestamp.");
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) throw new Error("Invalid timestamp.");
  return date;
}

export function createTranslationManagementServices<Tx>(deps: TranslationDependencies<Tx>) {
  async function execute<R>(context: AuthenticatedUserContext | null, edit: boolean, work: (tx: Tx, ctx: AuthenticatedUserContext, fail: Fail) => Promise<R>): Promise<R> {
    const trusted = new WeakSet<ApplicationError>();
    const fail: Fail = (category, suffix) => {
      const error = new ApplicationError(category, `TRANSLATION_${suffix}`, "The translation request could not be completed.", false, context?.correlationId);
      trusted.add(error); return error;
    };
    try {
      const permission = edit ? PRODUCT_EDIT : PRODUCT_READ;
      if (!context) throw fail("UNAUTHENTICATED", "UNAUTHENTICATED");
      if (context.membershipStatus !== "ACTIVE" || !hasProductPermission(context, permission)) throw fail("FORBIDDEN", "FORBIDDEN");
      return await deps.transactionRunner.run(async tx => {
        const eligibility = await deps.persistence.readEligibility(tx, context);
        if (!eligibility || eligibility.organizationStatus !== "ACTIVE" || eligibility.membershipStatus !== "ACTIVE" || !roleHasProductPermission(eligibility.membershipRole, permission)) throw fail("FORBIDDEN", "FORBIDDEN");
        return work(tx, context, fail);
      });
    } catch (error) {
      if (error instanceof ApplicationError && trusted.has(error)) throw error;
      if (error instanceof TranslationConflict) throw fail("CONFLICT", "CONFLICT");
      throw fail("INTERNAL", "OPERATIONAL_FAILURE");
    }
  }
  async function load(tx: Tx, ctx: AuthenticatedUserContext, productId: string, lock: boolean, fail: Fail): Promise<TranslationState> {
    if (!uuid.test(productId)) throw fail("VALIDATION", "VALIDATION_ERROR");
    const state = await deps.persistence.readState(tx, { productId, organizationId: ctx.organizationId, lock });
    if (!state) throw fail("NOT_FOUND", "NOT_FOUND");
    if (state.productId !== productId || state.organizationId !== ctx.organizationId) throw fail("INTERNAL", "INVARIANT_FAILURE");
    for (const [pointer, version, statuses] of [
      [state.currentDraftVersionId, state.draft, ["DRAFT", "READY_FOR_REVIEW"]],
      [state.currentPublishedVersionId, state.published, ["PUBLISHED"]],
    ] as const) {
      if (pointer === null && version === null) continue;
      if (!version || pointer !== version.productVersionId || version.productId !== productId || version.organizationId !== ctx.organizationId || !(statuses as readonly string[]).includes(version.status) || !isPassveroLocale(version.sourceLocale)) throw fail("INTERNAL", "INVARIANT_FAILURE");
      if (version.translations.filter(t => t.locale === version.sourceLocale).length !== 1
        || new Set(version.translations.map(t=>t.locale)).size !== version.translations.length
        || version.translations.some(t => t.productVersionId !== version.productVersionId || !isPassveroLocale(t.locale))) throw fail("INTERNAL", "INVARIANT_FAILURE");
    }
    return state;
  }
  const mutate: MutateTranslation = (command, context) => execute(context, true, async (tx, ctx, fail) => {
    let productAt: Date, draftAt: Date, translationAt: Date | null;
    let content;
    try {
      if (!uuid.test(command.productId) || !uuid.test(command.expectedDraftVersionId) || !isPassveroLocale(command.locale) || !["ADD","EDIT","REMOVE"].includes(command.operation)) throw new Error();
      productAt = timestamp(command.expectedProductUpdatedAt); draftAt = timestamp(command.expectedDraftUpdatedAt);
      translationAt = command.operation === "ADD" ? null : timestamp(command.expectedTranslationUpdatedAt);
      if (command.operation !== "ADD" && !uuid.test(command.translationId)) throw new Error();
      content = command.operation === "EDIT" ? normalizeTranslation(command.content) : emptyTranslation();
    } catch { throw fail("VALIDATION", "VALIDATION_ERROR"); }
    const state = await load(tx, ctx, command.productId, true, fail);
    const draft = state.draft;
    if (state.lifecycleStatus !== "ACTIVE" || !draft) throw fail("INVALID_STATE", "NOT_EDITABLE");
    if (draft.productVersionId !== command.expectedDraftVersionId || state.updatedAt.getTime() !== productAt.getTime() || draft.updatedAt.getTime() !== draftAt.getTime()) throw fail("CONFLICT", "STALE_WRITE");
    const row = draft.translations.find(t=>t.locale===command.locale);
    if (command.operation === "ADD") {
      if (row) throw fail("CONFLICT", "CONFLICT");
    } else {
      if (!row || row.id !== command.translationId || row.updatedAt.getTime() !== translationAt!.getTime()) throw fail("CONFLICT", "STALE_WRITE");
      if (command.locale === draft.sourceLocale && (command.operation === "REMOVE" || content.productName !== row.productName)) throw fail("INVALID_STATE", "SOURCE_PROTECTED");
      if (command.operation === "EDIT" && Object.entries(content).every(([key,value])=>row[key as keyof typeof content] === value)) return {status:"NO_CHANGE"};
    }
    const touched = await deps.persistence.touch(tx, { productId: state.productId, organizationId: state.organizationId, draftId: draft.productVersionId, productAt, draftAt, actorId: ctx.userId });
    if (!touched) throw fail("CONFLICT", "STALE_WRITE");
    if (command.operation === "ADD") await deps.persistence.add(tx, { draftId: draft.productVersionId, locale: command.locale, content });
    else {
      const target = { draftId: draft.productVersionId, locale: command.locale, translationId: command.translationId, expectedAt: translationAt! };
      const changed = command.operation === "EDIT" ? await deps.persistence.edit(tx, {...target,content}) : await deps.persistence.remove(tx,target);
      if (!changed) throw fail("CONFLICT", "STALE_WRITE");
    }
    await deps.persistence.audit(tx, { productId: state.productId, organizationId: state.organizationId, actorId: ctx.userId, operation: command.operation, locale: command.locale, correlationId: ctx.correlationId });
    return { status: command.operation === "ADD" ? "ADDED" : command.operation === "EDIT" ? "UPDATED" : "REMOVED" };
  });
  return { mutate, get: (productId: string, context: AuthenticatedUserContext | null) => execute(context, false, (tx,ctx,fail)=>load(tx,ctx,productId,false,fail)) };
}
type Fail = (category: ApplicationError["category"], suffix: string) => ApplicationError;
