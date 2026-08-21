import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { createAuthEndpoint } from "better-auth/api";
import { createLocalAccountIssuer } from "@better-auth/core/db";
import * as z from "zod";
import { readAuthSecret, readRunIdentity } from "./run-root.js";

export const H4_CONTROLLED_ACTIVATION_RUNTIME_VERDICT = "NOT_EXECUTED" as const;

export const CONTROLLED_ACTIVATION_FAILURE_POINTS = [
  "NONE",
  "AFTER_PROVIDER_CREDENTIAL_CREATION",
  "AFTER_AUTH_IDENTITY_CREATION",
] as const;

export const ACTIVATION_MATRIX = [
  "VALID_SINGLE_USE",
  "EXPIRED_TOKEN",
  "SUPERSEDED_TOKEN",
  "WRONG_CANONICAL_EMAIL_DIGEST",
  "EXISTING_PROVIDER_EMAIL",
  "EXISTING_PROVIDER_SUBJECT",
  "EXISTING_AUTH_IDENTITY",
  "TWO_CONCURRENT_CONSUMERS",
  "FAIL_AFTER_PROVIDER_CREDENTIAL_CREATION",
  "FAIL_AFTER_AUTH_IDENTITY_CREATION",
] as const;

export const activationSchema = z.object({
  credential: z.string().min(8),
  email: z.email(),
  name: z.string().min(1),
  providerSubject: z.string().min(1),
}).strict();

export function controlledActivationPlugin() {
  return {
    id: "passvero-controlled-activation-proof",
    endpoints: {
      activatePreprovisionedCredential: createAuthEndpoint.serverOnly({
        method: "POST",
        body: activationSchema
      }, async (ctx) => {
        if (ctx.context.options.emailAndPassword?.disableSignUp !== true) {
          throw new Error("STOP_H4_CONTROLLED_AUTH_MUST_DISABLE_SIGNUP");
        }
        const email = ctx.body.email.toLowerCase();
        const passwordHash = await ctx.context.password.hash(ctx.body.credential);
        const user = await ctx.context.internalAdapter.createUser({
          id: ctx.body.providerSubject,
          email,
          emailVerified: false,
          name: ctx.body.name,
        }, { method: "email-password" });
        const account = await ctx.context.internalAdapter.linkAccount({
          userId: user.id,
          providerId: "credential",
          issuer: createLocalAccountIssuer("credential"),
          accountId: user.id,
          password: passwordHash,
        });
        return {
          user: { id: user.id, email: user.email, emailVerified: user.emailVerified },
          account: { id: account.id, providerId: account.providerId, accountId: account.accountId },
        };
      }),
    },
  } as const;
}

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
    plugins: [controlledActivationPlugin()],
    disabledPaths: [...DISABLED_NATIVE_PATHS],
    telemetry: { enabled: false },
  });
}

export type ProofAuth = ReturnType<typeof createProofAuth>;

export function createControlledActivationAuth(prisma: CreateProofAuthInput["prisma"]) {
  return createProofAuth({ prisma, adapterTransaction: false, disableSignUp: true });
}

export type ControlledActivationApi = ReturnType<typeof createControlledActivationAuth>["api"];
