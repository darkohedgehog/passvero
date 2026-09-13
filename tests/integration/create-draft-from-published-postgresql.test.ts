import { createEditProductDraftService } from "../../src/application/products/edit-product-draft/edit-product-draft";
import { createUpdateDraftTranslationContentService } from "../../src/application/products/draft-translation-content/update-draft-translation-content";
import { createProductMaterialsCurrentDraftServices } from "../../src/application/products/product-materials-current-draft/services";
import { createCnClassificationCurrentDraftServices } from "../../src/application/products/cn-classification-current-draft/services";
import { createPrismaEditProductDraftDependencies } from "../../src/infrastructure/persistence/prisma/prisma-edit-product-draft-composition";
import { createPrismaDraftTranslationContentDependencies } from "../../src/infrastructure/persistence/prisma/prisma-draft-translation-content-composition";
import { createPrismaProductMaterialsCurrentDraftDependencies } from "../../src/infrastructure/persistence/prisma/prisma-product-materials-current-draft-composition";
import { createPrismaCnClassificationCurrentDraftDependencies } from "../../src/infrastructure/persistence/prisma/prisma-cn-classification-current-draft-composition";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { ApplicationError } from "../../src/application/errors/application-error";
import { createDraftFromPublishedService } from "../../src/application/products/create-draft-from-published/service";
import { createPublishProductService } from "../../src/application/products/publish-product/publish-product";
import { createGetPublicDppService } from "../../src/application/public-dpp/get-public-dpp";
import { PrismaPublicDppPersistence } from "../../src/infrastructure/persistence/prisma/prisma-public-dpp";
import { createPrismaCreateDraftFromPublishedDependencies } from "../../src/infrastructure/persistence/prisma/prisma-create-draft-from-published";
import { createPrismaPublishProductDependencies } from "../../src/infrastructure/persistence/prisma/prisma-publish-product-composition";
import { createTestPrismaClient, requireSafeTestDatabaseConfig } from "../helpers/test-database";
const prisma = createTestPrismaClient(requireSafeTestDatabaseConfig(process.env));
test.after(() => prisma.$disconnect());
const origin = "https://passvero.example";
const clone = createDraftFromPublishedService(createPrismaCreateDraftFromPublishedDependencies(prisma));
const publish = createPublishProductService({ ...createPrismaPublishProductDependencies(prisma), now: () => new Date(), generateQrCode: () => randomUUID().toUpperCase(), canonicalOrigin: origin });
const publicDpp = createGetPublicDppService({ persistence: new PrismaPublicDppPersistence(prisma) });
async function seed(images = 0) {
  const actor = await prisma.user.create({ data: { email: `${randomUUID()}@test.invalid` } });
  const org = await prisma.organization.create({ data: { displayName: "Clone proof" } });
  const member = await prisma.membership.create({ data: { userId: actor.id, organizationId: org.id, role: "ADMIN", status: "ACTIVE", joinedAt: new Date() } });
  const product = await prisma.product.create({ data: { organizationId: org.id, internalName: "Clone proof", publicCode: randomUUID().replaceAll("-", "").slice(0,22), createdById: actor.id } });
  const context: AuthenticatedUserContext = { userId: actor.id, organizationId: org.id, membershipId: member.id, membershipRole: "ADMIN", membershipStatus: "ACTIVE", permissions: ["PRODUCT_EDIT", "PRODUCT_PUBLISH", "PRODUCT_READ"], correlationId: randomUUID() };
  const version = await prisma.productVersion.create({ data: { productId: product.id, organizationId: org.id, sourceLocale: "hr", createdById: actor.id,
    translations: { create: [{ locale: "hr", productName: "Stolica", description: "Public original" }, { locale: "en", productName: "Chair", publicNotes: "English original" }] },
    materials: { create: [{ materialName: "Steel", percentage: "70", isRecycled: true, recycledPercentage: "25", supplier: "Private supplier", notes: "Preserve note", createdAt: new Date("2026-01-01T00:00:00Z") }, { materialName: "Wood", percentage: "30", createdAt: new Date("2026-01-02T00:00:00Z") }] },
    identifiers: { create: [{ type: "CN", value: "00123456", nomenclatureYear: 2026 }, { type: "MPN", value: "Preserved-MPN" }] },
  } });
  const document = await prisma.document.create({ data: { organizationId: org.id, originalFilename: "proof.pdf", storageProvider: "test", storageBucket: "test", storageKey: randomUUID(), mimeType: "application/pdf", sizeBytes: BigInt(10), checksumSha256: "a".repeat(64), status: "AVAILABLE", uploadedAt: new Date() } });
  await prisma.productDocument.create({ data: { productVersionId: version.id, documentId: document.id, category: "MANUAL", displayLabel: "Manual", sortOrder: 3 } });
  const pointed = await prisma.product.update({ where: { id: product.id }, data: { currentDraftVersionId: version.id } });
  await publish({ productId: product.id, expectedDraftVersionId: version.id, expectedProductUpdatedAt: pointed.updatedAt.toISOString(), expectedDraftUpdatedAt: version.updatedAt.toISOString(), expectedCurrentPublishedVersionId: null }, context);
  const passport = await prisma.passport.findUniqueOrThrow({ where: { productId: product.id } });
  await prisma.qRCode.update({ where: { passportId: passport.id }, data: { status: "ACTIVE", activatedAt: new Date() } });
  for (let i = 0; i < images; i++) await prisma.productImage.create({ data: { productVersionId: version.id, originalFilename: "test.png", storageProvider: "test", storageBucket: "test", storageKey: randomUUID(), mimeType: "image/png", sizeBytes: BigInt(1), checksumSha256: "b".repeat(64), width: 1, height: 1, uploadedAt: new Date() } });
  const current = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
  return { product: current, context, sourceId: version.id, command: { productId: product.id, expectedCurrentPublishedVersionId: version.id, expectedProductUpdatedAt: current.updatedAt.toISOString() } };
}
async function state(productId: string) {
  return prisma.product.findUniqueOrThrow({ where: { id: productId }, include: { versions: { orderBy: { id: "asc" }, include: { translations: { orderBy: { locale: "asc" } }, materials: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] }, identifiers: { orderBy: { type: "asc" } }, productDocuments: true, images: true } }, passport: { include: { qrCode: true } } } });
}
async function audits(productId: string) { return prisma.auditLog.findMany({ where: { entityId: productId }, orderBy: { occurredAt: "asc" } }); }
for (const imageCount of [1, 2]) test(`image gate with ${imageCount} images preserves the entire aggregate audit public DPP Passport and QR`, async () => {
  const f = await seed(imageCount); const before = await state(f.product.id); const beforeAudit = await audits(f.product.id);
  const publicBefore = await publicDpp({ publicCode: f.product.publicCode, requestedLocale: "hr", acceptLanguage: null });
  await assert.rejects(clone(f.command, f.context), e => e instanceof ApplicationError && e.code === "CREATE_DRAFT_IMAGES_UNSUPPORTED");
  assert.deepEqual(await state(f.product.id), before); assert.deepEqual(await audits(f.product.id), beforeAudit);
  assert.deepEqual(await publicDpp({ publicCode: f.product.publicCode, requestedLocale: "hr", acceptLanguage: null }), publicBefore);
});
test("concurrent creation copies isolated children once and republication keeps public identity", async () => {
  const f = await seed(); const before = await state(f.product.id);
  const publicBefore = await publicDpp({ publicCode: f.product.publicCode, requestedLocale: "hr", acceptLanguage: null });
  assert.equal(publicBefore.kind, "PUBLIC");
  const results = await Promise.all([clone(f.command, f.context), clone(f.command, f.context)]);
  assert.deepEqual(results.map(x => x.status).sort(), ["CREATED_NEW_DRAFT", "EXISTING_DRAFT"]);
  assert.deepEqual(await clone(f.command, f.context), { status: "EXISTING_DRAFT" });
  const after = await state(f.product.id); assert.equal(after.versions.length, 2);
  const draft = after.versions.find(x => x.id === after.currentDraftVersionId)!;
  const original = before.versions[0];
  assert.equal(draft.status, "DRAFT"); assert.equal(draft.versionNumber, null); assert.equal(draft.sourceLocale, "hr"); assert.equal(draft.clonedFromVersionId, f.sourceId);
  assert.equal(draft.publishedAt, null); assert.equal(draft.publishedById, null);
  assert.equal(draft.translations.length, 2); assert.equal(draft.materials.length, 2); assert.equal(draft.identifiers.length, 2); assert.equal(draft.productDocuments.length, 1);
  for (const key of ["translations", "materials", "identifiers", "productDocuments"] as const) {
    const clean = (row: object) => Object.fromEntries(Object.entries(row).filter(([k]) => !["id", "productVersionId", "createdAt", "updatedAt"].includes(k)));
    assert.deepEqual(draft[key].map(clean), original[key].map(clean));
    assert.ok(draft[key].every(x => !original[key].some(y => y.id === x.id)));
  }
  assert.deepEqual(after.versions.find(x => x.id === f.sourceId), original);
  assert.deepEqual(after.passport, before.passport); assert.equal(after.publicCode, before.publicCode);
  assert.equal((await audits(f.product.id)).filter(x => x.action === "PRODUCT_UPDATED").length, 1);
  const evidence = async () => {
    const current = await prisma.product.findUniqueOrThrow({ where: { id: f.product.id } });
    const currentDraft = await prisma.productVersion.findUniqueOrThrow({ where: { id: draft.id } });
    return { productId: f.product.id, expectedDraftVersionId: draft.id, expectedProductUpdatedAt: current.updatedAt.toISOString(), expectedDraftUpdatedAt: currentDraft.updatedAt.toISOString() };
  };
  const edit = createEditProductDraftService(createPrismaEditProductDraftDependencies(prisma));
  const content = createUpdateDraftTranslationContentService(createPrismaDraftTranslationContentDependencies(prisma));
  const materials = createProductMaterialsCurrentDraftServices(createPrismaProductMaterialsCurrentDraftDependencies(prisma));
  const cn = createCnClassificationCurrentDraftServices(createPrismaCnClassificationCurrentDraftDependencies(prisma));
  const oldTranslation = original.translations.find(x => x.locale === "hr")!;
  const forged = { ...await evidence(), expectedDraftVersionId: original.id };
  const contentValues = { shortDescription: null, description: "Private changes", technicalDescription: null, repairInstructions: null, sparePartsInformation: null, recyclingInstructions: null, disposalInstructions: null, packagingInformation: null, safetyInformation: null };
  await assert.rejects(edit({ ...forged, productName: "Forbidden", expectedSourceTranslationUpdatedAt: oldTranslation.updatedAt.toISOString() }, f.context), e => e instanceof ApplicationError);
  await assert.rejects(content({ ...forged, ...contentValues, expectedSourceTranslationUpdatedAt: oldTranslation.updatedAt.toISOString() }, f.context), e => e instanceof ApplicationError);
  const oldMaterial = original.materials[0];
  await assert.rejects(materials.edit({ ...forged, materialId: oldMaterial.id, expectedMaterialUpdatedAt: oldMaterial.updatedAt.toISOString(), materialName: "Forbidden", category: null, percentage: "70.00", isRecycled: true, recycledPercentage: "25.00" }, f.context), e => e instanceof ApplicationError);
  const oldCn = original.identifiers.find(x => x.type === "CN")!;
  await assert.rejects(cn.edit({ ...forged, identifierId: oldCn.id, expectedIdentifierUpdatedAt: oldCn.updatedAt.toISOString(), value: "01012100", nomenclatureYear: 2026 }, f.context), e => e instanceof ApplicationError);
  assert.deepEqual(await state(f.product.id), after);
  const sourceTranslation = draft.translations.find(x => x.locale === "hr")!;
  await edit({ ...await evidence(), productName: "Nova stolica", expectedSourceTranslationUpdatedAt: sourceTranslation.updatedAt.toISOString() }, f.context);
  const translation = await prisma.productTranslation.findUniqueOrThrow({ where: { id: sourceTranslation.id } });
  await content({ ...await evidence(), ...contentValues, expectedSourceTranslationUpdatedAt: translation.updatedAt.toISOString() }, f.context);
  await materials.edit({ ...await evidence(), materialId: draft.materials[0].id, expectedMaterialUpdatedAt: draft.materials[0].updatedAt.toISOString(), materialName: "Private steel", category: null, percentage: "70.00", isRecycled: true, recycledPercentage: "25.00" }, f.context);
  const draftCn = draft.identifiers.find(x => x.type === "CN")!;
  await cn.edit({ ...await evidence(), identifierId: draftCn.id, expectedIdentifierUpdatedAt: draftCn.updatedAt.toISOString(), value: "01012100", nomenclatureYear: 2026 }, f.context);
  assert.deepEqual(await publicDpp({ publicCode: f.product.publicCode, requestedLocale: "hr", acceptLanguage: null }), publicBefore);
  const current = await prisma.product.findUniqueOrThrow({ where: { id: f.product.id } });
  const published = await publish({ productId: f.product.id, expectedDraftVersionId: draft.id, expectedProductUpdatedAt: current.updatedAt.toISOString(), expectedDraftUpdatedAt: (await evidence()).expectedDraftUpdatedAt, expectedCurrentPublishedVersionId: f.sourceId }, f.context);
  assert.equal(published.versionNumber, 2);
  const final = await state(f.product.id); assert.equal(final.currentDraftVersionId, null); assert.equal(final.currentPublishedVersionId, draft.id);
  assert.equal(final.versions.find(x => x.id === f.sourceId)?.status, "SUPERSEDED"); assert.equal(final.versions.find(x => x.id === draft.id)?.status, "PUBLISHED");
  assert.equal(final.passport?.id, before.passport?.id); assert.equal(final.passport?.status, "ACTIVE"); assert.deepEqual(final.passport?.qrCode, before.passport?.qrCode); assert.equal(final.publicCode, before.publicCode);
  const publicAfter = await publicDpp({ publicCode: f.product.publicCode, requestedLocale: "hr", acceptLanguage: null });
  assert.equal(publicAfter.kind, "PUBLIC"); if (publicAfter.kind === "PUBLIC") { assert.equal(publicAfter.dpp.version.number, 2); assert.equal(publicAfter.dpp.content.description, "Private changes"); assert.equal(publicAfter.dpp.cn?.code, "01012100"); assert.equal(publicAfter.dpp.materials[0].materialName, "Private steel"); }
});
for (const model of ["productTranslation", "productMaterial", "productIdentifier", "productDocument", "auditLog"] as const) test(`failure at ${model} rolls back version children pointer and audit`, async () => {
  const f = await seed(); const before = await state(f.product.id); const beforeAudit = await audits(f.product.id);
  const dependencies = createPrismaCreateDraftFromPublishedDependencies(prisma);
  const run = dependencies.transactionRunner.run.bind(dependencies.transactionRunner);
  dependencies.transactionRunner.run = work => run(tx => work(new Proxy(tx, { get(target, key) {
    if (key !== model) return Reflect.get(target, key, target);
    const delegate = Reflect.get(target, key, target);
    return new Proxy(delegate, { get(object, operation) {
      if (operation === "createMany" || operation === "create") return () => { throw new Error("Injected rollback"); };
      return Reflect.get(object, operation, object);
    } });
  } })));
  await assert.rejects(createDraftFromPublishedService(dependencies)(f.command, f.context), e => e instanceof ApplicationError && e.category === "INTERNAL");
  assert.deepEqual(await state(f.product.id), before); assert.deepEqual(await audits(f.product.id), beforeAudit);
});

test("database partial uniqueness independently rejects a second active draft", async () => {
  const f = await seed(); await clone(f.command, f.context);
  const before = await state(f.product.id);
  await assert.rejects(prisma.productVersion.create({ data: { productId: f.product.id, organizationId: f.context.organizationId, sourceLocale: "hr", createdById: f.context.userId, status: "DRAFT" } }), error => typeof error === "object" && error !== null && "code" in error && error.code === "P2002");
  assert.deepEqual(await state(f.product.id), before);
});
