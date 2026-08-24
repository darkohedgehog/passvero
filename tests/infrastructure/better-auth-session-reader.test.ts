import assert from "node:assert/strict";
import test from "node:test";

import { createBetterAuthSessionReader } from "../../src/infrastructure/auth/better-auth-session-reader";

const headers = new Headers({ cookie: "better-auth.session_token=opaque" });
const rawToken = "raw-provider-session-token";

function providerSession(email = "before@example.test") {
  return {
    session: {
      id: "provider-session-1",
      createdAt: new Date("2026-08-01T12:00:00.000Z"),
      updatedAt: new Date("2026-08-02T12:00:00.000Z"),
      userId: "provider-user-1",
      expiresAt: new Date("2026-08-31T12:00:00.000Z"),
      token: rawToken,
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
    },
    user: {
      id: "provider-user-1",
      createdAt: new Date("2026-07-01T12:00:00.000Z"),
      updatedAt: new Date("2026-08-01T12:00:00.000Z"),
      email,
      emailVerified: true,
      name: "Provider User",
      image: null,
    },
  };
}

test("maps the authoritative provider session to the minimal neutral identity", async () => {
  const calls: unknown[] = [];
  const reader = createBetterAuthSessionReader(async (input) => {
    calls.push(input);
    return providerSession();
  });

  const result = await reader.read(headers);

  assert.deepEqual(result, {
    provider: "BETTER_AUTH",
    providerSubject: "provider-user-1",
    providerSessionId: "provider-session-1",
    authenticatedAt: new Date("2026-08-01T12:00:00.000Z"),
  });
  assert.deepEqual(calls, [{
    headers,
    query: { disableCookieCache: true, disableRefresh: true },
  }]);
  assert.equal(result !== null && "token" in result, false);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(rawToken));
});

test("returns no identity when Better Auth has no current session", async () => {
  const reader = createBetterAuthSessionReader(async () => null);

  assert.equal(await reader.read(headers), null);
});

test("binds only by stable provider subject when provider email changes", async () => {
  const before = createBetterAuthSessionReader(async () =>
    providerSession("before@example.test")
  );
  const after = createBetterAuthSessionReader(async () =>
    providerSession("after@example.test")
  );

  assert.deepEqual(await before.read(headers), await after.read(headers));
});

test("fails closed when provider user and session subjects disagree", async () => {
  const mismatch = providerSession();
  mismatch.session.userId = "different-provider-user";
  const reader = createBetterAuthSessionReader(async () => mismatch);

  assert.equal(await reader.read(headers), null);
});
