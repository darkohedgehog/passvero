import assert from "node:assert/strict";
import test from "node:test";

import {
  ProductionDatabaseConfigError,
  validateProductionDatabaseUrl,
} from "../../src/infrastructure/persistence/prisma/production-prisma-config";

const validUrl = "postgresql://passvero_app:not-a-real-secret@localhost:5432/passvero";

function expectCode(value: unknown, code: string): void {
  assert.throws(
    () => validateProductionDatabaseUrl(value),
    (error: unknown) =>
      error instanceof ProductionDatabaseConfigError && error.code === code,
  );
}

test("accepts only the production runtime role and database over direct PostgreSQL", () => {
  assert.deepEqual(validateProductionDatabaseUrl(validUrl), {
    connectionString: validUrl,
  });
  assert.equal(
    validateProductionDatabaseUrl(
      "postgres://passvero_app:not-a-real-secret@localhost/passvero",
    ).connectionString,
    "postgres://passvero_app:not-a-real-secret@localhost/passvero",
  );
  assert.equal(
    validateProductionDatabaseUrl(
      "postgresql://passvero%5Fapp:not-a-real-secret@localhost/passvero",
    ).connectionString,
    "postgresql://passvero%5Fapp:not-a-real-secret@localhost/passvero",
  );
  assert.equal(
    validateProductionDatabaseUrl(
      "postgresql://passvero_app:not-a-real-secret@localhost/pass%76ero",
    ).connectionString,
    "postgresql://passvero_app:not-a-real-secret@localhost/pass%76ero",
  );
});

test("rejects missing, padded, malformed, hosted, test, and migrator configurations", () => {
  expectCode(undefined, "MISSING");
  expectCode("", "MISSING");
  expectCode(` ${validUrl}`, "PADDED");
  expectCode(`${validUrl} `, "PADDED");
  expectCode("not a url", "MALFORMED");
  expectCode("https://passvero_app:not-a-real-secret@localhost/passvero", "SCHEME");
  expectCode("prisma+postgres://accelerate.prisma-data.net/?api_key=redacted", "SCHEME");
  expectCode("postgresql://passvero_migrator:not-a-real-secret@localhost/passvero", "ROLE");
  expectCode("postgresql://passvero_test:not-a-real-secret@localhost/passvero", "ROLE");
  expectCode("postgresql://passvero_app:not-a-real-secret@localhost/passvero_test", "DATABASE");
  expectCode("postgresql://passvero_app:not-a-real-secret@localhost/other", "DATABASE");
  expectCode(
    "postgresql://passvero_app:not-a-real-secret@localhost/passvero%2Fextra",
    "DATABASE",
  );
  expectCode("postgresql://passvero%ZZ:not-a-real-secret@localhost/passvero", "MALFORMED");
});

test("rejects decoded user query parameters with a stable secret-free role error", () => {
  const candidates = [
    `${validUrl}?user=passvero_migrator`,
    `${validUrl}?%75ser=passvero_migrator`,
    `${validUrl}?user=passvero_app`,
  ];

  for (const candidate of candidates) {
    assert.throws(() => validateProductionDatabaseUrl(candidate), (error: unknown) => {
      assert.ok(error instanceof ProductionDatabaseConfigError);
      assert.equal(error.code, "ROLE");
      assert.equal(
        error.message,
        "Production database configuration must use the runtime role.",
      );
      assert.doesNotMatch(error.message, /passvero_app|passvero_migrator|user=|%75ser/);
      assert.equal("cause" in error, false);
      return true;
    });
  }
});

test("never exposes candidate secrets through validation errors", () => {
  const secret = "phase-prerequisite-secret-value";
  const candidate = `postgresql://passvero_migrator:${secret}@remote.example/passvero_test?token=${secret}`;

  assert.throws(() => validateProductionDatabaseUrl(candidate), (error: unknown) => {
    assert.ok(error instanceof ProductionDatabaseConfigError);
    assert.doesNotMatch(error.message, new RegExp(secret));
    assert.doesNotMatch(error.message, /remote\.example|passvero_test|token=/);
    assert.equal("cause" in error, false);
    return true;
  });
});

test("is pure and cannot fall back to TEST_DATABASE_URL", () => {
  const previous = process.env.TEST_DATABASE_URL;
  process.env.TEST_DATABASE_URL = validUrl;
  try {
    expectCode(undefined, "MISSING");
  } finally {
    if (previous === undefined) delete process.env.TEST_DATABASE_URL;
    else process.env.TEST_DATABASE_URL = previous;
  }
});
