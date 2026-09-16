import { DOCUMENT_SECURITY_POLICY_VERSION } from "@/src/application/documents/document-security-policy";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma, type PrismaClient, type Document } from "@/src/generated/prisma/client";
import type { AuthenticatedUserContext } from "@/src/application/context/authenticated-user-context";
import { DocumentError } from "@/src/application/documents/contracts";
import { documentBytesIdentitySchema } from "@/src/application/documents/pdf-validation";
import { scanAuditMetadata, scanLeaseActive, scanLeaseExpired, terminalScanSchema, type DocumentScanClaim, type DocumentScanPersistence, type TerminalScan } from "@/src/application/documents/malware-scan";
import { authorizeDocumentActor } from "./prisma-document-assets";

import type { DocumentScanRecoveryPersistence } from "@/src/application/documents/recover-document-scan";

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
  // Numeric epoch avoids adapter/session timezone reinterpretation of SQL timestamps.
  const [row] = await tx.$queryRaw<{ milliseconds: bigint }[]>`SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint AS milliseconds`;
  const now = Number(row.milliseconds);
  if (!Number.isSafeInteger(now) || now < 0) throw new DocumentError("OPERATIONAL_FAILURE");
  return now;
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
    && claim.policyVersion === DOCUMENT_SECURITY_POLICY_VERSION && row.checksumSha256 === claim.identity.sha256
    && Number(row.sizeBytes) === claim.identity.sizeBytes && row.storageProvider === claim.storage.provider
    && row.storageBucket === claim.storage.bucket && row.storageKey === claim.storage.key;
}
function duplicate(row: Document, result: TerminalScan) {
  if (row.malwareScanStatus !== result.status) return false;
  return result.status === "ERROR" ? row.malwareFailureCode === result.failureCode
    : row.malwareScanSha256 === result.identity.sha256 && row.malwareScanner === result.provenance.scanner
      && row.malwareEngineVersion === result.provenance.engineVersion && row.malwareSignatureVersion === result.provenance.signatureVersion;
}
export class PrismaDocumentScanPersistence implements DocumentScanPersistence, DocumentScanRecoveryPersistence {
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
        malwareScanStatus: "PENDING", malwareScanAttemptId: attemptId, malwareScanStartedAt: new Date(now), malwarePolicyVersion: DOCUMENT_SECURITY_POLICY_VERSION,
        malwareScannedAt: null, malwareScanSha256: null, malwareScanner: null, malwareEngineVersion: null,
        malwareSignatureVersion: null, malwareFailureCode: null,
      } });
      return Object.freeze({ documentId, organizationId: context.organizationId, actorId: context.userId, attemptId, startedAt: now, policyVersion: DOCUMENT_SECURITY_POLICY_VERSION,
        identity: Object.freeze(bytes), storage: Object.freeze({ provider: row.storageProvider, bucket: row.storageBucket, key: row.storageKey }) });
    });
  }
  recover(context: AuthenticatedUserContext, documentId: string, expectedAttemptId: string): Promise<"UPDATED" | "NO_CHANGE"> {
    if (![documentId, expectedAttemptId].every(id => z.string().uuid().safeParse(id).success)) throw new DocumentError("VALIDATION_ERROR");
    return this.run(async tx => {
      await authority(tx, context);
      const row = await owned(tx, context, documentId);
      if (row.malwareScanAttemptId !== expectedAttemptId) throw new DocumentError("RECOVERY_REQUIRED");
      // Persisted evidence cannot distinguish prior recovery from normal TIMEOUT finalization.
      if (row.malwareScanStatus === "ERROR" && row.malwareFailureCode === "TIMEOUT") return "NO_CHANGE";
      if (row.malwareScanStatus !== "PENDING") throw new DocumentError("NOT_AVAILABLE");
      const now = await currentTime(tx);
      if (!row.malwareScanStartedAt || !scanLeaseExpired(row.malwareScanStartedAt.getTime(), now)) throw new DocumentError("NOT_AVAILABLE");
      await tx.document.update({ where: { id: row.id }, data: {
        malwareScanStatus: "ERROR", malwareFailureCode: "TIMEOUT",
        malwareScannedAt: null, malwareScanSha256: null, malwareScanner: null,
        malwareEngineVersion: null, malwareSignatureVersion: null,
      } });
      await tx.auditLog.create({ data: {
        organizationId: context.organizationId, actorId: context.userId, action: "DOCUMENT_MALWARE_SCAN_ERROR",
        entityType: "DOCUMENT", entityId: row.id, summary: "Document scan attempt lease expired.", correlationId: context.correlationId,
        metadata: scanAuditMetadata({ attemptId: expectedAttemptId, policyVersion: row.malwarePolicyVersion! }, { status: "ERROR", failureCode: "TIMEOUT" }),
      } });
      return "UPDATED";
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
