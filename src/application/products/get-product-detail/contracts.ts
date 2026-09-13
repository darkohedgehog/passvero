import type { AuthenticatedUserContext } from "@/src/application/context/authenticated-user-context";
import type { PublicDppCn, PublicDppMaterial, PublicDppTranslation } from "@/src/application/public-dpp/contracts";
import type {
  ProductLifecycleStatus,
  ProductVersionStatus,
} from "@/src/application/products/list-products/contracts";

export interface GetProductDetailQuery {
  readonly productId: string;
}

export interface ProductDetailSnapshot {
  readonly documents: readonly import("../document-attachments/contracts").AttachmentDto[];
  readonly content: PublicDppTranslation;
  readonly cn: PublicDppCn | null;
  readonly materials: readonly PublicDppMaterial[];
}

export interface ProductDetailDraft extends ProductDetailSnapshot {
  readonly kind: "CURRENT_DRAFT";
  readonly productVersionId: string;
  readonly status: Extract<ProductVersionStatus, "DRAFT" | "READY_FOR_REVIEW">;
  readonly sourceLocale: string;
  readonly sourceProductName: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProductDetailPublished extends ProductDetailSnapshot {
  readonly kind: "CURRENT_PUBLISHED";
  readonly productVersionId: string;
  readonly status: Extract<ProductVersionStatus, "PUBLISHED">;
  readonly sourceLocale: string;
  readonly sourceProductName: string;
  readonly versionNumber: number;
  readonly publishedAt: Date;
}

export interface ProductDetailResult {
  readonly productId: string;
  readonly internalName: string;
  readonly organizationSku: string | null;
  readonly publicCode: string;
  readonly lifecycleStatus: ProductLifecycleStatus;
  readonly publicationState: "DRAFT" | "PUBLISHED" | "CHANGES_IN_DRAFT" | null;
  readonly publicAvailability:
    | { readonly status: "PUBLIC"; readonly url: string }
    | { readonly status: "NOT_PUBLIC" | "WITHDRAWN" };
  readonly currentDraft: ProductDetailDraft | null;
  readonly currentPublished: ProductDetailPublished | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type GetProductDetail = (
  query: GetProductDetailQuery,
  context: AuthenticatedUserContext | null,
) => Promise<ProductDetailResult>;
