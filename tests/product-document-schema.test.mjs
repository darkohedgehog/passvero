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
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("_add_product_document"))
    .map((entry) => entry.name);

  assert.equal(directories.length, 1, "Expected one add_product_document migration");
  return readFile(new URL(`${directories[0]}/migration.sql`, migrationsPath), "utf8");
}

test("Phase 2C.2 adds only ProductDocument and no enum", async () => {
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
  ]);
  assert.doesNotMatch(schema, /^enum ProductDocument\w* \{/m);
  assert.doesNotMatch(schema, /^enum DocumentVisibility \{/m);
});

test("ProductDocument contains exactly the approved fields and defaults", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const productDocument = block(schema, "model", "ProductDocument");

  assert.deepEqual(fieldNames(productDocument), [
    "id",
    "productVersionId",
    "documentId",
    "category",
    "locale",
    "displayLabel",
    "description",
    "isPublic",
    "isPrimary",
    "sortOrder",
    "createdAt",
    "updatedAt",
    "productVersion",
    "document",
  ]);
  assert.match(productDocument, /id\s+String\s+@id\s+@default\(uuid\(\)\)\s+@db\.Uuid/);
  assert.match(productDocument, /productVersionId\s+String\s+@db\.Uuid/);
  assert.match(productDocument, /documentId\s+String\s+@db\.Uuid/);
  assert.match(productDocument, /category\s+String(?:\s|$)/);
  assert.match(productDocument, /locale\s+String\?\s*$/m);
  assert.match(productDocument, /displayLabel\s+String\?\s*$/m);
  assert.match(productDocument, /description\s+String\?\s*$/m);
  assert.match(productDocument, /isPublic\s+Boolean\s+@default\(true\)/);
  assert.match(productDocument, /isPrimary\s+Boolean\s+@default\(false\)/);
  assert.match(productDocument, /sortOrder\s+Int\s+@default\(0\)/);
  assert.match(productDocument, /createdAt\s+DateTime\s+@default\(now\(\)\)/);
  assert.match(productDocument, /updatedAt\s+DateTime\s+@updatedAt/);
  assert.match(productDocument, /Non-negative ordering is enforced by a manual PostgreSQL CHECK/);
});

test("ProductDocument relations and inverses use the canonical names and actions", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const version = block(schema, "model", "ProductVersion");
  const document = block(schema, "model", "Document");
  const productDocument = block(schema, "model", "ProductDocument");

  assert.match(
    productDocument,
    /productVersion\s+ProductVersion\s+@relation\("ProductVersionDocuments", fields: \[productVersionId\], references: \[id\], onDelete: Cascade, onUpdate: Cascade\)/,
  );
  assert.match(
    productDocument,
    /document\s+Document\s+@relation\("DocumentProductVersions", fields: \[documentId\], references: \[id\], onDelete: Restrict, onUpdate: Cascade\)/,
  );
  assert.match(
    version,
    /productDocuments\s+ProductDocument\[\]\s+@relation\("ProductVersionDocuments"\)/,
  );
  assert.match(
    document,
    /productDocuments\s+ProductDocument\[\]\s+@relation\("DocumentProductVersions"\)/,
  );
  assert.match(
    productDocument,
    /Application services must verify that Document\.organizationId equals\s+\/\/\/ ProductVersion\.organizationId before creating the association\./,
  );
});

test("ProductDocument has exactly the five approved indexes and no uniqueness", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const productDocument = block(schema, "model", "ProductDocument");

  for (const index of [
    "productVersionId",
    "documentId",
    "productVersionId, category",
    "productVersionId, locale",
    "productVersionId, isPublic, sortOrder",
  ]) {
    assert.match(productDocument, new RegExp(`@@index\\(\\[${index}\\]\\)`));
  }
  assert.equal([...productDocument.matchAll(/@@index\(/g)].length, 5);
  assert.doesNotMatch(productDocument, /@unique|@@unique/);
});

test("ProductDocument excludes ownership, storage, actor, and future fields", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const productDocument = block(schema, "model", "ProductDocument");
  const forbiddenFields = [
    "organizationId",
    "productId",
    "passportId",
    "documentType",
    "title",
    "filename",
    "storageProvider",
    "storageBucket",
    "storageKey",
    "publicUrl",
    "signedUrl",
    "mimeType",
    "sizeBytes",
    "checksumSha256",
    "fileExtension",
    "status",
    "validFrom",
    "validUntil",
    "issuedAt",
    "issuer",
    "certificateNumber",
    "revision",
    "version",
    "language",
    "localeCode",
    "metadata",
    "archivedAt",
    "deletedAt",
    "createdById",
    "updatedById",
    "archivedById",
  ];

  for (const field of forbiddenFields) {
    assert.doesNotMatch(productDocument, new RegExp(`^\\s*${field}\\b`, "m"));
  }
  assert.doesNotMatch(productDocument, /\bJson\b/);
  assert.doesNotMatch(productDocument, /^\s*(product|passport|organization)\b/m);
});

test("ProductDocument migration is additive and isolated", async () => {
  const migrationSql = await readPhaseMigration();
  const migrationLock = await readFile(new URL("migration_lock.toml", migrationsPath), "utf8");

  assert.match(migrationLock, /provider = "postgresql"/);
  assert.deepEqual([...migrationSql.matchAll(/CREATE TYPE "(\w+)"/g)], []);
  assert.deepEqual(
    [...migrationSql.matchAll(/CREATE TABLE "(\w+)"/g)].map((match) => match[1]),
    ["ProductDocument"],
  );

  for (const indexName of [
    "ProductDocument_productVersionId_idx",
    "ProductDocument_documentId_idx",
    "ProductDocument_productVersionId_category_idx",
    "ProductDocument_productVersionId_locale_idx",
    "ProductDocument_productVersionId_isPublic_sortOrder_idx",
  ]) {
    assert.match(migrationSql, new RegExp(`CREATE INDEX "${indexName}"`));
  }
  assert.equal([...migrationSql.matchAll(/CREATE INDEX /g)].length, 5);
  assert.match(
    migrationSql,
    /ALTER TABLE "ProductDocument" ADD CONSTRAINT "ProductDocument_productVersionId_fkey" FOREIGN KEY \("productVersionId"\) REFERENCES "ProductVersion"\("id"\) ON DELETE CASCADE ON UPDATE CASCADE/,
  );
  assert.match(
    migrationSql,
    /ALTER TABLE "ProductDocument" ADD CONSTRAINT "ProductDocument_documentId_fkey" FOREIGN KEY \("documentId"\) REFERENCES "Document"\("id"\) ON DELETE RESTRICT ON UPDATE CASCADE/,
  );
  assert.equal(
    [...migrationSql.matchAll(/ALTER TABLE "ProductDocument" ADD CONSTRAINT "ProductDocument_\w+_fkey"/g)].length,
    2,
  );
  assert.doesNotMatch(
    migrationSql,
    /\b(DROP|TRUNCATE|INSERT INTO|UPDATE .+ SET|DELETE FROM|CREATE FUNCTION|CREATE TRIGGER|CREATE POLICY)\b/,
  );
  assert.doesNotMatch(migrationSql, /ROW LEVEL SECURITY/);
  assert.doesNotMatch(
    migrationSql,
    /ALTER TABLE "(User|Organization|Membership|Invitation|Product|ProductVersion|ProductTranslation|ProductIdentifier|ProductMaterial|Document|Passport)"/,
  );
});

test("ProductDocument migration enforces non-negative sort order", async () => {
  const migrationSql = await readPhaseMigration();

  assert.match(
    migrationSql,
    /CONSTRAINT "ck_product_document_sort_order_non_negative"\s+CHECK \("sortOrder" >= 0\)/,
  );
  assert.equal(
    [...migrationSql.matchAll(/\bCONSTRAINT "ck_product_document_sort_order_non_negative"/g)].length,
    1,
  );
});

test("all previous migration sources retain their approved hashes", async () => {
  const approvedMigrations = new Map([
    ["20260717191316_init_identity_domain", "347ada303ff4cc2495301b400955e0d89cf743fd1990dd27b9f6bb6889ecf0f6"],
    ["20260720170638_add_product_core_and_passport", "0395328af8ebd574ed7b8ad9d3b532233ea015c5f91dd02040e3ca877cd8442d"],
    ["20260720172426_add_product_translation", "05b0eba12925bba3d7b0ac7b6108a1e1c0057d305c233a7c90d75bcd4118e8fa"],
    ["20260720173610_add_product_identifier", "62be095ca5f0349105281a7ac72009c306a8c72da7cd5bfdb5832c6838dce288"],
    ["20260720175253_add_product_material", "41d4e2cc5857213ca6ccc65ce700b704fa590e375049d1dc317d6376f2b61737"],
    ["20260720182219_add_document_asset", "cb08e7305980f907343f464ba2519e22d2c3b7ba1ed833da88b58e20c6455e3f"],
  ]);

  for (const [directory, approvedHash] of approvedMigrations) {
    const migrationSql = await readFile(
      new URL(`${directory}/migration.sql`, migrationsPath),
      "utf8",
    );
    const actualHash = createHash("sha256").update(migrationSql).digest("hex");

    assert.equal(actualHash, approvedHash, `${directory} migration source changed`);
  }
});
