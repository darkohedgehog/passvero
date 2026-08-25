import assert from "node:assert/strict";
import test from "node:test";

import type { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaControlledActivationRepository } from "../../src/infrastructure/auth/prisma-controlled-activation";

test("claims only the expected activation state with a bounded lease", async () => {
  const calls: unknown[] = [];
  const prisma = {
    accountActivationIntent: {
      async updateMany(input: unknown) {
        calls.push(input);
        return { count: 1 };
      },
    },
  } as unknown as PrismaClient;
  const repository = new PrismaControlledActivationRepository(prisma);
  const claimedAt = new Date("2026-08-25T10:00:00.000Z");
  const claimExpiresAt = new Date("2026-08-25T10:05:00.000Z");

  assert.equal(await repository.claim({
    intentId: "intent-1",
    claimId: "claim-1",
    claimedAt,
    claimExpiresAt,
    expectedClaimId: null,
  }), true);
  assert.deepEqual(calls, [{
    where: { id: "intent-1", status: "ISSUED", claimId: null },
    data: {
      status: "IN_PROGRESS",
      claimId: "claim-1",
      claimedAt,
      claimExpiresAt,
    },
  }]);
});

test("captures provider subject and clears claim fields required by the frozen CHECK", async () => {
  const updates: unknown[] = [];
  const prisma = {
    accountActivationIntent: {
      async findUnique() {
        return {
          status: "IN_PROGRESS",
          claimId: "claim-1",
          providerSubject: null,
        };
      },
      async updateMany(input: unknown) {
        updates.push(input);
        return { count: 1 };
      },
    },
  } as unknown as PrismaClient;
  const repository = new PrismaControlledActivationRepository(prisma);
  const capturedAt = new Date("2026-08-25T10:01:00.000Z");

  assert.equal(await repository.captureProviderSubject({
    intentId: "intent-1",
    claimId: "claim-1",
    providerSubject: "provider-1",
    capturedAt,
  }), "CAPTURED");
  assert.deepEqual(updates, [{
    where: {
      id: "intent-1",
      status: "IN_PROGRESS",
      claimId: "claim-1",
      providerSubject: null,
    },
    data: {
      status: "AUTH_ACCOUNT_CREATED",
      providerSubject: "provider-1",
      authAccountCreatedAt: capturedAt,
      claimId: null,
      claimedAt: null,
      claimExpiresAt: null,
    },
  }]);
});

test("treats only the same captured subject as idempotent", async () => {
  for (const [providerSubject, expected] of [
    ["provider-1", "ALREADY_CAPTURED"],
    ["provider-2", "CONFLICT"],
  ] as const) {
    const prisma = {
      accountActivationIntent: {
        async findUnique() {
          return {
            status: "AUTH_ACCOUNT_CREATED",
            claimId: null,
            providerSubject: "provider-1",
          };
        },
      },
    } as unknown as PrismaClient;
    const repository = new PrismaControlledActivationRepository(prisma);

    assert.equal(await repository.captureProviderSubject({
      intentId: "intent-1",
      claimId: "claim-1",
      providerSubject,
      capturedAt: new Date(),
    }), expected);
  }
});

test("marks a claimed intent terminally conflicted and clears the bounded claim", async () => {
  const updates: unknown[] = [];
  const prisma = {
    accountActivationIntent: {
      async updateMany(input: unknown) {
        updates.push(input);
        return { count: 1 };
      },
    },
  } as unknown as PrismaClient;
  const repository = new PrismaControlledActivationRepository(prisma);
  const conflictAt = new Date("2026-08-25T10:02:00.000Z");

  assert.equal(await repository.markConflict({
    intentId: "intent-1",
    claimId: "claim-1",
    conflictAt,
  }), true);
  assert.deepEqual(updates, [{
    where: {
      id: "intent-1",
      status: "IN_PROGRESS",
      claimId: "claim-1",
    },
    data: {
      status: "CONFLICT",
      conflictAt,
      claimId: null,
      claimedAt: null,
      claimExpiresAt: null,
    },
  }]);
});
