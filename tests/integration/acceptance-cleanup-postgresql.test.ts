import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaAcceptanceCleanup } from "../../src/infrastructure/persistence/prisma/prisma-acceptance-cleanup";
import type { AcceptanceManifest } from "../../src/application/documents/acceptance-cleanup";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { createTestPrismaClient, requireSafeTestDatabaseConfig } from "../helpers/test-database";
const prisma = createTestPrismaClient(requireSafeTestDatabaseConfig(process.env));
test.after(() => prisma.$disconnect());
async function fixture() {
  const user = await prisma.user.create({ data: { email: `${randomUUID()}@test.invalid` } });
  const org = await prisma.organization.create({ data: { displayName: "Acceptance cleanup proof" } });
  const membership = await prisma.membership.create({ data: { organizationId: org.id, userId: user.id, role: "EDITOR" } });
  const context: AuthenticatedUserContext = { userId: user.id, organizationId: org.id, membershipId: membership.id, membershipRole: "EDITOR", membershipStatus: "ACTIVE", permissions: ["PRODUCT_EDIT"], correlationId: randomUUID() };
  const runId = randomUUID();
  const row = await prisma.document.create({ data: { organizationId: org.id, originalFilename: "synthetic.pdf", displayName: `acceptance:${runId}`, storageProvider: "supabase", storageBucket: "passvero-staging-documents", storageKey: `documents/${randomUUID()}.pdf`, mimeType: "application/pdf", sizeBytes: 1, checksumSha256: "a".repeat(64), status: "AVAILABLE", uploadedAt: new Date(), createdById: user.id } });
  await prisma.auditLog.create({ data: { organizationId: org.id, actorId: user.id, action: "DOCUMENT_UPLOADED", entityType: "DOCUMENT", entityId: row.id, summary: "Synthetic proof." } });
  const manifest: AcceptanceManifest = { version: 1, environment: "staging", runId, actorId: user.id, organizationId: org.id, entries: [{ documentId: row.id, storageKey: row.storageKey, checksumSha256: row.checksumSha256, sizeBytes: 1 }] };
  const persistence = new PrismaAcceptanceCleanup(prisma);
  return { row, manifest, context, persistence, run: () => persistence.archive(context, manifest, manifest.entries[0]) };
}
test("archive retains row/audit, exact repeat is no-op", async () => {
  const f = await fixture(); const audits = await prisma.auditLog.findMany({ where: { entityId: f.row.id } });
  await f.run(); const archived = await prisma.document.findUniqueOrThrow({ where: { id: f.row.id } });
  assert.equal(archived.status, "ARCHIVED"); assert.equal(archived.archivedById, f.context.userId);
  await f.run(); assert.deepEqual(await prisma.document.findUnique({ where: { id: f.row.id } }), archived);
  assert.deepEqual(await prisma.auditLog.findMany({ where: { entityId: f.row.id } }), audits);
});
test("wrong tenant, marker, storage, checksum, actor and permission reject without writes", async () => {
  for (const reason of ["tenant", "marker", "key", "checksum", "actor", "permission"] as const) {
    const f = await fixture(); const entry = { ...f.manifest.entries[0] };
    const manifest = { ...f.manifest }; const context = { ...f.context };
    if (reason === "tenant") context.organizationId = randomUUID();
    if (reason === "marker") manifest.runId = randomUUID();
    if (reason === "key") entry.storageKey = `documents/${randomUUID()}.pdf`;
    if (reason === "checksum") entry.checksumSha256 = "b".repeat(64);
    if (reason === "actor") manifest.actorId = randomUUID();
    if (reason === "permission") context.permissions = [];
    await assert.rejects(f.persistence.archive(context, manifest, entry));
    assert.deepEqual(await prisma.document.findUnique({ where: { id: f.row.id } }), f.row);
  }
});
test("any attachment including public linkage prevents archive and retains references", async () => {
  for (const isPublic of [true, false]) {
    const f = await fixture();
    const product = await prisma.product.create({ data: { organizationId: f.context.organizationId, internalName: "Proof", publicCode: randomUUID() } });
    const version = await prisma.productVersion.create({ data: { organizationId: f.context.organizationId, productId: product.id, sourceLocale: "hr" } });
    const link = await prisma.productDocument.create({ data: { productVersionId: version.id, documentId: f.row.id, category: "MANUAL", isPublic } });
    await assert.rejects(f.run(), /FORBIDDEN/);
    assert.deepEqual(await prisma.document.findUnique({ where: { id: f.row.id } }), f.row);
    assert.deepEqual(await prisma.productDocument.findUnique({ where: { id: link.id } }), link);
  }
});
