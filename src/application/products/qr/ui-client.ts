import type { QrActivationResult, QrFailure } from "./contracts";
export type QrUiResult = QrActivationResult | { readonly status: QrFailure };
export async function activateQrFromDashboard(fetcher: typeof fetch, productId: string, activationEvidence: string): Promise<QrUiResult> {
  try {
    const response = await fetcher(`/api/products/${encodeURIComponent(productId)}/qr/activate`, {
      method: "POST", credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer",
      headers: { "content-type": "application/json" }, body: JSON.stringify({ activationEvidence }),
    });
    const value: unknown = await response.json();
    if (typeof value !== "object" || value === null || !("status" in value)) return { status: "OPERATIONAL_FAILURE" };
    const status = value.status;
    if (response.ok && (status === "ACTIVATED" || status === "NO_CHANGE")) return { status };
    if (!response.ok && (status === "UNAUTHENTICATED" || status === "FORBIDDEN" || status === "NOT_FOUND" || status === "VALIDATION" || status === "STALE_WRITE" || status === "INVALID_STATE" || status === "OPERATIONAL_FAILURE")) return { status };
    return { status: "OPERATIONAL_FAILURE" };
  } catch { return { status: "OPERATIONAL_FAILURE" }; }
}
