import assert from "node:assert/strict";
import test from "node:test";

import {
  SmtpConfigError,
  validateSmtpConfig,
} from "../../src/infrastructure/auth/smtp-config";

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    SMTP_HOST: "smtp.example.com",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_USER: "contact@passvero.eu",
    SMTP_PASSWORD: "test-only-secret",
    AUTH_EMAIL_FROM: "contact@passvero.eu",
    AUTH_EMAIL_REPLY_TO: "contact@passvero.eu",
    ...overrides,
  };
}

test("parses explicit secure true and false without inferring from the port", () => {
  assert.equal(validateSmtpConfig(validInput()).secure, true);
  assert.deepEqual(
    validateSmtpConfig(validInput({ SMTP_PORT: "587", SMTP_SECURE: "false" })),
    {
      host: "smtp.example.com",
      port: 587,
      secure: false,
      username: "contact@passvero.eu",
      password: "test-only-secret",
      from: "contact@passvero.eu",
      replyTo: "contact@passvero.eu",
    },
  );
});

test("fails closed for missing or malformed SMTP values with secret-free errors", () => {
  const cases: Array<[Record<string, unknown>, SmtpConfigError["code"]]> = [
    [{ SMTP_HOST: "" }, "HOST_INVALID"],
    [{ SMTP_PORT: "0" }, "PORT_INVALID"],
    [{ SMTP_PORT: "65536" }, "PORT_INVALID"],
    [{ SMTP_PORT: "465.5" }, "PORT_INVALID"],
    [{ SMTP_SECURE: "yes" }, "SECURE_INVALID"],
    [{ SMTP_USER: "" }, "USERNAME_INVALID"],
    [{ SMTP_PASSWORD: "" }, "PASSWORD_INVALID"],
    [{ AUTH_EMAIL_FROM: "not-an-email" }, "FROM_INVALID"],
    [{ AUTH_EMAIL_REPLY_TO: "not-an-email" }, "REPLY_TO_INVALID"],
  ];

  for (const [override, code] of cases) {
    const secret = "do-not-expose-this-secret";
    assert.throws(
      () => validateSmtpConfig(validInput({
        SMTP_PASSWORD: secret,
        ...override,
      })),
      (error: unknown) => {
        assert.ok(error instanceof SmtpConfigError);
        assert.equal(error.code, code);
        assert.doesNotMatch(error.message, new RegExp(secret));
        assert.equal("cause" in error, false);
        return true;
      },
    );
  }
});
