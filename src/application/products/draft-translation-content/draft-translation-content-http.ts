import type { AuthenticatedUserContextResolution } from "@/src/application/context/resolve-authenticated-user-context";
import { dashboardDenialOutcome } from "@/src/application/context/protected-dashboard-entry";
import { ApplicationError } from "@/src/application/errors/application-error";
import { hasProductPermission, PRODUCT_EDIT } from "@/src/application/permissions/product-permissions";
import { DRAFT_TRANSLATION_CONTENT_FIELDS, type UpdateDraftTranslationContent, type UpdateDraftTranslationContentCommand } from "@/src/application/products/draft-translation-content/contracts";

export function classifyDraftTranslationContentPageAccess(resolution: AuthenticatedUserContextResolution) {
  if (resolution.status === "DENIED") return dashboardDenialOutcome(resolution.reason) === "LOGIN" ? "LOGIN" as const : "DENIED" as const;
  if (resolution.status === "ORGANIZATION_SELECTION_REQUIRED") return "ORGANIZATION_SELECTION_REQUIRED" as const;
  return resolution.context.membershipStatus === "ACTIVE" && hasProductPermission(resolution.context, PRODUCT_EDIT) ? "FORM" as const : "FORBIDDEN" as const;
}

export function createDraftTranslationContentHttpHandler(dependencies: { canonicalOrigin: string; resolveContext(headers: Headers): Promise<AuthenticatedUserContextResolution>; update: UpdateDraftTranslationContent }) {
  return async (request: Request, productId: string) => {
    if (request.method !== "POST" || request.headers.get("origin") !== dependencies.canonicalOrigin || new URL(request.url).origin !== dependencies.canonicalOrigin) return json({ status: "FORBIDDEN" }, 403);
    const payload = await readPayload(request);
    if (payload === null) return json({ status: "INVALID_REQUEST" }, 400);
    let resolution;
    try { resolution = await dependencies.resolveContext(request.headers); } catch { return json({ status: "OPERATIONAL_FAILURE" }, 503); }
    const access = classifyDraftTranslationContentPageAccess(resolution);
    if (access !== "FORM" || resolution.status !== "RESOLVED") return json({ status: "FORBIDDEN" }, access === "LOGIN" ? 401 : 403);
    try { await dependencies.update({ productId, ...payload }, resolution.context); return json({ status: "UPDATED" }, 200); }
    catch (error) { return mapError(error); }
  };
}

async function readPayload(request: Request): Promise<Omit<UpdateDraftTranslationContentCommand, "productId"> | null> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return null;
  let text; try { text = await request.text(); } catch { return null; }
  if (text.length === 0 || text.length > 65_536) return null;
  let value: unknown; try { value = JSON.parse(text); } catch { return null; }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const evidence = ["expectedDraftVersionId", "expectedProductUpdatedAt", "expectedDraftUpdatedAt", "expectedSourceTranslationUpdatedAt"] as const;
  const allowed = [...DRAFT_TRANSLATION_CONTENT_FIELDS, ...evidence];
  if (!Object.keys(record).every((key) => allowed.includes(key as never)) || !allowed.every((key) => key in record)) return null;
  for (const field of DRAFT_TRANSLATION_CONTENT_FIELDS) if (record[field] !== null && (typeof record[field] !== "string" || Array.from(record[field] as string).length > 10_000)) return null;
  for (const field of evidence) if (typeof record[field] !== "string" || Array.from(record[field] as string).length > 128) return null;
  return record as unknown as Omit<UpdateDraftTranslationContentCommand, "productId">;
}

function mapError(error: unknown) {
  if (!(error instanceof ApplicationError)) return json({ status: "OPERATIONAL_FAILURE" }, 503);
  if (error.code.endsWith("STALE_WRITE")) return json({ status: "STALE_WRITE" }, 409);
  if (error.code.endsWith("NOT_EDITABLE")) return json({ status: "DRAFT_NOT_EDITABLE" }, 409);
  if (error.code.endsWith("NOT_FOUND")) return json({ status: "NOT_FOUND" }, 404);
  if (error.category === "VALIDATION") {
    const field = DRAFT_TRANSLATION_CONTENT_FIELDS.find((candidate) => error.code.includes(candidate.toUpperCase()));
    return json(field ? { status: "VALIDATION_ERROR", field } : { status: "VALIDATION_ERROR" }, 400);
  }
  if (error.category === "FORBIDDEN" || error.category === "UNAUTHENTICATED") return json({ status: "FORBIDDEN" }, error.category === "UNAUTHENTICATED" ? 401 : 403);
  return json({ status: "OPERATIONAL_FAILURE" }, 503);
}
function json(body: object, status: number) { return Response.json(body, { status, headers: { "Cache-Control": "no-store, private" } }); }
