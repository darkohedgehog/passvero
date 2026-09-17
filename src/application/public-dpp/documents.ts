import { z } from "zod";
import type { DocumentRecord, PrivateDocumentStorage } from "../documents/contracts";
import { DocumentError } from "../documents/contracts";
import type { SignatureHealthPort } from "../documents/malware-scan";
import { cleanDocumentEligible } from "../documents/access-policy";
import { requireCleanDocument, verifiedDocumentDownload } from "../documents/verified-download";

export const publicDocumentRoute = z.object({ publicCode: z.string().regex(/^[A-Za-z0-9_-]{22}$/), attachmentId: z.uuid() }).strict();
export interface PublicDocumentItem {
  readonly label: string | null;
  readonly category: string;
  readonly locale: string | null;
  readonly sizeBytes: number;
  readonly downloadPath: string;
}
export interface PublicDocumentRow {
  readonly attachmentId: string;
  readonly versionId: string;
  readonly versionNumber: number;
  readonly publishedAt: string;
  readonly label: string | null;
  readonly category: string;
  readonly locale: string | null;
  readonly document: DocumentRecord;
}
export interface PublicDocumentPersistence {
  /** One consistent snapshot: active product/org/passport, current PUBLISHED version,
   * matching ownership, explicit public link and AVAILABLE PDF only. */
  read(publicCode: string, attachmentId?: string): Promise<readonly PublicDocumentRow[]>;
}
export function createPublicDocumentService(deps: {
  persistence: PublicDocumentPersistence; storage: PrivateDocumentStorage; health?: SignatureHealthPort;
  now?: () => number;
}) {
  const now = deps.now ?? Date.now;
  return {
    async list(publicCode: string, version: { number: number; publishedAt: string }): Promise<readonly PublicDocumentItem[]> {
      if (!publicDocumentRoute.shape.publicCode.safeParse(publicCode).success) return [];
      try {
        const rows = await deps.persistence.read(publicCode);
        const eligible = rows.filter(r => r.versionNumber === version.number && r.publishedAt === version.publishedAt && cleanDocumentEligible(r.document, now()));
        if (eligible.length === 0) return [];
        await requireCleanDocument(eligible[0].document, deps.health, now, AbortSignal.timeout(5000));
        return eligible.filter(r => cleanDocumentEligible(r.document, now())).map(r => ({
          label: r.label, category: r.category, locale: r.locale, sizeBytes: r.document.sizeBytes,
          downloadPath: `/p/${publicCode}/documents/${r.attachmentId}`,
        }));
      } catch { return []; } // Document dependency failure never reveals private diagnostics.
    },
    async download(publicCode: string, attachmentId: string, head: boolean, signal: AbortSignal) {
      if (!publicDocumentRoute.safeParse({ publicCode, attachmentId }).success) throw new DocumentError("NOT_FOUND");
      let initial: PublicDocumentRow | undefined;
      return verifiedDocumentDownload({ ...deps, readAuthorized: async () => {
        const rows = await deps.persistence.read(publicCode, attachmentId);
        const row = rows.length === 1 ? rows[0] : undefined;
        if (!row || row.attachmentId !== attachmentId || (initial && (row.versionId !== initial.versionId || row.publishedAt !== initial.publishedAt))) throw new DocumentError("NOT_FOUND");
        initial ??= row;
        // Public label, never the uploader's potentially private original filename.
        return { ...row.document, originalFilename: `${(row.label ?? "document").replace(/\.pdf$/i, "")}.pdf` };
      } }, head, signal);
    },
  };
}
