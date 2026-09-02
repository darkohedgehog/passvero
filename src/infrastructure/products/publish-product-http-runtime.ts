import "server-only";

import { randomUUID } from "node:crypto";
import { createPublishProductHttpHandler } from "@/src/application/products/publish-product/http";
import { createPublishProductService } from "@/src/application/products/publish-product/publish-product";
import { validateBetterAuthServerConfig } from "@/src/infrastructure/auth/better-auth-server-config";
import { resolveAuthenticatedUserContext } from "@/src/infrastructure/context/organization-context-runtime";
import { getProductionPublishProductDependencies } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";

type Handler = ReturnType<typeof createPublishProductHttpHandler>;
const state = globalThis as typeof globalThis & { __passveroPublishProductHandler?: Handler };

export function getPublishProductHttpHandler(): Handler {
  state.__passveroPublishProductHandler ??= (() => {
    const config = validateBetterAuthServerConfig({ secret: process.env.BETTER_AUTH_SECRET, baseURL: process.env.BETTER_AUTH_URL });
    return createPublishProductHttpHandler({
      canonicalOrigin: config.baseURL,
      resolveContext: resolveAuthenticatedUserContext,
      publish: createPublishProductService({ ...getProductionPublishProductDependencies(), now: () => new Date(), generateQrCode: () => randomUUID().toUpperCase(), canonicalOrigin: config.baseURL }),
    });
  })();
  return state.__passveroPublishProductHandler;
}
