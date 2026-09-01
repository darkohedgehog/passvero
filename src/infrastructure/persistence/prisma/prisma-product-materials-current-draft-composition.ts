import type { PrismaClient } from "@/src/generated/prisma/client";
import {
  PrismaProductMaterialsCurrentDraftPersistence,
  PrismaProductMaterialsCurrentDraftTransactionRunner,
} from "@/src/infrastructure/persistence/prisma/prisma-product-materials-current-draft";

export function createPrismaProductMaterialsCurrentDraftDependencies(prisma: PrismaClient) {
  return {
    transactionRunner: new PrismaProductMaterialsCurrentDraftTransactionRunner(prisma),
    persistence: new PrismaProductMaterialsCurrentDraftPersistence(prisma),
  };
}
