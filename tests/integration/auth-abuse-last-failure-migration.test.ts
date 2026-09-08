import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaAuthAbuseRepository } from "../../src/infrastructure/auth/prisma-auth-abuse-repository";
import { authAbusePolicyByEndpoint, evaluateAuthAbuseDecision } from "../../src/application/auth/auth-abuse-policy";
import { createAuthAbuseService } from "../../src/application/auth/auth-abuse-service";
import type { AuthAbuseBucketKey } from "../../src/application/auth/auth-abuse-types";

const rawUrl = process.env.AUTH_ABUSE_CONSTRAINT_DISPOSABLE_URL;
assert.ok(rawUrl, "Fresh disposable database URL required; no runtime fallback");
const url = new URL(rawUrl);
assert.equal(url.protocol, "postgresql:");
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.username, "proof");
assert.equal(url.password, "");
assert.equal(url.pathname, "/postgres");
assert.equal(url.search, "");
assert.equal(url.hash, "");
assert.ok(!["", "5432", "5433"].includes(url.port));
const directory = process.env.AUTH_ABUSE_CONSTRAINT_DISPOSABLE_DIRECTORY;
assert.match(directory ?? "", /^\/private\/tmp\/passvero-constraint-proof\.[A-Za-z0-9]+\/data$/);
const phase = process.env.AUTH_ABUSE_CONSTRAINT_PROOF_PHASE;
assert.ok(phase === "before" || phase === "after");
const pool = new Pool({ connectionString: rawUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: rawUrl }) });
const repository = new PrismaAuthAbuseRepository(prisma);
const policy = authAbusePolicyByEndpoint.SIGN_IN;
const base = Date.parse("2026-09-08T10:00:00Z");
const at = (offset: number) => new Date(base + offset);
const key: AuthAbuseBucketKey = { dimension: "GLOBAL_ENDPOINT", endpoint: "SIGN_IN", keyDigest: "R".repeat(43) };
const get = () => prisma.authAbuseBucket.findUniqueOrThrow({ where: { dimension_endpoint_keyDigest: key } });
const attempt = (offset: number, keys: readonly AuthAbuseBucketKey[] = [key]) => repository.recordPreAttempt({ keys, policy, now: at(offset) });
const outcome = (offset: number, result: "SUCCESS" | "FAILURE") => repository.recordOutcome({ keys: [key], policy, now: at(offset), outcome: result });
function service(offset: number) {
  return createAuthAbuseService({ repository, canonicalizeAccountIdentifier: (v) => v,
    normalizeTrustedClientNetwork: () => null, deriveKeys: () => [key], now: () => at(offset) });
}
async function seed(options: { failure?: boolean; block?: number } = {}) {
  return prisma.authAbuseBucket.create({ data: { ...key, attemptCount: 2,
    failureCount: options.failure === false ? 0 : 1, backoffLevel: 3,
    windowStartedAt: at(0), lastAttemptAt: at(1_000),
    lastFailureAt: options.failure === false ? null : at(500),
    blockedUntil: options.block === undefined ? null : at(options.block), expiresAt: at(86_400_000) } });
}
function constraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "cause" in error
    && typeof error.cause === "object" && error.cause !== null
    && "originalCode" in error.cause && error.cause.originalCode === "23514";
}
test.before(async () => {
  const identity = await pool.query("SELECT current_setting('data_directory') AS directory");
  assert.equal(identity.rows[0].directory, directory);
  const history = await pool.query('SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"');
  assert.equal(history.rows.length, phase === "before" ? 18 : 19);
  assert.ok(history.rows.every((r) => r.finished_at !== null && r.rolled_back_at === null));
  if (phase === "after") {
    assert.equal(history.rows.filter((r) => r.migration_name === "20260908210000_correct_auth_abuse_last_failure_constraint").length, 1);
    // The pre-migration row survives migration byte-for-byte (including created/updated times).
    const preserved = await pool.query('SELECT row_to_json(b)::text AS row FROM "AuthAbuseBucket" b');
    assert.equal(preserved.rows[0].row, process.env.AUTH_ABUSE_CONSTRAINT_PRESERVED_ROW);
  }
});
test.after(async () => { await prisma.$disconnect(); await pool.end(); });

if (phase === "before") {
  test("old CHECK rejects legitimate rollover with 23514 and preserves committed row", async () => {
    const original = await seed();
    await assert.rejects(attempt(60_000), constraintError);
    assert.deepEqual(await get(), original);
    assert.deepEqual(await service(60_000).checkBeforeAttempt({ endpoint: "SIGN_IN" }), {
      status: "BLOCK", reasonCode: "TEMPORARILY_UNAVAILABLE", retryAfterSeconds: 1,
    });
    assert.deepEqual(await get(), original);
  });
} else {
  test.beforeEach(async () => { await pool.query('TRUNCATE "AuthAbuseBucket"'); });
  for (const offset of [59_999, 60_000, 60_001]) {
    for (const failure of [false, true]) {
      test(`boundary ${offset}, historical failure ${failure}`, async () => {
        const original = await seed({ failure });
        const states = await attempt(offset);
        const row = await get();
        assert.equal(+row.windowStartedAt, offset < 60_000 ? base : base + offset);
        assert.equal(row.attemptCount, offset < 60_000 ? 3 : 1);
        assert.equal(row.failureCount, offset < 60_000 && failure ? 1 : 0);
        assert.deepEqual(row.lastFailureAt, original.lastFailureAt);
        assert.equal(+row.lastAttemptAt, base + offset);
        assert.equal(evaluateAuthAbuseDecision(states, at(offset)).status, "ALLOW");
      });
    }
  }
  test("same-time and repeated windows preserve failure history; success remains admitted", async () => {
    const original = await seed();
    for (const offset of [60_000, 60_000, 120_000, 180_000]) {
      assert.deepEqual(await service(offset).checkBeforeAttempt({ endpoint: "SIGN_IN" }), { status: "ALLOW" });
      assert.deepEqual(await service(offset).recordOutcome({ endpoint: "SIGN_IN", outcome: "SUCCESS" }), { status: "RECORDED" });
      assert.deepEqual((await get()).lastFailureAt, original.lastFailureAt);
    }
    assert.equal((await get()).backoffLevel, original.backoffLevel);
  });
  test("first real failure advances historical time and counts consistently", async () => {
    await seed(); await attempt(60_000); await outcome(60_100, "FAILURE");
    const row = await get();
    assert.equal(row.attemptCount, 1); assert.equal(row.failureCount, 1);
    assert.equal(+row.lastFailureAt!, base + 60_100);
    assert.equal(+row.lastAttemptAt, base + 60_100);
    assert.equal(row.backoffLevel, 3);
  });
  for (const block of [50_000, 120_000]) {
    test(`block ending at ${block} obeys existing policy across rollover`, async () => {
      const original = await seed({ block });
      const states = await attempt(60_000);
      const row = await get();
      assert.deepEqual(row.lastFailureAt, original.lastFailureAt);
      assert.equal(row.backoffLevel, original.backoffLevel);
      assert.equal(row.blockedUntil?.getTime() ?? null, block > 60_000 ? base + block : null);
      assert.equal(evaluateAuthAbuseDecision(states, at(60_000)).status, block > 60_000 ? "BLOCK" : "ALLOW");
    });
  }
  test("concurrent rollovers serialize counters, retain active penalty and cannot regress time", async () => {
    const original = await seed({ block: 120_000 });
    await Promise.all([60_004, 60_000, 60_002, 60_001, 60_003, 60_004].map((n) => attempt(n)));
    const row = await get();
    assert.equal(row.attemptCount, 6); assert.equal(row.failureCount, 0);
    assert.equal(+row.lastAttemptAt, base + 60_004);
    assert.deepEqual(row.lastFailureAt, original.lastFailureAt);
    assert.deepEqual(row.blockedUntil, original.blockedUntil);
    assert.equal(row.backoffLevel, original.backoffLevel);
  });
  test("later-dimension failure rolls back rollover and safe operational failure remains", async () => {
    const original = await seed();
    await assert.rejects(attempt(60_000, [key, { ...key, dimension: "ACCOUNT_IDENTIFIER", keyDigest: "invalid" }]));
    assert.deepEqual(await get(), original);
    const broken = createAuthAbuseService({ repository, canonicalizeAccountIdentifier: (v) => v,
      normalizeTrustedClientNetwork: () => null, deriveKeys: () => [{ ...key, keyDigest: "invalid" }], now: () => at(60_000) });
    assert.equal((await broken.checkBeforeAttempt({ endpoint: "SIGN_IN" })).status, "BLOCK");
    assert.deepEqual(await get(), original);
  });
  const invalidUpdates = [
    '"lastAttemptAt" = "windowStartedAt" - interval \'1 second\'',
    '"lastFailureAt" = "lastAttemptAt" + interval \'1 second\'',
    '"blockedUntil" = "lastAttemptAt" - interval \'1 second\'',
    '"expiresAt" = "lastAttemptAt"',
    '"failureCount" = -1', '"attemptCount" = -1',
    '"failureCount" = "attemptCount" + 1', '"backoffLevel" = -1',
    '"keyDigest" = \'invalid\'',
  ];
  for (const update of invalidUpdates) {
    test(`remaining constraints reject ${update}`, async () => {
      const original = await seed();
      await assert.rejects(pool.query('UPDATE "AuthAbuseBucket" SET ' + update), (error: unknown) =>
        typeof error === "object" && error !== null && "code" in error && error.code === "23514");
      assert.deepEqual(await get(), original);
    });
  }
  test("expired bucket is refreshed by existing policy, not implicitly deleted", async () => {
    await seed(); await attempt(31 * 86_400_000);
    const row = await get(); assert.equal(+row.lastFailureAt!, base + 500);
    assert.equal(row.attemptCount, 1); assert.equal(row.failureCount, 0);
    assert.equal(+row.expiresAt, base + 61 * 86_400_000);
  });
  test("no business or audit rows and no unexpected schema objects", async () => {
    const tables = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    assert.equal(tables.rows.length, 31);
    for (const { tablename } of tables.rows) {
      if (["AuthAbuseBucket", "_prisma_migrations"].includes(tablename)) continue;
      const result = await pool.query('SELECT count(*)::int AS n FROM "' + tablename.replaceAll('"', '""') + '"');
      assert.equal(result.rows[0].n, 0, tablename);
    }
  });
}
