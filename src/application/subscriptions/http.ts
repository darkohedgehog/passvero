import { ApplicationError } from "../errors/application-error";
import { canonicalProxyDenial, type CanonicalProxyDependencies } from "../http/canonical-proxy";

export function createCommercialHttpHandler(dependencies: CanonicalProxyDependencies & {
  execute(headers: Headers, input: unknown): Promise<unknown>;
}) {
  const respond = (data: unknown, status = 200) => Response.json(data, {
    status, headers: { "Cache-Control": "private, no-store" },
  });
  return async (request: Request): Promise<Response> => {
    try {
      const denied = canonicalProxyDenial(request, dependencies, "FORBIDDEN");
      if (denied) return denied;
      if (new URL(request.url).search || !/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return respond({ status: "VALIDATION_ERROR" }, 400);
      const reader = request.body?.getReader();
      if (!reader) return respond({ status: "VALIDATION_ERROR" }, 400);
      let input: unknown;
      const deadline = AbortSignal.timeout(10000);
      const abort = () => { void reader.cancel().catch(() => {}); };
      deadline.addEventListener("abort", abort, { once: true });
      try {
        const decoder = new TextDecoder("utf-8", { fatal: true });
        let bytes = 0;
        let body = "";
        while (true) {
          const part = await reader.read();
          if (deadline.aborted) throw new Error();
          if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > 16384) throw new Error();
          body += decoder.decode(part.value, { stream: true });
        }
        input = JSON.parse(body + decoder.decode());
      } catch {
        await reader.cancel().catch(() => {});
        return respond({ status: "VALIDATION_ERROR" }, 400);
      } finally {
        deadline.removeEventListener("abort", abort);
        reader.releaseLock();
      }
      return respond(await dependencies.execute(request.headers, input));
    } catch (error) {
      if (error instanceof ApplicationError) {
        const status = error.category === "FORBIDDEN" ? 403 : error.category === "VALIDATION" ? 400 : (error.category === "CONFLICT" || error.category === "INVALID_STATE") ? 409 : 503;
        return respond({ status: status === 503 ? "OPERATIONAL_FAILURE" : error.code }, status);
      }
      return respond({ status: "OPERATIONAL_FAILURE" }, 503);
    }
  };
}
