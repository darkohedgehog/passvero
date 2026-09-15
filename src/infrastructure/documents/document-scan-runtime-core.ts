import { DocumentError, type PrivateDocumentStorage } from "@/src/application/documents/contracts";
import { createDocumentScanner } from "@/src/application/documents/scan-document";
import type { DocumentScanPersistence, MalwareScannerPort, SignatureHealthPort } from "@/src/application/documents/malware-scan";
import type { PdfValidationPort } from "@/src/application/documents/pdf-validation";
import { parseDocumentScanConfig, type DocumentScanConfig } from "./document-scan-config";

export interface DocumentScanRuntimeFactories {
  persistence(): DocumentScanPersistence;
  storage(): PrivateDocumentStorage;
  pdf(config: { executablePath: string; temporaryRoot: string }): PdfValidationPort;
  scanner(socketPath: string, signatures: ReadonlySet<string>): MalwareScannerPort;
  health(config: { path: string; socketPath: string }): SignatureHealthPort;
}
/** Construct once per process/composition owner, not once per request. No I/O during construction. */
export function createDocumentScanRuntimeCore(input: unknown, factories: DocumentScanRuntimeFactories) {
  let config: DocumentScanConfig | undefined;
  try { config = parseDocumentScanConfig(input); } catch { /* Scanning alone fails closed on use. */ }
  let scan: ReturnType<typeof createDocumentScanner> | undefined;
  return {
    scan: (...args: Parameters<ReturnType<typeof createDocumentScanner>>) => {
      if (!config) return Promise.reject(new DocumentError("OPERATIONAL_FAILURE"));
      try {
        scan ??= createDocumentScanner({
          persistence: factories.persistence(), storage: factories.storage(),
          pdf: factories.pdf({ executablePath: config.qpdfLauncherPath, temporaryRoot: config.qpdfTemporaryRoot }),
          scanner: factories.scanner(config.clamavSocketPath, new Set(config.malwareSignatures)),
          health: factories.health({ path: config.healthEvidencePath, socketPath: config.clamavSocketPath }),
        });
        return scan(...args);
      } catch { return Promise.reject(new DocumentError("OPERATIONAL_FAILURE")); }
    },
  };
}
