import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const HARNESS_ROOT = path.join(
  process.cwd(),
  "docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness",
);

const REQUIRED_FILES = [
  "package.json",
  "package-lock.json",
  "prisma/schema.prisma",
  "prisma.config.ts",
  "src/run-root.ts",
  "src/auth.ts",
  "src/proof-boundary.ts",
  "src/evidence.ts",
  "test/harness-contract.test.ts",
];

const EXPECTED_DEPENDENCIES = {
  "@better-auth/core": "1.7.1",
  "@better-auth/prisma-adapter": "1.7.1",
  "@prisma/adapter-pg": "7.8.0",
  "@prisma/client": "7.8.0",
  "better-auth": "1.7.1",
  "pg": "8.16.3",
};

const EXPECTED_DEV_DEPENDENCIES = {
  prisma: "7.8.0",
  tsx: "4.20.6",
  typescript: "5.9.2",
};

const FORBIDDEN = [
  /postgresql:\/\//i,
  /postgres:\/\//i,
  /DATABASE_URL=/,
  /TEST_DATABASE_URL=/,
  /Set-Cookie:/i,
  /token=/i,
  /password=/i,
  /\/Users\//,
];

async function readHarness(relativePath) {
  return readFile(path.join(HARNESS_ROOT, relativePath), "utf8");
}

test("the deterministic proof harness has the complete pinned artifact map", async () => {
  const sources = new Map();
  for (const relativePath of REQUIRED_FILES) {
    sources.set(relativePath, await readHarness(relativePath));
  }

  const manifest = JSON.parse(sources.get("package.json"));
  assert.equal(manifest.private, true);
  assert.equal(manifest.type, "module");
  assert.deepEqual(manifest.dependencies, EXPECTED_DEPENDENCIES);
  assert.deepEqual(manifest.devDependencies, EXPECTED_DEV_DEPENDENCIES);

  const lockfile = JSON.parse(sources.get("package-lock.json"));
  assert.equal(lockfile.lockfileVersion, 3);
  assert.deepEqual(lockfile.packages[""].dependencies, EXPECTED_DEPENDENCIES);
  assert.deepEqual(lockfile.packages[""].devDependencies, EXPECTED_DEV_DEPENDENCIES);

  const prismaConfig = sources.get("prisma.config.ts");
  assert.doesNotMatch(prismaConfig, /dotenv/);
  assert.doesNotMatch(prismaConfig, /process\.env\.(?:DATABASE_URL|TEST_DATABASE_URL)/);
  assert.doesNotMatch(prismaConfig, /(?:\.\.\/){2,}/);

  for (const [relativePath, source] of sources) {
    for (const pattern of FORBIDDEN) {
      assert.doesNotMatch(source, pattern, `${relativePath} contains forbidden ${pattern}`);
    }
  }

  for (const relativePath of [
    "prisma.config.ts",
    "src/auth.ts",
    "src/proof-boundary.ts",
  ]) {
    assert.match(
      sources.get(relativePath),
      /readRunIdentity\(/,
      `${relativePath} must fail closed through readRunIdentity()`,
    );
  }
});
