import { canonicalProxyDenial } from "../../http/canonical-proxy";
import type { AuthenticatedUserContextResolution } from "../../context/resolve-authenticated-user-context";
import { ApplicationError } from "../../errors/application-error";
import type { MutateTranslation, TranslationCommand } from "./contracts";
import { normalizeTranslation } from "./content";

export function parseTranslationPayload(value: unknown): Omit<TranslationCommand, "productId"> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const evidence = ["expectedDraftVersionId", "expectedProductUpdatedAt", "expectedDraftUpdatedAt", "locale"];
  const keys = ["operation", ...evidence];
  if (row.operation !== "ADD" && row.operation !== "EDIT" && row.operation !== "REMOVE") return null;
  if (row.operation !== "ADD") keys.push("translationId", "expectedTranslationUpdatedAt");
  if (row.operation === "EDIT") keys.push("content");
  if (Object.keys(row).length !== keys.length || !keys.every(key=>key in row)) return null;
  for (const key of keys.filter(key=>key!=="content")) if (typeof row[key] !== "string" || row[key].length > 128) return null;
  try { if (row.operation === "EDIT") normalizeTranslation(row.content); } catch { return null; }
  return row as unknown as Omit<TranslationCommand,"productId">;
}
export function createTranslationHttpHandler(deps: { canonicalOrigin: string; verifyProxy(headers: Headers): boolean; resolveContext(headers: Headers): Promise<AuthenticatedUserContextResolution>; mutate: MutateTranslation }) {
  return async (request: Request, productId: string) => {
    const denied = canonicalProxyDenial(request,deps,"FORBIDDEN");
    if (denied) return denied;
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return json("VALIDATION_ERROR",400);
    let payload;
    try { const text = await request.text(); if (!text || text.length > 131072) return json("VALIDATION_ERROR",400); payload = parseTranslationPayload(JSON.parse(text)); } catch { return json("VALIDATION_ERROR",400); }
    if (!payload) return json("VALIDATION_ERROR",400);
    try {
      const resolution = await deps.resolveContext(request.headers);
      if (resolution.status !== "RESOLVED") return json("FORBIDDEN",403);
      const result = await deps.mutate({ ...payload, productId } as TranslationCommand,resolution.context);
      return json(result.status,200);
    } catch (error) {
      if (error instanceof ApplicationError) {
        if (error.category === "CONFLICT") return json(error.code === "TRANSLATION_CONFLICT" ? "CONFLICT" : "STALE_WRITE",409);
        if (error.category === "INVALID_STATE") return json(error.code === "TRANSLATION_SOURCE_PROTECTED" ? "SOURCE_PROTECTED" : "NOT_EDITABLE",409);
        if (error.category === "VALIDATION") return json("VALIDATION_ERROR",400);
        if (error.category === "NOT_FOUND") return json("NOT_FOUND",404);
        if (error.category === "FORBIDDEN" || error.category === "UNAUTHENTICATED") return json("FORBIDDEN",403);
      }
      return json("OPERATIONAL_FAILURE",503);
    }
  };
}
function json(status: string, http: number) { return Response.json({status},{status:http,headers:{"Cache-Control":"no-store, private"}}); }
