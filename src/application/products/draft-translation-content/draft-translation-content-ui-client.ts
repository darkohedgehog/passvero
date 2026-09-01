import type { DraftTranslationContentField, DraftTranslationContentValues } from "@/src/application/products/draft-translation-content/contracts";

export async function updateDraftTranslationContentFromDashboard(fetcher: typeof fetch, productId: string, payload: DraftTranslationContentValues & Record<"expectedDraftVersionId" | "expectedProductUpdatedAt" | "expectedDraftUpdatedAt" | "expectedSourceTranslationUpdatedAt", string>): Promise<{ status: "SUCCESS" | "STALE_WRITE" | "DRAFT_NOT_EDITABLE" | "FORBIDDEN" | "FAILURE" | "FIELD_ERROR"; field?: DraftTranslationContentField }> {
  try {
    const response = await fetcher(`/api/products/${encodeURIComponent(productId)}/draft-translation-content`, { method: "POST", credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const value: unknown = await response.json();
    if (typeof value !== "object" || value === null) return { status: "FAILURE" };
    const result = value as Record<string, unknown>;
    if (response.ok && result.status === "UPDATED") return { status: "SUCCESS" };
    if (result.status === "VALIDATION_ERROR" && typeof result.field === "string") return { status: "FIELD_ERROR", field: result.field as DraftTranslationContentField };
    if (result.status === "STALE_WRITE" || result.status === "DRAFT_NOT_EDITABLE" || result.status === "FORBIDDEN") return { status: result.status };
    if (result.status === "NOT_FOUND") return { status: "DRAFT_NOT_EDITABLE" };
  } catch {}
  return { status: "FAILURE" };
}
