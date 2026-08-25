import type { AuthEmailSender } from "@/src/application/auth/auth-email";

interface BetterAuthLifecycleApi {
  signUpEmail(input: {
    readonly body: {
      readonly email: string;
      readonly name: string;
      readonly password: string;
      readonly callbackURL: string;
      readonly rememberMe: false;
    };
  }): Promise<{
    readonly token?: string | null;
    readonly user: {
      readonly id: string;
      readonly email: string;
      readonly emailVerified: boolean;
    };
  }>;
  sendVerificationEmail(input: {
    readonly body: {
      readonly email: string;
      readonly callbackURL: string;
    };
  }): Promise<unknown>;
  requestPasswordReset(input: {
    readonly body: {
      readonly email: string;
      readonly redirectTo: string;
    };
  }): Promise<unknown>;
  resetPassword(input: {
    readonly body: {
      readonly token: string;
      readonly newPassword: string;
    };
  }): Promise<unknown>;
  changePassword(input: {
    readonly headers: Headers;
    readonly body: {
      readonly currentPassword: string;
      readonly newPassword: string;
      readonly revokeOtherSessions: false;
    };
  }): Promise<unknown>;
  revokeSessions(input: {
    readonly headers: Headers;
  }): Promise<unknown>;
}

export interface BetterAuthLifecycleAdapter {
  createCredential(input: {
    readonly email: string;
    readonly displayName: string;
    readonly password: string;
  }): Promise<{
    readonly providerSubject: string;
    readonly normalizedEmail: string;
    readonly emailVerified: boolean;
  }>;
  requestEmailVerification(email: string): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  completePasswordReset(token: string, newPassword: string): Promise<void>;
  changePassword(input: {
    readonly headers: Headers;
    readonly currentPassword: string;
    readonly newPassword: string;
  }): Promise<{
    readonly sessionStatus: "REVOKED" | "RECONCILIATION_REQUIRED";
  }>;
}

export function createBetterAuthLifecycleAdapter(
  api: BetterAuthLifecycleApi,
  canonicalOrigin: string,
): BetterAuthLifecycleAdapter {
  const verificationCallback = `${canonicalOrigin}/auth/verify-email`;
  const resetCallback = `${canonicalOrigin}/auth/reset-password`;

  return {
    async createCredential(input) {
      const response = await api.signUpEmail({
        body: {
          email: input.email,
          name: input.displayName,
          password: input.password,
          callbackURL: verificationCallback,
          rememberMe: false,
        },
      });
      return {
        providerSubject: response.user.id,
        normalizedEmail: response.user.email,
        emailVerified: response.user.emailVerified,
      };
    },
    async requestEmailVerification(email) {
      await api.sendVerificationEmail({
        body: { email, callbackURL: verificationCallback },
      });
    },
    async requestPasswordReset(email) {
      await api.requestPasswordReset({
        body: { email, redirectTo: resetCallback },
      });
    },
    async completePasswordReset(token, newPassword) {
      await api.resetPassword({ body: { token, newPassword } });
    },
    async changePassword(input) {
      await api.changePassword({
        headers: input.headers,
        body: {
          currentPassword: input.currentPassword,
          newPassword: input.newPassword,
          revokeOtherSessions: false,
        },
      });
      try {
        await api.revokeSessions({ headers: input.headers });
        return { sessionStatus: "REVOKED" };
      } catch {
        return { sessionStatus: "RECONCILIATION_REQUIRED" };
      }
    },
  };
}

export function createBetterAuthLifecycleCallbacks(
  emailSender: AuthEmailSender,
  hooks: {
    readonly onEmailVerified?: (input: {
      readonly providerSubject: string;
      readonly email: string;
    }) => Promise<void>;
    readonly onPasswordReset?: (input: {
      readonly providerSubject: string;
      readonly email: string;
    }) => Promise<void>;
  } = {},
) {
  return {
    async sendVerificationEmail(data: {
      readonly user: { readonly email: string };
      readonly url: string;
    }): Promise<void> {
      await emailSender.send({
        type: "VERIFY_EMAIL",
        recipient: data.user.email,
        verificationUrl: data.url,
      });
    },
    async afterEmailVerification(user: {
      readonly id: string;
      readonly email: string;
    }): Promise<void> {
      await hooks.onEmailVerified?.({
        providerSubject: user.id,
        email: user.email,
      });
    },
    async sendResetPassword(data: {
      readonly user: { readonly email: string };
      readonly url: string;
    }): Promise<void> {
      await emailSender.send({
        type: "PASSWORD_RESET",
        recipient: data.user.email,
        resetUrl: data.url,
      });
    },
    async onPasswordReset(data: {
      readonly user: { readonly id: string; readonly email: string };
    }): Promise<void> {
      await hooks.onPasswordReset?.({
        providerSubject: data.user.id,
        email: data.user.email,
      });
    },
  };
}
