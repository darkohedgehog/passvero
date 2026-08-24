import assert from "node:assert/strict";
import test from "node:test";

import { PrismaAuthIdentityReader } from "../../src/infrastructure/auth/prisma-auth-identity-reader";

function createHarness(input: {
  readonly identity: { readonly userId: string; readonly revokedAt: Date | null } | null;
  readonly user: { readonly id: string } | null;
}) {
  const calls: unknown[] = [];
  const reader = new PrismaAuthIdentityReader({
    authIdentity: {
      async findUnique(query) {
        calls.push(["authIdentity", query]);
        return input.identity;
      },
    },
    user: {
      async findUnique(query) {
        calls.push(["user", query]);
        return input.user;
      },
    },
  });

  return { calls, reader };
}

const lookup = {
  provider: "BETTER_AUTH" as const,
  providerSubject: "provider-user-1",
};

test("resolves the exact provider subject and canonical user without email lookup", async () => {
  const harness = createHarness({
    identity: { userId: "canonical-user-1", revokedAt: null },
    user: { id: "canonical-user-1" },
  });

  assert.deepEqual(await harness.reader.findByProviderSubject(lookup), {
    revokedAt: null,
    currentUser: { userId: "canonical-user-1" },
  });
  assert.deepEqual(harness.calls, [
    ["authIdentity", {
      where: {
        provider_providerSubject: {
          provider: "BETTER_AUTH",
          providerSubject: "provider-user-1",
        },
      },
      select: { userId: true, revokedAt: true },
    }],
    ["user", {
      where: { id: "canonical-user-1" },
      select: { id: true },
    }],
  ]);
});

test("returns no binding and skips canonical lookup when AuthIdentity is missing", async () => {
  const harness = createHarness({
    identity: null,
    user: { id: "canonical-user-1" },
  });

  assert.equal(await harness.reader.findByProviderSubject(lookup), null);
  assert.equal(harness.calls.length, 1);
});

test("preserves revocation and skips canonical lookup for a revoked identity", async () => {
  const revokedAt = new Date("2026-08-23T12:00:00.000Z");
  const harness = createHarness({
    identity: { userId: "canonical-user-1", revokedAt },
    user: { id: "canonical-user-1" },
  });

  assert.deepEqual(await harness.reader.findByProviderSubject(lookup), {
    revokedAt,
    currentUser: null,
  });
  assert.equal(harness.calls.length, 1);
});

test("returns an explicit missing canonical user binding", async () => {
  const harness = createHarness({
    identity: { userId: "canonical-user-1", revokedAt: null },
    user: null,
  });

  assert.deepEqual(await harness.reader.findByProviderSubject(lookup), {
    revokedAt: null,
    currentUser: null,
  });
  assert.equal(harness.calls.length, 2);
});
