import "server-only";
import { getPublicDocumentService, publicDocumentDeliveryEnabled } from "./public-document-runtime";

import { createGetPublicDppService } from "@/src/application/public-dpp/get-public-dpp";
import { createPublicDppHttpHandler } from "@/src/application/public-dpp/http";
import { getPublicDppLabels } from "@/src/components/public-dpp/public-dpp-labels";
import { PrismaPublicDppPersistence } from "@/src/infrastructure/persistence/prisma/prisma-public-dpp";
import { getProductionPrismaClient } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";
import { getCanonicalAppOrigin } from "@/src/infrastructure/config/canonical-app-origin";

type Handler = ReturnType<typeof createPublicDppHttpHandler>;
const state = globalThis as typeof globalThis & { __passveroPublicDppHandler?: Handler };

export function getPublicDppHttpHandler(): Handler {
  state.__passveroPublicDppHandler ??= createPublicDppHttpHandler({
    canonicalOrigin: getCanonicalAppOrigin(),
    getLabels: getPublicDppLabels,
    getPublicDpp: createGetPublicDppService({
      persistence: new PrismaPublicDppPersistence(getProductionPrismaClient()),
      documents: { async list(code, version) {
        try { return publicDocumentDeliveryEnabled() ? await getPublicDocumentService().list(code, version) : []; }
        catch { return []; }
      } },
    }),
  });
  return state.__passveroPublicDppHandler;
}
