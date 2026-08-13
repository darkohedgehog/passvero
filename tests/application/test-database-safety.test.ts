import assert from "node:assert/strict";
import test from "node:test";

import {
  cleanupCreateProductFixture,
  createTestPrismaClient,
  requireSafeTestDatabaseConfig,
  type CreateProductFixtureIds,
  type SafeTestDatabaseConfig,
} from "../helpers/test-database";
import type { PrismaClient } from "../../src/generated/prisma/client";

const unsafeEnvironments: readonly NodeJS.ProcessEnv[] = [
  testEnvironment({}),
  testEnvironment({ TEST_DATABASE_URL: "   " }),
  testEnvironment({ TEST_DATABASE_URL: "not a url" }),
  testEnvironment({ TEST_DATABASE_URL: "mysql://user:secret@db.example/passvero_test" }),
  testEnvironment({ TEST_DATABASE_URL: "postgresql://user@db.example/passvero_test" }),
  testEnvironment({ TEST_DATABASE_URL: "postgresql://:secret@db.example/passvero_test" }),
  testEnvironment({ TEST_DATABASE_URL: "postgresql://user:secret@/passvero_test" }),
  testEnvironment({ TEST_DATABASE_URL: "postgresql://user:secret@db.example/" }),
  testEnvironment({
    TEST_DATABASE_URL: "postgresql://user:secret@db.example/%20%20",
  }),
  testEnvironment({
    TEST_DATABASE_URL: "postgresql://user:secret@db.example/passvero",
  }),
  testEnvironment({
    TEST_DATABASE_URL:
      "mysql://user:secret@db.example/passvero_test?token=unique-query-secret",
  }),
  testEnvironment({
    TEST_DATABASE_URL: "postgresql://user:secret@db.example/passvero_%E0%A4%A",
  }),
  testEnvironment({
    TEST_DATABASE_URL: " postgresql://user:secret@db.example/passvero_test",
  }),
  testEnvironment({
    TEST_DATABASE_URL: "postgresql://user:secret@db.example/passvero_test ",
  }),
  testEnvironment({
    TEST_DATABASE_URL: "postgresql://user:secret@db.example/passvero_test",
    DATABASE_URL: "postgresql://user:secret@db.example/passvero_test",
  }),
];

function testEnvironment(
  values: Omit<NodeJS.ProcessEnv, "NODE_ENV">,
): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...values };
}

function assertSafeError(
  callback: () => unknown,
  additionalSecrets: readonly string[] = [],
): void {
  assert.throws(callback, (error: unknown) => {
    const message = String(error);

    assert.match(message, /TEST_DATABASE_URL/);
    assert.doesNotMatch(message, /secret|user|db\.example|postgresql:\/\//i);

    for (const additionalSecret of additionalSecrets) {
      assert.doesNotMatch(message, new RegExp(additionalSecret, "i"));
    }

    return true;
  });
}

test("never falls back to DATABASE_URL", () => {
  assert.throws(
    () =>
      requireSafeTestDatabaseConfig(testEnvironment({
        DATABASE_URL: "postgresql://user:secret@db.example/passvero_test",
      })),
    /TEST_DATABASE_URL is required/,
  );
});

test("rejects unsafe test database URLs without echoing credentials or URLs", () => {
  for (const environment of unsafeEnvironments) {
    assertSafeError(
      () => requireSafeTestDatabaseConfig(environment),
      ["unique-query-secret"],
    );
  }
});

test("accepts dedicated test databases on remote hosts", () => {
  const postgresqlConfig = requireSafeTestDatabaseConfig(testEnvironment({
    TEST_DATABASE_URL:
      "postgresql://user:secret@remote.example:6432/passvero_test?sslmode=require",
  }));
  const postgresConfig = requireSafeTestDatabaseConfig(testEnvironment({
    TEST_DATABASE_URL: "postgres://user:secret@remote.example/passvero_integration_test",
  }));
  const encodedConfig = requireSafeTestDatabaseConfig(testEnvironment({
    TEST_DATABASE_URL: "postgresql://user:secret@remote.example/passvero_%74est",
  }));
  const uppercaseConfig = requireSafeTestDatabaseConfig(testEnvironment({
    TEST_DATABASE_URL: "postgresql://user:secret@remote.example/passvero_TEST_DB",
  }));
  const ipv6Config = requireSafeTestDatabaseConfig(testEnvironment({
    TEST_DATABASE_URL: "postgresql://user:secret@[2001:db8::1]:6432/passvero_test",
  }));

  assert.equal(postgresqlConfig.databaseName, "passvero_test");
  assert.equal(postgresConfig.databaseName, "passvero_integration_test");
  assert.equal(encodedConfig.databaseName, "passvero_test");
  assert.equal(uppercaseConfig.databaseName, "passvero_TEST_DB");
  assert.equal(ipv6Config.databaseName, "passvero_test");
});

test("rejects forged unsafe configuration before constructing a Prisma client", () => {
  const forgedConfig: SafeTestDatabaseConfig = {
    url: "postgresql://user:secret@db.example/passvero",
    databaseName: "passvero",
  };

  assertSafeError(() => createTestPrismaClient(forgedConfig));
});

test("rejects padded valid URLs before client construction without leaking them", () => {
  for (const url of [
    " postgresql://user:secret@db.example/passvero_test?token=unique-query-secret",
    "postgresql://user:secret@db.example/passvero_test?token=unique-query-secret ",
  ]) {
    assertSafeError(
      () => requireSafeTestDatabaseConfig(testEnvironment({ TEST_DATABASE_URL: url })),
      ["unique-query-secret"],
    );
    assertSafeError(
      () => createTestPrismaClient({ url, databaseName: "passvero_test" }),
      ["unique-query-secret"],
    );
  }
});

test("rejects a safe URL paired with an inconsistent database name before client construction", () => {
  assertSafeError(() =>
    createTestPrismaClient({
      url: "postgresql://user:secret@remote.example/passvero_test",
      databaseName: "another_test_database",
    }),
  );
});

test("rejects every blank fixture identifier before starting a transaction", async () => {
  const blankFixtures: readonly CreateProductFixtureIds[] = [
    { ...fixtureIds(), userId: " " },
    { ...fixtureIds(), organizationId: " " },
    { ...fixtureIds(), membershipId: " " },
    { ...fixtureIds(), productIds: [" "] },
  ];

  for (const fixture of blankFixtures) {
    const recorder = new RecordingPrisma([]);

    await assert.rejects(
      cleanupCreateProductFixture(recorder.asPrismaClient(), fixture),
      /fixture .* is required/,
    );
    assert.equal(recorder.transactionCalls, 0);
    assert.deepEqual(recorder.operations, []);
  }
});

test("cleans an empty product fixture only through explicit membership organization and user filters", async () => {
  const recorder = new RecordingPrisma([]);
  const fixture = fixtureIds({ productIds: [] });

  await cleanupCreateProductFixture(recorder.asPrismaClient(), fixture);

  assert.equal(recorder.transactionCalls, 1);
  assert.deepEqual(recorder.operations, [
    {
      name: "membership.deleteMany",
      arguments: {
        where: {
          id: fixture.membershipId,
          userId: fixture.userId,
          organizationId: fixture.organizationId,
        },
      },
    },
    {
      name: "organization.deleteMany",
      arguments: { where: { id: fixture.organizationId } },
    },
    {
      name: "user.deleteMany",
      arguments: { where: { id: fixture.userId } },
    },
  ]);
});

test("cleans a product fixture in the exact scoped reverse-dependency order", async () => {
  const fixture = fixtureIds({ productIds: ["product-1", "product-2"] });
  const recorder = new RecordingPrisma(["version-1", "version-2"]);

  await cleanupCreateProductFixture(recorder.asPrismaClient(), fixture);

  assert.deepEqual(recorder.operations, [
    {
      name: "auditLog.deleteMany",
      arguments: {
        where: {
          organizationId: fixture.organizationId,
          entityType: "PRODUCT",
          entityId: { in: fixture.productIds },
        },
      },
    },
    {
      name: "product.updateMany",
      arguments: {
        where: {
          id: { in: fixture.productIds },
          organizationId: fixture.organizationId,
        },
        data: {
          currentDraftVersionId: null,
          currentPublishedVersionId: null,
        },
      },
    },
    {
      name: "productVersion.findMany",
      arguments: {
        where: {
          productId: { in: fixture.productIds },
          organizationId: fixture.organizationId,
        },
        select: { id: true },
      },
    },
    {
      name: "productTranslation.deleteMany",
      arguments: { where: { productVersionId: { in: ["version-1", "version-2"] } } },
    },
    {
      name: "productVersion.deleteMany",
      arguments: {
        where: {
          id: { in: ["version-1", "version-2"] },
          organizationId: fixture.organizationId,
        },
      },
    },
    {
      name: "product.deleteMany",
      arguments: {
        where: {
          id: { in: fixture.productIds },
          organizationId: fixture.organizationId,
        },
      },
    },
    {
      name: "membership.deleteMany",
      arguments: {
        where: {
          id: fixture.membershipId,
          userId: fixture.userId,
          organizationId: fixture.organizationId,
        },
      },
    },
    {
      name: "organization.deleteMany",
      arguments: { where: { id: fixture.organizationId } },
    },
    {
      name: "user.deleteMany",
      arguments: { where: { id: fixture.userId } },
    },
  ]);
});

test("skips version deletes when the scoped version lookup is empty", async () => {
  const fixture = fixtureIds({ productIds: ["product-1"] });
  const recorder = new RecordingPrisma([]);

  await cleanupCreateProductFixture(recorder.asPrismaClient(), fixture);

  assert.deepEqual(recorder.operations, [
    {
      name: "auditLog.deleteMany",
      arguments: {
        where: {
          organizationId: fixture.organizationId,
          entityType: "PRODUCT",
          entityId: { in: fixture.productIds },
        },
      },
    },
    {
      name: "product.updateMany",
      arguments: {
        where: {
          id: { in: fixture.productIds },
          organizationId: fixture.organizationId,
        },
        data: {
          currentDraftVersionId: null,
          currentPublishedVersionId: null,
        },
      },
    },
    {
      name: "productVersion.findMany",
      arguments: {
        where: {
          productId: { in: fixture.productIds },
          organizationId: fixture.organizationId,
        },
        select: { id: true },
      },
    },
    {
      name: "product.deleteMany",
      arguments: {
        where: {
          id: { in: fixture.productIds },
          organizationId: fixture.organizationId,
        },
      },
    },
    {
      name: "membership.deleteMany",
      arguments: {
        where: {
          id: fixture.membershipId,
          userId: fixture.userId,
          organizationId: fixture.organizationId,
        },
      },
    },
    {
      name: "organization.deleteMany",
      arguments: { where: { id: fixture.organizationId } },
    },
    {
      name: "user.deleteMany",
      arguments: { where: { id: fixture.userId } },
    },
  ]);
});

interface RecordedOperation {
  readonly name: string;
  readonly arguments: unknown;
}

interface FixtureOverrides {
  readonly userId?: string;
  readonly organizationId?: string;
  readonly membershipId?: string;
  readonly productIds?: readonly string[];
}

function fixtureIds(overrides: FixtureOverrides = {}): CreateProductFixtureIds {
  return {
    userId: "user-1",
    organizationId: "organization-1",
    membershipId: "membership-1",
    productIds: ["product-1"],
    ...overrides,
  };
}

class RecordingPrisma {
  public transactionCalls = 0;
  public readonly operations: RecordedOperation[] = [];

  private readonly transaction = {
    auditLog: {
      deleteMany: async (arguments_: unknown) => this.record("auditLog.deleteMany", arguments_),
    },
    product: {
      updateMany: async (arguments_: unknown) => this.record("product.updateMany", arguments_),
      deleteMany: async (arguments_: unknown) => this.record("product.deleteMany", arguments_),
    },
    productVersion: {
      findMany: async (arguments_: unknown) => {
        this.record("productVersion.findMany", arguments_);
        return this.productVersionIds.map((id) => ({ id }));
      },
      deleteMany: async (arguments_: unknown) => this.record("productVersion.deleteMany", arguments_),
    },
    productTranslation: {
      deleteMany: async (arguments_: unknown) =>
        this.record("productTranslation.deleteMany", arguments_),
    },
    membership: {
      deleteMany: async (arguments_: unknown) => this.record("membership.deleteMany", arguments_),
    },
    organization: {
      deleteMany: async (arguments_: unknown) => this.record("organization.deleteMany", arguments_),
    },
    user: {
      deleteMany: async (arguments_: unknown) => this.record("user.deleteMany", arguments_),
    },
  };

  public constructor(private readonly productVersionIds: readonly string[]) {}

  public async $transaction(
    callback: (transaction: unknown) => Promise<void>,
  ): Promise<void> {
    this.transactionCalls += 1;
    await callback(this.transaction);
  }

  public asPrismaClient(): PrismaClient {
    return this as unknown as PrismaClient;
  }

  private async record(name: string, arguments_: unknown): Promise<void> {
    this.operations.push({ name, arguments: arguments_ });
  }
}
