import type { AuthenticatedUserContextResolution } from "@/src/application/context/resolve-authenticated-user-context";
import { dashboardDenialOutcome } from "@/src/application/context/protected-dashboard-entry";
import { ApplicationError } from "@/src/application/errors/application-error";
import { hasProductPermission, PRODUCT_EDIT } from "@/src/application/permissions/product-permissions";
import type { AddCnClassification, AddCnClassificationCommand, EditCnClassification, EditCnClassificationCommand, RemoveCnClassification, RemoveCnClassificationCommand } from "@/src/application/products/cn-classification-current-draft/contracts";

const MAX_BODY_LENGTH = 4_096;

export function createCnClassificationHttpHandler(dependencies: {
  readonly canonicalOrigin: string;
  readonly resolveContext: (headers: Headers) => Promise<AuthenticatedUserContextResolution>;
  readonly add: AddCnClassification;
  readonly edit: EditCnClassification;
  readonly remove: RemoveCnClassification;
}) {
  return async (request: Request, productId: string): Promise<Response> => {
    if (request.method !== "POST" || request.headers.get("origin") !== dependencies.canonicalOrigin || new URL(request.url).origin !== dependencies.canonicalOrigin) return json({ status: "FORBIDDEN" }, 403);
    const payload = await readPayload(request);
    if (payload === null) return json({ status: "VALIDATION_ERROR" }, 400);
    let resolution: AuthenticatedUserContextResolution;
    try { resolution = await dependencies.resolveContext(request.headers); } catch { return json({ status: "OPERATIONAL_FAILURE" }, 503); }
    if (resolution.status !== "RESOLVED") {
      const unauthenticated = resolution.status === "DENIED" && dashboardDenialOutcome(resolution.reason) === "LOGIN";
      return json({ status: "FORBIDDEN" }, unauthenticated ? 401 : 403);
    }
    if (resolution.context.membershipStatus !== "ACTIVE" || !hasProductPermission(resolution.context, PRODUCT_EDIT)) return json({ status: "FORBIDDEN" }, 403);
    try {
      if (payload.operation === "ADD") return json({ status: (await dependencies.add({ productId, ...withoutOperation(payload) }, resolution.context)).status }, 200);
      if (payload.operation === "EDIT") return json({ status: (await dependencies.edit({ productId, ...withoutOperation(payload) }, resolution.context)).status }, 200);
      return json({ status: (await dependencies.remove({ productId, ...withoutOperation(payload) }, resolution.context)).status }, 200);
    } catch (error) { return mapError(error); }
  };
}

type AddPayload = Omit<AddCnClassificationCommand, "productId"> & { readonly operation: "ADD" };
type EditPayload = Omit<EditCnClassificationCommand, "productId"> & { readonly operation: "EDIT" };
type RemovePayload = Omit<RemoveCnClassificationCommand, "productId"> & { readonly operation: "REMOVE" };
type Payload = AddPayload | EditPayload | RemovePayload;
const EVIDENCE_KEYS = ["expectedDraftVersionId", "expectedProductUpdatedAt", "expectedDraftUpdatedAt"] as const;
const ADD_KEYS = ["operation", "value", "nomenclatureYear", ...EVIDENCE_KEYS] as const;
const EDIT_KEYS = [...ADD_KEYS, "identifierId", "expectedIdentifierUpdatedAt"] as const;
const REMOVE_KEYS = ["operation", "identifierId", ...EVIDENCE_KEYS, "expectedIdentifierUpdatedAt"] as const;

async function readPayload(request: Request): Promise<Payload | null> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return null;
  let text: string;
  try { text = await request.text(); } catch { return null; }
  if (text.length === 0 || text.length > MAX_BODY_LENGTH) return null;
  let value: unknown;
  try { value = JSON.parse(text); } catch { return null; }
  if (!isRecord(value) || typeof value.operation !== "string") return null;
  if (value.operation === "ADD" && exactKeys(value, ADD_KEYS) && validValues(value)) return value as unknown as AddPayload;
  if (value.operation === "EDIT" && exactKeys(value, EDIT_KEYS) && validValues(value) && structuralString(value.identifierId) && structuralString(value.expectedIdentifierUpdatedAt)) return value as unknown as EditPayload;
  if (value.operation === "REMOVE" && exactKeys(value, REMOVE_KEYS) && structuralString(value.identifierId) && EVIDENCE_KEYS.every((key) => structuralString(value[key])) && structuralString(value.expectedIdentifierUpdatedAt)) return value as unknown as RemovePayload;
  return null;
}

function validValues(value: Record<string, unknown>) {
  return structuralString(value.value, 32) && typeof value.nomenclatureYear === "number" && Number.isFinite(value.nomenclatureYear) && EVIDENCE_KEYS.every((key) => structuralString(value[key]));
}
function exactKeys(value: Record<string, unknown>, allowed: readonly string[]) { const keys = Object.keys(value); return keys.length === allowed.length && keys.every((key) => allowed.includes(key)) && allowed.every((key) => key in value); }
function structuralString(value: unknown, maximum = 128): value is string { return typeof value === "string" && Array.from(value).length <= maximum; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function withoutOperation<T extends Payload>(payload: T): Omit<T, "operation"> { return Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "operation")) as Omit<T, "operation">; }

function mapError(error: unknown): Response {
  if (!(error instanceof ApplicationError)) return json({ status: "OPERATIONAL_FAILURE" }, 503);
  if (error.code.endsWith("STALE_WRITE")) return json({ status: "STALE_WRITE" }, 409);
  if (error.code.endsWith("CONFLICT")) return json({ status: "CN_CONFLICT" }, 409);
  if (error.code.endsWith("DRAFT_NOT_EDITABLE")) return json({ status: "DRAFT_NOT_EDITABLE" }, 409);
  if (error.category === "NOT_FOUND") return json({ status: "NOT_FOUND" }, 404);
  if (error.category === "FORBIDDEN" || error.category === "UNAUTHENTICATED") return json({ status: "FORBIDDEN" }, error.category === "UNAUTHENTICATED" ? 401 : 403);
  if (error.category === "VALIDATION") {
    const field = error.code.includes("NOMENCLATURE_YEAR") ? "nomenclatureYear" : error.code.includes("VALUE") ? "value" : null;
    return json(field === null ? { status: "VALIDATION_ERROR" } : { status: "VALIDATION_ERROR", field }, 400);
  }
  return json({ status: "OPERATIONAL_FAILURE" }, 503);
}
function json(body: object, status: number) { return Response.json(body, { status, headers: { "Cache-Control": "no-store, private" } }); }
