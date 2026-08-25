import assert from "node:assert/strict";
import test from "node:test";

import type { BetterAuthOptions } from "better-auth";

import {
  BetterAuthServerConfigError,
  createControlledActivationBetterAuthServerOptions,
  createBetterAuthServerOptions,
  validateBetterAuthServerConfig,
} from "../../src/infrastructure/auth/better-auth-server-config";

const validSecret = "a".repeat(64);

function expectCode(
  input: { readonly secret: unknown; readonly baseURL: unknown },
  code: string,
): void {
  assert.throws(
    () => validateBetterAuthServerConfig(input),
    (error: unknown) =>
      error instanceof BetterAuthServerConfigError && error.code === code,
  );
}

test("accepts one fixed HTTPS origin and a non-padded secret", () => {
  assert.deepEqual(
    validateBetterAuthServerConfig({
      secret: validSecret,
      baseURL: "https://passvero.eu/",
    }),
    {
      secret: validSecret,
      baseURL: "https://passvero.eu",
      trustedOrigins: ["https://passvero.eu"],
    },
  );
});

test("rejects missing, padded, short, non-HTTPS, and non-origin configuration", () => {
  expectCode({ secret: undefined, baseURL: "https://passvero.eu" }, "SECRET_MISSING");
  expectCode({ secret: ` ${validSecret}`, baseURL: "https://passvero.eu" }, "SECRET_PADDED");
  expectCode({ secret: "too-short", baseURL: "https://passvero.eu" }, "SECRET_LENGTH");
  expectCode({ secret: validSecret, baseURL: undefined }, "ORIGIN_MISSING");
  expectCode({ secret: validSecret, baseURL: " https://passvero.eu" }, "ORIGIN_PADDED");
  expectCode({ secret: validSecret, baseURL: "not a url" }, "ORIGIN_MALFORMED");
  expectCode({ secret: validSecret, baseURL: "http://passvero.eu" }, "ORIGIN_SCHEME");
  expectCode({ secret: validSecret, baseURL: "https://user@passvero.eu" }, "ORIGIN_SHAPE");
  expectCode({ secret: validSecret, baseURL: "https://passvero.eu:8443" }, "ORIGIN_SHAPE");
  expectCode({ secret: validSecret, baseURL: "https://passvero.eu/auth" }, "ORIGIN_SHAPE");
  expectCode({ secret: validSecret, baseURL: "https://passvero.eu?next=/" }, "ORIGIN_SHAPE");
  expectCode({ secret: validSecret, baseURL: "https://passvero.eu#fragment" }, "ORIGIN_SHAPE");
});

test("never exposes candidate secrets or origins through validation errors", () => {
  const candidateSecret = "stage13c-sensitive-secret";
  const candidateOrigin = "http://sensitive.example/private";

  assert.throws(
    () => validateBetterAuthServerConfig({
      secret: candidateSecret,
      baseURL: candidateOrigin,
    }),
    (error: unknown) => {
      assert.ok(error instanceof BetterAuthServerConfigError);
      assert.doesNotMatch(error.message, /stage13c-sensitive-secret|sensitive\.example/);
      assert.equal("cause" in error, false);
      return true;
    },
  );
});

test("builds only the frozen provider models, session policy, and host-only cookie policy", () => {
  const database = (() => undefined) as NonNullable<BetterAuthOptions["database"]>;
  const password = {
    async hash(value: string) {
      return `hash:${value.length}`;
    },
    async verify() {
      return false;
    },
  };
  const config = validateBetterAuthServerConfig({
    secret: validSecret,
    baseURL: "https://passvero.eu",
  });

  const lifecycle = {
    sendVerificationEmail: async () => undefined,
    afterEmailVerification: async () => undefined,
    sendResetPassword: async () => undefined,
    onPasswordReset: async () => undefined,
  };
  const options = createBetterAuthServerOptions(
    config,
    database,
    password,
    lifecycle,
  );

  assert.equal(options.appName, "Passvero");
  assert.equal(options.database, database);
  assert.equal(options.secret, validSecret);
  assert.equal(options.baseURL, "https://passvero.eu");
  assert.deepEqual(options.trustedOrigins, ["https://passvero.eu"]);
  assert.deepEqual(options.user, { modelName: "AuthProviderUser" });
  assert.deepEqual(options.session, {
    modelName: "AuthProviderSession",
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: false },
  });
  assert.deepEqual(options.account, { modelName: "AuthProviderAccount" });
  assert.deepEqual(options.verification, { modelName: "AuthProviderVerification" });
  assert.deepEqual(options.advanced, {
    crossSubDomainCookies: { enabled: false },
    defaultCookieAttributes: {
      secure: true,
      httpOnly: true,
      sameSite: "lax",
    },
  });
  assert.deepEqual(options.telemetry, { enabled: false });
  assert.deepEqual(options.emailAndPassword, {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: true,
    autoSignIn: false,
    resetPasswordTokenExpiresIn: 60 * 30,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: lifecycle.sendResetPassword,
    onPasswordReset: lifecycle.onPasswordReset,
    minPasswordLength: 1,
    maxPasswordLength: 256,
    password,
  });
  assert.deepEqual(options.emailVerification, {
    expiresIn: 60 * 60 * 24,
    autoSignInAfterVerification: false,
    sendOnSignUp: false,
    sendVerificationEmail: lifecycle.sendVerificationEmail,
    afterEmailVerification: lifecycle.afterEmailVerification,
  });
  assert.equal(options.socialProviders, undefined);
  assert.equal(options.plugins, undefined);
  assert.equal(options.secondaryStorage, undefined);
});

test("enables signup only in the private controlled-activation composition", () => {
  const database = (() => undefined) as NonNullable<BetterAuthOptions["database"]>;
  const password = {
    hash: async () => "hash",
    verify: async () => true,
  };
  const config = validateBetterAuthServerConfig({
    secret: validSecret,
    baseURL: "https://passvero.eu",
  });
  const normal = createBetterAuthServerOptions(config, database, password);
  const controlled = createControlledActivationBetterAuthServerOptions(
    config,
    database,
    password,
  );

  assert.equal(normal.emailAndPassword?.disableSignUp, true);
  assert.equal(controlled.emailAndPassword?.disableSignUp, false);
  assert.equal(controlled.emailAndPassword?.autoSignIn, false);
  assert.equal(controlled.emailAndPassword?.requireEmailVerification, true);
  assert.equal(controlled.emailVerification?.sendOnSignUp, false);
});
