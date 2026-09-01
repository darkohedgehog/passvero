import "server-only";

import { createProductMaterialsHttpHandler } from "@/src/application/products/product-materials-current-draft/http";
import { createProductMaterialsCurrentDraftServices } from "@/src/application/products/product-materials-current-draft/services";
import { validateBetterAuthServerConfig } from "@/src/infrastructure/auth/better-auth-server-config";
import { resolveAuthenticatedUserContext } from "@/src/infrastructure/context/organization-context-runtime";
import { getProductionProductMaterialsCurrentDraftDependencies } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";

type Handler = ReturnType<typeof createProductMaterialsHttpHandler>;
const state = globalThis as typeof globalThis & { __passveroProductMaterialsHandler?: Handler };

export function getProductMaterialsHttpHandler(): Handler {
  state.__passveroProductMaterialsHandler ??= (() => {
    const config = validateBetterAuthServerConfig({
      secret: process.env.BETTER_AUTH_SECRET,
      baseURL: process.env.BETTER_AUTH_URL,
    });
    const services = createProductMaterialsCurrentDraftServices(
      getProductionProductMaterialsCurrentDraftDependencies(),
    );
    return createProductMaterialsHttpHandler({
      canonicalOrigin: config.baseURL,
      resolveContext: resolveAuthenticatedUserContext,
      add: services.add,
      edit: services.edit,
      remove: services.remove,
    });
  })();
  return state.__passveroProductMaterialsHandler;
}
