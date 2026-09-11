import { canonicalProxyDenial } from "../http/canonical-proxy";
import type { AuthenticatedUserContextResolution } from "../context/resolve-authenticated-user-context";
import { DocumentError, type DocumentServices } from "./contracts";
import { readDocumentBytes } from "./bytes";
import { MAX_DOCUMENT_PDF_SIZE } from "./pdf";
const safeHeaders = { "cache-control": "private, no-store", "x-content-type-options": "nosniff" };
export function documentHttpFailure(error: unknown, head = false): Response {
  const status = error instanceof DocumentError ? error.code : "OPERATIONAL_FAILURE";
  const codes = { VALIDATION_ERROR: 400, FORBIDDEN: 403, NOT_FOUND: 404, NOT_AVAILABLE: 409, UPLOAD_FAILED: 503, RECOVERY_REQUIRED: 503, OPERATIONAL_FAILURE: 503 };
  return new Response(head ? null : JSON.stringify({ status }), { status: codes[status], headers: { ...safeHeaders, "content-type": "application/json" } });
}
export function createDocumentHttpHandlers(deps: {
  services: DocumentServices;
  canonicalOrigin: string;
  verifyProxy(headers: Headers): boolean;
  resolveContext(headers: Headers): Promise<AuthenticatedUserContextResolution>;
}) {
  // Per-process bounded memory/concurrency, not a substitute for edge rate limits.
  let active = 0;
  async function context(request: Request) {
    const resolution = await deps.resolveContext(request.headers);
    if (resolution.status !== "RESOLVED") throw new DocumentError("FORBIDDEN");
    return resolution.context;
  }
  return {
    async upload(request: Request): Promise<Response> {
      let acquired = false;
      try {
        const denied = canonicalProxyDenial(request, deps, "FORBIDDEN");
        if (denied) return denied;
        const ctx = await context(request);
        await deps.services.authorizeUpload(ctx);
        if (new URL(request.url).search || request.headers.get("content-type") !== "application/pdf" || request.headers.has("content-encoding")) throw new DocumentError("VALIDATION_ERROR");
        const declaredLength = request.headers.get("content-length");
        if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_DOCUMENT_PDF_SIZE)) throw new DocumentError("VALIDATION_ERROR");
        if (active >= 4) throw new DocumentError("OPERATIONAL_FAILURE");
        active++; acquired = true;
        let filename: string; let displayName: string | undefined;
        try {
          filename = decodeURIComponent(request.headers.get("x-document-filename") ?? "");
          const display = request.headers.get("x-document-display-name");
          displayName = display === null ? undefined : decodeURIComponent(display);
        } catch { throw new DocumentError("VALIDATION_ERROR"); }
        const signal = AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]);
        const bytes = await readDocumentBytes(request.body, signal);
        const result = await deps.services.upload({ filename, displayName, mimeType: request.headers.get("content-type"), bytes }, ctx);
        return Response.json(result, { status: 201, headers: safeHeaders });
      } catch (error) { return documentHttpFailure(error); }
      finally { if (acquired) active--; }
    },
    async download(request: Request, id: string): Promise<Response> {
      const head = request.method === "HEAD";
      let acquired = false;
      try {
        if (!head && request.method !== "GET") throw new DocumentError("FORBIDDEN");
        if (!deps.verifyProxy(request.headers)) throw new DocumentError("FORBIDDEN");
        const origin = request.headers.get("origin");
        if (origin !== null && origin !== deps.canonicalOrigin) throw new DocumentError("FORBIDDEN");
        const ctx = await context(request);
        if (new URL(request.url).search) throw new DocumentError("VALIDATION_ERROR");
        if (active >= 4) throw new DocumentError("OPERATIONAL_FAILURE");
        active++; acquired = true;
        const file = await deps.services.download(id, ctx, head);
        const ascii = file.filename.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 200) || "document.pdf";
        const encoded = encodeURIComponent(file.filename).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
        return new Response(head || !file.bytes ? null : new Uint8Array(file.bytes), { headers: {
          ...safeHeaders, "content-type": "application/pdf", "content-length": String(file.sizeBytes),
          "content-disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`,
          "accept-ranges": "none", "content-security-policy": "default-src 'none'; sandbox",
        } });
      } catch (error) { return documentHttpFailure(error, head); }
      finally { if (acquired) active--; }
    },
  };
}
