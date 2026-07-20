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
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("_add_product_translation"))
    .map((entry) => entry.name);

  assert.equal(directories.length, 1, "Expected one add_product_translation migration");
  return readFile(new URL(`${directories[0]}/migration.sql`, migrationsPath), "utf8");
}

test("Phase 2B.1 adds only ProductTranslation and no enum", async () => {
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
    "Passport",
  ]);
  assert.deepEqual(enumNames, [
    "OrganizationStatus",
    "MembershipRole",
    "MembershipStatus",
    "InvitationStatus",
    "ProductLifecycleStatus",
    "ProductVersionStatus",
    "PassportStatus",
  ]);
  assert.doesNotMatch(schema, /^enum ProductTranslationStatus \{/m);
});

test("ProductTranslation contains exactly the approved scalar and relation fields", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const translation = block(schema, "model", "ProductTranslation");

  assert.deepEqual(fieldNames(translation), [
    "id",
    "productVersionId",
    "locale",
    "productName",
    "shortDescription",
    "description",
    "technicalDescription",
    "repairInstructions",
    "sparePartsInformation",
    "recyclingInstructions",
    "disposalInstructions",
    "packagingInformation",
    "safetyInformation",
    "warrantyInformation",
    "publicNotes",
    "createdAt",
    "updatedAt",
    "productVersion",
  ]);
  assert.match(translation, /id\s+String\s+@id\s+@default\(uuid\(\)\)\s+@db\.Uuid/);
  assert.match(translation, /productVersionId\s+String\s+@db\.Uuid/);
  assert.match(translation, /locale\s+String(?:\s|$)/);
  assert.match(translation, /productName\s+String(?:\s|$)/);
  assert.match(translation, /createdAt\s+DateTime\s+@default\(now\(\)\)/);
  assert.match(translation, /updatedAt\s+DateTime\s+@updatedAt/);
});

test("all optional translated content uses nullable String fields", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const translation = block(schema, "model", "ProductTranslation");
  const optionalFields = [
    "shortDescription",
    "description",
    "technicalDescription",
    "repairInstructions",
    "sparePartsInformation",
    "recyclingInstructions",
    "disposalInstructions",
    "packagingInformation",
    "safetyInformation",
    "warrantyInformation",
    "publicNotes",
  ];

  for (const field of optionalFields) {
    assert.match(translation, new RegExp(`^\\s*${field}\\s+String\\?\\s*$`, "m"));
  }
  assert.doesNotMatch(translation, /\bJson\b/);
});

test("ProductTranslation belongs only to ProductVersion with cascade actions", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const version = block(schema, "model", "ProductVersion");
  const translation = block(schema, "model", "ProductTranslation");

  assert.match(
    version,
    /translations\s+ProductTranslation\[\]\s+@relation\("ProductVersionTranslations"\)/,
  );
  assert.match(
    translation,
    /productVersion\s+ProductVersion\s+@relation\("ProductVersionTranslations", fields: \[productVersionId\], references: \[id\], onDelete: Cascade, onUpdate: Cascade\)/,
  );
  assert.doesNotMatch(translation, /^\s*(organization|organizationId)\b/m);
});

test("ProductTranslation enforces locale uniqueness and approved indexes", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const translation = block(schema, "model", "ProductTranslation");

  assert.match(translation, /@@unique\(\[productVersionId, locale\]\)/);
  assert.match(translation, /@@index\(\[productVersionId\]\)/);
  assert.doesNotMatch(translation, /@@index\(\[locale\]\)/);
});

test("ProductTranslation excludes non-translation and future workflow fields", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const translation = block(schema, "model", "ProductTranslation");
  const forbiddenFields = [
    "status",
    "translationStatus",
    "sourceTranslationId",
    "language",
    "lang",
    "localeCode",
    "sku",
    "publicCode",
    "manufacturer",
    "materials",
    "country",
    "identifiers",
    "seoTitle",
    "seoDescription",
    "aiMetadata",
    "translationProvider",
  ];

  for (const field of forbiddenFields) {
    assert.doesNotMatch(translation, new RegExp(`^\\s*${field}\\b`, "m"));
  }
});

test("ProductTranslation migration is additive and isolated", async () => {
  const migrationSql = await readPhaseMigration();
  const migrationLock = await readFile(new URL("migration_lock.toml", migrationsPath), "utf8");

  assert.match(migrationLock, /provider = "postgresql"/);
  assert.match(migrationSql, /CREATE TABLE "ProductTranslation"/);
  assert.match(
    migrationSql,
    /CREATE UNIQUE INDEX "ProductTranslation_productVersionId_locale_key" ON "ProductTranslation"\("productVersionId", "locale"\)/,
  );
  assert.match(
    migrationSql,
    /CREATE INDEX "ProductTranslation_productVersionId_idx" ON "ProductTranslation"\("productVersionId"\)/,
  );
  assert.match(
    migrationSql,
    /ALTER TABLE "ProductTranslation" ADD CONSTRAINT "ProductTranslation_productVersionId_fkey" FOREIGN KEY \("productVersionId"\) REFERENCES "ProductVersion"\("id"\) ON DELETE CASCADE ON UPDATE CASCADE/,
  );

  assert.equal([...migrationSql.matchAll(/CREATE TABLE "(\w+)"/g)].map((match) => match[1]).join(), "ProductTranslation");
  assert.doesNotMatch(migrationSql, /\b(CREATE TYPE|ALTER TYPE|DROP|TRUNCATE|INSERT INTO|DELETE FROM)\b/);
  assert.doesNotMatch(
    migrationSql,
    /ALTER TABLE "(User|Organization|Membership|Invitation|Product|ProductVersion|Passport)"/,
  );
});
