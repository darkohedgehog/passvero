export type AuthEmailLocale = "hr" | "en";

export type AuthEmailMessage =
  | {
    readonly type: "VERIFY_EMAIL";
    readonly recipient: string;
    readonly locale?: AuthEmailLocale;
    readonly verificationUrl: string;
  }
  | {
    readonly type: "PASSWORD_RESET";
    readonly recipient: string;
    readonly locale?: AuthEmailLocale;
    readonly resetUrl: string;
  }
  | {
    readonly type: "PASSWORD_CHANGED";
    readonly recipient: string;
    readonly locale?: AuthEmailLocale;
  };

export interface AuthEmailSender {
  send(message: AuthEmailMessage): Promise<{ readonly status: "SENT" }>;
}
