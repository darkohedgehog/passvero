import { z } from "zod";
import type { AuthenticatedUserContext } from "../../context/authenticated-user-context";
import { ApplicationError } from "../../errors/application-error";
import { hasProductPermission } from "../../permissions/product-permissions";
import { gtinCommandSchema, type GtinDependencies } from "./contracts";

export function gtinError(category: ApplicationError["category"], code: string) {
  return new ApplicationError(category, code, "The GTIN request could not be completed.", false);
}
export function createGtinServices<Tx>(deps: GtinDependencies<Tx>) {
  async function execute(productId: string, context: AuthenticatedUserContext | null, input?: unknown) {
    if (!context || context.membershipStatus !== "ACTIVE" || !hasProductPermission(context, input === undefined ? "PRODUCT_READ" : "PRODUCT_EDIT")) throw gtinError("FORBIDDEN", "FORBIDDEN");
    if (!z.uuid().safeParse(productId).success) throw gtinError("VALIDATION", "VALIDATION_ERROR");
    const parsed = input === undefined ? null : gtinCommandSchema.safeParse(input);
    if (parsed && !parsed.success) throw gtinError("VALIDATION", "VALIDATION_ERROR");
    const command = parsed?.success ? parsed.data : null;
    try {
      return await deps.run(async tx => {
        await deps.persistence.authorize(tx, context, command !== null);
        const state = await deps.persistence.load(tx, productId, context.organizationId, command !== null);
        if (!state) throw gtinError("NOT_FOUND", "NOT_FOUND");
        if (command) {
          const draft = state.draft;
          if (state.lifecycleStatus !== "ACTIVE" || !draft || draft.productId !== productId || draft.organizationId !== context.organizationId || !["DRAFT", "READY_FOR_REVIEW"].includes(draft.status)) throw gtinError("INVALID_STATE", "NOT_EDITABLE");
          if (draft.id !== command.expectedDraftVersionId || draft.updatedAt !== command.expectedDraftUpdatedAt || state.updatedAt !== command.expectedProductUpdatedAt) throw gtinError("CONFLICT", "STALE_WRITE");
          await deps.persistence.write(tx, productId, context, command);
        }
        return state;
      });
    } catch (error) {
      if (error instanceof ApplicationError) throw error;
      throw gtinError("INTERNAL", "OPERATIONAL_FAILURE");
    }
  }
  return {
    get: (id: string, context: AuthenticatedUserContext | null) => execute(id, context),
    mutate: async (id: string, input: unknown, context: AuthenticatedUserContext | null) => {
      // Undefined is a read sentinel internally, never an accepted mutation.
      if (input === undefined) throw gtinError("VALIDATION", "VALIDATION_ERROR");
      await execute(id, context, input); return { status: "UPDATED" as const };
    },
  };
}
