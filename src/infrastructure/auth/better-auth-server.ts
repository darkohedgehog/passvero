import "server-only";

import { prismaAdapter } from "@better-auth/prisma-adapter";
import { PrismaPg } from "@prisma/adapter-pg";
import { betterAuth } from "better-auth";
import { Pool } from "pg";

import { PrismaClient } from "@/src/generated/prisma/client";
import { validateAuthDatabaseUrl } from "@/src/infrastructure/auth/auth-database-config";
import { createLazyAuthEmailSender } from "@/src/infrastructure/auth/auth-email-runtime";
import {
  createBetterAuthLifecycleAdapter,
  createBetterAuthLifecycleCallbacks,
  type BetterAuthLifecycleAdapter,
} from "@/src/infrastructure/auth/better-auth-lifecycle-adapter";
import { betterAuthPasswordCallbacks } from "@/src/infrastructure/auth/better-auth-password";
import {
  createControlledActivationBetterAuthServerOptions,
  createBetterAuthServerOptions,
  validateBetterAuthServerConfig,
} from "@/src/infrastructure/auth/better-auth-server-config";
import {
  createProductionPrismaRuntime,
  createProductionPrismaRuntimeLifecycle,
  type ProductionPrismaRuntimeLifecycle,
} from "@/src/infrastructure/persistence/prisma/production-prisma-runtime-core";

type AuthPrismaLifecycle = ProductionPrismaRuntimeLifecycle<
  Pool,
  PrismaPg,
  PrismaClient
>;
type BetterAuthServer = ReturnType<typeof betterAuth>;
type BetterAuthEmailVerifiedHandler = (input: {
  readonly providerSubject: string;
  readonly email: string;
}) => Promise<void>;

const runtimeGlobal = globalThis as typeof globalThis & {
  __passveroAuthPrismaLifecycle?: AuthPrismaLifecycle;
  __passveroBetterAuthServer?: BetterAuthServer;
  __passveroControlledActivationBetterAuthServer?: BetterAuthServer;
  __passveroBetterAuthLifecycleAdapter?: BetterAuthLifecycleAdapter;
  __passveroBetterAuthEmailVerifiedHandler?: BetterAuthEmailVerifiedHandler;
};

function createLifecycleCallbacks(baseURL: string) {
  return createBetterAuthLifecycleCallbacks(
    createLazyAuthEmailSender(baseURL),
    baseURL,
    {
      async onEmailVerified(input) {
        const handler = runtimeGlobal.__passveroBetterAuthEmailVerifiedHandler;
        if (handler === undefined) {
          throw new Error("Verified email completion is unavailable.");
        }
        await handler(input);
      },
    },
  );
}

function createAuthPrismaLifecycle(): AuthPrismaLifecycle {
  const config = validateAuthDatabaseUrl(process.env.AUTH_DATABASE_URL);
  return createProductionPrismaRuntimeLifecycle(() =>
    createProductionPrismaRuntime(config.connectionString, {
      createPool: (poolConfig) => new Pool(poolConfig),
      createAdapter: (pool) => new PrismaPg(pool, { disposeExternalPool: true }),
      createClient: (adapter) => new PrismaClient({ adapter }),
    }),
  );
}

function getAuthPrismaLifecycle(): AuthPrismaLifecycle {
  runtimeGlobal.__passveroAuthPrismaLifecycle ??= createAuthPrismaLifecycle();
  return runtimeGlobal.__passveroAuthPrismaLifecycle;
}

function createBetterAuthServer(): BetterAuthServer {
  const config = validateBetterAuthServerConfig({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
  });
  const prisma = getAuthPrismaLifecycle().getRuntime().client;
  const database = prismaAdapter(prisma, { provider: "postgresql" });
  const lifecycle = createLifecycleCallbacks(config.baseURL);

  return betterAuth(
    createBetterAuthServerOptions(
      config,
      database,
      betterAuthPasswordCallbacks,
      lifecycle,
    ),
  );
}

function getControlledActivationBetterAuthServer(): BetterAuthServer {
  runtimeGlobal.__passveroControlledActivationBetterAuthServer ??= (() => {
    const config = validateBetterAuthServerConfig({
      secret: process.env.BETTER_AUTH_SECRET,
      baseURL: process.env.BETTER_AUTH_URL,
    });
    const prisma = getAuthPrismaLifecycle().getRuntime().client;
    const database = prismaAdapter(prisma, { provider: "postgresql" });
    const lifecycle = createLifecycleCallbacks(config.baseURL);
    return betterAuth(createControlledActivationBetterAuthServerOptions(
      config,
      database,
      betterAuthPasswordCallbacks,
      lifecycle,
    ));
  })();
  return runtimeGlobal.__passveroControlledActivationBetterAuthServer;
}

export function getBetterAuthServer(): BetterAuthServer {
  runtimeGlobal.__passveroBetterAuthServer ??= createBetterAuthServer();
  return runtimeGlobal.__passveroBetterAuthServer;
}

export function getBetterAuthLifecycleProvider(
  onEmailVerified: BetterAuthEmailVerifiedHandler,
): BetterAuthLifecycleAdapter {
  runtimeGlobal.__passveroBetterAuthEmailVerifiedHandler = onEmailVerified;
  runtimeGlobal.__passveroBetterAuthLifecycleAdapter ??= (() => {
    const config = validateBetterAuthServerConfig({
      secret: process.env.BETTER_AUTH_SECRET,
      baseURL: process.env.BETTER_AUTH_URL,
    });
    const auth = getBetterAuthServer();
    const controlled = getControlledActivationBetterAuthServer();
    return createBetterAuthLifecycleAdapter({
      signUpEmail: (input) => controlled.api.signUpEmail(input),
      sendVerificationEmail: (input) => auth.api.sendVerificationEmail(input),
      requestPasswordReset: (input) => auth.api.requestPasswordReset(input),
      resetPassword: (input) => auth.api.resetPassword(input),
      changePassword: (input) => auth.api.changePassword(input),
      revokeSessions: (input) => auth.api.revokeSessions(input),
    }, config.baseURL);
  })();
  return runtimeGlobal.__passveroBetterAuthLifecycleAdapter;
}

export async function disconnectBetterAuthServer(): Promise<void> {
  await runtimeGlobal.__passveroAuthPrismaLifecycle?.disconnect();
  runtimeGlobal.__passveroBetterAuthServer = undefined;
  runtimeGlobal.__passveroControlledActivationBetterAuthServer = undefined;
  runtimeGlobal.__passveroBetterAuthLifecycleAdapter = undefined;
  runtimeGlobal.__passveroBetterAuthEmailVerifiedHandler = undefined;
}
