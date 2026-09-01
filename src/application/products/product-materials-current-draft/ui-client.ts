import type {
  ProductMaterialEditableField,
} from "@/src/application/products/product-materials-current-draft/contracts";

export type ProductMaterialMutationPayload =
  | Readonly<{
      operation: "ADD";
      materialName: string;
      category: string | null;
      percentage: string | null;
      isRecycled: boolean;
      recycledPercentage: string | null;
      expectedDraftVersionId: string;
      expectedProductUpdatedAt: string;
      expectedDraftUpdatedAt: string;
    }>
  | Readonly<{
      operation: "EDIT";
      materialId: string;
      materialName: string;
      category: string | null;
      percentage: string | null;
      isRecycled: boolean;
      recycledPercentage: string | null;
      expectedDraftVersionId: string;
      expectedProductUpdatedAt: string;
      expectedDraftUpdatedAt: string;
      expectedMaterialUpdatedAt: string;
    }>
  | Readonly<{
      operation: "REMOVE";
      materialId: string;
      expectedDraftVersionId: string;
      expectedProductUpdatedAt: string;
      expectedDraftUpdatedAt: string;
      expectedMaterialUpdatedAt: string;
    }>;

export type ProductMaterialMutationUiResult =
  | { readonly status: "SUCCESS" }
  | { readonly status: "FIELD_ERROR"; readonly field: ProductMaterialEditableField }
  | { readonly status: "STALE_WRITE" | "DRAFT_NOT_EDITABLE" | "COLLECTION_INVALID" | "FORBIDDEN" | "FAILURE" };

export async function mutateProductMaterialFromDashboard(
  fetcher: typeof fetch,
  productId: string,
  payload: ProductMaterialMutationPayload,
): Promise<ProductMaterialMutationUiResult> {
  try {
    const response = await fetcher(`/api/products/${encodeURIComponent(productId)}/materials`, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const value: unknown = await response.json();
    if (typeof value !== "object" || value === null || Array.isArray(value)) return { status: "FAILURE" };
    const result = value as Record<string, unknown>;
    if (response.ok && ["ADDED", "UPDATED", "NO_CHANGE", "REMOVED"].includes(String(result.status))) {
      return { status: "SUCCESS" };
    }
    if (result.status === "VALIDATION_ERROR" && isEditableField(result.field)) {
      return { status: "FIELD_ERROR", field: result.field };
    }
    if (
      result.status === "STALE_WRITE"
      || result.status === "DRAFT_NOT_EDITABLE"
      || result.status === "COLLECTION_INVALID"
      || result.status === "FORBIDDEN"
    ) return { status: result.status };
    if (result.status === "NOT_FOUND") return { status: "DRAFT_NOT_EDITABLE" };
  } catch {
    // The UI deliberately does not retry material mutations.
  }
  return { status: "FAILURE" };
}

function isEditableField(value: unknown): value is ProductMaterialEditableField {
  return value === "materialName"
    || value === "category"
    || value === "percentage"
    || value === "isRecycled"
    || value === "recycledPercentage";
}
