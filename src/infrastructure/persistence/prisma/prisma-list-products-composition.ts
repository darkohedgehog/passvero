import type { PrismaClient } from "@/src/generated/prisma/client";
import { PrismaListProductsPersistence } from "@/src/infrastructure/persistence/prisma/prisma-list-products";

export function createPrismaListProductsDependencies(prisma: PrismaClient) {
  return {
    persistence: new PrismaListProductsPersistence(prisma),
  };
}
