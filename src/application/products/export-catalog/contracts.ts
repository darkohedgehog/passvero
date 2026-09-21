import type { AuthenticatedUserContext } from "@/src/application/context/authenticated-user-context";

export interface CatalogVersion {
  readonly organizationId: string;
  readonly productId: string;
  readonly versionNumber: number | null;
  readonly status: string;
  readonly sourceLocale: string;
  readonly updatedAt: Date;
  readonly identifiers: readonly { readonly type: string; readonly value: string; readonly nomenclatureYear: number | null }[];
  readonly manufacturer: { readonly organizationId: string; readonly name: string; readonly countryCode: string } | null;
}
export interface CatalogRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly internalName: string;
  readonly sku: string | null;
  readonly lifecycleStatus: string;
  readonly updatedAt: Date;
  readonly currentDraftVersion: CatalogVersion | null;
  readonly currentPublishedVersion: CatalogVersion | null;
}
export interface CatalogExportPersistence {
  // Callback finishes inside a single read snapshot; nothing is sent to the browser here.
  readSnapshot(organizationId: string, search: string, consume: (rows: readonly CatalogRecord[]) => void | Promise<void>): Promise<void>;
}
export type ExportCatalog = (search: unknown, context: AuthenticatedUserContext | null) => Promise<Uint8Array<ArrayBuffer>>;
export class CatalogExportError extends Error {
  constructor(readonly code: "FORBIDDEN" | "INVALID_SEARCH" | "LIMIT" | "FAILED") { super(code); }
}
export const MAX_EXPORT_ROWS = 10_000;
export const MAX_EXPORT_BYTES = 20 * 1024 * 1024;
export const EXPORT_TIMEOUT_MS = 15_000;
