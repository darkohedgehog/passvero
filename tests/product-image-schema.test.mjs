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
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("_add_product_image"))
    .map((entry) => entry.name);

  assert.equal(directories.length, 1, "Expected one add_product_image migration");
  return readFile(new URL(`${directories[0]}/migration.sql`, migrationsPath), "utf8");
}

test("Phase 2C.3 adds only ProductImage and no enum", async () => {
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
  assert.doesNotMatch(schema, /^enum ProductImage\w* \{/m);
  assert.doesNotMatch(schema, /^enum Image\w*Status \{/m);
});

test("ProductImage contains exactly the approved fields and defaults", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const image = block(schema, "model", "ProductImage");

  assert.deepEqual(fieldNames(image), [
    "id",
    "productVersionId",
    "originalFilename",
    "fileExtension",
    "storageProvider",
    "storageBucket",
    "storageKey",
    "mimeType",
    "sizeBytes",
    "checksumSha256",
    "width",
    "height",
    "altText",
    "caption",
    "isPublic",
    "isPrimary",
    "sortOrder",
    "uploadedAt",
    "createdAt",
    "updatedAt",
    "productVersion",
  ]);
  assert.match(image, /id\s+String\s+@id\s+@default\(uuid\(\)\)\s+@db\.Uuid/);
  assert.match(image, /productVersionId\s+String\s+@db\.Uuid/);
  for (const field of [
    "originalFilename",
    "storageProvider",
    "storageBucket",
    "storageKey",
    "mimeType",
    "checksumSha256",
  ]) {
    assert.match(image, new RegExp(`^\\s*${field}\\s+String(?:\\s|$)`, "m"));
  }
  assert.match(image, /sizeBytes\s+BigInt(?:\s|$)/);
  assert.match(image, /width\s+Int(?:\s|$)/);
  assert.match(image, /height\s+Int(?:\s|$)/);
  assert.match(image, /isPublic\s+Boolean\s+@default\(true\)/);
  assert.match(image, /isPrimary\s+Boolean\s+@default\(false\)/);
  assert.match(image, /sortOrder\s+Int\s+@default\(0\)/);
  assert.match(image, /createdAt\s+DateTime\s+@default\(now\(\)\)/);
  assert.match(image, /updatedAt\s+DateTime\s+@updatedAt/);
  assert.match(image, /manual PostgreSQL CHECK constraints/);
});

test("ProductImage optional fields have the approved nullability", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const image = block(schema, "model", "ProductImage");

  for (const field of ["altText", "caption", "fileExtension"]) {
    assert.match(image, new RegExp(`^\\s*${field}\\s+String\\?\\s*$`, "m"));
  }
  assert.match(image, /^\s*uploadedAt\s+DateTime\?\s*$/m);
});

test("ProductImage belongs only to ProductVersion through ProductVersionImages", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const version = block(schema, "model", "ProductVersion");
  const image = block(schema, "model", "ProductImage");

  assert.match(
    image,
    /productVersion\s+ProductVersion\s+@relation\("ProductVersionImages", fields: \[productVersionId\], references: \[id\], onDelete: Cascade, onUpdate: Cascade\)/,
  );
  assert.match(version, /images\s+ProductImage\[\]\s+@relation\("ProductVersionImages"\)/);
  assert.deepEqual(
    fieldNames(image).filter((field) =>
      ![
        "id",
        "productVersionId",
        "originalFilename",
        "fileExtension",
        "storageProvider",
        "storageBucket",
        "storageKey",
        "mimeType",
        "sizeBytes",
        "checksumSha256",
        "width",
        "height",
        "altText",
        "caption",
        "isPublic",
        "isPrimary",
        "sortOrder",
        "uploadedAt",
        "createdAt",
        "updatedAt",
      ].includes(field)
    ),
    ["productVersion"],
  );
});

test("ProductImage has only storage uniqueness and the four approved indexes", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const image = block(schema, "model", "ProductImage");

  assert.match(image, /@@unique\(\[storageProvider, storageBucket, storageKey\]\)/);
  for (const index of [
    "productVersionId",
    "productVersionId, isPublic, sortOrder",
    "productVersionId, isPrimary",
    "checksumSha256",
  ]) {
    assert.match(image, new RegExp(`@@index\\(\\[${index}\\]\\)`));
  }
  assert.equal([...image.matchAll(/@@index\(/g)].length, 4);
  assert.equal([...image.matchAll(/@@unique\(/g)].length, 1);
  assert.doesNotMatch(image, /checksumSha256\s+String\s+@unique/);
  assert.doesNotMatch(image, /storageKey\s+String\s+@unique/);
  assert.doesNotMatch(image, /@@unique\(\[productVersionId,/);
});

test("ProductImage excludes ownership, document, URL, actor, and processing fields", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const image = block(schema, "model", "ProductImage");
  const forbiddenFields = [
    "organizationId",
    "productId",
    "passportId",
    "documentId",
    "locale",
    "title",
    "description",
    "publicUrl",
    "signedUrl",
    "downloadUrl",
    "localPath",
    "cdnUrl",
    "blurDataUrl",
    "dominantColor",
    "focalPoint",
    "metadata",
    "status",
    "archivedAt",
    "deletedAt",
    "createdById",
    "updatedById",
    "uploadedById",
    "sourceImageId",
    "variantType",
    "thumbnailUrl",
    "responsiveSizes",
    "processingStatus",
    "scanStatus",
  ];

  for (const field of forbiddenFields) {
    assert.doesNotMatch(image, new RegExp(`^\\s*${field}\\b`, "m"));
  }
  assert.doesNotMatch(image, /\bJson\b/);
  assert.doesNotMatch(image, /^\s*(product|passport|document|productDocument)\b/m);
});

test("ProductImage migration is additive and contains only approved database objects", async () => {
  const migrationSql = await readPhaseMigration();
  const migrationLock = await readFile(new URL("migration_lock.toml", migrationsPath), "utf8");

  assert.match(migrationLock, /provider = "postgresql"/);
  assert.deepEqual([...migrationSql.matchAll(/CREATE TYPE "(\w+)"/g)], []);
  assert.deepEqual(
    [...migrationSql.matchAll(/CREATE TABLE "(\w+)"/g)].map((match) => match[1]),
    ["ProductImage"],
  );

  for (const indexName of [
    "ProductImage_productVersionId_idx",
    "ProductImage_productVersionId_isPublic_sortOrder_idx",
    "ProductImage_productVersionId_isPrimary_idx",
    "ProductImage_checksumSha256_idx",
    "ProductImage_storageProvider_storageBucket_storageKey_key",
  ]) {
    assert.match(migrationSql, new RegExp(`CREATE (?:UNIQUE )?INDEX "${indexName}"`));
  }
  assert.equal([...migrationSql.matchAll(/CREATE (?:UNIQUE )?INDEX /g)].length, 5);
  assert.match(
    migrationSql,
    /ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productVersionId_fkey" FOREIGN KEY \("productVersionId"\) REFERENCES "ProductVersion"\("id"\) ON DELETE CASCADE ON UPDATE CASCADE/,
  );
  assert.equal(
    [...migrationSql.matchAll(/ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_\w+_fkey"/g)].length,
    1,
  );
  assert.doesNotMatch(
    migrationSql,
    /\b(DROP|TRUNCATE|INSERT INTO|UPDATE .+ SET|DELETE FROM|CREATE FUNCTION|CREATE TRIGGER|CREATE POLICY)\b/,
  );
  assert.doesNotMatch(migrationSql, /ROW LEVEL SECURITY/);
  assert.doesNotMatch(
    migrationSql,
    /ALTER TABLE "(User|Organization|Membership|Invitation|Product|ProductVersion|ProductTranslation|ProductIdentifier|ProductMaterial|Document|ProductDocument|Passport)"/,
  );
});

test("ProductImage migration contains all six exact CHECK constraints", async () => {
  const migrationSql = await readPhaseMigration();

  assert.match(
    migrationSql,
    /CONSTRAINT "ck_product_image_checksum_sha256_format"\s+CHECK \("checksumSha256" ~ '\^\[0-9a-f\]\{64\}\$'\)/,
  );
  assert.match(
    migrationSql,
    /CONSTRAINT "ck_product_image_size_bytes_positive"\s+CHECK \("sizeBytes" > 0\)/,
  );
  assert.match(
    migrationSql,
    /CONSTRAINT "ck_product_image_width_positive"\s+CHECK \("width" > 0\)/,
  );
  assert.match(
    migrationSql,
    /CONSTRAINT "ck_product_image_height_positive"\s+CHECK \("height" > 0\)/,
  );
  assert.match(
    migrationSql,
    /CONSTRAINT "ck_product_image_mime_type"\s+CHECK \("mimeType" IN \('image\/jpeg', 'image\/png', 'image\/webp', 'image\/avif'\)\)/,
  );
  assert.match(
    migrationSql,
    /CONSTRAINT "ck_product_image_sort_order_non_negative"\s+CHECK \("sortOrder" >= 0\)/,
  );
  assert.equal([...migrationSql.matchAll(/\bCONSTRAINT "ck_product_image_/g)].length, 6);
  assert.doesNotMatch(migrationSql, /image\/svg\+xml|image\/gif/);
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
