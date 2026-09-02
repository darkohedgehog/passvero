import type { PrismaClient } from "@/src/generated/prisma/client";
import { PrismaPublishProductPersistence, PrismaPublishProductTransactionRunner } from "@/src/infrastructure/persistence/prisma/prisma-publish-product";

export function createPrismaPublishProductDependencies(prisma: PrismaClient) {
  return { transactionRunner: new PrismaPublishProductTransactionRunner(prisma), persistence: new PrismaPublishProductPersistence(prisma) };
}
