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
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("_add_qr_code"))
    .map((entry) => entry.name);

  assert.equal(directories.length, 1, "Expected one add_qr_code migration");
  return readFile(new URL(`${directories[0]}/migration.sql`, migrationsPath), "utf8");
}

test("Phase 2D adds only QRCode and QRCodeStatus", async () => {
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
  ]);
  assert.match(block(schema, "enum", "QRCodeStatus"), /^\s*PENDING\s+ACTIVE\s+REVOKED\s*$/);
});

test("QRCode contains exactly the approved fields, types, and defaults", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const qrCode = block(schema, "model", "QRCode");

  assert.deepEqual(fieldNames(qrCode), [
    "id",
    "passportId",
    "code",
    "targetUrl",
    "status",
    "generatedAt",
    "activatedAt",
    "revokedAt",
    "createdAt",
    "updatedAt",
    "passport",
    "scanEvents",
  ]);
  assert.match(qrCode, /id\s+String\s+@id\s+@default\(uuid\(\)\)\s+@db\.Uuid/);
  assert.match(qrCode, /passportId\s+String\s+@unique\s+@db\.Uuid/);
  assert.match(qrCode, /code\s+String\s+@unique/);
  assert.match(qrCode, /targetUrl\s+String\s+@unique/);
  assert.match(qrCode, /status\s+QRCodeStatus\s+@default\(PENDING\)/);
  assert.match(qrCode, /generatedAt\s+DateTime\s+@default\(now\(\)\)/);
  assert.match(qrCode, /^\s*activatedAt\s+DateTime\?\s*$/m);
  assert.match(qrCode, /^\s*revokedAt\s+DateTime\?\s*$/m);
  assert.match(qrCode, /createdAt\s+DateTime\s+@default\(now\(\)\)/);
  assert.match(qrCode, /updatedAt\s+DateTime\s+@updatedAt/);
  assert.match(qrCode, /Intentionally one QRCode per Passport for MVP/);
  assert.match(qrCode, /manual PostgreSQL CHECK constraints/);
});

test("QRCode belongs to Passport and exposes the approved ScanEvent inverse", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const passport = block(schema, "model", "Passport");
  const qrCode = block(schema, "model", "QRCode");

  assert.match(
    qrCode,
    /passport\s+Passport\s+@relation\("PassportQRCode", fields: \[passportId\], references: \[id\], onDelete: Cascade, onUpdate: Cascade\)/,
  );
  assert.match(passport, /qrCode\s+QRCode\?\s+@relation\("PassportQRCode"\)/);
  assert.deepEqual(
    fieldNames(qrCode).filter((field) =>
      ![
        "id",
        "passportId",
        "code",
        "targetUrl",
        "status",
        "generatedAt",
        "activatedAt",
        "revokedAt",
        "createdAt",
        "updatedAt",
      ].includes(field)
    ),
    ["passport", "scanEvents"],
  );
  assert.doesNotMatch(passport, /^\s*qrCodes\b/m);
});

test("QRCode has exactly the approved uniqueness and non-unique indexes", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const qrCode = block(schema, "model", "QRCode");

  for (const field of ["passportId", "code", "targetUrl"]) {
    assert.match(qrCode, new RegExp(`^\\s*${field}\\s+\\w+\\s+@unique`, "m"));
  }
  for (const index of ["status", "generatedAt", "activatedAt", "revokedAt"]) {
    assert.match(qrCode, new RegExp(`@@index\\(\\[${index}\\]\\)`));
  }
  assert.equal([...qrCode.matchAll(/@unique/g)].length, 3);
  assert.equal([...qrCode.matchAll(/@@index\(/g)].length, 4);
  assert.doesNotMatch(qrCode, /@@unique/);
});

test("QRCode excludes ownership, product, rendering, analytics, actor, and metadata fields", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const qrCode = block(schema, "model", "QRCode");
  const forbiddenFields = [
    "organizationId",
    "productId",
    "productVersionId",
    "publicCode",
    "passportCode",
    "imageUrl",
    "svg",
    "svgData",
    "pngUrl",
    "pdfUrl",
    "epsUrl",
    "blob",
    "binaryData",
    "filePath",
    "storageProvider",
    "storageBucket",
    "storageKey",
    "checksum",
    "format",
    "size",
    "errorCode",
    "failureReason",
    "expiresAt",
    "printedAt",
    "lastScannedAt",
    "scanCount",
    "metadata",
    "createdById",
    "updatedById",
    "revokedById",
    "revocationReason",
    "archivedAt",
    "deletedAt",
  ];

  for (const field of forbiddenFields) {
    assert.doesNotMatch(qrCode, new RegExp(`^\\s*${field}\\b`, "m"));
  }
  assert.doesNotMatch(qrCode, /\bJson\b/);
  assert.doesNotMatch(qrCode, /^\s*(product|productVersion|organization)\b/m);
});

test("QRCode migration creates only approved enum, table, indexes, and Passport FK", async () => {
  const migrationSql = await readPhaseMigration();
  const migrationLock = await readFile(new URL("migration_lock.toml", migrationsPath), "utf8");

  assert.match(migrationLock, /provider = "postgresql"/);
  assert.deepEqual(
    [...migrationSql.matchAll(/CREATE TYPE "(\w+)"/g)].map((match) => match[1]),
    ["QRCodeStatus"],
  );
  assert.match(
    migrationSql,
    /CREATE TYPE "QRCodeStatus" AS ENUM \('PENDING', 'ACTIVE', 'REVOKED'\)/,
  );
  assert.deepEqual(
    [...migrationSql.matchAll(/CREATE TABLE "(\w+)"/g)].map((match) => match[1]),
    ["QRCode"],
  );

  for (const indexName of [
    "QRCode_status_idx",
    "QRCode_generatedAt_idx",
    "QRCode_activatedAt_idx",
    "QRCode_revokedAt_idx",
    "QRCode_passportId_key",
    "QRCode_code_key",
    "QRCode_targetUrl_key",
  ]) {
    assert.match(migrationSql, new RegExp(`CREATE (?:UNIQUE )?INDEX "${indexName}"`));
  }
  assert.equal([...migrationSql.matchAll(/CREATE INDEX /g)].length, 4);
  assert.equal([...migrationSql.matchAll(/CREATE UNIQUE INDEX /g)].length, 3);
  assert.match(
    migrationSql,
    /ALTER TABLE "QRCode" ADD CONSTRAINT "QRCode_passportId_fkey" FOREIGN KEY \("passportId"\) REFERENCES "Passport"\("id"\) ON DELETE CASCADE ON UPDATE CASCADE/,
  );
  assert.equal(
    [...migrationSql.matchAll(/ALTER TABLE "QRCode" ADD CONSTRAINT "QRCode_\w+_fkey"/g)].length,
    1,
  );
  assert.doesNotMatch(
    migrationSql,
    /\b(DROP|TRUNCATE|INSERT INTO|UPDATE .+ SET|DELETE FROM|CREATE FUNCTION|CREATE TRIGGER|CREATE POLICY)\b/,
  );
  assert.doesNotMatch(migrationSql, /ROW LEVEL SECURITY/);
  assert.doesNotMatch(
    migrationSql,
    /ALTER TABLE "(User|Organization|Membership|Invitation|Product|ProductVersion|ProductTranslation|ProductIdentifier|ProductMaterial|Document|ProductDocument|ProductImage|Passport)"/,
  );
});

test("QRCode migration enforces code and HTTPS target URL formats", async () => {
  const migrationSql = await readPhaseMigration();

  assert.match(
    migrationSql,
    /CONSTRAINT "ck_qr_code_code_format"\s+CHECK \("code" = btrim\("code"\) AND char_length\("code"\) BETWEEN 8 AND 128 AND "code" ~ '\^\[A-Z0-9_-\]\+\$'\)/,
  );
  assert.match(
    migrationSql,
    /CONSTRAINT "ck_qr_code_target_url_https"\s+CHECK \("targetUrl" LIKE 'https:\/\/%'\)/,
  );
});

test("QRCode migration enforces lifecycle timestamps and ordering", async () => {
  const migrationSql = await readPhaseMigration();

  assert.match(migrationSql, /CONSTRAINT "ck_qr_code_lifecycle_timestamps"\s+CHECK \(/);
  assert.match(
    migrationSql,
    /"status" = 'PENDING'::"QRCodeStatus"\s+AND "activatedAt" IS NULL\s+AND "revokedAt" IS NULL/,
  );
  assert.match(
    migrationSql,
    /"status" = 'ACTIVE'::"QRCodeStatus"\s+AND "activatedAt" IS NOT NULL\s+AND "revokedAt" IS NULL\s+AND "activatedAt" >= "generatedAt"/,
  );
  assert.match(
    migrationSql,
    /"status" = 'REVOKED'::"QRCodeStatus"\s+AND "activatedAt" IS NOT NULL\s+AND "revokedAt" IS NOT NULL\s+AND "activatedAt" >= "generatedAt"\s+AND "revokedAt" >= "activatedAt"/,
  );
  assert.equal([...migrationSql.matchAll(/\bCONSTRAINT "ck_qr_code_/g)].length, 3);
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
