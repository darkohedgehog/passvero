import assert from "node:assert/strict";
import test from "node:test";

import {
  AuthEmailDeliveryError,
  createNodemailerAuthEmailSender,
} from "../../src/infrastructure/auth/nodemailer-auth-email-sender-core";

const config = {
  host: "smtp.example.com",
  port: 465,
  secure: true,
  username: "contact@passvero.eu",
  password: "test-only-secret",
  from: "contact@passvero.eu",
  replyTo: "contact@passvero.eu",
} as const;

test("lazily creates a sanitized Nodemailer transport and sends rendered mail", async () => {
  const transportOptions: unknown[] = [];
  const mailOptions: unknown[] = [];
  let factoryCalls = 0;
  const sender = createNodemailerAuthEmailSender(config, {
    canonicalOrigin: "https://passvero.eu",
    createTransport(options) {
      factoryCalls += 1;
      transportOptions.push(options);
      return {
        async sendMail(message) {
          mailOptions.push(message);
        },
      };
    },
  });

  assert.equal(factoryCalls, 0);
  const result = await sender.send({
    type: "VERIFY_EMAIL",
    recipient: "person@example.com",
    verificationUrl: "https://passvero.eu/api/auth/verify-email?token=test-token",
  });

  assert.deepEqual(result, { status: "SENT" });
  assert.equal(factoryCalls, 1);
  assert.deepEqual(transportOptions, [{
    host: "smtp.example.com",
    port: 465,
    secure: true,
    auth: {
      user: "contact@passvero.eu",
      pass: "test-only-secret",
    },
  }]);
  assert.deepEqual(mailOptions, [{
    from: "contact@passvero.eu",
    replyTo: "contact@passvero.eu",
    to: "person@example.com",
    subject: "Verify your Passvero email",
    text: "Verify your Passvero email:\nhttps://passvero.eu/api/auth/verify-email?token=test-token",
    html: "<p>Verify your Passvero email:</p><p><a href=\"https://passvero.eu/api/auth/verify-email?token=test-token\">Continue securely</a></p>",
  }]);
  assert.equal(
    "tls" in (transportOptions[0] as Record<string, unknown>),
    false,
  );
});

test("converts transport failures to one provider-neutral secret-free error", async () => {
  const sender = createNodemailerAuthEmailSender(config, {
    canonicalOrigin: "https://passvero.eu",
    createTransport() {
      return {
        async sendMail() {
          throw new Error(`SMTP failed with ${config.password}`);
        },
      };
    },
  });

  await assert.rejects(
    sender.send({
      type: "PASSWORD_CHANGED",
      recipient: "person@example.com",
    }),
    (error: unknown) => {
      assert.ok(error instanceof AuthEmailDeliveryError);
      assert.equal(error.message, "Authentication email delivery failed.");
      assert.doesNotMatch(error.message, new RegExp(config.password));
      assert.equal("cause" in error, false);
      return true;
    },
  );
});
