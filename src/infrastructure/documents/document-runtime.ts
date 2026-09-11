import "server-only";
import { createDocumentServices } from "@/src/application/documents/services";
import { createDocumentHttpHandlers } from "@/src/application/documents/http";
import { SupabaseDocumentStorage, parseDocumentStorageConfig } from "@/src/infrastructure/storage/supabase-document-storage";
import { PrismaDocumentPersistence } from "@/src/infrastructure/persistence/prisma/prisma-document-assets";
import { getProductionPrismaClient } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";
import { getCanonicalAppOrigin } from "@/src/infrastructure/config/canonical-app-origin";
import { resolveAuthenticatedUserContext } from "@/src/infrastructure/context/organization-context-runtime";
import { verifyRuntimeProxy } from "@/src/infrastructure/http/trusted-proxy-runtime";
function createRuntime() {
  const storage = new SupabaseDocumentStorage(parseDocumentStorageConfig({
    url: process.env.DOCUMENT_STORAGE_SUPABASE_URL,
    key: process.env.DOCUMENT_STORAGE_SUPABASE_KEY,
    bucket: process.env.DOCUMENT_STORAGE_BUCKET,
    environment: process.env.PASSVERO_RUNTIME_ENV,
  }));
  const services = createDocumentServices({ storage, persistence: new PrismaDocumentPersistence(getProductionPrismaClient()) });
  return createDocumentHttpHandlers({ services, canonicalOrigin: getCanonicalAppOrigin(), verifyProxy: verifyRuntimeProxy, resolveContext: resolveAuthenticatedUserContext });
}
let runtime: ReturnType<typeof createRuntime> | undefined;
export function getDocumentHttpHandlers() { runtime ??= createRuntime(); return runtime; }
