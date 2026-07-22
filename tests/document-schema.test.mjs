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
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("_add_document_asset"))
    .map((entry) => entry.name);

  assert.equal(directories.length, 1, "Expected one add_document_asset migration");
  return readFile(new URL(`${directories[0]}/migration.sql`, migrationsPath), "utf8");
}

test("Phase 2C.1 retains Document and DocumentStatus", async () => {
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
  ]);
});

test("DocumentStatus contains exactly the approved lifecycle values", async () => {
  const schema = await readFile(schemaPath, "utf8");

  assert.match(
    block(schema, "enum", "DocumentStatus"),
    /^\s*PENDING_UPLOAD\s+AVAILABLE\s+FAILED\s+ARCHIVED\s*$/,
  );
});

test("Document contains exactly the approved fields and scalar types", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const document = block(schema, "model", "Document");

  assert.deepEqual(fieldNames(document), [
    "id",
    "organizationId",
    "originalFilename",
    "displayName",
    "fileExtension",
    "storageProvider",
    "storageBucket",
    "storageKey",
    "mimeType",
    "sizeBytes",
    "checksumSha256",
    "status",
    "uploadedAt",
    "failedAt",
    "failureCode",
    "archivedAt",
    "createdById",
    "updatedById",
    "archivedById",
    "createdAt",
    "updatedAt",
    "organization",
    "createdBy",
    "updatedBy",
    "archivedBy",
    "productDocuments",
  ]);

  assert.match(document, /id\s+String\s+@id\s+@default\(uuid\(\)\)\s+@db\.Uuid/);
  assert.match(document, /organizationId\s+String\s+@db\.Uuid/);
  for (const field of [
    "originalFilename",
    "storageProvider",
    "storageBucket",
    "storageKey",
    "mimeType",
    "checksumSha256",
  ]) {
    assert.match(document, new RegExp(`^\\s*${field}\\s+String(?:\\s|$)`, "m"));
  }
  assert.match(document, /sizeBytes\s+BigInt(?:\s|$)/);
  assert.match(document, /status\s+DocumentStatus\s+@default\(PENDING_UPLOAD\)/);
  assert.match(document, /createdAt\s+DateTime\s+@default\(now\(\)\)/);
  assert.match(document, /updatedAt\s+DateTime\s+@updatedAt/);
  assert.match(document, /manual PostgreSQL CHECK constraints/);
});

test("Document optional fields and actor foreign keys are nullable", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const document = block(schema, "model", "Document");

  for (const field of ["displayName", "fileExtension", "failureCode"]) {
    assert.match(document, new RegExp(`^\\s*${field}\\s+String\\?\\s*$`, "m"));
  }
  for (const field of ["uploadedAt", "failedAt", "archivedAt"]) {
    assert.match(document, new RegExp(`^\\s*${field}\\s+DateTime\\?\\s*$`, "m"));
  }
  for (const field of ["createdById", "updatedById", "archivedById"]) {
    assert.match(document, new RegExp(`^\\s*${field}\\s+String\\?\\s+@db\\.Uuid\\s*$`, "m"));
  }
});

test("Document has only Organization and canonical actor relations", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const user = block(schema, "model", "User");
  const organization = block(schema, "model", "Organization");
  const document = block(schema, "model", "Document");

  assert.match(
    document,
    /organization\s+Organization\s+@relation\("OrganizationDocuments", fields: \[organizationId\], references: \[id\], onDelete: Restrict, onUpdate: Cascade\)/,
  );
  assert.match(
    organization,
    /documents\s+Document\[\]\s+@relation\("OrganizationDocuments"\)/,
  );

  for (const [relationField, idField, relationName, inverseField] of [
    ["createdBy", "createdById", "DocumentCreatedBy", "documentsCreated"],
    ["updatedBy", "updatedById", "DocumentUpdatedBy", "documentsUpdated"],
    ["archivedBy", "archivedById", "DocumentArchivedBy", "documentsArchived"],
  ]) {
    assert.match(
      document,
      new RegExp(
        `${relationField}\\s+User\\?\\s+@relation\\("${relationName}", fields: \\[${idField}\\], references: \\[id\\], onDelete: SetNull, onUpdate: Cascade\\)`,
      ),
    );
    assert.match(
      user,
      new RegExp(`${inverseField}\\s+Document\\[\\]\\s+@relation\\("${relationName}"\\)`),
    );
  }

  assert.deepEqual(
    fieldNames(document).filter((field) =>
      ["organization", "createdBy", "updatedBy", "archivedBy"].includes(field)
    ),
    ["organization", "createdBy", "updatedBy", "archivedBy"],
  );
});

test("Document has the approved storage uniqueness and indexes only", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const document = block(schema, "model", "Document");

  assert.match(document, /@@unique\(\[storageProvider, storageBucket, storageKey\]\)/);
  for (const index of [
    "organizationId, status",
    "organizationId, createdAt",
    "organizationId, updatedAt",
    "checksumSha256",
    "createdById",
    "updatedById",
    "archivedById",
  ]) {
    assert.match(document, new RegExp(`@@index\\(\\[${index}\\]\\)`));
  }
  assert.equal([...document.matchAll(/@@index\(/g)].length, 7);
  assert.equal([...document.matchAll(/@@unique\(/g)].length, 1);
  assert.doesNotMatch(document, /checksumSha256\s+String\s+@unique/);
  assert.doesNotMatch(document, /@@unique\(\[(?:organizationId,\s*)?checksumSha256\]\)/);
  assert.doesNotMatch(document, /storageKey\s+String\s+@unique/);
});

test("Document excludes ProductDocument metadata and future processing fields", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const document = block(schema, "model", "Document");
  const forbiddenFields = [
    "publicUrl",
    "signedUrl",
    "downloadUrl",
    "localPath",
    "absolutePath",
    "cdnUrl",
    "metadata",
    "locale",
    "category",
    "documentType",
    "title",
    "description",
    "publicLabel",
    "visibility",
    "sortOrder",
    "productId",
    "productVersionId",
    "passportId",
    "expiresAt",
    "validFrom",
    "validUntil",
    "issuedAt",
    "issuer",
    "certificateNumber",
    "revision",
    "pageCount",
    "ocrText",
    "extractedText",
    "scanStatus",
    "virusScanStatus",
    "processingStatus",
    "deletedAt",
    "uploadedById",
  ];

  for (const field of forbiddenFields) {
    assert.doesNotMatch(document, new RegExp(`^\\s*${field}\\b`, "m"));
  }
  assert.doesNotMatch(document, /\bJson\b/);
  assert.doesNotMatch(document, /^\s*(product|productVersion|passport)\b/m);
});

test("Document migration creates only the approved enum, table, indexes, and foreign keys", async () => {
  const migrationSql = await readPhaseMigration();
  const migrationLock = await readFile(new URL("migration_lock.toml", migrationsPath), "utf8");

  assert.match(migrationLock, /provider = "postgresql"/);
  assert.deepEqual(
    [...migrationSql.matchAll(/CREATE TYPE "(\w+)"/g)].map((match) => match[1]),
    ["DocumentStatus"],
  );
  assert.match(
    migrationSql,
    /CREATE TYPE "DocumentStatus" AS ENUM \('PENDING_UPLOAD', 'AVAILABLE', 'FAILED', 'ARCHIVED'\)/,
  );
  assert.deepEqual(
    [...migrationSql.matchAll(/CREATE TABLE "(\w+)"/g)].map((match) => match[1]),
    ["Document"],
  );

  for (const indexName of [
    "Document_organizationId_status_idx",
    "Document_organizationId_createdAt_idx",
    "Document_organizationId_updatedAt_idx",
    "Document_checksumSha256_idx",
    "Document_createdById_idx",
    "Document_updatedById_idx",
    "Document_archivedById_idx",
    "Document_storageProvider_storageBucket_storageKey_key",
  ]) {
    assert.match(migrationSql, new RegExp(`CREATE (?:UNIQUE )?INDEX "${indexName}"`));
  }

  for (const [field, target, deleteAction] of [
    ["organizationId", "Organization", "RESTRICT"],
    ["createdById", "User", "SET NULL"],
    ["updatedById", "User", "SET NULL"],
    ["archivedById", "User", "SET NULL"],
  ]) {
    assert.match(
      migrationSql,
      new RegExp(
        `ALTER TABLE "Document" ADD CONSTRAINT "Document_${field}_fkey" FOREIGN KEY \\("${field}"\\) REFERENCES "${target}"\\("id"\\) ON DELETE ${deleteAction} ON UPDATE CASCADE`,
      ),
    );
  }

  assert.equal([...migrationSql.matchAll(/CREATE (?:UNIQUE )?INDEX /g)].length, 8);
  assert.equal([...migrationSql.matchAll(/ALTER TABLE "Document" ADD CONSTRAINT "Document_\w+_fkey"/g)].length, 4);
  assert.doesNotMatch(
    migrationSql,
    /\b(DROP|TRUNCATE|INSERT INTO|UPDATE .+ SET|DELETE FROM|CREATE FUNCTION|CREATE TRIGGER|CREATE POLICY)\b/,
  );
  assert.doesNotMatch(migrationSql, /ROW LEVEL SECURITY/);
  assert.doesNotMatch(
    migrationSql,
    /ALTER TABLE "(User|Organization|Membership|Invitation|Product|ProductVersion|ProductTranslation|ProductIdentifier|ProductMaterial|Passport)"/,
  );
});

test("Document migration contains all five exact CHECK constraints", async () => {
  const migrationSql = await readPhaseMigration();

  assert.match(
    migrationSql,
    /CONSTRAINT "ck_document_checksum_sha256_format"\s+CHECK \("checksumSha256" ~ '\^\[0-9a-f\]\{64\}\$'\)/,
  );
  assert.match(
    migrationSql,
    /CONSTRAINT "ck_document_size_bytes_positive"\s+CHECK \("sizeBytes" > 0\)/,
  );
  assert.match(
    migrationSql,
    /CONSTRAINT "ck_document_available_uploaded_at"\s+CHECK \("status" <> 'AVAILABLE'::"DocumentStatus" OR "uploadedAt" IS NOT NULL\)/,
  );
  assert.match(
    migrationSql,
    /CONSTRAINT "ck_document_failed_at"\s+CHECK \("status" <> 'FAILED'::"DocumentStatus" OR "failedAt" IS NOT NULL\)/,
  );
  assert.match(
    migrationSql,
    /CONSTRAINT "ck_document_archived_at"\s+CHECK \("status" <> 'ARCHIVED'::"DocumentStatus" OR "archivedAt" IS NOT NULL\)/,
  );
  assert.equal([...migrationSql.matchAll(/\bCONSTRAINT "ck_document_/g)].length, 5);
});

test("all previous migration sources retain their approved hashes", async () => {
  const approvedMigrations = new Map([
    ["20260717191316_init_identity_domain", "347ada303ff4cc2495301b400955e0d89cf743fd1990dd27b9f6bb6889ecf0f6"],
    ["20260720170638_add_product_core_and_passport", "0395328af8ebd574ed7b8ad9d3b532233ea015c5f91dd02040e3ca877cd8442d"],
    ["20260720172426_add_product_translation", "05b0eba12925bba3d7b0ac7b6108a1e1c0057d305c233a7c90d75bcd4118e8fa"],
    ["20260720173610_add_product_identifier", "62be095ca5f0349105281a7ac72009c306a8c72da7cd5bfdb5832c6838dce288"],
    ["20260720175253_add_product_material", "41d4e2cc5857213ca6ccc65ce700b704fa590e375049d1dc317d6376f2b61737"],
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
