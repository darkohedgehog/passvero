import { createHash } from "node:crypto";
import { z } from "zod";
import type { AuthenticatedUserContext } from "../context/authenticated-user-context";
import { DocumentError, type PrivateDocumentStorage } from "./contracts";
import { MAX_DOCUMENT_PDF_SIZE } from "./pdf";
import { pdfValidationResultSchema, type PdfValidationPort } from "./pdf-validation";
import { decideDocumentSecurity, DOCUMENT_SECURITY_POLICY_VERSION } from "./document-security-policy";
import { sameProvenance, trustedProvenance, type DocumentScanPersistence, type MalwareScannerPort, type SignatureHealthPort, type TerminalScan } from "./malware-scan";

interface Dependencies {
  readonly persistence: DocumentScanPersistence;
  readonly storage: PrivateDocumentStorage;
  readonly pdf: PdfValidationPort;
  readonly scanner: MalwareScannerPort;
  readonly health: SignatureHealthPort;
  /** Trusted composition/test clock; never a scan request parameter. */
  readonly now?: () => number;
}
export type DocumentScanResult = { readonly documentId: string } & (
  | { readonly status: "CLEAN" | "INFECTED" }
  | { readonly status: "ERROR"; readonly failureCode: Extract<TerminalScan, { status: "ERROR" }>["failureCode"] }
);
export function createDocumentScanner(deps: Dependencies) {
  const now = deps.now ?? Date.now;
  return async function scan(documentId: unknown, context: AuthenticatedUserContext, options: { readonly signal: AbortSignal }): Promise<DocumentScanResult> {
    const id = z.string().uuid().safeParse(documentId);
    if (!id.success) throw new DocumentError("VALIDATION_ERROR");
    if (options.signal.aborted) throw new DocumentError("OPERATIONAL_FAILURE");
    const safePersistence = async <T>(work: () => Promise<T>): Promise<T> => {
      try { return await work(); }
      catch (e) { if (e instanceof DocumentError) throw e; throw new DocumentError("OPERATIONAL_FAILURE"); }
    };
    const claim = await safePersistence(() => deps.persistence.claim(context, id.data));
    const error = (failureCode: Extract<TerminalScan, { status: "ERROR" }>["failureCode"]): TerminalScan => ({ status: "ERROR", failureCode });
    async function process(): Promise<TerminalScan> {
      const signal = options.signal;
      if (signal.aborted) return error("INTERRUPTED");
      let bytes: Uint8Array;
      try {
        bytes = new Uint8Array(await deps.storage.read(claim.storage, { signal, limit: MAX_DOCUMENT_PDF_SIZE }));
      } catch { return error(signal.aborted ? "INTERRUPTED" : "INTEGRITY_MISMATCH"); }
      const observed = { sizeBytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") };
      const integrity = { expected: claim.identity, observed };
      if (observed.sizeBytes !== claim.identity.sizeBytes || observed.sha256 !== claim.identity.sha256) return error("INTEGRITY_MISMATCH");
      if (signal.aborted) return error("INTERRUPTED");
      let pdf: unknown;
      try { pdf = await deps.pdf.validate(bytes.slice(), { signal }); }
      catch { return error(signal.aborted ? "INTERRUPTED" : "PDF_VALIDATION_FAILED"); }
      if (signal.aborted) return error("INTERRUPTED");
      const parsed = pdfValidationResultSchema.safeParse(pdf);
      const envelope = { policyVersion: DOCUMENT_SECURITY_POLICY_VERSION, integrity, pdf };
      if (!parsed.success || parsed.data.kind !== "VALID"
        || parsed.data.identity.sha256 !== observed.sha256 || parsed.data.identity.sizeBytes !== observed.sizeBytes) {
        const decision = decideDocumentSecurity(envelope);
        return decision.kind === "ERROR" ? error(decision.failureCode) : error("INVALID_RESPONSE");
      }
      const readHealth = async () => {
        try { return trustedProvenance(await deps.health.read({ signal }), now()); }
        catch { return null; }
      };
      const before = await readHealth();
      if (!before) return error("SIGNATURES_UNTRUSTED");
      if (signal.aborted) return error("INTERRUPTED");
      let scanner: unknown;
      try { scanner = await deps.scanner.scan(bytes.slice(), { signal }); }
      catch { scanner = { kind: "UNAVAILABLE" }; }
      if (signal.aborted) return error("INTERRUPTED");
      const after = await readHealth();
      if (signal.aborted) return error("INTERRUPTED");
      if (!after || !sameProvenance(before, after)) return error("SIGNATURES_UNTRUSTED");
      const decision = decideDocumentSecurity({ ...envelope, scanner, signatureHealth: "TRUSTED" });
      if (decision.kind === "ERROR") return error(decision.failureCode);
      return { status: decision.kind === "CLEAN_CANDIDATE" ? "CLEAN" : "INFECTED", identity: observed, provenance: after };
    }
    const result = await process();
    // Cancellation does not waive authority or lease; persistence revalidates both.
    const terminal = options.signal.aborted ? error("INTERRUPTED") : result;
    await safePersistence(() => deps.persistence.finalize(context, claim, terminal));
    return terminal.status === "ERROR"
      ? { documentId: id.data, status: "ERROR", failureCode: terminal.failureCode }
      : { documentId: id.data, status: terminal.status };
  };
}
