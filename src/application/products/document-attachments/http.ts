import { ApplicationError } from "../../errors/application-error";
import { canonicalProxyDenial } from "../../http/canonical-proxy";
import type { AuthenticatedUserContextResolution } from "../../context/resolve-authenticated-user-context";
import type { MutateAttachment } from "./contracts";
export function attachmentResponse(status: string, http: number) {
  return Response.json({ status }, { status: http, headers: { "Cache-Control": "private, no-store" } });
}
export function createAttachmentHttpHandler(deps: { canonicalOrigin: string; verifyProxy(headers: Headers): boolean; resolveContext(headers: Headers): Promise<AuthenticatedUserContextResolution>; mutate: MutateAttachment }) {
  return async (request: Request, productId: string) => {
    try {
      const denied = canonicalProxyDenial(request, deps, "FORBIDDEN");
      if (denied) return denied;
      const context = await deps.resolveContext(request.headers);
      if (context.status !== "RESOLVED") return attachmentResponse("FORBIDDEN", 403);
      if (new URL(request.url).search || !/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return attachmentResponse("VALIDATION_ERROR", 400);
      const reader = request.body?.getReader();
      if (!reader) return attachmentResponse("VALIDATION_ERROR", 400);
      let input = "";
      try {
        const decoder = new TextDecoder("utf-8", { fatal: true });
        let total = 0;
        const deadline = AbortSignal.timeout(10_000);
        const abort = () => { void reader.cancel().catch(() => {}); };
        deadline.addEventListener("abort", abort, { once: true });
        try {
          while (true) {
            const chunk = await reader.read();
            if (deadline.aborted) throw new Error();
            if (chunk.done) break;
            total += chunk.value.byteLength;
            if (total > 32768) throw new Error();
            input += decoder.decode(chunk.value, { stream: true });
          }
          input += decoder.decode();
        } finally { deadline.removeEventListener("abort", abort); }
      } catch { await reader.cancel().catch(() => {}); return attachmentResponse("VALIDATION_ERROR", 400); }
      finally { reader.releaseLock(); }
      let body: unknown;
      try { body = JSON.parse(input); } catch { return attachmentResponse("VALIDATION_ERROR", 400); }
      const result = await deps.mutate(productId, body, context.context);
      return attachmentResponse(result.status, 200);
    } catch (error) {
      if (error instanceof ApplicationError) {
        const codes: Partial<Record<ApplicationError["category"], number>> = { VALIDATION: 400, UNAUTHENTICATED: 403, FORBIDDEN: 403, NOT_FOUND: 404, INVALID_STATE: 409, CONFLICT: 409, INTERNAL: 503 };
        return attachmentResponse(error.category === "INTERNAL" ? "OPERATIONAL_FAILURE" : error.code, codes[error.category] ?? 503);
      }
      return attachmentResponse("OPERATIONAL_FAILURE", 503);
    }
  };
}
