import assert from "node:assert/strict";
import test from "node:test";

import {
  completeRiskTriggeredTurnstile,
  type TurnstileVerifier,
} from "../../src/application/auth/turnstile";

function verifier(result: Awaited<ReturnType<TurnstileVerifier["verify"]>>) {
  let calls = 0;
  return {
    verifier: {
      async verify() {
        calls += 1;
        return result;
      },
    } satisfies TurnstileVerifier,
    calls: () => calls,
  };
}

test("does not invoke the verifier when the challenge is not required", async () => {
  const fake = verifier({ valid: true, action: "auth_sign_in" });
  assert.deepEqual(await completeRiskTriggeredTurnstile({
    decision: { status: "ALLOW" },
    endpoint: "SIGN_IN",
    verifier: fake.verifier,
  }), { status: "PROCEED" });
  assert.equal(fake.calls(), 0);
});

test("does not invoke the verifier for an abuse block", async () => {
  const fake = verifier({ valid: true, action: "auth_sign_in" });
  assert.equal((await completeRiskTriggeredTurnstile({
    decision: {
      status: "BLOCK",
      reasonCode: "TEMPORARILY_UNAVAILABLE",
      retryAfterSeconds: 60,
    },
    endpoint: "SIGN_IN",
    verifier: fake.verifier,
  })).status, "DENIED");
  assert.equal(fake.calls(), 0);
});

test("denies a required challenge when the token is missing", async () => {
  const fake = verifier({ valid: true, action: "auth_sign_in" });
  assert.equal((await completeRiskTriggeredTurnstile({
    decision: {
      status: "REQUIRE_TURNSTILE",
      reasonCode: "ADDITIONAL_VERIFICATION_REQUIRED",
    },
    endpoint: "SIGN_IN",
    verifier: fake.verifier,
  })).status, "DENIED");
  assert.equal(fake.calls(), 0);
});

test("denies invalid tokens", async () => {
  const fake = verifier({ valid: false });
  assert.equal((await completeRiskTriggeredTurnstile({
    decision: {
      status: "REQUIRE_TURNSTILE",
      reasonCode: "ADDITIONAL_VERIFICATION_REQUIRED",
    },
    endpoint: "SIGN_IN",
    token: "opaque-token",
    verifier: fake.verifier,
  })).status, "DENIED");
});

test("fails closed on verifier operational failure", async () => {
  const broken: TurnstileVerifier = {
    async verify() { throw new Error("provider detail"); },
  };
  assert.deepEqual(await completeRiskTriggeredTurnstile({
    decision: {
      status: "REQUIRE_TURNSTILE",
      reasonCode: "ADDITIONAL_VERIFICATION_REQUIRED",
    },
    endpoint: "SIGN_IN",
    token: "opaque-token",
    verifier: broken,
  }), { status: "OPERATIONAL_FAILURE" });
});

test("allows a valid token for the exact expected endpoint action", async () => {
  const fake = verifier({ valid: true, action: "auth_sign_in" });
  assert.deepEqual(await completeRiskTriggeredTurnstile({
    decision: {
      status: "REQUIRE_TURNSTILE",
      reasonCode: "ADDITIONAL_VERIFICATION_REQUIRED",
    },
    endpoint: "SIGN_IN",
    token: "opaque-token",
    trustedClientAddress: "203.0.113.44",
    verifier: fake.verifier,
  }), { status: "PROCEED" });
});

test("denies an action mismatch and never returns the raw token", async () => {
  const token = "highly-sensitive-turnstile-token";
  const fake = verifier({ valid: true, action: "auth_password_reset_request" });
  const result = await completeRiskTriggeredTurnstile({
    decision: {
      status: "REQUIRE_TURNSTILE",
      reasonCode: "ADDITIONAL_VERIFICATION_REQUIRED",
    },
    endpoint: "SIGN_IN",
    token,
    verifier: fake.verifier,
  });

  assert.deepEqual(result, { status: "DENIED" });
  assert.equal(JSON.stringify(result).includes(token), false);
});
