import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Prisma } from "../../src/generated/prisma/client";
import { PrismaDocumentScanPersistence } from "../../src/infrastructure/persistence/prisma/prisma-document-scan";
import { createDocumentScanRecovery } from "../../src/application/documents/recover-document-scan";
import { DocumentError } from "../../src/application/documents/contracts";
import type { DocumentScanClaim, TerminalScan } from "../../src/application/documents/malware-scan";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { createTestPrismaClient, requireSafeTestDatabaseConfig } from "../helpers/test-database";
const prisma = createTestPrismaClient(requireSafeTestDatabaseConfig(process.env));
test.after(() => prisma.$disconnect());
const isCode = (code: string) => (e: unknown) => e instanceof DocumentError && e.code === code;
async function fixture(policyVersion = 7) {
  const uploader = await prisma.user.create({ data: { email: `${randomUUID()}@test.invalid` } });
  const user = await prisma.user.create({ data: { email: `${randomUUID()}@test.invalid` } });
  const org = await prisma.organization.create({ data: { displayName: "Recovery proof" } });
  const membership = await prisma.membership.create({ data: { organizationId: org.id, userId: user.id, role: "EDITOR" } });
  const context: AuthenticatedUserContext = { userId: user.id, organizationId: org.id, membershipId: membership.id, membershipRole: "EDITOR", membershipStatus: "ACTIVE", permissions: ["PRODUCT_EDIT"], correlationId: randomUUID() };
  const row = await prisma.document.create({ data: { organizationId: org.id, originalFilename: "private.pdf", storageProvider: "fake", storageBucket: "private", storageKey: randomUUID(), mimeType: "application/pdf", sizeBytes: 1, checksumSha256: "a".repeat(64), status: "AVAILABLE", uploadedAt: new Date(), createdById: uploader.id, malwareScanStatus: "PENDING", malwareScanAttemptId: randomUUID(), malwareScanStartedAt: new Date(0), malwarePolicyVersion: policyVersion } });
  const persistence = new PrismaDocumentScanPersistence(prisma);
  const recover = createDocumentScanRecovery(persistence);
  return { row, context, persistence, recover: () => recover(row.id, row.malwareScanAttemptId!, context), read: () => prisma.document.findUniqueOrThrow({ where: { id: row.id } }), audits: () => prisma.auditLog.findMany({ where: { entityId: row.id } }) };
}
test("authorized other same-tenant user closes expired unattached asset, preserves policy and exact audit", async () => {
  const f = await fixture(); assert.notEqual(f.row.createdById, f.context.userId);
  assert.deepEqual(await f.recover(), { documentId: f.row.id, status: "UPDATED" });
  const after = await f.read();
  assert.equal(after.malwareScanStatus, "ERROR"); assert.equal(after.malwareFailureCode, "TIMEOUT");
  assert.equal(after.malwareScanAttemptId, f.row.malwareScanAttemptId); assert.deepEqual(after.malwareScanStartedAt, f.row.malwareScanStartedAt); assert.equal(after.malwarePolicyVersion, 7);
  for (const key of ["malwareScannedAt", "malwareScanSha256", "malwareScanner", "malwareEngineVersion", "malwareSignatureVersion"] as const) assert.equal(after[key], null);
  const audits = await f.audits(); assert.equal(audits.length, 1); assert.equal(audits[0].actorId, f.context.userId); assert.equal(audits[0].action, "DOCUMENT_MALWARE_SCAN_ERROR");
  assert.deepEqual(audits[0].metadata, { attemptId: f.row.malwareScanAttemptId, policyVersion: 7, failureCode: "TIMEOUT" });
  assert.equal(after.status, "AVAILABLE"); assert.equal(after.storageKey, f.row.storageKey);
});
test("concurrent recovery mutates/audits once; duplicate means only already closed", async () => {
  const f = await fixture(); const results = await Promise.all([f.recover(), f.recover()]);
  assert.deepEqual(results.map(r => r.status).sort(), ["NO_CHANGE", "UPDATED"]); assert.equal((await f.audits()).length, 1);
  const before = await f.read(); assert.equal((await f.recover()).status, "NO_CHANGE"); assert.deepEqual(await f.read(), before); assert.equal((await f.audits()).length, 1);
  const g = await fixture(); await prisma.document.update({ where: { id: g.row.id }, data: { malwareScanStatus: "ERROR", malwareFailureCode: "TIMEOUT" } });
  assert.equal((await g.recover()).status, "NO_CHANGE"); assert.deepEqual(await g.audits(), []);
});
test("permission, revoked membership, inactive organization and DB role revalidated", async () => {
  for (const reason of ["permission", "membership", "organization", "role"] as const) {
    const f = await fixture(); const before = await f.read();
    if (reason === "permission") await assert.rejects(f.persistence.recover({ ...f.context, permissions: [] }, f.row.id, f.row.malwareScanAttemptId!), isCode("FORBIDDEN"));
    else {
      if (reason === "membership") await prisma.membership.update({ where: { id: f.context.membershipId }, data: { status: "SUSPENDED" } });
      if (reason === "organization") await prisma.organization.update({ where: { id: f.context.organizationId }, data: { status: "SUSPENDED" } });
      if (reason === "role") await prisma.membership.update({ where: { id: f.context.membershipId }, data: { role: "VIEWER" } });
      await assert.rejects(f.recover(), isCode("FORBIDDEN"));
    }
    assert.deepEqual(await f.read(), before); assert.deepEqual(await f.audits(), []);
  }
});
test("cross tenant, non-AVAILABLE, mismatched and active attempts reject without writes", async () => {
  const f = await fixture(); const g = await fixture();
  await assert.rejects(f.persistence.recover(g.context, f.row.id, f.row.malwareScanAttemptId!), isCode("NOT_FOUND"));
  await assert.rejects(f.persistence.recover(f.context, f.row.id, randomUUID()), isCode("RECOVERY_REQUIRED"));
  await prisma.$executeRaw(Prisma.sql`UPDATE "Document" SET "malwareScanStartedAt" = date_trunc('milliseconds', clock_timestamp()) WHERE id = ${f.row.id}::uuid`);
  const active = await f.read(); await assert.rejects(f.recover(), isCode("NOT_AVAILABLE")); assert.deepEqual(await f.read(), active);
  await prisma.document.update({ where: { id: f.row.id }, data: { status: "ARCHIVED", archivedAt: new Date() } });
  const archived = await f.read(); await assert.rejects(f.recover(), isCode("NOT_AVAILABLE")); assert.deepEqual(await f.read(), archived); assert.deepEqual(await f.audits(), []);
});
test("CLEAN/INFECTED and other ERROR outcomes preserved", async () => {
  for (const status of ["CLEAN", "INFECTED", "ERROR"] as const) {
    const f = await fixture();
    await prisma.document.update({ where: { id: f.row.id }, data: status === "ERROR" ? { malwareScanStatus: status, malwareFailureCode: "INTERRUPTED" } : { malwareScanStatus: status, malwareScannedAt: new Date(), malwareScanSha256: f.row.checksumSha256, malwareScanner: "fake", malwareEngineVersion: "1", malwareSignatureVersion: "1" } });
    const before = await f.read(); await assert.rejects(f.recover(), isCode("NOT_AVAILABLE")); assert.deepEqual(await f.read(), before); assert.deepEqual(await f.audits(), []);
  }
});
test("expired completion cannot write; recovered attempt rejects late verdict; stale recovery cannot affect explicit new claim", async () => {
  const f = await fixture(2);
  const claim: DocumentScanClaim = { documentId: f.row.id, organizationId: f.context.organizationId, actorId: f.context.userId, attemptId: f.row.malwareScanAttemptId!, startedAt: f.row.malwareScanStartedAt!.getTime(), policyVersion: 2, identity: { sizeBytes: 1, sha256: f.row.checksumSha256 }, storage: { provider: f.row.storageProvider, bucket: f.row.storageBucket, key: f.row.storageKey } };
  const clean: TerminalScan = { status: "CLEAN", identity: claim.identity, provenance: { scanner: "fake", engineVersion: "1", signatureVersion: "1", diskManifestSha256: "db", daemonVersionTime: "load" } };
  await assert.rejects(f.persistence.finalize(f.context, claim, clean), isCode("RECOVERY_REQUIRED")); assert.deepEqual(await f.audits(), []);
  await f.recover(); const recovered = await f.read();
  await assert.rejects(f.persistence.finalize(f.context, claim, clean), isCode("RECOVERY_REQUIRED"));
  await f.persistence.finalize(f.context, claim, { status: "ERROR", failureCode: "TIMEOUT" });
  assert.deepEqual(await f.read(), recovered); assert.equal((await f.audits()).length, 1);
  const newer = await f.persistence.claim(f.context, f.row.id); assert.notEqual(newer.attemptId, claim.attemptId);
  const pending = await f.read(); await assert.rejects(f.recover(), isCode("RECOVERY_REQUIRED")); assert.deepEqual(await f.read(), pending); assert.equal((await f.audits()).length, 1);
});
test("audit failure rolls back recovery state and preserves old attempt", async () => {
  const f = await fixture(); const before = await f.read();
  const broken = prisma.$extends({ query: { auditLog: { async create() { throw new Error("injected audit failure"); } } } });
  await assert.rejects(new PrismaDocumentScanPersistence(broken as unknown as typeof prisma).recover(f.context, f.row.id, f.row.malwareScanAttemptId!), isCode("OPERATIONAL_FAILURE"));
  assert.deepEqual(await f.read(), before); assert.deepEqual(await f.audits(), []);
});
