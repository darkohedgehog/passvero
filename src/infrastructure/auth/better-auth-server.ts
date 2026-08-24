import "server-only";

import { prismaAdapter } from "@better-auth/prisma-adapter";
import { PrismaPg } from "@prisma/adapter-pg";
import { betterAuth } from "better-auth";
import { Pool } from "pg";

import { PrismaClient } from "@/src/generated/prisma/client";
import { validateAuthDatabaseUrl } from "@/src/infrastructure/auth/auth-database-config";
import { betterAuthPasswordCallbacks } from "@/src/infrastructure/auth/better-auth-password";
import {
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

const runtimeGlobal = globalThis as typeof globalThis & {
  __passveroAuthPrismaLifecycle?: AuthPrismaLifecycle;
  __passveroBetterAuthServer?: BetterAuthServer;
};

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

  return betterAuth(
    createBetterAuthServerOptions(config, database, betterAuthPasswordCallbacks),
  );
}

export function getBetterAuthServer(): BetterAuthServer {
  runtimeGlobal.__passveroBetterAuthServer ??= createBetterAuthServer();
  return runtimeGlobal.__passveroBetterAuthServer;
}

export async function disconnectBetterAuthServer(): Promise<void> {
  await runtimeGlobal.__passveroAuthPrismaLifecycle?.disconnect();
  runtimeGlobal.__passveroBetterAuthServer = undefined;
}
