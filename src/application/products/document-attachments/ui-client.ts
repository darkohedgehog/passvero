import { z } from "zod";
import { attachmentCommandSchema, type AttachmentCommand, type AttachmentMetadata } from "./contracts";

export type AttachmentEvidence = Pick<AttachmentCommand, "expectedDraftVersionId" | "expectedProductUpdatedAt" | "expectedDraftUpdatedAt">;
export class AttachmentClientFailure extends Error {
  constructor(readonly code: "UPLOAD_FAILED" | "ATTACH_FAILED" | "STALE_WRITE" | "VALIDATION_ERROR") { super(code); }
}
export async function sendAttachment(productId: string, command: AttachmentCommand, transport: typeof fetch = fetch) {
  const parsed = attachmentCommandSchema.safeParse(command);
  if (!parsed.success) throw new AttachmentClientFailure("VALIDATION_ERROR");
  try {
    const response = await transport(`/api/products/${encodeURIComponent(productId)}/documents`, {
      method: "POST", credentials: "same-origin", redirect: "error", cache: "no-store",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data),
    });
    const body: unknown = await response.json();
    const result = z.object({ status: z.string() }).strict().safeParse(body);
    if (response.status === 409) throw new AttachmentClientFailure("STALE_WRITE");
    if (response.status === 400) throw new AttachmentClientFailure("VALIDATION_ERROR");
    if (!response.ok || !result.success || !["ATTACHED", "UPDATED", "REMOVED", "NO_CHANGE"].includes(result.data.status)) throw new AttachmentClientFailure("ATTACH_FAILED");
  } catch (error) {
    if (error instanceof AttachmentClientFailure) throw error;
    throw new AttachmentClientFailure("ATTACH_FAILED");
  }
}
// One instance per mounted Product/draft form. A failed upload is never replayed.
export function createUploadAttachmentFlow(productId: string, evidence: AttachmentEvidence, transport: typeof fetch = fetch) {
  const pinned = { ...evidence };
  let attempted = false, busy = false, complete = false;
  let documentId: string | null = null;
  return {
    get uploaded() { return documentId !== null; },
    get uploadAttempted() { return attempted; },
    async submit(file: File | null, metadata: AttachmentMetadata, current: AttachmentEvidence) {
      if (busy || complete || Object.keys(pinned).some(key => pinned[key as keyof AttachmentEvidence] !== current[key as keyof AttachmentEvidence])) throw new AttachmentClientFailure("STALE_WRITE");
      busy = true;
      try {
        if (!documentId) {
          if (attempted) throw new AttachmentClientFailure("UPLOAD_FAILED");
          if (!file || !/\.pdf$/i.test(file.name) || file.type !== "application/pdf" || file.size <= 0 || file.size > 10 * 1024 * 1024) throw new AttachmentClientFailure("VALIDATION_ERROR");
          attempted = true;
          try {
            const response = await transport("/api/documents", { method: "POST", credentials: "same-origin", redirect: "error", cache: "no-store",
              headers: { "Content-Type": "application/pdf", "X-Document-Filename": encodeURIComponent(file.name) }, body: file });
            const result = z.object({ status: z.literal("AVAILABLE"), documentId: z.uuid() }).strict().safeParse(await response.json());
            if (response.status !== 201 || !result.success) throw new Error();
            documentId = result.data.documentId;
          } catch { throw new AttachmentClientFailure("UPLOAD_FAILED"); }
        }
        await sendAttachment(productId, { ...pinned, operation: "ATTACH", documentId, metadata }, transport);
        complete = true;
      } finally { busy = false; }
    },
  };
}
