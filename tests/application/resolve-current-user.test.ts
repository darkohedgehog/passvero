import assert from "node:assert/strict";
import test from "node:test";

import {
  createCurrentUserResolver,
  type AuthenticatedIdentity,
  type AuthIdentityBinding,
  type CurrentUserIdentityReader,
} from "../../src/application/auth/resolve-current-user";

const DAY_MS = 24 * 60 * 60 * 1_000;
const now = new Date("2026-08-24T12:00:00.000Z");

function identity(authenticatedAt: Date): AuthenticatedIdentity {
  return {
    provider: "BETTER_AUTH",
    providerSubject: "provider-user-1",
    providerSessionId: "provider-session-1",
    authenticatedAt,
  };
}

function createHarness(binding: AuthIdentityBinding | null) {
  const calls: unknown[] = [];
  const identityReader: CurrentUserIdentityReader = {
    async findByProviderSubject(input) {
      calls.push(input);
      return binding;
    },
  };
  const resolveCurrentUser = createCurrentUserResolver({
    identityReader,
    now: () => now,
  });

  return { calls, resolveCurrentUser };
}

test("resolves an active provider subject to the canonical current user", async () => {
  const harness = createHarness({
    revokedAt: null,
    currentUser: { userId: "canonical-user-1" },
  });

  const result = await harness.resolveCurrentUser(
    identity(new Date(now.getTime() - 29 * DAY_MS)),
  );

  assert.deepEqual(result, {
    status: "AUTHENTICATED",
    currentUser: { userId: "canonical-user-1" },
    providerSession: {
      provider: "BETTER_AUTH",
      providerSessionId: "provider-session-1",
    },
  });
  assert.deepEqual(harness.calls, [{
    provider: "BETTER_AUTH",
    providerSubject: "provider-user-1",
  }]);
});

test("fails closed before identity lookup when the provider session is absent", async () => {
  const harness = createHarness({
    revokedAt: null,
    currentUser: { userId: "canonical-user-1" },
  });

  assert.deepEqual(await harness.resolveCurrentUser(null), {
    status: "UNAUTHENTICATED",
    reason: "NO_PROVIDER_SESSION",
  });
  assert.deepEqual(harness.calls, []);
});

test("allows a session younger than 30 days and denies it at or beyond 30 days", async () => {
  const harness = createHarness({
    revokedAt: null,
    currentUser: { userId: "canonical-user-1" },
  });

  assert.equal(
    (await harness.resolveCurrentUser(
      identity(new Date(now.getTime() - 30 * DAY_MS + 1)),
    )).status,
    "AUTHENTICATED",
  );

  for (const authenticatedAt of [
    new Date(now.getTime() - 30 * DAY_MS),
    new Date(now.getTime() - 30 * DAY_MS - 1),
  ]) {
    assert.deepEqual(await harness.resolveCurrentUser(identity(authenticatedAt)), {
      status: "UNAUTHENTICATED",
      reason: "SESSION_TOO_OLD",
    });
  }

  assert.equal(harness.calls.length, 1);
});

test("denies a missing provider binding", async () => {
  const harness = createHarness(null);

  assert.deepEqual(
    await harness.resolveCurrentUser(identity(new Date(now.getTime() - DAY_MS))),
    { status: "UNAUTHENTICATED", reason: "IDENTITY_NOT_BOUND" },
  );
});

test("denies a revoked provider binding", async () => {
  const harness = createHarness({
    revokedAt: new Date("2026-08-23T12:00:00.000Z"),
    currentUser: { userId: "canonical-user-1" },
  });

  assert.deepEqual(
    await harness.resolveCurrentUser(identity(new Date(now.getTime() - DAY_MS))),
    { status: "UNAUTHENTICATED", reason: "IDENTITY_REVOKED" },
  );
});

test("denies a binding whose canonical user is missing", async () => {
  const harness = createHarness({ revokedAt: null, currentUser: null });

  assert.deepEqual(
    await harness.resolveCurrentUser(identity(new Date(now.getTime() - DAY_MS))),
    { status: "UNAUTHENTICATED", reason: "CANONICAL_USER_NOT_FOUND" },
  );
});
