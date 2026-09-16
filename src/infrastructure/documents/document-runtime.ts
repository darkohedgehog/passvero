import "server-only";
import { withStagingUiAcceptance } from "./staging-ui-acceptance";
import { PrismaAcceptanceCleanup } from "../persistence/prisma/prisma-acceptance-cleanup";
import { createDocumentServices } from "@/src/application/documents/services";
import { createDocumentHttpHandlers } from "@/src/application/documents/http";
import { SupabaseDocumentStorage, parseDocumentStorageConfig } from "@/src/infrastructure/storage/supabase-document-storage";
import { PrismaDocumentPersistence } from "@/src/infrastructure/persistence/prisma/prisma-document-assets";
import { getProductionPrismaClient } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";
import { getCanonicalAppOrigin } from "@/src/infrastructure/config/canonical-app-origin";
import { resolveAuthenticatedUserContext } from "@/src/infrastructure/context/organization-context-runtime";
import { verifyRuntimeProxy } from "@/src/infrastructure/http/trusted-proxy-runtime";
import { createDocumentScanHttpHandlers } from "@/src/application/documents/scan-http";
import { createDocumentScanRuntimeCore } from "./document-scan-runtime-core";
import { parseDocumentScanConfig } from "./document-scan-config";
import { createQpdfBrokerPort } from "./qpdf-broker-client";
import { createSignatureHealthProvider } from "./signature-health-reader";
import { ClamavUnixScanner } from "./clamav-unix-scanner";
import { PrismaDocumentScanPersistence } from "../persistence/prisma/prisma-document-scan";
import { createDocumentScanRecovery } from "@/src/application/documents/recover-document-scan";

function createRuntime() {
  const storage = new SupabaseDocumentStorage(parseDocumentStorageConfig({
    url: process.env.DOCUMENT_STORAGE_SUPABASE_URL,
    key: process.env.DOCUMENT_STORAGE_SUPABASE_KEY,
    bucket: process.env.DOCUMENT_STORAGE_BUCKET,
    environment: process.env.PASSVERO_RUNTIME_ENV,
  }));
  const prisma = getProductionPrismaClient(); // Runtime DB validator rejects mixed staging endpoints.
  const persistence = new PrismaDocumentPersistence(prisma);
  const canonicalOrigin = getCanonicalAppOrigin();
  const enabled = () => process.env.PASSVERO_RUNTIME_ENV === "staging"
    && canonicalOrigin === "https://staging.passvero.eu" && process.env.DOCUMENT_SCAN_ENABLED === "true";
  let config: ReturnType<typeof parseDocumentScanConfig> | undefined;
  if (enabled()) {
    try { config = parseDocumentScanConfig(JSON.parse(process.env.DOCUMENT_SCAN_CONFIG ?? "")); }
    catch { /* Only scan/delivery fail closed; upload remains independent. */ }
  }
  const health = config ? createSignatureHealthProvider({ path: config.healthEvidencePath, socketPath: config.clamavSocketPath }) : undefined;
  const scanPersistence = new PrismaDocumentScanPersistence(prisma);
  const scan = createDocumentScanRuntimeCore(config, {
    persistence: () => scanPersistence, storage: () => storage,
    pdf: () => createQpdfBrokerPort(), scanner: (path, signatures) => new ClamavUnixScanner(path, signatures),
    health: () => { if (!health) throw new Error("SIGNATURES_UNTRUSTED"); return health; },
  });
  const recover = createDocumentScanRecovery(scanPersistence);
  const uploadPersistence = enabled() ? withStagingUiAcceptance(persistence, new PrismaAcceptanceCleanup(prisma)) : persistence;
  const services = createDocumentServices({ storage, persistence: uploadPersistence, health });
  const transport = { canonicalOrigin, verifyProxy: verifyRuntimeProxy, resolveContext: resolveAuthenticatedUserContext };
  return { ...createDocumentHttpHandlers({ services, ...transport }),
    scan: createDocumentScanHttpHandlers({ ...transport, enabled, persistence, scan: scan.scan, recover }) };

}
let runtime: ReturnType<typeof createRuntime> | undefined;
export function getDocumentHttpHandlers() { runtime ??= createRuntime(); return runtime; }
