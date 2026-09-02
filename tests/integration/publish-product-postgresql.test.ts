import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { PRODUCT_PUBLISH } from "../../src/application/permissions/product-permissions";
import { createPublishProductService } from "../../src/application/products/publish-product/publish-product";
import { PrismaPublishProductPersistence, PrismaPublishProductTransactionRunner } from "../../src/infrastructure/persistence/prisma/prisma-publish-product";
import { createTestPrismaClient, requireSafeTestDatabaseConfig } from "../helpers/test-database";

const config = requireSafeTestDatabaseConfig(process.env);
const prisma = createTestPrismaClient(config);
test.after(async () => prisma.$disconnect());

test("proves publication race republication stable Passport QR and rollback atomicity", async () => {
  const userId = randomUUID(), organizationId = randomUUID(), membershipId = randomUUID(), productId = randomUUID(), draftId = randomUUID();
  const publicCode = randomUUID().replaceAll("-", "").slice(0, 22);
  await prisma.user.create({ data: { id: userId, email: `${userId}@test.invalid` } });
  await prisma.organization.create({ data: { id: organizationId, displayName: "Publication proof" } });
  await prisma.membership.create({ data: { id: membershipId, organizationId, userId, role: "ADMIN", status: "ACTIVE", joinedAt: new Date() } });
  await prisma.product.create({ data: { id: productId, organizationId, internalName: "Chair", publicCode, lifecycleStatus: "ACTIVE", createdById: userId, updatedById: userId } });
  await prisma.productVersion.create({ data: { id: draftId, productId, organizationId, status: "DRAFT", sourceLocale: "hr", createdById: userId, updatedById: userId, translations: { create: { locale: "hr", productName: "Stolica" } } } });
  await prisma.product.update({ where: { id: productId }, data: { currentDraftVersionId: draftId } });
  const context: AuthenticatedUserContext = { userId, organizationId, membershipId, membershipRole: "ADMIN", membershipStatus: "ACTIVE", permissions: ["PRODUCT_READ", PRODUCT_PUBLISH], correlationId: "publication-proof" };
  const persistence = new PrismaPublishProductPersistence(prisma);
  const service = createPublishProductService({ transactionRunner: new PrismaPublishProductTransactionRunner(prisma), persistence, now: () => new Date(), generateQrCode: () => randomUUID().toUpperCase(), canonicalOrigin: "https://passvero.eu" });
  const evidence = await readEvidence(productId);
  const race = await Promise.allSettled([service(evidence, context), service(evidence, context)]);
  assert.equal(race.filter((result) => result.status === "fulfilled").length, 2);
  assert.deepEqual(race.flatMap((result) => result.status === "fulfilled" ? [result.value.status] : []).sort(), ["NO_CHANGE", "PUBLISHED"]);
  let state = await readState(productId);
  assert.equal(state.product.currentDraftVersionId, null);
  assert.equal(state.product.currentPublishedVersionId, draftId);
  assert.equal(state.versions.filter(({ status }) => status === "PUBLISHED").length, 1);
  assert.equal(state.audits.length, 1);
  assert.equal(state.passports.length, 1);
  assert.equal(state.qrCodes.length, 1);
  assert.equal(state.qrCodes[0]?.status, "PENDING");
  const stablePassport = state.passports[0]!.id, stableQr = state.qrCodes[0]!.id, stableUrl = state.qrCodes[0]!.targetUrl;

  const secondDraft = await createDraft(productId, organizationId, userId, "Second");
  assert.equal((await service(await readEvidence(productId), context)).versionNumber, 2);
  state = await readState(productId);
  assert.equal(state.versions.find(({ id }) => id === draftId)?.status, "SUPERSEDED");
  assert.equal(state.product.currentPublishedVersionId, secondDraft);
  assert.equal(state.passports[0]?.id, stablePassport);
  assert.equal(state.qrCodes[0]?.id, stableQr);
  assert.equal(state.qrCodes[0]?.targetUrl, stableUrl);
  assert.equal(state.audits.length, 2);

  const rollbackDraft = await createDraft(productId, organizationId, userId, "Rollback");
  const before = await readState(productId);
  const failing = createPublishProductService({ transactionRunner: new PrismaPublishProductTransactionRunner(prisma), persistence: { ...persistence, readEligibility: persistence.readEligibility.bind(persistence), readProductForPublication: persistence.readProductForPublication.bind(persistence), readVersion: persistence.readVersion.bind(persistence), readReadiness: persistence.readReadiness.bind(persistence), readPassport: persistence.readPassport.bind(persistence), nextVersionNumber: persistence.nextVersionNumber.bind(persistence), async applyPublication(tx, input) { await persistence.applyPublication(tx, input); throw new Error("injected rollback"); } }, now: () => new Date(), generateQrCode: () => randomUUID().toUpperCase(), canonicalOrigin: "https://passvero.eu" });
  await assert.rejects(failing(await readEvidence(productId), context));
  assert.deepEqual(await readState(productId), before);
  assert.equal((await prisma.productVersion.findUniqueOrThrow({ where: { id: rollbackDraft } })).status, "DRAFT");
});

async function createDraft(productId: string, organizationId: string, userId: string, name: string) {
  const id = randomUUID();
  await prisma.productVersion.create({ data: { id, productId, organizationId, status: "DRAFT", sourceLocale: "hr", createdById: userId, updatedById: userId, translations: { create: { locale: "hr", productName: name } } } });
  await prisma.product.update({ where: { id: productId }, data: { currentDraftVersionId: id } });
  return id;
}
async function readEvidence(productId: string) {
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId }, include: { currentDraftVersion: true } });
  assert.ok(product.currentDraftVersion);
  return { productId, expectedDraftVersionId: product.currentDraftVersion.id, expectedProductUpdatedAt: product.updatedAt.toISOString(), expectedDraftUpdatedAt: product.currentDraftVersion.updatedAt.toISOString(), expectedCurrentPublishedVersionId: product.currentPublishedVersionId };
}
async function readState(productId: string) {
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId }, select: { currentDraftVersionId: true, currentPublishedVersionId: true, lastPublishedAt: true } });
  const versions = await prisma.productVersion.findMany({ where: { productId }, select: { id: true, status: true, versionNumber: true, publishedAt: true, supersededAt: true }, orderBy: { createdAt: "asc" } });
  const passports = await prisma.passport.findMany({ where: { productId }, select: { id: true, firstPublishedAt: true, lastPublishedAt: true } });
  const qrCodes = await prisma.qRCode.findMany({ where: { passport: { productId } }, select: { id: true, status: true, code: true, targetUrl: true } });
  const audits = await prisma.auditLog.findMany({ where: { entityType: "PRODUCT", entityId: productId }, select: { action: true, metadata: true }, orderBy: { occurredAt: "asc" } });
  return { product, versions, passports, qrCodes, audits };
}
