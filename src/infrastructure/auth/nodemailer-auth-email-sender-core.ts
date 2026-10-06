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
  readonly connectionTimeout: number;
  readonly greetingTimeout: number;
  readonly socketTimeout: number;
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
  constructor(readonly code: "REJECTED" | "DELIVERY_UNKNOWN" = "DELIVERY_UNKNOWN") {
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
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 20_000,
          auth: {
            user: config.username,
            pass: config.password,
          },
        });
        const result = await transport.sendMail({
          from: config.from,
          replyTo: config.replyTo,
          to: message.recipient,
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
        });
        if (typeof result !== "object" || result === null) throw new AuthEmailDeliveryError();
        const recipient = message.recipient.toLowerCase();
        const containsRecipient = (values: unknown) => Array.isArray(values) && values.some((value: unknown) => {
          const address = typeof value === "string" ? value : typeof value === "object" && value !== null && "address" in value ? value.address : null;
          return typeof address === "string" && address.toLowerCase() === recipient;
        });
        const rejected = "rejected" in result && containsRecipient(result.rejected);
        const accepted = "accepted" in result && containsRecipient(result.accepted);
        if (!accepted && rejected) throw new AuthEmailDeliveryError("REJECTED");
        if (!accepted || rejected) throw new AuthEmailDeliveryError();
        return { status: "SENT" };
      } catch (error) {
        if (error instanceof AuthEmailDeliveryError) throw error;
        throw new AuthEmailDeliveryError();
      }
    },
  };
}
