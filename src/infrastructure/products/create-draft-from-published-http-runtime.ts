import "server-only";
import { createCreateDraftHttpHandler } from "@/src/application/products/create-draft-from-published/http";
import { createDraftFromPublishedService } from "@/src/application/products/create-draft-from-published/service";
import { getCanonicalAppOrigin } from "@/src/infrastructure/config/canonical-app-origin";
import { resolveAuthenticatedUserContext } from "@/src/infrastructure/context/organization-context-runtime";
import { verifyRuntimeProxy } from "@/src/infrastructure/http/trusted-proxy-runtime";
import { getProductionPrismaClient } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";
import { createPrismaCreateDraftFromPublishedDependencies } from "@/src/infrastructure/persistence/prisma/prisma-create-draft-from-published";

export function getCreateDraftFromPublishedHttpHandler() {
  return createCreateDraftHttpHandler({
    canonicalOrigin: getCanonicalAppOrigin(), verifyProxy: verifyRuntimeProxy, resolveContext: resolveAuthenticatedUserContext,
    createDraft: createDraftFromPublishedService(createPrismaCreateDraftFromPublishedDependencies(getProductionPrismaClient())),
  });
}
