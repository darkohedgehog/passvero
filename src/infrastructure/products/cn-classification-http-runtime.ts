import "server-only";

import { createCnClassificationHttpHandler } from "@/src/application/products/cn-classification-current-draft/http";
import { createCnClassificationCurrentDraftServices } from "@/src/application/products/cn-classification-current-draft/services";
import { validateBetterAuthServerConfig } from "@/src/infrastructure/auth/better-auth-server-config";
import { resolveAuthenticatedUserContext } from "@/src/infrastructure/context/organization-context-runtime";
import { getProductionCnClassificationCurrentDraftDependencies } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";

type Handler = ReturnType<typeof createCnClassificationHttpHandler>;
const state = globalThis as typeof globalThis & { __passveroCnClassificationHandler?: Handler };

export function getCnClassificationHttpHandler(): Handler {
  state.__passveroCnClassificationHandler ??= (() => {
    const config = validateBetterAuthServerConfig({ secret: process.env.BETTER_AUTH_SECRET, baseURL: process.env.BETTER_AUTH_URL });
    const services = createCnClassificationCurrentDraftServices(getProductionCnClassificationCurrentDraftDependencies());
    return createCnClassificationHttpHandler({ canonicalOrigin: config.baseURL, resolveContext: resolveAuthenticatedUserContext, add: services.add, edit: services.edit, remove: services.remove });
  })();
  return state.__passveroCnClassificationHandler;
}
