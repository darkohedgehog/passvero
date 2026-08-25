import "server-only";

import type { AuthEmailSender } from "@/src/application/auth/auth-email";
import { createNodemailerAuthEmailSender } from "@/src/infrastructure/auth/nodemailer-auth-email-sender";
import { validateSmtpConfig } from "@/src/infrastructure/auth/smtp-config";

export function createLazyAuthEmailSender(
  canonicalOrigin: string,
): AuthEmailSender {
  let sender: AuthEmailSender | undefined;

  return {
    async send(message) {
      sender ??= createNodemailerAuthEmailSender(
        validateSmtpConfig(process.env),
        { canonicalOrigin },
      );
      return sender.send(message);
    },
  };
}
