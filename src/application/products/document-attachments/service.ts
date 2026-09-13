import { z } from "zod";
import { ApplicationError } from "../../errors/application-error";
import { hasProductPermission, roleHasProductPermission, PRODUCT_EDIT } from "../../permissions/product-permissions";
import { attachmentCommandSchema, type AttachmentDependencies, type MutateAttachment } from "./contracts";

export function createAttachmentService<Tx>(deps: AttachmentDependencies<Tx>): MutateAttachment {
  return async (productId, input, context) => {
    const trusted = new WeakSet<ApplicationError>();
    const fail = (category: ApplicationError["category"], code: string) => {
      const error = new ApplicationError(category, code, "The document attachment request could not be completed.", false, context?.correlationId);
      trusted.add(error); return error;
    };
    try {
      if (!context) throw fail("UNAUTHENTICATED", "FORBIDDEN");
      if (context.membershipStatus !== "ACTIVE" || !hasProductPermission(context, PRODUCT_EDIT)) throw fail("FORBIDDEN", "FORBIDDEN");
      const parsed = attachmentCommandSchema.safeParse(input);
      if (!parsed.success || !z.uuid().safeParse(productId).success) throw fail("VALIDATION", "VALIDATION_ERROR");
      const command = parsed.data;
      return await deps.transactionRunner.run(async tx => {
        const state = await deps.persistence.lockState(tx, productId, context.organizationId);
        const eligibility = await deps.persistence.readEligibility(tx, context);
        if (!eligibility || eligibility.organizationStatus !== "ACTIVE" || eligibility.membershipStatus !== "ACTIVE" || !roleHasProductPermission(eligibility.membershipRole, PRODUCT_EDIT)) throw fail("FORBIDDEN", "FORBIDDEN");
        if (!state) throw fail("NOT_FOUND", "NOT_FOUND");
        if (state.id !== productId || state.organizationId !== context.organizationId) throw fail("INTERNAL", "OPERATIONAL_FAILURE");
        const draft = state.draft;
        if (state.lifecycleStatus !== "ACTIVE" || !draft) throw fail("INVALID_STATE", "NOT_EDITABLE");
        if (draft.id !== state.currentDraftVersionId || draft.productId !== productId || draft.organizationId !== context.organizationId || !["DRAFT", "READY_FOR_REVIEW"].includes(draft.status)) throw fail("INVALID_STATE", "NOT_EDITABLE");
        if (draft.id !== command.expectedDraftVersionId || state.updatedAt.toISOString() !== command.expectedProductUpdatedAt || draft.updatedAt.toISOString() !== command.expectedDraftUpdatedAt) throw fail("CONFLICT", "STALE_WRITE");
        const row = command.operation === "ATTACH" ? null : draft.attachments.find(r => r.id === command.attachmentId);
        if (command.operation !== "ATTACH" && (!row || row.productVersionId !== draft.id || row.updatedAt.toISOString() !== command.expectedAttachmentUpdatedAt)) throw fail("CONFLICT", "STALE_WRITE");
        const documentId = command.operation === "ATTACH" ? command.documentId : row!.documentId;
        // Removing an unavailable owned asset link is allowed so a draft can be repaired.
        const document = await deps.persistence.readDocument(tx, documentId, context.organizationId);
        if (!document) throw fail("NOT_FOUND", "NOT_FOUND");
        if (command.operation !== "REMOVE" && document.status !== "AVAILABLE") throw fail("INVALID_STATE", "DOCUMENT_UNAVAILABLE");
        if (command.operation !== "REMOVE") {
          const duplicate = draft.attachments.some(r => r.id !== row?.id && r.documentId === documentId && r.category === command.metadata.category && r.locale === command.metadata.locale);
          if (duplicate) throw fail("CONFLICT", "DUPLICATE_ATTACHMENT");
          if (command.operation === "EDIT" && row && command.sortOrder === row.sortOrder && Object.entries(command.metadata).every(([key, value]) => row[key as keyof typeof command.metadata] === value)) return { status: "NO_CHANGE" };
        }
        const productAt = new Date(command.expectedProductUpdatedAt), draftAt = new Date(command.expectedDraftUpdatedAt);
        if (!await deps.persistence.touch(tx, { productId, organizationId: context.organizationId, draftId: draft.id, productAt, draftAt, actorId: context.userId })) throw fail("CONFLICT", "STALE_WRITE");
        if (command.operation === "ATTACH") {
          const max = draft.attachments.reduce((n, r) => Math.max(n, r.sortOrder), -1);
          if (!Number.isInteger(max) || max >= 2147483647) throw fail("INVALID_STATE", "ORDER_LIMIT");
          await deps.persistence.attach(tx, draft.id, documentId, command.metadata, max + 1);
        } else {
          const changed = command.operation === "EDIT"
            ? await deps.persistence.edit(tx, draft.id, row!, command.metadata, command.sortOrder)
            : await deps.persistence.remove(tx, draft.id, row!);
          if (!changed) throw fail("CONFLICT", "STALE_WRITE");
        }
        await deps.persistence.audit(tx, context, productId, command.operation);
        return { status: command.operation === "ATTACH" ? "ATTACHED" : command.operation === "EDIT" ? "UPDATED" : "REMOVED" };
      });
    } catch (error) {
      if (error instanceof ApplicationError && trusted.has(error)) throw error;
      throw fail("INTERNAL", "OPERATIONAL_FAILURE");
    }
  };
}
