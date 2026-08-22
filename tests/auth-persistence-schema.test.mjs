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

test("auth migration creates exactly the approved additive objects", async () => {
  const sql = await readStageMigration();
  const expectedEnums = [
    "AccountActivationStatus", "AuthAbuseDimension", "AuthAbuseEndpoint",
    "AuthIdentityProvider",
  ].sort();
  const expectedTables = [
    "AccountActivationIntent", "AuthAbuseBucket", "AuthAuditEvent", "AuthIdentity",
    "AuthProviderAccount", "AuthProviderSession", "AuthProviderUser",
    "AuthProviderVerification", "AuthSessionSelection",
  ].sort();

  assert.deepEqual(
    [...sql.matchAll(/CREATE TYPE "(\w+)"/g)].map((match) => match[1]).sort(),
    expectedEnums,
  );
  assert.deepEqual(
    [...sql.matchAll(/CREATE TABLE "(\w+)"/g)].map((match) => match[1]).sort(),
    expectedTables,
  );
  assert.equal([...sql.matchAll(/FOREIGN KEY/g)].length, 7);
  assert.doesNotMatch(
    sql,
    /\b(DROP|TRUNCATE|INSERT INTO|UPDATE .+ SET|DELETE FROM|CREATE FUNCTION|CREATE TRIGGER|CREATE POLICY|CREATE VIEW|CREATE MATERIALIZED VIEW|PARTITION BY|GRANT|REVOKE)\b/,
  );
  assert.doesNotMatch(sql, /ALTER TABLE "(?:User|Organization|Membership|Invitation|Product|AuditLog)"/);
});

test("auth migration preserves provider ownership and separation", async () => {
  const sql = await readStageMigration();
  const providerSession = sql.match(/CREATE TABLE "AuthProviderSession" \(([\s\S]*?)\n\);/);
  const identity = sql.match(/CREATE TABLE "AuthIdentity" \(([\s\S]*?)\n\);/);

  assert.ok(providerSession);
  assert.ok(identity);
  assert.doesNotMatch(providerSession[1], /authenticatedAt|lastRefreshAt|selectedOrganizationId|organization|role|permission/);
  assert.doesNotMatch(identity[1], /email|organization|membership|role|permission|AuthProviderUser/);
  assert.doesNotMatch(sql, /AuthCredentialToken/);
  assert.doesNotMatch(
    sql,
    /FOREIGN KEY \("providerSubject"\) REFERENCES "AuthProviderUser"/,
  );
});

test("manual auth constraints enforce revocation, activation, abuse, and audit invariants", async () => {
  const sql = await readStageMigration();
  const requiredConstraints = [
    "ck_auth_identity_revocation_order",
    "ck_account_activation_intent_digests",
    "ck_account_activation_intent_expiry",
    "ck_account_activation_intent_claim",
    "ck_account_activation_intent_milestones",
    "ck_account_activation_intent_state",
    "ck_account_activation_intent_terminal_state",
    "ck_account_activation_intent_timestamp_order",
    "ck_auth_abuse_bucket_digest",
    "ck_auth_abuse_bucket_counts",
    "ck_auth_abuse_bucket_timestamp_order",
    "ck_auth_audit_event_action",
    "ck_auth_audit_event_summary",
    "ck_auth_audit_event_correlation",
  ];

  for (const name of requiredConstraints) {
    assert.match(sql, new RegExp(`CONSTRAINT "${name}"`));
  }
  assert.match(
    sql,
    /CREATE UNIQUE INDEX "ux_account_activation_intent_one_active_per_user"[\s\S]*?WHERE "status" IN \('ISSUED', 'IN_PROGRESS', 'AUTH_ACCOUNT_CREATED', 'EMAIL_VERIFIED'\)/,
  );
});

test("all pre-Stage 13B migration sources retain their reviewed hashes", async () => {
  const approvedMigrations = new Map([
    ["20260717191316_init_identity_domain", "347ada303ff4cc2495301b400955e0d89cf743fd1990dd27b9f6bb6889ecf0f6"],
    ["20260720170638_add_product_core_and_passport", "0395328af8ebd574ed7b8ad9d3b532233ea015c5f91dd02040e3ca877cd8442d"],
    ["20260720172426_add_product_translation", "05b0eba12925bba3d7b0ac7b6108a1e1c0057d305c233a7c90d75bcd4118e8fa"],
    ["20260720173610_add_product_identifier", "62be095ca5f0349105281a7ac72009c306a8c72da7cd5bfdb5832c6838dce288"],
    ["20260720175253_add_product_material", "41d4e2cc5857213ca6ccc65ce700b704fa590e375049d1dc317d6376f2b61737"],
    ["20260720182219_add_document_asset", "cb08e7305980f907343f464ba2519e22d2c3b7ba1ed833da88b58e20c6455e3f"],
    ["20260720184244_add_product_document", "777c2d4ccb60599235013e76868673a3b1298fe73b7a8147cb7c758af8288c74"],
    ["20260720190323_add_product_image", "617932a5b88328541ca656b3123e66789772513a0ee67b5ebff97e48735e4525"],
    ["20260721163104_add_qr_code", "2f1174adc82388e34225f29df56863e601c929c7a7ef2bb9749a63ae170c8dae"],
    ["20260721173458_add_scan_event", "89e069a2e5e53c517169da6f598480e511a7253f66b738236aa643cedc9154d0"],
    ["20260721180144_add_audit_log", "187195dc4f664e1e66f30978da4fd39a733b866c6602ba088b78863a992e4685"],
    ["20260721182339_add_plan", "402ebb2d4fd11bf08201b080ae72fe77bd1464c9a86a0aa2f514edfb40c56761"],
    ["20260721190547_add_subscription", "ee40fc679466c1fe484b1f208d07dac6c533ecd32b8a9d84638a066bbcaba440"],
    ["20260722171607_add_notification", "d71c44c01edbf56e905a88cddc223716454b10a396681ee0ce14ef85fc013f5b"],
    ["20260722180124_add_integration_mapping", "368783ae2a1895ca2aeb5f53af1dd6a2f21b29ac22127be001b30b0ea052e4ab"],
    ["20260722184010_add_background_job", "167d74bed2928834bf0dc0ec57923702e51acecd2836c3f1c35ad96b1a3ebeda"],
  ]);

  for (const [directory, expectedHash] of approvedMigrations) {
    const sql = await readFile(new URL(`${directory}/migration.sql`, migrationsPath), "utf8");
    assert.equal(
      createHash("sha256").update(sql).digest("hex"),
      expectedHash,
      `${directory} migration source changed`,
    );
  }
});
