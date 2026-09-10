import { createGetPublicDppService } from "@/src/application/public-dpp/get-public-dpp";
import { PrismaPublicDppPersistence } from "@/src/infrastructure/persistence/prisma/prisma-public-dpp";
import type { PrismaClient } from "@/src/generated/prisma/client";
import { PrismaGetProductDetailPersistence } from "@/src/infrastructure/persistence/prisma/prisma-get-product-detail";

export function createPrismaGetProductDetailDependencies(prisma: PrismaClient, canonicalOrigin: string) {
  return {
    canonicalOrigin,
    getPublicDpp: createGetPublicDppService({ persistence: new PrismaPublicDppPersistence(prisma) }),
    persistence: new PrismaGetProductDetailPersistence(prisma),
  };
}
