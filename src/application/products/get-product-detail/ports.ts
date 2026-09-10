import type { PublicDppMaterial, PublicDppTranslation } from "@/src/application/public-dpp/contracts";
import type {
  ProductLifecycleStatus,
  ProductVersionStatus,
} from "@/src/application/products/list-products/contracts";

export interface ProductDetailTranslationRecord extends PublicDppTranslation {
  readonly productVersionId: string;
  readonly locale: string;
  readonly productName: string;
}

export interface ProductDetailVersionRecord {
  readonly productVersionId: string;
  readonly productId: string;
  readonly organizationId: string;
  readonly status: ProductVersionStatus;
  readonly sourceLocale: string;
  readonly versionNumber: number | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly publishedAt: Date | null;
  readonly translations: readonly ProductDetailTranslationRecord[];
  readonly cnRows: readonly {
    readonly productVersionId: string;
    readonly value: string;
    readonly nomenclatureYear: number | null;
  }[];
  readonly materials: readonly (PublicDppMaterial & { readonly productVersionId: string })[];
}

export interface ProductDetailRecord {
  readonly organizationId: string;
  readonly productId: string;
  readonly internalName: string;
  readonly sku: string | null;
  readonly publicCode: string;
  readonly lifecycleStatus: ProductLifecycleStatus;
  readonly currentDraftVersionId: string | null;
  readonly currentPublishedVersionId: string | null;
  readonly currentDraftVersion: ProductDetailVersionRecord | null;
  readonly currentPublishedVersion: ProductDetailVersionRecord | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface GetProductDetailPersistence {
  findByIdAndOrganization(input: {
    readonly productId: string;
    readonly organizationId: string;
  }): Promise<ProductDetailRecord | null>;
}
