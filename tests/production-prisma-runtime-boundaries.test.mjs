import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const packageJson = JSON.parse(read("package.json"));

test("installs production Prisma runtime dependencies and generates deterministically", () => {
  assert.equal(packageJson.dependencies["@prisma/adapter-pg"], "^7.8.0");
  assert.equal(packageJson.dependencies.pg, "^8.23.0");
  assert.equal(packageJson.dependencies["server-only"], "0.0.1");
  assert.equal(packageJson.devDependencies["@prisma/adapter-pg"], undefined);
  assert.equal(packageJson.devDependencies.pg, undefined);
  assert.equal(packageJson.devDependencies["@types/pg"], "^8.21.0");
  assert.equal(packageJson.scripts["prisma:generate"], "prisma generate");
  assert.equal(packageJson.scripts.postinstall, "npm run prisma:generate");
  assert.equal(
    packageJson.scripts["test:infrastructure"],
    "tsx --test tests/infrastructure/*.test.ts",
  );
});
