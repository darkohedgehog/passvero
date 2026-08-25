import assert from "node:assert/strict";
import test from "node:test";

import {
  authAbusePolicyByEndpoint,
  evaluateAuthAbuseDecision,
  type AuthAbuseBucketState,
} from "../../src/application/auth/auth-abuse-policy";
import type {
  AuthAbuseDimension,
  AuthAbuseEndpoint,
} from "../../src/application/auth/auth-abuse-types";

const now = new Date("2026-08-25T10:00:00.000Z");

function state(
  dimension: AuthAbuseDimension,
  counts: { attempts?: number; failures?: number; blockedUntil?: Date | null },
): AuthAbuseBucketState {
  return {
    dimension,
    attemptCount: counts.attempts ?? 0,
    failureCount: counts.failures ?? 0,
    backoffLevel: 0,
    blockedUntil: counts.blockedUntil ?? null,
  };
}

test("maps every approved endpoint to an explicit isolated policy", () => {
  const endpoints: readonly AuthAbuseEndpoint[] = [
    "SIGN_IN",
    "ACTIVATE_ACCOUNT",
    "EMAIL_VERIFICATION_REQUEST",
    "EMAIL_VERIFICATION_CONSUME",
    "PASSWORD_RESET_REQUEST",
    "PASSWORD_RESET_CONSUME",
    "PASSWORD_CHANGE",
  ];

  assert.deepEqual(Object.keys(authAbusePolicyByEndpoint), endpoints);
  for (const endpoint of endpoints) {
    assert.equal(authAbusePolicyByEndpoint[endpoint].GLOBAL_ENDPOINT.windowSeconds, 60);
    assert.equal(authAbusePolicyByEndpoint[endpoint].ACCOUNT_IDENTIFIER.blockThreshold, 5);
  }
});

test("clean state allows without exposing bucket details", () => {
  assert.deepEqual(evaluateAuthAbuseDecision([], now), { status: "ALLOW" });
});

test("moderate account abuse requires Turnstile with a generic reason", () => {
  assert.deepEqual(evaluateAuthAbuseDecision([
    state("ACCOUNT_IDENTIFIER", { attempts: 3, failures: 3 }),
  ], now), {
    status: "REQUIRE_TURNSTILE",
    reasonCode: "ADDITIONAL_VERIFICATION_REQUIRED",
  });
});

test("combined account and network evidence escalates earlier", () => {
  assert.deepEqual(evaluateAuthAbuseDecision([
    state("ACCOUNT_IDENTIFIER", { attempts: 2, failures: 2 }),
  ], now), { status: "ALLOW" });
  assert.equal(evaluateAuthAbuseDecision([
    state("ACCOUNT_AND_TRUSTED_NETWORK", { attempts: 2, failures: 2 }),
  ], now).status, "REQUIRE_TURNSTILE");
});

test("sustained abuse blocks with a bounded retryAfter", () => {
  assert.deepEqual(evaluateAuthAbuseDecision([
    state("ACCOUNT_IDENTIFIER", {
      attempts: 5,
      failures: 5,
      blockedUntil: new Date(now.getTime() + 120_500),
    }),
  ], now), {
    status: "BLOCK",
    reasonCode: "TEMPORARILY_UNAVAILABLE",
    retryAfterSeconds: 121,
  });

  const bounded = evaluateAuthAbuseDecision([
    state("ACCOUNT_IDENTIFIER", {
      attempts: 100,
      failures: 100,
      blockedUntil: new Date(now.getTime() + 7 * 86_400_000),
    }),
  ], now);
  assert.equal(bounded.status, "BLOCK");
  assert.equal(
    bounded.status === "BLOCK" ? bounded.retryAfterSeconds : null,
    86_400,
  );
});

test("expired blocks require Turnstile instead of extending the block from counts alone", () => {
  assert.deepEqual(evaluateAuthAbuseDecision([
    state("ACCOUNT_IDENTIFIER", {
      attempts: 5,
      failures: 5,
      blockedUntil: new Date(now.getTime() - 1),
    }),
  ], now), {
    status: "REQUIRE_TURNSTILE",
    reasonCode: "ADDITIONAL_VERIFICATION_REQUIRED",
  });
});

test("global attempt volume can block broad endpoint flooding", () => {
  assert.equal(evaluateAuthAbuseDecision([
    state("GLOBAL_ENDPOINT", { attempts: 99 }),
  ], now).status, "REQUIRE_TURNSTILE");
  assert.equal(evaluateAuthAbuseDecision([
    state("GLOBAL_ENDPOINT", {
      attempts: 100,
      blockedUntil: new Date(now.getTime() + 60_000),
    }),
  ], now).status, "BLOCK");
});

test("account decisions have identical public shapes regardless of account existence", () => {
  const existingAccountSignal = evaluateAuthAbuseDecision([
    state("ACCOUNT_IDENTIFIER", { attempts: 3, failures: 3 }),
  ], now);
  const unknownAccountSignal = evaluateAuthAbuseDecision([
    state("ACCOUNT_IDENTIFIER", { attempts: 3, failures: 3 }),
  ], now);

  assert.deepEqual(existingAccountSignal, unknownAccountSignal);
  assert.deepEqual(Object.keys(existingAccountSignal).sort(), [
    "reasonCode",
    "status",
  ]);
});
