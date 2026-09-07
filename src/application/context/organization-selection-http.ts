import { canonicalProxyDenial } from "@/src/application/http/canonical-proxy";
import type { OrganizationSelectionResult } from "./resolve-authenticated-user-context";

const AUTHENTICATION_FAILURES = new Set([
  "NO_PROVIDER_SESSION",
  "SESSION_TOO_OLD",
  "IDENTITY_NOT_BOUND",
  "IDENTITY_REVOKED",
  "CANONICAL_USER_NOT_FOUND",
]);

export function createOrganizationSelectionHttpHandler(dependencies: {
  readonly canonicalOrigin: string;
  readonly verifyProxy: (headers: Headers) => boolean;
  readonly select: (
    headers: Headers,
    targetOrganizationId: string,
  ) => Promise<OrganizationSelectionResult>;
}) {
  return async (request: Request): Promise<Response> => {
    const denied = canonicalProxyDenial(request, dependencies, "DENIED");
    if (denied) return denied;

    const body = await readBody(request);
    if (body === null) {
      return json({ status: "INVALID_REQUEST" }, 400);
    }

    try {
      const result = await dependencies.select(
        request.headers,
        body.targetOrganizationId,
      );
      if (result.status === "SELECTED") {
        return json({ status: "SELECTED" }, 200);
      }
      return json(
        { status: "DENIED" },
        AUTHENTICATION_FAILURES.has(result.reason) ? 401 : 403,
      );
    } catch {
      return json({ status: "OPERATIONAL_FAILURE" }, 503);
    }
  };
}

async function readBody(
  request: Request,
): Promise<{ readonly targetOrganizationId: string } | null> {
  if (!/^application\/json(?:\s*;|$)/i.test(
    request.headers.get("content-type") ?? "",
  )) {
    return null;
  }
  let text: string;
  try {
    text = await request.text();
  } catch {
    return null;
  }
  if (text.length === 0 || text.length > 512) {
    return null;
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length !== 1
    || typeof record.targetOrganizationId !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      record.targetOrganizationId,
    )
  ) {
    return null;
  }
  return { targetOrganizationId: record.targetOrganizationId };
}


function json(body: object, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
