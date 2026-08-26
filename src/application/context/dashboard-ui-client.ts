export type DashboardMutationResult = "SUCCESS" | "FAILURE";

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export function selectDashboardOrganization(
  fetcher: Fetcher,
  targetOrganizationId: string,
): Promise<DashboardMutationResult> {
  return post(
    fetcher,
    "/api/auth/organization-selection",
    "SELECTED",
    JSON.stringify({ targetOrganizationId }),
  );
}

export function signOutFromDashboard(
  fetcher: Fetcher,
): Promise<DashboardMutationResult> {
  return post(fetcher, "/api/auth/sign-out", "SIGNED_OUT");
}

async function post(
  fetcher: Fetcher,
  endpoint: string,
  expectedStatus: string,
  body?: string,
): Promise<DashboardMutationResult> {
  try {
    const response = await fetcher(endpoint, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      ...(body === undefined
        ? {}
        : {
          headers: { "content-type": "application/json" },
          body,
        }),
    });
    const value: unknown = await response.json();
    if (
      !response.ok
      || typeof value !== "object"
      || value === null
      || Array.isArray(value)
      || (value as Record<string, unknown>).status !== expectedStatus
    ) {
      return "FAILURE";
    }
    return "SUCCESS";
  } catch {
    return "FAILURE";
  }
}
