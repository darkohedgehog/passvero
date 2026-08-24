import type { AuthenticatedIdentity } from "@/src/application/auth/resolve-current-user";

interface BetterAuthSessionResult {
  readonly session: {
    readonly id: string;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly userId: string;
    readonly expiresAt: Date;
    readonly token: string;
    readonly ipAddress?: string | null;
    readonly userAgent?: string | null;
  };
  readonly user: {
    readonly id: string;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly email: string;
    readonly emailVerified: boolean;
    readonly name: string;
    readonly image?: string | null;
  };
}

type GetBetterAuthSession = (input: {
  readonly headers: Headers;
  readonly query: {
    readonly disableCookieCache: true;
    readonly disableRefresh: true;
  };
}) => Promise<BetterAuthSessionResult | null>;

export function createBetterAuthSessionReader(
  getSession: GetBetterAuthSession,
) {
  return {
    async read(headers: Headers): Promise<AuthenticatedIdentity | null> {
      const result = await getSession({
        headers,
        query: { disableCookieCache: true, disableRefresh: true },
      });
      if (result === null) {
        return null;
      }

      const authenticatedAt = result.session.createdAt.getTime();
      if (
        result.user.id.length === 0
        || result.session.id.length === 0
        || result.session.userId !== result.user.id
        || !Number.isFinite(authenticatedAt)
      ) {
        return null;
      }

      return {
        provider: "BETTER_AUTH",
        providerSubject: result.user.id,
        providerSessionId: result.session.id,
        authenticatedAt: new Date(authenticatedAt),
      };
    },
  };
}
