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

async function readPhaseMigration() {
  const entries = await readdir(migrationsPath, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("_add_product_core_and_passport"))
    .map((entry) => entry.name);

  assert.equal(directories.length, 1, "Expected one add_product_core_and_passport migration");
  return readFile(new URL(`${directories[0]}/migration.sql`, migrationsPath), "utf8");
}

test("Phase 2A retains the approved models and enums", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const modelNames = [...schema.matchAll(/^model (\w+) \{/gm)].map((match) => match[1]);
  const enumNames = [...schema.matchAll(/^enum (\w+) \{/gm)].map((match) => match[1]);
  const phaseModelNames = [
    "User",
    "Organization",
    "Membership",
    "Invitation",
    "Product",
    "ProductVersion",
    "Passport",
  ];

  assert.deepEqual(modelNames.filter((name) => phaseModelNames.includes(name)), phaseModelNames);
  assert.deepEqual(enumNames, [
    "OrganizationStatus",
    "MembershipRole",
    "MembershipStatus",
    "InvitationStatus",
    "ProductLifecycleStatus",
    "ProductVersionStatus",
    "PassportStatus",
  ]);

  assert.match(block(schema, "enum", "ProductLifecycleStatus"), /^\s*ACTIVE\s+ARCHIVED\s*$/);
  assert.match(
    block(schema, "enum", "ProductVersionStatus"),
    /^\s*DRAFT\s+READY_FOR_REVIEW\s+PUBLISHED\s+SUPERSEDED\s+DISCARDED\s*$/,
  );
  assert.match(block(schema, "enum", "PassportStatus"), /^\s*ACTIVE\s+WITHDRAWN\s+ARCHIVED\s*$/);
});

test("Product contains only stable identity fields and approved constraints", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const product = block(schema, "model", "Product");

  assert.match(product, /id\s+String\s+@id\s+@default\(uuid\(\)\)\s+@db\.Uuid/);
  assert.match(product, /publicCode\s+String\s+@unique/);
  assert.match(product, /lifecycleStatus\s+ProductLifecycleStatus\s+@default\(ACTIVE\)/);
  assert.match(product, /@@unique\(\[organizationId, normalizedSku\]\)/);
  assert.match(product, /@@index\(\[organizationId, lifecycleStatus\]\)/);
  assert.match(product, /@@index\(\[organizationId, updatedAt\]\)/);

  for (const forbidden of [
    "description",
    "manufacturer",
    "countryOfOrigin",
    "modelNumber",
    "materials",
    "translations",
  ]) {
    assert.doesNotMatch(product, new RegExp(`^\\s*${forbidden}\\b`, "m"));
  }
  assert.doesNotMatch(product, /^\s*(isPublished|published|passportStatus)\b/m);
});

test("Product and ProductVersion relations are explicit and historically safe", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const product = block(schema, "model", "Product");
  const version = block(schema, "model", "ProductVersion");

  assert.match(product, /versions\s+ProductVersion\[\]\s+@relation\("ProductVersions"\)/);
  assert.match(
    product,
    /currentDraftVersion\s+ProductVersion\?\s+@relation\("CurrentDraftVersion", fields: \[currentDraftVersionId\], references: \[id\], onDelete: SetNull, onUpdate: Cascade\)/,
  );
  assert.match(
    product,
    /currentPublishedVersion\s+ProductVersion\?\s+@relation\("CurrentPublishedVersion", fields: \[currentPublishedVersionId\], references: \[id\], onDelete: SetNull, onUpdate: Cascade\)/,
  );
  assert.match(product, /currentDraftVersionId\s+String\?\s+@unique\s+@db\.Uuid/);
  assert.match(product, /currentPublishedVersionId\s+String\?\s+@unique\s+@db\.Uuid/);
  assert.match(
    product,
    /organization\s+Organization\s+@relation\("OrganizationProducts", fields: \[organizationId\], references: \[id\], onDelete: Restrict, onUpdate: Cascade\)/,
  );

  assert.match(
    version,
    /product\s+Product\s+@relation\("ProductVersions", fields: \[productId\], references: \[id\], onDelete: Restrict, onUpdate: Cascade\)/,
  );
  assert.match(
    version,
    /clonedFromVersion\s+ProductVersion\?\s+@relation\("ClonedProductVersions", fields: \[clonedFromVersionId\], references: \[id\], onDelete: SetNull, onUpdate: Cascade\)/,
  );
  assert.match(version, /clonedVersions\s+ProductVersion\[\]\s+@relation\("ClonedProductVersions"\)/);
  assert.match(version, /currentDraftForProduct\s+Product\?\s+@relation\("CurrentDraftVersion"\)/);
  assert.match(
    version,
    /currentPublishedForProduct\s+Product\?\s+@relation\("CurrentPublishedVersion"\)/,
  );

  for (const [field, relationName] of [
    ["createdBy", "ProductVersionCreatedBy"],
    ["updatedBy", "ProductVersionUpdatedBy"],
    ["publishedBy", "ProductVersionPublishedBy"],
  ]) {
    assert.match(
      version,
      new RegExp(
        `${field}\\s+User\\?\\s+@relation\\("${relationName}", fields: \\[${field}Id\\], references: \\[id\\], onDelete: SetNull, onUpdate: Cascade\\)`,
      ),
    );
  }
  assert.match(
    version,
    /Required by application services at creation; nullable for historical retention\.[\s\S]*createdById\s+String\?\s+@db\.Uuid/,
  );
  assert.match(version, /@@unique\(\[productId, versionNumber\]\)/);
});

test("Passport is one-to-one with Product and does not duplicate publication content", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const passport = block(schema, "model", "Passport");

  assert.match(passport, /productId\s+String\s+@unique\s+@db\.Uuid/);
  assert.match(passport, /status\s+PassportStatus\s+@default\(ACTIVE\)/);
  assert.match(passport, /firstPublishedAt\s+DateTime/);
  assert.match(
    passport,
    /product\s+Product\s+@relation\("ProductPassport", fields: \[productId\], references: \[id\], onDelete: Restrict, onUpdate: Cascade\)/,
  );
  assert.match(
    passport,
    /organization\s+Organization\s+@relation\("OrganizationPassports", fields: \[organizationId\], references: \[id\], onDelete: Restrict, onUpdate: Cascade\)/,
  );
  assert.match(
    passport,
    /withdrawnBy\s+User\?\s+@relation\("PassportWithdrawnBy", fields: \[withdrawnById\], references: \[id\], onDelete: SetNull, onUpdate: Cascade\)/,
  );

  for (const forbidden of [
    "publicCode",
    "currentPublishedVersionId",
    "productName",
    "description",
    "materials",
    "documents",
  ]) {
    assert.doesNotMatch(passport, new RegExp(`^\\s*${forbidden}\\b`, "m"));
  }
});

test("Organization and User expose only Phase 2A inverse relations", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const organization = block(schema, "model", "Organization");
  const user = block(schema, "model", "User");

  assert.match(organization, /products\s+Product\[\]\s+@relation\("OrganizationProducts"\)/);
  assert.match(
    organization,
    /productVersions\s+ProductVersion\[\]\s+@relation\("OrganizationProductVersions"\)/,
  );
  assert.match(organization, /passports\s+Passport\[\]\s+@relation\("OrganizationPassports"\)/);

  for (const [field, model, relationName] of [
    ["productsCreated", "Product", "ProductCreatedBy"],
    ["productsUpdated", "Product", "ProductUpdatedBy"],
    ["productsArchived", "Product", "ProductArchivedBy"],
    ["productVersionsCreated", "ProductVersion", "ProductVersionCreatedBy"],
    ["productVersionsUpdated", "ProductVersion", "ProductVersionUpdatedBy"],
    ["productVersionsPublished", "ProductVersion", "ProductVersionPublishedBy"],
    ["passportsWithdrawn", "Passport", "PassportWithdrawnBy"],
  ]) {
    assert.match(user, new RegExp(`${field}\\s+${model}\\[\\]\\s+@relation\\("${relationName}"\\)`));
  }

  for (const future of ["documents", "scanEvents", "auditLogs", "subscriptions"]) {
    assert.doesNotMatch(organization, new RegExp(`^\\s*${future}\\b`, "m"));
  }
});

test("ProductVersion retains tenant ownership without later Phase 2 child models", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const version = block(schema, "model", "ProductVersion");

  assert.match(version, /organizationId\s+String\s+@db\.Uuid/);
  assert.match(
    version,
    /organization\s+Organization\s+@relation\("OrganizationProductVersions", fields: \[organizationId\], references: \[id\], onDelete: Restrict, onUpdate: Cascade\)/,
  );
  assert.match(version, /@@index\(\[productId, status\]\)/);
  assert.match(version, /@@index\(\[organizationId, status\]\)/);
  assert.match(version, /@@index\(\[organizationId, updatedAt\]\)/);

  for (const futureRelation of ["identifiers", "materials", "documents", "images"]) {
    assert.doesNotMatch(version, new RegExp(`^\\s*${futureRelation}\\b`, "m"));
  }
});

test("Phase 2A migration is additive and contains the active-draft partial index", async () => {
  const migrationSql = await readPhaseMigration();
  const migrationLock = await readFile(new URL("migration_lock.toml", migrationsPath), "utf8");

  assert.match(migrationLock, /provider = "postgresql"/);
  for (const enumName of ["ProductLifecycleStatus", "ProductVersionStatus", "PassportStatus"]) {
    assert.match(migrationSql, new RegExp(`CREATE TYPE "${enumName}" AS ENUM`));
  }
  for (const modelName of ["Product", "ProductVersion", "Passport"]) {
    assert.match(migrationSql, new RegExp(`CREATE TABLE "${modelName}"`));
  }
  assert.match(
    migrationSql,
    /CREATE UNIQUE INDEX "ux_product_version_one_active_draft"\s+ON "ProductVersion" \("productId"\)\s+WHERE "status" IN \(\s*'DRAFT'::"ProductVersionStatus",\s*'READY_FOR_REVIEW'::"ProductVersionStatus"\s*\);/,
  );

  assert.doesNotMatch(migrationSql, /\b(DROP TABLE|DROP TYPE|DROP INDEX|DROP CONSTRAINT)\b/);
  assert.doesNotMatch(
    migrationSql,
    /ALTER TABLE "(User|Organization|Membership|Invitation)"\s+(ADD|DROP|ALTER)/,
  );
  for (const identityName of [
    "User",
    "Organization",
    "Membership",
    "Invitation",
    "OrganizationStatus",
    "MembershipRole",
    "MembershipStatus",
    "InvitationStatus",
  ]) {
    assert.doesNotMatch(migrationSql, new RegExp(`CREATE (?:TABLE|TYPE) "${identityName}"`));
  }
});
