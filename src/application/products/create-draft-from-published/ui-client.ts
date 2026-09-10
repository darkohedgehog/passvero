import type { CreateDraftFromPublishedCommand } from "./contracts";
export type CreateDraftUiStatus = "CREATED_NEW_DRAFT" | "EXISTING_DRAFT" | "IMAGES_UNSUPPORTED" | "CONFLICT" | "INVALID_STATE" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR" | "OPERATIONAL_FAILURE";
export async function createDraftFromDashboard(fetcher: typeof fetch, productId: string, data: Omit<CreateDraftFromPublishedCommand, "productId">): Promise<{ status: CreateDraftUiStatus }> {
  try {
    const response = await fetcher(`/api/products/${encodeURIComponent(productId)}/draft`, {
      method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", cache: "no-store",
      body: JSON.stringify({ expectedCurrentPublishedVersionId: data.expectedCurrentPublishedVersionId, expectedProductUpdatedAt: data.expectedProductUpdatedAt }),
    });
    const payload: unknown = await response.json();
    if (typeof payload === "object" && payload !== null && "status" in payload) {
      const status = payload.status;
      if (response.status === 200 && (status === "CREATED_NEW_DRAFT" || status === "EXISTING_DRAFT")) return { status };
      if (response.status === 409 && (status === "IMAGES_UNSUPPORTED" || status === "CONFLICT" || status === "INVALID_STATE")) return { status };
      if (response.status === 403 && status === "FORBIDDEN") return { status };
      if (response.status === 404 && status === "NOT_FOUND") return { status };
      if (response.status === 400 && status === "VALIDATION_ERROR") return { status };
    }
  } catch { /* An uncertain response never triggers an automatic mutation retry. */ }
  return { status: "OPERATIONAL_FAILURE" };
}
