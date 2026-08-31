import type { AuthenticatedUserContextResolution } from "@/src/application/context/resolve-authenticated-user-context";
import type { AuthenticatedUserContext } from "@/src/application/context/authenticated-user-context";
import { dashboardDenialOutcome } from "@/src/application/context/protected-dashboard-entry";
import { ApplicationError } from "@/src/application/errors/application-error";
import {
  hasProductPermission,
  PRODUCT_EDIT,
} from "@/src/application/permissions/product-permissions";
import type {
  EditProductDraft,
  EditProductDraftCommand,
} from "@/src/application/products/edit-product-draft/contracts";
import type {
  ProductLifecycleStatus,
  ProductVersionStatus,
} from "@/src/application/products/list-products/contracts";

const MAX_REQUEST_LENGTH = 8192;
const MAX_STRUCTURAL_NAME_LENGTH = 1024;
const MAX_STRUCTURAL_SKU_LENGTH = 512;
const MAX_STRUCTURAL_EVIDENCE_LENGTH = 128;

export type EditProductDraftPageAccess =
  | "LOGIN"
  | "DENIED"
  | "ORGANIZATION_SELECTION_REQUIRED"
  | "FORBIDDEN"
  | "FORM";

export function classifyEditProductDraftPageAccess(
  resolution: AuthenticatedUserContextResolution,
): EditProductDraftPageAccess {
  if (resolution.status === "DENIED") {
    return dashboardDenialOutcome(resolution.reason) === "LOGIN" ? "LOGIN" : "DENIED";
  }
  if (resolution.status === "ORGANIZATION_SELECTION_REQUIRED") {
    return "ORGANIZATION_SELECTION_REQUIRED";
  }
  return resolution.context.membershipStatus === "ACTIVE"
    && hasProductPermission(resolution.context, PRODUCT_EDIT)
    ? "FORM"
    : "FORBIDDEN";
}

export function canShowEditProductDraftAction(
  context: AuthenticatedUserContext,
  lifecycleStatus: ProductLifecycleStatus,
  currentDraftStatus: ProductVersionStatus | null,
): boolean {
  return context.membershipStatus === "ACTIVE"
    && hasProductPermission(context, PRODUCT_EDIT)
    && lifecycleStatus === "ACTIVE"
    && (currentDraftStatus === "DRAFT" || currentDraftStatus === "READY_FOR_REVIEW");
}

export function createEditProductDraftHttpHandler(dependencies: {
  readonly canonicalOrigin: string;
  readonly resolveContext: (
    headers: Headers,
  ) => Promise<AuthenticatedUserContextResolution>;
  readonly edit: EditProductDraft;
}) {
  return async (request: Request, productId: string): Promise<Response> => {
    if (!validPostOrigin(request, dependencies.canonicalOrigin)) {
      return json({ status: "FORBIDDEN" }, 403);
    }

    const payload = await readPayload(request);
    if (payload === null) return json({ status: "INVALID_REQUEST" }, 400);

    let resolution: AuthenticatedUserContextResolution;
    try {
      resolution = await dependencies.resolveContext(request.headers);
    } catch {
      return json({ status: "OPERATIONAL_FAILURE" }, 503);
    }

    const access = classifyEditProductDraftPageAccess(resolution);
    if (access !== "FORM" || resolution.status !== "RESOLVED") {
      return json({ status: "FORBIDDEN" }, access === "LOGIN" ? 401 : 403);
    }

    try {
      await dependencies.edit({ productId, ...payload }, resolution.context);
      return json({ status: "UPDATED" }, 200);
    } catch (error) {
      return mapEditProductDraftError(error);
    }
  };
}

type EditPayload = Omit<EditProductDraftCommand, "productId">;

async function readPayload(request: Request): Promise<EditPayload | null> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
    return null;
  }
  let text: string;
  try {
    text = await request.text();
  } catch {
    return null;
  }
  if (text.length === 0 || text.length > MAX_REQUEST_LENGTH) return null;

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;

  const allowedKeys = [
    "productName",
    "organizationSku",
    "expectedDraftVersionId",
    "expectedProductUpdatedAt",
    "expectedDraftUpdatedAt",
    "expectedSourceTranslationUpdatedAt",
  ];
  const requiredKeys = allowedKeys.filter((key) => key !== "organizationSku");
  if (
    !Object.keys(value).every((key) => allowedKeys.includes(key))
    || !requiredKeys.every((key) => key in value)
    || !structuralString(value.productName, MAX_STRUCTURAL_NAME_LENGTH)
    || !optionalStructuralString(value.organizationSku, MAX_STRUCTURAL_SKU_LENGTH)
    || !structuralString(value.expectedDraftVersionId, MAX_STRUCTURAL_EVIDENCE_LENGTH)
    || !structuralString(value.expectedProductUpdatedAt, MAX_STRUCTURAL_EVIDENCE_LENGTH)
    || !structuralString(value.expectedDraftUpdatedAt, MAX_STRUCTURAL_EVIDENCE_LENGTH)
    || !structuralString(value.expectedSourceTranslationUpdatedAt, MAX_STRUCTURAL_EVIDENCE_LENGTH)
  ) {
    return null;
  }

  return {
    productName: value.productName,
    ...(value.organizationSku === undefined ? {} : { organizationSku: value.organizationSku }),
    expectedDraftVersionId: value.expectedDraftVersionId,
    expectedProductUpdatedAt: value.expectedProductUpdatedAt,
    expectedDraftUpdatedAt: value.expectedDraftUpdatedAt,
    expectedSourceTranslationUpdatedAt: value.expectedSourceTranslationUpdatedAt,
  };
}

function mapEditProductDraftError(error: unknown): Response {
  if (!(error instanceof ApplicationError)) {
    return json({ status: "OPERATIONAL_FAILURE" }, 503);
  }
  switch (error.code) {
    case "EDIT_PRODUCT_DRAFT_NAME_INVALID":
      return json({ status: "VALIDATION_ERROR", field: "productName" }, 400);
    case "EDIT_PRODUCT_DRAFT_SKU_INVALID":
      return json({ status: "VALIDATION_ERROR", field: "organizationSku" }, 400);
    case "EDIT_PRODUCT_DRAFT_SKU_CONFLICT":
      return json({ status: "SKU_CONFLICT" }, 409);
    case "EDIT_PRODUCT_DRAFT_STALE_WRITE":
      return json({ status: "STALE_WRITE" }, 409);
    case "EDIT_PRODUCT_DRAFT_NOT_EDITABLE":
      return json({ status: "DRAFT_NOT_EDITABLE" }, 409);
    case "EDIT_PRODUCT_DRAFT_NOT_FOUND":
      return json({ status: "NOT_FOUND" }, 404);
    case "EDIT_PRODUCT_DRAFT_UNAUTHENTICATED":
    case "EDIT_PRODUCT_DRAFT_FORBIDDEN":
      return json({ status: "FORBIDDEN" }, error.category === "UNAUTHENTICATED" ? 401 : 403);
    default:
      return json({ status: "OPERATIONAL_FAILURE" }, 503);
  }
}

function validPostOrigin(request: Request, origin: string): boolean {
  if (request.method !== "POST" || request.headers.get("origin") !== origin) return false;
  try {
    return new URL(request.url).origin === origin;
  } catch {
    return false;
  }
}

function structuralString(value: unknown, maximum: number): value is string {
  return typeof value === "string" && Array.from(value).length <= maximum;
}

function optionalStructuralString(
  value: unknown,
  maximum: number,
): value is string | null | undefined {
  return value === undefined || value === null || structuralString(value, maximum);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function json(body: object, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
