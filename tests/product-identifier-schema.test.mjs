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
  ]);
});

test("ProductIdentifierType contains exactly the approved values", async () => {
  const schema = await readFile(schemaPath, "utf8");

  assert.match(
    block(schema, "enum", "ProductIdentifierType"),
    /^\s*GTIN\s+EAN\s+UPC\s+MPN\s+SKU\s+CUSTOM\s*$/,
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
