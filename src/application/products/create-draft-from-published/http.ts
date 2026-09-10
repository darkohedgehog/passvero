import type { AuthenticatedUserContext } from "@/src/application/context/authenticated-user-context";
import type { AuthenticatedUserContextResolution } from "@/src/application/context/resolve-authenticated-user-context";
import { ApplicationError } from "@/src/application/errors/application-error";
import { canonicalProxyDenial } from "@/src/application/http/canonical-proxy";
import { hasProductPermission, PRODUCT_EDIT } from "@/src/application/permissions/product-permissions";
import type { CreateDraftFromPublished } from "./contracts";
import { validCreateDraftCommand } from "./service";

export function canCreateDraftFromPublished(context: AuthenticatedUserContext, lifecycle: string, hasPublished: boolean, hasDraft: boolean): boolean {
  return context.membershipStatus === "ACTIVE" && hasProductPermission(context, PRODUCT_EDIT) && lifecycle === "ACTIVE" && hasPublished && !hasDraft;
}
export function createCreateDraftHttpHandler(dependencies: {
  canonicalOrigin: string; verifyProxy(headers: Headers): boolean;
  resolveContext(headers: Headers): Promise<AuthenticatedUserContextResolution>;
  createDraft: CreateDraftFromPublished;
}) {
  return async (request: Request, productId: string): Promise<Response> => {
    const denied = canonicalProxyDenial(request, dependencies, "FORBIDDEN");
    if (denied) return denied;
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return json("VALIDATION_ERROR", 400);
    let payload: unknown;
    try { const text = await request.text(); if (!text || text.length > 2048) return json("VALIDATION_ERROR", 400); payload = JSON.parse(text); }
    catch { return json("VALIDATION_ERROR", 400); }
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return json("VALIDATION_ERROR", 400);
    const fields = payload as Record<string, unknown>;
    if (Object.keys(fields).length !== 2 || typeof fields.expectedCurrentPublishedVersionId !== "string" || typeof fields.expectedProductUpdatedAt !== "string") return json("VALIDATION_ERROR", 400);
    const command = { productId, expectedCurrentPublishedVersionId: fields.expectedCurrentPublishedVersionId, expectedProductUpdatedAt: fields.expectedProductUpdatedAt };
    if (!validCreateDraftCommand(command)) return json("VALIDATION_ERROR", 400);
    try {
      const resolution = await dependencies.resolveContext(request.headers);
      if (resolution.status !== "RESOLVED") return json("FORBIDDEN", 403);
      const result = await dependencies.createDraft(command, resolution.context);
      return json(result.status, 200);
    } catch (error) {
      if (error instanceof ApplicationError) {
        if (error.code === "CREATE_DRAFT_IMAGES_UNSUPPORTED") return json("IMAGES_UNSUPPORTED", 409);
        if (error.category === "CONFLICT") return json("CONFLICT", 409);
        if (error.category === "INVALID_STATE") return json("INVALID_STATE", 409);
        if (error.category === "FORBIDDEN" || error.category === "UNAUTHENTICATED") return json("FORBIDDEN", 403);
        if (error.category === "NOT_FOUND") return json("NOT_FOUND", 404);
        if (error.category === "VALIDATION") return json("VALIDATION_ERROR", 400);
      }
      return json("OPERATIONAL_FAILURE", 503);
    }
  };
}
function json(status: string, httpStatus: number) { return Response.json({ status }, { status: httpStatus, headers: { "cache-control": "no-store" } }); }
