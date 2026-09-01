import type { AuthenticatedUserContext } from "@/src/application/context/authenticated-user-context";

export const PRODUCT_MATERIAL_EDITABLE_FIELDS = [
  "materialName",
  "category",
  "percentage",
  "isRecycled",
  "recycledPercentage",
] as const;

export type ProductMaterialEditableField = typeof PRODUCT_MATERIAL_EDITABLE_FIELDS[number];

export interface ProductMaterialValues {
  readonly materialName: string;
  readonly category: string | null;
  readonly percentage: string | null;
  readonly isRecycled: boolean;
  readonly recycledPercentage: string | null;
}

export interface ProductMaterialConcurrencyEvidence {
  readonly expectedDraftVersionId: string;
  readonly expectedProductUpdatedAt: string;
  readonly expectedDraftUpdatedAt: string;
}

export interface AddProductMaterialCommand
extends ProductMaterialValues, ProductMaterialConcurrencyEvidence {
  readonly productId: string;
}

export interface EditProductMaterialCommand
extends AddProductMaterialCommand {
  readonly materialId: string;
  readonly expectedMaterialUpdatedAt: string;
}

export interface RemoveProductMaterialCommand
extends ProductMaterialConcurrencyEvidence {
  readonly productId: string;
  readonly materialId: string;
  readonly expectedMaterialUpdatedAt: string;
}

export interface CurrentDraftMaterial extends ProductMaterialValues {
  readonly materialId: string;
  readonly updatedAt: Date;
}

export interface CurrentDraftMaterialsResult {
  readonly productId: string;
  readonly materials: readonly CurrentDraftMaterial[];
  readonly expectedDraftVersionId: string;
  readonly expectedProductUpdatedAt: Date;
  readonly expectedDraftUpdatedAt: Date;
}

export type GetCurrentDraftMaterials = (
  query: { readonly productId: string },
  context: AuthenticatedUserContext | null,
) => Promise<CurrentDraftMaterialsResult>;

export type AddProductMaterial = (
  command: AddProductMaterialCommand,
  context: AuthenticatedUserContext | null,
) => Promise<{ readonly productId: string; readonly status: "ADDED" }>;

export type EditProductMaterial = (
  command: EditProductMaterialCommand,
  context: AuthenticatedUserContext | null,
) => Promise<{ readonly productId: string; readonly status: "UPDATED" | "NO_CHANGE" }>;

export type RemoveProductMaterial = (
  command: RemoveProductMaterialCommand,
  context: AuthenticatedUserContext | null,
) => Promise<{ readonly productId: string; readonly status: "REMOVED" }>;
