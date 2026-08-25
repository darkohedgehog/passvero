import type { AuthAbuseDecision } from "./auth-abuse-policy";
import type { AuthAbuseEndpoint } from "./auth-abuse-types";

const actions: Readonly<Record<AuthAbuseEndpoint, string>> = {
  SIGN_IN: "auth_sign_in",
  ACTIVATE_ACCOUNT: "auth_activate_account",
  EMAIL_VERIFICATION_REQUEST: "auth_email_verification_request",
  EMAIL_VERIFICATION_CONSUME: "auth_email_verification_consume",
  PASSWORD_RESET_REQUEST: "auth_password_reset_request",
  PASSWORD_RESET_CONSUME: "auth_password_reset_consume",
  PASSWORD_CHANGE: "auth_password_change",
};

export interface TurnstileVerifier {
  verify(input: {
    readonly token: string;
    readonly expectedAction: string;
    readonly trustedClientAddress?: string;
  }): Promise<Readonly<{
    valid: boolean;
    action?: string;
  }>>;
}

export type TurnstileCompletionResult =
  | Readonly<{ status: "PROCEED" }>
  | Readonly<{ status: "DENIED" }>
  | Readonly<{ status: "OPERATIONAL_FAILURE" }>;

export async function completeRiskTriggeredTurnstile(input: {
  readonly decision: AuthAbuseDecision;
  readonly endpoint: AuthAbuseEndpoint;
  readonly token?: string;
  readonly trustedClientAddress?: string;
  readonly verifier: TurnstileVerifier;
}): Promise<TurnstileCompletionResult> {
  if (input.decision.status === "ALLOW") {
    return { status: "PROCEED" };
  }
  if (input.decision.status === "BLOCK") {
    return { status: "DENIED" };
  }
  if (input.token === undefined || input.token.length === 0) {
    return { status: "DENIED" };
  }

  const expectedAction = actions[input.endpoint];
  try {
    const result = await input.verifier.verify({
      token: input.token,
      expectedAction,
      trustedClientAddress: input.trustedClientAddress,
    });
    if (!result.valid || result.action !== expectedAction) {
      return { status: "DENIED" };
    }
    return { status: "PROCEED" };
  } catch {
    return { status: "OPERATIONAL_FAILURE" };
  }
}
