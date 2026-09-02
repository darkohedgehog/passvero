import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { ApplicationError } from "../../src/application/errors/application-error";
import { PRODUCT_PUBLISH } from "../../src/application/permissions/product-permissions";
import { createCnClassificationCurrentDraftServices } from "../../src/application/products/cn-classification-current-draft/services";
import { createUpdateDraftTranslationContentService } from "../../src/application/products/draft-translation-content/update-draft-translation-content";
import { createEditProductDraftService } from "../../src/application/products/edit-product-draft/edit-product-draft";
import type { PublishProductCommand } from "../../src/application/products/publish-product/contracts";
import type { PublishProductPersistence } from "../../src/application/products/publish-product/ports";
import { createPublishProductService } from "../../src/application/products/publish-product/publish-product";
import { createProductMaterialsCurrentDraftServices } from "../../src/application/products/product-materials-current-draft/services";
import { Prisma } from "../../src/generated/prisma/client";
import { createPrismaCnClassificationCurrentDraftDependencies } from "../../src/infrastructure/persistence/prisma/prisma-cn-classification-current-draft-composition";
import { createPrismaDraftTranslationContentDependencies } from "../../src/infrastructure/persistence/prisma/prisma-draft-translation-content-composition";
import { createPrismaEditProductDraftDependencies } from "../../src/infrastructure/persistence/prisma/prisma-edit-product-draft-composition";
import { PrismaPublishProductPersistence, PrismaPublishProductTransactionRunner, type PublishProductPrismaTransaction } from "../../src/infrastructure/persistence/prisma/prisma-publish-product";
import { createPrismaProductMaterialsCurrentDraftDependencies } from "../../src/infrastructure/persistence/prisma/prisma-product-materials-current-draft-composition";
import { createTestPrismaClient, requireSafeTestDatabaseConfig } from "../helpers/test-database";

const ORIGIN = "https://passvero.eu";
const config = requireSafeTestDatabaseConfig(process.env);
const prisma = createTestPrismaClient(config);
test.after(async () => prisma.$disconnect());

test("proves first publication exact replay and published aggregate immutability", async () => {
  const fixture = await seedDraftFixture(true);
  const beforeAuthored = await readAuthored(fixture.productId);
  const evidence = await readEvidence(fixture.productId);
  const result = await service(fixture.publishedAt)(evidence, fixture.context);
  assert.deepEqual(result, { productId: fixture.productId, status: "PUBLISHED", versionNumber: 1 });

  const state = await readState(fixture.productId);
  const version = state.versions.find(({ id }) => id === fixture.draftId);
  assert.equal(version?.status, "PUBLISHED");
  assert.equal(version?.versionNumber, 1);
  assert.deepEqual(version?.publishedAt, fixture.publishedAt);
  assert.equal(version?.publishedById, fixture.userId);
  assert.deepEqual(version?.reviewReadyAt, fixture.reviewReadyAt);
  assert.equal(state.product.currentDraftVersionId, null);
  assert.equal(state.product.currentPublishedVersionId, fixture.draftId);
  assert.deepEqual(state.product.lastPublishedAt, fixture.publishedAt);
  assert.deepEqual(await readAuthored(fixture.productId), beforeAuthored);
  assert.equal(state.passports.length, 1);
  assert.equal(state.passports[0]?.status, "ACTIVE");
  assert.equal(state.passports[0]?.defaultLocale, "hr");
  assert.deepEqual(state.passports[0]?.firstPublishedAt, fixture.publishedAt);
  assert.deepEqual(state.passports[0]?.lastPublishedAt, fixture.publishedAt);
  assert.equal(state.qrCodes.length, 1);
  assert.equal(state.qrCodes[0]?.status, "PENDING");
  assert.equal(state.qrCodes[0]?.targetUrl, `${ORIGIN}/p/${fixture.publicCode}`);
  assert.equal(state.qrCodes[0]?.activatedAt, null);
  assert.equal(state.qrCodes[0]?.revokedAt, null);
  assert.deepEqual(state.audits, [{ action: "VERSION_PUBLISHED", summary: "Product version published.", metadata: { versionNumber: 1, previousVersionSuperseded: false } }]);

  const beforeReplay = await readState(fixture.productId);
  assert.deepEqual(await service(fixture.publishedAt)(evidence, fixture.context), { productId: fixture.productId, status: "NO_CHANGE", versionNumber: 1 });
  assert.deepEqual(await readState(fixture.productId), beforeReplay);

  await assertPublishedAuthoringIsBlocked(fixture, evidence, beforeAuthored);
});

test("serializes concurrent publication of the same draft into one publication and one compatible replay", async () => {
  const fixture = await seedDraftFixture(false);
  const evidence = await readEvidence(fixture.productId);
  const results = await Promise.all([service(fixture.publishedAt)(evidence, fixture.context), service(fixture.publishedAt)(evidence, fixture.context)]);
  assert.deepEqual(results.map(({ status }) => status).sort(), ["NO_CHANGE", "PUBLISHED"]);
  const state = await readState(fixture.productId);
  assert.equal(state.versions.filter(({ status }) => status === "PUBLISHED").length, 1);
  assert.deepEqual(state.versions.filter(({ versionNumber }) => versionNumber !== null).map(({ versionNumber }) => versionNumber), [1]);
  assert.equal(state.passports.length, 1);
  assert.equal(state.qrCodes.length, 1);
  assert.equal(state.audits.length, 1);
  assert.equal(state.product.currentDraftVersionId, null);
  assert.equal(state.product.currentPublishedVersionId, fixture.draftId);
});

test("proves MAX plus one republication supersession stable Passport QR and replay", async () => {
  const fixture = await seedRepublicationFixture();
  const evidence = await readEvidence(fixture.productId);
  const before = await readState(fixture.productId);
  const previousAuthored = await readAuthoredVersion(fixture.previousId);
  const concurrent = await Promise.all([service(fixture.publishedAt)(evidence, fixture.context), service(fixture.publishedAt)(evidence, fixture.context)]);
  assert.deepEqual(concurrent.map(({ status }) => status).sort(), ["NO_CHANGE", "PUBLISHED"]);
  assert.deepEqual(concurrent.map(({ versionNumber }) => versionNumber), [8, 8]);
  const after = await readState(fixture.productId);
  const previousBefore = before.versions.find(({ id }) => id === fixture.previousId);
  const previousAfter = after.versions.find(({ id }) => id === fixture.previousId);
  assert.equal(previousAfter?.status, "SUPERSEDED");
  assert.deepEqual(previousAfter?.supersededAt, fixture.publishedAt);
  assert.equal(previousAfter?.versionNumber, previousBefore?.versionNumber);
  assert.deepEqual(previousAfter?.publishedAt, previousBefore?.publishedAt);
  assert.equal(previousAfter?.publishedById, previousBefore?.publishedById);
  assert.deepEqual(after.versions.find(({ id }) => id === fixture.draftId)?.versionNumber, 8);
  assert.equal(after.product.currentPublishedVersionId, fixture.draftId);
  assert.equal(after.product.currentDraftVersionId, null);
  assert.equal(after.passports[0]?.id, before.passports[0]?.id);
  assert.deepEqual(after.passports[0]?.firstPublishedAt, before.passports[0]?.firstPublishedAt);
  assert.equal(after.passports[0]?.defaultLocale, before.passports[0]?.defaultLocale);
  assert.deepEqual(after.passports[0]?.lastPublishedAt, fixture.publishedAt);
  assert.deepEqual(after.qrCodes, before.qrCodes);
  assert.deepEqual(await readAuthoredVersion(fixture.previousId), previousAuthored);
  assert.deepEqual(after.audits, [{ action: "VERSION_PUBLISHED", summary: "Product version published.", metadata: { versionNumber: 8, previousVersionSuperseded: true } }]);
  const afterPublication = await readState(fixture.productId);
  assert.deepEqual(await service(fixture.publishedAt)(evidence, fixture.context), { productId: fixture.productId, status: "NO_CHANGE", versionNumber: 8 });
  assert.deepEqual(await readState(fixture.productId), afterPublication);
});

test("maps every stale evidence dimension without writes and never as NO_CHANGE", async () => {
  const fixture = await seedDraftFixture(false);
  const evidence = await readEvidence(fixture.productId);
  const before = await readState(fixture.productId);
  const staleCommands: PublishProductCommand[] = [
    { ...evidence, expectedDraftVersionId: randomUUID() },
    { ...evidence, expectedProductUpdatedAt: new Date(new Date(evidence.expectedProductUpdatedAt).getTime() - 1).toISOString() },
    { ...evidence, expectedDraftUpdatedAt: new Date(new Date(evidence.expectedDraftUpdatedAt).getTime() - 1).toISOString() },
    { ...evidence, expectedCurrentPublishedVersionId: randomUUID() },
  ];
  for (const command of staleCommands) {
    await assert.rejects(service(fixture.publishedAt)(command, fixture.context), staleWrite);
    assert.deepEqual(await readState(fixture.productId), before);
  }
});

test("rolls back bounded readiness failures without publication state", async () => {
  for (const scenario of ["MISSING_TRANSLATION", "BLANK_NAME", "PUBLIC_DOCUMENT", "PUBLIC_IMAGE", "INVALID_MATERIAL", "INVALID_CN"] as const) {
    const fixture = await seedDraftFixture(false);
    if (scenario === "MISSING_TRANSLATION") await prisma.productTranslation.deleteMany({ where: { productVersionId: fixture.draftId } });
    if (scenario === "BLANK_NAME") await prisma.productTranslation.updateMany({ where: { productVersionId: fixture.draftId }, data: { productName: "   " } });
    if (scenario === "PUBLIC_DOCUMENT") await createUnavailableDocument(fixture);
    if (scenario === "PUBLIC_IMAGE") await createUnavailableImage(fixture);
    if (scenario === "INVALID_MATERIAL") await createInvalidMaterials(fixture.draftId);
    if (scenario === "INVALID_CN") await prisma.productIdentifier.create({ data: { productVersionId: fixture.draftId, type: "CN", value: "INVALID", nomenclatureYear: 2026 } });
    const evidence = await readEvidence(fixture.productId);
    const before = await readState(fixture.productId);
    const expectedCode = scenario === "MISSING_TRANSLATION" ? "PUBLISH_PRODUCT_NOT_READY_SOURCE_TRANSLATION" : scenario === "BLANK_NAME" ? "PUBLISH_PRODUCT_NOT_READY_PRODUCT_NAME" : scenario === "PUBLIC_DOCUMENT" || scenario === "PUBLIC_IMAGE" ? "PUBLISH_PRODUCT_NOT_READY_PUBLIC_ASSET" : "PUBLISH_PRODUCT_INVALID_STATE";
    await assert.rejects(service(fixture.publishedAt)(evidence, fixture.context), (error) => applicationCode(error, expectedCode));
    assert.deepEqual(await readState(fixture.productId), before);
  }
});

test("blocks inactive Passport republication without reactivation or writes", async () => {
  for (const status of ["WITHDRAWN", "ARCHIVED"] as const) {
    const fixture = await seedRepublicationFixture();
    await prisma.passport.update({ where: { productId: fixture.productId }, data: status === "WITHDRAWN" ? { status, withdrawnAt: new Date("2026-08-25T10:00:00.000Z"), withdrawnById: fixture.userId, withdrawalReasonCode: "TEST" } : { status, archivedAt: new Date("2026-08-25T10:00:00.000Z") } });
    const evidence = await readEvidence(fixture.productId);
    const before = await readState(fixture.productId);
    await assert.rejects(service(fixture.publishedAt)(evidence, fixture.context), (error) => applicationCode(error, "PUBLISH_PRODUCT_INVALID_STATE"));
    assert.deepEqual(await readState(fixture.productId), before);
  }
});

test("rolls back every meaningful republication failure boundary and preserves numbering", async () => {
  for (const point of ["BEFORE_SOURCE", "AFTER_PREVIOUS", "AFTER_SOURCE", "AFTER_PRODUCT", "AFTER_PASSPORT", "AFTER_QR_PRESERVE", "AFTER_AUDIT"] as const) {
    const fixture = await seedRepublicationFixture();
    const evidence = await readEvidence(fixture.productId);
    const before = await readState(fixture.productId);
    await assert.rejects(failingService(fixture.publishedAt, point)(evidence, fixture.context), operationalFailure);
    assert.deepEqual(await readState(fixture.productId), before, point);
    if (point === "AFTER_SOURCE") {
      assert.equal((await service(fixture.publishedAt)(evidence, fixture.context)).versionNumber, 8);
      assert.deepEqual((await readState(fixture.productId)).versions.filter(({ versionNumber }) => versionNumber !== null).map(({ versionNumber }) => versionNumber).sort((left, right) => Number(left) - Number(right)), [7, 8]);
    }
  }
});

test("rolls back first-publication Passport QR and audit failure boundaries without orphans", async () => {
  for (const point of ["AFTER_PASSPORT", "AFTER_QR", "AFTER_AUDIT"] as const) {
    const fixture = await seedDraftFixture(false);
    const evidence = await readEvidence(fixture.productId);
    const before = await readState(fixture.productId);
    await assert.rejects(failingService(fixture.publishedAt, point)(evidence, fixture.context), operationalFailure);
    assert.deepEqual(await readState(fixture.productId), before, point);
  }
});

type FailurePoint = "BEFORE_SOURCE" | "AFTER_PREVIOUS" | "AFTER_SOURCE" | "AFTER_PRODUCT" | "AFTER_PASSPORT" | "AFTER_QR" | "AFTER_QR_PRESERVE" | "AFTER_AUDIT";

function service(publishedAt: Date) {
  return createPublishProductService({ transactionRunner: new PrismaPublishProductTransactionRunner(prisma), persistence: new PrismaPublishProductPersistence(prisma), now: () => publishedAt, generateQrCode: qrCode, canonicalOrigin: ORIGIN });
}

function failingService(publishedAt: Date, point: FailurePoint) {
  const persistence = new PrismaPublishProductPersistence(prisma);
  const decorated: PublishProductPersistence<PublishProductPrismaTransaction> = {
    readEligibility: persistence.readEligibility.bind(persistence),
    readProductForPublication: persistence.readProductForPublication.bind(persistence),
    readVersion: persistence.readVersion.bind(persistence),
    readReadiness: persistence.readReadiness.bind(persistence),
    readPassport: persistence.readPassport.bind(persistence),
    nextVersionNumber: persistence.nextVersionNumber.bind(persistence),
    applyPublication: (transaction, input) => persistence.applyPublication(failureTransaction(transaction, point), input),
  };
  return createPublishProductService({ transactionRunner: new PrismaPublishProductTransactionRunner(prisma), persistence: decorated, now: () => publishedAt, generateQrCode: qrCode, canonicalOrigin: ORIGIN });
}

function failureTransaction(transaction: PublishProductPrismaTransaction, point: FailurePoint): PublishProductPrismaTransaction {
  const cached = new Map<PropertyKey, object>();
  return new Proxy(transaction, {
    get(target, property) {
      const value = Reflect.get(target, property, target) as unknown;
      if (typeof value === "function") return value.bind(target);
      if (typeof value !== "object" || value === null) return value;
      const existing = cached.get(property);
      if (existing !== undefined) return existing;
      const model = String(property);
      const wrapped = new Proxy(value, {
        get(delegate, method) {
          const operation = Reflect.get(delegate, method, delegate) as unknown;
          if (typeof operation !== "function") return operation;
          return async (...args: unknown[]) => {
            const status = writeStatus(args[0]);
            if (point === "BEFORE_SOURCE" && model === "productVersion" && method === "updateMany" && status === "PUBLISHED") throw injected(point);
            if (point === "AFTER_QR_PRESERVE" && model === "auditLog" && method === "create") throw injected(point);
            const result = await Reflect.apply(operation, delegate, args);
            if (point === "AFTER_PREVIOUS" && model === "productVersion" && method === "updateMany" && status === "SUPERSEDED") throw injected(point);
            if (point === "AFTER_SOURCE" && model === "productVersion" && method === "updateMany" && status === "PUBLISHED") throw injected(point);
            if (point === "AFTER_PRODUCT" && model === "product" && method === "updateMany") throw injected(point);
            if (point === "AFTER_PASSPORT" && model === "passport" && (method === "create" || method === "updateMany")) throw injected(point);
            if (point === "AFTER_QR" && model === "qRCode" && method === "create") throw injected(point);
            if (point === "AFTER_AUDIT" && model === "auditLog" && method === "create") throw injected(point);
            return result;
          };
        },
      });
      cached.set(property, wrapped);
      return wrapped;
    },
  });
}

function writeStatus(value: unknown): unknown {
  return record(value) && record(value.data) ? value.data.status : undefined;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function injected(point: FailurePoint): Error {
  return new Error(`injected-${point}`);
}

async function seedDraftFixture(withAuthored: boolean) {
  const userId = randomUUID(), organizationId = randomUUID(), membershipId = randomUUID(), productId = randomUUID(), draftId = randomUUID();
  const publicCode = randomUUID().replaceAll("-", "").slice(0, 22);
  const reviewReadyAt = new Date("2026-08-30T10:00:00.000Z");
  const publishedAt = new Date("2026-09-02T10:00:00.000Z");
  await seedAuthority(userId, organizationId, membershipId);
  await prisma.product.create({ data: { id: productId, organizationId, internalName: "Chair", publicCode, lifecycleStatus: "ACTIVE", createdById: userId, updatedById: userId } });
  await prisma.productVersion.create({ data: { id: draftId, productId, organizationId, status: "READY_FOR_REVIEW", sourceLocale: "hr", reviewReadyAt, createdById: userId, updatedById: userId, translations: { create: { locale: "hr", productName: "Stolica", shortDescription: "Opis" } }, materials: withAuthored ? { create: { materialName: "Steel", category: "Metal", percentage: new Prisma.Decimal("40.00"), isRecycled: true, recycledPercentage: new Prisma.Decimal("20.00") } } : undefined, identifiers: withAuthored ? { create: { type: "CN", value: "01234567", nomenclatureYear: 2026 } } : undefined } });
  await prisma.product.update({ where: { id: productId }, data: { currentDraftVersionId: draftId } });
  return { userId, organizationId, membershipId, productId, draftId, publicCode, reviewReadyAt, publishedAt, context: context(userId, organizationId, membershipId) };
}

async function seedRepublicationFixture() {
  const userId = randomUUID(), organizationId = randomUUID(), membershipId = randomUUID(), productId = randomUUID(), previousId = randomUUID(), draftId = randomUUID();
  const publicCode = randomUUID().replaceAll("-", "").slice(0, 22);
  const firstPublishedAt = new Date("2026-08-20T10:00:00.000Z"), activatedAt = new Date("2026-08-20T11:00:00.000Z"), publishedAt = new Date("2026-09-02T11:00:00.000Z");
  await seedAuthority(userId, organizationId, membershipId);
  await prisma.product.create({ data: { id: productId, organizationId, internalName: "Chair", publicCode, lifecycleStatus: "ACTIVE", createdById: userId, updatedById: userId } });
  await prisma.productVersion.create({ data: { id: previousId, productId, organizationId, status: "PUBLISHED", sourceLocale: "en", versionNumber: 7, publishedAt: firstPublishedAt, publishedById: userId, createdById: userId, updatedById: userId, translations: { create: { locale: "en", productName: "Original chair", description: "Original authored content" } }, materials: { create: { materialName: "Wood", percentage: new Prisma.Decimal("100.00"), isRecycled: false } }, identifiers: { create: { type: "CN", value: "87654321", nomenclatureYear: 2025 } } } });
  await prisma.productVersion.create({ data: { id: draftId, productId, organizationId, status: "DRAFT", sourceLocale: "hr", createdById: userId, updatedById: userId, translations: { create: { locale: "hr", productName: "Nova stolica" } } } });
  await prisma.product.update({ where: { id: productId }, data: { currentDraftVersionId: draftId, currentPublishedVersionId: previousId, lastPublishedAt: firstPublishedAt } });
  const passport = await prisma.passport.create({ data: { productId, organizationId, status: "ACTIVE", defaultLocale: "en", firstPublishedAt, lastPublishedAt: firstPublishedAt } });
  await prisma.qRCode.create({ data: { passportId: passport.id, code: qrCode(), targetUrl: `${ORIGIN}/p/${publicCode}`, status: "ACTIVE", generatedAt: firstPublishedAt, activatedAt, revokedAt: null } });
  return { userId, organizationId, membershipId, productId, previousId, draftId, publicCode, publishedAt, context: context(userId, organizationId, membershipId) };
}

async function seedAuthority(userId: string, organizationId: string, membershipId: string) {
  await prisma.user.create({ data: { id: userId, email: `${userId}@test.invalid` } });
  await prisma.organization.create({ data: { id: organizationId, displayName: "Publication proof" } });
  await prisma.membership.create({ data: { id: membershipId, organizationId, userId, role: "ADMIN", status: "ACTIVE", joinedAt: new Date("2026-08-01T10:00:00.000Z") } });
}

function context(userId: string, organizationId: string, membershipId: string): AuthenticatedUserContext {
  return { userId, organizationId, membershipId, membershipRole: "ADMIN", membershipStatus: "ACTIVE", permissions: ["PRODUCT_READ", "PRODUCT_CREATE", "PRODUCT_EDIT", PRODUCT_PUBLISH], correlationId: randomUUID() };
}

function qrCode(): string {
  return `QR_${randomUUID().replaceAll("-", "").toUpperCase()}`;
}

async function readEvidence(productId: string): Promise<PublishProductCommand> {
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId }, include: { currentDraftVersion: true } });
  assert.ok(product.currentDraftVersion);
  return { productId, expectedDraftVersionId: product.currentDraftVersion.id, expectedProductUpdatedAt: product.updatedAt.toISOString(), expectedDraftUpdatedAt: product.currentDraftVersion.updatedAt.toISOString(), expectedCurrentPublishedVersionId: product.currentPublishedVersionId };
}

async function readState(productId: string) {
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId }, select: { currentDraftVersionId: true, currentPublishedVersionId: true, lastPublishedAt: true, updatedAt: true, updatedById: true } });
  const versions = await prisma.productVersion.findMany({ where: { productId }, select: { id: true, status: true, versionNumber: true, reviewReadyAt: true, publishedAt: true, publishedById: true, supersededAt: true, discardedAt: true, updatedById: true, updatedAt: true }, orderBy: { id: "asc" } });
  const passports = await prisma.passport.findMany({ where: { productId }, select: { id: true, status: true, defaultLocale: true, firstPublishedAt: true, lastPublishedAt: true, withdrawnAt: true, archivedAt: true, updatedAt: true } });
  const qrCodes = await prisma.qRCode.findMany({ where: { passport: { productId } }, select: { id: true, code: true, targetUrl: true, status: true, generatedAt: true, activatedAt: true, revokedAt: true, createdAt: true, updatedAt: true } });
  const audits = await prisma.auditLog.findMany({ where: { entityType: "PRODUCT", entityId: productId }, select: { action: true, summary: true, metadata: true }, orderBy: { occurredAt: "asc" } });
  return { product, versions, passports, qrCodes, audits };
}

async function readAuthored(productId: string) {
  const versions = await prisma.productVersion.findMany({ where: { productId }, select: { id: true }, orderBy: { id: "asc" } });
  const entries = await Promise.all(versions.map(({ id }) => readAuthoredVersion(id)));
  return entries;
}

async function readAuthoredVersion(productVersionId: string) {
  const translations = await prisma.productTranslation.findMany({ where: { productVersionId }, orderBy: { id: "asc" } });
  const materials = await prisma.productMaterial.findMany({ where: { productVersionId }, orderBy: { id: "asc" } });
  const identifiers = await prisma.productIdentifier.findMany({ where: { productVersionId }, orderBy: { id: "asc" } });
  return { translations, materials, identifiers };
}

async function assertPublishedAuthoringIsBlocked(fixture: Awaited<ReturnType<typeof seedDraftFixture>>, evidence: PublishProductCommand, authored: Awaited<ReturnType<typeof readAuthored>>) {
  const translation = await prisma.productTranslation.findFirstOrThrow({ where: { productVersionId: fixture.draftId } });
  const material = await prisma.productMaterial.findFirstOrThrow({ where: { productVersionId: fixture.draftId } });
  const identifier = await prisma.productIdentifier.findFirstOrThrow({ where: { productVersionId: fixture.draftId, type: "CN" } });
  const concurrency = { productId: fixture.productId, expectedDraftVersionId: fixture.draftId, expectedProductUpdatedAt: evidence.expectedProductUpdatedAt, expectedDraftUpdatedAt: evidence.expectedDraftUpdatedAt };
  await assert.rejects(createEditProductDraftService(createPrismaEditProductDraftDependencies(prisma))({ ...concurrency, productName: "Changed", organizationSku: null, expectedSourceTranslationUpdatedAt: translation.updatedAt.toISOString() }, fixture.context));
  await assert.rejects(createUpdateDraftTranslationContentService(createPrismaDraftTranslationContentDependencies(prisma))({ ...concurrency, expectedSourceTranslationUpdatedAt: translation.updatedAt.toISOString(), shortDescription: "Changed", description: null, technicalDescription: null, repairInstructions: null, sparePartsInformation: null, recyclingInstructions: null, disposalInstructions: null, packagingInformation: null, safetyInformation: null }, fixture.context));
  await assert.rejects(createProductMaterialsCurrentDraftServices(createPrismaProductMaterialsCurrentDraftDependencies(prisma)).edit({ ...concurrency, materialId: material.id, expectedMaterialUpdatedAt: material.updatedAt.toISOString(), materialName: "Changed", category: null, percentage: "40.00", isRecycled: true, recycledPercentage: "20.00" }, fixture.context));
  await assert.rejects(createCnClassificationCurrentDraftServices(createPrismaCnClassificationCurrentDraftDependencies(prisma)).edit({ ...concurrency, identifierId: identifier.id, expectedIdentifierUpdatedAt: identifier.updatedAt.toISOString(), value: "11234567", nomenclatureYear: 2026 }, fixture.context));
  assert.deepEqual(await readAuthored(fixture.productId), authored);
}

async function createUnavailableDocument(fixture: Awaited<ReturnType<typeof seedDraftFixture>>) {
  const suffix = randomUUID();
  const document = await prisma.document.create({ data: { organizationId: fixture.organizationId, originalFilename: "draft.pdf", storageProvider: "test", storageBucket: "publication", storageKey: suffix, mimeType: "application/pdf", sizeBytes: BigInt(1), checksumSha256: "a".repeat(64), status: "PENDING_UPLOAD", createdById: fixture.userId } });
  await prisma.productDocument.create({ data: { productVersionId: fixture.draftId, documentId: document.id, category: "manual", isPublic: true } });
}

async function createUnavailableImage(fixture: Awaited<ReturnType<typeof seedDraftFixture>>) {
  await prisma.productImage.create({ data: { productVersionId: fixture.draftId, originalFilename: "draft.png", fileExtension: "png", storageProvider: "test", storageBucket: "publication", storageKey: randomUUID(), mimeType: "image/png", sizeBytes: BigInt(1), checksumSha256: "b".repeat(64), width: 1, height: 1, isPublic: true, uploadedAt: null } });
}

async function createInvalidMaterials(productVersionId: string) {
  await prisma.productMaterial.createMany({ data: [{ productVersionId, materialName: "Steel", percentage: new Prisma.Decimal("60.00"), isRecycled: false }, { productVersionId, materialName: "Wood", percentage: new Prisma.Decimal("50.00"), isRecycled: false }] });
}

function applicationCode(error: unknown, code: string): boolean {
  assert.ok(error instanceof ApplicationError);
  assert.equal(error.code, code);
  assert.doesNotMatch(error.message, /postgres|prisma|constraint|identifier|storage/i);
  return true;
}

function staleWrite(error: unknown): boolean {
  return applicationCode(error, "PUBLISH_PRODUCT_STALE_WRITE");
}

function operationalFailure(error: unknown): boolean {
  return applicationCode(error, "PUBLISH_PRODUCT_OPERATIONAL_FAILURE");
}
