import { ApplicationError } from "../../errors/application-error";
import { canonicalProxyDenial } from "../../http/canonical-proxy";
import type { AuthenticatedUserContextResolution } from "../../context/resolve-authenticated-user-context";
import { DocumentError } from "../../documents/contracts";
import { readDocumentBytes } from "../../documents/bytes";
import { imageError, MAX_IMAGE_BYTES } from "./contracts";
import type { createImageServices } from "./service";
const headers = { "cache-control": "private, no-store, max-age=0", "cdn-cache-control": "no-store", "x-content-type-options": "nosniff", "vary": "Cookie" };
export function imageHttpFailure(error: unknown, head = false) {
  const code = error instanceof DocumentError && error.code === "VALIDATION_ERROR" ? "INVALID_IMAGE" : error instanceof ApplicationError ? error.code : "OPERATIONAL_FAILURE";
  const category = error instanceof DocumentError && error.code === "VALIDATION_ERROR" ? "VALIDATION" : error instanceof ApplicationError ? error.category : "INTERNAL";
  const statuses: Partial<Record<ApplicationError["category"], number>> = { VALIDATION: 400, FORBIDDEN: 403, UNAUTHENTICATED: 403, NOT_FOUND: 404, CONFLICT: 409, INVALID_STATE: 409 };
  return new Response(head ? null : JSON.stringify({ status: category === "INTERNAL" ? "OPERATIONAL_FAILURE" : code }), { status: statuses[category] ?? 503, headers: { ...headers, "content-type": "application/json" } });
}
export function createImageHttpHandlers(deps: {
  services: ReturnType<typeof createImageServices>; canonicalOrigin: string;
  verifyProxy(headers: Headers): boolean; resolveContext(headers: Headers): Promise<AuthenticatedUserContextResolution>;
}) {
  let active = 0;
  return {
    async mutate(request: Request, productId: string) {
      let acquired = false;
      try {
        const denied = canonicalProxyDenial(request, deps, "FORBIDDEN"); if (denied) return denied;
        const ctx = await deps.resolveContext(request.headers); if (ctx.status !== "RESOLVED") throw imageError("FORBIDDEN", "FORBIDDEN");
        if (new URL(request.url).search || request.headers.has("content-encoding")) throw imageError("VALIDATION", "VALIDATION_ERROR");
        const metadata = request.headers.get("x-image-command") ?? "";
        if (metadata.length > 4096) throw imageError("VALIDATION", "VALIDATION_ERROR");
        let command: unknown; try { command = JSON.parse(decodeURIComponent(metadata)); } catch { throw imageError("VALIDATION", "VALIDATION_ERROR"); }
        await deps.services.authorize(productId, command, ctx.context);
        if (active >= 2) throw imageError("INTERNAL", "BUSY"); active++; acquired = true;
        const length = request.headers.get("content-length");
        if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_IMAGE_BYTES)) throw imageError("VALIDATION", "INVALID_IMAGE");
        const remove = request.method === "DELETE";
        if (remove ? (command as { operation: string }).operation !== "REMOVE" : request.method !== "POST" || (command as { operation: string }).operation !== "SET" || !["image/jpeg", "image/png"].includes(request.headers.get("content-type") ?? "")) throw imageError("VALIDATION", "INVALID_IMAGE");
        const bytes = remove ? null : await readDocumentBytes(request.body, AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]), MAX_IMAGE_BYTES);
        return Response.json(await deps.services.mutate(productId, command, bytes, ctx.context), { headers });
      } catch (error) { return imageHttpFailure(error); }
      finally { if (acquired) active--; }
    },
    async download(request: Request, imageId: string, target: { productId: string } | { publicCode: string }) {
      let acquired = false;
      try {
        if (!deps.verifyProxy(request.headers)) throw imageError("FORBIDDEN", "FORBIDDEN");
        if (new URL(request.url).search || !["GET", "HEAD"].includes(request.method)) throw imageError("NOT_FOUND", "NOT_FOUND");
        if (active >= 4) throw imageError("INTERNAL", "BUSY"); active++; acquired = true;
        const file = "publicCode" in target ? await deps.services.download(target, imageId) : await (async () => {
          const ctx = await deps.resolveContext(request.headers); if (ctx.status !== "RESOLVED") throw imageError("FORBIDDEN", "FORBIDDEN");
          return deps.services.download({ ...target, context: ctx.context }, imageId);
        })();
        // No signed redirects, 304 or range cache paths bypass the fresh authority check.
        return new Response(request.method === "HEAD" ? null : new Uint8Array(file.bytes), { headers: { ...headers, "content-type": file.mimeType, "content-length": String(file.sizeBytes), "content-disposition": "inline", "accept-ranges": "none", "content-security-policy": "default-src 'none'; sandbox" } });
      } catch (error) { return imageHttpFailure(error, request.method === "HEAD"); }
      finally { if (acquired) active--; }
    },
  };
}
