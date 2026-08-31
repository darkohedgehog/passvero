import type { EditProductDraftCommand } from "@/src/application/products/edit-product-draft/contracts";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type EditProductDraftPayload = Omit<EditProductDraftCommand, "productId">;

export type EditProductDraftUiResult =
  | Readonly<{ status: "SUCCESS" }>
  | Readonly<{
      status: "FIELD_ERROR";
      field: "productName" | "organizationSku";
      reason: "INVALID" | "CONFLICT";
    }>
  | Readonly<{ status: "STALE_WRITE" }>
  | Readonly<{ status: "DRAFT_NOT_EDITABLE" }>
  | Readonly<{ status: "FORBIDDEN" }>
  | Readonly<{ status: "FAILURE" }>;

export async function editProductDraftFromDashboard(
  fetcher: Fetcher,
  productId: string,
  command: EditProductDraftPayload,
): Promise<EditProductDraftUiResult> {
  try {
    const response = await fetcher(`/api/products/${encodeURIComponent(productId)}/edit`, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command),
    });
    const value: unknown = await response.json();
    if (response.ok && isStatus(value, "UPDATED")) return { status: "SUCCESS" };
    if (isStatus(value, "SKU_CONFLICT")) {
      return { status: "FIELD_ERROR", field: "organizationSku", reason: "CONFLICT" };
    }
    if (
      isRecord(value)
      && value.status === "VALIDATION_ERROR"
      && (value.field === "productName" || value.field === "organizationSku")
    ) {
      return { status: "FIELD_ERROR", field: value.field, reason: "INVALID" };
    }
    if (isStatus(value, "STALE_WRITE")) return { status: "STALE_WRITE" };
    if (isStatus(value, "DRAFT_NOT_EDITABLE") || isStatus(value, "NOT_FOUND")) {
      return { status: "DRAFT_NOT_EDITABLE" };
    }
    if (isStatus(value, "FORBIDDEN")) return { status: "FORBIDDEN" };
  } catch {
    // Transport and malformed-response failures share one safe outcome.
  }
  return { status: "FAILURE" };
}

export function missingRequiredEditProductDraftField(
  command: EditProductDraftPayload,
): "productName" | null {
  return command.productName.length === 0 ? "productName" : null;
}

function isStatus(value: unknown, status: string): boolean {
  return isRecord(value) && value.status === status;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
