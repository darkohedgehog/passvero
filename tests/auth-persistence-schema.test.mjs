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

test("canonical schema isolates the exact four native provider models", async () => {
  const schema = await readFile(schemaPath, "utf8");

  assert.deepEqual(fieldNames(block(schema, "model", "AuthProviderUser")), [
    "id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt",
    "authprovidersessions", "authprovideraccounts",
  ]);
  assert.deepEqual(fieldNames(block(schema, "model", "AuthProviderSession")), [
    "id", "expiresAt", "token", "createdAt", "updatedAt", "ipAddress",
    "userAgent", "userId", "authprovideruser",
  ]);
  assert.deepEqual(fieldNames(block(schema, "model", "AuthProviderAccount")), [
    "id", "issuer", "accountId", "providerId", "userId", "authprovideruser",
    "accessToken", "refreshToken", "idToken", "accessTokenExpiresAt",
    "refreshTokenExpiresAt", "scope", "password", "createdAt", "updatedAt",
  ]);
  assert.deepEqual(fieldNames(block(schema, "model", "AuthProviderVerification")), [
    "id", "identifier", "value", "expiresAt", "createdAt", "updatedAt",
  ]);
  for (const modelName of [
    "AuthProviderUser", "AuthProviderSession", "AuthProviderAccount",
    "AuthProviderVerification",
  ]) {
    assert.match(block(schema, "model", modelName), new RegExp(`@@map\\("${modelName}"\\)`));
  }
  assert.doesNotMatch(
    block(schema, "model", "AuthProviderSession"),
    /authenticatedAt|lastRefreshAt|selectedOrganizationId|organization|role|permission/,
  );
});

test("AuthIdentity is provider-neutral, unique by subject, and explicitly revocable", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const identity = block(schema, "model", "AuthIdentity");
  const user = block(schema, "model", "User");

  assert.match(block(schema, "enum", "AuthIdentityProvider"), /^\s*BETTER_AUTH\s*$/);
  assert.deepEqual(fieldNames(identity).filter((field) => field !== "auditEvents"), [
    "id", "userId", "provider", "providerSubject", "createdAt", "revokedAt",
    "user",
  ]);
  assert.match(identity, /@@unique\(\[provider, providerSubject\]\)/);
  assert.match(identity, /@@index\(\[userId\]\)/);
  assert.match(
    identity,
    /user\s+User\s+@relation\("UserAuthIdentities", fields: \[userId\], references: \[id\], onDelete: Restrict, onUpdate: Cascade\)/,
  );
  assert.match(user, /authIdentities\s+AuthIdentity\[\]\s+@relation\("UserAuthIdentities"\)/);
  assert.doesNotMatch(identity, /email|organization|membership|role|permission|providerUser/);
  assert.doesNotMatch(identity, /updatedAt/);
});

test("AccountActivationIntent stores only controlled activation and reconciliation state", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const activation = block(schema, "model", "AccountActivationIntent");
  const user = block(schema, "model", "User");

  assert.match(
    block(schema, "enum", "AccountActivationStatus"),
    /^\s*ISSUED\s+IN_PROGRESS\s+AUTH_ACCOUNT_CREATED\s+EMAIL_VERIFIED\s+BOUND\s+EXPIRED\s+REVOKED\s+CONFLICT\s*$/,
  );
  assert.deepEqual(fieldNames(activation), [
    "id", "userId", "provider", "status", "tokenDigest", "intendedEmailDigest",
    "providerSubject", "claimId", "claimedAt", "claimExpiresAt", "expiresAt",
    "authAccountCreatedAt", "emailVerifiedAt", "boundAt", "expiredAt",
    "revokedAt", "conflictAt", "createdAt", "updatedAt", "user",
  ]);
  assert.match(activation, /tokenDigest\s+String\s+@unique\s+@db\.VarChar\(43\)/);
  assert.match(activation, /intendedEmailDigest\s+String\s+@db\.VarChar\(43\)/);
  assert.match(activation, /@@unique\(\[provider, providerSubject\]\)/);
  assert.match(activation, /@@index\(\[userId\]\)/);
  assert.match(activation, /@@index\(\[status, expiresAt\]\)/);
  assert.match(activation, /@@index\(\[claimExpiresAt\]\)/);
  assert.match(user, /accountActivationIntents\s+AccountActivationIntent\[\]\s+@relation\("UserAccountActivationIntents"\)/);
  assert.doesNotMatch(activation, /password|verificationToken|resetToken|sessionToken|organizationId/);
});

test("AuthAuditEvent is minimal, append-only, and independent of organization context", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const event = block(schema, "model", "AuthAuditEvent");
  const user = block(schema, "model", "User");
  const identity = block(schema, "model", "AuthIdentity");

  assert.deepEqual(fieldNames(event), [
    "id", "userId", "authIdentityId", "action", "summary", "metadata",
    "correlationId", "occurredAt", "createdAt", "user", "authIdentity",
  ]);
  assert.match(user, /authAuditEvents\s+AuthAuditEvent\[\]\s+@relation\("UserAuthAuditEvents"\)/);
  assert.match(identity, /auditEvents\s+AuthAuditEvent\[\]\s+@relation\("AuthIdentityAuditEvents"\)/);
  assert.match(event, /@@index\(\[userId, occurredAt\]\)/);
  assert.match(event, /@@index\(\[authIdentityId, occurredAt\]\)/);
  assert.match(event, /@@index\(\[action, occurredAt\]\)/);
  assert.match(event, /@@index\(\[correlationId\]\)/);
  assert.match(event, /@@index\(\[occurredAt\]\)/);
  assert.doesNotMatch(event, /updatedAt|organizationId|providerSubject|email|token|password|ipAddress|userAgent/);
});

test("AuthSessionSelection is provider-neutral selection only", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const selection = block(schema, "model", "AuthSessionSelection");
  const organization = block(schema, "model", "Organization");

  assert.deepEqual(fieldNames(selection), [
    "id", "provider", "providerSessionId", "selectedOrganizationId",
    "createdAt", "updatedAt", "selectedOrganization",
  ]);
  assert.match(selection, /@@unique\(\[provider, providerSessionId\]\)/);
  assert.match(selection, /@@index\(\[selectedOrganizationId\]\)/);
  assert.match(
    selection,
    /selectedOrganization\s+Organization\s+@relation\("OrganizationAuthSessionSelections", fields: \[selectedOrganizationId\], references: \[id\], onDelete: Cascade, onUpdate: Cascade\)/,
  );
  assert.match(organization, /authSessionSelections\s+AuthSessionSelection\[\]\s+@relation\("OrganizationAuthSessionSelections"\)/);
  assert.doesNotMatch(selection, /userId|membership|role|permission|status|entitlement|billing|token|expiresAt/);
});

test("AuthAbuseBucket stores only keyed progressive counters", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const bucket = block(schema, "model", "AuthAbuseBucket");

  assert.match(
    block(schema, "enum", "AuthAbuseDimension"),
    /^\s*TRUSTED_NETWORK\s+ACCOUNT_IDENTIFIER\s+ACCOUNT_AND_TRUSTED_NETWORK\s+GLOBAL_ENDPOINT\s*$/,
  );
  assert.match(
    block(schema, "enum", "AuthAbuseEndpoint"),
    /^\s*SIGN_IN\s+ACTIVATE_ACCOUNT\s+EMAIL_VERIFICATION_REQUEST\s+EMAIL_VERIFICATION_CONSUME\s+PASSWORD_RESET_REQUEST\s+PASSWORD_RESET_CONSUME\s+PASSWORD_CHANGE\s*$/,
  );
  assert.deepEqual(fieldNames(bucket), [
    "id", "dimension", "endpoint", "keyDigest", "attemptCount", "failureCount",
    "backoffLevel", "windowStartedAt", "lastAttemptAt", "lastFailureAt",
    "blockedUntil", "expiresAt", "createdAt", "updatedAt",
  ]);
  assert.match(bucket, /keyDigest\s+String\s+@db\.VarChar\(43\)/);
  assert.match(bucket, /@@unique\(\[dimension, endpoint, keyDigest\]\)/);
  assert.match(bucket, /@@index\(\[endpoint, dimension, blockedUntil\]\)/);
  assert.match(bucket, /@@index\(\[expiresAt\]\)/);
  assert.doesNotMatch(bucket, /email|ipAddress|network|userId|organizationId|providerSubject|token|password/);
});
