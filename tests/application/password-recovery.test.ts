import assert from "node:assert/strict";
import test from "node:test";

import { createPasswordRecoveryService } from "../../src/application/auth/password-recovery";

const validPassword = `Valid-reset-${"z".repeat(10)}`;

test("returns generic reset-request results and classifies delivery failure", async () => {
  const calls: string[] = [];
  const successful = createPasswordRecoveryService({
    provider: {
      async requestPasswordReset(email) {
        calls.push(email);
      },
      async completePasswordReset() {
        assert.fail("request must not complete a reset");
      },
    },
  });

  assert.deepEqual(await successful.request("person@example.com"), {
    status: "REQUEST_ACCEPTED",
  });
  assert.deepEqual(calls, ["person@example.com"]);

  const failed = createPasswordRecoveryService({
    provider: {
      async requestPasswordReset() {
        throw new Error("provider detail");
      },
      async completePasswordReset() {
        assert.fail("request must not complete a reset");
      },
    },
  });
  assert.deepEqual(await failed.request("person@example.com"), {
    status: "DELIVERY_RETRY_REQUIRED",
  });
});

test("rejects policy-invalid replacement before the provider reset operation", async () => {
  let providerCalls = 0;
  const service = createPasswordRecoveryService({
    provider: {
      async requestPasswordReset() {
        assert.fail("complete must not request a reset");
      },
      async completePasswordReset() {
        providerCalls += 1;
      },
    },
  });

  assert.deepEqual(await service.complete("raw-reset-token", "too short"), {
    status: "PASSWORD_REJECTED",
    reason: "TOO_SHORT",
  });
  assert.equal(providerCalls, 0);
});

test("completes reset through the provider and never returns raw credential material", async () => {
  const calls: unknown[] = [];
  const service = createPasswordRecoveryService({
    provider: {
      async requestPasswordReset() {
        assert.fail("complete must not request a reset");
      },
      async completePasswordReset(token, password) {
        calls.push({ token, password });
      },
    },
  });
  const token = "raw-reset-token";

  const result = await service.complete(token, validPassword);

  assert.deepEqual(result, { status: "PASSWORD_RESET" });
  assert.deepEqual(calls, [{ token, password: validPassword }]);
  assert.doesNotMatch(JSON.stringify(result), /raw-reset-token|Valid-reset/);
});

test("fails closed without reflecting a raw reset capability", async () => {
  const token = "raw-reset-token";
  const service = createPasswordRecoveryService({
    provider: {
      async requestPasswordReset() {
        assert.fail("complete must not request a reset");
      },
      async completePasswordReset() {
        throw new Error(`provider rejected ${token}`);
      },
    },
  });

  const result = await service.complete(token, validPassword);
  assert.deepEqual(result, { status: "DENIED" });
  assert.doesNotMatch(JSON.stringify(result), new RegExp(token));
});
