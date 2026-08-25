import type { AuthEmailSender } from "@/src/application/auth/auth-email";
import {
  evaluatePasswordPolicy,
  type PasswordPolicyRejectionReason,
} from "@/src/application/auth/password-policy";

interface PasswordChangeActor {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly headers: Headers;
}

interface PasswordChangeProvider {
  changePassword(input: {
    readonly headers: Headers;
    readonly currentPassword: string;
    readonly newPassword: string;
  }): Promise<{
    readonly sessionStatus: "REVOKED" | "RECONCILIATION_REQUIRED";
  }>;
}

type PasswordChangeResult =
  | { readonly status: "DENIED" }
  | {
    readonly status: "PASSWORD_REJECTED";
    readonly reason: PasswordPolicyRejectionReason;
  }
  | {
    readonly status: "PASSWORD_CHANGED";
    readonly sessionStatus: "REVOKED" | "RECONCILIATION_REQUIRED";
    readonly notificationStatus: "SENT" | "RETRY_REQUIRED";
  };

export function createAuthenticatedPasswordChangeService(dependencies: {
  readonly provider: PasswordChangeProvider;
  readonly emailSender: AuthEmailSender;
}) {
  return async function changePassword(
    actor: PasswordChangeActor,
    input: {
      readonly currentPassword: unknown;
      readonly newPassword: unknown;
    },
  ): Promise<PasswordChangeResult> {
    if (
      typeof input.currentPassword !== "string"
      || input.currentPassword.length === 0
    ) {
      return { status: "DENIED" };
    }

    const policy = await evaluatePasswordPolicy({
      password: input.newPassword,
      normalizedEmail: actor.email,
      displayName: actor.displayName,
    });
    if (!policy.accepted) {
      return { status: "PASSWORD_REJECTED", reason: policy.reason };
    }
    if (typeof input.newPassword !== "string") {
      return { status: "DENIED" };
    }

    let sessionStatus: "REVOKED" | "RECONCILIATION_REQUIRED";
    try {
      ({ sessionStatus } = await dependencies.provider.changePassword({
        headers: actor.headers,
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
      }));
    } catch {
      return { status: "DENIED" };
    }

    let notificationStatus: "SENT" | "RETRY_REQUIRED" = "SENT";
    try {
      await dependencies.emailSender.send({
        type: "PASSWORD_CHANGED",
        recipient: actor.email,
      });
    } catch {
      notificationStatus = "RETRY_REQUIRED";
    }

    return {
      status: "PASSWORD_CHANGED",
      sessionStatus,
      notificationStatus,
    };
  };
}
