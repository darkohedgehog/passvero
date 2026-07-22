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
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("_add_subscription"))
    .map((entry) => entry.name);

  assert.equal(directories.length, 1, "Expected one add_subscription migration");
  return readFile(new URL(`${directories[0]}/migration.sql`, migrationsPath), "utf8");
}

test("Phase 5B adds only Subscription and its two approved enums", async () => {
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
  assert.match(
    block(schema, "enum", "SubscriptionStatus"),
    /^\s*TRIAL\s+ACTIVE\s+PAST_DUE\s+CANCELED\s+EXPIRED\s*$/,
  );
  assert.match(block(schema, "enum", "BillingProvider"), /^\s*STRIPE\s+MANUAL\s*$/);
});

test("Subscription contains exactly the approved fields, types, and defaults", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const subscription = block(schema, "model", "Subscription");

  assert.deepEqual(fieldNames(subscription), [
    "id",
    "organizationId",
    "planId",
    "status",
    "billingProvider",
    "currentPeriodStart",
    "currentPeriodEnd",
    "cancelAtPeriodEnd",
    "canceledAt",
    "externalCustomerId",
    "externalSubscriptionId",
    "providerConfigurationKey",
    "createdAt",
    "updatedAt",
    "organization",
    "plan",
  ]);
  assert.match(subscription, /id\s+String\s+@id\s+@default\(uuid\(\)\)\s+@db\.Uuid/);
  assert.match(subscription, /organizationId\s+String\s+@unique\s+@db\.Uuid/);
  assert.match(subscription, /planId\s+String\s+@db\.Uuid/);
  assert.match(subscription, /status\s+SubscriptionStatus\s+@default\(TRIAL\)/);
  assert.match(subscription, /^\s*billingProvider\s+BillingProvider\s*$/m);
  assert.match(subscription, /^\s*currentPeriodStart\s+DateTime\s*$/m);
  assert.match(subscription, /^\s*currentPeriodEnd\s+DateTime\s*$/m);
  assert.match(subscription, /cancelAtPeriodEnd\s+Boolean\s+@default\(false\)/);
  assert.match(subscription, /^\s*canceledAt\s+DateTime\?\s*$/m);
  assert.match(subscription, /createdAt\s+DateTime\s+@default\(now\(\)\)/);
  assert.match(subscription, /updatedAt\s+DateTime\s+@updatedAt/);
});

test("provider identifiers are nullable and Plan configuration is not duplicated", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const subscription = block(schema, "model", "Subscription");

  for (const field of [
    "externalCustomerId",
    "externalSubscriptionId",
    "providerConfigurationKey",
  ]) {
    assert.match(subscription, new RegExp(`^\\s*${field}\\s+String\\?\\s*$`, "m"));
    assert.doesNotMatch(subscription, new RegExp(`^\\s*${field}\\s+String\\?\\s+@unique`, "m"));
  }
  for (const forbidden of [
    "monthlyPrice", "yearlyPrice", "currencyCode", "features", "maxProducts",
    "maxActivePassports", "maxMembers", "maxStorageBytes", "maxMonthlyScans",
    "trialEndsAt", "renewalCount", "paymentFailures", "invoiceId", "priceId",
    "couponId", "discount", "seatCount", "usage", "metadata", "providerPayload",
    "webhookPayload", "deletedAt", "archivedAt", "createdById", "updatedById",
  ]) {
    assert.doesNotMatch(subscription, new RegExp(`^\\s*${forbidden}\\b`, "m"));
  }
  assert.doesNotMatch(subscription, /\bJson\b/);
});

test("Subscription uses the canonical Organization and Plan relations", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const organization = block(schema, "model", "Organization");
  const plan = block(schema, "model", "Plan");
  const subscription = block(schema, "model", "Subscription");

  assert.match(
    subscription,
    /organization\s+Organization\s+@relation\("OrganizationSubscription", fields: \[organizationId\], references: \[id\], onDelete: Restrict, onUpdate: Cascade\)/,
  );
  assert.match(
    subscription,
    /plan\s+Plan\s+@relation\("PlanSubscriptions", fields: \[planId\], references: \[id\], onDelete: Restrict, onUpdate: Cascade\)/,
  );
  assert.match(
    organization,
    /subscription\s+Subscription\?\s+@relation\("OrganizationSubscription"\)/,
  );
  assert.match(plan, /subscriptions\s+Subscription\[\]\s+@relation\("PlanSubscriptions"\)/);
});

test("Subscription has only organization uniqueness and four approved indexes", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const subscription = block(schema, "model", "Subscription");

  assert.equal([...subscription.matchAll(/@unique/g)].length, 1);
  assert.match(subscription, /^\s*organizationId\s+String\s+@unique\s+@db\.Uuid\s*$/m);
  assert.doesNotMatch(subscription, /@@unique/);
  for (const index of [
    "status",
    "planId, status",
    "billingProvider",
    "currentPeriodEnd",
  ]) {
    assert.match(subscription, new RegExp(`@@index\\(\\[${index}\\]\\)`));
  }
  assert.equal([...subscription.matchAll(/@@index\(/g)].length, 4);
});

test("Subscription migration creates only approved enums, table, indexes, and foreign keys", async () => {
  const migrationSql = await readPhaseMigration();
  const migrationLock = await readFile(new URL("migration_lock.toml", migrationsPath), "utf8");

  assert.match(migrationLock, /provider = "postgresql"/);
  assert.deepEqual(
    [...migrationSql.matchAll(/CREATE TYPE "(\w+)"/g)].map((match) => match[1]),
    ["SubscriptionStatus", "BillingProvider"],
  );
  assert.match(
    migrationSql,
    /CREATE TYPE "SubscriptionStatus" AS ENUM \('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED'\)/,
  );
  assert.match(migrationSql, /CREATE TYPE "BillingProvider" AS ENUM \('STRIPE', 'MANUAL'\)/);
  assert.deepEqual(
    [...migrationSql.matchAll(/CREATE TABLE "(\w+)"/g)].map((match) => match[1]),
    ["Subscription"],
  );
  for (const indexName of [
    "Subscription_status_idx",
    "Subscription_planId_status_idx",
    "Subscription_billingProvider_idx",
    "Subscription_currentPeriodEnd_idx",
  ]) {
    assert.match(migrationSql, new RegExp(`CREATE INDEX "${indexName}"`));
  }
  assert.equal([...migrationSql.matchAll(/CREATE INDEX /g)].length, 4);
  assert.match(migrationSql, /CREATE UNIQUE INDEX "Subscription_organizationId_key"/);
  assert.equal([...migrationSql.matchAll(/CREATE UNIQUE INDEX /g)].length, 1);
  assert.match(
    migrationSql,
    /ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY \("organizationId"\) REFERENCES "Organization"\("id"\) ON DELETE RESTRICT ON UPDATE CASCADE/,
  );
  assert.match(
    migrationSql,
    /ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY \("planId"\) REFERENCES "Plan"\("id"\) ON DELETE RESTRICT ON UPDATE CASCADE/,
  );
  assert.equal([...migrationSql.matchAll(/FOREIGN KEY/g)].length, 2);
  assert.doesNotMatch(
    migrationSql,
    /\b(DROP|TRUNCATE|INSERT INTO|UPDATE .+ SET|DELETE FROM|CREATE FUNCTION|CREATE TRIGGER|CREATE POLICY|CREATE VIEW|CREATE MATERIALIZED VIEW|PARTITION BY)\b/,
  );
  assert.doesNotMatch(migrationSql, /ROW LEVEL SECURITY/);
  assert.doesNotMatch(migrationSql, /ALTER TABLE "(?!Subscription")/);
});

test("Subscription migration retains period and manual-provider consistency checks", async () => {
  const migrationSql = await readPhaseMigration();

  assert.match(
    migrationSql,
    /CONSTRAINT "ck_subscription_period_order"\s+CHECK \("currentPeriodEnd" >= "currentPeriodStart"\)/,
  );
  assert.match(migrationSql, /CONSTRAINT "ck_subscription_manual_provider"\s+CHECK \(/);
  assert.match(migrationSql, /"billingProvider" <> 'MANUAL'::"BillingProvider"/);
  for (const field of [
    "externalCustomerId",
    "externalSubscriptionId",
    "providerConfigurationKey",
  ]) {
    assert.match(migrationSql, new RegExp(`"${field}" IS NULL`));
  }
  assert.equal([...migrationSql.matchAll(/\bCONSTRAINT "ck_subscription_/g)].length, 4);
});

test("TRIAL, ACTIVE, and PAST_DUE allow scheduled cancellation without canceledAt", async () => {
  const migrationSql = await readPhaseMigration();

  assert.match(
    migrationSql,
    /CONSTRAINT "ck_subscription_cancellation"\s+CHECK \(\s*"status" NOT IN \(\s*'CANCELED'::"SubscriptionStatus",\s*'EXPIRED'::"SubscriptionStatus"\s*\)\s*OR "cancelAtPeriodEnd" = false\s*\)/,
  );
  assert.match(
    migrationSql,
    /"status" IN \(\s*'TRIAL'::"SubscriptionStatus",\s*'ACTIVE'::"SubscriptionStatus",\s*'PAST_DUE'::"SubscriptionStatus"\s*\)\s*AND "canceledAt" IS NULL/,
  );
  assert.doesNotMatch(
    migrationSql,
    /"cancelAtPeriodEnd" = false OR "canceledAt" IS NOT NULL/,
  );
});

test("CANCELED and EXPIRED require canceledAt and forbid future cancellation", async () => {
  const migrationSql = await readPhaseMigration();

  assert.match(migrationSql, /CONSTRAINT "ck_subscription_status_consistency"\s+CHECK \(/);
  assert.match(
    migrationSql,
    /"status" IN \(\s*'CANCELED'::"SubscriptionStatus",\s*'EXPIRED'::"SubscriptionStatus"\s*\)\s*AND "canceledAt" IS NOT NULL/,
  );
  assert.match(
    migrationSql,
    /"status" NOT IN \(\s*'CANCELED'::"SubscriptionStatus",\s*'EXPIRED'::"SubscriptionStatus"\s*\)\s*OR "cancelAtPeriodEnd" = false/,
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
    ["20260720184244_add_product_document", "777c2d4ccb60599235013e76868673a3b1298fe73b7a8147cb7c758af8288c74"],
    ["20260720190323_add_product_image", "617932a5b88328541ca656b3123e66789772513a0ee67b5ebff97e48735e4525"],
    ["20260721163104_add_qr_code", "2f1174adc82388e34225f29df56863e601c929c7a7ef2bb9749a63ae170c8dae"],
    ["20260721173458_add_scan_event", "89e069a2e5e53c517169da6f598480e511a7253f66b738236aa643cedc9154d0"],
    ["20260721180144_add_audit_log", "187195dc4f664e1e66f30978da4fd39a733b866c6602ba088b78863a992e4685"],
    ["20260721182339_add_plan", "402ebb2d4fd11bf08201b080ae72fe77bd1464c9a86a0aa2f514edfb40c56761"],
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
