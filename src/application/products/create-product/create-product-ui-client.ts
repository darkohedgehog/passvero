import type { CreateProductCommand } from "@/src/application/products/create-product/contracts";

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type CreateProductField =
  | "initialProductName"
  | "organizationSku"
  | "initialLocale";

export type CreateProductUiResult =
  | Readonly<{ status: "SUCCESS" }>
  | Readonly<{
      status: "FIELD_ERROR";
      field: CreateProductField;
      reason: "INVALID" | "CONFLICT";
    }>
  | Readonly<{ status: "FORBIDDEN" }>
  | Readonly<{ status: "FAILURE" }>;

export async function createProductFromDashboard(
  fetcher: Fetcher,
  command: CreateProductCommand,
): Promise<CreateProductUiResult> {
  try {
    const response = await fetcher("/api/products/create", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        initialProductName: command.initialProductName,
        ...(command.organizationSku === undefined
          ? {}
          : { organizationSku: command.organizationSku }),
        initialLocale: command.initialLocale,
      }),
    });
    const value: unknown = await response.json();
    if (response.ok && isStatus(value, "CREATED")) {
      return { status: "SUCCESS" };
    }
    if (
      isRecord(value)
      && value.status === "VALIDATION_ERROR"
      && isCreateProductField(value.field)
    ) {
      return {
        status: "FIELD_ERROR",
        field: value.field,
        reason: response.status === 409 ? "CONFLICT" : "INVALID",
      };
    }
    if (isStatus(value, "FORBIDDEN")) {
      return { status: "FORBIDDEN" };
    }
  } catch {
    // All transport and malformed-response failures share one safe result.
  }
  return { status: "FAILURE" };
}

export function missingRequiredCreateProductField(
  command: CreateProductCommand,
): Extract<CreateProductField, "initialProductName" | "initialLocale"> | null {
  if (command.initialProductName.length === 0) return "initialProductName";
  if (command.initialLocale.length === 0) return "initialLocale";
  return null;
}

function isStatus(value: unknown, status: string): boolean {
  return isRecord(value) && value.status === status;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCreateProductField(value: unknown): value is CreateProductField {
  return value === "initialProductName"
    || value === "organizationSku"
    || value === "initialLocale";
}
