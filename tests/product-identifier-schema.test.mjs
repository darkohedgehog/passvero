import assert from "node:assert/strict";
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
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("_add_product_identifier"))
    .map((entry) => entry.name);

  assert.equal(directories.length, 1, "Expected one add_product_identifier migration");
  return readFile(new URL(`${directories[0]}/migration.sql`, migrationsPath), "utf8");
}

async function readCnFoundationMigration() {
  const entries = await readdir(migrationsPath, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("_add_cn_product_identifier_schema_foundation"))
    .map((entry) => entry.name);

  assert.equal(directories.length, 1, "Expected one CN ProductIdentifier schema foundation migration");
  return readFile(new URL(`${directories[0]}/migration.sql`, migrationsPath), "utf8");
}

test("Phase 2B.2 retains ProductIdentifier and ProductIdentifierType", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const modelNames = [...schema.matchAll(/^model (\w+) \{/gm)].map((match) => match[1]);
  const enumNames = [...schema.matchAll(/^enum (\w+) \{/gm)].map((match) => match[1]);

  assert.deepEqual(modelNames, [
    "User",
    "Organization",
    "Membership",
    "Invitation",
    "Product",
    "ProductVersion",
    "ProductTranslation",
    "ProductIdentifier",
    "ProductMaterial",
    "Document",
    "ProductDocument",
    "ProductImage",
    "Passport",
    "QRCode",
    "ScanEvent",
    "AuditLog",
    "Plan",
    "Subscription",
    "Notification",
    "IntegrationMapping",
    "BackgroundJob",
    "AuthProviderUser",
    "AuthProviderSession",
    "AuthProviderAccount",
    "AuthProviderVerification",
    "AuthIdentity",
    "AccountActivationIntent",
    "AuthAuditEvent",
    "AuthSessionSelection",
    "AuthAbuseBucket",
  ]);
  assert.deepEqual(enumNames, [
    "OrganizationStatus",
    "MembershipRole",
    "MembershipStatus",
    "InvitationStatus",
    "ProductLifecycleStatus",
    "ProductVersionStatus",
    "ProductIdentifierType",
    "DocumentStatus",
    "PassportStatus",
    "QRCodeStatus",
    "ScanDeviceType",
    "ScanReferrerType",
    "PlanStatus",
    "SubscriptionStatus",
    "BillingProvider",
    "NotificationType",
    "NotificationStatus",
    "IntegrationMappingStatus",
    "BackgroundJobScope",
    "BackgroundJobStatus",
    "AuthIdentityProvider",
    "AccountActivationStatus",
    "AuthAbuseDimension",
    "AuthAbuseEndpoint",
  ]);
});

test("ProductIdentifierType contains exactly the approved values", async () => {
  const schema = await readFile(schemaPath, "utf8");

  assert.match(
    block(schema, "enum", "ProductIdentifierType"),
    /^\s*GTIN\s+EAN\s+UPC\s+MPN\s+SKU\s+CUSTOM\s+CN\s*$/,
  );
});

test("ProductIdentifier contains exactly the approved fields and nullability", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const identifier = block(schema, "model", "ProductIdentifier");

  assert.deepEqual(fieldNames(identifier), [
    "id",
    "productVersionId",
    "type",
    "value",
    "issuingAuthority",
    "notes",
    "nomenclatureYear",
    "createdAt",
    "updatedAt",
    "productVersion",
  ]);
  assert.match(identifier, /id\s+String\s+@id\s+@default\(uuid\(\)\)\s+@db\.Uuid/);
  assert.match(identifier, /productVersionId\s+String\s+@db\.Uuid/);
  assert.match(identifier, /type\s+ProductIdentifierType(?:\s|$)/);
  assert.match(identifier, /value\s+String(?:\s|$)/);
  assert.match(identifier, /issuingAuthority\s+String\?\s*$/m);
  assert.match(identifier, /notes\s+String\?\s*$/m);
  assert.match(identifier, /nomenclatureYear\s+Int\?\s*$/m);
  assert.match(identifier, /createdAt\s+DateTime\s+@default\(now\(\)\)/);
  assert.match(identifier, /updatedAt\s+DateTime\s+@updatedAt/);
});

test("ProductIdentifier belongs only to ProductVersion with cascade actions", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const version = block(schema, "model", "ProductVersion");
  const identifier = block(schema, "model", "ProductIdentifier");

  assert.match(
    version,
    /identifiers\s+ProductIdentifier\[\]\s+@relation\("ProductVersionIdentifiers"\)/,
  );
  assert.match(
    identifier,
    /productVersion\s+ProductVersion\s+@relation\("ProductVersionIdentifiers", fields: \[productVersionId\], references: \[id\], onDelete: Cascade, onUpdate: Cascade\)/,
  );
  assert.doesNotMatch(identifier, /^\s*(organization|organizationId)\b/m);
});

test("ProductIdentifier enforces version-scoped type and value uniqueness", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const identifier = block(schema, "model", "ProductIdentifier");

  assert.match(identifier, /@@unique\(\[productVersionId, type, value\]\)/);
  assert.match(identifier, /@@index\(\[productVersionId\]\)/);
  assert.doesNotMatch(identifier, /^\s*value\s+String\s+@unique\b/m);
  assert.doesNotMatch(identifier, /@@index\(\[(?:value|type)\]\)/);
});

test("ProductIdentifier excludes unapproved fields and database validation rules", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const identifier = block(schema, "model", "ProductIdentifier");
  const forbiddenFields = [
    "normalizedValue",
    "label",
    "issuer",
    "scheme",
    "isPrimary",
    "sortOrder",
    "verificationStatus",
    "checksum",
    "organizationId",
  ];

  for (const field of forbiddenFields) {
    assert.doesNotMatch(identifier, new RegExp(`^\\s*${field}\\b`, "m"));
  }
});

test("ProductIdentifier migration is additive and isolated", async () => {
  const migrationSql = await readPhaseMigration();
  const migrationLock = await readFile(new URL("migration_lock.toml", migrationsPath), "utf8");

  assert.match(migrationLock, /provider = "postgresql"/);
  assert.match(
    migrationSql,
    /CREATE TYPE "ProductIdentifierType" AS ENUM \('GTIN', 'EAN', 'UPC', 'MPN', 'SKU', 'CUSTOM'\)/,
  );
  assert.match(migrationSql, /CREATE TABLE "ProductIdentifier"/);
  assert.match(
    migrationSql,
    /CREATE INDEX "ProductIdentifier_productVersionId_idx" ON "ProductIdentifier"\("productVersionId"\)/,
  );
  assert.match(
    migrationSql,
    /CREATE UNIQUE INDEX "ProductIdentifier_productVersionId_type_value_key" ON "ProductIdentifier"\("productVersionId", "type", "value"\)/,
  );
  assert.match(
    migrationSql,
    /ALTER TABLE "ProductIdentifier" ADD CONSTRAINT "ProductIdentifier_productVersionId_fkey" FOREIGN KEY \("productVersionId"\) REFERENCES "ProductVersion"\("id"\) ON DELETE CASCADE ON UPDATE CASCADE/,
  );

  assert.deepEqual(
    [...migrationSql.matchAll(/CREATE TYPE "(\w+)"/g)].map((match) => match[1]),
    ["ProductIdentifierType"],
  );
  assert.deepEqual(
    [...migrationSql.matchAll(/CREATE TABLE "(\w+)"/g)].map((match) => match[1]),
    ["ProductIdentifier"],
  );
  assert.doesNotMatch(migrationSql, /\b(ALTER TYPE|DROP|TRUNCATE|INSERT INTO|UPDATE .+ SET|DELETE FROM)\b/);
  assert.doesNotMatch(
    migrationSql,
    /ALTER TABLE "(User|Organization|Membership|Invitation|Product|ProductVersion|ProductTranslation|Passport)"/,
  );
});

test("CN schema foundation migration adds only the approved enum value and nullable context column", async () => {
  const migrationSql = await readCnFoundationMigration();

  assert.match(migrationSql, /ALTER TYPE "ProductIdentifierType" ADD VALUE 'CN'/);
  assert.match(
    migrationSql,
    /ALTER TABLE "ProductIdentifier" ADD COLUMN "nomenclatureYear" INTEGER/,
  );
  assert.doesNotMatch(migrationSql, /"nomenclatureYear" INTEGER NOT NULL/);
  assert.doesNotMatch(
    migrationSql,
    /\b(DROP|TRUNCATE|INSERT INTO|UPDATE\s+"ProductIdentifier"|DELETE FROM|CREATE TABLE|CREATE TYPE|CREATE FUNCTION|CREATE TRIGGER)\b/,
  );
});

test("CN schema foundation migration enforces year context only for CN rows", async () => {
  const migrationSql = await readCnFoundationMigration();

  assert.match(
    migrationSql,
    /CONSTRAINT "ck_product_identifier_cn_nomenclature_year"\s+CHECK \(\s*\(\s*"type" = 'CN'::"ProductIdentifierType"\s+AND "nomenclatureYear" IS NOT NULL\s*\)\s+OR \(\s*"type" <> 'CN'::"ProductIdentifierType"\s+AND "nomenclatureYear" IS NULL\s*\)\s*\)/,
  );
});

test("CN schema foundation migration enforces one CN row without restricting other identifier types", async () => {
  const migrationSql = await readCnFoundationMigration();
  const schema = await readFile(schemaPath, "utf8");
  const identifier = block(schema, "model", "ProductIdentifier");

  assert.match(
    migrationSql,
    /CREATE UNIQUE INDEX "ux_product_identifier_one_cn_per_version"\s+ON "ProductIdentifier"\("productVersionId"\)\s+WHERE "type" = 'CN'::"ProductIdentifierType"/,
  );
  assert.doesNotMatch(migrationSql, /UNIQUE\s*\(\s*"productVersionId"\s*,\s*"type"\s*\)/);
  assert.match(identifier, /@@unique\(\[productVersionId, type, value\]\)/);
});

test("CN schema foundation introduces no TARIC or generic classification schema", async () => {
  const migrationSql = await readCnFoundationMigration();
  const schema = await readFile(schemaPath, "utf8");

  assert.doesNotMatch(`${schema}\n${migrationSql}`, /\bTARIC\b/);
  assert.doesNotMatch(schema, /^model ProductClassification\b/m);
  assert.doesNotMatch(
    block(schema, "model", "ProductIdentifier"),
    /^\s*(validFrom|validTo|normalizedValue|scheme|sortOrder|verificationStatus|externalLookupMetadata)\b/m,
  );
});
