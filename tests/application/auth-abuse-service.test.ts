import assert from "node:assert/strict";
import test from "node:test";

import {
  createAuthAbuseService,
  type AuthAbuseRepository,
} from "../../src/application/auth/auth-abuse-service";
import type { AuthAbuseBucketKey } from "../../src/application/auth/auth-abuse-types";

const now = new Date("2026-08-25T12:00:00.000Z");
const globalKey: AuthAbuseBucketKey = {
  dimension: "GLOBAL_ENDPOINT",
  endpoint: "SIGN_IN",
  keyDigest: "A".repeat(43),
};

function dependencies(repository: AuthAbuseRepository) {
  return {
    repository,
    canonicalizeAccountIdentifier: (value: string) => value.trim().toLowerCase(),
    normalizeTrustedClientNetwork: (value: string | undefined) => value === undefined
      ? null
      : value === "invalid"
        ? null
        : { addressFamily: "IPV4" as const, networkKey: "203.0.113.0/24" },
    deriveKeys: () => [globalKey],
    now: () => now,
  };
}

test("persists and checks the pre-attempt state before returning ALLOW", async () => {
  const calls: string[] = [];
  const service = createAuthAbuseService(dependencies({
    async recordPreAttempt() {
      calls.push("pre-attempt");
      return [];
    },
    async recordOutcome() {
      calls.push("outcome");
    },
  }));

  assert.deepEqual(await service.checkBeforeAttempt({ endpoint: "SIGN_IN" }), {
    status: "ALLOW",
  });
  assert.deepEqual(calls, ["pre-attempt"]);
});

test("pre-attempt repository failure fails closed with a generic result", async () => {
  const service = createAuthAbuseService(dependencies({
    async recordPreAttempt() {
      throw new Error("database detail");
    },
    async recordOutcome() {},
  }));

  assert.deepEqual(await service.checkBeforeAttempt({ endpoint: "SIGN_IN" }), {
    status: "BLOCK",
    reasonCode: "TEMPORARILY_UNAVAILABLE",
    retryAfterSeconds: 1,
  });
});

test("an absent trusted address makes network dimensions explicitly unavailable", async () => {
  let observedKeys: readonly AuthAbuseBucketKey[] = [];
  const service = createAuthAbuseService(dependencies({
    async recordPreAttempt({ keys }) {
      observedKeys = keys;
      return [];
    },
    async recordOutcome() {},
  }));

  assert.equal((await service.checkBeforeAttempt({ endpoint: "SIGN_IN" })).status, "ALLOW");
  assert.deepEqual(observedKeys, [globalKey]);
});

test("a supplied but invalid trusted address fails closed before persistence", async () => {
  let called = false;
  const service = createAuthAbuseService(dependencies({
    async recordPreAttempt() {
      called = true;
      return [];
    },
    async recordOutcome() {},
  }));

  assert.equal((await service.checkBeforeAttempt({
    endpoint: "SIGN_IN",
    trustedClientAddress: "invalid",
  })).status, "BLOCK");
  assert.equal(called, false);
});

test("post-attempt failure is classified for reconciliation without changing auth outcome", async () => {
  const service = createAuthAbuseService(dependencies({
    async recordPreAttempt() { return []; },
    async recordOutcome() {
      throw new Error("write failed");
    },
  }));

  assert.deepEqual(await service.recordOutcome({
    endpoint: "SIGN_IN",
    outcome: "SUCCESS",
  }), {
    status: "OPERATIONAL_RECONCILIATION_REQUIRED",
  });
});

test("post-attempt outcomes are recorded using digests only", async () => {
  let received: readonly AuthAbuseBucketKey[] = [];
  const service = createAuthAbuseService(dependencies({
    async recordPreAttempt() { return []; },
    async recordOutcome({ keys }) { received = keys; },
  }));

  assert.deepEqual(await service.recordOutcome({
    endpoint: "SIGN_IN",
    accountIdentifier: "person@example.com",
    trustedClientAddress: "203.0.113.44",
    outcome: "FAILURE",
  }), { status: "RECORDED" });
  assert.deepEqual(received, [globalKey]);
  assert.equal(JSON.stringify(received).includes("person@example.com"), false);
  assert.equal(JSON.stringify(received).includes("203.0.113.44"), false);
});
