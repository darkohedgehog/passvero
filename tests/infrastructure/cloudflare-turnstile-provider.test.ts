import assert from "node:assert/strict";
import test from "node:test";

import { createLazyCloudflareTurnstileVerifier } from "../../src/infrastructure/auth/cloudflare-turnstile-provider";

test("lazily verifies a risk-triggered token against the fixed provider endpoint", async () => {
  let secretReads = 0;
  const requests: Array<Readonly<{
    url: string;
    init?: RequestInit;
  }>> = [];
  const verifier = createLazyCloudflareTurnstileVerifier({
    readSecretKey() {
      secretReads += 1;
      return "test_secret_key_0123456789abcdef";
    },
    async request(input, init) {
      requests.push({ url: input.toString(), init });
      return {
        ok: true,
        async json() {
          return { success: true, action: "auth_sign_in" };
        },
      };
    },
  });

  assert.equal(secretReads, 0);
  assert.equal(requests.length, 0);
  assert.deepEqual(await verifier.verify({
    token: "opaque-client-token",
    expectedAction: "auth_sign_in",
    trustedClientAddress: "203.0.113.44",
  }), { valid: true, action: "auth_sign_in" });
  assert.equal(secretReads, 1);
  assert.equal(requests.length, 1);
  assert.equal(
    requests[0]?.url,
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
  );
  assert.equal(requests[0]?.init?.method, "POST");
  const body = new URLSearchParams(String(requests[0]?.init?.body));
  assert.equal(body.get("secret"), "test_secret_key_0123456789abcdef");
  assert.equal(body.get("response"), "opaque-client-token");
  assert.equal(body.get("remoteip"), "203.0.113.44");
  assert.equal(body.has("action"), false);
});

test("fails closed before provider access for an invalid secret", async () => {
  let requests = 0;
  const verifier = createLazyCloudflareTurnstileVerifier({
    readSecretKey() {
      return "invalid secret";
    },
    async request() {
      requests += 1;
      throw new Error("request must not be reached");
    },
  });

  await assert.rejects(
    verifier.verify({
      token: "opaque-client-token",
      expectedAction: "auth_sign_in",
    }),
    (error: unknown) => error instanceof Error
      && error.message === "Turnstile verification is unavailable."
      && !error.message.includes("invalid secret"),
  );
  assert.equal(requests, 0);
});
