import assert from "node:assert/strict";
import test from "node:test";
import { validateProductionDatabaseUrl } from "../../src/infrastructure/persistence/prisma/production-prisma-config";
import { validateAuthDatabaseUrl } from "../../src/infrastructure/auth/auth-database-config";

for (const [role, validate] of [["passvero_app", validateProductionDatabaseUrl], ["passvero_auth", validateAuthDatabaseUrl]] as const) {
  const url = (endpoint: string) => `postgresql://${role}:fixture-password@${endpoint}`;
  for (const [environment, endpoint] of [["production", "127.0.0.1:5432/passvero"], ["staging", "127.0.0.1:5433/passvero_acceptance"]] as const) {
    test(`${environment} ${role} accepts only its fixed endpoint`, () => {
      assert.equal(validate(url(endpoint), environment).connectionString, url(endpoint));
      const [port, database] = environment === "production" ? ["5432", "passvero"] : ["5433", "passvero_acceptance"];
      for (const rejected of [
        environment === "production" ? "127.0.0.1:5433/passvero_acceptance" : "127.0.0.1:5432/passvero",
        `127.0.0.1:6543/${database}`, `127.0.0.1:${port}/other`,
        `127.0.0.1:${port}/${environment === "production" ? "passvero_acceptance" : "passvero"}`,
        `127.0.0.1:${environment === "production" ? "5433" : "5432"}/${database}`,
        `db.example:${port}/${database}`, `localhost:${port}/${database}`, `127.0.0.2:${port}/${database}`,
      ]) assert.throws(() => validate(url(rejected), environment));
      for (const candidate of [url(endpoint).replace(role, "passvero_migrator"),
        url(endpoint).replace(":fixture-password", ""), `${url(endpoint)}?user=${role}`,
        `${url(endpoint)}?sslmode=disable`, `${url(endpoint)}#fragment`, `${url(endpoint)}?`,
        ` ${url(endpoint)}`, `${url(endpoint)} `, url(endpoint).replace("postgresql:", "https:")]) {
        assert.throws(() => validate(candidate, environment), (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.ok(!error.message.includes(candidate));
          assert.ok(!error.message.includes("fixture-password"));
          assert.equal("cause" in error, false);
          return true;
        });
      }
    });
  }
  test(`${role} rejects missing or invalid deployment environment without inferring from URL`, () => {
    for (const environment of [undefined, "", "test", "PRODUCTION", " staging", "staging "]) {
      for (const endpoint of ["127.0.0.1:5432/passvero", "127.0.0.1:5433/passvero_acceptance"]) {
        assert.throws(() => validate(url(endpoint), environment));
      }
    }
  });
}
