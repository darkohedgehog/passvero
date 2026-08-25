export interface AuthenticatedIdentity {
  readonly provider: "BETTER_AUTH";
  readonly providerSubject: string;
  readonly providerSessionId: string;
  readonly authenticatedAt: Date;
}

export interface CurrentUser {
  readonly userId: string;
}

export interface AuthIdentityBinding {
  readonly revokedAt: Date | null;
  readonly currentUser: CurrentUser | null;
}

export interface CurrentUserIdentityReader {
  findByProviderSubject(input: {
    readonly provider: AuthenticatedIdentity["provider"];
    readonly providerSubject: string;
  }): Promise<AuthIdentityBinding | null>;
}

export type CurrentUserResolutionFailure =
  | "NO_PROVIDER_SESSION"
  | "SESSION_TOO_OLD"
  | "IDENTITY_NOT_BOUND"
  | "IDENTITY_REVOKED"
  | "CANONICAL_USER_NOT_FOUND";

export type CurrentUserResolution =
  | {
    readonly status: "AUTHENTICATED";
    readonly currentUser: CurrentUser;
    readonly providerSession: Pick<
      AuthenticatedIdentity,
      "provider" | "providerSessionId"
    >;
  }
  | {
    readonly status: "UNAUTHENTICATED";
    readonly reason: CurrentUserResolutionFailure;
  };

const ABSOLUTE_SESSION_AGE_MS = 30 * 24 * 60 * 60 * 1_000;

export function createCurrentUserResolver(dependencies: {
  readonly identityReader: CurrentUserIdentityReader;
  readonly now: () => Date;
}) {
  return async (
    identity: AuthenticatedIdentity | null,
  ): Promise<CurrentUserResolution> => {
    if (identity === null) {
      return unauthenticated("NO_PROVIDER_SESSION");
    }

    const now = dependencies.now().getTime();
    const authenticatedAt = identity.authenticatedAt.getTime();
    if (
      !Number.isFinite(now)
      || !Number.isFinite(authenticatedAt)
      || now >= authenticatedAt + ABSOLUTE_SESSION_AGE_MS
    ) {
      return unauthenticated("SESSION_TOO_OLD");
    }

    const binding = await dependencies.identityReader.findByProviderSubject({
      provider: identity.provider,
      providerSubject: identity.providerSubject,
    });
    if (binding === null) {
      return unauthenticated("IDENTITY_NOT_BOUND");
    }
    if (binding.revokedAt !== null) {
      return unauthenticated("IDENTITY_REVOKED");
    }
    if (binding.currentUser === null) {
      return unauthenticated("CANONICAL_USER_NOT_FOUND");
    }

    return {
      status: "AUTHENTICATED",
      currentUser: binding.currentUser,
      providerSession: {
        provider: identity.provider,
        providerSessionId: identity.providerSessionId,
      },
    };
  };
}

function unauthenticated(
  reason: CurrentUserResolutionFailure,
): CurrentUserResolution {
  return { status: "UNAUTHENTICATED", reason };
}
