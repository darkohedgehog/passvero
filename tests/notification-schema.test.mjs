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
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("_add_notification"))
    .map((entry) => entry.name);

  assert.equal(directories.length, 1, "Expected one add_notification migration");
  return readFile(new URL(`${directories[0]}/migration.sql`, migrationsPath), "utf8");
}

test("Phase 6A adds exactly Notification and its two approved enums", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const modelNames = [...schema.matchAll(/^model (\w+) \{/gm)].map((match) => match[1]);
  const enumNames = [...schema.matchAll(/^enum (\w+) \{/gm)].map((match) => match[1]);

  assert.deepEqual(modelNames.slice(-3, -2), ["Notification"]);
  assert.deepEqual(enumNames.slice(-5, -3), ["NotificationType", "NotificationStatus"]);
  assert.match(
    block(schema, "enum", "NotificationType"),
    /^\s*INFO\s+SUCCESS\s+WARNING\s+ERROR\s+ACTION_REQUIRED\s*$/,
  );
  assert.match(
    block(schema, "enum", "NotificationStatus"),
    /^\s*UNREAD\s+READ\s+DISMISSED\s+ARCHIVED\s*$/,
  );
  assert.doesNotMatch(schema, /^model Notification(?:Delivery|Preference)\b/m);
  assert.doesNotMatch(schema, /^enum NotificationChannel\b/m);
});

test("Notification contains exactly the approved fields, types, and defaults", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const notification = block(schema, "model", "Notification");

  assert.deepEqual(fieldNames(notification), [
    "id",
    "organizationId",
    "userId",
    "type",
    "status",
    "eventType",
    "title",
    "message",
    "actionUrl",
    "entityType",
    "entityId",
    "metadata",
    "readAt",
    "dismissedAt",
    "archivedAt",
    "expiresAt",
    "createdAt",
    "updatedAt",
    "organization",
    "user",
  ]);
  assert.match(notification, /id\s+String\s+@id\s+@default\(uuid\(\)\)\s+@db\.Uuid/);
  assert.match(notification, /^\s*organizationId\s+String\s+@db\.Uuid\s*$/m);
  assert.match(notification, /^\s*userId\s+String\?\s+@db\.Uuid\s*$/m);
  assert.match(notification, /^\s*type\s+NotificationType\s*$/m);
  assert.match(notification, /status\s+NotificationStatus\s+@default\(UNREAD\)/);
  for (const field of ["eventType", "title", "message"]) {
    assert.match(notification, new RegExp(`^\\s*${field}\\s+String\\s*$`, "m"));
  }
  for (const field of ["actionUrl", "entityType", "entityId"]) {
    assert.match(notification, new RegExp(`^\\s*${field}\\s+String\\?\\s*$`, "m"));
  }
  for (const field of ["readAt", "dismissedAt", "archivedAt", "expiresAt"]) {
    assert.match(notification, new RegExp(`^\\s*${field}\\s+DateTime\\?\\s*$`, "m"));
  }
  assert.match(notification, /^\s*metadata\s+Json\?\s*$/m);
  assert.doesNotMatch(notification, /^\s*metadata\s+Json\?\s+@default/m);
  assert.match(notification, /createdAt\s+DateTime\s+@default\(now\(\)\)/);
  assert.match(notification, /updatedAt\s+DateTime\s+@updatedAt/);
});

test("Notification has only the canonical Organization and optional User relations", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const notification = block(schema, "model", "Notification");
  const organization = block(schema, "model", "Organization");
  const user = block(schema, "model", "User");

  assert.match(
    notification,
    /organization\s+Organization\s+@relation\("OrganizationNotifications", fields: \[organizationId\], references: \[id\], onDelete: Restrict, onUpdate: Cascade\)/,
  );
  assert.match(
    notification,
    /user\s+User\?\s+@relation\("UserNotifications", fields: \[userId\], references: \[id\], onDelete: SetNull, onUpdate: Cascade\)/,
  );
  assert.match(
    organization,
    /notifications\s+Notification\[\]\s+@relation\("OrganizationNotifications"\)/,
  );
  assert.match(user, /notifications\s+Notification\[\]\s+@relation\("UserNotifications"\)/);
  assert.equal([...notification.matchAll(/@relation\(/g)].length, 2);
  assert.doesNotMatch(
    notification,
    /^\s*(product|productVersion|passport|document|qrCode|subscription|auditLog|scanEvent|backgroundJob|membership)\b/m,
  );
});

test("Notification excludes delivery, provider, audit, and lifecycle infrastructure fields", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const notification = block(schema, "model", "Notification");
  const forbiddenFields = [
    "emailAddress", "phoneNumber", "deliveryChannel", "provider", "providerMessageId",
    "externalId", "subject", "html", "textBody", "emailBody", "pushPayload",
    "smsBody", "sentAt", "deliveredAt", "failedAt", "openedAt", "retryCount",
    "failureCode", "failureReason", "scheduledAt", "createdById", "updatedById",
    "deletedAt", "correlationId", "requestId", "tenantId", "idempotencyKey", "locale",
  ];

  for (const field of forbiddenFields) {
    assert.doesNotMatch(notification, new RegExp(`^\\s*${field}\\b`, "m"));
  }
});

test("Notification has no uniqueness and exactly the six approved indexes", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const notification = block(schema, "model", "Notification");
  const indexes = [
    "organizationId, status, createdAt",
    "userId, status, createdAt",
    "organizationId, eventType, createdAt",
    "organizationId, entityType, entityId, createdAt",
    "expiresAt",
    "createdAt",
  ];

  assert.equal([...notification.matchAll(/@unique|@@unique/g)].length, 0);
  for (const index of indexes) {
    assert.match(notification, new RegExp(`@@index\\(\\[${index}\\]\\)`));
  }
  assert.equal([...notification.matchAll(/@@index\(/g)].length, 6);
  assert.doesNotMatch(notification, /type:\s*Gin|ops:\s*Json/);
});

test("Notification migration creates only approved enums, table, indexes, keys, and checks", async () => {
  const migrationSql = await readPhaseMigration();
  const migrationLock = await readFile(new URL("migration_lock.toml", migrationsPath), "utf8");

  assert.match(migrationLock, /provider = "postgresql"/);
  assert.deepEqual(
    [...migrationSql.matchAll(/CREATE TYPE "(\w+)"/g)].map((match) => match[1]),
    ["NotificationType", "NotificationStatus"],
  );
  assert.match(
    migrationSql,
    /CREATE TYPE "NotificationType" AS ENUM \('INFO', 'SUCCESS', 'WARNING', 'ERROR', 'ACTION_REQUIRED'\)/,
  );
  assert.match(
    migrationSql,
    /CREATE TYPE "NotificationStatus" AS ENUM \('UNREAD', 'READ', 'DISMISSED', 'ARCHIVED'\)/,
  );
  assert.deepEqual(
    [...migrationSql.matchAll(/CREATE TABLE "(\w+)"/g)].map((match) => match[1]),
    ["Notification"],
  );
  const indexNames = [
    "Notification_organizationId_status_createdAt_idx",
    "Notification_userId_status_createdAt_idx",
    "Notification_organizationId_eventType_createdAt_idx",
    "Notification_organizationId_entityType_entityId_createdAt_idx",
    "Notification_expiresAt_idx",
    "Notification_createdAt_idx",
  ];
  for (const indexName of indexNames) {
    assert.match(migrationSql, new RegExp(`CREATE INDEX "${indexName}"`));
  }
  assert.equal([...migrationSql.matchAll(/CREATE INDEX /g)].length, 6);
  assert.equal([...migrationSql.matchAll(/CREATE UNIQUE INDEX /g)].length, 0);
  assert.match(
    migrationSql,
    /ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY \("organizationId"\) REFERENCES "Organization"\("id"\) ON DELETE RESTRICT ON UPDATE CASCADE/,
  );
  assert.match(
    migrationSql,
    /ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY \("userId"\) REFERENCES "User"\("id"\) ON DELETE SET NULL ON UPDATE CASCADE/,
  );
  assert.equal([...migrationSql.matchAll(/FOREIGN KEY/g)].length, 2);
  assert.equal([...migrationSql.matchAll(/\bCONSTRAINT "ck_notification_/g)].length, 9);
  assert.doesNotMatch(
    migrationSql,
    /\b(DROP|TRUNCATE|INSERT INTO|UPDATE .+ SET|DELETE FROM|CREATE FUNCTION|CREATE TRIGGER|CREATE POLICY|CREATE VIEW|CREATE MATERIALIZED VIEW|PARTITION BY)\b/,
  );
  assert.doesNotMatch(migrationSql, /ROW LEVEL SECURITY|NotificationDelivery|NotificationPreference/);
  assert.doesNotMatch(migrationSql, /ALTER TABLE "(?!Notification")/);
});

test("Notification migration enforces formats, lengths, and paired logical references", async () => {
  const migrationSql = await readPhaseMigration();

  assert.match(
    migrationSql,
    /CONSTRAINT "ck_notification_event_type_format"\s+CHECK \("eventType" = btrim\("eventType"\) AND char_length\("eventType"\) BETWEEN 3 AND 128 AND "eventType" ~ '\^\[A-Z\]\[A-Z0-9_\]\*\$'\)/,
  );
  assert.match(migrationSql, /CONSTRAINT "ck_notification_title_length"\s+CHECK \(char_length\("title"\) BETWEEN 1 AND 200\)/);
  assert.match(migrationSql, /CONSTRAINT "ck_notification_message_length"\s+CHECK \(char_length\("message"\) BETWEEN 1 AND 4000\)/);
  assert.match(migrationSql, /CONSTRAINT "ck_notification_action_url_format"\s+CHECK \(/);
  assert.match(migrationSql, /"actionUrl" LIKE '\/%' OR "actionUrl" LIKE 'https:\/\/%'/);
  assert.match(migrationSql, /CONSTRAINT "ck_notification_entity_reference_pair"\s+CHECK \(/);
  assert.match(migrationSql, /"entityType" IS NULL AND "entityId" IS NULL/);
  assert.match(migrationSql, /"entityType" IS NOT NULL AND "entityId" IS NOT NULL/);
  assert.match(migrationSql, /CONSTRAINT "ck_notification_entity_type_format"\s+CHECK \(/);
  assert.match(migrationSql, /char_length\("entityType"\) BETWEEN 2 AND 96/);
  assert.match(migrationSql, /"entityType" ~ '\^\[A-Z\]\[A-Z0-9_\]\*\$'/);
  assert.match(migrationSql, /CONSTRAINT "ck_notification_entity_id_format"\s+CHECK \(/);
  assert.match(migrationSql, /char_length\("entityId"\) BETWEEN 1 AND 255/);
});

test("Notification migration enforces status timestamp consistency", async () => {
  const migrationSql = await readPhaseMigration();

  assert.match(migrationSql, /CONSTRAINT "ck_notification_status_timestamps"\s+CHECK \(/);
  assert.match(migrationSql, /"status" = 'UNREAD'::"NotificationStatus"[\s\S]*?"readAt" IS NULL[\s\S]*?"dismissedAt" IS NULL[\s\S]*?"archivedAt" IS NULL/);
  assert.match(migrationSql, /"status" = 'READ'::"NotificationStatus"[\s\S]*?"readAt" IS NOT NULL[\s\S]*?"dismissedAt" IS NULL[\s\S]*?"archivedAt" IS NULL/);
  assert.match(migrationSql, /"status" = 'DISMISSED'::"NotificationStatus"[\s\S]*?"dismissedAt" IS NOT NULL[\s\S]*?"archivedAt" IS NULL/);
  assert.match(migrationSql, /"status" = 'ARCHIVED'::"NotificationStatus"[\s\S]*?"archivedAt" IS NOT NULL/);
});

test("Notification migration prevents lifecycle and expiry timestamps before creation", async () => {
  const migrationSql = await readPhaseMigration();

  assert.match(migrationSql, /CONSTRAINT "ck_notification_timestamp_order"\s+CHECK \(/);
  for (const field of ["readAt", "dismissedAt", "archivedAt", "expiresAt"]) {
    assert.match(
      migrationSql,
      new RegExp(`"${field}" IS NULL OR "${field}" >= "createdAt"`),
    );
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
