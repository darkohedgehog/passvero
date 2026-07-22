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
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("_add_plan"))
    .map((entry) => entry.name);

  assert.equal(directories.length, 1, "Expected one add_plan migration");
  return readFile(new URL(`${directories[0]}/migration.sql`, migrationsPath), "utf8");
}

test("Phase 5A retains Plan and PlanStatus", async () => {
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
  assert.match(block(schema, "enum", "PlanStatus"), /^\s*DRAFT\s+ACTIVE\s+ARCHIVED\s*$/);
});

test("Plan contains exactly the approved fields, scalar types, and defaults", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const plan = block(schema, "model", "Plan");

  assert.deepEqual(fieldNames(plan), [
    "id",
    "name",
    "slug",
    "description",
    "status",
    "currencyCode",
    "monthlyPrice",
    "yearlyPrice",
    "maxProducts",
    "maxActivePassports",
    "maxMembers",
    "maxStorageBytes",
    "maxMonthlyScans",
    "features",
    "isPublic",
    "sortOrder",
    "archivedAt",
    "createdAt",
    "updatedAt",
    "subscriptions",
  ]);
  assert.match(plan, /id\s+String\s+@id\s+@default\(uuid\(\)\)\s+@db\.Uuid/);
  assert.match(plan, /^\s*name\s+String\s*$/m);
  assert.match(plan, /^\s*slug\s+String\s+@unique\s*$/m);
  assert.match(plan, /^\s*description\s+String\?\s*$/m);
  assert.match(plan, /status\s+PlanStatus\s+@default\(DRAFT\)/);
  assert.match(plan, /currencyCode\s+String\s+@default\("EUR"\)/);
  assert.match(plan, /monthlyPrice\s+Decimal\s+@db\.Decimal\(12, 2\)/);
  assert.match(plan, /yearlyPrice\s+Decimal\s+@db\.Decimal\(12, 2\)/);
  assert.match(plan, /isPublic\s+Boolean\s+@default\(true\)/);
  assert.match(plan, /sortOrder\s+Int\s+@default\(0\)/);
  assert.match(plan, /^\s*archivedAt\s+DateTime\?\s*$/m);
  assert.match(plan, /createdAt\s+DateTime\s+@default\(now\(\)\)/);
  assert.match(plan, /updatedAt\s+DateTime\s+@updatedAt/);
});

test("Plan limits and features use the approved nullable and JSON types", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const plan = block(schema, "model", "Plan");

  for (const field of ["maxProducts", "maxActivePassports", "maxMembers"]) {
    assert.match(plan, new RegExp(`^\\s*${field}\\s+Int\\?\\s*$`, "m"));
  }
  for (const field of ["maxStorageBytes", "maxMonthlyScans"]) {
    assert.match(plan, new RegExp(`^\\s*${field}\\s+BigInt\\?\\s*$`, "m"));
  }
  assert.match(plan, /^\s*features\s+Json\s*$/m);
  assert.doesNotMatch(plan, /^\s*features\s+Json\s+@default/m);
  assert.match(plan, /Nullable means unlimited or not enforced/);
  assert.match(plan, /Never store secrets, provider IDs,/);
  assert.match(plan, /usage counters, or organization-specific overrides/);
});

test("Plan is platform-owned and excludes subscription-specific billing fields", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const plan = block(schema, "model", "Plan");
  const forbiddenFields = [
    "organizationId", "userId", "subscriptionId", "externalId", "provider",
    "stripeProductId", "stripeMonthlyPriceId", "stripeYearlyPriceId",
    "monthlyPriceId", "yearlyPriceId", "priceCents", "interval",
    "billingInterval", "trialDays", "gracePeriodDays", "maxDocuments",
    "maxImages", "maxTranslations", "maxApiCalls", "scanRetentionDays",
    "storageGigabytes", "storageMegabytes", "customDomain", "metadata",
    "limits", "entitlements", "createdById", "updatedById", "archivedById",
    "deletedAt",
  ];

  for (const field of forbiddenFields) {
    assert.doesNotMatch(plan, new RegExp(`^\\s*${field}\\b`, "m"));
  }
  assert.match(plan, /subscriptions\s+Subscription\[\]\s+@relation\("PlanSubscriptions"\)/);
  assert.equal([...plan.matchAll(/@relation\(/g)].length, 1);
  assert.doesNotMatch(plan, /^\s*(organization|user|subscription|product|passport|qrCode|auditLog)\b/m);
});

test("Plan has only slug uniqueness and exactly four approved indexes", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const plan = block(schema, "model", "Plan");

  assert.equal([...plan.matchAll(/@unique/g)].length, 1);
  assert.match(plan, /^\s*slug\s+String\s+@unique\s*$/m);
  assert.doesNotMatch(plan, /@@unique/);
  for (const index of [
    "status, sortOrder",
    "isPublic, status, sortOrder",
    "createdAt",
    "archivedAt",
  ]) {
    assert.match(plan, new RegExp(`@@index\\(\\[${index}\\]\\)`));
  }
  assert.equal([...plan.matchAll(/@@index\(/g)].length, 4);
  assert.doesNotMatch(plan, /type:\s*Gin|ops:\s*Json/);
});

test("Plan migration creates only the approved enum, table, and indexes", async () => {
  const migrationSql = await readPhaseMigration();
  const migrationLock = await readFile(new URL("migration_lock.toml", migrationsPath), "utf8");

  assert.match(migrationLock, /provider = "postgresql"/);
  assert.deepEqual(
    [...migrationSql.matchAll(/CREATE TYPE "(\w+)"/g)].map((match) => match[1]),
    ["PlanStatus"],
  );
  assert.match(
    migrationSql,
    /CREATE TYPE "PlanStatus" AS ENUM \('DRAFT', 'ACTIVE', 'ARCHIVED'\)/,
  );
  assert.deepEqual(
    [...migrationSql.matchAll(/CREATE TABLE "(\w+)"/g)].map((match) => match[1]),
    ["Plan"],
  );
  for (const indexName of [
    "Plan_status_sortOrder_idx",
    "Plan_isPublic_status_sortOrder_idx",
    "Plan_createdAt_idx",
    "Plan_archivedAt_idx",
    "Plan_slug_key",
  ]) {
    assert.match(migrationSql, new RegExp(`CREATE (?:UNIQUE )?INDEX "${indexName}"`));
  }
  assert.equal([...migrationSql.matchAll(/CREATE INDEX /g)].length, 4);
  assert.equal([...migrationSql.matchAll(/CREATE UNIQUE INDEX /g)].length, 1);
  assert.doesNotMatch(migrationSql, /FOREIGN KEY|REFERENCES /);
  assert.doesNotMatch(
    migrationSql,
    /\b(DROP|TRUNCATE|INSERT INTO|UPDATE .+ SET|DELETE FROM|CREATE FUNCTION|CREATE TRIGGER|CREATE POLICY|CREATE VIEW|CREATE MATERIALIZED VIEW|PARTITION BY)\b/,
  );
  assert.doesNotMatch(migrationSql, /ROW LEVEL SECURITY/);
  assert.doesNotMatch(migrationSql, /CREATE TABLE "Subscription"|ALTER TABLE /);
});

test("Plan migration enforces identity, currency, price, and description checks", async () => {
  const migrationSql = await readPhaseMigration();

  assert.match(migrationSql, /CONSTRAINT "ck_plan_name_length"\s+CHECK \(char_length\("name"\) BETWEEN 1 AND 120\)/);
  assert.match(
    migrationSql,
    /CONSTRAINT "ck_plan_slug_format"\s+CHECK \("slug" = btrim\("slug"\) AND char_length\("slug"\) BETWEEN 2 AND 64 AND "slug" ~ '\^\[a-z0-9\]\+\(-\[a-z0-9\]\+\)\*\$'\)/,
  );
  assert.match(
    migrationSql,
    /CONSTRAINT "ck_plan_currency_code_format"\s+CHECK \("currencyCode" ~ '\^\[A-Z\]\{3\}\$'\)/,
  );
  assert.match(migrationSql, /CONSTRAINT "ck_plan_monthly_price_non_negative"\s+CHECK \("monthlyPrice" >= 0\)/);
  assert.match(migrationSql, /CONSTRAINT "ck_plan_yearly_price_non_negative"\s+CHECK \("yearlyPrice" >= 0\)/);
  assert.match(
    migrationSql,
    /CONSTRAINT "ck_plan_description_length"\s+CHECK \("description" IS NULL OR char_length\("description"\) BETWEEN 1 AND 1000\)/,
  );
});

test("Plan migration enforces limits, features, ordering, and archive consistency", async () => {
  const migrationSql = await readPhaseMigration();

  for (const [constraint, field] of [
    ["ck_plan_max_products_positive", "maxProducts"],
    ["ck_plan_max_active_passports_positive", "maxActivePassports"],
    ["ck_plan_max_members_positive", "maxMembers"],
    ["ck_plan_max_storage_bytes_positive", "maxStorageBytes"],
    ["ck_plan_max_monthly_scans_positive", "maxMonthlyScans"],
  ]) {
    assert.match(
      migrationSql,
      new RegExp(`CONSTRAINT "${constraint}"\\s+CHECK \\(\"${field}\" IS NULL OR \"${field}\" > 0\\)`),
    );
  }
  assert.match(
    migrationSql,
    /CONSTRAINT "ck_plan_features_object"\s+CHECK \(jsonb_typeof\("features"\) = 'object'\)/,
  );
  assert.match(
    migrationSql,
    /CONSTRAINT "ck_plan_sort_order_non_negative"\s+CHECK \("sortOrder" >= 0\)/,
  );
  assert.match(migrationSql, /CONSTRAINT "ck_plan_archived_at_consistency"\s+CHECK \(/);
  assert.match(
    migrationSql,
    /"status" = 'ARCHIVED'::"PlanStatus"\s+AND "archivedAt" IS NOT NULL/,
  );
  assert.match(
    migrationSql,
    /"status" IN \('DRAFT'::"PlanStatus", 'ACTIVE'::"PlanStatus"\)\s+AND "archivedAt" IS NULL/,
  );
  assert.equal([...migrationSql.matchAll(/\bCONSTRAINT "ck_plan_/g)].length, 14);
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
