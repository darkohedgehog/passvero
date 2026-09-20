import { z } from "zod";
import type { AuthenticatedUserContext } from "../../context/authenticated-user-context";
import { gtinSchema } from "./validation";

const evidence = { expectedDraftVersionId: z.uuid(), expectedProductUpdatedAt: z.iso.datetime(), expectedDraftUpdatedAt: z.iso.datetime() };
export const gtinCommandSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("SET"), ...evidence, value: gtinSchema }).strict(),
  z.object({ operation: z.literal("REMOVE"), ...evidence }).strict(),
]);
export type GtinCommand = z.infer<typeof gtinCommandSchema>;
export interface GtinState {
  productId: string; organizationId: string; lifecycleStatus: string; updatedAt: string;
  draft: null | { id: string; productId: string; organizationId: string; status: string; updatedAt: string; gtin: string | null };
  published: string | null;
}
export interface GtinPersistence<Tx> {
  authorize(tx: Tx, context: AuthenticatedUserContext, edit: boolean): Promise<void>;
  load(tx: Tx, productId: string, organizationId: string, lock: boolean): Promise<GtinState | null>;
  write(tx: Tx, productId: string, context: AuthenticatedUserContext, command: GtinCommand): Promise<void>;
}
export interface GtinDependencies<Tx> {
  persistence: GtinPersistence<Tx>;
  run<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
}
