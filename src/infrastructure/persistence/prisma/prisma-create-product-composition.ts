import type { PrismaClient } from "@/src/generated/prisma/client";
import {
  PrismaCreateProductPersistence,
  PrismaTransactionRunner,
} from "@/src/infrastructure/persistence/prisma/prisma-create-product";

export function createPrismaCreateProductDependencies(prisma: PrismaClient) {
  return {
    transactionRunner: new PrismaTransactionRunner(prisma),
    persistence: new PrismaCreateProductPersistence(),
  };
}
