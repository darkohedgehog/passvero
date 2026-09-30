import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID, randomBytes } from "node:crypto";
import { createTestPrismaClient, requireSafeTestDatabaseConfig } from "../helpers/test-database";
import { activateOrganizationTrial, readEntitlements, readEntitlementUsage, lockEntitlementOrganization } from "../../src/infrastructure/subscriptions/entitlement-runtime";
import { createCreateProductService } from "../../src/application/products/create-product/create-product";
import { PrismaCreateProductPersistence, PrismaTransactionRunner } from "../../src/infrastructure/persistence/prisma/prisma-create-product";
import { permissionsForMembershipRole } from "../../src/application/permissions/product-permissions";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
const db = createTestPrismaClient(requireSafeTestDatabaseConfig(process.env));
test.after(() => db.$disconnect());
async function fixture(at = new Date()) {
  const org = await db.organization.create({ data: { displayName: "SYNTHETIC entitlement proof" } });
  const user = await db.user.create({ data: { email: `${randomUUID()}@example.invalid` } });
  const membership = await db.membership.create({ data: { organizationId: org.id, userId: user.id, role: "OWNER" } });
  await db.$transaction(tx => activateOrganizationTrial(tx, org.id, at));
  const context: AuthenticatedUserContext = { organizationId: org.id, userId: user.id, membershipId: membership.id, membershipRole: "OWNER", membershipStatus: "ACTIVE", permissions: permissionsForMembershipRole("OWNER"), correlationId: randomUUID() };
  return { org, context };
}
const create = createCreateProductService({ persistence: new PrismaCreateProductPersistence(), transactionRunner: new PrismaTransactionRunner(db), publicCodeGenerator: { generate: () => randomBytes(16).toString("base64url") }, monotonicNow: () => performance.now(), telemetry: { recordSuccess() {}, recordFailure() {}, recordPublicCodeCollision() {}, recordPublicCodeExhaustion() {} } });
const input = { initialProductName: "Synthetic trial product", initialLocale: "hr" };
test("concurrent individual creates consume exactly three lifetime trial slots", async () => {
  const { org, context } = await fixture();
  const results = await Promise.allSettled(Array.from({ length: 6 }, () => create(input, context)));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 3);
  assert.equal(await db.product.count({ where: { organizationId: org.id } }), 3);
  assert.equal((await db.$transaction(tx => readEntitlementUsage(tx, org.id))).lifetimeCreatedProducts, 3);
  const first = await db.organizationEntitlementEnrollment.findUniqueOrThrow({ where: { organizationId: org.id } });
  await db.$transaction(tx => activateOrganizationTrial(tx, org.id, new Date(Date.now()+86400000)));
  assert.equal((await db.organizationEntitlementEnrollment.findUniqueOrThrow({ where: { organizationId: org.id } })).trialStartedAt?.getTime(), first.trialStartedAt?.getTime());
  await db.product.updateMany({ where: { organizationId: org.id }, data: { lifecycleStatus: "ARCHIVED", archivedAt: new Date() } });
  await assert.rejects(create(input, context));
});
test("expired trial rejects creation; no historical createdAt enrollment", async () => {
  const { org, context } = await fixture(new Date("2020-01-31T11:00:00Z"));
  assert.equal((await db.$transaction(tx => readEntitlements(tx, org.id))).kind, "EXPIRED");
  await assert.rejects(create(input, context));
  assert.equal(await db.product.count({ where: { organizationId: org.id } }), 0);
  const unenrolled = await db.organization.create({ data: { displayName: "Unenrolled" } });
  assert.equal((await db.$transaction(tx => readEntitlements(tx, unenrolled.id))).kind, "TRANSITION_REQUIRED");
});

import { PrismaDocumentPersistence } from "../../src/infrastructure/persistence/prisma/prisma-document-assets";
import { PrismaCatalogImportPersistence } from "../../src/infrastructure/persistence/prisma/prisma-import-catalog";
import { createCatalogImportService } from "../../src/application/products/import-catalog/service";
import { createPublishProductService } from "../../src/application/products/publish-product/publish-product";
import { createPrismaPublishProductDependencies } from "../../src/infrastructure/persistence/prisma/prisma-publish-product-composition";
import { PrismaPublicDppPersistence } from "../../src/infrastructure/persistence/prisma/prisma-public-dpp";
import { createGetPublicDppService } from "../../src/application/public-dpp/get-public-dpp";
import { PrismaPublicDocuments } from "../../src/infrastructure/persistence/prisma/prisma-public-documents";
import { PrismaProductImagePersistence } from "../../src/infrastructure/persistence/prisma/prisma-product-images";
import { RegulatoryService } from "../../src/infrastructure/subscriptions/regulatory";
import type { CommercialActor } from "../../src/application/subscriptions/contracts";

function documentData(bytes = 10 * 1024 * 1024) { return { originalFilename: "synthetic.pdf", displayName: null, sizeBytes: bytes, checksumSha256: "a".repeat(64), storage: { provider: "proof", bucket: "private", key: randomUUID() } }; }
test("storage reservations serialize, failed/uncertain I/O keeps capacity, tenant checks remain", async () => {
  const { org, context } = await fixture();
  const persistence = new PrismaDocumentPersistence(db);
  const uploads = await Promise.allSettled(Array.from({ length: 12 }, () => persistence.createPending(context, documentData())));
  assert.equal(uploads.filter(r => r.status === "fulfilled").length, 10);
  const row = uploads.find(r => r.status === "fulfilled"); assert.ok(row?.status === "fulfilled");
  await persistence.fail(context, row.value.id);
  assert.equal((await db.$transaction(tx => readEntitlementUsage(tx, org.id))).storageBytes, 100*1024*1024);
  await assert.rejects(persistence.createPending(context, documentData(1)), { code: "STORAGE_LIMIT" });
  const other = await fixture();
  await assert.rejects(persistence.read(other.context, row.value.id, "PRODUCT_READ"), { code: "NOT_FOUND" });
});
test("CSV preview reserves nothing, partial success and replay share trial quota", async () => {
  const { org, context } = await fixture();
  const service = createCatalogImportService(new PrismaCatalogImportPersistence(db), "synthetic-disposable-secret");
  const bytes = Buffer.from("name\nOne\nTwo\nThree\nFour\nFive\n");
  const options = { delimiter: ",", defaultLocale: "hr", mapping: { internal_name: 0, sku: null, source_locale: null, gtin: null, cn_code: null, cn_nomenclature_year: null } };
  const preview = await service.preview(bytes, options, context);
  assert.equal((await db.$transaction(tx => readEntitlementUsage(tx, org.id))).lifetimeCreatedProducts, 0);
  const batch = await service.confirm(bytes, options, { token: preview.token, selected: [1,2,3,4,5], acceptGtinMatches: false }, context);
  const command = { id: batch.id, rows: preview.rows.map(r => ({ number: r.number, values: r.values })) };
  const result = await service.execute(command, context);
  assert.equal(result.outcomes.filter(r => r.status === "SUCCEEDED").length, 3);
  assert.equal(result.outcomes.filter(r => r.status === "FAILED" && ["STORED_PRODUCT_LIMIT", "TRIAL_CREATION_LIMIT"].includes(r.error ?? "")).length, 2);
  assert.deepEqual(await service.execute(command, context), result);
  assert.equal((await db.$transaction(tx => readEntitlementUsage(tx, org.id))).lifetimeCreatedProducts, 3);
});
const publish = createPublishProductService({ ...createPrismaPublishProductDependencies(db), now: () => new Date(), generateQrCode: () => randomUUID().toUpperCase(), canonicalOrigin: "https://staging.passvero.eu" });
async function publicationCommand(productId: string) {
  const product = await db.product.findUniqueOrThrow({ where: { id: productId }, include: { currentDraftVersion: true } });
  assert.ok(product.currentDraftVersion);
  return { productId, expectedDraftVersionId: product.currentDraftVersion.id, expectedCurrentPublishedVersionId: product.currentPublishedVersionId, expectedProductUpdatedAt: product.updatedAt.toISOString(), expectedDraftUpdatedAt: product.currentDraftVersion.updatedAt.toISOString() };
}
test("publication quota counts archived published products and concurrent final slot", async () => {
  const { org, context } = await fixture();
  // Explicit finite synthetic exception allows stored drafts above trial size but one publication.
  const other = await db.organization.create({ data: { displayName: "Synthetic publication cap" } });
  await db.membership.update({ where: { id: context.membershipId }, data: { organizationId: other.id } });
  const ctx = { ...context, organizationId: other.id };
  await db.organizationEntitlementEnrollment.create({ data: { organizationId: other.id, enrolledAt: new Date(), reason: "Disposable finite quota fixture", exceptionStartsAt: new Date(Date.now()-1000), exceptionEndsAt: new Date(Date.now()+60000), exceptionLimits: { maxStoredProducts: 10, maxPublishedProducts: 1, maxStorageBytes: 104857600, maxPdfAttachments: 5 } } });
  const products = await Promise.all([create(input, ctx), create(input, ctx)]);
  const outcomes = await Promise.allSettled(products.map(async p => publish(await publicationCommand(p.productId), ctx)));
  assert.equal(outcomes.filter(r => r.status === "fulfilled").length, 1);
  const winner = await db.product.findFirstOrThrow({ where: { organizationId: other.id, currentPublishedVersionId: { not: null } } });
  await db.product.update({ where: { id: winner.id }, data: { lifecycleStatus: "ARCHIVED", archivedAt: new Date() } });
  assert.equal((await db.$transaction(tx => readEntitlementUsage(tx, other.id))).occupiedPublishedProducts, 1);
  assert.equal((await db.$transaction(tx => readEntitlementUsage(tx, org.id))).occupiedPublishedProducts, 0);
});
test("regulatory authority is separate, audited and cannot grant content rights", async () => {
  const { context } = await fixture(); const product = await create(input, context);
  const provider = await db.authProviderUser.create({ data: { id: randomUUID(), email: `${randomUUID()}@example.invalid`, name: "Synthetic regulator", emailVerified: true } });
  await db.authIdentity.create({ data: { userId: context.userId, provider: "BETTER_AUTH", providerSubject: provider.id } });
  const session = await db.authProviderSession.create({ data: { id: randomUUID(), userId: provider.id, token: randomUUID(), expiresAt: new Date(Date.now()+60000) } });
  const actor: CommercialActor = { status: "AUTHENTICATED", currentUser: { userId: context.userId }, providerSession: { provider: "BETTER_AUTH", providerSessionId: session.id } };
  const service = new RegulatoryService(db, db);
  await db.platformBillingGrant.create({ data: { userId: context.userId } });
  const command = { productId: product.productId, expectedClassification: "UNRESOLVED", classification: "VOLUNTARY", reason: "Synthetic voluntary fixture, no regulatory claim" };
  await assert.rejects(service.classify(actor, command), { code: "REGULATORY_FORBIDDEN" });
  await db.platformRegulatoryGrant.create({ data: { userId: context.userId } });
  await service.classify(actor, command); await service.classify(actor, command);
  assert.equal(await db.auditLog.count({ where: { entityId: product.productId, action: "PRODUCT_REGULATORY_CLASSIFICATION_CHANGED" } }), 1);
  await db.platformRegulatoryGrant.update({ where: { userId: context.userId }, data: { revokedAt: new Date() } });
  await assert.rejects(service.classify(actor, command), { code: "REGULATORY_FORBIDDEN" });
});

import { PrismaEditProductDraftPersistence } from "../../src/infrastructure/persistence/prisma/prisma-edit-product-draft";
import { PrismaTranslationManagementPersistence } from "../../src/infrastructure/persistence/prisma/prisma-translation-management";
import { PrismaGtinPersistence } from "../../src/infrastructure/persistence/prisma/prisma-gtin";
import { PrismaManufacturerPersistence } from "../../src/infrastructure/persistence/prisma/prisma-manufacturer";
import { createCreateProductHttpHandler } from "../../src/application/products/create-product/create-product-http";

test("expired direct authoring boundaries deny content while PDF failure cleanup and reads remain", async () => {
  const { org, context } = await fixture(new Date("2020-01-01T11:00:00Z"));
  const product = await db.product.create({ data: { organizationId: org.id, internalName: "Expired synthetic", publicCode: randomBytes(16).toString("base64url") } });
  const draft = await db.productVersion.create({ data: { organizationId: org.id, productId: product.id, sourceLocale: "hr", status: "DRAFT" } });
  const updated = await db.product.update({ where: { id: product.id }, data: { currentDraftVersionId: draft.id } });
  await db.productTranslation.create({ data: { productVersionId: draft.id, locale: "hr", productName: "Synthetic" } });
  const evidence = { productId: product.id, organizationId: org.id, draftId: draft.id, productAt: updated.updatedAt, draftAt: draft.updatedAt, actorId: context.userId };
  await assert.rejects(db.$transaction(tx => new PrismaTranslationManagementPersistence(db).touch(tx, evidence)), { code: "SUBSCRIPTION_EXPIRED" });
  await assert.rejects(db.$transaction(tx => new PrismaGtinPersistence(db).load(tx, product.id, org.id, true)), { code: "SUBSCRIPTION_EXPIRED" });
  await assert.rejects(db.$transaction(tx => new PrismaManufacturerPersistence(db).load(tx, product.id, org.id, true)), { code: "SUBSCRIPTION_EXPIRED" });
  await assert.rejects(publish(await publicationCommand(product.id), context), { code: "SUBSCRIPTION_EXPIRED" });
  assert.ok(await new PrismaEditProductDraftPersistence(db).findByIdAndOrganization({ productId: product.id, organizationId: org.id }));
  const pending = await db.document.create({ data: { organizationId: org.id, originalFilename: "synthetic.pdf", mimeType: "application/pdf", fileExtension: "pdf", sizeBytes: 10, checksumSha256: "a".repeat(64), storageProvider: "proof", storageBucket: "private", storageKey: randomUUID() } });
  const documents = new PrismaDocumentPersistence(db);
  await assert.rejects(documents.finalize(context, pending.id), { code: "SUBSCRIPTION_EXPIRED" });
  await documents.fail(context, pending.id);
  assert.equal((await documents.read(context, pending.id, "PRODUCT_READ")).status, "FAILED");
  const handler = createCreateProductHttpHandler({ create, resolveContext: async () => ({ status: "RESOLVED", context, presentation: { organizationName: "Synthetic" } }), canonicalOrigin: "https://staging.passvero.eu", verifyProxy: () => true });
  const response = await handler(new Request("https://staging.passvero.eu/api/products/create", { method: "POST", headers: { origin: "https://staging.passvero.eu", "content-type": "application/json" }, body: JSON.stringify(input) }));
  assert.equal(response.status, 403); assert.equal((await response.json()).reason, "SUBSCRIPTION_EXPIRED");
});

async function publicFixture(expired: boolean) {
  const { org, context } = await fixture(expired ? new Date("2020-01-01T11:00:00Z") : new Date());
  const at = new Date(Date.now()-1000);
  const product = await db.product.create({ data: { organizationId: org.id, internalName: "Public synthetic", publicCode: randomBytes(16).toString("base64url"), regulatoryClassification: "VOLUNTARY", regulatoryReason: "Disposable test", regulatoryClassifiedById: context.userId, regulatoryClassifiedAt: at } });
  const version = await db.productVersion.create({ data: { organizationId: org.id, productId: product.id, sourceLocale: "hr", status: "PUBLISHED", versionNumber: 1, publishedAt: at, publishedById: context.userId } });
  await db.productTranslation.create({ data: { productVersionId: version.id, locale: "hr", productName: "Synthetic" } });
  await db.product.update({ where: { id: product.id }, data: { currentPublishedVersionId: version.id, lastPublishedAt: at } });
  await db.passport.create({ data: { productId: product.id, organizationId: org.id, status: "ACTIVE", defaultLocale: "hr", firstPublishedAt: at, lastPublishedAt: at } });
  const imageAsset = await db.productImageAsset.create({ data: { organizationId: org.id, storageProvider: "proof", storageBucket: "private", storageKey: randomUUID(), originalFilename: "synthetic.png", fileExtension: "png", mimeType: "image/png", sizeBytes: 10, checksumSha256: "a".repeat(64), width: 1, height: 1, state: "READY", policyVersion: 1, uploadedAt: at } });
  const image = await db.productImage.create({ data: { assetId: imageAsset.id, productVersionId: version.id, isPrimary: true, isPublic: true } });
  const document = await db.document.create({ data: { organizationId: org.id, originalFilename: "synthetic.pdf", mimeType: "application/pdf", fileExtension: "pdf", sizeBytes: 10, checksumSha256: "a".repeat(64), storageProvider: "proof", storageBucket: "private", storageKey: randomUUID(), status: "AVAILABLE", uploadedAt: at } });
  await db.productDocument.create({ data: { productVersionId: version.id, documentId: document.id, category: "OTHER", isPublic: true } });
  return { product, image, version };
}
test("public HTML and asset authority obey expired trial; unresolved classification preserves only public eligibility", async () => {
  const current = await publicFixture(false), expired = await publicFixture(true);
  const dpp = createGetPublicDppService({ persistence: new PrismaPublicDppPersistence(db) });
  assert.equal((await dpp({ publicCode: current.product.publicCode, requestedLocale: "hr", acceptLanguage: null })).kind, "PUBLIC");
  assert.equal((await dpp({ publicCode: expired.product.publicCode, requestedLocale: "hr", acceptLanguage: null })).kind, "NOT_FOUND");
  const images = new PrismaProductImagePersistence(db), documents = new PrismaPublicDocuments(db);
  assert.ok(await images.publicAsset(current.product.publicCode, current.image.id));
  await assert.rejects(images.publicAsset(expired.product.publicCode, expired.image.id), { code: "NOT_FOUND" });
  assert.equal((await documents.read(current.product.publicCode)).length, 1);
  assert.equal((await documents.read(expired.product.publicCode)).length, 0);
  await db.product.update({ where: { id: expired.product.id }, data: { regulatoryClassification: "UNRESOLVED" } });
  assert.equal((await dpp({ publicCode: expired.product.publicCode, requestedLocale: "hr", acceptLanguage: null })).kind, "PUBLIC");
  // Existing privacy/publication restrictions still win over the regulatory exception.
  await db.passport.update({ where: { productId: expired.product.id }, data: { status: "ARCHIVED", archivedAt: new Date() } });
  assert.equal((await dpp({ publicCode: expired.product.publicCode, requestedLocale: "hr", acceptLanguage: null })).kind, "NOT_FOUND");
  await assert.rejects(images.publicAsset(expired.product.publicCode, expired.image.id));
});

import { PrismaDocumentAttachments } from "../../src/infrastructure/persistence/prisma/prisma-document-attachments";
test("PDF attachment limit is atomic and multiple version references do not double storage", async () => {
  const { org, context } = await fixture(); const created = await create(input, context);
  const documents = new PrismaDocumentPersistence(db);
  const assets = await Promise.all(Array.from({ length: 6 }, () => documents.createPending(context, documentData(1))));
  for (const asset of assets) await documents.finalize(context, asset.id);
  const persistence = new PrismaDocumentAttachments(db);
  const metadata = { category: "OTHER" as const, locale: null, displayLabel: "Synthetic", description: null, isPublic: true };
  const results = await Promise.allSettled(assets.map((asset, i) => db.$transaction(tx => persistence.attach(tx, created.initialProductVersionId, asset.id, metadata, i))));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 5);
  const links = await db.productDocument.findMany({ where: { productVersionId: created.initialProductVersionId } });
  const second = await db.productVersion.create({ data: { organizationId: org.id, productId: created.productId, sourceLocale: "hr", status: "DISCARDED", discardedAt: new Date() } });
  await db.productDocument.createMany({ data: links.map(link => ({ productVersionId: second.id, documentId: link.documentId, category: "OTHER", isPublic: false })) });
  const usage = await db.$transaction(tx => readEntitlementUsage(tx, org.id));
  assert.equal(usage.storageBytes, 6); assert.equal(usage.maxPdfAttachmentsPerVersion, 5);
  assert.equal(usage.lifetimeCreatedProducts, 1);
});
test("failed product audit rolls back creation and trial consumption together", async () => {
  const { org, context } = await fixture();
  await db.$executeRawUnsafe(`CREATE FUNCTION entitlement_proof_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='PRODUCT_CREATED' AND NEW."organizationId"='${org.id}'::uuid THEN RAISE EXCEPTION 'synthetic audit rejection'; END IF; RETURN NEW; END $$`);
  await db.$executeRawUnsafe('CREATE TRIGGER entitlement_proof_audit_failure BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION entitlement_proof_audit_failure()');
  try { await assert.rejects(create(input, context)); }
  finally {
    await db.$executeRawUnsafe('DROP TRIGGER entitlement_proof_audit_failure ON "AuditLog"');
    await db.$executeRawUnsafe('DROP FUNCTION entitlement_proof_audit_failure()');
  }
  assert.equal(await db.product.count({ where: { organizationId: org.id } }), 0);
  assert.equal((await db.$transaction(tx => readEntitlementUsage(tx, org.id))).lifetimeCreatedProducts, 0);
  await create(input, context);
});

test("attachment waits for organization before taking publication product lock", async () => {
  const { org, context } = await fixture(); const created = await create(input, context);
  const persistence = new PrismaDocumentAttachments(db);
  let releaseStart!: () => void; const start = new Promise<void>(resolve => { releaseStart = resolve; });
  let reportPid!: (pid: number) => void; const pidReady = new Promise<number>(resolve => { reportPid = resolve; });
  const publication = db.$transaction(async tx => {
    await lockEntitlementOrganization(tx, org.id); releaseStart();
    const pid = await pidReady;
    let waiting = false;
    for (let i = 0; i < 100; i++) {
      const [row] = await tx.$queryRaw<Array<{ wait_event: string | null }>>`SELECT wait_event FROM pg_stat_activity WHERE pid=${pid}`;
      if (row?.wait_event === "advisory") { waiting = true; break; }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(waiting, true, "attachment should wait on organization lock");
    // NOWAIT proves the waiting attachment has not already acquired Product.
    await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${created.productId}::uuid FOR UPDATE NOWAIT`;
  }, { timeout: 10000 });
  const attachment = (async () => {
    await start;
    return db.$transaction(async tx => {
      const [row] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      reportPid(row.pid);
      return persistence.lockState(tx, created.productId, org.id);
    }, { timeout: 10000 });
  })();
  const results = await Promise.allSettled([publication, attachment]);
  for (const result of results) if (result.status === "rejected") throw result.reason;
});
