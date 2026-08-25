import assert from "node:assert/strict";
import test from "node:test";

import { createAuthAbuseKeyDeriver } from "../../src/infrastructure/auth/auth-abuse-key";

const secret = Buffer.alloc(32, 0x6b);

test("derives all four constant-length versioned HMAC bucket keys", () => {
  const derive = createAuthAbuseKeyDeriver(secret);
  const keys = derive({
    endpoint: "SIGN_IN",
    canonicalAccountIdentifier: "user@example.com",
    trustedNetwork: "203.0.113.0/24",
  });

  assert.deepEqual(keys.map(({ dimension }) => dimension), [
    "GLOBAL_ENDPOINT",
    "TRUSTED_NETWORK",
    "ACCOUNT_IDENTIFIER",
    "ACCOUNT_AND_TRUSTED_NETWORK",
  ]);
  for (const key of keys) {
    assert.match(key.keyDigest, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(key.endpoint, "SIGN_IN");
  }
});

test("is deterministic and separates endpoints, dimensions, accounts, and networks", () => {
  const derive = createAuthAbuseKeyDeriver(secret);
  const baseline = derive({
    endpoint: "SIGN_IN",
    canonicalAccountIdentifier: "user@example.com",
    trustedNetwork: "203.0.113.0/24",
  });
  assert.deepEqual(derive({
    endpoint: "SIGN_IN",
    canonicalAccountIdentifier: "user@example.com",
    trustedNetwork: "203.0.113.0/24",
  }), baseline);

  const changedEndpoint = derive({
    endpoint: "PASSWORD_RESET_REQUEST",
    canonicalAccountIdentifier: "user@example.com",
    trustedNetwork: "203.0.113.0/24",
  });
  const changedAccount = derive({
    endpoint: "SIGN_IN",
    canonicalAccountIdentifier: "other@example.com",
    trustedNetwork: "203.0.113.0/24",
  });
  const changedNetwork = derive({
    endpoint: "SIGN_IN",
    canonicalAccountIdentifier: "user@example.com",
    trustedNetwork: "203.0.114.0/24",
  });

  assert.notDeepEqual(changedEndpoint, baseline);
  assert.notDeepEqual(changedAccount, baseline);
  assert.notDeepEqual(changedNetwork, baseline);
  assert.equal(new Set(baseline.map(({ keyDigest }) => keyDigest)).size, 4);
});

test("never places raw identifiers or network material in the persisted key shape", () => {
  const rawAccount = "sensitive.person@example.com";
  const rawNetwork = "198.51.100.0/24";
  const serialized = JSON.stringify(createAuthAbuseKeyDeriver(secret)({
    endpoint: "ACTIVATE_ACCOUNT",
    canonicalAccountIdentifier: rawAccount,
    trustedNetwork: rawNetwork,
  }));

  assert.equal(serialized.includes(rawAccount), false);
  assert.equal(serialized.includes(rawNetwork), false);
});

test("emits only dimensions whose canonical inputs are available", () => {
  const derive = createAuthAbuseKeyDeriver(secret);

  assert.deepEqual(
    derive({ endpoint: "PASSWORD_RESET_CONSUME" })
      .map(({ dimension }) => dimension),
    ["GLOBAL_ENDPOINT"],
  );
  assert.deepEqual(
    derive({
      endpoint: "PASSWORD_RESET_CONSUME",
      trustedNetwork: "203.0.113.0/24",
    }).map(({ dimension }) => dimension),
    ["GLOBAL_ENDPOINT", "TRUSTED_NETWORK"],
  );
});

test("rejects short HMAC keys with a generic non-secret-bearing error", () => {
  const raw = "too-short";

  assert.throws(
    () => createAuthAbuseKeyDeriver(Buffer.from(raw)),
    (error: unknown) => error instanceof Error
      && error.message === "Auth abuse digest key configuration is invalid."
      && !error.message.includes(raw),
  );
});
