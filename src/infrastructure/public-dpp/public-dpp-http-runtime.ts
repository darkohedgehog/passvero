import "server-only";

import { createGetPublicDppService } from "@/src/application/public-dpp/get-public-dpp";
import { createPublicDppHttpHandler } from "@/src/application/public-dpp/http";
import { getPublicDppLabels } from "@/src/components/public-dpp/public-dpp-labels";
import { PrismaPublicDppPersistence } from "@/src/infrastructure/persistence/prisma/prisma-public-dpp";
import { getProductionPrismaClient } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";
import { SITE_URL } from "@/src/lib/site";

type Handler = ReturnType<typeof createPublicDppHttpHandler>;
const state = globalThis as typeof globalThis & { __passveroPublicDppHandler?: Handler };

export function getPublicDppHttpHandler(): Handler {
  state.__passveroPublicDppHandler ??= createPublicDppHttpHandler({
    canonicalOrigin: SITE_URL,
    getLabels: getPublicDppLabels,
    getPublicDpp: createGetPublicDppService({
      persistence: new PrismaPublicDppPersistence(getProductionPrismaClient()),
    }),
  });
  return state.__passveroPublicDppHandler;
}
