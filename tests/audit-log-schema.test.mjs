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
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("_add_audit_log"))
    .map((entry) => entry.name);

  assert.equal(directories.length, 1, "Expected one add_audit_log migration");
  return readFile(new URL(`${directories[0]}/migration.sql`, migrationsPath), "utf8");
}

test("Phase 4 adds only AuditLog and no enum", async () => {
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
  ]);
  assert.doesNotMatch(schema, /^enum Audit(?:Action|EntityType|Category|Severity|ActorType)\b/m);
});

test("AuditLog contains exactly the approved fields, types, and timestamps", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const auditLog = block(schema, "model", "AuditLog");

  assert.deepEqual(fieldNames(auditLog), [
    "id",
    "organizationId",
    "actorId",
    "action",
    "entityType",
    "entityId",
    "summary",
    "metadata",
    "correlationId",
    "occurredAt",
    "createdAt",
    "organization",
    "actor",
  ]);
  assert.match(auditLog, /id\s+String\s+@id\s+@default\(uuid\(\)\)\s+@db\.Uuid/);
  assert.match(auditLog, /organizationId\s+String\s+@db\.Uuid/);
  assert.match(auditLog, /actorId\s+String\?\s+@db\.Uuid/);
  for (const field of ["action", "entityType", "entityId"]) {
    assert.match(auditLog, new RegExp(`^\\s*${field}\\s+String\\s*$`, "m"));
  }
  assert.match(auditLog, /^\s*summary\s+String\?\s*$/m);
  assert.match(auditLog, /^\s*metadata\s+Json\?\s*$/m);
  assert.doesNotMatch(auditLog, /^\s*metadata\s+Json\?\s+@default/m);
  assert.match(auditLog, /^\s*correlationId\s+String\?\s*$/m);
  assert.match(auditLog, /occurredAt\s+DateTime\s+@default\(now\(\)\)/);
  assert.match(auditLog, /createdAt\s+DateTime\s+@default\(now\(\)\)/);
  assert.match(auditLog, /Append-only audit record/);
  assert.match(auditLog, /Retention is handled separately/);
});

test("AuditLog is append-only and excludes unapproved and sensitive fields", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const auditLog = block(schema, "model", "AuditLog");
  const forbiddenFields = [
    "productId", "productVersionId", "passportId", "qrCodeId", "documentId",
    "membershipId", "invitationId", "subscriptionId", "userId", "actorEmail",
    "actorName", "actorRole", "entityName", "entitySnapshot", "oldValue",
    "newValue", "before", "after", "changes", "diff", "requestBody",
    "responseBody", "requestHeaders", "authorizationHeader", "ipAddress",
    "ipHash", "userAgent", "rawUserAgent", "cookie", "sessionId", "visitorId",
    "fingerprint", "stackTrace", "errorMessage", "severity", "status",
    "archivedAt", "deletedAt", "updatedAt",
  ];

  for (const field of forbiddenFields) {
    assert.doesNotMatch(auditLog, new RegExp(`^\\s*${field}\\b`, "m"));
  }
  assert.doesNotMatch(
    auditLog,
    /^\s*(product|productVersion|passport|qrCode|document|membership|invitation|subscription|scanEvent)\b/m,
  );
});

test("AuditLog has only the canonical Organization and User relations", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const user = block(schema, "model", "User");
  const organization = block(schema, "model", "Organization");
  const auditLog = block(schema, "model", "AuditLog");

  assert.match(
    auditLog,
    /organization\s+Organization\s+@relation\("OrganizationAuditLogs", fields: \[organizationId\], references: \[id\], onDelete: Restrict, onUpdate: Cascade\)/,
  );
  assert.match(
    auditLog,
    /actor\s+User\?\s+@relation\("UserAuditLogs", fields: \[actorId\], references: \[id\], onDelete: SetNull, onUpdate: Cascade\)/,
  );
  assert.match(organization, /auditLogs\s+AuditLog\[\]\s+@relation\("OrganizationAuditLogs"\)/);
  assert.match(user, /auditLogs\s+AuditLog\[\]\s+@relation\("UserAuditLogs"\)/);
  assert.deepEqual(
    fieldNames(auditLog).filter((field) => ["organization", "actor"].includes(field)),
    ["organization", "actor"],
  );
});

test("AuditLog has exactly six approved indexes and no uniqueness", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const auditLog = block(schema, "model", "AuditLog");

  for (const index of [
    "organizationId, occurredAt",
    "organizationId, entityType, entityId, occurredAt",
    "organizationId, action, occurredAt",
    "actorId, occurredAt",
    "correlationId",
    "occurredAt",
  ]) {
    assert.match(auditLog, new RegExp(`@@index\\(\\[${index}\\]\\)`));
  }
  assert.equal([...auditLog.matchAll(/@@index\(/g)].length, 6);
  assert.doesNotMatch(auditLog, /@unique|@@unique/);
  assert.doesNotMatch(auditLog, /type:\s*Gin|ops:\s*Json/);
});

test("AuditLog migration creates only the approved table, indexes, and foreign keys", async () => {
  const migrationSql = await readPhaseMigration();
  const migrationLock = await readFile(new URL("migration_lock.toml", migrationsPath), "utf8");

  assert.match(migrationLock, /provider = "postgresql"/);
  assert.equal([...migrationSql.matchAll(/CREATE TYPE /g)].length, 0);
  assert.deepEqual(
    [...migrationSql.matchAll(/CREATE TABLE "(\w+)"/g)].map((match) => match[1]),
    ["AuditLog"],
  );
  for (const indexName of [
    "AuditLog_organizationId_occurredAt_idx",
    "AuditLog_organizationId_entityType_entityId_occurredAt_idx",
    "AuditLog_organizationId_action_occurredAt_idx",
    "AuditLog_actorId_occurredAt_idx",
    "AuditLog_correlationId_idx",
    "AuditLog_occurredAt_idx",
  ]) {
    assert.match(migrationSql, new RegExp(`CREATE INDEX "${indexName}"`));
  }
  assert.equal([...migrationSql.matchAll(/CREATE INDEX /g)].length, 6);
  assert.equal([...migrationSql.matchAll(/CREATE UNIQUE INDEX /g)].length, 0);
  assert.match(
    migrationSql,
    /ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY \("organizationId"\) REFERENCES "Organization"\("id"\) ON DELETE RESTRICT ON UPDATE CASCADE/,
  );
  assert.match(
    migrationSql,
    /ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY \("actorId"\) REFERENCES "User"\("id"\) ON DELETE SET NULL ON UPDATE CASCADE/,
  );
  assert.equal(
    [...migrationSql.matchAll(/ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_\w+_fkey"/g)].length,
    2,
  );
  assert.doesNotMatch(
    migrationSql,
    /\b(DROP|TRUNCATE|INSERT INTO|UPDATE .+ SET|DELETE FROM|CREATE FUNCTION|CREATE TRIGGER|CREATE POLICY|CREATE VIEW|CREATE MATERIALIZED VIEW|PARTITION BY)\b/,
  );
  assert.doesNotMatch(migrationSql, /ROW LEVEL SECURITY/);
  assert.doesNotMatch(
    migrationSql,
    /ALTER TABLE "(User|Organization|Membership|Invitation|Product|ProductVersion|ProductTranslation|ProductIdentifier|ProductMaterial|Document|ProductDocument|ProductImage|Passport|QRCode|ScanEvent)"/,
  );
});

test("AuditLog migration enforces all six approved checks", async () => {
  const migrationSql = await readPhaseMigration();

  assert.match(
    migrationSql,
    /CONSTRAINT "ck_audit_log_action_format"\s+CHECK \("action" = btrim\("action"\) AND char_length\("action"\) BETWEEN 3 AND 128 AND "action" ~ '\^\[A-Z\]\[A-Z0-9_\]\*\$'\)/,
  );
  assert.match(
    migrationSql,
    /CONSTRAINT "ck_audit_log_entity_type_format"\s+CHECK \("entityType" = btrim\("entityType"\) AND char_length\("entityType"\) BETWEEN 2 AND 96 AND "entityType" ~ '\^\[A-Z\]\[A-Z0-9_\]\*\$'\)/,
  );
  assert.match(
    migrationSql,
    /CONSTRAINT "ck_audit_log_entity_id_format"\s+CHECK \("entityId" = btrim\("entityId"\) AND char_length\("entityId"\) BETWEEN 1 AND 255\)/,
  );
  assert.match(
    migrationSql,
    /CONSTRAINT "ck_audit_log_summary_length"\s+CHECK \("summary" IS NULL OR char_length\("summary"\) BETWEEN 1 AND 500\)/,
  );
  assert.match(
    migrationSql,
    /CONSTRAINT "ck_audit_log_correlation_id_format"\s+CHECK \("correlationId" IS NULL OR \("correlationId" = btrim\("correlationId"\) AND char_length\("correlationId"\) BETWEEN 8 AND 128 AND "correlationId" ~ '\^\[A-Za-z0-9_\.:-\]\+\$'\)\)/,
  );
  assert.match(
    migrationSql,
    /CONSTRAINT "ck_audit_log_created_at_not_before_occurred_at"\s+CHECK \("createdAt" >= "occurredAt"\)/,
  );
  assert.equal([...migrationSql.matchAll(/\bCONSTRAINT "ck_audit_log_/g)].length, 6);
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
