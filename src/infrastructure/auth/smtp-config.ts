export type SmtpConfigErrorCode =
  | "HOST_INVALID"
  | "PORT_INVALID"
  | "SECURE_INVALID"
  | "USERNAME_INVALID"
  | "PASSWORD_INVALID"
  | "FROM_INVALID"
  | "REPLY_TO_INVALID";

const messages: Record<SmtpConfigErrorCode, string> = {
  HOST_INVALID: "SMTP host configuration is invalid.",
  PORT_INVALID: "SMTP port configuration is invalid.",
  SECURE_INVALID: "SMTP secure-mode configuration is invalid.",
  USERNAME_INVALID: "SMTP username configuration is invalid.",
  PASSWORD_INVALID: "SMTP password configuration is invalid.",
  FROM_INVALID: "Authentication email sender configuration is invalid.",
  REPLY_TO_INVALID: "Authentication email reply-to configuration is invalid.",
};

export class SmtpConfigError extends Error {
  constructor(readonly code: SmtpConfigErrorCode) {
    super(messages[code]);
    this.name = "SmtpConfigError";
  }
}

export interface SmtpConfig {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly username: string;
  readonly password: string;
  readonly from: string;
  readonly replyTo: string;
}

export function validateSmtpConfig(
  input: Readonly<Record<string, unknown>>,
): SmtpConfig {
  const host = requiredUnpaddedString(input.SMTP_HOST, "HOST_INVALID");
  const port = parsePort(input.SMTP_PORT);
  const secure = parseSecure(input.SMTP_SECURE);
  const username = requiredUnpaddedString(
    input.SMTP_USER,
    "USERNAME_INVALID",
  );
  const password = requiredUnpaddedString(
    input.SMTP_PASSWORD,
    "PASSWORD_INVALID",
  );
  const from = parseEmail(input.AUTH_EMAIL_FROM, "FROM_INVALID");
  const replyTo = parseEmail(input.AUTH_EMAIL_REPLY_TO, "REPLY_TO_INVALID");

  return { host, port, secure, username, password, from, replyTo };
}

function requiredUnpaddedString(
  value: unknown,
  code: SmtpConfigErrorCode,
): string {
  if (
    typeof value !== "string"
    || value.length === 0
    || value !== value.trim()
  ) {
    throw new SmtpConfigError(code);
  }
  return value;
}

function parsePort(value: unknown): number {
  if (typeof value !== "string" || !/^[0-9]+$/.test(value)) {
    throw new SmtpConfigError("PORT_INVALID");
  }
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new SmtpConfigError("PORT_INVALID");
  }
  return port;
}

function parseSecure(value: unknown): boolean {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new SmtpConfigError("SECURE_INVALID");
}

function parseEmail(
  value: unknown,
  code: SmtpConfigErrorCode,
): string {
  const email = requiredUnpaddedString(value, code);
  if (
    email.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new SmtpConfigError(code);
  }
  return email;
}
