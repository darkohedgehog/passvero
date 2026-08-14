import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
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

const listTypeScriptFiles = (directory) => readdirSync(
  new URL(`../${directory}`, import.meta.url),
  { recursive: true },
).filter((path) => /\.(ts|tsx)$/.test(path)).map((path) => `${directory}/${path}`);

const runtimePath =
  "src/infrastructure/persistence/prisma/production-prisma-runtime.ts";
const configPath =
  "src/infrastructure/persistence/prisma/production-prisma-config.ts";
const corePath =
  "src/infrastructure/persistence/prisma/production-prisma-runtime-core.ts";

function assertClientSourceDoesNotImportRuntime(source, label) {
  if (/^\s*["']use client["'];/m.test(source)) {
    assert.doesNotMatch(
      source,
      /production-prisma-runtime|production-prisma-config|production-prisma-runtime-core|prisma-create-product-composition/,
      `${label} imports the production database boundary from a client module`,
    );
  }
}

test("marks the production wrapper server-only and isolates environment access", () => {
  const runtimeSource = read(runtimePath);
  const configSource = read(configPath);
  const coreSource = read(corePath);

  assert.match(runtimeSource, /^import "server-only";/);
  assert.match(runtimeSource, /process\.env\.DATABASE_URL/);
  assert.doesNotMatch(runtimeSource, /TEST_DATABASE_URL/);
  assert.doesNotMatch(`${configSource}\n${coreSource}`, /process\.env|TEST_DATABASE_URL|server-only/);
  assert.match(runtimeSource, /new PrismaPg\(pool, \{ disposeExternalPool: true \}\)/);
});

test("guards client modules against production database imports", () => {
  assert.throws(
    () => assertClientSourceDoesNotImportRuntime(
      '"use client";\nimport "@/src/infrastructure/persistence/prisma/production-prisma-runtime";',
      "synthetic-client.tsx",
    ),
    /imports the production database boundary/,
  );

  for (const path of listTypeScriptFiles("src")) {
    assertClientSourceDoesNotImportRuntime(read(path), path);
  }
});

test("keeps production database infrastructure out of application and domain layers", () => {
  const protectedSource = [
    ...listTypeScriptFiles("src/application"),
    ...listTypeScriptFiles("src/domain"),
  ].map(read).join("\n");
  const productionInfrastructure = [
    runtimePath,
    configPath,
    corePath,
    "src/infrastructure/persistence/prisma/prisma-create-product-composition.ts",
  ].map(read).join("\n");

  assert.doesNotMatch(
    protectedSource,
    /@prisma|generated\/prisma|PrismaClient|PrismaPg|from ["']pg["']|production-prisma/,
  );
  assert.doesNotMatch(productionInfrastructure, /tests\/helpers|TEST_DATABASE_URL|withAccelerate|accelerateUrl|\.env\.migrator/);
  assert.doesNotMatch(productionInfrastructure, /CreateProductService|new CreateProduct\b|\.execute\(/);
});
