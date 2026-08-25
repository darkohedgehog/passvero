import type { AuthenticatedUserContextResolution } from "@/src/application/context/resolve-authenticated-user-context";

export function createContextSmokeHandler(dependencies: {
  readonly resolve: (headers: Headers) => Promise<AuthenticatedUserContextResolution>;
}) {
  return async (request: Request): Promise<Response> => {
    const result = await dependencies.resolve(request.headers);
    if (result.status === "RESOLVED") {
      return safeJson({ authenticated: true, organizationContext: true }, 200);
    }
    if (result.status === "ORGANIZATION_SELECTION_REQUIRED") {
      return safeJson(
        {
          authenticated: true,
          organizationContext: false,
          organizationSelectionRequired: true,
        },
        409,
      );
    }
    return safeJson(
      { authenticated: false, organizationContext: false },
      401,
    );
  };
}

function safeJson(body: Record<string, boolean>, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
