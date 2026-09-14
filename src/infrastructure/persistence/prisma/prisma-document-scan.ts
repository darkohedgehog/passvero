import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma, type PrismaClient, type Document } from "@/src/generated/prisma/client";
import type { AuthenticatedUserContext } from "@/src/application/context/authenticated-user-context";
import { DocumentError } from "@/src/application/documents/contracts";
import { documentBytesIdentitySchema } from "@/src/application/documents/pdf-validation";
import { scanAuditMetadata, scanLeaseActive, terminalScanSchema, type DocumentScanClaim, type DocumentScanPersistence, type TerminalScan } from "@/src/application/documents/malware-scan";
import { authorizeDocumentActor } from "./prisma-document-assets";

type Tx = Prisma.TransactionClient;
async function authority(tx: Tx, context: AuthenticatedUserContext) {
  await authorizeDocumentActor(tx, context, "PRODUCT_EDIT");
  // User has no status column. The locked Membership and restrictive FK prevent
  // deletion/reassignment of this User; the existence read needs no User UPDATE grant.
  const users = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT id FROM "User" WHERE id = ${context.userId}::uuid`);
  if (!users.length) throw new DocumentError("FORBIDDEN");
}
async function owned(tx: Tx, context: AuthenticatedUserContext, id: string) {
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "Document" WHERE id = ${id}::uuid AND "organizationId" = ${context.organizationId}::uuid FOR UPDATE`);
  const row = await tx.document.findFirst({ where: { id, organizationId: context.organizationId } });
  if (!row) throw new DocumentError("NOT_FOUND");
  if (row.status !== "AVAILABLE") throw new DocumentError("NOT_AVAILABLE");
  return row;
}
async function currentTime(tx: Tx): Promise<number> {
  // Read after row-lock acquisition: transaction start time could predate a lock wait.
  const [row] = await tx.$queryRaw<{ now: Date }[]>`SELECT date_trunc('milliseconds', clock_timestamp()) AS now`;
  return row.now.getTime();
}
function identity(row: Document) {
  const parsed = documentBytesIdentitySchema.safeParse({ sizeBytes: Number(row.sizeBytes), sha256: row.checksumSha256 });
  if (!parsed.success) throw new DocumentError("NOT_AVAILABLE");
  return parsed.data;
}
function matches(row: Document, claim: DocumentScanClaim, context: AuthenticatedUserContext) {
  return claim.actorId === context.userId && claim.organizationId === context.organizationId
    && row.id === claim.documentId && row.malwareScanAttemptId === claim.attemptId
    && row.malwareScanStartedAt?.getTime() === claim.startedAt && row.malwarePolicyVersion === claim.policyVersion
    && claim.policyVersion === 1 && row.checksumSha256 === claim.identity.sha256
    && Number(row.sizeBytes) === claim.identity.sizeBytes && row.storageProvider === claim.storage.provider
    && row.storageBucket === claim.storage.bucket && row.storageKey === claim.storage.key;
}
function duplicate(row: Document, result: TerminalScan) {
  if (row.malwareScanStatus !== result.status) return false;
  return result.status === "ERROR" ? row.malwareFailureCode === result.failureCode
    : row.malwareScanSha256 === result.identity.sha256 && row.malwareScanner === result.provenance.scanner
      && row.malwareEngineVersion === result.provenance.engineVersion && row.malwareSignatureVersion === result.provenance.signatureVersion;
}
export class PrismaDocumentScanPersistence implements DocumentScanPersistence {
  constructor(private readonly prisma: PrismaClient) {}
  private async run<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    try { return await this.prisma.$transaction(work); }
    catch (e) { if (e instanceof DocumentError) throw e; throw new DocumentError("OPERATIONAL_FAILURE"); }
  }
  claim(context: AuthenticatedUserContext, documentId: string): Promise<DocumentScanClaim> {
    if (!z.string().uuid().safeParse(documentId).success) throw new DocumentError("VALIDATION_ERROR");
    return this.run(async tx => {
      await authority(tx, context);
      const row = await owned(tx, context, documentId);
      const now = await currentTime(tx);
      if (row.malwareScanStatus === "PENDING") throw new DocumentError(scanLeaseActive(row.malwareScanStartedAt!.getTime(), now) ? "NOT_AVAILABLE" : "RECOVERY_REQUIRED");
      if (!["UNSCANNED", "ERROR", "CLEAN"].includes(row.malwareScanStatus)) throw new DocumentError("NOT_AVAILABLE");
      const bytes = identity(row);
      const attemptId = randomUUID();
      await tx.document.update({ where: { id: row.id }, data: {
        malwareScanStatus: "PENDING", malwareScanAttemptId: attemptId, malwareScanStartedAt: new Date(now), malwarePolicyVersion: 1,
        malwareScannedAt: null, malwareScanSha256: null, malwareScanner: null, malwareEngineVersion: null,
        malwareSignatureVersion: null, malwareFailureCode: null,
      } });
      return Object.freeze({ documentId, organizationId: context.organizationId, actorId: context.userId, attemptId, startedAt: now, policyVersion: 1 as const,
        identity: Object.freeze(bytes), storage: Object.freeze({ provider: row.storageProvider, bucket: row.storageBucket, key: row.storageKey }) });
    });
  }
  finalize(context: AuthenticatedUserContext, claim: DocumentScanClaim, input: TerminalScan): Promise<void> {
    return this.run(async tx => {
      const parsed = terminalScanSchema.safeParse(input);
      if (!parsed.success) throw new DocumentError("OPERATIONAL_FAILURE");
      const result = parsed.data;
      await authority(tx, context);
      const row = await owned(tx, context, claim.documentId);
      if (!matches(row, claim, context)) throw new DocumentError("RECOVERY_REQUIRED");
      if (result.status !== "ERROR" && (result.identity.sha256 !== claim.identity.sha256 || result.identity.sizeBytes !== claim.identity.sizeBytes)) throw new DocumentError("RECOVERY_REQUIRED");
      if (row.malwareScanStatus !== "PENDING") {
        if (duplicate(row, result)) return;
        throw new DocumentError("RECOVERY_REQUIRED");
      }
      const now = await currentTime(tx);
      if (!scanLeaseActive(claim.startedAt, now)) throw new DocumentError("RECOVERY_REQUIRED");
      await tx.document.update({ where: { id: row.id }, data: result.status === "ERROR" ? {
        malwareScanStatus: "ERROR", malwareFailureCode: result.failureCode,
      } : {
        malwareScanStatus: result.status, malwareScannedAt: new Date(now), malwareScanSha256: result.identity.sha256,
        malwareScanner: result.provenance.scanner, malwareEngineVersion: result.provenance.engineVersion,
        malwareSignatureVersion: result.provenance.signatureVersion,
      } });
      await tx.auditLog.create({ data: {
        organizationId: context.organizationId, actorId: context.userId, action: `DOCUMENT_MALWARE_SCAN_${result.status}`,
        entityType: "DOCUMENT", entityId: row.id, summary: "Document scan completed.", correlationId: context.correlationId,
        metadata: scanAuditMetadata(claim, result),
      } });
    });
  }
}
