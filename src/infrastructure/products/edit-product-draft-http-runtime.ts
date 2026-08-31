import "server-only";

import { createEditProductDraftService } from "@/src/application/products/edit-product-draft/edit-product-draft";
import { createEditProductDraftHttpHandler } from "@/src/application/products/edit-product-draft/edit-product-draft-http";
import { validateBetterAuthServerConfig } from "@/src/infrastructure/auth/better-auth-server-config";
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
  const config = validateBetterAuthServerConfig({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
  });
  const edit = createEditProductDraftService(getProductionEditProductDraftDependencies());
  return createEditProductDraftHttpHandler({
    canonicalOrigin: config.baseURL,
    resolveContext: resolveAuthenticatedUserContext,
    edit,
  });
}
