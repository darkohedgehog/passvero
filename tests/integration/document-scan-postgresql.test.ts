import { healthFixture } from "../helpers/signature-health-fixture";
import { trustedProvenance } from "../../src/application/documents/malware-scan";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import test from "node:test";
import { Prisma } from "../../src/generated/prisma/client";
import { PrismaDocumentScanPersistence } from "../../src/infrastructure/persistence/prisma/prisma-document-scan";
import { createDocumentScanner } from "../../src/application/documents/scan-document";
import { DocumentError } from "../../src/application/documents/contracts";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import type { DocumentScanClaim, TerminalScan } from "../../src/application/documents/malware-scan";
import { createTestPrismaClient, requireSafeTestDatabaseConfig } from "../helpers/test-database";
const prisma = createTestPrismaClient(requireSafeTestDatabaseConfig(process.env));
test.after(() => prisma.$disconnect());
const bytes = Buffer.from("%PDF isolated workflow proof");
const identity = { sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
const proofHealth = healthFixture(Date.now());
const provenance = trustedProvenance(proofHealth, Date.now())!;
const clean: TerminalScan = { status: "CLEAN", identity, provenance };
const error: TerminalScan = { status: "ERROR", failureCode: "TIMEOUT" };
const isCode = (code: string) => (e: unknown) => e instanceof DocumentError && e.code === code;
async function fixture() {
  const user = await prisma.user.create({ data: { email: `${randomUUID()}@test.invalid` } });
  const uploader = await prisma.user.create({ data: { email: `${randomUUID()}@test.invalid` } });
  const org = await prisma.organization.create({ data: { displayName: "Isolated scan proof" } });
  const member = await prisma.membership.create({ data: { userId: user.id, organizationId: org.id, role: "EDITOR" } });
  const context: AuthenticatedUserContext = { userId: user.id, organizationId: org.id, membershipId: member.id, membershipRole: "EDITOR", membershipStatus: "ACTIVE", permissions: ["PRODUCT_EDIT"], correlationId: randomUUID() };
  const doc = await prisma.document.create({ data: { organizationId: org.id, originalFilename: "private.pdf", storageProvider: "fake", storageBucket: "private", storageKey: randomUUID(), mimeType: "application/pdf", sizeBytes: BigInt(bytes.length), checksumSha256: identity.sha256, status: "AVAILABLE", uploadedAt: new Date(), createdById: uploader.id } });
  const persistence = new PrismaDocumentScanPersistence(prisma);
  const row = () => prisma.document.findUniqueOrThrow({ where: { id: doc.id } });
  const audits = () => prisma.auditLog.findMany({ where: { entityId: doc.id } });
  return { context, doc, persistence, row, audits, claim: () => persistence.claim(context, doc.id), finalize: (claim: DocumentScanClaim, result: TerminalScan = clean) => persistence.finalize(context, claim, result) };
}
test("workflow scans another uploader's same-tenant unattached asset, exact audit and concurrent duplicates", async () => {
  const f = await fixture();
  const service = createDocumentScanner({ persistence: f.persistence,
    storage: { identity: () => ({ provider: "fake", bucket: "private", key: f.doc.storageKey }), async put() {}, async read(_id, opts) { assert.equal(opts?.limit, 10_485_760); return bytes; } },
    pdf: { async validate() { return { kind: "VALID", identity }; } }, scanner: { async scan() { return { kind: "OK", complete: true, identity }; } },
    health: { async read() { return proofHealth; } },
  });
  assert.deepEqual(await service(f.doc.id, f.context, { signal: new AbortController().signal }), { documentId: f.doc.id, status: "CLEAN" });
  const row = await f.row(); assert.equal(row.malwareScanSha256, identity.sha256);
  assert.deepEqual((await f.audits())[0].metadata, { attemptId: row.malwareScanAttemptId, policyVersion: 2 });
  const claim: DocumentScanClaim = { documentId: row.id, organizationId: row.organizationId, actorId: f.context.userId, startedAt: row.malwareScanStartedAt!.getTime(), attemptId: row.malwareScanAttemptId!, policyVersion: 2, identity, storage: { provider: row.storageProvider, bucket: row.storageBucket, key: row.storageKey } };
  await Promise.all([f.finalize(claim), f.finalize(claim)]); assert.equal((await f.audits()).length, 1); assert.deepEqual(await f.row(), row);
});
test("concurrent claims have one winner, active PENDING rejects without mutation/audit", async () => {
  const f = await fixture(); const results = await Promise.allSettled([f.claim(), f.claim()]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  const rejected = results.find(r => r.status === "rejected"); assert.ok(rejected?.status === "rejected" && isCode("NOT_AVAILABLE")(rejected.reason));
  const before = await f.row(); await assert.rejects(f.claim(), isCode("NOT_AVAILABLE")); assert.deepEqual(await f.row(), before); assert.deepEqual(await f.audits(), []);
});
test("expired PENDING and expired completion preserve attempt and audit", async () => {
  const f = await fixture(); const initial = await f.claim();
  await prisma.$executeRaw(Prisma.sql`UPDATE "Document" SET "malwareScanStartedAt" = date_trunc('milliseconds', clock_timestamp()) - interval '120 seconds' WHERE id = ${f.doc.id}::uuid`);
  const before = await f.row(); const claim = { ...initial, startedAt: before.malwareScanStartedAt!.getTime() };
  await assert.rejects(f.claim(), isCode("RECOVERY_REQUIRED")); await assert.rejects(f.finalize(claim), isCode("RECOVERY_REQUIRED"));
  assert.deepEqual(await f.row(), before); assert.deepEqual(await f.audits(), []);
});
test("mismatched completion cannot finalize; newer rescan cannot be overwritten", async () => {
  const f = await fixture(); const first = await f.claim();
  await assert.rejects(f.finalize({ ...first, attemptId: randomUUID() }), isCode("RECOVERY_REQUIRED"));
  assert.deepEqual(await f.audits(), []); await f.finalize(first, error);
  assert.deepEqual((await f.audits())[0].metadata, { attemptId: first.attemptId, policyVersion: 2, failureCode: "TIMEOUT" });
  const next = await f.claim(); assert.notEqual(next.attemptId, first.attemptId); const pending = await f.row();
  await assert.rejects(f.finalize(first), isCode("RECOVERY_REQUIRED")); assert.deepEqual(await f.row(), pending);
  await f.finalize(next); const third = await f.claim(); assert.notEqual(third.attemptId, next.attemptId);
  const reset = await f.row(); for (const key of ["malwareScannedAt", "malwareScanSha256", "malwareScanner", "malwareEngineVersion", "malwareSignatureVersion", "malwareFailureCode"] as const) assert.equal(reset[key], null);
});
test("INFECTED ordinary rescan is denied and terminal metadata satisfies constraints", async () => {
  const f = await fixture(); const claim = await f.claim(); await f.finalize(claim, { ...clean, status: "INFECTED" });
  const before = await f.row(); assert.equal(before.malwareFailureCode, null);
  await assert.rejects(f.claim(), isCode("NOT_AVAILABLE")); assert.deepEqual(await f.row(), before);
  assert.deepEqual((await f.audits())[0].metadata, { attemptId: claim.attemptId, policyVersion: 2 });
});
test("missing permission, membership and organization inactivity rejected in claim and finalization", async () => {
  for (const revoke of ["context", "membership", "organization", "role"] as const) {
    const f = await fixture(); const claim = await f.claim();
    if (revoke === "context") { const denied = { ...f.context, permissions: [] }; await assert.rejects(f.persistence.claim(denied, f.doc.id), isCode("FORBIDDEN")); await assert.rejects(f.persistence.finalize(denied, claim, clean), isCode("FORBIDDEN")); }
    else {
      if (revoke === "membership") await prisma.membership.update({ where: { id: f.context.membershipId }, data: { status: "SUSPENDED" } });
      if (revoke === "organization") await prisma.organization.update({ where: { id: f.context.organizationId }, data: { status: "SUSPENDED" } });
      if (revoke === "role") await prisma.membership.update({ where: { id: f.context.membershipId }, data: { role: "VIEWER" } });
      await assert.rejects(f.claim(), isCode("FORBIDDEN")); await assert.rejects(f.finalize(claim), isCode("FORBIDDEN"));
    }
    assert.equal((await f.row()).malwareScanStatus, "PENDING"); assert.deepEqual(await f.audits(), []);
  }
});
test("cross-tenant, non-AVAILABLE, changed storage and integrity cannot finalize", async () => {
  const f = await fixture(); const g = await fixture(); const claim = await f.claim();
  await assert.rejects(f.persistence.claim(g.context, f.doc.id), isCode("NOT_FOUND"));
  await assert.rejects(f.persistence.finalize(g.context, claim, clean), isCode("NOT_FOUND"));
  await prisma.document.update({ where: { id: f.doc.id }, data: { status: "ARCHIVED", archivedAt: new Date() } });
  await assert.rejects(f.claim(), isCode("NOT_AVAILABLE")); await assert.rejects(f.finalize(claim), isCode("NOT_AVAILABLE"));
  const h = await fixture(); const hc = await h.claim(); await prisma.document.update({ where: { id: h.doc.id }, data: { storageKey: randomUUID() } });
  await assert.rejects(h.finalize(hc), isCode("RECOVERY_REQUIRED")); assert.deepEqual(await h.audits(), []);
  const j = await fixture(); const jc = await j.claim(); await prisma.document.update({ where: { id: j.doc.id }, data: { checksumSha256: "a".repeat(64) } });
  await assert.rejects(j.finalize(jc), isCode("RECOVERY_REQUIRED")); assert.deepEqual(await j.audits(), []);
});
test("audit insertion failure rolls back verdict; duplicate ERROR creates no second audit", async () => {
  const f = await fixture(); const claim = await f.claim(); const before = await f.row();
  const broken = prisma.$extends({ query: { auditLog: { async create() { throw new Error("injected audit failure"); } } } });
  await assert.rejects(new PrismaDocumentScanPersistence(broken as unknown as typeof prisma).finalize(f.context, claim, clean), isCode("OPERATIONAL_FAILURE"));
  assert.deepEqual(await f.row(), before); assert.deepEqual(await f.audits(), []);
  await f.finalize(claim, error); await f.finalize(claim, error);
  assert.equal((await f.audits()).length, 1); const row = await f.row(); assert.equal(row.malwareFailureCode, "TIMEOUT"); assert.equal(row.malwareScannedAt, null);
});

test("policy 2 claim never migrates an old terminal verdict without explicit claim", async () => {
  const f = await fixture();
  await prisma.document.update({ where: { id: f.doc.id }, data: { malwareScanStatus: "ERROR", malwareScanAttemptId: randomUUID(), malwareScanStartedAt: new Date(0), malwarePolicyVersion: 1, malwareFailureCode: "TIMEOUT" } });
  const before = await f.row(); assert.equal(before.malwarePolicyVersion, 1);
  const claim = await f.persistence.claim(f.context, f.doc.id);
  assert.equal(claim.policyVersion, 2); assert.equal((await f.row()).malwarePolicyVersion, 2);
});
