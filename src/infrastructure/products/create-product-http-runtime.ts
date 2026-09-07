import "server-only";
import { verifyRuntimeProxy } from "@/src/infrastructure/http/trusted-proxy-runtime";

import { performance } from "node:perf_hooks";

import { createCreateProductService } from "@/src/application/products/create-product/create-product";
import { createCreateProductHttpHandler } from "@/src/application/products/create-product/create-product-http";
import type { CreateProductTelemetry } from "@/src/application/products/create-product/ports";
import { NodeProductPublicCodeGenerator } from "@/src/infrastructure/crypto/node-product-public-code-generator";
import { getCanonicalAppOrigin } from "@/src/infrastructure/config/canonical-app-origin";
import { resolveAuthenticatedUserContext } from "@/src/infrastructure/context/organization-context-runtime";
import { getProductionCreateProductDependencies } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";

type Handler = ReturnType<typeof createCreateProductHttpHandler>;

const runtimeGlobal = globalThis as typeof globalThis & {
  __passveroCreateProductHttpHandler?: Handler;
};

const silentTelemetry: CreateProductTelemetry = {
  recordSuccess() {},
  recordFailure() {},
  recordPublicCodeCollision() {},
  recordPublicCodeExhaustion() {},
};

export function getCreateProductHttpHandler(): Handler {
  runtimeGlobal.__passveroCreateProductHttpHandler ??= createRuntime();
  return runtimeGlobal.__passveroCreateProductHttpHandler;
}

function createRuntime(): Handler {
  const config = { baseURL: getCanonicalAppOrigin() };
  const create = createCreateProductService({
    ...getProductionCreateProductDependencies(),
    publicCodeGenerator: new NodeProductPublicCodeGenerator(),
    monotonicNow: () => performance.now(),
    telemetry: silentTelemetry,
  });

  return createCreateProductHttpHandler({ verifyProxy: verifyRuntimeProxy,
    canonicalOrigin: config.baseURL,
    resolveContext: resolveAuthenticatedUserContext,
    create,
  });
}
