import { verifiedDocumentDownload } from "./verified-download";
import { type SignatureHealthPort } from "./malware-scan";
import type { AuthenticatedUserContext } from "../context/authenticated-user-context";
import { DocumentError, type DocumentPersistence, type DocumentRecord, type DocumentServices, type PrivateDocumentStorage } from "./contracts";
import { documentId, sha256, validatePdf } from "./pdf";

export function createDocumentServices(deps: { persistence: DocumentPersistence; storage: PrivateDocumentStorage; health?: SignatureHealthPort; now?: () => number }): DocumentServices {
  const { persistence, storage } = deps;
  async function verifiedBytes(row: DocumentRecord) {
    const bytes = await storage.read(row.storage);
    if (bytes.byteLength !== row.sizeBytes || sha256(bytes) !== row.checksumSha256) throw new DocumentError("OPERATIONAL_FAILURE");
    return bytes;
  }
  async function finalize(row: DocumentRecord, context: AuthenticatedUserContext) {
    try { await persistence.finalize(context, row.id); }
    catch { throw new DocumentError("RECOVERY_REQUIRED"); }
    return { status: "AVAILABLE" as const, documentId: row.id };
  }
  return {
    authorizeUpload: context => persistence.authorize(context, "PRODUCT_EDIT"),
    async upload(input, context) {
      await persistence.authorize(context, "PRODUCT_EDIT");
      // Own the bytes across awaits so callers cannot change validated content.
      const metadata = validatePdf(input);
      const bytes = new Uint8Array(input.bytes);
      const row = await persistence.createPending(context, { ...metadata, storage: storage.identity() });
      try {
        await storage.put(row.storage, bytes);
        await verifiedBytes(row);
      } catch {
        try { await persistence.fail(context, row.id); }
        catch { throw new DocumentError("RECOVERY_REQUIRED"); }
        throw new DocumentError("UPLOAD_FAILED");
      }
      return finalize(row, context);
    },
    async recoverPending(id, context) {
      const row = await persistence.read(context, documentId(id), "PRODUCT_EDIT");
      if (row.status === "AVAILABLE") return { status: "AVAILABLE", documentId: row.id };
      if (row.status !== "PENDING_UPLOAD") throw new DocumentError("NOT_AVAILABLE");
      try { await verifiedBytes(row); }
      catch { throw new DocumentError("RECOVERY_REQUIRED"); }
      // Recovery only verifies/finalizes; it never uploads, overwrites or attaches.
      return finalize(row, context);
    },
    async download(id, context, head = false, options) {
      const normalizedId = documentId(id);
      return verifiedDocumentDownload({
        readAuthorized: () => persistence.read(context, normalizedId, "PRODUCT_READ"),
        storage, health: deps.health, now: deps.now,
      }, head, options?.signal);
    },
  };
}
