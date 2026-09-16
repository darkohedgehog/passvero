import { z } from "zod";
import type { AuthenticatedUserContextResolution } from "../context/resolve-authenticated-user-context";
import type { AuthenticatedUserContext } from "../context/authenticated-user-context";
import { canonicalProxyDenial } from "../http/canonical-proxy";
import { documentHttpFailure } from "./http";
import { DocumentError, type DocumentPersistence } from "./contracts";
import { documentScanStatus } from "./access-policy";
import { readDocumentBytes } from "./bytes";
import type { DocumentScanResult } from "./scan-document";

const headers = { "cache-control": "private, no-store", "x-content-type-options": "nosniff" };
const idSchema = z.string().uuid();
const command = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("SCAN") }).strict(),
  z.object({ operation: z.literal("RECOVER"), expectedAttemptId: idSchema }).strict(),
]);
export function createDocumentScanHttpHandlers(deps: {
  enabled(): boolean;
  canonicalOrigin: string;
  verifyProxy(headers: Headers): boolean;
  resolveContext(headers: Headers): Promise<AuthenticatedUserContextResolution>;
  persistence: DocumentPersistence;
  scan(id: string, context: AuthenticatedUserContext, options: { signal: AbortSignal }): Promise<DocumentScanResult>;
  recover(id: string, attempt: string, context: AuthenticatedUserContext): Promise<unknown>;
  now?: () => number;
}) {
  return async (request: Request, documentId: string): Promise<Response> => {
    try {
      if (!deps.enabled()) throw new DocumentError("NOT_AVAILABLE");
      const read = request.method === "GET";
      if (read) {
        if (!deps.verifyProxy(request.headers)) throw new DocumentError("FORBIDDEN");
        const origin = request.headers.get("origin");
        if (origin !== null && origin !== deps.canonicalOrigin) throw new DocumentError("FORBIDDEN");
      } else {
        const denied = canonicalProxyDenial(request, deps, "FORBIDDEN");
        if (denied) return denied;
      }
      if (!idSchema.safeParse(documentId).success || new URL(request.url).search) throw new DocumentError("VALIDATION_ERROR");
      const actor = await deps.resolveContext(request.headers);
      if (actor.status !== "RESOLVED") throw new DocumentError("FORBIDDEN");
      if (read) {
        const row = await deps.persistence.read(actor.context, documentId, "PRODUCT_READ");
        return Response.json(documentScanStatus(row, (deps.now ?? Date.now)()), { headers });
      }
      if (request.headers.get("content-type") !== "application/json" || request.headers.has("content-encoding")) throw new DocumentError("VALIDATION_ERROR");
      let input: z.infer<typeof command>;
      try {
        const body = await readDocumentBytes(request.body, AbortSignal.any([request.signal, AbortSignal.timeout(5000)]), 256);
        input = command.parse(JSON.parse(new TextDecoder().decode(body)));
      } catch { throw new DocumentError("VALIDATION_ERROR"); }
      if (request.signal.aborted) throw new DocumentError("OPERATIONAL_FAILURE");
      const result = input.operation === "SCAN"
        ? await deps.scan(documentId, actor.context, { signal: AbortSignal.any([request.signal, AbortSignal.timeout(90_000)]) })
        : await deps.recover(documentId, input.expectedAttemptId, actor.context);
      return Response.json(result, { headers });
    } catch (error) { return documentHttpFailure(error); }
  };
}
