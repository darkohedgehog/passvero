import { createCatalogExportHandler, catalogExportFailure } from "@/src/application/products/export-catalog/http";
import { createExportCatalog } from "@/src/application/products/export-catalog/export-catalog";
import { resolveReadOnlyAuthenticatedUserContext } from "@/src/infrastructure/context/organization-context-runtime";
import { getProductionPrismaClient } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";
import { PrismaExportCatalogPersistence } from "@/src/infrastructure/persistence/prisma/prisma-export-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export async function GET(request: Request): Promise<Response> {
  try {
    return await createCatalogExportHandler({ resolveContext: resolveReadOnlyAuthenticatedUserContext,
      exportCatalog: createExportCatalog(new PrismaExportCatalogPersistence(getProductionPrismaClient())) })(request);
  } catch (error) { return catalogExportFailure(error); }
}
