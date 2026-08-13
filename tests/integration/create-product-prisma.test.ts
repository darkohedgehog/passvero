import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { ApplicationError } from "../../src/application/errors/application-error";
import { PRODUCT_CREATE } from "../../src/application/permissions/product-permissions";
import { createCreateProductService } from "../../src/application/products/create-product/create-product";
import type { ProductPublicCodeGenerator } from "../../src/application/products/create-product/public-code";
import type {
  CreateProductPersistence,
  CreateProductTelemetry,
  TransactionRunner,
} from "../../src/application/products/create-product/ports";
import { CreateProductPersistenceError } from "../../src/application/products/create-product/ports";
import { NodeProductPublicCodeGenerator } from "../../src/infrastructure/crypto/node-product-public-code-generator";
import {
  PrismaCreateProductPersistence,
  PrismaTransactionRunner,
  type CreateProductPrismaTransaction,
} from "../../src/infrastructure/persistence/prisma/prisma-create-product";
import {
  cleanupCreateProductFixture,
  createTestPrismaClient,
  requireSafeTestDatabaseConfig,
  type CreateProductFixtureIds,
} from "../helpers/test-database";

const databaseConfig = requireSafeTestDatabaseConfig(process.env);
const prisma = createTestPrismaClient(databaseConfig);
const persistence = new PrismaCreateProductPersistence();
const transactionRunner = new PrismaTransactionRunner(prisma);
const observedFixtureIds = {
  userIds: new Set<string>(),
  organizationIds: new Set<string>(),
  membershipIds: new Set<string>(),
  productIds: new Set<string>(),
};

interface IntegrationFixture {
  readonly ids: CreateProductFixtureIds;
  readonly productIds: string[];
  readonly context: AuthenticatedUserContext;
}

let activeFixture: IntegrationFixture | null = null;

test.afterEach(async () => {
  const fixture = activeFixture;
  activeFixture = null;

  if (fixture !== null) {
    await cleanupCreateProductFixture(prisma, fixture.ids);
  }
});

test.after(async () => {
  try {
    await assertNoObservedFixtureRowsRemain();
  } finally {
    await prisma.$disconnect();
  }
});

test("persists one complete initial Product aggregate atomically", async () => {
  const fixture = await createFixture();
  const initialProductName = ` Product ${randomUUID()} `;
  const organizationSku = ` SKU-${randomUUID()} `;
  const service = createService({
    publicCodeGenerator: new NodeProductPublicCodeGenerator(),
  });

  const result = await service(
    {
      initialLocale: "hr",
      initialProductName,
      organizationSku,
    },
    fixture.context,
  );
  registerProduct(fixture, result.productId);

  const [product, versions, translations, auditLogs] = await Promise.all([
    prisma.product.findUnique({
      where: { id: result.productId },
      select: {
        id: true,
        organizationId: true,
        internalName: true,
        sku: true,
        normalizedSku: true,
        publicCode: true,
        lifecycleStatus: true,
        currentDraftVersionId: true,
        currentPublishedVersionId: true,
        createdById: true,
        updatedById: true,
        archivedById: true,
        archivedAt: true,
        lastPublishedAt: true,
        createdAt: true,
      },
    }),
    prisma.productVersion.findMany({
      where: {
        productId: result.productId,
        organizationId: fixture.ids.organizationId,
      },
      select: {
        id: true,
        productId: true,
        organizationId: true,
        status: true,
        sourceLocale: true,
        versionNumber: true,
        versionLabel: true,
        changeSummary: true,
        clonedFromVersionId: true,
        createdById: true,
        updatedById: true,
        publishedById: true,
        reviewReadyAt: true,
        publishedAt: true,
        supersededAt: true,
        discardedAt: true,
      },
    }),
    prisma.productTranslation.findMany({
      where: { productVersionId: result.initialProductVersionId },
      select: {
        id: true,
        productVersionId: true,
        locale: true,
        productName: true,
        shortDescription: true,
        description: true,
        technicalDescription: true,
        repairInstructions: true,
        sparePartsInformation: true,
        recyclingInstructions: true,
        disposalInstructions: true,
        packagingInformation: true,
        safetyInformation: true,
        warrantyInformation: true,
        publicNotes: true,
      },
    }),
    prisma.auditLog.findMany({
      where: {
        organizationId: fixture.ids.organizationId,
        entityType: "PRODUCT",
        entityId: result.productId,
      },
      select: {
        organizationId: true,
        actorId: true,
        action: true,
        entityType: true,
        entityId: true,
        summary: true,
        metadata: true,
        correlationId: true,
      },
    }),
  ]);

  const normalizedName = initialProductName.trim();
  const normalizedSku = organizationSku.trim();

  assert.deepEqual(product, {
    id: result.productId,
    organizationId: fixture.ids.organizationId,
    internalName: normalizedName,
    sku: normalizedSku,
    normalizedSku,
    publicCode: result.publicCode,
    lifecycleStatus: "ACTIVE",
    currentDraftVersionId: result.initialProductVersionId,
    currentPublishedVersionId: null,
    createdById: fixture.ids.userId,
    updatedById: fixture.ids.userId,
    archivedById: null,
    archivedAt: null,
    lastPublishedAt: null,
    createdAt: result.createdAt,
  });
  assert.equal(result.productStatus, "ACTIVE");
  assert.equal(result.draftStatus, "DRAFT");
  assert.equal(result.organizationSku, normalizedSku);

  assert.deepEqual(versions, [{
    id: result.initialProductVersionId,
    productId: result.productId,
    organizationId: fixture.ids.organizationId,
    status: "DRAFT",
    sourceLocale: "hr",
    versionNumber: null,
    versionLabel: null,
    changeSummary: null,
    clonedFromVersionId: null,
    createdById: fixture.ids.userId,
    updatedById: fixture.ids.userId,
    publishedById: null,
    reviewReadyAt: null,
    publishedAt: null,
    supersededAt: null,
    discardedAt: null,
  }]);
  assert.deepEqual(translations, [{
    id: translations[0]?.id,
    productVersionId: result.initialProductVersionId,
    locale: "hr",
    productName: normalizedName,
    shortDescription: null,
    description: null,
    technicalDescription: null,
    repairInstructions: null,
    sparePartsInformation: null,
    recyclingInstructions: null,
    disposalInstructions: null,
    packagingInformation: null,
    safetyInformation: null,
    warrantyInformation: null,
    publicNotes: null,
  }]);
  assert.equal(typeof translations[0]?.id, "string");
  assert.deepEqual(auditLogs, [{
    organizationId: fixture.ids.organizationId,
    actorId: fixture.ids.userId,
    action: "PRODUCT_CREATED",
    entityType: "PRODUCT",
    entityId: result.productId,
    summary: "Product created.",
    metadata: {
      initialProductVersionId: result.initialProductVersionId,
      skuSupplied: true,
    },
    correlationId: fixture.context.correlationId,
  }]);

  assert.deepEqual(await countForbiddenAggregateRows(fixture, result.productId), {
    passports: 0,
    qrCodes: 0,
    documents: 0,
    productImages: 0,
    notifications: 0,
    integrationMappings: 0,
    backgroundJobs: 0,
    subscriptions: 0,
  });
});

test("rolls back the complete aggregate after every approved persistence failpoint", async () => {
  const fixture = await createFixture();
  const stages = ["product", "version", "translation", "pointer", "audit"] as const;
  const generator = new SequencePublicCodeGenerator(
    stages.map(() => createPublicCode()),
  );

  for (const stage of stages) {
    const service = createService({
      publicCodeGenerator: generator,
      persistence: createFailAfterPersistence(persistence, stage, (productId) => {
        registerProduct(fixture, productId);
      }),
    });

    await assert.rejects(
      service(
        {
          initialLocale: "en",
          initialProductName: `Rollback ${stage} ${randomUUID()}`,
          organizationSku: `ROLLBACK-${randomUUID()}`,
        },
        fixture.context,
      ),
      (error: unknown) => {
        assertApplicationError(error, "INTERNAL", "CREATE_PRODUCT_INTERNAL");
        return true;
      },
      stage,
    );

    assert.deepEqual(await countCreateProductRows(fixture), {
      products: 0,
      versions: 0,
      translations: 0,
      auditLogs: 0,
    }, stage);
  }
});

test("allows one concurrent same-SKU create and maps the other to safe CONFLICT", async () => {
  const fixture = await createFixture();
  const generator = new SequencePublicCodeGenerator([
    createPublicCode(),
    createPublicCode(),
  ]);
  const service = createService({ publicCodeGenerator: generator });
  const sharedSku = `CONCURRENT-${randomUUID()}`;

  const results = await Promise.allSettled([
    service(
      {
        initialLocale: "de",
        initialProductName: `Concurrent A ${randomUUID()}`,
        organizationSku: sharedSku,
      },
      fixture.context,
    ),
    service(
      {
        initialLocale: "de",
        initialProductName: `Concurrent B ${randomUUID()}`,
        organizationSku: sharedSku,
      },
      fixture.context,
    ),
  ]);
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  const created = fulfilled[0];
  assert.equal(created?.status, "fulfilled");
  if (created?.status === "fulfilled") {
    registerProduct(fixture, created.value.productId);
  }
  const conflict = rejected[0];
  assert.equal(conflict?.status, "rejected");
  if (conflict?.status === "rejected") {
    assertApplicationError(conflict.reason, "CONFLICT", "CREATE_PRODUCT_SKU_CONFLICT");
  }
  assert.equal(generator.calls, 2, "SKU conflicts must not trigger public-code retry");
  assert.deepEqual(await countCreateProductRows(fixture), {
    products: 1,
    versions: 1,
    translations: 1,
    auditLogs: 1,
  });
});

test("translates real Product uniqueness and active-draft constraints exactly", async () => {
  const fixture = await createFixture();
  const publicCode = createPublicCode();
  const sku = `CONSTRAINT-${randomUUID()}`;
  const holder = await createAndRegisterProduct(fixture, publicCode, sku);

  await assert.rejects(
    transactionRunner.run((transaction) => persistence.createProductIdentity(transaction, {
      organizationId: fixture.ids.organizationId,
      internalName: `Public collision ${randomUUID()}`,
      sku: null,
      normalizedSku: null,
      publicCode,
      actorId: fixture.ids.userId,
    })),
    (error: unknown) => assertPersistenceError(error, "PUBLIC_CODE_CONFLICT"),
  );

  const distinctCode = createPublicCode();
  await assert.rejects(
    transactionRunner.run((transaction) => persistence.createProductIdentity(transaction, {
      organizationId: fixture.ids.organizationId,
      internalName: `SKU collision ${randomUUID()}`,
      sku,
      normalizedSku: sku,
      publicCode: distinctCode,
      actorId: fixture.ids.userId,
    })),
    (error: unknown) => assertPersistenceError(error, "ORGANIZATION_SKU_CONFLICT"),
  );

  await assert.rejects(
    transactionRunner.run((transaction) => persistence.createInitialProductVersion(transaction, {
      productId: holder.productId,
      organizationId: fixture.ids.organizationId,
      sourceLocale: "hr",
      actorId: fixture.ids.userId,
    })),
    (error: unknown) => assertPersistenceError(error, "ACTIVE_DRAFT_CONFLICT"),
  );

  const pointerCandidate = await transactionRunner.run((transaction) =>
    persistence.createProductIdentity(transaction, {
      organizationId: fixture.ids.organizationId,
      internalName: `Pointer candidate ${randomUUID()}`,
      sku: null,
      normalizedSku: null,
      publicCode: createPublicCode(),
      actorId: fixture.ids.userId,
    }));
  registerProduct(fixture, pointerCandidate.productId);

  await assert.rejects(
    transactionRunner.run((transaction) =>
      persistence.assignCurrentDraftVersionIfUnset(transaction, {
        productId: pointerCandidate.productId,
        organizationId: fixture.ids.organizationId,
        productVersionId: holder.initialProductVersionId,
      })),
    (error: unknown) => assertPersistenceError(error, "POINTER_CONFLICT"),
  );
});

test("does not overwrite an unexpected current draft pointer", async () => {
  const fixture = await createFixture();
  const holder = await createAndRegisterProduct(
    fixture,
    createPublicCode(),
    `POINTER-GUARD-${randomUUID()}`,
  );
  const unexpectedVersion = await prisma.productVersion.create({
    data: {
      productId: holder.productId,
      organizationId: fixture.ids.organizationId,
      status: "DISCARDED",
      sourceLocale: "hr",
      versionNumber: null,
      clonedFromVersionId: null,
      createdById: fixture.ids.userId,
      updatedById: fixture.ids.userId,
      publishedById: null,
      reviewReadyAt: null,
      publishedAt: null,
      supersededAt: null,
      discardedAt: new Date(),
    },
    select: { id: true },
  });

  const assigned = await transactionRunner.run((transaction) =>
    persistence.assignCurrentDraftVersionIfUnset(transaction, {
      productId: holder.productId,
      organizationId: fixture.ids.organizationId,
      productVersionId: unexpectedVersion.id,
    }));

  assert.equal(assigned, false);
  assert.equal(
    await prisma.product.findUnique({
      where: { id: holder.productId },
      select: { currentDraftVersionId: true },
    }).then((product) => product?.currentDraftVersionId),
    holder.initialProductVersionId,
  );
});

test("retries one real public-code collision in a fresh complete transaction", async () => {
  const fixture = await createFixture();
  const collisionCode = createPublicCode();
  await createAndRegisterProduct(
    fixture,
    collisionCode,
    `COLLISION-HOLDER-${randomUUID()}`,
  );
  const generator = new SequencePublicCodeGenerator([
    collisionCode,
    createPublicCode(),
  ]);
  const countingRunner = new CountingTransactionRunner(transactionRunner);
  const service = createService({
    publicCodeGenerator: generator,
    transactionRunner: countingRunner,
  });

  const created = await service(
    {
      initialLocale: "sl",
      initialProductName: `Collision target ${randomUUID()}`,
      organizationSku: `COLLISION-TARGET-${randomUUID()}`,
    },
    fixture.context,
  );
  registerProduct(fixture, created.productId);

  assert.equal(generator.calls, 2);
  assert.equal(countingRunner.calls, 2);
  assert.deepEqual(await countCreateProductRows(fixture), {
    products: 2,
    versions: 2,
    translations: 2,
    auditLogs: 2,
  });
});

test("retries two real public-code collisions then creates one aggregate", async () => {
  const fixture = await createFixture();
  const collisionCodes = [createPublicCode(), createPublicCode()];

  for (const code of collisionCodes) {
    await createAndRegisterProduct(
      fixture,
      code,
      `TWO-COLLISION-HOLDER-${randomUUID()}`,
    );
  }

  const generator = new SequencePublicCodeGenerator([
    ...collisionCodes,
    createPublicCode(),
  ]);
  const countingRunner = new CountingTransactionRunner(transactionRunner);
  const target = createService({
    publicCodeGenerator: generator,
    transactionRunner: countingRunner,
  });
  const created = await target(
    {
      initialLocale: "sr",
      initialProductName: `Two collision target ${randomUUID()}`,
      organizationSku: `TWO-COLLISION-TARGET-${randomUUID()}`,
    },
    fixture.context,
  );
  registerProduct(fixture, created.productId);

  assert.equal(generator.calls, 3);
  assert.equal(countingRunner.calls, 3);
  assert.deepEqual(await countCreateProductRows(fixture), {
    products: 3,
    versions: 3,
    translations: 3,
    auditLogs: 3,
  });
});

test("returns safe INTERNAL after three real public-code collisions", async () => {
  const fixture = await createFixture();
  const collisionCodes = [createPublicCode(), createPublicCode(), createPublicCode()];

  for (const code of collisionCodes) {
    await createAndRegisterProduct(
      fixture,
      code,
      `EXHAUSTION-HOLDER-${randomUUID()}`,
    );
  }

  const generator = new SequencePublicCodeGenerator(collisionCodes);
  const countingRunner = new CountingTransactionRunner(transactionRunner);
  const target = createService({
    publicCodeGenerator: generator,
    transactionRunner: countingRunner,
  });

  await assert.rejects(
    target(
      {
        initialLocale: "pl",
        initialProductName: `Exhaustion target ${randomUUID()}`,
        organizationSku: `EXHAUSTION-TARGET-${randomUUID()}`,
      },
      fixture.context,
    ),
    (error: unknown) => {
      assertApplicationError(error, "INTERNAL", "CREATE_PRODUCT_PUBLIC_CODE_EXHAUSTED");
      return true;
    },
  );

  assert.equal(generator.calls, 3);
  assert.equal(countingRunner.calls, 3);
  assert.deepEqual(await countCreateProductRows(fixture), {
    products: 3,
    versions: 3,
    translations: 3,
    auditLogs: 3,
  });
});

async function createFixture(): Promise<IntegrationFixture> {
  const userId = randomUUID();
  const organizationId = randomUUID();
  const membershipId = randomUUID();
  const productIds: string[] = [];
  const fixture: IntegrationFixture = {
    productIds,
    ids: {
      userId,
      organizationId,
      membershipId,
      productIds,
    },
    context: {
      userId,
      organizationId,
      membershipId,
      membershipRole: "EDITOR",
      membershipStatus: "ACTIVE",
      permissions: [PRODUCT_CREATE],
      correlationId: randomUUID(),
    },
  };
  activeFixture = fixture;
  observedFixtureIds.userIds.add(userId);
  observedFixtureIds.organizationIds.add(organizationId);
  observedFixtureIds.membershipIds.add(membershipId);

  await prisma.user.create({
    data: {
      id: userId,
      email: `${randomUUID()}@task9.passvero.test`,
      displayName: `Task 9 User ${randomUUID()}`,
    },
    select: { id: true },
  });
  await prisma.organization.create({
    data: {
      id: organizationId,
      displayName: `Task 9 Organization ${randomUUID()}`,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  await prisma.membership.create({
    data: {
      id: membershipId,
      userId,
      organizationId,
      role: "EDITOR",
      status: "ACTIVE",
      joinedAt: new Date(),
    },
    select: { id: true },
  });

  return fixture;
}

function registerProduct(fixture: IntegrationFixture, productId: string): void {
  fixture.productIds.push(productId);
  observedFixtureIds.productIds.add(productId);
}

function createService(input: {
  readonly publicCodeGenerator: ProductPublicCodeGenerator;
  readonly persistence?: CreateProductPersistence<CreateProductPrismaTransaction>;
  readonly transactionRunner?: TransactionRunner<CreateProductPrismaTransaction>;
}) {
  return createCreateProductService({
    transactionRunner: input.transactionRunner ?? transactionRunner,
    persistence: input.persistence ?? persistence,
    publicCodeGenerator: input.publicCodeGenerator,
    monotonicNow: () => 0,
    telemetry: silentTelemetry,
  });
}

class SequencePublicCodeGenerator implements ProductPublicCodeGenerator {
  calls = 0;

  constructor(private readonly codes: readonly string[]) {}

  generate(): string {
    const code = this.codes[this.calls];
    this.calls += 1;
    assert.equal(typeof code, "string", "public-code sequence exhausted unexpectedly");
    return code;
  }
}

class CountingTransactionRunner
implements TransactionRunner<CreateProductPrismaTransaction> {
  calls = 0;

  constructor(
    private readonly delegate: TransactionRunner<CreateProductPrismaTransaction>,
  ) {}

  run<Result>(
    work: (transaction: CreateProductPrismaTransaction) => Promise<Result>,
  ): Promise<Result> {
    this.calls += 1;
    return this.delegate.run(work);
  }
}

type PersistenceFailpoint = "product" | "version" | "translation" | "pointer" | "audit";

function createFailAfterPersistence(
  delegate: CreateProductPersistence<CreateProductPrismaTransaction>,
  failpoint: PersistenceFailpoint,
  onProductCreated: (productId: string) => void,
): CreateProductPersistence<CreateProductPrismaTransaction> {
  const fail = (stage: PersistenceFailpoint): void => {
    if (failpoint === stage) {
      throw new Error(`Task 9 injected ${stage} failure.`);
    }
  };

  return {
    readEligibility(transaction, input) {
      return delegate.readEligibility(transaction, input);
    },
    async createProductIdentity(transaction, input) {
      const product = await delegate.createProductIdentity(transaction, input);
      onProductCreated(product.productId);
      fail("product");
      return product;
    },
    async createInitialProductVersion(transaction, input) {
      const version = await delegate.createInitialProductVersion(transaction, input);
      fail("version");
      return version;
    },
    async createInitialProductTranslation(transaction, input) {
      const translation = await delegate.createInitialProductTranslation(transaction, input);
      fail("translation");
      return translation;
    },
    async assignCurrentDraftVersionIfUnset(transaction, input) {
      const assigned = await delegate.assignCurrentDraftVersionIfUnset(transaction, input);
      fail("pointer");
      return assigned;
    },
    async insertProductCreatedAuditEvent(transaction, input) {
      const auditLog = await delegate.insertProductCreatedAuditEvent(transaction, input);
      fail("audit");
      return auditLog;
    },
  };
}

function createPublicCode(): string {
  return randomUUID().replaceAll("-", "").slice(0, 22);
}

async function createAndRegisterProduct(
  fixture: IntegrationFixture,
  publicCode: string,
  organizationSku: string,
) {
  const service = createService({
    publicCodeGenerator: new SequencePublicCodeGenerator([publicCode]),
  });
  const result = await service(
    {
      initialLocale: "hr",
      initialProductName: `Fixture Product ${randomUUID()}`,
      organizationSku,
    },
    fixture.context,
  );
  registerProduct(fixture, result.productId);
  return result;
}

function assertApplicationError(
  error: unknown,
  category: "CONFLICT" | "INTERNAL",
  code: string,
): asserts error is ApplicationError {
  assert.ok(error instanceof ApplicationError);
  assert.equal(error.category, category);
  assert.equal(error.code, code);
  assert.equal(error.retryable, false);
  assert.equal(error.correlationId?.length, 36);
  assert.equal("cause" in error, false);
  assert.doesNotMatch(`${error.code} ${error.message}`, /P2002|SQL|postgresql:\/\//);
}

function assertPersistenceError(
  error: unknown,
  kind:
    | "PUBLIC_CODE_CONFLICT"
    | "ORGANIZATION_SKU_CONFLICT"
    | "ACTIVE_DRAFT_CONFLICT"
    | "POINTER_CONFLICT",
): boolean {
  assert.ok(error instanceof CreateProductPersistenceError);
  assert.equal(error.kind, kind);
  assert.equal(Object.hasOwn(error, "cause"), false);
  assert.doesNotMatch(error.message, /P2002|SQL|postgresql:\/\//);
  return true;
}

async function countCreateProductRows(fixture: IntegrationFixture) {
  const [products, versions, translations, auditLogs] = await Promise.all([
    prisma.product.count({
      where: { organizationId: fixture.ids.organizationId },
    }),
    prisma.productVersion.count({
      where: { organizationId: fixture.ids.organizationId },
    }),
    prisma.productTranslation.count({
      where: {
        productVersion: { organizationId: fixture.ids.organizationId },
      },
    }),
    prisma.auditLog.count({
      where: {
        organizationId: fixture.ids.organizationId,
        entityType: "PRODUCT",
      },
    }),
  ]);

  return { products, versions, translations, auditLogs };
}

const silentTelemetry: CreateProductTelemetry = {
  recordSuccess() {},
  recordFailure() {},
  recordPublicCodeCollision() {},
  recordPublicCodeExhaustion() {},
};

async function countForbiddenAggregateRows(
  fixture: IntegrationFixture,
  productId: string,
) {
  const [
    passports,
    qrCodes,
    documents,
    productImages,
    notifications,
    integrationMappings,
    backgroundJobs,
    subscriptions,
  ] = await Promise.all([
    prisma.passport.count({
      where: { productId, organizationId: fixture.ids.organizationId },
    }),
    prisma.qRCode.count({
      where: { passport: { productId, organizationId: fixture.ids.organizationId } },
    }),
    prisma.document.count({
      where: { organizationId: fixture.ids.organizationId },
    }),
    prisma.productImage.count({
      where: { productVersion: { productId, organizationId: fixture.ids.organizationId } },
    }),
    prisma.notification.count({
      where: { organizationId: fixture.ids.organizationId },
    }),
    prisma.integrationMapping.count({
      where: { organizationId: fixture.ids.organizationId },
    }),
    prisma.backgroundJob.count({
      where: { organizationId: fixture.ids.organizationId },
    }),
    prisma.subscription.count({
      where: { organizationId: fixture.ids.organizationId },
    }),
  ]);

  return {
    passports,
    qrCodes,
    documents,
    productImages,
    notifications,
    integrationMappings,
    backgroundJobs,
    subscriptions,
  };
}

async function assertNoObservedFixtureRowsRemain(): Promise<void> {
  const userIds = [...observedFixtureIds.userIds];
  const organizationIds = [...observedFixtureIds.organizationIds];
  const membershipIds = [...observedFixtureIds.membershipIds];
  const productIds = [...observedFixtureIds.productIds];
  const [users, organizations, memberships, products, versions, translations, auditLogs] =
    await Promise.all([
      prisma.user.count({ where: { id: { in: userIds } } }),
      prisma.organization.count({ where: { id: { in: organizationIds } } }),
      prisma.membership.count({ where: { id: { in: membershipIds } } }),
      prisma.product.count({ where: { id: { in: productIds } } }),
      prisma.productVersion.count({ where: { productId: { in: productIds } } }),
      prisma.productTranslation.count({
        where: { productVersion: { productId: { in: productIds } } },
      }),
      prisma.auditLog.count({
        where: {
          organizationId: { in: organizationIds },
          entityType: "PRODUCT",
          entityId: { in: productIds },
        },
      }),
    ]);

  assert.deepEqual(
    { users, organizations, memberships, products, versions, translations, auditLogs },
    { users: 0, organizations: 0, memberships: 0, products: 0, versions: 0, translations: 0, auditLogs: 0 },
  );
}
