import type { AuthenticatedUserContextResolution } from "@/src/application/context/resolve-authenticated-user-context";
import { dashboardDenialOutcome } from "@/src/application/context/protected-dashboard-entry";
import { ApplicationError } from "@/src/application/errors/application-error";
import {
  hasProductPermission,
  PRODUCT_CREATE,
} from "@/src/application/permissions/product-permissions";
import type { CreateProductCommand } from "@/src/application/products/create-product/contracts";
import type { CreateProduct } from "@/src/application/products/create-product/ports";

const MAX_REQUEST_LENGTH = 4096;
const MAX_STRUCTURAL_NAME_LENGTH = 1024;
const MAX_STRUCTURAL_SKU_LENGTH = 512;
const MAX_STRUCTURAL_LOCALE_LENGTH = 16;

export type CreateProductPageAccess =
  | "LOGIN"
  | "DENIED"
  | "ORGANIZATION_SELECTION_REQUIRED"
  | "FORBIDDEN"
  | "FORM";

export function classifyCreateProductPageAccess(
  resolution: AuthenticatedUserContextResolution,
): CreateProductPageAccess {
  if (resolution.status === "DENIED") {
    return dashboardDenialOutcome(resolution.reason) === "LOGIN"
      ? "LOGIN"
      : "DENIED";
  }
  if (resolution.status === "ORGANIZATION_SELECTION_REQUIRED") {
    return "ORGANIZATION_SELECTION_REQUIRED";
  }
  return resolution.context.membershipStatus === "ACTIVE"
    && hasProductPermission(resolution.context, PRODUCT_CREATE)
    ? "FORM"
    : "FORBIDDEN";
}

export function createCreateProductHttpHandler(dependencies: {
  readonly canonicalOrigin: string;
  readonly resolveContext: (
    headers: Headers,
  ) => Promise<AuthenticatedUserContextResolution>;
  readonly create: CreateProduct;
}) {
  return async (request: Request): Promise<Response> => {
    if (!validPostOrigin(request, dependencies.canonicalOrigin)) {
      return json({ status: "FORBIDDEN" }, 403);
    }

    const command = await readCommand(request);
    if (command === null) {
      return json({ status: "INVALID_REQUEST" }, 400);
    }

    let resolution: AuthenticatedUserContextResolution;
    try {
      resolution = await dependencies.resolveContext(request.headers);
    } catch {
      return json({ status: "OPERATIONAL_FAILURE" }, 503);
    }

    const access = classifyCreateProductPageAccess(resolution);
    if (access !== "FORM" || resolution.status !== "RESOLVED") {
      return json(
        { status: "FORBIDDEN" },
        access === "LOGIN" ? 401 : 403,
      );
    }

    try {
      await dependencies.create(command, resolution.context);
      return json({ status: "CREATED" }, 201);
    } catch (error) {
      return mapCreateProductError(error);
    }
  };
}

async function readCommand(request: Request): Promise<CreateProductCommand | null> {
  if (!/^application\/json(?:\s*;|$)/i.test(
    request.headers.get("content-type") ?? "",
  )) {
    return null;
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return null;
  }
  if (text.length === 0 || text.length > MAX_REQUEST_LENGTH) {
    return null;
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    !keys.every((key) => [
      "initialProductName",
      "organizationSku",
      "initialLocale",
    ].includes(key))
    || !keys.includes("initialProductName")
    || !keys.includes("initialLocale")
    || !structuralString(record.initialProductName, MAX_STRUCTURAL_NAME_LENGTH)
    || !structuralString(record.initialLocale, MAX_STRUCTURAL_LOCALE_LENGTH)
    || !optionalStructuralString(record.organizationSku, MAX_STRUCTURAL_SKU_LENGTH)
  ) {
    return null;
  }

  return {
    initialProductName: record.initialProductName,
    initialLocale: record.initialLocale,
    ...(record.organizationSku === undefined
      ? {}
      : { organizationSku: record.organizationSku }),
  };
}

function structuralString(value: unknown, maximum: number): value is string {
  return typeof value === "string" && Array.from(value).length <= maximum;
}

function optionalStructuralString(
  value: unknown,
  maximum: number,
): value is string | null | undefined {
  return value === undefined
    || value === null
    || structuralString(value, maximum);
}

function validPostOrigin(request: Request, origin: string): boolean {
  if (request.method !== "POST" || request.headers.get("origin") !== origin) {
    return false;
  }
  try {
    return new URL(request.url).origin === origin;
  } catch {
    return false;
  }
}

function mapCreateProductError(error: unknown): Response {
  if (error instanceof ApplicationError) {
    const field = fieldForApplicationError(error.code);
    if (field !== null) {
      return json(
        { status: "VALIDATION_ERROR", field },
        error.code === "CREATE_PRODUCT_SKU_CONFLICT" ? 409 : 400,
      );
    }
    if (
      error.category === "UNAUTHENTICATED"
      || error.category === "FORBIDDEN"
      || error.category === "NOT_FOUND"
      || error.category === "INVALID_STATE"
    ) {
      return json({ status: "FORBIDDEN" }, 403);
    }
  }
  return json({ status: "OPERATIONAL_FAILURE" }, 503);
}

function fieldForApplicationError(
  code: string,
): "initialProductName" | "organizationSku" | "initialLocale" | null {
  switch (code) {
    case "CREATE_PRODUCT_NAME_INVALID":
      return "initialProductName";
    case "CREATE_PRODUCT_SKU_INVALID":
    case "CREATE_PRODUCT_SKU_CONFLICT":
      return "organizationSku";
    case "CREATE_PRODUCT_LOCALE_INVALID":
      return "initialLocale";
    default:
      return null;
  }
}

function json(body: object, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
