import "server-only";
import { createPublicDocumentService } from "@/src/application/public-dpp/documents";
import { createPublicDocumentHttpHandler } from "@/src/application/public-dpp/document-http";
import { PrismaPublicDocuments } from "../persistence/prisma/prisma-public-documents";
import { getProductionPrismaClient } from "../persistence/prisma/production-prisma-runtime";
import { getCanonicalAppOrigin } from "../config/canonical-app-origin";
import { SupabaseDocumentStorage, parseDocumentStorageConfig } from "../storage/supabase-document-storage";
import { parseDocumentScanConfig } from "../documents/document-scan-config";
import { createSignatureHealthProvider } from "../documents/signature-health-reader";

export function publicDocumentDeliveryEnabled() {
  return process.env.PASSVERO_RUNTIME_ENV === "staging" && process.env.DOCUMENT_SCAN_ENABLED === "true"
    && getCanonicalAppOrigin() === "https://staging.passvero.eu";
}
let service: ReturnType<typeof createPublicDocumentService> | undefined;
export function getPublicDocumentService() {
  if (!publicDocumentDeliveryEnabled()) throw new Error("PUBLIC_DOCUMENTS_DISABLED");
  if (!service) {
    const config = parseDocumentScanConfig(JSON.parse(process.env.DOCUMENT_SCAN_CONFIG ?? ""));
    service = createPublicDocumentService({
      persistence: new PrismaPublicDocuments(getProductionPrismaClient()),
      storage: new SupabaseDocumentStorage(parseDocumentStorageConfig({ url: process.env.DOCUMENT_STORAGE_SUPABASE_URL,
        key: process.env.DOCUMENT_STORAGE_SUPABASE_KEY, bucket: process.env.DOCUMENT_STORAGE_BUCKET, environment: process.env.PASSVERO_RUNTIME_ENV })),
      health: createSignatureHealthProvider({ path: config.healthEvidencePath, socketPath: config.clamavSocketPath }),
    });
  }
  return service;
}
const handler = createPublicDocumentHttpHandler({ enabled: publicDocumentDeliveryEnabled,
  service: { download: (...args) => getPublicDocumentService().download(...args) } });
export function getPublicDocumentHttpHandler() { return handler; }
