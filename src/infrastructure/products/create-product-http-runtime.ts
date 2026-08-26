import "server-only";

import { performance } from "node:perf_hooks";

import { createCreateProductService } from "@/src/application/products/create-product/create-product";
import { createCreateProductHttpHandler } from "@/src/application/products/create-product/create-product-http";
import type { CreateProductTelemetry } from "@/src/application/products/create-product/ports";
import { NodeProductPublicCodeGenerator } from "@/src/infrastructure/crypto/node-product-public-code-generator";
import { validateBetterAuthServerConfig } from "@/src/infrastructure/auth/better-auth-server-config";
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
  const config = validateBetterAuthServerConfig({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
  });
  const create = createCreateProductService({
    ...getProductionCreateProductDependencies(),
    publicCodeGenerator: new NodeProductPublicCodeGenerator(),
    monotonicNow: () => performance.now(),
    telemetry: silentTelemetry,
  });

  return createCreateProductHttpHandler({
    canonicalOrigin: config.baseURL,
    resolveContext: resolveAuthenticatedUserContext,
    create,
  });
}
