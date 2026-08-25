import assert from "node:assert/strict";
import test from "node:test";

import { createAuthenticatedPasswordChangeService } from "../../src/application/auth/change-password";

const validPassword = `Valid-change-${"z".repeat(10)}`;
const actor = {
  userId: "user-1",
  email: "person@example.com",
  displayName: "Person",
  headers: new Headers({ cookie: "test-session" }),
};

test("requires current password and rejects policy-invalid replacements before provider access", async () => {
  let providerCalls = 0;
  const change = createAuthenticatedPasswordChangeService({
    provider: {
      async changePassword() {
        providerCalls += 1;
        return { sessionStatus: "REVOKED" };
      },
    },
    emailSender: {
      async send() {
        assert.fail("rejected change must not send email");
      },
    },
  });

  assert.deepEqual(await change(actor, {
    currentPassword: "",
    newPassword: validPassword,
  }), { status: "DENIED" });
  assert.deepEqual(await change(actor, {
    currentPassword: "current-password",
    newPassword: "too short",
  }), {
    status: "PASSWORD_REJECTED",
    reason: "TOO_SHORT",
  });
  assert.equal(providerCalls, 0);
});

test("changes password, revokes sessions, and sends a security notification", async () => {
  const calls: unknown[] = [];
  const change = createAuthenticatedPasswordChangeService({
    provider: {
      async changePassword(input) {
        calls.push({ name: "provider", input });
        return { sessionStatus: "REVOKED" };
      },
    },
    emailSender: {
      async send(message) {
        calls.push({ name: "email", message });
        return { status: "SENT" };
      },
    },
  });

  const result = await change(actor, {
    currentPassword: "current-password",
    newPassword: validPassword,
  });

  assert.deepEqual(result, {
    status: "PASSWORD_CHANGED",
    sessionStatus: "REVOKED",
    notificationStatus: "SENT",
  });
  assert.deepEqual(calls, [
    {
      name: "provider",
      input: {
        headers: actor.headers,
        currentPassword: "current-password",
        newPassword: validPassword,
      },
    },
    {
      name: "email",
      message: {
        type: "PASSWORD_CHANGED",
        recipient: "person@example.com",
      },
    },
  ]);
  assert.doesNotMatch(JSON.stringify(result), /current-password|Valid-change/);
});

test("does not roll back a committed password when notification delivery fails", async () => {
  let changed = false;
  const change = createAuthenticatedPasswordChangeService({
    provider: {
      async changePassword() {
        changed = true;
        return { sessionStatus: "REVOKED" };
      },
    },
    emailSender: {
      async send() {
        throw new Error("SMTP detail");
      },
    },
  });

  assert.deepEqual(await change(actor, {
    currentPassword: "current-password",
    newPassword: validPassword,
  }), {
    status: "PASSWORD_CHANGED",
    sessionStatus: "REVOKED",
    notificationStatus: "RETRY_REQUIRED",
  });
  assert.equal(changed, true);
});

test("surfaces session-revocation reconciliation without exposing credentials", async () => {
  const change = createAuthenticatedPasswordChangeService({
    provider: {
      async changePassword() {
        return { sessionStatus: "RECONCILIATION_REQUIRED" };
      },
    },
    emailSender: {
      async send() {
        return { status: "SENT" };
      },
    },
  });

  assert.deepEqual(await change(actor, {
    currentPassword: "current-password",
    newPassword: validPassword,
  }), {
    status: "PASSWORD_CHANGED",
    sessionStatus: "RECONCILIATION_REQUIRED",
    notificationStatus: "SENT",
  });
});
