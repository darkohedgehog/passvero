import type { AuthenticatedUserContext } from "@/src/application/context/authenticated-user-context";

export type ProductLifecycleStatus = "ACTIVE" | "ARCHIVED";
export type ProductVersionStatus =
  | "DRAFT"
  | "READY_FOR_REVIEW"
  | "PUBLISHED"
  | "SUPERSEDED"
  | "DISCARDED";

export interface ProductListItem {
  readonly productId: string;
  readonly name: string;
  readonly sku: string | null;
  readonly lifecycleStatus: ProductLifecycleStatus;
  readonly currentVersionStatus: ProductVersionStatus | null;
  readonly sourceLocale: string | null;
  readonly updatedAt: Date;
}

export interface ListProductsQuery {
  readonly cursor?: string | null;
}

export interface ListProductsResult {
  readonly items: readonly ProductListItem[];
  readonly nextCursor: string | null;
}

export type ListProducts = (
  query: ListProductsQuery,
  context: AuthenticatedUserContext | null,
) => Promise<ListProductsResult>;
