import type { AuthenticatedIdentity } from "@/src/application/auth/resolve-current-user";
import type { AuthenticatedUserContextResolution } from "./resolve-authenticated-user-context";

type DashboardDenialReason = Extract<
  AuthenticatedUserContextResolution,
  { readonly status: "DENIED" }
>["reason"];

const LOGIN_REASONS = new Set<DashboardDenialReason>([
  "NO_PROVIDER_SESSION",
  "SESSION_TOO_OLD",
  "IDENTITY_NOT_BOUND",
  "IDENTITY_REVOKED",
  "CANONICAL_USER_NOT_FOUND",
]);

export function createProtectedDashboardEntryResolver(dependencies: {
  readonly resolveContext: (
    identity: AuthenticatedIdentity | null,
  ) => Promise<AuthenticatedUserContextResolution>;
  readonly findUserLabel: (userId: string) => Promise<string | null>;
}) {
  return async (identity: AuthenticatedIdentity | null) => {
    const resolution = await dependencies.resolveContext(identity);
    if (resolution.status === "DENIED") {
      return resolution;
    }

    const userId = resolution.status === "RESOLVED"
      ? resolution.context.userId
      : resolution.currentUserId;
    const userLabel = await dependencies.findUserLabel(userId);
    if (userLabel === null) {
      return {
        status: "DENIED" as const,
        reason: "CANONICAL_USER_NOT_FOUND" as const,
      };
    }

    return { ...resolution, userLabel };
  };
}

export function dashboardDenialOutcome(
  reason: DashboardDenialReason,
): "LOGIN" | "NO_ACCESS" {
  return LOGIN_REASONS.has(reason) ? "LOGIN" : "NO_ACCESS";
}
