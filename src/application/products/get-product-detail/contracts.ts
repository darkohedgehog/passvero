import type { AuthenticatedUserContext } from "@/src/application/context/authenticated-user-context";
import type {
  ProductLifecycleStatus,
  ProductVersionStatus,
} from "@/src/application/products/list-products/contracts";

export interface GetProductDetailQuery {
  readonly productId: string;
}

export interface ProductDetailDraft {
  readonly productVersionId: string;
  readonly status: Extract<ProductVersionStatus, "DRAFT" | "READY_FOR_REVIEW">;
  readonly sourceLocale: string;
  readonly sourceProductName: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProductDetailPublished {
  readonly productVersionId: string;
  readonly status: Extract<ProductVersionStatus, "PUBLISHED">;
  readonly sourceLocale: string;
  readonly sourceProductName: string;
  readonly versionNumber: number | null;
  readonly publishedAt: Date | null;
}

export interface ProductDetailResult {
  readonly productId: string;
  readonly internalName: string;
  readonly organizationSku: string | null;
  readonly publicCode: string;
  readonly lifecycleStatus: ProductLifecycleStatus;
  readonly currentDraft: ProductDetailDraft | null;
  readonly currentPublished: ProductDetailPublished | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type GetProductDetail = (
  query: GetProductDetailQuery,
  context: AuthenticatedUserContext | null,
) => Promise<ProductDetailResult>;
