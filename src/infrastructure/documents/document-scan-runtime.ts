import "server-only";
import type { PrismaClient } from "@/src/generated/prisma/client";
import { PrismaDocumentScanPersistence } from "@/src/infrastructure/persistence/prisma/prisma-document-scan";
import { parseDocumentStorageConfig, SupabaseDocumentStorage } from "@/src/infrastructure/storage/supabase-document-storage";
import { createQpdfValidationPort } from "./qpdf-validation";
import { ClamavUnixScanner } from "./clamav-unix-scanner";
import { createSignatureHealthProvider } from "./signature-health-reader";
import { createDocumentScanRuntimeCore } from "./document-scan-runtime-core";

/** Trusted server composition only. Keep the returned object for the process lifetime. */
export function createDocumentScanRuntime(config: unknown, dependencies: {
  readonly getPrisma: () => PrismaClient;
  readonly storageConfig: unknown;
}) {
  return createDocumentScanRuntimeCore(config, {
    persistence: () => new PrismaDocumentScanPersistence(dependencies.getPrisma()),
    storage: () => new SupabaseDocumentStorage(parseDocumentStorageConfig(dependencies.storageConfig)),
    pdf: createQpdfValidationPort,
    scanner: (path, signatures) => new ClamavUnixScanner(path, signatures),
    health: createSignatureHealthProvider,
  });
}
