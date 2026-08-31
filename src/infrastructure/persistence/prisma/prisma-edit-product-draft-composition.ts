import type { PrismaClient } from "@/src/generated/prisma/client";
import {
  PrismaEditProductDraftPersistence,
  PrismaEditProductDraftTransactionRunner,
} from "@/src/infrastructure/persistence/prisma/prisma-edit-product-draft";

export function createPrismaEditProductDraftDependencies(prisma: PrismaClient) {
  return {
    transactionRunner: new PrismaEditProductDraftTransactionRunner(prisma),
    persistence: new PrismaEditProductDraftPersistence(prisma),
  };
}
