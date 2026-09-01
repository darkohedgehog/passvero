import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "@/src/generated/prisma/client";
import { createPrismaCreateProductDependencies } from "@/src/infrastructure/persistence/prisma/prisma-create-product-composition";
import { createPrismaEditProductDraftDependencies } from "@/src/infrastructure/persistence/prisma/prisma-edit-product-draft-composition";
import { createPrismaDraftTranslationContentDependencies } from "@/src/infrastructure/persistence/prisma/prisma-draft-translation-content-composition";
import { createPrismaGetProductDetailDependencies } from "@/src/infrastructure/persistence/prisma/prisma-get-product-detail-composition";
import { createPrismaListProductsDependencies } from "@/src/infrastructure/persistence/prisma/prisma-list-products-composition";
import { validateProductionDatabaseUrl } from "@/src/infrastructure/persistence/prisma/production-prisma-config";
import {
  createProductionPrismaRuntime,
  createProductionPrismaRuntimeLifecycle,
  type ProductionPrismaRuntimeLifecycle,
} from "@/src/infrastructure/persistence/prisma/production-prisma-runtime-core";

type ProductionLifecycle = ProductionPrismaRuntimeLifecycle<Pool, PrismaPg, PrismaClient>;

const runtimeGlobal = globalThis as typeof globalThis & {
  __passveroProductionPrismaLifecycle?: ProductionLifecycle;
};

function createLifecycle(): ProductionLifecycle {
  const config = validateProductionDatabaseUrl(process.env.DATABASE_URL);
  return createProductionPrismaRuntimeLifecycle(() =>
    createProductionPrismaRuntime(config.connectionString, {
      createPool: (poolConfig) => new Pool(poolConfig),
      createAdapter: (pool) => new PrismaPg(pool, { disposeExternalPool: true }),
      createClient: (adapter) => new PrismaClient({ adapter }),
    }),
  );
}

function getLifecycle(): ProductionLifecycle {
  runtimeGlobal.__passveroProductionPrismaLifecycle ??= createLifecycle();
  return runtimeGlobal.__passveroProductionPrismaLifecycle;
}

export function getProductionPrismaClient(): PrismaClient {
  return getLifecycle().getRuntime().client;
}

export function getProductionCreateProductDependencies() {
  return createPrismaCreateProductDependencies(getProductionPrismaClient());
}

export function getProductionEditProductDraftDependencies() {
  return createPrismaEditProductDraftDependencies(getProductionPrismaClient());
}

export function getProductionDraftTranslationContentDependencies() {
  return createPrismaDraftTranslationContentDependencies(getProductionPrismaClient());
}

export function getProductionListProductsDependencies() {
  return createPrismaListProductsDependencies(getProductionPrismaClient());
}

export function getProductionGetProductDetailDependencies() {
  return createPrismaGetProductDetailDependencies(getProductionPrismaClient());
}

export async function disconnectProductionPrisma(): Promise<void> {
  await runtimeGlobal.__passveroProductionPrismaLifecycle?.disconnect();
}
