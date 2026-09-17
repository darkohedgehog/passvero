import "server-only";
import { createManufacturerServices } from "@/src/application/products/manufacturer/service";
import { createPrismaManufacturerDependencies } from "@/src/infrastructure/persistence/prisma/prisma-manufacturer";
import { getProductionPrismaClient } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";
import { createAttachmentHttpHandler } from "@/src/application/products/document-attachments/http";
import { getCanonicalAppOrigin } from "@/src/infrastructure/config/canonical-app-origin";
import { resolveAuthenticatedUserContext } from "@/src/infrastructure/context/organization-context-runtime";
import { verifyRuntimeProxy } from "@/src/infrastructure/http/trusted-proxy-runtime";
export function getManufacturerServices() { return createManufacturerServices(createPrismaManufacturerDependencies(getProductionPrismaClient())); }
export function getManufacturerHandler() {
  return createAttachmentHttpHandler({ canonicalOrigin: getCanonicalAppOrigin(), verifyProxy: verifyRuntimeProxy, resolveContext: resolveAuthenticatedUserContext,
    mutate: async (id, input, context) => { await getManufacturerServices().mutate(id, input, context); return { status: "UPDATED" }; } });
}
