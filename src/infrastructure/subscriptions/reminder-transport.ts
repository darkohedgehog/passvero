import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type { SmtpConfig } from "@/src/infrastructure/auth/smtp-config";

export type ReminderTransportOutcome =
  | { status: "ACCEPTED" }
  | { status: "SAFE_RETRY"; reason: "SMTP_CONNECT_FAILED" | "SMTP_REJECTED_TEMPORARY" }
  | { status: "FAILED"; reason: "SMTP_REJECTED" | "SMTP_CONFIGURATION" }
  | { status: "UNKNOWN"; reason: "SMTP_OUTCOME_UNKNOWN" };
export interface ReminderTransport {
  send(message: { recipient: string; messageId: string; subject: string; text: string; html: string }): Promise<ReminderTransportOutcome>;
}
/** Only explicit SMTP rejection or connection establishment failure proves non-acceptance. */
export function classifyReminderTransportError(error: unknown): ReminderTransportOutcome {
  if (typeof error !== "object" || error === null) return { status: "UNKNOWN", reason: "SMTP_OUTCOME_UNKNOWN" };
  const e = error as { code?: unknown; command?: unknown; responseCode?: unknown };
  if (e.command === "CONN" && ["ECONNECTION", "EDNS", "ECONNREFUSED"].includes(String(e.code))) return { status: "SAFE_RETRY", reason: "SMTP_CONNECT_FAILED" };
  if (e.code === "EAUTH" && e.command === "AUTH") return { status: "FAILED", reason: "SMTP_CONFIGURATION" };
  if (typeof e.responseCode === "number" && ["MAIL FROM", "RCPT TO", "DATA"].includes(String(e.command))) {
    if (e.responseCode >= 400 && e.responseCode < 500) return { status: "SAFE_RETRY", reason: "SMTP_REJECTED_TEMPORARY" };
    if (e.responseCode >= 500 && e.responseCode < 600) return { status: "FAILED", reason: "SMTP_REJECTED" };
  }
  return { status: "UNKNOWN", reason: "SMTP_OUTCOME_UNKNOWN" };
}
export function createReminderTransport(config: SmtpConfig): ReminderTransport {
  const options: SMTPTransport.Options = { host: config.host, port: config.port, secure: config.secure, auth: { user: config.username, pass: config.password }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000 };
  const transport = nodemailer.createTransport(options);
  return { async send(message) {
    try {
      const result = await transport.sendMail({ from: config.from, replyTo: config.replyTo, to: message.recipient, messageId: message.messageId, subject: message.subject, text: message.text, html: message.html });
      return result.accepted.map(value => typeof value === "string" ? value.toLowerCase() : value.address.toLowerCase()).includes(message.recipient) ? { status: "ACCEPTED" } : { status: "UNKNOWN", reason: "SMTP_OUTCOME_UNKNOWN" };
    } catch (error) { return classifyReminderTransportError(error); }
  } };
}
