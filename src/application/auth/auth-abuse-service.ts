import {
  authAbusePolicyByEndpoint,
  evaluateAuthAbuseDecision,
  type AuthAbuseBucketState,
  type AuthAbuseDecision,
  type AuthAbuseEndpointPolicy,
} from "./auth-abuse-policy";
import type {
  AuthAbuseBucketKey,
  AuthAbuseEndpoint,
} from "./auth-abuse-types";

export interface AuthAbuseRepository {
  recordPreAttempt(input: {
    readonly keys: readonly AuthAbuseBucketKey[];
    readonly policy: AuthAbuseEndpointPolicy;
    readonly now: Date;
  }): Promise<readonly AuthAbuseBucketState[]>;
  recordOutcome(input: {
    readonly keys: readonly AuthAbuseBucketKey[];
    readonly policy: AuthAbuseEndpointPolicy;
    readonly outcome: "SUCCESS" | "FAILURE";
    readonly now: Date;
  }): Promise<void>;
}

type TrustedClientNetwork = Readonly<{
  addressFamily: "IPV4" | "IPV6";
  networkKey: string;
}>;

export type AuthAbuseServiceDependencies = Readonly<{
  repository: AuthAbuseRepository;
  canonicalizeAccountIdentifier(value: string): string;
  normalizeTrustedClientNetwork(
    value: string | undefined,
  ): TrustedClientNetwork | null;
  deriveKeys(input: {
    readonly endpoint: AuthAbuseEndpoint;
    readonly canonicalAccountIdentifier?: string;
    readonly trustedNetwork?: string;
  }): readonly AuthAbuseBucketKey[];
  now(): Date;
}>;

export type AuthAbuseAttemptInput = Readonly<{
  endpoint: AuthAbuseEndpoint;
  accountIdentifier?: string;
  trustedClientAddress?: string;
}>;

export function createAuthAbuseService(
  dependencies: AuthAbuseServiceDependencies,
) {
  function deriveKeys(
    input: AuthAbuseAttemptInput,
  ): readonly AuthAbuseBucketKey[] | null {
    try {
      const canonicalAccountIdentifier = input.accountIdentifier === undefined
        ? undefined
        : dependencies.canonicalizeAccountIdentifier(input.accountIdentifier);
      const trustedNetwork = dependencies.normalizeTrustedClientNetwork(
        input.trustedClientAddress,
      );
      if (input.trustedClientAddress !== undefined && trustedNetwork === null) {
        return null;
      }
      return dependencies.deriveKeys({
        endpoint: input.endpoint,
        canonicalAccountIdentifier,
        trustedNetwork: trustedNetwork?.networkKey,
      });
    } catch {
      return null;
    }
  }

  return {
    async checkBeforeAttempt(
      input: AuthAbuseAttemptInput,
    ): Promise<AuthAbuseDecision> {
      const keys = deriveKeys(input);
      if (keys === null) {
        return failClosedDecision();
      }
      const now = dependencies.now();
      try {
        const states = await dependencies.repository.recordPreAttempt({
          keys,
          policy: authAbusePolicyByEndpoint[input.endpoint],
          now,
        });
        return evaluateAuthAbuseDecision(states, now, input.endpoint);
      } catch {
        return failClosedDecision();
      }
    },

    async recordOutcome(input: AuthAbuseAttemptInput & Readonly<{
      outcome: "SUCCESS" | "FAILURE";
    }>): Promise<
      | Readonly<{ status: "RECORDED" }>
      | Readonly<{ status: "OPERATIONAL_RECONCILIATION_REQUIRED" }>
    > {
      const keys = deriveKeys(input);
      if (keys === null) {
        return { status: "OPERATIONAL_RECONCILIATION_REQUIRED" };
      }
      try {
        await dependencies.repository.recordOutcome({
          keys,
          policy: authAbusePolicyByEndpoint[input.endpoint],
          outcome: input.outcome,
          now: dependencies.now(),
        });
        return { status: "RECORDED" };
      } catch {
        return { status: "OPERATIONAL_RECONCILIATION_REQUIRED" };
      }
    },
  };
}

function failClosedDecision(): AuthAbuseDecision {
  return {
    status: "BLOCK",
    reasonCode: "TEMPORARILY_UNAVAILABLE",
    retryAfterSeconds: 1,
  };
}
