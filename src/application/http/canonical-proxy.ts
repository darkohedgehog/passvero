export const PROXY_TOKEN_HEADER = "x-passvero-proxy-token";

export interface CanonicalProxyDependencies {
  readonly canonicalOrigin: string;
  readonly verifyProxy: (headers: Headers) => boolean;
}

// Provenance is injected by server composition; request.url is only transport data.
export function canonicalProxyDenial(
  request: Request,
  dependencies: CanonicalProxyDependencies,
  denialStatus: "DENIED" | "FORBIDDEN",
  verificationGet = false,
): Response | null {
  try {
    const origin = request.headers.get("origin");
    if (dependencies.verifyProxy(request.headers)
      && request.method === (verificationGet ? "GET" : "POST")
      && (origin === dependencies.canonicalOrigin || (verificationGet && origin === null))) return null;
  } catch {
    return Response.json({ status: "OPERATIONAL_FAILURE" }, {
      status: 503, headers: { "cache-control": "no-store" },
    });
  }
  return Response.json({ status: denialStatus }, {
    status: 403, headers: { "cache-control": "no-store" },
  });
}

export function providerFacingHeaders(headers: Headers): Headers {
  const sanitized = new Headers(headers);
  sanitized.delete(PROXY_TOKEN_HEADER);
  return sanitized;
}
