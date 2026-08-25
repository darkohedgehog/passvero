import nodemailer from "nodemailer";

import type {
  AuthEmailMessage,
  AuthEmailSender,
} from "@/src/application/auth/auth-email";
import { renderAuthEmail } from "@/src/infrastructure/auth/auth-email-templates";
import type { SmtpConfig } from "@/src/infrastructure/auth/smtp-config";

interface MailTransport {
  sendMail(message: {
    readonly from: string;
    readonly replyTo: string;
    readonly to: string;
    readonly subject: string;
    readonly text: string;
    readonly html: string;
  }): Promise<unknown>;
}

interface MailTransportOptions {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly auth: {
    readonly user: string;
    readonly pass: string;
  };
}

interface NodemailerAuthEmailDependencies {
  readonly canonicalOrigin: string;
  readonly createTransport?: (options: MailTransportOptions) => MailTransport;
}

export class AuthEmailDeliveryError extends Error {
  constructor() {
    super("Authentication email delivery failed.");
    this.name = "AuthEmailDeliveryError";
  }
}

export function createNodemailerAuthEmailSender(
  config: SmtpConfig,
  dependencies: NodemailerAuthEmailDependencies,
): AuthEmailSender {
  const createTransport = dependencies.createTransport
    ?? ((options: MailTransportOptions) => nodemailer.createTransport(options));
  let transport: MailTransport | undefined;

  return {
    async send(message: AuthEmailMessage) {
      try {
        const rendered = renderAuthEmail(
          message,
          dependencies.canonicalOrigin,
        );
        transport ??= createTransport({
          host: config.host,
          port: config.port,
          secure: config.secure,
          auth: {
            user: config.username,
            pass: config.password,
          },
        });
        await transport.sendMail({
          from: config.from,
          replyTo: config.replyTo,
          to: message.recipient,
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
        });
        return { status: "SENT" };
      } catch {
        throw new AuthEmailDeliveryError();
      }
    },
  };
}
