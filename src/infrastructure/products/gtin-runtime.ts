import "server-only";
import { createGtinServices } from "@/src/application/products/gtin/service";
import { createPrismaGtinDependencies } from "@/src/infrastructure/persistence/prisma/prisma-gtin";
import { getProductionPrismaClient } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";
import { createAttachmentHttpHandler } from "@/src/application/products/document-attachments/http";
import { getCanonicalAppOrigin } from "@/src/infrastructure/config/canonical-app-origin";
import { resolveAuthenticatedUserContext } from "@/src/infrastructure/context/organization-context-runtime";
import { verifyRuntimeProxy } from "@/src/infrastructure/http/trusted-proxy-runtime";

export function getGtinServices() { return createGtinServices(createPrismaGtinDependencies(getProductionPrismaClient())); }
export function getGtinHandler() {
  return createAttachmentHttpHandler({ canonicalOrigin: getCanonicalAppOrigin(), verifyProxy: verifyRuntimeProxy, resolveContext: resolveAuthenticatedUserContext,
    mutate: (id, input, context) => getGtinServices().mutate(id, input, context) });
}
