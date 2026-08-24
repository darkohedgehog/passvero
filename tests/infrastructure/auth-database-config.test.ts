import assert from "node:assert/strict";
import test from "node:test";

import {
  AuthDatabaseConfigError,
  validateAuthDatabaseUrl,
} from "../../src/infrastructure/auth/auth-database-config";

const validUrl =
  "postgresql://passvero_auth:not-a-real-secret@127.0.0.1:5432/passvero";

function expectCode(value: unknown, code: string): void {
  assert.throws(
    () => validateAuthDatabaseUrl(value),
    (error: unknown) =>
      error instanceof AuthDatabaseConfigError && error.code === code,
  );
}

test("accepts only the dedicated auth role on the local production database", () => {
  assert.deepEqual(validateAuthDatabaseUrl(validUrl), {
    connectionString: validUrl,
  });
  assert.equal(
    validateAuthDatabaseUrl(
      "postgres://passvero%5Fauth:not-a-real-secret@127.0.0.1:5432/pass%76ero",
    ).connectionString,
    "postgres://passvero%5Fauth:not-a-real-secret@127.0.0.1:5432/pass%76ero",
  );
});

test("rejects missing, padded, malformed, hosted, wrong-role, and wrong-database values", () => {
  expectCode(undefined, "MISSING");
  expectCode("", "MISSING");
  expectCode(` ${validUrl}`, "PADDED");
  expectCode(`${validUrl} `, "PADDED");
  expectCode("not a url", "MALFORMED");
  expectCode("postgresql://passvero_auth@127.0.0.1:5432/passvero", "MALFORMED");
  expectCode(
    "https://passvero_auth:not-a-real-secret@127.0.0.1:5432/passvero",
    "SCHEME",
  );
  expectCode(
    "postgresql://passvero_app:not-a-real-secret@127.0.0.1:5432/passvero",
    "ROLE",
  );
  expectCode(
    "postgresql://passvero_auth:not-a-real-secret@127.0.0.1:5432/passvero_test",
    "DATABASE",
  );
  expectCode(
    "postgresql://passvero_auth:not-a-real-secret@db.example:5432/passvero",
    "HOST",
  );
  expectCode(
    "postgresql://passvero_auth:not-a-real-secret@127.0.0.1:5433/passvero",
    "PORT",
  );
});

test("rejects query parameters without exposing candidate configuration", () => {
  const secret = "stage13c-secret-value";
  const candidates = [
    `${validUrl}?host=db.example`,
    `${validUrl}?port=6543`,
    `postgresql://passvero_auth:${secret}@127.0.0.1:5432/passvero`+
      `?user=passvero_app&token=${secret}`,
  ];

  for (const candidate of candidates) {
    assert.throws(() => validateAuthDatabaseUrl(candidate), (error: unknown) => {
      assert.ok(error instanceof AuthDatabaseConfigError);
      assert.equal(error.code, "MALFORMED");
      assert.doesNotMatch(error.message, new RegExp(secret));
      assert.doesNotMatch(error.message, /127\.0\.0\.1|passvero_app|token=/);
      assert.equal("cause" in error, false);
      return true;
    });
  }
});

test("is pure and cannot fall back to business or test database configuration", () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousTestDatabaseUrl = process.env.TEST_DATABASE_URL;
  process.env.DATABASE_URL = validUrl;
  process.env.TEST_DATABASE_URL = validUrl;
  try {
    expectCode(undefined, "MISSING");
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousTestDatabaseUrl === undefined) delete process.env.TEST_DATABASE_URL;
    else process.env.TEST_DATABASE_URL = previousTestDatabaseUrl;
  }
});
