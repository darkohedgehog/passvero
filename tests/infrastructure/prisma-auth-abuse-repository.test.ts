import assert from "node:assert/strict";
import test from "node:test";

import type { PrismaClient } from "../../src/generated/prisma/client";
import type { AuthAbuseBucketKey } from "../../src/application/auth/auth-abuse-types";
import { authAbusePolicyByEndpoint } from "../../src/application/auth/auth-abuse-policy";
import { PrismaAuthAbuseRepository } from "../../src/infrastructure/auth/prisma-auth-abuse-repository";

const now = new Date("2026-08-25T12:00:00.000Z");

type BucketRow = {
  dimension: "GLOBAL_ENDPOINT" | "TRUSTED_NETWORK" | "ACCOUNT_IDENTIFIER" | "ACCOUNT_AND_TRUSTED_NETWORK";
  endpoint: "SIGN_IN";
  keyDigest: string;
  attemptCount: number;
  failureCount: number;
  backoffLevel: number;
  windowStartedAt: Date;
  lastAttemptAt: Date;
  lastFailureAt: Date | null;
  blockedUntil: Date | null;
  expiresAt: Date;
};

function createFakePrisma(
  initial: readonly BucketRow[],
  behavior: Readonly<{
    serializationFailures?: number;
    transactionError?: Error;
  }> = {},
) {
  const rows = new Map(initial.map((row) => [row.dimension, { ...row }]));
  const operations: string[] = [];
  let transactionOptions: unknown;
  let transactionCount = 0;
  const model = {
    async upsert(input: {
      create: BucketRow;
      where: { dimension_endpoint_keyDigest: { dimension: BucketRow["dimension"] } };
    }) {
      const dimension = input.where.dimension_endpoint_keyDigest.dimension;
      operations.push(`upsert:${dimension}`);
      const current = rows.get(dimension) ?? { ...input.create };
      rows.set(dimension, current);
      return { ...current };
    },
    async update(input: {
      where: { dimension_endpoint_keyDigest: { dimension: BucketRow["dimension"] } };
      data: Omit<Partial<BucketRow>, "attemptCount"> & {
        attemptCount?: number | { increment: number };
      };
    }) {
      const dimension = input.where.dimension_endpoint_keyDigest.dimension;
      operations.push(`update:${dimension}`);
      const current = rows.get(dimension);
      assert.ok(current);
      const { attemptCount: attemptUpdate, ...otherData } = input.data;
      const attemptCount = typeof attemptUpdate === "object"
        ? current.attemptCount + attemptUpdate.increment
        : attemptUpdate;
      const updated: BucketRow = {
        ...current,
        ...otherData,
        ...(attemptCount === undefined ? {} : { attemptCount }),
      };
      rows.set(dimension, updated);
      return { ...updated };
    },
  };
  const prisma = {
    async $transaction(
      callback: (transaction: { authAbuseBucket: typeof model }) => Promise<unknown>,
      transactionOptionsInput: unknown,
    ) {
      transactionCount += 1;
      transactionOptions = transactionOptionsInput;
      if (transactionCount <= (behavior.serializationFailures ?? 0)) {
        throw Object.assign(new Error("serialization conflict"), {
          code: "P2034",
        });
      }
      if (behavior.transactionError !== undefined) {
        throw behavior.transactionError;
      }
      return callback({ authAbuseBucket: model });
    },
  } as unknown as PrismaClient;
  return {
    prisma,
    rows,
    operations,
    transactionCount: () => transactionCount,
    transactionOptions: () => transactionOptions,
  };
}

function row(
  dimension: BucketRow["dimension"],
  overrides: Partial<BucketRow> = {},
): BucketRow {
  return {
    dimension,
    endpoint: "SIGN_IN",
    keyDigest: dimension.slice(0, 1).repeat(43),
    attemptCount: 0,
    failureCount: 0,
    backoffLevel: 0,
    windowStartedAt: new Date(now.getTime() - 1_000),
    lastAttemptAt: new Date(now.getTime() - 1_000),
    lastFailureAt: null,
    blockedUntil: null,
    expiresAt: new Date(now.getTime() + 1_000),
    ...overrides,
  };
}

function key(value: BucketRow): AuthAbuseBucketKey {
  return {
    dimension: value.dimension,
    endpoint: value.endpoint,
    keyDigest: value.keyDigest,
  };
}

test("records all pre-attempt dimensions in one Serializable business transaction and fixed lock order", async () => {
  const values = [
    row("ACCOUNT_IDENTIFIER"),
    row("GLOBAL_ENDPOINT"),
    row("TRUSTED_NETWORK"),
    row("ACCOUNT_AND_TRUSTED_NETWORK"),
  ];
  const fake = createFakePrisma(values);
  const repository = new PrismaAuthAbuseRepository(fake.prisma);

  const states = await repository.recordPreAttempt({
    keys: values.map(key),
    policy: authAbusePolicyByEndpoint.SIGN_IN,
    now,
  });

  assert.deepEqual(fake.transactionOptions(), { isolationLevel: "Serializable" });
  assert.deepEqual(fake.operations.filter((operation) => operation.startsWith("upsert")), [
    "upsert:GLOBAL_ENDPOINT",
    "upsert:TRUSTED_NETWORK",
    "upsert:ACCOUNT_IDENTIFIER",
    "upsert:ACCOUNT_AND_TRUSTED_NETWORK",
  ]);
  assert.deepEqual(states.map(({ attemptCount }) => attemptCount), [1, 1, 1, 1]);
  assert.equal("authProviderUser" in fake.prisma, false);
});

test("resets expired counting windows without clearing progressive evidence", async () => {
  const value = row("ACCOUNT_IDENTIFIER", {
    attemptCount: 8,
    failureCount: 4,
    backoffLevel: 3,
    windowStartedAt: new Date(now.getTime() - 16 * 60_000),
    lastFailureAt: new Date(now.getTime() - 2 * 60_000),
  });
  const fake = createFakePrisma([value]);
  const repository = new PrismaAuthAbuseRepository(fake.prisma);

  const [state] = await repository.recordPreAttempt({
    keys: [key(value)],
    policy: authAbusePolicyByEndpoint.SIGN_IN,
    now,
  });

  assert.equal(state?.attemptCount, 1);
  assert.equal(state?.failureCount, 0);
  assert.equal(state?.backoffLevel, 3);
  assert.equal(fake.rows.get("ACCOUNT_IDENTIFIER")?.windowStartedAt.getTime(), now.getTime());
});

test("never moves persisted attempt time backward when concurrent requests complete out of order", async () => {
  const laterAttempt = new Date(now.getTime() + 2_000);
  const value = row("GLOBAL_ENDPOINT", {
    attemptCount: 1,
    windowStartedAt: laterAttempt,
    lastAttemptAt: laterAttempt,
    expiresAt: new Date(laterAttempt.getTime() + 60_000),
  });
  const fake = createFakePrisma([value]);
  const repository = new PrismaAuthAbuseRepository(fake.prisma);

  await repository.recordPreAttempt({
    keys: [key(value)],
    policy: authAbusePolicyByEndpoint.SIGN_IN,
    now: new Date(now.getTime() + 1_000),
  });

  assert.equal(
    fake.rows.get("GLOBAL_ENDPOINT")?.lastAttemptAt.getTime(),
    laterAttempt.getTime(),
  );
});

test("persists the global attempt threshold block before credential verification", async () => {
  const value = row("GLOBAL_ENDPOINT", {
    attemptCount: 99,
    lastAttemptAt: new Date(now.getTime() - 500),
  });
  const fake = createFakePrisma([value]);
  const repository = new PrismaAuthAbuseRepository(fake.prisma);

  const [state] = await repository.recordPreAttempt({
    keys: [key(value)],
    policy: authAbusePolicyByEndpoint.SIGN_IN,
    now,
  });

  assert.equal(state?.attemptCount, 100);
  assert.equal(state?.backoffLevel, 1);
  assert.equal(state?.blockedUntil?.getTime(), now.getTime() + 60_000);
});

test("raises bounded progressive backoff atomically when a failure reaches threshold", async () => {
  const value = row("ACCOUNT_IDENTIFIER", {
    attemptCount: 5,
    failureCount: 4,
  });
  const fake = createFakePrisma([value]);
  const repository = new PrismaAuthAbuseRepository(fake.prisma);

  await repository.recordOutcome({
    keys: [key(value)],
    policy: authAbusePolicyByEndpoint.SIGN_IN,
    outcome: "FAILURE",
    now,
  });

  const updated = fake.rows.get("ACCOUNT_IDENTIFIER");
  assert.equal(updated?.failureCount, 5);
  assert.equal(updated?.backoffLevel, 1);
  assert.equal(updated?.blockedUntil?.getTime(), now.getTime() + 60_000);
  assert.deepEqual(fake.transactionOptions(), { isolationLevel: "Serializable" });
});

test("decays one backoff level per quiet day before the next escalation", async () => {
  const value = row("ACCOUNT_IDENTIFIER", {
    attemptCount: 9,
    failureCount: 5,
    backoffLevel: 5,
    lastFailureAt: new Date(now.getTime() - 2 * 86_400_000),
  });
  const fake = createFakePrisma([value]);
  const repository = new PrismaAuthAbuseRepository(fake.prisma);

  await repository.recordOutcome({
    keys: [key(value)],
    policy: authAbusePolicyByEndpoint.SIGN_IN,
    outcome: "FAILURE",
    now,
  });

  const updated = fake.rows.get("ACCOUNT_IDENTIFIER");
  assert.equal(updated?.backoffLevel, 4);
  assert.equal(updated?.blockedUntil?.getTime(), now.getTime() + 8 * 60_000);
});

test("successful outcomes preserve failure and backoff evidence", async () => {
  const value = row("ACCOUNT_IDENTIFIER", {
    attemptCount: 4,
    failureCount: 3,
    backoffLevel: 2,
  });
  const fake = createFakePrisma([value]);
  const repository = new PrismaAuthAbuseRepository(fake.prisma);

  await repository.recordOutcome({
    keys: [key(value)],
    policy: authAbusePolicyByEndpoint.SIGN_IN,
    outcome: "SUCCESS",
    now,
  });

  const updated = fake.rows.get("ACCOUNT_IDENTIFIER");
  assert.equal(updated?.failureCount, 3);
  assert.equal(updated?.backoffLevel, 2);
});

test("rejects a post-attempt outcome when no persisted pre-attempt bucket exists", async () => {
  const value = row("ACCOUNT_IDENTIFIER");
  const fake = createFakePrisma([]);
  const repository = new PrismaAuthAbuseRepository(fake.prisma);

  await assert.rejects(repository.recordOutcome({
    keys: [key(value)],
    policy: authAbusePolicyByEndpoint.SIGN_IN,
    outcome: "FAILURE",
    now,
  }));
  assert.equal(fake.rows.size, 0);
});

test("retries only serialization conflicts and then preserves the increment", async () => {
  const value = row("GLOBAL_ENDPOINT");
  const fake = createFakePrisma([value], { serializationFailures: 2 });
  const repository = new PrismaAuthAbuseRepository(fake.prisma);

  await repository.recordPreAttempt({
    keys: [key(value)],
    policy: authAbusePolicyByEndpoint.SIGN_IN,
    now,
  });

  assert.equal(fake.transactionCount(), 3);
  assert.equal(fake.rows.get("GLOBAL_ENDPOINT")?.attemptCount, 1);
});

test("stops after the fixed serialization attempt bound", async () => {
  const value = row("GLOBAL_ENDPOINT");
  const fake = createFakePrisma([value], { serializationFailures: 20 });
  const repository = new PrismaAuthAbuseRepository(fake.prisma);

  await assert.rejects(repository.recordPreAttempt({
    keys: [key(value)],
    policy: authAbusePolicyByEndpoint.SIGN_IN,
    now,
  }));
  assert.equal(fake.transactionCount(), 10);
});

test("does not retry a non-serialization persistence error", async () => {
  const value = row("GLOBAL_ENDPOINT");
  const fake = createFakePrisma([value], {
    transactionError: new Error("not retryable"),
  });
  const repository = new PrismaAuthAbuseRepository(fake.prisma);

  await assert.rejects(repository.recordPreAttempt({
    keys: [key(value)],
    policy: authAbusePolicyByEndpoint.SIGN_IN,
    now,
  }));
  assert.equal(fake.transactionCount(), 1);
});
