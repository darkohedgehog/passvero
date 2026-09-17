import { z } from "zod";
import type { AuthenticatedUserContext } from "../../context/authenticated-user-context";
const text = (max: number) => z.string().trim().min(1).max(max).refine(v => !/[\u0000-\u001f\u007f]/.test(v));
const optional = (max: number) => text(max).nullable();
export const manufacturerSchema = z.object({
  name: text(200), addressLine1: text(200), addressLine2: optional(200), city: text(100),
  region: optional(100), postalCode: optional(32), countryCode: z.string().regex(/^[A-Z]{2}$/),
  publicEmail: z.email().max(254).nullable(),
  website: z.url().max(2048).refine(v => { const u = new URL(v); return ["https:", "http:"].includes(u.protocol) && !u.username && !u.password; }).nullable(),
}).strict();
export type Manufacturer = z.infer<typeof manufacturerSchema>;
export const manufacturerSelect = { name: true, addressLine1: true, addressLine2: true, city: true, region: true, postalCode: true, countryCode: true, publicEmail: true, website: true } as const;
const evidence = { expectedDraftVersionId: z.uuid(), expectedProductUpdatedAt: z.iso.datetime(), expectedDraftUpdatedAt: z.iso.datetime() };
const operator = { operatorId: z.uuid(), expectedOperatorUpdatedAt: z.iso.datetime() };
export const manufacturerCommandSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("CREATE"), expectedProductUpdatedAt: z.iso.datetime(), values: manufacturerSchema }).strict(),
  z.object({ operation: z.literal("UPDATE"), expectedProductUpdatedAt: z.iso.datetime(), ...operator, values: manufacturerSchema }).strict(),
  z.object({ operation: z.literal("APPLY"), ...evidence, ...operator }).strict(),
  z.object({ operation: z.literal("REMOVE"), ...evidence }).strict(),
]);
export type ManufacturerCommand = z.infer<typeof manufacturerCommandSchema>;
export interface Operator extends Manufacturer { id: string; updatedAt: string }
export interface ManufacturerState {
  productId: string; organizationId: string; lifecycleStatus: string; updatedAt: string;
  draft: null | { id: string; productId: string; organizationId: string; status: string; updatedAt: string; snapshot: Manufacturer | null; operatorId: string | null };
  published: Manufacturer | null;
  operators: Operator[];
}
export interface ManufacturerPersistence<Tx> {
  authorize(tx: Tx, context: AuthenticatedUserContext, edit: boolean): Promise<void>;
  load(tx: Tx, productId: string, organizationId: string, lock: boolean): Promise<ManufacturerState | null>;
  write(tx: Tx, productId: string, context: AuthenticatedUserContext, command: ManufacturerCommand): Promise<void>;
}
export interface ManufacturerDependencies<Tx> {
  persistence: ManufacturerPersistence<Tx>;
  run<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
}
