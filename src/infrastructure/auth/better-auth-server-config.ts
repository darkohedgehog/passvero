import type { BetterAuthOptions } from "better-auth";

export type BetterAuthServerConfigErrorCode =
  | "SECRET_MISSING"
  | "SECRET_PADDED"
  | "SECRET_LENGTH"
  | "ORIGIN_MISSING"
  | "ORIGIN_PADDED"
  | "ORIGIN_MALFORMED"
  | "ORIGIN_SCHEME"
  | "ORIGIN_SHAPE";

const messages: Record<BetterAuthServerConfigErrorCode, string> = {
  SECRET_MISSING: "Better Auth secret configuration is required.",
  SECRET_PADDED: "Better Auth secret configuration must not contain surrounding whitespace.",
  SECRET_LENGTH: "Better Auth secret configuration is too short.",
  ORIGIN_MISSING: "Better Auth application origin is required.",
  ORIGIN_PADDED: "Better Auth application origin must not contain surrounding whitespace.",
  ORIGIN_MALFORMED: "Better Auth application origin is invalid.",
  ORIGIN_SCHEME: "Better Auth application origin must use HTTPS.",
  ORIGIN_SHAPE: "Better Auth application origin must be a fixed canonical origin.",
};

export class BetterAuthServerConfigError extends Error {
  constructor(readonly code: BetterAuthServerConfigErrorCode) {
    super(messages[code]);
    this.name = "BetterAuthServerConfigError";
  }
}

export interface BetterAuthServerConfig {
  readonly secret: string;
  readonly baseURL: string;
  readonly trustedOrigins: readonly [string];
}

export function validateBetterAuthServerConfig(input: {
  readonly secret: unknown;
  readonly baseURL: unknown;
}): BetterAuthServerConfig {
  if (typeof input.secret !== "string" || input.secret.length === 0) {
    throw new BetterAuthServerConfigError("SECRET_MISSING");
  }
  if (input.secret !== input.secret.trim()) {
    throw new BetterAuthServerConfigError("SECRET_PADDED");
  }
  if (input.secret.length < 32) {
    throw new BetterAuthServerConfigError("SECRET_LENGTH");
  }
  if (typeof input.baseURL !== "string" || input.baseURL.length === 0) {
    throw new BetterAuthServerConfigError("ORIGIN_MISSING");
  }
  if (input.baseURL !== input.baseURL.trim()) {
    throw new BetterAuthServerConfigError("ORIGIN_PADDED");
  }

  let parsed: URL;
  try {
    parsed = new URL(input.baseURL);
  } catch {
    throw new BetterAuthServerConfigError("ORIGIN_MALFORMED");
  }

  if (parsed.protocol !== "https:") {
    throw new BetterAuthServerConfigError("ORIGIN_SCHEME");
  }
  if (
    parsed.username.length > 0
    || parsed.password.length > 0
    || parsed.port.length > 0
    || parsed.pathname !== "/"
    || parsed.search.length > 0
    || parsed.hash.length > 0
  ) {
    throw new BetterAuthServerConfigError("ORIGIN_SHAPE");
  }

  return {
    secret: input.secret,
    baseURL: parsed.origin,
    trustedOrigins: [parsed.origin],
  };
}

export function createBetterAuthServerOptions(
  config: BetterAuthServerConfig,
  database: NonNullable<BetterAuthOptions["database"]>,
  password: NonNullable<
    NonNullable<BetterAuthOptions["emailAndPassword"]>["password"]
  >,
): BetterAuthOptions {
  return {
    appName: "Passvero",
    database,
    secret: config.secret,
    baseURL: config.baseURL,
    trustedOrigins: [...config.trustedOrigins],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 1,
      maxPasswordLength: 256,
      password,
    },
    user: { modelName: "AuthProviderUser" },
    session: {
      modelName: "AuthProviderSession",
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    account: { modelName: "AuthProviderAccount" },
    verification: { modelName: "AuthProviderVerification" },
    advanced: {
      crossSubDomainCookies: { enabled: false },
      defaultCookieAttributes: {
        secure: true,
        httpOnly: true,
        sameSite: "lax",
      },
    },
    telemetry: { enabled: false },
  };
}
