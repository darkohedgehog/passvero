import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { readAuthSecret, readRunIdentity } from "./run-root.js";

export const DISABLED_NATIVE_PATHS = [
  "/account-info",
  "/callback/:id",
  "/change-email",
  "/change-password",
  "/delete-user",
  "/delete-user/callback",
  "/error",
  "/get-access-token",
  "/get-session",
  "/link-social",
  "/list-accounts",
  "/list-sessions",
  "/ok",
  "/refresh-token",
  "/request-password-reset",
  "/reset-password",
  "/reset-password/:token",
  "/revoke-other-sessions",
  "/revoke-session",
  "/revoke-sessions",
  "/send-verification-email",
  "/sign-in/email",
  "/sign-in/social",
  "/sign-out",
  "/sign-up/email",
  "/unlink-account",
  "/update-session",
  "/update-user",
  "/verify-email",
  "/verify-password",
] as const;

export interface CreateProofAuthInput {
  readonly prisma: Parameters<typeof prismaAdapter>[0];
  readonly adapterTransaction: boolean;
  readonly disableSignUp: boolean;
}

export function createProofAuth(input: CreateProofAuthInput) {
  const identity = readRunIdentity();
  const now = () => new Date();

  return betterAuth({
    appName: "Passvero transaction proof",
    baseURL: "https://auth-proof.invalid/internal-auth",
    basePath: "/internal-auth",
    secret: readAuthSecret(identity),
    database: prismaAdapter(input.prisma, {
      provider: "postgresql",
      transaction: input.adapterTransaction,
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: input.disableSignUp,
      requireEmailVerification: true,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
    },
    account: {
      accountLinking: {
        enabled: false,
        disableImplicitLinking: true,
      },
    },
    session: {
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
      additionalFields: {
        authenticatedAt: { type: "date", required: true, input: false },
        lastRefreshAt: { type: "date", required: true, input: false },
        selectedOrganizationId: { type: "string", required: false, input: false },
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const authenticatedAt = now();
            return {
              data: {
                ...session,
                authenticatedAt,
                lastRefreshAt: authenticatedAt,
                selectedOrganizationId: null,
              },
            };
          },
        },
      },
    },
    advanced: {
      useSecureCookies: true,
      defaultCookieAttributes: {
        secure: true,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      },
    },
    disabledPaths: [...DISABLED_NATIVE_PATHS],
    telemetry: { enabled: false },
  });
}

export type ProofAuth = ReturnType<typeof createProofAuth>;
