import assert from "node:assert/strict";
import test from "node:test";

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { createAuthAbuseService } from "../../src/application/auth/auth-abuse-service";
import { authAbusePolicyByEndpoint, evaluateAuthAbuseDecision } from "../../src/application/auth/auth-abuse-policy";
import type { AuthAbuseBucketKey } from "../../src/application/auth/auth-abuse-types";
import { PrismaClient } from "../../src/generated/prisma/client";
import { canonicalizeAuthAccountIdentifier, normalizeTrustedClientNetwork } from "../../src/infrastructure/auth/auth-abuse-identifiers";
import { createAuthAbuseKeyDeriver } from "../../src/infrastructure/auth/auth-abuse-key";
import { PrismaAuthAbuseRepository } from "../../src/infrastructure/auth/prisma-auth-abuse-repository";

const databaseUrl = requireDisposableDatabaseUrl(
  process.env.STAGE13C5_DISPOSABLE_DATABASE_URL,
);
const admin = new Pool({ connectionString: databaseUrl, max: 4 });
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});
const repository = new PrismaAuthAbuseRepository(prisma);
const policy = authAbusePolicyByEndpoint.SIGN_IN;
const baseNow = new Date("2026-08-25T14:00:00.000Z");

test.before(async () => {
  await admin.query(minimumSchemaSql());
});

test.beforeEach(async () => {
  await admin.query('TRUNCATE TABLE "AuthAbuseBucket"');
});

test.after(async () => {
  await prisma.$disconnect();
  await admin.end();
});

test("preserves every concurrent increment during the first unique-bucket race", async () => {
  const requestCount = 12;
  const key = bucketKey("GLOBAL_ENDPOINT", "A");

  const results = await Promise.allSettled(
    Array.from({ length: requestCount }, () => repository.recordPreAttempt({
      keys: [key],
      policy,
      now: baseNow,
    })),
  );
  assert.equal(results.filter(({ status }) => status === "rejected").length, 0);

  const stored = await prisma.authAbuseBucket.findUniqueOrThrow({
    where: { dimension_endpoint_keyDigest: key },
  });
  assert.equal(stored.attemptCount, requestCount);
  assert.equal(stored.failureCount, 0);
});

test("preserves every concurrent increment for an existing bucket", async () => {
  const requestCount = 16;
  const key = bucketKey("TRUSTED_NETWORK", "B");
  await repository.recordPreAttempt({ keys: [key], policy, now: baseNow });

  const results = await Promise.allSettled(
    Array.from({ length: requestCount }, (_, index) =>
      repository.recordPreAttempt({
        keys: [key],
        policy,
        now: new Date(baseNow.getTime() + index + 1),
      })),
  );
  assert.equal(results.filter(({ status }) => status === "rejected").length, 0);

  const stored = await prisma.authAbuseBucket.findUniqueOrThrow({
    where: { dimension_endpoint_keyDigest: key },
  });
  assert.equal(stored.attemptCount, requestCount + 1);
});

test("rolls back every dimension when one bucket violates the digest constraint", async () => {
  const valid = bucketKey("GLOBAL_ENDPOINT", "C");
  const invalid: AuthAbuseBucketKey = {
    dimension: "ACCOUNT_IDENTIFIER",
    endpoint: "SIGN_IN",
    keyDigest: "invalid",
  };

  await assert.rejects(repository.recordPreAttempt({
    keys: [valid, invalid],
    policy,
    now: baseNow,
  }));
  assert.equal(await prisma.authAbuseBucket.count(), 0);
});

test("keeps an active block authoritative under concurrent attempts", async () => {
  const key = bucketKey("ACCOUNT_IDENTIFIER", "D");
  const blockedUntil = new Date(baseNow.getTime() + 5 * 60_000);
  await prisma.authAbuseBucket.create({
    data: {
      ...key,
      attemptCount: 5,
      failureCount: 5,
      backoffLevel: 3,
      windowStartedAt: baseNow,
      lastAttemptAt: baseNow,
      lastFailureAt: baseNow,
      blockedUntil,
      expiresAt: new Date(baseNow.getTime() + 86_400_000),
    },
  });

  const results = await Promise.all(
    Array.from({ length: 8 }, (_, index) => repository.recordPreAttempt({
      keys: [key],
      policy,
      now: new Date(baseNow.getTime() + index + 1),
    })),
  );
  assert.equal(
    results.every((states) =>
      evaluateAuthAbuseDecision(states, baseNow).status === "BLOCK"),
    true,
  );
  const stored = await prisma.authAbuseBucket.findUniqueOrThrow({
    where: { dimension_endpoint_keyDigest: key },
  });
  assert.equal(stored.attemptCount, 13);
  assert.equal(stored.blockedUntil?.getTime(), blockedUntil.getTime());
});

test("updates global, network, account, and combined buckets atomically under concurrency", async () => {
  const keys = [
    bucketKey("GLOBAL_ENDPOINT", "E"),
    bucketKey("TRUSTED_NETWORK", "F"),
    bucketKey("ACCOUNT_IDENTIFIER", "G"),
    bucketKey("ACCOUNT_AND_TRUSTED_NETWORK", "H"),
  ] as const;
  const requestCount = 6;

  await Promise.all(Array.from({ length: requestCount }, (_, index) =>
    repository.recordPreAttempt({
      keys,
      policy,
      now: new Date(baseNow.getTime() + index),
    })));

  const rows = await prisma.authAbuseBucket.findMany({
    orderBy: { dimension: "asc" },
  });
  assert.equal(rows.length, 4);
  assert.equal(rows.every(({ attemptCount }) => attemptCount === requestCount), true);
  assert.equal(rows.every(({ failureCount, attemptCount }) =>
    failureCount >= 0 && failureCount <= attemptCount), true);
});

test("maps real pre-attempt persistence failure to fail closed", async () => {
  const service = createService();
  await admin.query('ALTER TABLE "AuthAbuseBucket" RENAME TO "AuthAbuseBucketUnavailable"');
  try {
    assert.deepEqual(await service.checkBeforeAttempt({
      endpoint: "SIGN_IN",
      accountIdentifier: "person@example.com",
      trustedClientAddress: "203.0.113.44",
    }), {
      status: "BLOCK",
      reasonCode: "TEMPORARILY_UNAVAILABLE",
      retryAfterSeconds: 1,
    });
  } finally {
    await admin.query('ALTER TABLE "AuthAbuseBucketUnavailable" RENAME TO "AuthAbuseBucket"');
  }
});

test("maps real post-attempt persistence failure to reconciliation without changing auth outcome", async () => {
  const service = createService();
  const input = {
    endpoint: "SIGN_IN" as const,
    accountIdentifier: "person@example.com",
    trustedClientAddress: "203.0.113.44",
  };
  assert.equal((await service.checkBeforeAttempt(input)).status, "ALLOW");

  await admin.query('ALTER TABLE "AuthAbuseBucket" RENAME TO "AuthAbuseBucketUnavailable"');
  try {
    assert.deepEqual(await service.recordOutcome({
      ...input,
      outcome: "SUCCESS",
    }), { status: "OPERATIONAL_RECONCILIATION_REQUIRED" });
  } finally {
    await admin.query('ALTER TABLE "AuthAbuseBucketUnavailable" RENAME TO "AuthAbuseBucket"');
  }
});

test("persists only 43-character base64url digests and no raw account, network, or Turnstile token", async () => {
  const rawAccount = "Sensitive.Person@Example.com";
  const rawAddress = "203.0.113.44";
  const rawTurnstileToken = "sensitive-turnstile-token";
  const network = normalizeTrustedClientNetwork(rawAddress);
  assert.ok(network !== null);
  const keys = createAuthAbuseKeyDeriver(Buffer.alloc(32, 0x51))({
    endpoint: "SIGN_IN",
    canonicalAccountIdentifier: canonicalizeAuthAccountIdentifier(rawAccount),
    trustedNetwork: network.networkKey,
  });

  await repository.recordPreAttempt({ keys, policy, now: baseNow });
  const rows = await admin.query<{
    keyDigest: string;
    serialized: string;
  }>(`
    SELECT
      "keyDigest",
      row_to_json(bucket)::text AS serialized
    FROM "AuthAbuseBucket" AS bucket
  `);
  assert.equal(rows.rows.length, 4);
  for (const row of rows.rows) {
    assert.match(row.keyDigest, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(row.serialized.includes(rawAccount), false);
    assert.equal(row.serialized.includes(rawAddress), false);
    assert.equal(row.serialized.includes(network.networkKey), false);
    assert.equal(row.serialized.includes(rawTurnstileToken), false);
  }
});

function createService() {
  return createAuthAbuseService({
    repository,
    canonicalizeAccountIdentifier: canonicalizeAuthAccountIdentifier,
    normalizeTrustedClientNetwork,
    deriveKeys: createAuthAbuseKeyDeriver(Buffer.alloc(32, 0x52)),
    now: () => baseNow,
  });
}

function bucketKey(
  dimension: AuthAbuseBucketKey["dimension"],
  character: string,
): AuthAbuseBucketKey {
  return {
    dimension,
    endpoint: "SIGN_IN",
    keyDigest: character.repeat(43),
  };
}

function requireDisposableDatabaseUrl(value: string | undefined): string {
  if (value === undefined) {
    throw new Error("Dedicated disposable Stage 13C.5 database URL is required.");
  }
  const parsed = new URL(value);
  if (
    parsed.protocol !== "postgresql:"
    || parsed.hostname !== "127.0.0.1"
    || parsed.username !== "stage13c5"
    || parsed.password !== ""
    || parsed.pathname !== "/stage13c5_abuse"
    || parsed.search !== ""
    || parsed.hash !== ""
  ) {
    throw new Error("Dedicated disposable Stage 13C.5 database URL is invalid.");
  }
  return value;
}

function minimumSchemaSql(): string {
  return `
  DO $$ BEGIN
    CREATE TYPE "AuthAbuseDimension" AS ENUM (
      'TRUSTED_NETWORK',
      'ACCOUNT_IDENTIFIER',
      'ACCOUNT_AND_TRUSTED_NETWORK',
      'GLOBAL_ENDPOINT'
    );
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;
  DO $$ BEGIN
    CREATE TYPE "AuthAbuseEndpoint" AS ENUM (
      'SIGN_IN',
      'ACTIVATE_ACCOUNT',
      'EMAIL_VERIFICATION_REQUEST',
      'EMAIL_VERIFICATION_CONSUME',
      'PASSWORD_RESET_REQUEST',
      'PASSWORD_RESET_CONSUME',
      'PASSWORD_CHANGE'
    );
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;
  CREATE TABLE IF NOT EXISTS "AuthAbuseBucket" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "dimension" "AuthAbuseDimension" NOT NULL,
    "endpoint" "AuthAbuseEndpoint" NOT NULL,
    "keyDigest" VARCHAR(43) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "backoffLevel" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMPTZ NOT NULL,
    "lastAttemptAt" TIMESTAMPTZ NOT NULL,
    "lastFailureAt" TIMESTAMPTZ,
    "blockedUntil" TIMESTAMPTZ,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthAbuseBucket_dimension_endpoint_keyDigest_key"
      UNIQUE ("dimension", "endpoint", "keyDigest"),
    CONSTRAINT "AuthAbuseBucket_keyDigest_check"
      CHECK ("keyDigest" ~ '^[A-Za-z0-9_-]{43}$'),
    CONSTRAINT "AuthAbuseBucket_counts_check"
      CHECK (
        "attemptCount" >= 0
        AND "failureCount" >= 0
        AND "failureCount" <= "attemptCount"
        AND "backoffLevel" >= 0
      ),
    CONSTRAINT "AuthAbuseBucket_time_check"
      CHECK (
        "lastAttemptAt" >= "windowStartedAt"
        AND ("lastFailureAt" IS NULL OR "lastFailureAt" >= "windowStartedAt")
        AND ("blockedUntil" IS NULL OR "blockedUntil" >= "lastAttemptAt")
        AND "expiresAt" > "lastAttemptAt"
      )
  );
`;
}
