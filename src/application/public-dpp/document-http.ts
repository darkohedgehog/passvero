import { DocumentError } from "../documents/contracts";
import type { createPublicDocumentService } from "./documents";
const headers = { "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" };
export function publicDocumentFailure(error: unknown, head: boolean) {
  const status = error instanceof DocumentError && error.code !== "OPERATIONAL_FAILURE" ? 404 : 503;
  return new Response(head ? null : JSON.stringify({ status: status === 404 ? "NOT_FOUND" : "TEMPORARILY_UNAVAILABLE" }), {
    status, headers: { ...headers, "content-type": "application/json" },
  });
}
export function createPublicDocumentHttpHandler(deps: {
  service: Pick<ReturnType<typeof createPublicDocumentService>, "download">;
  enabled(): boolean;
}) {
  let active = 0;
  return async (request: Request, publicCode: string, attachmentId: string) => {
    const head = request.method === "HEAD";
    let acquired = false;
    try {
      if (!deps.enabled() || (!head && request.method !== "GET") || new URL(request.url).search) throw new DocumentError("NOT_FOUND");
      // Ranges/conditional requests get full reauthorization and a full 200 response;
      // no partial/304 path can bypass verification.
      if (active >= 4) throw new DocumentError("OPERATIONAL_FAILURE");
      active++; acquired = true;
      const file = await deps.service.download(publicCode, attachmentId, head, request.signal);
      const ascii = file.filename.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 200) || "document.pdf";
      const encoded = encodeURIComponent(file.filename).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
      return new Response(head || !file.bytes ? null : new Uint8Array(file.bytes), { headers: {
        ...headers, "content-type": "application/pdf", "content-length": String(file.sizeBytes),
        "content-disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`,
        "accept-ranges": "none", "content-security-policy": "default-src 'none'; sandbox",
      } });
    } catch (e) { return publicDocumentFailure(e, head); }
    finally { if (acquired) active--; }
  };
}
