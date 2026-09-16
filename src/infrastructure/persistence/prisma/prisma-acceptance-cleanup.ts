import { Prisma, type PrismaClient } from "@/src/generated/prisma/client";
import type { AcceptanceCleanupPersistence } from "@/src/application/documents/acceptance-cleanup";
import { DocumentError } from "@/src/application/documents/contracts";
import { authorizeDocumentActor } from "./prisma-document-assets";

/** Staging runner only. No endpoint or general document deletion feature. */
export class PrismaAcceptanceCleanup implements AcceptanceCleanupPersistence {
  constructor(private readonly prisma: PrismaClient) {}
  archive: AcceptanceCleanupPersistence["archive"] = async (context, manifest, entry) => {
    if (manifest.organizationId !== context.organizationId || manifest.actorId !== context.userId) throw new DocumentError("FORBIDDEN");
    await this.prisma.$transaction(async tx => {
      await authorizeDocumentActor(tx, context, "PRODUCT_EDIT");
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Document" WHERE id=${entry.documentId}::uuid AND "organizationId"=${context.organizationId}::uuid FOR UPDATE`);
      const row = await tx.document.findFirst({ where: { id: entry.documentId, organizationId: context.organizationId } });
      if (!row || row.createdById !== manifest.actorId || row.displayName !== `acceptance:${manifest.runId}`
        || row.storageProvider !== "supabase" || row.storageBucket !== "passvero-staging-documents"
        || row.storageKey !== entry.storageKey || row.checksumSha256 !== entry.checksumSha256
        || row.sizeBytes !== BigInt(entry.sizeBytes) || row.malwareScanStatus === "PENDING"
        || await tx.productDocument.count({ where: { documentId: row.id } }) !== 0) {
        throw new DocumentError("FORBIDDEN");
      }
      // Attachment authoring holds a SHARE lock on this same Document and checks
      // AVAILABLE. The UPDATE lock closes that race before irreversible storage I/O.
      if (row.status === "ARCHIVED") {
        if (!row.archivedAt || row.archivedById !== context.userId) throw new DocumentError("FORBIDDEN");
        return;
      }
      await tx.document.update({ where: { id: row.id }, data: {
        status: "ARCHIVED", archivedAt: new Date(), archivedById: context.userId, updatedById: context.userId,
      } });
    });
  };
}
