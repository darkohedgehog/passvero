import assert from "node:assert/strict";
import test from "node:test";

import {
  createBetterAuthLifecycleAdapter,
  createBetterAuthLifecycleCallbacks,
} from "../../src/infrastructure/auth/better-auth-lifecycle-adapter";

test("maps Better Auth email callbacks to provider-neutral messages", async () => {
  const messages: unknown[] = [];
  const callbacks = createBetterAuthLifecycleCallbacks({
    async send(message) {
      messages.push(message);
      return { status: "SENT" };
    },
  }, "https://passvero.eu");

  await callbacks.sendVerificationEmail({
    user: { email: "person@example.com" },
    url: "https://passvero.eu/api/auth/verify-email?token=test-token&callbackURL=https%3A%2F%2Fpassvero.eu%2Fauth%2Fverify-email",
  });
  await callbacks.sendResetPassword({
    user: { email: "person@example.com" },
    url: "https://passvero.eu/api/auth/reset-password/test-token?callbackURL=https%3A%2F%2Fpassvero.eu%2Fauth%2Freset-password",
  });

  assert.deepEqual(messages, [
    {
      type: "VERIFY_EMAIL",
      recipient: "person@example.com",
      verificationUrl: "https://passvero.eu/api/auth/verification/consume?token=test-token",
    },
    {
      type: "PASSWORD_RESET",
      recipient: "person@example.com",
      resetUrl: "https://passvero.eu/auth/reset-password?token=test-token",
    },
  ]);
});

test("rejects reset URLs outside the fixed Better Auth callback shape", async () => {
  const callbacks = createBetterAuthLifecycleCallbacks({
    async send() {
      throw new Error("email sender must not be reached");
    },
  }, "https://passvero.eu");

  for (const url of [
    "https://attacker.example/api/auth/reset-password/test-token?callbackURL=https%3A%2F%2Fpassvero.eu%2Fauth%2Freset-password",
    "https://passvero.eu/api/auth/reset-password/test-token?callbackURL=https%3A%2F%2Fattacker.example%2Freset",
    "https://passvero.eu/api/auth/reset-password/test-token?callbackURL=https%3A%2F%2Fpassvero.eu%2Fauth%2Freset-password&unexpected=true",
    "https://passvero.eu/api/auth/reset-password/one/two?callbackURL=https%3A%2F%2Fpassvero.eu%2Fauth%2Freset-password",
    "https://passvero.eu/api/auth/reset-password/?callbackURL=https%3A%2F%2Fpassvero.eu%2Fauth%2Freset-password",
  ]) {
    await assert.rejects(
      callbacks.sendResetPassword({
        user: { email: "person@example.com" },
        url,
      }),
      /Password reset email transport URL is invalid/,
    );
  }
});

test("rejects verification URLs outside the fixed Better Auth callback shape", async () => {
  const callbacks = createBetterAuthLifecycleCallbacks({
    async send() {
      throw new Error("email sender must not be reached");
    },
  }, "https://passvero.eu");

  for (const url of [
    "https://attacker.example/api/auth/verify-email?token=test-token",
    "https://passvero.eu/api/auth/verify-email?token=test-token&unexpected=true",
    "https://passvero.eu/api/auth/verify-email?token=one&token=two",
    "https://passvero.eu/api/auth/verify-email",
  ]) {
    await assert.rejects(
      callbacks.sendVerificationEmail({
        user: { email: "person@example.com" },
        url,
      }),
      /Verification email transport URL is invalid/,
    );
  }
});

test("uses documented Better Auth APIs with only fixed-origin callback targets", async () => {
  const calls: Array<{ readonly name: string; readonly input: unknown }> = [];
  const adapter = createBetterAuthLifecycleAdapter({
    async signUpEmail(input) {
      calls.push({ name: "signUpEmail", input });
      return {
        token: "must-not-be-returned",
        user: {
          id: "provider-subject-1",
          email: "person@example.com",
          emailVerified: false,
        },
      };
    },
    async sendVerificationEmail(input) {
      calls.push({ name: "sendVerificationEmail", input });
      return { status: true };
    },
    async requestPasswordReset(input) {
      calls.push({ name: "requestPasswordReset", input });
      return { status: true };
    },
    async resetPassword(input) {
      calls.push({ name: "resetPassword", input });
      return { status: true };
    },
    async changePassword(input) {
      calls.push({ name: "changePassword", input });
      return {
        token: "must-not-be-returned",
        user: { id: "provider-subject-1" },
      };
    },
    async revokeSessions(input) {
      calls.push({ name: "revokeSessions", input });
      return { status: true };
    },
  }, "https://passvero.eu");
  const headers = new Headers({ cookie: "test-session-cookie" });

  const credential = await adapter.createCredential({
    email: "person@example.com",
    displayName: "Person",
    password: "test-password-material",
  });
  await adapter.requestEmailVerification("person@example.com");
  await adapter.requestPasswordReset("person@example.com");
  await adapter.completePasswordReset(
    "test-reset-token",
    "new-password-material",
  );
  await adapter.changePassword({
    headers,
    currentPassword: "current-password-material",
    newPassword: "new-password-material",
  });

  assert.deepEqual(credential, {
    providerSubject: "provider-subject-1",
    normalizedEmail: "person@example.com",
    emailVerified: false,
  });
  assert.deepEqual(calls, [
    {
      name: "signUpEmail",
      input: { body: {
        email: "person@example.com",
        name: "Person",
        password: "test-password-material",
        callbackURL: "https://passvero.eu/auth/verify-email",
        rememberMe: false,
      } },
    },
    {
      name: "sendVerificationEmail",
      input: { body: {
        email: "person@example.com",
        callbackURL: "https://passvero.eu/auth/verify-email",
      } },
    },
    {
      name: "requestPasswordReset",
      input: { body: {
        email: "person@example.com",
        redirectTo: "https://passvero.eu/auth/reset-password",
      } },
    },
    {
      name: "resetPassword",
      input: { body: {
        token: "test-reset-token",
        newPassword: "new-password-material",
      } },
    },
    {
      name: "changePassword",
      input: {
        headers,
        body: {
          currentPassword: "current-password-material",
          newPassword: "new-password-material",
          revokeOtherSessions: false,
        },
      },
    },
    { name: "revokeSessions", input: { headers } },
  ]);
});
