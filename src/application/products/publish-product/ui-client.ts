export type PublishProductUiResult =
  | { readonly status: "PUBLISHED" | "NO_CHANGE"; readonly versionNumber: number }
  | { readonly status: "NOT_READY"; readonly reason: "SOURCE_TRANSLATION" | "PRODUCT_NAME" | "PUBLIC_ASSET" }
  | { readonly status: "STALE_WRITE" | "INVALID_STATE" | "NOT_FOUND" | "FORBIDDEN" | "FAILURE" };

export async function publishProductFromDashboard(fetcher: typeof fetch, productId: string, payload: { expectedDraftVersionId: string; expectedProductUpdatedAt: string; expectedDraftUpdatedAt: string; expectedCurrentPublishedVersionId: string | null }): Promise<PublishProductUiResult> {
  try {
    const response = await fetcher(`/api/products/${encodeURIComponent(productId)}/publish`, { method: "POST", credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const value: unknown = await response.json();
    if (!record(value) || typeof value.status !== "string") return { status: "FAILURE" };
    if (response.ok && (value.status === "PUBLISHED" || value.status === "NO_CHANGE") && Number.isSafeInteger(value.versionNumber) && Number(value.versionNumber) > 0) return { status: value.status, versionNumber: Number(value.versionNumber) };
    if (value.status === "NOT_READY") {
      if (value.reason === "SOURCE_TRANSLATION" || value.reason === "PRODUCT_NAME" || value.reason === "PUBLIC_ASSET") return { status: "NOT_READY", reason: value.reason };
      return { status: "FAILURE" };
    }
    if (["STALE_WRITE", "INVALID_STATE", "NOT_FOUND", "FORBIDDEN"].includes(value.status)) return { status: value.status as "STALE_WRITE" | "INVALID_STATE" | "NOT_FOUND" | "FORBIDDEN" };
    return { status: "FAILURE" };
  } catch { return { status: "FAILURE" }; }
}
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
