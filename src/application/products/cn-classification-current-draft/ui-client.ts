import type { CnClassificationEditableField } from "@/src/application/products/cn-classification-current-draft/contracts";

type Evidence = Readonly<{ expectedDraftVersionId: string; expectedProductUpdatedAt: string; expectedDraftUpdatedAt: string }>;
export type CnClassificationMutationPayload =
  | (Evidence & Readonly<{ operation: "ADD"; value: string; nomenclatureYear: number }>)
  | (Evidence & Readonly<{ operation: "EDIT"; identifierId: string; value: string; nomenclatureYear: number; expectedIdentifierUpdatedAt: string }>)
  | (Evidence & Readonly<{ operation: "REMOVE"; identifierId: string; expectedIdentifierUpdatedAt: string }>);

export type CnClassificationMutationUiResult =
  | { readonly status: "SUCCESS" }
  | { readonly status: "FIELD_ERROR"; readonly field: CnClassificationEditableField }
  | { readonly status: "STALE_WRITE" | "DRAFT_NOT_EDITABLE" | "CN_CONFLICT" | "FORBIDDEN" | "FAILURE" };

export async function mutateCnClassificationFromDashboard(fetcher: typeof fetch, productId: string, payload: CnClassificationMutationPayload): Promise<CnClassificationMutationUiResult> {
  try {
    const response = await fetcher(`/api/products/${encodeURIComponent(productId)}/cn-classification`, {
      method: "POST", credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer",
      headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
    });
    const value: unknown = await response.json();
    if (!isRecord(value)) return { status: "FAILURE" };
    if (response.ok && ["ADDED", "UPDATED", "NO_CHANGE", "REMOVED"].includes(String(value.status))) return { status: "SUCCESS" };
    if (value.status === "VALIDATION_ERROR" && (value.field === "value" || value.field === "nomenclatureYear")) return { status: "FIELD_ERROR", field: value.field };
    if (value.status === "STALE_WRITE" || value.status === "DRAFT_NOT_EDITABLE" || value.status === "CN_CONFLICT" || value.status === "FORBIDDEN") return { status: value.status };
    if (value.status === "NOT_FOUND") return { status: "DRAFT_NOT_EDITABLE" };
  } catch {
    // CN mutations are deliberately never retried automatically.
  }
  return { status: "FAILURE" };
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
