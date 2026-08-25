import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const runtimePath = "src/infrastructure/auth/better-auth-server.ts";
const databaseConfigPath = "src/infrastructure/auth/auth-database-config.ts";
const serverConfigPath = "src/infrastructure/auth/better-auth-server-config.ts";
const sessionReaderPath = "src/infrastructure/auth/better-auth-session-reader.ts";
const identityReaderPath = "src/infrastructure/auth/prisma-auth-identity-reader.ts";
const currentUserResolutionPath =
  "src/infrastructure/auth/provider-neutral-session-resolution.ts";
const applicationResolutionPath = "src/application/auth/resolve-current-user.ts";
const passwordPolicyPath = "src/application/auth/password-policy.ts";
const passwordCorePath = "src/infrastructure/auth/better-auth-password-core.ts";
const passwordBoundaryPath = "src/infrastructure/auth/better-auth-password.ts";

const listTypeScriptFiles = (directory) => readdirSync(
  new URL(`../${directory}`, import.meta.url),
  { recursive: true },
).filter((path) => /\.(ts|tsx)$/.test(path)).map((path) => `${directory}/${path}`);

test("keeps auth environment and Prisma construction inside one server-only boundary", () => {
  const runtimeSource = read(runtimePath);
  const pureConfigSource = `${read(databaseConfigPath)}\n${read(serverConfigPath)}`;

  assert.match(runtimeSource, /^import "server-only";/);
  assert.match(runtimeSource, /process\.env\.AUTH_DATABASE_URL/);
  assert.match(runtimeSource, /process\.env\.BETTER_AUTH_SECRET/);
  assert.match(runtimeSource, /process\.env\.BETTER_AUTH_URL/);
  assert.doesNotMatch(runtimeSource, /process\.env\.(?:DATABASE_URL|TEST_DATABASE_URL)/);
  assert.doesNotMatch(pureConfigSource, /process\.env|server-only/);
  assert.match(runtimeSource, /new Pool\(poolConfig\)/);
  assert.match(runtimeSource, /new PrismaPg\(pool, \{ disposeExternalPool: true \}\)/);
  assert.match(runtimeSource, /new PrismaClient\(\{ adapter \}\)/);
  assert.match(runtimeSource, /prismaAdapter\([^,]+, \{ provider: "postgresql" \}\)/);
});

test("exports the Better Auth server and shutdown only, never the auth Prisma client", () => {
  const runtimeSource = read(runtimePath);
  const exportedFunctions = Array.from(
    runtimeSource.matchAll(/export (?:async )?function\s+(\w+)/g),
    (match) => match[1],
  );

  assert.deepEqual(exportedFunctions, [
    "getBetterAuthServer",
    "getBetterAuthLifecycleProvider",
    "disconnectBetterAuthServer",
  ]);
  assert.doesNotMatch(runtimeSource, /export[^\n]*(?:PrismaClient|Pool|PrismaPg)/);
  assert.doesNotMatch(runtimeSource, /export (?:async )?function\s+get\w*Prisma/i);
});

test("keeps Better Auth and the auth Prisma boundary out of application and domain code", () => {
  const protectedSource = [
    ...listTypeScriptFiles("src/application"),
    ...listTypeScriptFiles("src/domain"),
  ].map(read).join("\n");

  assert.doesNotMatch(
    protectedSource,
    /better-auth|infrastructure\/auth|AuthProvider(?:User|Session|Account|Verification)/,
  );
});

test("adds no auth HTTP route in the foundation slice", () => {
  const applicationRoutes = readdirSync(new URL("../app", import.meta.url), {
    recursive: true,
  }).map(String);

  assert.equal(applicationRoutes.some((path) => /(?:^|\/)api\/auth(?:\/|$)/.test(path)), false);
  assert.equal(applicationRoutes.some((path) => /\[\.\.\..*\]/.test(path)), false);
});

test("keeps provider-session and canonical-identity persistence isolated", () => {
  const providerSource = `${read(runtimePath)}\n${read(sessionReaderPath)}`;
  const businessSource = read(identityReaderPath);
  const applicationSource = read(applicationResolutionPath);
  const compositionSource = read(currentUserResolutionPath);

  assert.match(compositionSource, /^import "server-only";/);
  assert.match(compositionSource, /getBetterAuthServer/);
  assert.match(compositionSource, /getProductionPrismaClient/);
  assert.doesNotMatch(providerSource, /authIdentity\.|\.user\.findUnique/);
  assert.doesNotMatch(
    businessSource,
    /getBetterAuthServer|AuthProvider(?:User|Session|Account|Verification)/,
  );
  assert.doesNotMatch(applicationSource, /better-auth|\btoken\b|\bemail\b/i);
});

test("keeps password policy provider-neutral and credential callbacks server-only", () => {
  const policySource = read(passwordPolicyPath);
  const coreSource = read(passwordCorePath);
  const boundarySource = read(passwordBoundaryPath);
  const runtimeSource = read(runtimePath);
  const serverConfigSource = read(serverConfigPath);
  const credentialSource = `${policySource}\n${coreSource}\n${boundarySource}`;

  assert.doesNotMatch(policySource, /better-auth|infrastructure\/auth|AuthProviderAccount/);
  assert.match(boundarySource, /^import "server-only";/);
  assert.match(runtimeSource, /betterAuthPasswordCallbacks/);
  assert.match(serverConfigSource, /disableSignUp:\s*true/);
  assert.match(serverConfigSource, /minPasswordLength:\s*1/);
  assert.match(serverConfigSource, /maxPasswordLength:\s*256/);
  assert.doesNotMatch(
    credentialSource,
    /AuthProviderAccount|AuthAuditEvent|PrismaClient|\bfetch\s*\(|console\.(?:log|debug|info|warn|error)/,
  );
});
