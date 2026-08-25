import assert from "node:assert/strict";
import test from "node:test";

import type {
  AuthEmailMessage,
  AuthEmailSender,
} from "../../src/application/auth/auth-email";

test("keeps auth email messages provider-neutral and limited to safe template data", async () => {
  const messages: AuthEmailMessage[] = [];
  const sender: AuthEmailSender = {
    async send(message) {
      messages.push(message);
      return { status: "SENT" };
    },
  };

  const result = await sender.send({
    type: "VERIFY_EMAIL",
    recipient: "person@example.com",
    locale: "en",
    verificationUrl: "https://passvero.eu/auth/verify#test-capability",
  });

  assert.deepEqual(result, { status: "SENT" });
  assert.deepEqual(messages, [{
    type: "VERIFY_EMAIL",
    recipient: "person@example.com",
    locale: "en",
    verificationUrl: "https://passvero.eu/auth/verify#test-capability",
  }]);
});
