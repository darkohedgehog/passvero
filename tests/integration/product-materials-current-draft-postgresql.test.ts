import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { ApplicationError } from "../../src/application/errors/application-error";
import { PRODUCT_EDIT, PRODUCT_READ } from "../../src/application/permissions/product-permissions";
import type {
  ProductMaterialValues,
  ProductMaterialConcurrencyEvidence,
} from "../../src/application/products/product-materials-current-draft/contracts";
import { createProductMaterialsCurrentDraftServices } from "../../src/application/products/product-materials-current-draft/services";
import {
  PrismaProductMaterialsCurrentDraftPersistence,
  PrismaProductMaterialsCurrentDraftTransactionRunner,
} from "../../src/infrastructure/persistence/prisma/prisma-product-materials-current-draft";
import {
  createTestPrismaClient,
  requireSafeTestDatabaseConfig,
} from "../helpers/test-database";

const databaseConfig = requireSafeTestDatabaseConfig(process.env);
const prisma = createTestPrismaClient(databaseConfig);

test.after(async () => {
  await prisma.$disconnect();
});

test("serializes concurrent ADD and keeps the exact collection ceiling", async () => {
  const fixture = await createFixture("20.00");
  const evidence = await currentEvidence(fixture);
  const commands = ["Concurrent A", "Concurrent B"].map((materialName) => ({
    productId: fixture.productId,
    materialName,
    category: null,
    percentage: "50.00",
    isRecycled: false,
    recycledPercentage: null,
    ...evidence,
  }));

  const results = await Promise.allSettled(commands.map((command) => fixture.services.add(command, fixture.context)));
  assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
  const rejected = results.find(({ status }) => status === "rejected");
  assert.ok(rejected?.status === "rejected");
  assertApplicationError(rejected.reason, "CONFLICT", "PRODUCT_MATERIALS_STALE_WRITE");

  assert.equal(await draftPercentageTotal(fixture.draftId), "70.00");
  assert.equal(await auditCount(fixture.productId), 1);
  await assertMinimizedAudits(fixture.productId, ["ADD"]);
  await assertPublishedMaterialUnchanged(fixture);
});

test("preserves exact DECIMAL values and enforces all ProductMaterial CHECK constraints", async () => {
  const fixture = await createFixture(null);
  const material = await prisma.productMaterial.create({
    data: {
      productVersionId: fixture.draftId,
      materialName: "Decimal probe",
      percentage: "0.00",
      isRecycled: true,
      recycledPercentage: "0.00",
    },
    select: { id: true, percentage: true, recycledPercentage: true },
  });
  assert.equal(material.percentage?.toFixed(2), "0.00");
  assert.equal(material.recycledPercentage?.toFixed(2), "0.00");

  const hundred = await prisma.productMaterial.update({
    where: { id: material.id },
    data: { percentage: "100.00", recycledPercentage: "100.00" },
    select: { percentage: true, recycledPercentage: true },
  });
  assert.equal(hundred.percentage?.toFixed(2), "100.00");
  assert.equal(hundred.recycledPercentage?.toFixed(2), "100.00");

  const fractional = await prisma.productMaterial.update({
    where: { id: material.id },
    data: { percentage: "33.33", recycledPercentage: "12.34" },
    select: { percentage: true, recycledPercentage: true },
  });
  assert.equal(fractional.percentage?.toFixed(2), "33.33");
  assert.equal(fractional.recycledPercentage?.toFixed(2), "12.34");

  for (const data of [
    { percentage: "-0.01" },
    { percentage: "100.01" },
    { recycledPercentage: "-0.01" },
    { recycledPercentage: "100.01" },
    { isRecycled: false, recycledPercentage: "1.00" },
  ]) {
    await assert.rejects(prisma.productMaterial.update({ where: { id: material.id }, data }));
  }
  const unchanged = await prisma.productMaterial.findUniqueOrThrow({
    where: { id: material.id },
    select: { percentage: true, isRecycled: true, recycledPercentage: true },
  });
  assert.deepEqual({
    percentage: unchanged.percentage?.toFixed(2),
    isRecycled: unchanged.isRecycled,
    recycledPercentage: unchanged.recycledPercentage?.toFixed(2),
  }, { percentage: "33.33", isRecycled: true, recycledPercentage: "12.34" });
});

test("uses real row CAS for EDIT and rolls back aggregate touches and audit on failure", async () => {
  const fixture = await createFixture("20.00");
  const before = await currentEvidence(fixture);
  const beforeState = await aggregateState(fixture);
  const paused = pauseBeforeAggregateCas(fixture.persistence);
  const operation = fixture.services.edit({
    productId: fixture.productId,
    materialId: fixture.draftMaterialId,
    ...editableValues("Edited by service", "25.00"),
    ...before,
    expectedMaterialUpdatedAt: fixture.draftMaterialUpdatedAt.toISOString(),
  }, fixture.context);

  await paused.reached;
  const externalUpdatedAt = new Date(fixture.draftMaterialUpdatedAt.getTime() + 10_000);
  await prisma.productMaterial.update({
    where: { id: fixture.draftMaterialId },
    data: { materialName: "External edit", updatedAt: externalUpdatedAt },
  });
  paused.release();

  await assert.rejects(operation, (error) => {
    assertApplicationError(error, "CONFLICT", "PRODUCT_MATERIALS_STALE_WRITE");
    return true;
  });
  assert.deepEqual(await aggregateState(fixture), beforeState);
  assert.equal((await prisma.productMaterial.findUniqueOrThrow({
    where: { id: fixture.draftMaterialId },
    select: { materialName: true },
  })).materialName, "External edit");
  await assertPublishedMaterialUnchanged(fixture);
});

test("uses real row CAS for REMOVE and rolls back aggregate touches and audit on failure", async () => {
  const fixture = await createFixture("20.00");
  const before = await currentEvidence(fixture);
  const beforeState = await aggregateState(fixture);
  const paused = pauseBeforeAggregateCas(fixture.persistence);
  const operation = fixture.services.remove({
    productId: fixture.productId,
    materialId: fixture.draftMaterialId,
    ...before,
    expectedMaterialUpdatedAt: fixture.draftMaterialUpdatedAt.toISOString(),
  }, fixture.context);

  await paused.reached;
  const externalUpdatedAt = new Date(fixture.draftMaterialUpdatedAt.getTime() + 10_000);
  await prisma.productMaterial.update({
    where: { id: fixture.draftMaterialId },
    data: { updatedAt: externalUpdatedAt },
  });
  paused.release();

  await assert.rejects(operation, (error) => {
    assertApplicationError(error, "CONFLICT", "PRODUCT_MATERIALS_STALE_WRITE");
    return true;
  });
  assert.deepEqual(await aggregateState(fixture), beforeState);
  assert.equal(await prisma.productMaterial.count({ where: { id: fixture.draftMaterialId } }), 1);
  await assertPublishedMaterialUnchanged(fixture);
});

test("rolls back collection failures and rejects stale Product and ProductVersion evidence", async () => {
  const fixture = await createFixture("90.00");
  const evidence = await currentEvidence(fixture);
  const before = await fullDraftState(fixture);
  await assert.rejects(fixture.services.add({
    productId: fixture.productId,
    ...editableValues("Too much", "10.01"),
    ...evidence,
  }, fixture.context), (error) => {
    assertApplicationError(error, "VALIDATION", "PRODUCT_MATERIALS_COLLECTION_INVALID");
    return true;
  });
  assert.deepEqual(await fullDraftState(fixture), before);

  const staleProductEvidence = await currentEvidence(fixture);
  await prisma.product.update({
    where: { id: fixture.productId },
    data: { updatedAt: new Date(new Date(staleProductEvidence.expectedProductUpdatedAt).getTime() + 10_000) },
  });
  await expectStaleAdd(fixture, staleProductEvidence, "Stale product");

  const staleDraftEvidence = await currentEvidence(fixture);
  await prisma.productVersion.update({
    where: { id: fixture.draftId },
    data: { updatedAt: new Date(new Date(staleDraftEvidence.expectedDraftUpdatedAt).getTime() + 10_000) },
  });
  await expectStaleAdd(fixture, staleDraftEvidence, "Stale draft");
  assert.equal(await auditCount(fixture.productId), 0);
  await assertPublishedMaterialUnchanged(fixture);
});

test("writes one minimized audit per real ADD EDIT REMOVE and none for a true no-op", async () => {
  const fixture = await createFixture("20.00");
  const evidence = await currentEvidence(fixture);
  await fixture.services.add({
    productId: fixture.productId,
    ...editableValues("Added material", "10.00"),
    ...evidence,
  }, fixture.context);

  let snapshot = await fixture.services.get({ productId: fixture.productId }, fixture.context);
  const draftMaterial = snapshot.materials.find(({ materialId }) => materialId === fixture.draftMaterialId);
  assert.ok(draftMaterial);
  await fixture.services.edit({
    productId: fixture.productId,
    materialId: draftMaterial.materialId,
    ...editableValues("Edited material", "25.00"),
    ...toEvidence(snapshot),
    expectedMaterialUpdatedAt: draftMaterial.updatedAt.toISOString(),
  }, fixture.context);

  snapshot = await fixture.services.get({ productId: fixture.productId }, fixture.context);
  const edited = snapshot.materials.find(({ materialId }) => materialId === fixture.draftMaterialId);
  assert.ok(edited);
  const beforeNoOp = await aggregateState(fixture);
  const noOp = await fixture.services.edit({
    productId: fixture.productId,
    materialId: edited.materialId,
    materialName: ` ${edited.materialName} `,
    category: edited.category,
    percentage: edited.percentage,
    isRecycled: edited.isRecycled,
    recycledPercentage: edited.recycledPercentage,
    ...toEvidence(snapshot),
    expectedMaterialUpdatedAt: edited.updatedAt.toISOString(),
  }, fixture.context);
  assert.equal(noOp.status, "NO_CHANGE");
  assert.deepEqual(await aggregateState(fixture), beforeNoOp);

  snapshot = await fixture.services.get({ productId: fixture.productId }, fixture.context);
  const added = snapshot.materials.find(({ materialName }) => materialName === "Added material");
  assert.ok(added);
  await fixture.services.remove({
    productId: fixture.productId,
    materialId: added.materialId,
    ...toEvidence(snapshot),
    expectedMaterialUpdatedAt: added.updatedAt.toISOString(),
  }, fixture.context);

  assert.equal(await auditCount(fixture.productId), 3);
  await assertMinimizedAudits(fixture.productId, ["ADD", "EDIT", "REMOVE"]);
  await assertPublishedMaterialUnchanged(fixture);
});

interface Fixture {
  readonly userId: string;
  readonly organizationId: string;
  readonly membershipId: string;
  readonly productId: string;
  readonly draftId: string;
  readonly publishedId: string;
  readonly draftMaterialId: string;
  readonly draftMaterialUpdatedAt: Date;
  readonly publishedMaterialId: string;
  readonly publishedMaterialSnapshot: PublishedMaterialSnapshot;
  readonly context: AuthenticatedUserContext;
  readonly persistence: PrismaProductMaterialsCurrentDraftPersistence;
  readonly services: ReturnType<typeof createProductMaterialsCurrentDraftServices>;
}

interface PublishedMaterialSnapshot {
  readonly id: string;
  readonly productVersionId: string;
  readonly materialName: string;
  readonly category: string | null;
  readonly percentage: string | null;
  readonly isRecycled: boolean;
  readonly recycledPercentage: string | null;
  readonly updatedAt: Date;
}

async function createFixture(initialPercentage: string | null): Promise<Fixture> {
  const userId = randomUUID();
  const organizationId = randomUUID();
  const membershipId = randomUUID();
  const productId = randomUUID();
  const draftId = randomUUID();
  const publishedId = randomUUID();

  await prisma.user.create({
    data: { id: userId, email: `${randomUUID()}@materials-disposable.test`, displayName: "Materials Test User" },
  });
  await prisma.organization.create({
    data: { id: organizationId, displayName: "Materials Disposable Test", status: "ACTIVE" },
  });
  await prisma.membership.create({
    data: { id: membershipId, organizationId, userId, role: "EDITOR", status: "ACTIVE", joinedAt: new Date() },
  });
  await prisma.product.create({
    data: {
      id: productId,
      organizationId,
      internalName: "Materials aggregate",
      publicCode: randomUUID().replaceAll("-", "").slice(0, 22),
      createdById: userId,
      updatedById: userId,
    },
  });
  await prisma.productVersion.create({
    data: { id: draftId, productId, organizationId, status: "DRAFT", sourceLocale: "en", createdById: userId, updatedById: userId },
  });
  await prisma.productVersion.create({
    data: {
      id: publishedId,
      productId,
      organizationId,
      status: "PUBLISHED",
      sourceLocale: "en",
      createdById: userId,
      updatedById: userId,
      publishedById: userId,
      publishedAt: new Date(),
    },
  });
  await prisma.product.update({
    where: { id: productId },
    data: { currentDraftVersionId: draftId, currentPublishedVersionId: publishedId },
  });
  const draftMaterial = await prisma.productMaterial.create({
    data: {
      productVersionId: draftId,
      materialName: "Draft steel",
      category: "Metal",
      percentage: initialPercentage,
      isRecycled: true,
      recycledPercentage: "40.00",
    },
    select: { id: true, updatedAt: true },
  });
  const publishedMaterial = await prisma.productMaterial.create({
    data: {
      productVersionId: publishedId,
      materialName: "Published steel",
      category: "Published",
      percentage: "77.77",
      isRecycled: true,
      recycledPercentage: "66.66",
    },
    select: {
      id: true,
      productVersionId: true,
      materialName: true,
      category: true,
      percentage: true,
      isRecycled: true,
      recycledPercentage: true,
      updatedAt: true,
    },
  });
  const persistence = new PrismaProductMaterialsCurrentDraftPersistence(prisma);
  const services = createProductMaterialsCurrentDraftServices({
    persistence,
    transactionRunner: new PrismaProductMaterialsCurrentDraftTransactionRunner(prisma),
  });
  return {
    userId,
    organizationId,
    membershipId,
    productId,
    draftId,
    publishedId,
    draftMaterialId: draftMaterial.id,
    draftMaterialUpdatedAt: draftMaterial.updatedAt,
    publishedMaterialId: publishedMaterial.id,
    publishedMaterialSnapshot: {
      ...publishedMaterial,
      percentage: publishedMaterial.percentage?.toFixed(2) ?? null,
      recycledPercentage: publishedMaterial.recycledPercentage?.toFixed(2) ?? null,
    },
    context: {
      userId,
      organizationId,
      membershipId,
      membershipRole: "EDITOR",
      membershipStatus: "ACTIVE",
      permissions: [PRODUCT_READ, PRODUCT_EDIT],
      correlationId: randomUUID(),
    },
    persistence,
    services,
  };
}

function editableValues(materialName: string, percentage: string): ProductMaterialValues {
  return {
    materialName,
    category: "Metal",
    percentage,
    isRecycled: true,
    recycledPercentage: "50.00",
  };
}

async function currentEvidence(fixture: Fixture): Promise<ProductMaterialConcurrencyEvidence> {
  return toEvidence(await fixture.services.get({ productId: fixture.productId }, fixture.context));
}

function toEvidence(snapshot: {
  readonly expectedDraftVersionId: string;
  readonly expectedProductUpdatedAt: Date;
  readonly expectedDraftUpdatedAt: Date;
}): ProductMaterialConcurrencyEvidence {
  return {
    expectedDraftVersionId: snapshot.expectedDraftVersionId,
    expectedProductUpdatedAt: snapshot.expectedProductUpdatedAt.toISOString(),
    expectedDraftUpdatedAt: snapshot.expectedDraftUpdatedAt.toISOString(),
  };
}

function pauseBeforeAggregateCas(persistence: PrismaProductMaterialsCurrentDraftPersistence) {
  const original = persistence.readMaterials.bind(persistence);
  let markReached!: () => void;
  let release!: () => void;
  const reached = new Promise<void>((resolve) => { markReached = resolve; });
  const waitForRelease = new Promise<void>((resolve) => { release = resolve; });
  persistence.readMaterials = async (transaction, input) => {
    const rows = await original(transaction, input);
    markReached();
    await waitForRelease;
    return rows;
  };
  return { reached, release };
}

async function draftPercentageTotal(draftId: string): Promise<string> {
  const rows = await prisma.productMaterial.findMany({
    where: { productVersionId: draftId, percentage: { not: null } },
    select: { percentage: true },
  });
  const hundredths = rows.reduce((sum, row) => {
    const [whole, fraction] = row.percentage!.toFixed(2).split(".");
    return sum + BigInt(whole) * BigInt(100) + BigInt(fraction);
  }, BigInt(0));
  return `${hundredths / BigInt(100)}.${String(hundredths % BigInt(100)).padStart(2, "0")}`;
}

async function aggregateState(fixture: Fixture) {
  const [product, draft, audits] = await Promise.all([
    prisma.product.findUniqueOrThrow({ where: { id: fixture.productId }, select: { updatedAt: true } }),
    prisma.productVersion.findUniqueOrThrow({ where: { id: fixture.draftId }, select: { updatedAt: true } }),
    auditCount(fixture.productId),
  ]);
  return { productUpdatedAt: product.updatedAt, draftUpdatedAt: draft.updatedAt, audits };
}

async function fullDraftState(fixture: Fixture) {
  const aggregate = await aggregateState(fixture);
  const materials = await prisma.productMaterial.findMany({
    where: { productVersionId: fixture.draftId },
    orderBy: { id: "asc" },
    select: { id: true, materialName: true, percentage: true, updatedAt: true },
  });
  return {
    ...aggregate,
    materials: materials.map((material) => ({
      ...material,
      percentage: material.percentage?.toFixed(2) ?? null,
    })),
  };
}

async function auditCount(productId: string): Promise<number> {
  return prisma.auditLog.count({ where: { entityType: "PRODUCT", entityId: productId } });
}

async function assertMinimizedAudits(productId: string, operations: readonly string[]) {
  const audits = await prisma.auditLog.findMany({
    where: { entityType: "PRODUCT", entityId: productId },
    orderBy: { createdAt: "asc" },
    select: { action: true, metadata: true },
  });
  assert.deepEqual(audits.map(({ action }) => action), operations.map(() => "PRODUCT_UPDATED"));
  assert.deepEqual(audits.map(({ metadata }) => (metadata as { operation: string }).operation), operations);
  for (const audit of audits) {
    const metadata = audit.metadata as Record<string, unknown>;
    assert.equal(metadata.changedCollection, "materials");
    assert.deepEqual(Object.keys(metadata).sort(), metadata.operation === "EDIT"
      ? ["changedCollection", "changedFields", "operation"]
      : ["changedCollection", "operation"]);
    assert.doesNotMatch(JSON.stringify(metadata), /steel|Metal|\d+\.\d+|materialId/i);
  }
}

async function assertPublishedMaterialUnchanged(fixture: Fixture) {
  const current = await prisma.productMaterial.findUniqueOrThrow({
    where: { id: fixture.publishedMaterialId },
    select: {
      id: true,
      productVersionId: true,
      materialName: true,
      category: true,
      percentage: true,
      isRecycled: true,
      recycledPercentage: true,
      updatedAt: true,
    },
  });
  assert.deepEqual({
    ...current,
    percentage: current.percentage?.toFixed(2) ?? null,
    recycledPercentage: current.recycledPercentage?.toFixed(2) ?? null,
  }, fixture.publishedMaterialSnapshot);
}

async function expectStaleAdd(
  fixture: Fixture,
  evidence: ProductMaterialConcurrencyEvidence,
  materialName: string,
) {
  await assert.rejects(fixture.services.add({
    productId: fixture.productId,
    ...editableValues(materialName, "1.00"),
    ...evidence,
  }, fixture.context), (error) => {
    assertApplicationError(error, "CONFLICT", "PRODUCT_MATERIALS_STALE_WRITE");
    return true;
  });
}

function assertApplicationError(
  error: unknown,
  category: ApplicationError["category"],
  code: string,
) {
  assert.ok(error instanceof ApplicationError);
  assert.equal(error.category, category);
  assert.equal(error.code, code);
}
