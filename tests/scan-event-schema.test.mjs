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
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("_add_scan_event"))
    .map((entry) => entry.name);

  assert.equal(directories.length, 1, "Expected one add_scan_event migration");
  return readFile(new URL(`${directories[0]}/migration.sql`, migrationsPath), "utf8");
}

test("Phase 3 adds only ScanEvent and the two approved enums", async () => {
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
  assert.match(
    block(schema, "enum", "ScanDeviceType"),
    /^\s*UNKNOWN\s+DESKTOP\s+MOBILE\s+TABLET\s+BOT\s*$/,
  );
  assert.match(
    block(schema, "enum", "ScanReferrerType"),
    /^\s*DIRECT\s+SEARCH\s+SOCIAL\s+EMAIL\s+MESSAGING\s+OTHER\s+UNKNOWN\s*$/,
  );
});

test("ScanEvent contains exactly the approved fields, types, and defaults", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const scanEvent = block(schema, "model", "ScanEvent");

  assert.deepEqual(fieldNames(scanEvent), [
    "id",
    "qrCodeId",
    "scannedAt",
    "deviceType",
    "referrerType",
    "isBot",
    "countryCode",
    "region",
    "browser",
    "operatingSystem",
    "language",
    "referrerHost",
    "createdAt",
    "qrCode",
  ]);
  assert.match(scanEvent, /id\s+String\s+@id\s+@default\(uuid\(\)\)\s+@db\.Uuid/);
  assert.match(scanEvent, /qrCodeId\s+String\s+@db\.Uuid/);
  assert.match(scanEvent, /scannedAt\s+DateTime\s+@default\(now\(\)\)/);
  assert.match(scanEvent, /deviceType\s+ScanDeviceType\s+@default\(UNKNOWN\)/);
  assert.match(scanEvent, /referrerType\s+ScanReferrerType\s+@default\(UNKNOWN\)/);
  assert.match(scanEvent, /isBot\s+Boolean\s+@default\(false\)/);
  assert.match(scanEvent, /createdAt\s+DateTime\s+@default\(now\(\)\)/);
  assert.doesNotMatch(scanEvent, /^\s*updatedAt\b/m);
  assert.match(scanEvent, /Append-only privacy-minimized analytics event/);
  assert.match(scanEvent, /Retention is handled separately/);
});

test("ScanEvent optional analytics fields are nullable Strings", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const scanEvent = block(schema, "model", "ScanEvent");

  for (const field of [
    "countryCode",
    "region",
    "browser",
    "operatingSystem",
    "language",
    "referrerHost",
  ]) {
    assert.match(scanEvent, new RegExp(`^\\s*${field}\\s+String\\?\\s*$`, "m"));
  }
});

test("ScanEvent belongs only to QRCode through QRCodeScanEvents", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const qrCode = block(schema, "model", "QRCode");
  const scanEvent = block(schema, "model", "ScanEvent");

  assert.match(
    scanEvent,
    /qrCode\s+QRCode\s+@relation\("QRCodeScanEvents", fields: \[qrCodeId\], references: \[id\], onDelete: Cascade, onUpdate: Cascade\)/,
  );
  assert.match(qrCode, /scanEvents\s+ScanEvent\[\]\s+@relation\("QRCodeScanEvents"\)/);
  assert.deepEqual(
    fieldNames(scanEvent).filter((field) =>
      ![
        "id",
        "qrCodeId",
        "scannedAt",
        "deviceType",
        "referrerType",
        "isBot",
        "countryCode",
        "region",
        "browser",
        "operatingSystem",
        "language",
        "referrerHost",
        "createdAt",
      ].includes(field)
    ),
    ["qrCode"],
  );
});

test("ScanEvent has exactly six approved indexes and no uniqueness", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const scanEvent = block(schema, "model", "ScanEvent");

  for (const index of [
    "qrCodeId, scannedAt",
    "scannedAt",
    "qrCodeId, isBot, scannedAt",
    "qrCodeId, countryCode, scannedAt",
    "qrCodeId, deviceType, scannedAt",
    "qrCodeId, referrerType, scannedAt",
  ]) {
    assert.match(scanEvent, new RegExp(`@@index\\(\\[${index}\\]\\)`));
  }
  assert.equal([...scanEvent.matchAll(/@@index\(/g)].length, 6);
  assert.doesNotMatch(scanEvent, /@unique|@@unique/);
});

test("ScanEvent excludes direct ownership, identity, precise location, and raw request data", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const scanEvent = block(schema, "model", "ScanEvent");
  const forbiddenFields = [
    "organizationId",
    "productId",
    "productVersionId",
    "passportId",
    "userId",
    "membershipId",
    "sessionId",
    "visitorId",
    "anonymousId",
    "ipAddress",
    "ip",
    "ipHash",
    "subnet",
    "latitude",
    "longitude",
    "coordinates",
    "city",
    "postalCode",
    "street",
    "rawUserAgent",
    "userAgent",
    "rawReferrer",
    "referrerUrl",
    "pageUrl",
    "targetUrl",
    "requestHeaders",
    "cookieId",
    "fingerprint",
    "deviceId",
    "campaignId",
    "metadata",
    "scanCount",
    "firstSeenAt",
    "lastSeenAt",
    "status",
    "updatedAt",
    "archivedAt",
    "deletedAt",
  ];

  for (const field of forbiddenFields) {
    assert.doesNotMatch(scanEvent, new RegExp(`^\\s*${field}\\b`, "m"));
  }
  assert.doesNotMatch(scanEvent, /\bJson\b/);
  assert.doesNotMatch(
    scanEvent,
    /^\s*(organization|product|productVersion|passport|user|membership|session)\b/m,
  );
});

test("ScanEvent migration creates only approved enums, table, indexes, and QRCode FK", async () => {
  const migrationSql = await readPhaseMigration();
  const migrationLock = await readFile(new URL("migration_lock.toml", migrationsPath), "utf8");

  assert.match(migrationLock, /provider = "postgresql"/);
  assert.deepEqual(
    [...migrationSql.matchAll(/CREATE TYPE "(\w+)"/g)].map((match) => match[1]),
    ["ScanDeviceType", "ScanReferrerType"],
  );
  assert.match(
    migrationSql,
    /CREATE TYPE "ScanDeviceType" AS ENUM \('UNKNOWN', 'DESKTOP', 'MOBILE', 'TABLET', 'BOT'\)/,
  );
  assert.match(
    migrationSql,
    /CREATE TYPE "ScanReferrerType" AS ENUM \('DIRECT', 'SEARCH', 'SOCIAL', 'EMAIL', 'MESSAGING', 'OTHER', 'UNKNOWN'\)/,
  );
  assert.deepEqual(
    [...migrationSql.matchAll(/CREATE TABLE "(\w+)"/g)].map((match) => match[1]),
    ["ScanEvent"],
  );

  for (const indexName of [
    "ScanEvent_qrCodeId_scannedAt_idx",
    "ScanEvent_scannedAt_idx",
    "ScanEvent_qrCodeId_isBot_scannedAt_idx",
    "ScanEvent_qrCodeId_countryCode_scannedAt_idx",
    "ScanEvent_qrCodeId_deviceType_scannedAt_idx",
    "ScanEvent_qrCodeId_referrerType_scannedAt_idx",
  ]) {
    assert.match(migrationSql, new RegExp(`CREATE INDEX "${indexName}"`));
  }
  assert.equal([...migrationSql.matchAll(/CREATE INDEX /g)].length, 6);
  assert.equal([...migrationSql.matchAll(/CREATE UNIQUE INDEX /g)].length, 0);
  assert.match(
    migrationSql,
    /ALTER TABLE "ScanEvent" ADD CONSTRAINT "ScanEvent_qrCodeId_fkey" FOREIGN KEY \("qrCodeId"\) REFERENCES "QRCode"\("id"\) ON DELETE CASCADE ON UPDATE CASCADE/,
  );
  assert.equal(
    [...migrationSql.matchAll(/ALTER TABLE "ScanEvent" ADD CONSTRAINT "ScanEvent_\w+_fkey"/g)].length,
    1,
  );
  assert.doesNotMatch(
    migrationSql,
    /\b(DROP|TRUNCATE|INSERT INTO|UPDATE .+ SET|DELETE FROM|CREATE FUNCTION|CREATE TRIGGER|CREATE POLICY|CREATE VIEW|CREATE MATERIALIZED VIEW|PARTITION BY)\b/,
  );
  assert.doesNotMatch(migrationSql, /ROW LEVEL SECURITY/);
  assert.doesNotMatch(
    migrationSql,
    /ALTER TABLE "(User|Organization|Membership|Invitation|Product|ProductVersion|ProductTranslation|ProductIdentifier|ProductMaterial|Document|ProductDocument|ProductImage|Passport|QRCode)"/,
  );
});

test("ScanEvent migration enforces all five privacy and consistency checks", async () => {
  const migrationSql = await readPhaseMigration();

  assert.match(
    migrationSql,
    /CONSTRAINT "ck_scan_event_country_code_format"\s+CHECK \("countryCode" IS NULL OR "countryCode" ~ '\^\[A-Z\]\{2\}\$'\)/,
  );
  assert.match(
    migrationSql,
    /CONSTRAINT "ck_scan_event_language_format"\s+CHECK \("language" IS NULL OR "language" ~ '\^\[a-z\]\{2,3\}\(-\[A-Z\]\{2\}\)\?\$'\)/,
  );
  assert.match(
    migrationSql,
    /CONSTRAINT "ck_scan_event_referrer_host_format"\s+CHECK \("referrerHost" IS NULL OR \(char_length\("referrerHost"\) BETWEEN 1 AND 253 AND "referrerHost" !~ '\[\[:space:\]\/\?#@\]'\)\)/,
  );
  assert.match(
    migrationSql,
    /CONSTRAINT "ck_scan_event_bot_consistency"\s+CHECK \(\("deviceType" = 'BOT'::"ScanDeviceType" AND "isBot" = true\) OR \("deviceType" <> 'BOT'::"ScanDeviceType" AND "isBot" = false\)\)/,
  );
  assert.match(
    migrationSql,
    /CONSTRAINT "ck_scan_event_created_at_not_before_scanned_at"\s+CHECK \("createdAt" >= "scannedAt"\)/,
  );
  assert.equal([...migrationSql.matchAll(/\bCONSTRAINT "ck_scan_event_/g)].length, 5);
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
