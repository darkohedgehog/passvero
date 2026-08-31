import type { PrismaClient } from "@/src/generated/prisma/client";
import { PrismaGetProductDetailPersistence } from "@/src/infrastructure/persistence/prisma/prisma-get-product-detail";

export function createPrismaGetProductDetailDependencies(prisma: PrismaClient) {
  return {
    persistence: new PrismaGetProductDetailPersistence(prisma),
  };
}
