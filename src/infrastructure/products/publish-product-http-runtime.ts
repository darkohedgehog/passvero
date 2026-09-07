import "server-only";
import { verifyRuntimeProxy } from "@/src/infrastructure/http/trusted-proxy-runtime";

import { randomUUID } from "node:crypto";
import { createPublishProductHttpHandler } from "@/src/application/products/publish-product/http";
import { createPublishProductService } from "@/src/application/products/publish-product/publish-product";
import { getCanonicalAppOrigin } from "@/src/infrastructure/config/canonical-app-origin";
import { resolveAuthenticatedUserContext } from "@/src/infrastructure/context/organization-context-runtime";
import { getProductionPublishProductDependencies } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";

type Handler = ReturnType<typeof createPublishProductHttpHandler>;
const state = globalThis as typeof globalThis & { __passveroPublishProductHandler?: Handler };

export function getPublishProductHttpHandler(): Handler {
  state.__passveroPublishProductHandler ??= (() => {
    const config = { baseURL: getCanonicalAppOrigin() };
    return createPublishProductHttpHandler({ verifyProxy: verifyRuntimeProxy,
      canonicalOrigin: config.baseURL,
      resolveContext: resolveAuthenticatedUserContext,
      publish: createPublishProductService({ ...getProductionPublishProductDependencies(), now: () => new Date(), generateQrCode: () => randomUUID().toUpperCase(), canonicalOrigin: config.baseURL }),
    });
  })();
  return state.__passveroPublishProductHandler;
}
