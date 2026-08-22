import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const packagePath = new URL("../package.json", import.meta.url);
const lockPath = new URL("../package-lock.json", import.meta.url);
const schemaPath = new URL("../prisma/schema.prisma", import.meta.url);
const migrationsPath = new URL("../prisma/migrations/", import.meta.url);
const generatedPath = new URL(
  "../docs/superpowers/specs/assets/2026-08-22-better-auth-native-schema/generated-prisma-schema.prisma",
  import.meta.url,
);

function block(source, kind, name) {
  const match = source.match(new RegExp(`${kind} ${name} \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `Missing ${kind} ${name}`);
  return match[1];
}

function fieldNames(model) {
  return model
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("///") && !line.startsWith("@@"))
    .map((line) => line.split(/\s+/, 1)[0]);
}

async function readStageMigration() {
  const entries = await readdir(migrationsPath, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("_add_auth_foundation"))
    .map((entry) => entry.name);
  assert.deepEqual(directories, ["20260822193000_add_auth_foundation"]);
  return readFile(new URL(`${directories[0]}/migration.sql`, migrationsPath), "utf8");
}

test("Stage 13B pins the reviewed Better Auth dependencies exactly", async () => {
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  const lock = JSON.parse(await readFile(lockPath, "utf8"));

  assert.equal(packageJson.dependencies["better-auth"], "1.7.1");
  assert.equal(packageJson.dependencies["@better-auth/prisma-adapter"], "1.7.1");
  assert.equal(lock.packages[""].dependencies["better-auth"], "1.7.1");
  assert.equal(lock.packages[""].dependencies["@better-auth/prisma-adapter"], "1.7.1");
  assert.equal(packageJson.dependencies["@better-auth/core"], undefined);
});

test("fresh provider schema is native and contains no Passvero extensions", async () => {
  const generated = await readFile(generatedPath, "utf8");
  const expectedModels = [
    "AuthProviderUser",
    "AuthProviderSession",
    "AuthProviderAccount",
    "AuthProviderVerification",
  ];

  assert.deepEqual(
    [...generated.matchAll(/^model (\w+) \{/gm)].map((match) => match[1]),
    expectedModels,
  );
  assert.deepEqual(fieldNames(block(generated, "model", "AuthProviderSession")), [
    "id", "expiresAt", "token", "createdAt", "updatedAt", "ipAddress",
    "userAgent", "userId", "authprovideruser",
  ]);
  assert.doesNotMatch(
    generated,
    /authenticatedAt|lastRefreshAt|selectedOrganizationId|AuthCredentialToken|Organization|Membership/,
  );
});
