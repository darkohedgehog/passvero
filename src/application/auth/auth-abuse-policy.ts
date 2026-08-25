import type {
  AuthAbuseDimension,
  AuthAbuseEndpoint,
} from "./auth-abuse-types";

export type AuthAbuseDimensionPolicy = Readonly<{
  metric: "ATTEMPTS" | "FAILURES";
  windowSeconds: number;
  challengeThreshold: number;
  blockThreshold: number;
}>;

export type AuthAbuseEndpointPolicy = Readonly<
  Record<AuthAbuseDimension, AuthAbuseDimensionPolicy>
>;

function createEndpointPolicy(): AuthAbuseEndpointPolicy {
  return {
    GLOBAL_ENDPOINT: {
      metric: "ATTEMPTS",
      windowSeconds: 60,
      challengeThreshold: 50,
      blockThreshold: 100,
    },
    TRUSTED_NETWORK: {
      metric: "FAILURES",
      windowSeconds: 15 * 60,
      challengeThreshold: 15,
      blockThreshold: 30,
    },
    ACCOUNT_IDENTIFIER: {
      metric: "FAILURES",
      windowSeconds: 15 * 60,
      challengeThreshold: 3,
      blockThreshold: 5,
    },
    ACCOUNT_AND_TRUSTED_NETWORK: {
      metric: "FAILURES",
      windowSeconds: 15 * 60,
      challengeThreshold: 2,
      blockThreshold: 5,
    },
  };
}

export const authAbusePolicyByEndpoint: Readonly<
  Record<AuthAbuseEndpoint, AuthAbuseEndpointPolicy>
> = {
  SIGN_IN: createEndpointPolicy(),
  ACTIVATE_ACCOUNT: createEndpointPolicy(),
  EMAIL_VERIFICATION_REQUEST: createEndpointPolicy(),
  EMAIL_VERIFICATION_CONSUME: createEndpointPolicy(),
  PASSWORD_RESET_REQUEST: createEndpointPolicy(),
  PASSWORD_RESET_CONSUME: createEndpointPolicy(),
  PASSWORD_CHANGE: createEndpointPolicy(),
};

export const authAbuseBackoffSeconds = [
  0,
  60,
  2 * 60,
  4 * 60,
  8 * 60,
  15 * 60,
  30 * 60,
  60 * 60,
  2 * 60 * 60,
  4 * 60 * 60,
  8 * 60 * 60,
  12 * 60 * 60,
  24 * 60 * 60,
] as const;

export const AUTH_ABUSE_EXPIRY_SECONDS = 30 * 24 * 60 * 60;
export const AUTH_ABUSE_BACKOFF_DECAY_SECONDS = 24 * 60 * 60;

export type AuthAbuseBucketState = Readonly<{
  dimension: AuthAbuseDimension;
  attemptCount: number;
  failureCount: number;
  backoffLevel: number;
  blockedUntil: Date | null;
}>;

export type AuthAbuseDecision =
  | Readonly<{ status: "ALLOW" }>
  | Readonly<{
    status: "REQUIRE_TURNSTILE";
    reasonCode: "ADDITIONAL_VERIFICATION_REQUIRED";
  }>
  | Readonly<{
    status: "BLOCK";
    reasonCode: "TEMPORARILY_UNAVAILABLE";
    retryAfterSeconds: number;
  }>;

export function evaluateAuthAbuseDecision(
  states: readonly AuthAbuseBucketState[],
  now: Date,
  endpoint: AuthAbuseEndpoint = "SIGN_IN",
): AuthAbuseDecision {
  let challengeRequired = false;
  let retryAfterSeconds = 0;
  for (const state of states) {
    const policy = authAbusePolicyByEndpoint[endpoint][state.dimension];
    const metric = policy.metric === "ATTEMPTS"
      ? state.attemptCount
      : state.failureCount;
    const activeBlockSeconds = state.blockedUntil === null
      ? 0
      : Math.ceil((state.blockedUntil.getTime() - now.getTime()) / 1_000);
    if (activeBlockSeconds > 0) {
      const inferredBackoff = authAbuseBackoffSeconds[
        Math.max(1, Math.min(state.backoffLevel, 12))
      ];
      retryAfterSeconds = Math.max(
        retryAfterSeconds,
        activeBlockSeconds,
        inferredBackoff,
      );
    } else if (metric >= policy.challengeThreshold) {
      challengeRequired = true;
    }
  }

  if (retryAfterSeconds > 0) {
    return {
      status: "BLOCK",
      reasonCode: "TEMPORARILY_UNAVAILABLE",
      retryAfterSeconds: Math.min(Math.max(1, retryAfterSeconds), 86_400),
    };
  }
  if (challengeRequired) {
    return {
      status: "REQUIRE_TURNSTILE",
      reasonCode: "ADDITIONAL_VERIFICATION_REQUIRED",
    };
  }
  return { status: "ALLOW" };
}
