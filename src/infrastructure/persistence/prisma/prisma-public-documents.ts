import type { PrismaClient } from "@/src/generated/prisma/client";
import type { PublicDocumentPersistence, PublicDocumentRow } from "@/src/application/public-dpp/documents";
import { MAX_DOCUMENT_PDF_SIZE } from "@/src/application/documents/pdf";

export class PrismaPublicDocuments implements PublicDocumentPersistence {
  constructor(private readonly prisma: PrismaClient) {}
  read(publicCode: string, attachmentId?: string): Promise<readonly PublicDocumentRow[]> {
    // Prisma may use multiple relation queries: bind them to a single MVCC snapshot.
    return this.prisma.$transaction(async tx => {
      const product = await tx.product.findUnique({ where: { publicCode }, select: {
        id: true, organizationId: true, lifecycleStatus: true, currentPublishedVersionId: true, lastPublishedAt: true,
        organization: { select: { status: true } },
        passport: { select: { productId: true, organizationId: true, status: true, lastPublishedAt: true } },
        currentPublishedVersion: { select: {
          id: true, productId: true, organizationId: true, status: true, versionNumber: true, publishedAt: true,
          productDocuments: { where: { isPublic: true, ...(attachmentId ? { id: attachmentId } : {}) },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
            include: { document: true } },
        } },
      } });
      const version = product?.currentPublishedVersion;
      const passport = product?.passport;
      if (!product || !version || !passport || product.lifecycleStatus !== "ACTIVE" || product.organization.status !== "ACTIVE"
        || passport.status !== "ACTIVE" || passport.productId !== product.id || passport.organizationId !== product.organizationId
        || version.status !== "PUBLISHED" || version.id !== product.currentPublishedVersionId || version.productId !== product.id
        || version.organizationId !== product.organizationId || !version.publishedAt || version.versionNumber === null
        || version.publishedAt.getTime() !== product.lastPublishedAt?.getTime()
        || version.publishedAt.getTime() !== passport.lastPublishedAt?.getTime()) return [];
      return version.productDocuments.flatMap(link => {
        const d = link.document;
        if (d.organizationId !== product.organizationId || d.status !== "AVAILABLE" || d.mimeType !== "application/pdf"
          || d.sizeBytes <= BigInt(0) || d.sizeBytes > BigInt(MAX_DOCUMENT_PDF_SIZE)) return [];
        return [{ attachmentId: link.id, versionId: version.id, versionNumber: version.versionNumber!,
          publishedAt: version.publishedAt!.toISOString(), label: link.displayLabel?.normalize("NFC").trim() || null,
          category: link.category, locale: link.locale,
          document: { id: d.id, originalFilename: d.originalFilename, displayName: d.displayName, status: d.status,
            sizeBytes: Number(d.sizeBytes), checksumSha256: d.checksumSha256,
            storage: { provider: d.storageProvider, bucket: d.storageBucket, key: d.storageKey },
            scan: { status: d.malwareScanStatus, attemptId: d.malwareScanAttemptId, startedAt: d.malwareScanStartedAt?.getTime() ?? null,
              scannedAt: d.malwareScannedAt?.getTime() ?? null, sha256: d.malwareScanSha256, policyVersion: d.malwarePolicyVersion },
          } }];
      });
    }, { isolationLevel: "RepeatableRead" });
  }
}
