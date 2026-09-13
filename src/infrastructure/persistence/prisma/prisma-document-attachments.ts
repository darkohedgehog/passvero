import { Prisma, type PrismaClient } from "@/src/generated/prisma/client";
import type { AttachmentPersistence, AttachmentDependencies } from "@/src/application/products/document-attachments/contracts";
import { PrismaTranslationManagementPersistence } from "./prisma-translation-management";

type Tx = Prisma.TransactionClient;
export const attachmentSelect = { id: true, productVersionId: true, documentId: true, category: true,
  locale: true, displayLabel: true, description: true, isPublic: true, isPrimary: true, sortOrder: true,
  updatedAt: true, document: { select: { organizationId: true, status: true } } } as const;
export class PrismaDocumentAttachments implements AttachmentPersistence<Tx> {
  private readonly existing: PrismaTranslationManagementPersistence;
  constructor(prisma: PrismaClient) { this.existing = new PrismaTranslationManagementPersistence(prisma); }
  async readEligibility(tx: Tx, input: Parameters<AttachmentPersistence<Tx>["readEligibility"]>[1]) {
    // Hold the revalidated authority until the authoring transaction commits.
    await tx.$queryRaw(Prisma.sql`SELECT m."id" FROM "Membership" m JOIN "Organization" o ON o."id"=m."organizationId" WHERE m."id"=${input.membershipId}::uuid AND m."userId"=${input.userId}::uuid AND m."organizationId"=${input.organizationId}::uuid FOR SHARE OF m,o`);
    return this.existing.readEligibility(tx, input);
  }
  touch(tx: Tx, input: Parameters<AttachmentPersistence<Tx>["touch"]>[1]) { return this.existing.touch(tx, input); }
  async lockState(tx: Tx, productId: string, organizationId: string) {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Product" WHERE "id"=${productId}::uuid AND "organizationId"=${organizationId}::uuid FOR UPDATE`);
    const row = await tx.product.findFirst({ where: { id: productId, organizationId }, select: {
      id: true, organizationId: true, lifecycleStatus: true, currentDraftVersionId: true, updatedAt: true,
      currentDraftVersion: { select: { id: true, productId: true, organizationId: true, status: true, updatedAt: true,
        productDocuments: { select: attachmentSelect, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } } },
    } });
    return row === null ? null : { ...row, draft: row.currentDraftVersion === null ? null : { ...row.currentDraftVersion, attachments: row.currentDraftVersion.productDocuments } };
  }
  async readDocument(tx: Tx, documentId: string, organizationId: string) {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Document" WHERE "id"=${documentId}::uuid AND "organizationId"=${organizationId}::uuid FOR SHARE`);
    return tx.document.findFirst({ where: { id: documentId, organizationId }, select: { status: true } });
  }
  async attach(tx: Tx, draftId: string, documentId: string, metadata: Parameters<AttachmentPersistence<Tx>["attach"]>[3], sortOrder: number) {
    await tx.productDocument.create({ data: { productVersionId: draftId, documentId, ...metadata, isPrimary: false, sortOrder }, select: { id: true } });
  }
  async edit(tx: Tx, draftId: string, row: Parameters<AttachmentPersistence<Tx>["edit"]>[2], metadata: Parameters<AttachmentPersistence<Tx>["edit"]>[3], sortOrder: number) {
    return (await tx.productDocument.updateMany({ where: { id: row.id, productVersionId: draftId, documentId: row.documentId, updatedAt: row.updatedAt }, data: { ...metadata, sortOrder, updatedAt: new Date(Math.max(Date.now(), row.updatedAt.getTime()+1)) } })).count === 1;
  }
  async remove(tx: Tx, draftId: string, row: Parameters<AttachmentPersistence<Tx>["remove"]>[2]) {
    return (await tx.productDocument.deleteMany({ where: { id: row.id, productVersionId: draftId, documentId: row.documentId, updatedAt: row.updatedAt } })).count === 1;
  }
  async audit(tx: Tx, context: Parameters<AttachmentPersistence<Tx>["audit"]>[1], productId: string, operation: Parameters<AttachmentPersistence<Tx>["audit"]>[3]) {
    const operations = { ATTACH: "DOCUMENT_ATTACHED", EDIT: "DOCUMENT_METADATA_UPDATED", REMOVE: "DOCUMENT_REMOVED" };
    await tx.auditLog.create({ data: { organizationId: context.organizationId, actorId: context.userId,
      action: "PRODUCT_UPDATED", entityType: "PRODUCT", entityId: productId, summary: "Product updated.",
      metadata: { operation: operations[operation] }, correlationId: context.correlationId }, select: { id: true } });
  }
}
export function createPrismaAttachmentDependencies(prisma: PrismaClient): AttachmentDependencies<Tx> {
  return { persistence: new PrismaDocumentAttachments(prisma), transactionRunner: { run: work => prisma.$transaction(work) } };
}
