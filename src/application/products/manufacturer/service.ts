import { z } from "zod";
import type { AuthenticatedUserContext } from "../../context/authenticated-user-context";
import { ApplicationError } from "../../errors/application-error";
import { hasProductPermission } from "../../permissions/product-permissions";
import { manufacturerCommandSchema, type ManufacturerDependencies } from "./contracts";
export function manufacturerError(category: ApplicationError["category"], code: string) {
  return new ApplicationError(category, code, "The manufacturer request could not be completed.", false);
}
export function createManufacturerServices<Tx>(deps: ManufacturerDependencies<Tx>) {
  async function execute(productId: string, context: AuthenticatedUserContext | null, input?: unknown) {
    if (!context || context.membershipStatus !== "ACTIVE" || !hasProductPermission(context, input === undefined ? "PRODUCT_READ" : "PRODUCT_EDIT")) throw manufacturerError("FORBIDDEN", "FORBIDDEN");
    if (!z.uuid().safeParse(productId).success) throw manufacturerError("VALIDATION", "VALIDATION_ERROR");
    const parsed = input === undefined ? null : manufacturerCommandSchema.safeParse(input);
    if (parsed && !parsed.success) throw manufacturerError("VALIDATION", "VALIDATION_ERROR");
    const command = parsed?.success ? parsed.data : null;
    try {
      return await deps.run(async tx => {
        await deps.persistence.authorize(tx, context, command !== null);
        const state = await deps.persistence.load(tx, productId, context.organizationId, command !== null);
        if (!state) throw manufacturerError("NOT_FOUND", "NOT_FOUND");
        if (command) {
          if (state.lifecycleStatus !== "ACTIVE") throw manufacturerError("INVALID_STATE", "NOT_EDITABLE");
          if (state.updatedAt !== command.expectedProductUpdatedAt) throw manufacturerError("CONFLICT", "STALE_WRITE");
          if (command.operation === "APPLY" || command.operation === "REMOVE") {
          const draft = state.draft;
          if (state.lifecycleStatus !== "ACTIVE" || !draft || draft.productId !== productId || draft.organizationId !== context.organizationId || !["DRAFT", "READY_FOR_REVIEW"].includes(draft.status)) throw manufacturerError("INVALID_STATE", "NOT_EDITABLE");
          if (draft.id !== command.expectedDraftVersionId || draft.updatedAt !== command.expectedDraftUpdatedAt || state.updatedAt !== command.expectedProductUpdatedAt) throw manufacturerError("CONFLICT", "STALE_WRITE");
          }
          await deps.persistence.write(tx, productId, context, command);
        }
        return state;
      });
    } catch (error) {
      if (error instanceof ApplicationError) throw error;
      throw manufacturerError("INTERNAL", "OPERATIONAL_FAILURE");
    }
  }
  return { get: (id: string, context: AuthenticatedUserContext | null) => execute(id, context),
    mutate: async (id: string, input: unknown, context: AuthenticatedUserContext | null) => { await execute(id, context, input); return { status: "UPDATED" }; } };
}
