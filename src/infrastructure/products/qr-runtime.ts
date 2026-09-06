import "server-only";

import { createProductQrServices } from "@/src/application/products/qr/services";
import { createProductQrHttpHandlers } from "@/src/application/products/qr/http";
import { validateBetterAuthServerConfig } from "@/src/infrastructure/auth/better-auth-server-config";
import { resolveAuthenticatedUserContext } from "@/src/infrastructure/context/organization-context-runtime";
import { getProductionPrismaClient } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";
import { PrismaProductQrPersistence, PrismaProductQrTransactionRunner } from "@/src/infrastructure/persistence/prisma/prisma-product-qr";
import { createQrEvidence } from "./qr-evidence";
import { renderQrArtifact } from "./qr-renderer";

function createRuntime() {
  const config = validateBetterAuthServerConfig({ secret: process.env.BETTER_AUTH_SECRET, baseURL: process.env.BETTER_AUTH_URL });
  const services = createProductQrServices({
    canonicalOrigin: config.baseURL, evidence: createQrEvidence(config.secret), now: () => new Date(),
    persistence: new PrismaProductQrPersistence(),
    transactionRunner: new PrismaProductQrTransactionRunner(getProductionPrismaClient()),
    renderer: { render: renderQrArtifact },
  });
  return { services, http: createProductQrHttpHandlers({ canonicalOrigin: config.baseURL, resolveContext: resolveAuthenticatedUserContext, activate: services.activate, render: services.render }) };
}
let runtime: ReturnType<typeof createRuntime> | undefined;
export function getProductQrRuntime() {
  runtime ??= createRuntime();
  return runtime;
}
