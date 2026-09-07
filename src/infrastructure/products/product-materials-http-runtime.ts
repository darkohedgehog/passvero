import "server-only";
import { verifyRuntimeProxy } from "@/src/infrastructure/http/trusted-proxy-runtime";

import { createProductMaterialsHttpHandler } from "@/src/application/products/product-materials-current-draft/http";
import { createProductMaterialsCurrentDraftServices } from "@/src/application/products/product-materials-current-draft/services";
import { getCanonicalAppOrigin } from "@/src/infrastructure/config/canonical-app-origin";
import { resolveAuthenticatedUserContext } from "@/src/infrastructure/context/organization-context-runtime";
import { getProductionProductMaterialsCurrentDraftDependencies } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";

type Handler = ReturnType<typeof createProductMaterialsHttpHandler>;
const state = globalThis as typeof globalThis & { __passveroProductMaterialsHandler?: Handler };

export function getProductMaterialsHttpHandler(): Handler {
  state.__passveroProductMaterialsHandler ??= (() => {
    const config = { baseURL: getCanonicalAppOrigin() };
    const services = createProductMaterialsCurrentDraftServices(
      getProductionProductMaterialsCurrentDraftDependencies(),
    );
    return createProductMaterialsHttpHandler({ verifyProxy: verifyRuntimeProxy,
      canonicalOrigin: config.baseURL,
      resolveContext: resolveAuthenticatedUserContext,
      add: services.add,
      edit: services.edit,
      remove: services.remove,
    });
  })();
  return state.__passveroProductMaterialsHandler;
}
