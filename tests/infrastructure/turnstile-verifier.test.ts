import assert from "node:assert/strict";
import test from "node:test";

import { createTurnstileVerifierAdapter } from "../../src/infrastructure/auth/turnstile-verifier";

test("maps a mocked provider response to the provider-neutral contract", async () => {
  const calls: unknown[] = [];
  const verifier = createTurnstileVerifierAdapter({
    async verifyProvider(input) {
      calls.push(input);
      return { success: true, action: "auth_sign_in", extra: "private" };
    },
  });

  assert.deepEqual(await verifier.verify({
    token: "opaque-token",
    expectedAction: "auth_sign_in",
    trustedClientAddress: "203.0.113.44",
  }), { valid: true, action: "auth_sign_in" });
  assert.deepEqual(calls, [{
    token: "opaque-token",
    expectedAction: "auth_sign_in",
    trustedClientAddress: "203.0.113.44",
  }]);
});

test("fails closed on malformed mocked provider responses", async () => {
  for (const response of [null, {}, { success: "true" }, { success: true }]) {
    const verifier = createTurnstileVerifierAdapter({
      async verifyProvider() { return response; },
    });
    assert.deepEqual(await verifier.verify({
      token: "opaque-token",
      expectedAction: "auth_sign_in",
    }), { valid: false });
  }
});

test("rethrows only a generic operational error without token or provider detail", async () => {
  const token = "sensitive-turnstile-token";
  const verifier = createTurnstileVerifierAdapter({
    async verifyProvider() { throw new Error(`provider failed for ${token}`); },
  });

  await assert.rejects(
    verifier.verify({ token, expectedAction: "auth_sign_in" }),
    (error: unknown) => error instanceof Error
      && error.message === "Turnstile verification is unavailable."
      && !error.message.includes(token),
  );
});
