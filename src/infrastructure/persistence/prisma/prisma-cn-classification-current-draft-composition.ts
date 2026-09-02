import type { PrismaClient } from "@/src/generated/prisma/client";
import { PrismaCnClassificationCurrentDraftPersistence, PrismaCnClassificationCurrentDraftTransactionRunner } from "@/src/infrastructure/persistence/prisma/prisma-cn-classification-current-draft";

export function createPrismaCnClassificationCurrentDraftDependencies(prisma: PrismaClient) {
  return {
    currentUtcYear: () => new Date().getUTCFullYear(),
    transactionRunner: new PrismaCnClassificationCurrentDraftTransactionRunner(prisma),
    persistence: new PrismaCnClassificationCurrentDraftPersistence(prisma),
  };
}
