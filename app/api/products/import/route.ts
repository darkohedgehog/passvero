import { createCatalogImportHandler, importFailure } from "@/src/application/products/import-catalog/http";
import { createCatalogImportService } from "@/src/application/products/import-catalog/service";
import { PrismaCatalogImportPersistence } from "@/src/infrastructure/persistence/prisma/prisma-import-catalog";
import { getProductionPrismaClient } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";
import { resolveReadOnlyAuthenticatedUserContext } from "@/src/infrastructure/context/organization-context-runtime";
import { verifyRuntimeProxy } from "@/src/infrastructure/http/trusted-proxy-runtime";
import { validateBetterAuthServerConfig } from "@/src/infrastructure/auth/better-auth-server-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export async function POST(request: Request) {
  try {
    const config = validateBetterAuthServerConfig({ secret: process.env.BETTER_AUTH_SECRET, baseURL: process.env.BETTER_AUTH_URL });
    return await createCatalogImportHandler({ canonicalOrigin: config.baseURL, verifyProxy: verifyRuntimeProxy, resolveContext: resolveReadOnlyAuthenticatedUserContext,
      service: createCatalogImportService(new PrismaCatalogImportPersistence(getProductionPrismaClient()), config.secret) })(request);
  } catch (error) { return importFailure(error); }
}
