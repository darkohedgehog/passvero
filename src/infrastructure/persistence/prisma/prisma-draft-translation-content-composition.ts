import type { PrismaClient } from "@/src/generated/prisma/client";
import { PrismaDraftTranslationContentPersistence, PrismaDraftTranslationContentTransactionRunner } from "@/src/infrastructure/persistence/prisma/prisma-draft-translation-content";

export function createPrismaDraftTranslationContentDependencies(prisma: PrismaClient) {
  return { transactionRunner: new PrismaDraftTranslationContentTransactionRunner(prisma), persistence: new PrismaDraftTranslationContentPersistence(prisma) };
}
