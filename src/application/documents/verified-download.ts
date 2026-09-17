import { cleanDocumentEligible } from "./access-policy";
import { trustedProvenance, type SignatureHealthPort } from "./malware-scan";
import { DocumentError, type DocumentRecord, type PrivateDocumentStorage } from "./contracts";
import { MAX_DOCUMENT_PDF_SIZE, sha256 } from "./pdf";

export async function requireCleanDocument(row: DocumentRecord, health: SignatureHealthPort | undefined, now: () => number, signal: AbortSignal) {
  if (!cleanDocumentEligible(row, now())) throw new DocumentError("NOT_AVAILABLE");
  try {
    if (!health || !trustedProvenance(await health.read({ signal }), now()) || signal.aborted) throw new Error();
  } catch { throw new DocumentError("NOT_AVAILABLE"); }
}
/** Both private and public delivery must reauthorize the exact object after I/O. */
export async function verifiedDocumentDownload(deps: {
  readAuthorized(): Promise<DocumentRecord>;
  storage: PrivateDocumentStorage;
  health?: SignatureHealthPort;
  now?: () => number;
}, head = false, callerSignal?: AbortSignal) {
  const now = deps.now ?? Date.now;
  const signal = callerSignal ? AbortSignal.any([callerSignal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000);
  const row = await deps.readAuthorized();
  await requireCleanDocument(row, deps.health, now, signal);
  if (!Number.isSafeInteger(row.sizeBytes) || row.sizeBytes < 1 || row.sizeBytes > MAX_DOCUMENT_PDF_SIZE) throw new DocumentError("NOT_AVAILABLE");
  let bytes: Uint8Array;
  try {
    bytes = await deps.storage.read(row.storage, { signal, limit: row.sizeBytes });
    if (bytes.byteLength !== row.sizeBytes || sha256(bytes) !== row.checksumSha256) throw new Error();
  } catch { throw new DocumentError("OPERATIONAL_FAILURE"); }
  const current = await deps.readAuthorized();
  await requireCleanDocument(current, deps.health, now, signal);
  if (current.id !== row.id || current.sizeBytes !== row.sizeBytes || current.checksumSha256 !== row.checksumSha256
    || current.storage.provider !== row.storage.provider || current.storage.bucket !== row.storage.bucket
    || current.storage.key !== row.storage.key || signal.aborted) throw new DocumentError("NOT_AVAILABLE");
  return { filename: current.originalFilename, sizeBytes: bytes.byteLength, bytes: head ? null : bytes };
}
