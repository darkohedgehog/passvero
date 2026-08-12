import assert from "node:assert/strict";
import test from "node:test";

import {
  createTestPrismaClient,
  requireSafeTestDatabaseConfig,
  type SafeTestDatabaseConfig,
} from "../helpers/test-database";

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
    TEST_DATABASE_URL: "postgresql://user:secret@db.example/passvero",
  }),
  testEnvironment({
    TEST_DATABASE_URL: "postgresql://user:secret@db.example/passvero_%E0%A4%A",
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

function assertSafeError(callback: () => unknown): void {
  assert.throws(callback, (error: unknown) => {
    const message = String(error);

    assert.match(message, /TEST_DATABASE_URL/);
    assert.doesNotMatch(message, /secret|user|db\.example|postgresql:\/\//i);
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
    assertSafeError(() => requireSafeTestDatabaseConfig(environment));
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

  assert.equal(postgresqlConfig.databaseName, "passvero_test");
  assert.equal(postgresConfig.databaseName, "passvero_integration_test");
  assert.equal(encodedConfig.databaseName, "passvero_test");
});

test("rejects forged unsafe configuration before constructing a Prisma client", () => {
  const forgedConfig: SafeTestDatabaseConfig = {
    url: "postgresql://user:secret@db.example/passvero",
    databaseName: "passvero",
  };

  assertSafeError(() => createTestPrismaClient(forgedConfig));
});
