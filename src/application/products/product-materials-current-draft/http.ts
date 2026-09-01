import type { AuthenticatedUserContextResolution } from "@/src/application/context/resolve-authenticated-user-context";
import { dashboardDenialOutcome } from "@/src/application/context/protected-dashboard-entry";
import { ApplicationError } from "@/src/application/errors/application-error";
import { hasProductPermission, PRODUCT_EDIT } from "@/src/application/permissions/product-permissions";
import type {
  AddProductMaterial,
  AddProductMaterialCommand,
  EditProductMaterial,
  EditProductMaterialCommand,
  RemoveProductMaterial,
  RemoveProductMaterialCommand,
} from "@/src/application/products/product-materials-current-draft/contracts";

const MAX_BODY_LENGTH = 16_384;

export function createProductMaterialsHttpHandler(dependencies: {
  readonly canonicalOrigin: string;
  readonly resolveContext: (headers: Headers) => Promise<AuthenticatedUserContextResolution>;
  readonly add: AddProductMaterial;
  readonly edit: EditProductMaterial;
  readonly remove: RemoveProductMaterial;
}) {
  return async (request: Request, productId: string): Promise<Response> => {
    if (
      request.method !== "POST"
      || request.headers.get("origin") !== dependencies.canonicalOrigin
      || new URL(request.url).origin !== dependencies.canonicalOrigin
    ) return json({ status: "FORBIDDEN" }, 403);

    const payload = await readPayload(request);
    if (payload === null) return json({ status: "VALIDATION_ERROR" }, 400);

    let resolution: AuthenticatedUserContextResolution;
    try {
      resolution = await dependencies.resolveContext(request.headers);
    } catch {
      return json({ status: "OPERATIONAL_FAILURE" }, 503);
    }
    if (resolution.status !== "RESOLVED") {
      const unauthenticated = resolution.status === "DENIED"
        && dashboardDenialOutcome(resolution.reason) === "LOGIN";
      return json({ status: "FORBIDDEN" }, unauthenticated ? 401 : 403);
    }
    if (
      resolution.context.membershipStatus !== "ACTIVE"
      || !hasProductPermission(resolution.context, PRODUCT_EDIT)
    ) return json({ status: "FORBIDDEN" }, 403);

    try {
      if (payload.operation === "ADD") {
        const command = withoutOperation(payload);
        const result = await dependencies.add({ productId, ...command }, resolution.context);
        return json({ status: result.status }, 200);
      }
      if (payload.operation === "EDIT") {
        const command = withoutOperation(payload);
        const result = await dependencies.edit({ productId, ...command }, resolution.context);
        return json({ status: result.status }, 200);
      }
      const command = withoutOperation(payload);
      const result = await dependencies.remove({ productId, ...command }, resolution.context);
      return json({ status: result.status }, 200);
    } catch (error) {
      return mapError(error);
    }
  };
}

function withoutOperation<T extends Payload>(payload: T): Omit<T, "operation"> {
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => key !== "operation"),
  ) as Omit<T, "operation">;
}

type AddPayload = Omit<AddProductMaterialCommand, "productId"> & { readonly operation: "ADD" };
type EditPayload = Omit<EditProductMaterialCommand, "productId"> & { readonly operation: "EDIT" };
type RemovePayload = Omit<RemoveProductMaterialCommand, "productId"> & { readonly operation: "REMOVE" };
type Payload = AddPayload | EditPayload | RemovePayload;

async function readPayload(request: Request): Promise<Payload | null> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return null;
  let text: string;
  try {
    text = await request.text();
  } catch {
    return null;
  }
  if (text.length === 0 || text.length > MAX_BODY_LENGTH) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(value) || typeof value.operation !== "string") return null;
  if (value.operation === "ADD" && exactKeys(value, ADD_KEYS) && validValues(value)) {
    return value as unknown as AddPayload;
  }
  if (
    value.operation === "EDIT"
    && exactKeys(value, EDIT_KEYS)
    && validValues(value)
    && structuralString(value.materialId)
    && structuralString(value.expectedMaterialUpdatedAt)
  ) return value as unknown as EditPayload;
  if (
    value.operation === "REMOVE"
    && exactKeys(value, REMOVE_KEYS)
    && structuralString(value.materialId)
    && structuralString(value.expectedDraftVersionId)
    && structuralString(value.expectedProductUpdatedAt)
    && structuralString(value.expectedDraftUpdatedAt)
    && structuralString(value.expectedMaterialUpdatedAt)
  ) return value as unknown as RemovePayload;
  return null;
}

const VALUE_KEYS = [
  "materialName", "category", "percentage", "isRecycled", "recycledPercentage",
] as const;
const EVIDENCE_KEYS = [
  "expectedDraftVersionId", "expectedProductUpdatedAt", "expectedDraftUpdatedAt",
] as const;
const ADD_KEYS = ["operation", ...VALUE_KEYS, ...EVIDENCE_KEYS] as const;
const EDIT_KEYS = [...ADD_KEYS, "materialId", "expectedMaterialUpdatedAt"] as const;
const REMOVE_KEYS = ["operation", "materialId", ...EVIDENCE_KEYS, "expectedMaterialUpdatedAt"] as const;

function validValues(value: Record<string, unknown>): boolean {
  return structuralString(value.materialName, 400)
    && nullableString(value.category, 200)
    && nullableString(value.percentage, 16)
    && typeof value.isRecycled === "boolean"
    && nullableString(value.recycledPercentage, 16)
    && EVIDENCE_KEYS.every((key) => structuralString(value[key]));
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === allowed.length
    && keys.every((key) => allowed.includes(key))
    && allowed.every((key) => key in value);
}

function structuralString(value: unknown, maximum = 128): value is string {
  return typeof value === "string" && Array.from(value).length <= maximum;
}

function nullableString(value: unknown, maximum: number): value is string | null {
  return value === null || structuralString(value, maximum);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapError(error: unknown): Response {
  if (!(error instanceof ApplicationError)) return json({ status: "OPERATIONAL_FAILURE" }, 503);
  if (error.code.endsWith("STALE_WRITE")) return json({ status: "STALE_WRITE" }, 409);
  if (error.code.endsWith("DRAFT_NOT_EDITABLE")) return json({ status: "DRAFT_NOT_EDITABLE" }, 409);
  if (error.code.endsWith("COLLECTION_INVALID")) return json({ status: "COLLECTION_INVALID" }, 400);
  if (error.category === "NOT_FOUND") return json({ status: "NOT_FOUND" }, 404);
  if (error.category === "FORBIDDEN" || error.category === "UNAUTHENTICATED") {
    return json({ status: "FORBIDDEN" }, error.category === "UNAUTHENTICATED" ? 401 : 403);
  }
  if (error.category === "VALIDATION") {
    const field = fieldFromCode(error.code);
    return json(field === null ? { status: "VALIDATION_ERROR" } : { status: "VALIDATION_ERROR", field }, 400);
  }
  return json({ status: "OPERATIONAL_FAILURE" }, 503);
}

function fieldFromCode(code: string): string | null {
  if (code.includes("MATERIAL_NAME")) return "materialName";
  if (code.includes("CATEGORY")) return "category";
  if (code.includes("RECYCLED_PERCENTAGE")) return "recycledPercentage";
  if (code.includes("IS_RECYCLED")) return "isRecycled";
  if (code.includes("PERCENTAGE")) return "percentage";
  return null;
}

function json(body: object, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });
}
