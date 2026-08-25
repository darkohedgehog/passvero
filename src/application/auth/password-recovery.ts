import {
  evaluatePasswordPolicy,
  type PasswordPolicyRejectionReason,
} from "@/src/application/auth/password-policy";

interface PasswordRecoveryProvider {
  requestPasswordReset(email: string): Promise<void>;
  completePasswordReset(token: string, newPassword: string): Promise<void>;
}

export function createPasswordRecoveryService(dependencies: {
  readonly provider: PasswordRecoveryProvider;
}) {
  return {
    async request(email: string): Promise<
      | { readonly status: "REQUEST_ACCEPTED" }
      | { readonly status: "DELIVERY_RETRY_REQUIRED" }
    > {
      try {
        await dependencies.provider.requestPasswordReset(email);
        return { status: "REQUEST_ACCEPTED" };
      } catch {
        return { status: "DELIVERY_RETRY_REQUIRED" };
      }
    },
    async complete(
      token: string,
      newPassword: unknown,
    ): Promise<
      | { readonly status: "PASSWORD_RESET" }
      | { readonly status: "DENIED" }
      | {
        readonly status: "PASSWORD_REJECTED";
        readonly reason: PasswordPolicyRejectionReason;
      }
    > {
      const policy = await evaluatePasswordPolicy({ password: newPassword });
      if (!policy.accepted) {
        return { status: "PASSWORD_REJECTED", reason: policy.reason };
      }
      if (typeof newPassword !== "string") {
        return { status: "DENIED" };
      }

      try {
        await dependencies.provider.completePasswordReset(token, newPassword);
        return { status: "PASSWORD_RESET" };
      } catch {
        return { status: "DENIED" };
      }
    },
  };
}
