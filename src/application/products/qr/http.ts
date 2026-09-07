import { canonicalProxyDenial } from "@/src/application/http/canonical-proxy";
import type { AuthenticatedUserContextResolution } from "@/src/application/context/resolve-authenticated-user-context";
import { dashboardDenialOutcome } from "@/src/application/context/protected-dashboard-entry";
import type { ActivateProductQr, QrFailure, QrFormat, RenderProductQrArtifact } from "./contracts";
import { ProductQrError } from "./errors";

const statusCodes: Record<QrFailure, number> = { UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, VALIDATION: 400, STALE_WRITE: 409, INVALID_STATE: 409, NOT_ACTIVE: 409, OPERATIONAL_FAILURE: 500 };
const safeHeaders = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
export function qrHttpFailure(error: unknown): Response {
  const status = error instanceof ProductQrError ? error.status : "OPERATIONAL_FAILURE";
  return Response.json({ status }, { status: statusCodes[status], headers: safeHeaders });
}

export function createProductQrHttpHandlers(dependencies: {
  canonicalOrigin: string;
  verifyProxy(headers: Headers): boolean;
  resolveContext(headers: Headers): Promise<AuthenticatedUserContextResolution>;
  activate: ActivateProductQr;
  render: RenderProductQrArtifact;
}) {
  async function context(request: Request) {
    const resolution = await dependencies.resolveContext(request.headers);
    if (resolution.status === "RESOLVED") return resolution.context;
    if (resolution.status === "DENIED" && dashboardDenialOutcome(resolution.reason) === "LOGIN") throw new ProductQrError("UNAUTHENTICATED");
    throw new ProductQrError("FORBIDDEN");
  }
  return {
    async activate(request: Request, productId: string): Promise<Response> {
      try {
        const url = new URL(request.url);
        const denied = canonicalProxyDenial(request, dependencies, "FORBIDDEN");
        if (denied) return denied;
        if (url.search) throw new ProductQrError("VALIDATION");
        const activationEvidence = await readEvidence(request);
        const result = await dependencies.activate({ productId, activationEvidence }, await context(request));
        return Response.json({ status: result.status }, { headers: safeHeaders });
      } catch (error) { return qrHttpFailure(error); }
    },
    async artifact(request: Request, productId: string, format: QrFormat, preview: boolean): Promise<Response> {
      try {
        if (request.method !== "GET") throw new ProductQrError("FORBIDDEN");
        if (new URL(request.url).search) throw new ProductQrError("VALIDATION");
        const artifact = await dependencies.render({ productId, format }, await context(request));
        return new Response(new Uint8Array(artifact.body), { headers: {
          ...safeHeaders,
          "content-type": artifact.contentType,
          "content-disposition": preview ? "inline" : `attachment; filename="${artifact.filename}"`,
          ...(format === "SVG" ? { "content-security-policy": "default-src 'none'; sandbox" } : {}),
        } });
      } catch (error) { return qrHttpFailure(error); }
    },
  };
}

async function readEvidence(request: Request): Promise<string> {
  const invalid = () => new ProductQrError("VALIDATION");
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "") || request.body === null) throw invalid();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > 2048) { await reader.cancel(); throw invalid(); }
      chunks.push(chunk.value);
    }
  } catch { throw invalid(); } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let value: unknown;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw invalid(); }
  if (typeof value !== "object" || value === null || Array.isArray(value) || Object.keys(value).length !== 1 || !("activationEvidence" in value) || typeof value.activationEvidence !== "string" || value.activationEvidence.length === 0 || value.activationEvidence.length > 512) throw invalid();
  return value.activationEvidence;
}
