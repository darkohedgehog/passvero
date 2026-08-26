import type {
  ProductLifecycleStatus,
  ProductVersionStatus,
} from "@/src/application/products/list-products/contracts";

export interface ProductListCursor {
  readonly productId: string;
  readonly updatedAt: Date;
}

export interface ProductListVersionRecord {
  readonly status: ProductVersionStatus;
  readonly sourceLocale: string;
}

export interface ProductListRecord {
  readonly organizationId: string;
  readonly productId: string;
  readonly internalName: string;
  readonly sku: string | null;
  readonly lifecycleStatus: ProductLifecycleStatus;
  readonly currentDraftVersion: ProductListVersionRecord | null;
  readonly currentPublishedVersion: ProductListVersionRecord | null;
  readonly updatedAt: Date;
}

export interface ListProductsPersistence {
  listPage(input: {
    readonly organizationId: string;
    readonly after: ProductListCursor | null;
    readonly take: 26;
  }): Promise<readonly ProductListRecord[]>;
}
