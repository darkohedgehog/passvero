import { Prisma, type PrismaClient, type Document } from "@/src/generated/prisma/client";
import type { AuthenticatedUserContext, MembershipRole } from "@/src/application/context/authenticated-user-context";
import { roleHasProductPermission, type ProductPermission } from "@/src/application/permissions/product-permissions";
import { DocumentError, type DocumentPersistence, type DocumentRecord } from "@/src/application/documents/contracts";
import { MAX_DOCUMENT_PDF_SIZE } from "@/src/application/documents/pdf";
type Tx = Prisma.TransactionClient;

async function authorize(tx: Tx, context: AuthenticatedUserContext, permission: ProductPermission) {
  if (!context.permissions.includes(permission) || context.membershipStatus !== "ACTIVE") throw new DocumentError("FORBIDDEN");
  const rows = await tx.$queryRaw<Array<{ role: MembershipRole; membershipStatus: string; organizationStatus: string }>>(Prisma.sql`
    SELECT m."role", m."status" AS "membershipStatus", o."status" AS "organizationStatus"
    FROM "Membership" m JOIN "Organization" o ON o."id" = m."organizationId"
    WHERE m."id" = ${context.membershipId}::uuid AND m."userId" = ${context.userId}::uuid AND m."organizationId" = ${context.organizationId}::uuid
    FOR SHARE OF m, o
  `);
  const row = rows[0];
  if (!row || row.membershipStatus !== "ACTIVE" || row.organizationStatus !== "ACTIVE" || !roleHasProductPermission(row.role, permission)) throw new DocumentError("FORBIDDEN");
}
function record(row: Document): DocumentRecord {
  if (row.sizeBytes <= BigInt(0) || row.sizeBytes > BigInt(MAX_DOCUMENT_PDF_SIZE)) throw new DocumentError("NOT_AVAILABLE");
  return { id: row.id, originalFilename: row.originalFilename, displayName: row.displayName, sizeBytes: Number(row.sizeBytes), checksumSha256: row.checksumSha256, status: row.status, storage: { provider: row.storageProvider, bucket: row.storageBucket, key: row.storageKey } };
}
async function owned(tx: Tx, context: AuthenticatedUserContext, id: string, lock = false) {
  if (lock) await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Document" WHERE "id" = ${id}::uuid AND "organizationId" = ${context.organizationId}::uuid FOR UPDATE`);
  const row = await tx.document.findFirst({ where: { id, organizationId: context.organizationId } });
  if (!row) throw new DocumentError("NOT_FOUND");
  return row;
}
export class PrismaDocumentPersistence implements DocumentPersistence {
  constructor(private readonly prisma: PrismaClient) {}
  private async run<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    try { return await this.prisma.$transaction(work); }
    catch (error) { if (error instanceof DocumentError) throw error; throw new DocumentError("OPERATIONAL_FAILURE"); }
  }
  authorize(context: AuthenticatedUserContext, permission: ProductPermission) { return this.run(tx => authorize(tx, context, permission)); }
  createPending(context: AuthenticatedUserContext, data: Omit<DocumentRecord, "id" | "status">) {
    return this.run(async tx => {
      await authorize(tx, context, "PRODUCT_EDIT");
      return record(await tx.document.create({ data: {
        organizationId: context.organizationId, originalFilename: data.originalFilename, displayName: data.displayName,
        fileExtension: "pdf", mimeType: "application/pdf", sizeBytes: BigInt(data.sizeBytes), checksumSha256: data.checksumSha256,
        storageProvider: data.storage.provider, storageBucket: data.storage.bucket, storageKey: data.storage.key,
        status: "PENDING_UPLOAD", createdById: context.userId, updatedById: context.userId,
      } }));
    });
  }
  read(context: AuthenticatedUserContext, id: string, permission: ProductPermission) {
    return this.run(async tx => { await authorize(tx, context, permission); return record(await owned(tx, context, id)); });
  }
  finalize(context: AuthenticatedUserContext, id: string) {
    return this.run(async tx => {
      await authorize(tx, context, "PRODUCT_EDIT");
      const row = await owned(tx, context, id, true);
      if (row.status === "AVAILABLE") return;
      if (row.status !== "PENDING_UPLOAD") throw new DocumentError("NOT_AVAILABLE");
      await tx.document.update({ where: { id: row.id }, data: { status: "AVAILABLE", uploadedAt: new Date(), updatedById: context.userId } });
      await tx.auditLog.create({ data: { organizationId: context.organizationId, actorId: context.userId, action: "DOCUMENT_UPLOADED", entityType: "DOCUMENT", entityId: row.id, summary: "Private document upload completed.", correlationId: context.correlationId } });
    });
  }
  fail(context: AuthenticatedUserContext, id: string) {
    return this.run(async tx => {
      await authorize(tx, context, "PRODUCT_EDIT");
      const row = await owned(tx, context, id, true);
      if (row.status !== "PENDING_UPLOAD") return;
      await tx.document.update({ where: { id: row.id }, data: { status: "FAILED", failedAt: new Date(), failureCode: "STORAGE_FAILURE", updatedById: context.userId } });
    });
  }
}
