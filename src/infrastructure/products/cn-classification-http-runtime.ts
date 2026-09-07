import "server-only";
import { verifyRuntimeProxy } from "@/src/infrastructure/http/trusted-proxy-runtime";

import { createCnClassificationHttpHandler } from "@/src/application/products/cn-classification-current-draft/http";
import { createCnClassificationCurrentDraftServices } from "@/src/application/products/cn-classification-current-draft/services";
import { getCanonicalAppOrigin } from "@/src/infrastructure/config/canonical-app-origin";
import { resolveAuthenticatedUserContext } from "@/src/infrastructure/context/organization-context-runtime";
import { getProductionCnClassificationCurrentDraftDependencies } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";

type Handler = ReturnType<typeof createCnClassificationHttpHandler>;
const state = globalThis as typeof globalThis & { __passveroCnClassificationHandler?: Handler };

export function getCnClassificationHttpHandler(): Handler {
  state.__passveroCnClassificationHandler ??= (() => {
    const config = { baseURL: getCanonicalAppOrigin() };
    const services = createCnClassificationCurrentDraftServices(getProductionCnClassificationCurrentDraftDependencies());
    return createCnClassificationHttpHandler({ verifyProxy: verifyRuntimeProxy, canonicalOrigin: config.baseURL, resolveContext: resolveAuthenticatedUserContext, add: services.add, edit: services.edit, remove: services.remove });
  })();
  return state.__passveroCnClassificationHandler;
}
