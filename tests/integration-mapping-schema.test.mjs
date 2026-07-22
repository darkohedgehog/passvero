import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const schemaPath = new URL("../prisma/schema.prisma", import.meta.url);
const migrationsPath = new URL("../prisma/migrations/", import.meta.url);

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

async function readPhaseMigration() {
  const entries = await readdir(migrationsPath, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("_add_integration_mapping"))
    .map((entry) => entry.name);

  assert.equal(directories.length, 1, "Expected one add_integration_mapping migration");
  return readFile(new URL(`${directories[0]}/migration.sql`, migrationsPath), "utf8");
}

test("Phase 6B adds exactly IntegrationMapping and its approved status enum", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const modelNames = [...schema.matchAll(/^model (\w+) \{/gm)].map((match) => match[1]);
  const enumNames = [...schema.matchAll(/^enum (\w+) \{/gm)].map((match) => match[1]);

  assert.deepEqual(modelNames.slice(-1), ["IntegrationMapping"]);
  assert.deepEqual(enumNames.slice(-1), ["IntegrationMappingStatus"]);
  assert.match(
    block(schema, "enum", "IntegrationMappingStatus"),
    /^\s*ACTIVE\s+DISABLED\s+ERROR\s+ARCHIVED\s*$/,
  );
  assert.doesNotMatch(schema, /^enum Integration(?:Provider|EntityType|SyncStatus)\b/m);
});

test("IntegrationMapping contains exactly the approved fields, types, and defaults", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const mapping = block(schema, "model", "IntegrationMapping");

  assert.deepEqual(fieldNames(mapping), [
    "id", "organizationId", "provider", "externalAccountId", "externalResourceType",
    "externalResourceId", "entityType", "entityId", "status", "lastSyncedAt",
    "lastErrorAt", "lastErrorCode", "metadata", "archivedAt", "createdAt", "updatedAt",
    "organization",
  ]);
  assert.match(mapping, /id\s+String\s+@id\s+@default\(uuid\(\)\)\s+@db\.Uuid/);
  assert.match(mapping, /^\s*organizationId\s+String\s+@db\.Uuid\s*$/m);
  for (const field of ["provider", "externalResourceType", "externalResourceId", "entityType", "entityId"]) {
    assert.match(mapping, new RegExp(`^\\s*${field}\\s+String\\s*$`, "m"));
  }
  assert.match(mapping, /^\s*externalAccountId\s+String\?\s*$/m);
  assert.match(mapping, /status\s+IntegrationMappingStatus\s+@default\(ACTIVE\)/);
  for (const field of ["lastSyncedAt", "lastErrorAt", "archivedAt"]) {
    assert.match(mapping, new RegExp(`^\\s*${field}\\s+DateTime\\?\\s*$`, "m"));
  }
  assert.match(mapping, /^\s*lastErrorCode\s+String\?\s*$/m);
  assert.match(mapping, /^\s*metadata\s+Json\?\s*$/m);
  assert.doesNotMatch(mapping, /^\s*metadata\s+Json\?\s+@default/m);
  assert.match(mapping, /createdAt\s+DateTime\s+@default\(now\(\)\)/);
  assert.match(mapping, /updatedAt\s+DateTime\s+@updatedAt/);
});

test("IntegrationMapping is organization-owned and has no other relations", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const mapping = block(schema, "model", "IntegrationMapping");
  const organization = block(schema, "model", "Organization");

  assert.match(
    mapping,
    /organization\s+Organization\s+@relation\("OrganizationIntegrationMappings", fields: \[organizationId\], references: \[id\], onDelete: Restrict, onUpdate: Cascade\)/,
  );
  assert.match(
    organization,
    /integrationMappings\s+IntegrationMapping\[\]\s+@relation\("OrganizationIntegrationMappings"\)/,
  );
  assert.equal([...mapping.matchAll(/@relation\(/g)].length, 1);
  assert.doesNotMatch(mapping, /^\s*(user|membership|product|productVersion|passport|document|qrCode|subscription|notification|auditLog|scanEvent|backgroundJob)\b/m);
});

test("IntegrationMapping excludes credentials, provider configuration, jobs, and obsolete fields", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const mapping = block(schema, "model", "IntegrationMapping");
  const forbiddenFields = [
    "externalId", "externalParentId", "syncStatus", "accessToken", "refreshToken",
    "apiKey", "clientSecret", "providerSecret", "providerConfig", "credentials",
    "webhookSecret", "jobId", "retryCount", "failureReason", "deletedAt",
  ];

  for (const field of forbiddenFields) {
    assert.doesNotMatch(mapping, new RegExp(`^\\s*${field}\\b`, "m"));
  }
  assert.doesNotMatch(schema, /^model (?:BackgroundJob|IntegrationCredential|IntegrationProviderConfiguration)\b/m);
});

test("IntegrationMapping has exactly the approved uniqueness and indexes", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const mapping = block(schema, "model", "IntegrationMapping");
  const uniqueFields = [
    "organizationId, provider, externalAccountId, externalResourceType, externalResourceId",
    "organizationId, provider, externalAccountId, externalResourceType, entityType, entityId",
  ];
  const indexes = [
    "organizationId, provider, status",
    "organizationId, entityType, entityId",
    "organizationId, provider, externalResourceType",
    "lastSyncedAt", "lastErrorAt", "archivedAt",
  ];

  for (const fields of uniqueFields) assert.match(mapping, new RegExp(`@@unique\\(\\[${fields}\\](?:, map: "[^"]+")?\\)`));
  for (const fields of indexes) assert.match(mapping, new RegExp(`@@index\\(\\[${fields}\\]\\)`));
  assert.equal([...mapping.matchAll(/@@unique\(/g)].length, 2);
  assert.equal([...mapping.matchAll(/@@index\(/g)].length, 6);
  assert.doesNotMatch(mapping, /type:\s*Gin|ops:\s*Json/);
});

test("IntegrationMapping migration creates only approved objects", async () => {
  const migrationSql = await readPhaseMigration();

  assert.deepEqual(
    [...migrationSql.matchAll(/CREATE TYPE "(\w+)"/g)].map((match) => match[1]),
    ["IntegrationMappingStatus"],
  );
  assert.match(migrationSql, /CREATE TYPE "IntegrationMappingStatus" AS ENUM \('ACTIVE', 'DISABLED', 'ERROR', 'ARCHIVED'\)/);
  assert.deepEqual([...migrationSql.matchAll(/CREATE TABLE "(\w+)"/g)].map((match) => match[1]), ["IntegrationMapping"]);
  assert.equal([...migrationSql.matchAll(/CREATE UNIQUE INDEX /g)].length, 4);
  assert.equal([...migrationSql.matchAll(/CREATE INDEX /g)].length, 6);
  assert.equal([...migrationSql.matchAll(/FOREIGN KEY/g)].length, 1);
  assert.match(
    migrationSql,
    /ALTER TABLE "IntegrationMapping" ADD CONSTRAINT "IntegrationMapping_organizationId_fkey" FOREIGN KEY \("organizationId"\) REFERENCES "Organization"\("id"\) ON DELETE RESTRICT ON UPDATE CASCADE/,
  );
  assert.equal([...migrationSql.matchAll(/\bCONSTRAINT "ck_integration_mapping_/g)].length, 10);
  assert.doesNotMatch(migrationSql, /\b(DROP|TRUNCATE|INSERT INTO|UPDATE .+ SET|DELETE FROM|CREATE FUNCTION|CREATE TRIGGER|CREATE POLICY|CREATE VIEW|CREATE MATERIALIZED VIEW|PARTITION BY)\b/);
  assert.doesNotMatch(migrationSql, /ROW LEVEL SECURITY|NotificationDelivery|NotificationPreference|BackgroundJob/);
  assert.doesNotMatch(migrationSql, /ALTER TABLE "(?!IntegrationMapping")/);
});

test("IntegrationMapping migration enforces NULL-account uniqueness", async () => {
  const migrationSql = await readPhaseMigration();

  assert.match(migrationSql, /CREATE UNIQUE INDEX "ux_integration_mapping_external_resource_without_account"[\s\S]*?WHERE "externalAccountId" IS NULL/);
  assert.match(migrationSql, /CREATE UNIQUE INDEX "ux_integration_mapping_internal_entity_without_account"[\s\S]*?WHERE "externalAccountId" IS NULL/);
  assert.match(migrationSql, /"organizationId", "provider", "externalResourceType", "externalResourceId"/);
  assert.match(migrationSql, /"organizationId", "provider", "externalResourceType", "entityType", "entityId"/);
});

test("IntegrationMapping migration enforces all approved string formats", async () => {
  const migrationSql = await readPhaseMigration();
  const checks = [
    "provider_format", "external_account_id_format", "external_resource_type_format",
    "external_resource_id_format", "entity_type_format", "entity_id_format",
    "archived_at_consistency", "error_consistency", "last_error_code_format", "timestamp_order",
  ];

  for (const name of checks) assert.match(migrationSql, new RegExp(`CONSTRAINT "ck_integration_mapping_${name}"\\s+CHECK`));
  assert.match(migrationSql, /char_length\("provider"\) BETWEEN 2 AND 96/);
  assert.match(migrationSql, /char_length\("externalAccountId"\) BETWEEN 1 AND 255/);
  assert.match(migrationSql, /char_length\("externalResourceType"\) BETWEEN 2 AND 96/);
  assert.match(migrationSql, /char_length\("externalResourceId"\) BETWEEN 1 AND 512/);
  assert.match(migrationSql, /char_length\("entityType"\) BETWEEN 2 AND 96/);
  assert.match(migrationSql, /char_length\("entityId"\) BETWEEN 1 AND 255/);
  assert.match(migrationSql, /char_length\("lastErrorCode"\) BETWEEN 2 AND 128/);
  for (const field of ["provider", "externalResourceType", "entityType", "lastErrorCode"]) {
    assert.match(migrationSql, new RegExp(`"${field}" ~ '\\\^\\[A-Z\\]\\[A-Z0-9_\\]\\*\\$'`));
  }
});

test("IntegrationMapping migration enforces lifecycle and timestamp consistency", async () => {
  const migrationSql = await readPhaseMigration();

  assert.match(migrationSql, /"status" = 'ARCHIVED'::"IntegrationMappingStatus"[\s\S]*?"archivedAt" IS NOT NULL/);
  for (const status of ["ACTIVE", "DISABLED", "ERROR"]) {
    assert.match(migrationSql, new RegExp(`"status" = '${status}'::"IntegrationMappingStatus"[\\s\\S]*?"archivedAt" IS NULL`));
  }
  assert.match(migrationSql, /"status" <> 'ERROR'::"IntegrationMappingStatus" OR "lastErrorAt" IS NOT NULL/);
  for (const field of ["lastSyncedAt", "lastErrorAt", "archivedAt"]) {
    assert.match(migrationSql, new RegExp(`"${field}" IS NULL OR "${field}" >= "createdAt"`));
  }
});

test("all previous migration sources retain their approved hashes", async () => {
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
  ]);

  for (const [directory, approvedHash] of approvedMigrations) {
    const migrationSql = await readFile(new URL(`${directory}/migration.sql`, migrationsPath), "utf8");
    assert.equal(
      createHash("sha256").update(migrationSql).digest("hex"),
      approvedHash,
      `${directory} migration source changed`,
    );
  }
});
