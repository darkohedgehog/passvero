import assert from "node:assert/strict";
import test from "node:test";

import {
  createExplicitAuthHttpTransport,
  type ExplicitAuthHttpDependencies,
} from "../../src/application/auth/explicit-auth-http-transport";

const origin = "https://passvero.eu";

function request(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${origin}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, ...headers },
    body: JSON.stringify(body),
  });
}

function dependencies() {
  const calls: string[] = [];
  const input: ExplicitAuthHttpDependencies = {
    canonicalOrigin: origin,
    trustedClientAddress: () => undefined,
    abuse: {
      async checkBeforeAttempt() {
        calls.push("abuse:pre");
        return { status: "ALLOW" as const };
      },
      async recordOutcome({ outcome }: { outcome: "SUCCESS" | "FAILURE" }) {
        calls.push(`abuse:post:${outcome}`);
        return { status: "RECORDED" as const };
      },
    },
    turnstileVerifier: { async verify() { return { valid: false }; } },
    provider: {
      async signIn() {
        calls.push("provider:sign-in");
        return { headers: new Headers({ "set-cookie": "passvero.session=opaque; HttpOnly; Secure; SameSite=Lax" }) };
      },
      async verifyEmail() { calls.push("provider:verify-email"); },
      async signOut() { calls.push("provider:sign-out"); return { headers: new Headers() }; },
    },
    lifecycle: {
      async activate() { calls.push("lifecycle:activate"); return { status: "VERIFICATION_PENDING" as const }; },
      async requestEmailVerification() { calls.push("lifecycle:verification-request"); },
      passwordRecovery: {
        async request() { calls.push("lifecycle:reset-request"); return { status: "REQUEST_ACCEPTED" as const }; },
        async complete() { calls.push("lifecycle:reset-consume"); return { status: "PASSWORD_RESET" as const }; },
      },
      async changePassword() { calls.push("lifecycle:password-change"); return { status: "PASSWORD_CHANGED" as const }; },
    },
    async resolvePasswordChangeActor() { return null; },
  };
  return {
    calls,
    input,
  };
}

test("sign-in rejects malformed input before abuse or provider access", async () => {
  const fixture = dependencies();
  const transport = createExplicitAuthHttpTransport(fixture.input);
  const response = await transport.signIn(request("/api/auth/sign-in", { email: "person@example.com" }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { status: "INVALID_REQUEST" });
  assert.deepEqual(fixture.calls, []);
});

test("state-changing auth rejects a non-canonical Origin", async () => {
  const fixture = dependencies();
  const transport = createExplicitAuthHttpTransport(fixture.input);
  const response = await transport.signIn(request("/api/auth/sign-in", {
    email: "person@example.com",
    password: "correct horse battery staple",
  }, { origin: "https://attacker.example" }));

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { status: "DENIED" });
  assert.deepEqual(fixture.calls, []);
});

test("sign-in preserves only the provider cookie and never returns its token or user", async () => {
  const fixture = dependencies();
  const transport = createExplicitAuthHttpTransport(fixture.input);
  const response = await transport.signIn(request("/api/auth/sign-in", {
    email: "person@example.com",
    password: "correct horse battery staple",
  }));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "AUTHENTICATED" });
  assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/);
  assert.deepEqual(fixture.calls, ["abuse:pre", "provider:sign-in", "abuse:post:SUCCESS"]);
});

test("abuse block and missing risk challenge stop before provider authentication", async () => {
  for (const decision of [
    { status: "BLOCK" as const, reasonCode: "TEMPORARILY_UNAVAILABLE" as const, retryAfterSeconds: 60 },
    { status: "REQUIRE_TURNSTILE" as const, reasonCode: "ADDITIONAL_VERIFICATION_REQUIRED" as const },
  ]) {
    const fixture = dependencies();
    fixture.input.abuse.checkBeforeAttempt = async () => decision;
    const response = await createExplicitAuthHttpTransport(fixture.input).signIn(request("/api/auth/sign-in", {
      email: "person@example.com",
      password: "correct horse battery staple",
    }));
    assert.equal(response.status, decision.status === "BLOCK" ? 429 : 403);
    assert.equal(fixture.calls.includes("provider:sign-in"), false);
  }
});

test("provider failure is generic and records a failed outcome", async () => {
  const fixture = dependencies();
  fixture.input.provider.signIn = async () => { throw new Error("raw Better Auth account detail"); };
  const response = await createExplicitAuthHttpTransport(fixture.input).signIn(request("/api/auth/sign-in", {
    email: "person@example.com",
    password: "wrong-password-material",
  }));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { status: "AUTHENTICATION_FAILED" });
  assert.deepEqual(fixture.calls, ["abuse:pre", "abuse:post:FAILURE"]);
});

test("risk-triggered Turnstile validates the endpoint action and fails closed", async () => {
  const fixture = dependencies();
  fixture.input.abuse.checkBeforeAttempt = async () => ({
    status: "REQUIRE_TURNSTILE",
    reasonCode: "ADDITIONAL_VERIFICATION_REQUIRED",
  });
  fixture.input.turnstileVerifier.verify = async (input) => {
    fixture.calls.push(`turnstile:${input.expectedAction}`);
    return { valid: false, action: input.expectedAction };
  };
  const denied = await createExplicitAuthHttpTransport(fixture.input).signIn(request("/api/auth/sign-in", {
    email: "person@example.com",
    password: "correct horse battery staple",
    turnstileToken: "opaque-client-token",
  }));

  assert.equal(denied.status, 403);
  assert.deepEqual(fixture.calls, ["turnstile:auth_sign_in"]);

  fixture.input.turnstileVerifier.verify = async (input) => ({
    valid: true,
    action: input.expectedAction,
  });
  const allowed = await createExplicitAuthHttpTransport(fixture.input).signIn(request("/api/auth/sign-in", {
    email: "person@example.com",
    password: "correct horse battery staple",
    turnstileToken: "opaque-client-token",
  }));
  assert.equal(allowed.status, 200);
  assert.equal(fixture.calls.includes("provider:sign-in"), true);
});

test("verification requests remain outwardly equivalent while recording the real outcome", async () => {
  const successful = dependencies();
  const accepted = await createExplicitAuthHttpTransport(successful.input)
    .requestEmailVerification(request("/api/auth/verification/request", { email: "known@example.com" }));

  const failed = dependencies();
  failed.input.lifecycle.requestEmailVerification = async () => {
    throw new Error("provider account does not exist");
  };
  const hidden = await createExplicitAuthHttpTransport(failed.input)
    .requestEmailVerification(request("/api/auth/verification/request", { email: "unknown@example.com" }));

  assert.equal(accepted.status, 202);
  assert.equal(hidden.status, 202);
  assert.deepEqual(await accepted.json(), await hidden.json());
  assert.equal(successful.calls.at(-1), "abuse:post:SUCCESS");
  assert.equal(failed.calls.at(-1), "abuse:post:FAILURE");
});

test("verification consume transports only one token to the provider callback", async () => {
  const fixture = dependencies();
  let observedToken = "";
  fixture.input.provider.verifyEmail = async ({ token }) => {
    observedToken = token;
    fixture.calls.push("provider:verify-email");
  };
  const transport = createExplicitAuthHttpTransport(fixture.input);
  const rejected = await transport.consumeEmailVerification(
    new Request(`${origin}/api/auth/verification/consume?token=opaque&verified=true`),
  );
  const accepted = await transport.consumeEmailVerification(
    new Request(`${origin}/api/auth/verification/consume?token=opaque`),
  );

  assert.equal(rejected.status, 400);
  assert.equal(accepted.status, 200);
  assert.equal(observedToken, "opaque");
  assert.deepEqual(await accepted.json(), { status: "VERIFIED" });
});

test("verification consume accepts one bounded Turnstile token header when risk requires it", async () => {
  const fixture = dependencies();
  fixture.input.abuse.checkBeforeAttempt = async () => ({
    status: "REQUIRE_TURNSTILE",
    reasonCode: "ADDITIONAL_VERIFICATION_REQUIRED",
  });
  let observedTurnstileToken = "";
  fixture.input.turnstileVerifier.verify = async (input) => {
    observedTurnstileToken = input.token;
    return { valid: true, action: input.expectedAction };
  };
  const transport = createExplicitAuthHttpTransport(fixture.input);

  const accepted = await transport.consumeEmailVerification(
    new Request(`${origin}/api/auth/verification/consume?token=opaque`, {
      headers: { "x-passvero-turnstile-token": "opaque-turnstile-token" },
    }),
  );

  assert.equal(accepted.status, 200);
  assert.equal(observedTurnstileToken, "opaque-turnstile-token");
  assert.deepEqual(fixture.calls, ["provider:verify-email", "abuse:post:SUCCESS"]);
});

test("verification consume rejects ambiguous or oversized Turnstile token headers before abuse", async () => {
  const fixture = dependencies();
  const transport = createExplicitAuthHttpTransport(fixture.input);

  for (const token of ["first, second", "x".repeat(2049)]) {
    const response = await transport.consumeEmailVerification(
      new Request(`${origin}/api/auth/verification/consume?token=opaque`, {
        headers: { "x-passvero-turnstile-token": token },
      }),
    );
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { status: "INVALID_REQUEST" });
  }

  assert.deepEqual(fixture.calls, []);
});

test("activation delegates to the controlled lifecycle and never returns its capability", async () => {
  const fixture = dependencies();
  const response = await createExplicitAuthHttpTransport(fixture.input).activate(request("/api/auth/activate", {
    capability: "a".repeat(43),
    password: "correct horse battery staple",
  }));

  assert.equal(response.status, 202);
  const responseText = await response.text();
  assert.deepEqual(JSON.parse(responseText), { status: "ACTIVATION_ACCEPTED" });
  assert.deepEqual(fixture.calls, ["abuse:pre", "lifecycle:activate", "abuse:post:SUCCESS"]);
  assert.equal(responseText.includes("a".repeat(43)), false);
});

test("password reset request is generic and completion never returns its token", async () => {
  const fixture = dependencies();
  const transport = createExplicitAuthHttpTransport(fixture.input);
  const requested = await transport.requestPasswordReset(request("/api/auth/password-reset/request", {
    email: "person@example.com",
  }));
  const completed = await transport.consumePasswordReset(request("/api/auth/password-reset/consume", {
    token: "opaque-reset-token",
    newPassword: "correct horse battery staple",
  }));

  assert.equal(requested.status, 202);
  assert.deepEqual(await requested.json(), { status: "ACCEPTED" });
  assert.equal(completed.status, 200);
  assert.deepEqual(await completed.json(), { status: "PASSWORD_RESET" });
});

test("password reset delivery failure remains generic and records a failed outcome", async () => {
  const fixture = dependencies();
  fixture.input.lifecycle.passwordRecovery.request = async () => ({
    status: "DELIVERY_RETRY_REQUIRED",
  });
  const response = await createExplicitAuthHttpTransport(fixture.input)
    .requestPasswordReset(request("/api/auth/password-reset/request", {
      email: "unknown@example.com",
    }));

  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { status: "ACCEPTED" });
  assert.equal(fixture.calls.at(-1), "abuse:post:FAILURE");
});

test("password change requires a resolved provider-neutral actor before abuse processing", async () => {
  const fixture = dependencies();
  const transport = createExplicitAuthHttpTransport(fixture.input);
  const unauthenticated = await transport.changePassword(request("/api/auth/password/change", {
    currentPassword: "old-password",
    newPassword: "correct horse battery staple",
  }));
  assert.equal(unauthenticated.status, 401);
  assert.deepEqual(fixture.calls, []);

  const authenticatedTransport = createExplicitAuthHttpTransport({
    ...fixture.input,
    async resolvePasswordChangeActor(headers) {
      return {
        userId: "user-id",
        email: "person@example.com",
        displayName: "Person",
        headers,
      };
    },
  });
  const changed = await authenticatedTransport.changePassword(request("/api/auth/password/change", {
    currentPassword: "old-password",
    newPassword: "correct horse battery staple",
  }));
  assert.equal(changed.status, 200);
  assert.deepEqual(await changed.json(), { status: "PASSWORD_CHANGED" });
  assert.deepEqual(fixture.calls, ["abuse:pre", "lifecycle:password-change", "abuse:post:SUCCESS"]);
});

test("sign-out uses provider revocation and exposes only a generic result", async () => {
  const fixture = dependencies();
  fixture.input.provider.signOut = async () => ({
    headers: new Headers({ "set-cookie": "passvero.session=; Max-Age=0; HttpOnly; Secure" }),
  });
  const response = await createExplicitAuthHttpTransport(fixture.input)
    .signOut(request("/api/auth/sign-out", {}));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "SIGNED_OUT" });
  assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/);
});

test("post-attempt persistence failure returns a secret-safe reconciliation result", async () => {
  const fixture = dependencies();
  fixture.input.abuse.recordOutcome = async () => ({
    status: "OPERATIONAL_RECONCILIATION_REQUIRED",
  });
  const response = await createExplicitAuthHttpTransport(fixture.input).signIn(request("/api/auth/sign-in", {
    email: "person@example.com",
    password: "correct horse battery staple",
  }));

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: "OPERATIONAL_FAILURE" });
  assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/);
});
