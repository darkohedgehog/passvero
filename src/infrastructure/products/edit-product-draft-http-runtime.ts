import "server-only";
import { verifyRuntimeProxy } from "@/src/infrastructure/http/trusted-proxy-runtime";

import { createEditProductDraftService } from "@/src/application/products/edit-product-draft/edit-product-draft";
import { createEditProductDraftHttpHandler } from "@/src/application/products/edit-product-draft/edit-product-draft-http";
import { getCanonicalAppOrigin } from "@/src/infrastructure/config/canonical-app-origin";
import { resolveAuthenticatedUserContext } from "@/src/infrastructure/context/organization-context-runtime";
import { getProductionEditProductDraftDependencies } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";

type Handler = ReturnType<typeof createEditProductDraftHttpHandler>;

const runtimeGlobal = globalThis as typeof globalThis & {
  __passveroEditProductDraftHttpHandler?: Handler;
};

export function getEditProductDraftHttpHandler(): Handler {
  runtimeGlobal.__passveroEditProductDraftHttpHandler ??= createRuntime();
  return runtimeGlobal.__passveroEditProductDraftHttpHandler;
}

function createRuntime(): Handler {
  const config = { baseURL: getCanonicalAppOrigin() };
  const edit = createEditProductDraftService(getProductionEditProductDraftDependencies());
  return createEditProductDraftHttpHandler({ verifyProxy: verifyRuntimeProxy,
    canonicalOrigin: config.baseURL,
    resolveContext: resolveAuthenticatedUserContext,
    edit,
  });
}
