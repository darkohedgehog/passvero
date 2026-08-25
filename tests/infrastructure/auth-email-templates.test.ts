import assert from "node:assert/strict";
import test from "node:test";

import {
  AuthEmailTemplateError,
  renderAuthEmail,
} from "../../src/infrastructure/auth/auth-email-templates";

const origin = "https://passvero.eu";

test("renders verification and reset links only for the fixed canonical HTTPS origin", () => {
  const verification = renderAuthEmail({
    type: "VERIFY_EMAIL",
    recipient: "person@example.com",
    locale: "en",
    verificationUrl: `${origin}/api/auth/verify-email?token=test-token`,
  }, origin);
  const reset = renderAuthEmail({
    type: "PASSWORD_RESET",
    recipient: "person@example.com",
    locale: "hr",
    resetUrl: `${origin}/api/auth/reset-password/test-token`,
  }, origin);

  assert.equal(verification.subject, "Verify your Passvero email");
  assert.match(verification.text, /^Verify your Passvero email:\nhttps:\/\/passvero\.eu\//);
  assert.match(verification.html, /https:\/\/passvero\.eu\//);
  assert.equal(reset.subject, "Ponovno postavite Passvero lozinku");
  assert.match(reset.text, /^Ponovno postavite Passvero lozinku:\nhttps:\/\/passvero\.eu\//);
});

test("rejects host-derived, non-HTTPS, credentialed, and alternate-origin links", () => {
  const unsafeUrls = [
    "http://passvero.eu/api/auth/verify-email?token=test-token",
    "https://evil.example/api/auth/verify-email?token=test-token",
    "https://user:password@passvero.eu/api/auth/verify-email?token=test-token",
    "//evil.example/api/auth/verify-email?token=test-token",
  ];

  for (const verificationUrl of unsafeUrls) {
    assert.throws(
      () => renderAuthEmail({
        type: "VERIFY_EMAIL",
        recipient: "person@example.com",
        verificationUrl,
      }, origin),
      (error: unknown) => error instanceof AuthEmailTemplateError
        && error.code === "UNTRUSTED_URL",
    );
  }
});

test("password-changed template contains no credential or provider state", () => {
  const rendered = renderAuthEmail({
    type: "PASSWORD_CHANGED",
    recipient: "person@example.com",
    locale: "en",
  }, origin);

  assert.equal(rendered.subject, "Your Passvero password was changed");
  assert.doesNotMatch(`${rendered.text}\n${rendered.html}`, /password=|token|hash|session/i);
});
