export type AuthEmailLocale = "hr" | "en" | "de" | "sr" | "sl" | "pl";

export type AuthEmailMessage =
  | { readonly type: "ACCESS_REQUEST_ADMIN"; readonly recipient: string; readonly locale?: AuthEmailLocale; readonly requestId: string; readonly reviewUrl: string; }
  | { readonly type: "CONTROLLED_ACTIVATION"; readonly recipient: string; readonly locale?: AuthEmailLocale; readonly activationUrl: string; }
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
