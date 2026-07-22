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
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("_add_background_job"))
    .map((entry) => entry.name);

  assert.equal(directories.length, 1, "Expected one add_background_job migration");
  return readFile(new URL(`${directories[0]}/migration.sql`, migrationsPath), "utf8");
}

test("Phase 6C adds exactly BackgroundJob and its two approved enums", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const modelNames = [...schema.matchAll(/^model (\w+) \{/gm)].map((match) => match[1]);
  const enumNames = [...schema.matchAll(/^enum (\w+) \{/gm)].map((match) => match[1]);

  assert.deepEqual(modelNames.slice(-1), ["BackgroundJob"]);
  assert.deepEqual(enumNames.slice(-2), ["BackgroundJobScope", "BackgroundJobStatus"]);
  assert.match(block(schema, "enum", "BackgroundJobScope"), /^\s*PLATFORM\s+ORGANIZATION\s*$/);
  assert.match(
    block(schema, "enum", "BackgroundJobStatus"),
    /^\s*QUEUED\s+RUNNING\s+SUCCEEDED\s+FAILED\s+CANCELED\s*$/,
  );
  assert.doesNotMatch(schema, /^enum (?:BackgroundJobType|JobQueue|JobType|Priority)\b/m);
});

test("BackgroundJob contains exactly the approved fields, types, and defaults", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const job = block(schema, "model", "BackgroundJob");

  assert.deepEqual(fieldNames(job), [
    "id", "scope", "organizationId", "queue", "jobType", "status", "priority",
    "attemptCount", "maxAttempts", "scheduledAt", "payload", "result", "entityType",
    "entityId", "deduplicationKey", "correlationId", "lockedAt", "lockOwner",
    "startedAt", "completedAt", "failedAt", "canceledAt", "lastErrorCode",
    "lastErrorSummary", "createdAt", "updatedAt", "organization",
  ]);
  assert.match(job, /id\s+String\s+@id\s+@default\(uuid\(\)\)\s+@db\.Uuid/);
  assert.match(job, /^\s*scope\s+BackgroundJobScope\s*$/m);
  assert.match(job, /^\s*organizationId\s+String\?\s+@db\.Uuid\s*$/m);
  for (const field of ["queue", "jobType"]) {
    assert.match(job, new RegExp(`^\\s*${field}\\s+String\\s*$`, "m"));
  }
  assert.match(job, /status\s+BackgroundJobStatus\s+@default\(QUEUED\)/);
  assert.match(job, /priority\s+Int\s+@default\(0\)/);
  assert.match(job, /attemptCount\s+Int\s+@default\(0\)/);
  assert.match(job, /^\s*maxAttempts\s+Int\s*$/m);
  assert.match(job, /^\s*scheduledAt\s+DateTime\s*$/m);
  for (const field of ["payload", "result"]) {
    assert.match(job, new RegExp(`^\\s*${field}\\s+Json\\?\\s*$`, "m"));
    assert.doesNotMatch(job, new RegExp(`^\\s*${field}\\s+Json\\?\\s+@default`, "m"));
  }
  for (const field of ["entityType", "entityId", "deduplicationKey", "correlationId", "lockOwner", "lastErrorCode", "lastErrorSummary"]) {
    assert.match(job, new RegExp(`^\\s*${field}\\s+String\\?\\s*$`, "m"));
  }
  for (const field of ["lockedAt", "startedAt", "completedAt", "failedAt", "canceledAt"]) {
    assert.match(job, new RegExp(`^\\s*${field}\\s+DateTime\\?\\s*$`, "m"));
  }
  assert.match(job, /createdAt\s+DateTime\s+@default\(now\(\)\)/);
  assert.match(job, /updatedAt\s+DateTime\s+@updatedAt/);
});

test("BackgroundJob has only the optional Organization relation", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const job = block(schema, "model", "BackgroundJob");
  const organization = block(schema, "model", "Organization");

  assert.match(
    job,
    /organization\s+Organization\?\s+@relation\("OrganizationBackgroundJobs", fields: \[organizationId\], references: \[id\], onDelete: Restrict, onUpdate: Cascade\)/,
  );
  assert.match(
    organization,
    /backgroundJobs\s+BackgroundJob\[\]\s+@relation\("OrganizationBackgroundJobs"\)/,
  );
  assert.equal([...job.matchAll(/@relation\(/g)].length, 1);
  assert.doesNotMatch(job, /^\s*(user|product|productVersion|passport|document|subscription|notification|integrationMapping|qrCode|scanEvent|auditLog|parentJob|childJobs)\b/m);
});

test("BackgroundJob excludes infrastructure, credentials, and obsolete fields", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const job = block(schema, "model", "BackgroundJob");
  const forbiddenFields = [
    "type", "retryCount", "retries", "maxRetries", "nextRetryAt", "availableAt",
    "finishedAt", "failureReason", "stackTrace", "workerId", "cronExpression",
    "recurrenceRule", "accessToken", "refreshToken", "apiKey", "password",
    "authorizationHeader", "webhookSecret", "credentials", "deletedAt", "archivedAt",
  ];

  for (const field of forbiddenFields) {
    assert.doesNotMatch(job, new RegExp(`^\\s*${field}\\b`, "m"));
  }
  assert.doesNotMatch(schema, /^model (?:Worker|Queue|QueueProcessor|Scheduler|CronJob|RetryHistory|NotificationDelivery|OAuthToken|IntegrationCredential)\b/m);
  assert.match(job, /payload\/result/);
  assert.match(job, /Never store[\s\S]*credentials, tokens, secrets, authorization headers, cookies, stack[\s\S]*traces, or binary content/);
});

test("BackgroundJob has exactly six approved non-unique indexes and no Prisma uniqueness", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const job = block(schema, "model", "BackgroundJob");
  const indexes = [
    "status, scheduledAt",
    "queue, status, scheduledAt",
    "organizationId, status",
    "entityType, entityId",
    "lockedAt",
    "createdAt",
  ];

  for (const fields of indexes) assert.match(job, new RegExp(`@@index\\(\\[${fields}\\]\\)`));
  assert.equal([...job.matchAll(/@@index\(/g)].length, 6);
  assert.equal([...job.matchAll(/@unique|@@unique/g)].length, 0);
  assert.doesNotMatch(job, /type:\s*Gin|ops:\s*Json/);
});

test("BackgroundJob migration creates only approved objects", async () => {
  const migrationSql = await readPhaseMigration();

  assert.deepEqual(
    [...migrationSql.matchAll(/CREATE TYPE "(\w+)"/g)].map((match) => match[1]),
    ["BackgroundJobScope", "BackgroundJobStatus"],
  );
  assert.match(migrationSql, /CREATE TYPE "BackgroundJobScope" AS ENUM \('PLATFORM', 'ORGANIZATION'\)/);
  assert.match(migrationSql, /CREATE TYPE "BackgroundJobStatus" AS ENUM \('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED'\)/);
  assert.deepEqual([...migrationSql.matchAll(/CREATE TABLE "(\w+)"/g)].map((match) => match[1]), ["BackgroundJob"]);
  assert.equal([...migrationSql.matchAll(/CREATE INDEX /g)].length, 6);
  assert.equal([...migrationSql.matchAll(/CREATE UNIQUE INDEX /g)].length, 2);
  assert.equal([...migrationSql.matchAll(/FOREIGN KEY/g)].length, 1);
  assert.equal([...migrationSql.matchAll(/\bCONSTRAINT "ck_background_job_/g)].length, 11);
  assert.match(
    migrationSql,
    /ALTER TABLE "BackgroundJob" ADD CONSTRAINT "BackgroundJob_organizationId_fkey" FOREIGN KEY \("organizationId"\) REFERENCES "Organization"\("id"\) ON DELETE RESTRICT ON UPDATE CASCADE/,
  );
  assert.doesNotMatch(migrationSql, /\b(DROP|TRUNCATE|INSERT INTO|UPDATE .+ SET|DELETE FROM|CREATE FUNCTION|CREATE TRIGGER|CREATE POLICY|CREATE VIEW|CREATE MATERIALIZED VIEW|PARTITION BY)\b/);
  assert.doesNotMatch(migrationSql, /ROW LEVEL SECURITY|CREATE SEQUENCE|CREATE PROCEDURE/);
  assert.doesNotMatch(migrationSql, /ALTER TABLE "(?!BackgroundJob")/);
});

test("BackgroundJob migration enforces ownership, identifiers, attempts, and entity pairing", async () => {
  const migrationSql = await readPhaseMigration();

  assert.match(migrationSql, /CONSTRAINT "ck_background_job_scope_ownership"\s+CHECK \(/);
  assert.match(migrationSql, /"scope" = 'PLATFORM'::"BackgroundJobScope" AND "organizationId" IS NULL/);
  assert.match(migrationSql, /"scope" = 'ORGANIZATION'::"BackgroundJobScope" AND "organizationId" IS NOT NULL/);
  for (const [name, field] of [["queue_format", "queue"], ["job_type_format", "jobType"]]) {
    assert.match(migrationSql, new RegExp(`CONSTRAINT "ck_background_job_${name}"\\s+CHECK`));
    assert.match(migrationSql, new RegExp(`"${field}" = btrim\\("${field}"\\)`));
    assert.match(migrationSql, new RegExp(`"${field}" ~ '\\\^\\[A-Z\\]\\[A-Z0-9_\\]\\*\\$'`));
  }
  assert.match(migrationSql, /CONSTRAINT "ck_background_job_entity_reference_pair"\s+CHECK \(/);
  assert.match(migrationSql, /"entityType" IS NULL AND "entityId" IS NULL/);
  assert.match(migrationSql, /"entityType" IS NOT NULL AND "entityId" IS NOT NULL/);
  assert.match(migrationSql, /CONSTRAINT "ck_background_job_priority"\s+CHECK \("priority" >= 0\)/);
  assert.match(migrationSql, /CONSTRAINT "ck_background_job_attempts"\s+CHECK \("attemptCount" >= 0 AND "maxAttempts" > 0 AND "attemptCount" <= "maxAttempts"\)/);
});

test("BackgroundJob migration enforces locking and all lifecycle states", async () => {
  const migrationSql = await readPhaseMigration();

  assert.match(migrationSql, /CONSTRAINT "ck_background_job_lock_consistency"\s+CHECK \(/);
  assert.match(migrationSql, /"lockedAt" IS NULL AND "lockOwner" IS NULL/);
  assert.match(migrationSql, /"lockedAt" IS NOT NULL AND "lockOwner" IS NOT NULL/);
  assert.match(migrationSql, /"lockedAt" IS NULL OR "status" = 'RUNNING'::"BackgroundJobStatus"/);
  assert.match(migrationSql, /CONSTRAINT "ck_background_job_status_lifecycle"\s+CHECK \(/);
  assert.match(migrationSql, /"status" = 'QUEUED'::"BackgroundJobStatus"[\s\S]*?"startedAt" IS NULL[\s\S]*?"completedAt" IS NULL[\s\S]*?"failedAt" IS NULL[\s\S]*?"canceledAt" IS NULL[\s\S]*?"lockedAt" IS NULL[\s\S]*?"lockOwner" IS NULL/);
  assert.match(migrationSql, /"status" = 'RUNNING'::"BackgroundJobStatus"[\s\S]*?"startedAt" IS NOT NULL[\s\S]*?"lockedAt" IS NOT NULL[\s\S]*?"lockOwner" IS NOT NULL[\s\S]*?"completedAt" IS NULL[\s\S]*?"failedAt" IS NULL[\s\S]*?"canceledAt" IS NULL/);
  assert.match(migrationSql, /"status" = 'SUCCEEDED'::"BackgroundJobStatus"[\s\S]*?"startedAt" IS NOT NULL[\s\S]*?"completedAt" IS NOT NULL[\s\S]*?"failedAt" IS NULL[\s\S]*?"canceledAt" IS NULL[\s\S]*?"lockedAt" IS NULL[\s\S]*?"lockOwner" IS NULL/);
  assert.match(migrationSql, /"status" = 'FAILED'::"BackgroundJobStatus"[\s\S]*?"startedAt" IS NOT NULL[\s\S]*?"failedAt" IS NOT NULL[\s\S]*?"lastErrorCode" IS NOT NULL[\s\S]*?"completedAt" IS NULL[\s\S]*?"canceledAt" IS NULL[\s\S]*?"lockedAt" IS NULL[\s\S]*?"lockOwner" IS NULL/);
  assert.match(migrationSql, /"status" = 'CANCELED'::"BackgroundJobStatus"[\s\S]*?"canceledAt" IS NOT NULL[\s\S]*?"completedAt" IS NULL[\s\S]*?"failedAt" IS NULL[\s\S]*?"lockedAt" IS NULL[\s\S]*?"lockOwner" IS NULL/);
});

test("BackgroundJob migration enforces sanitized errors and timestamp order", async () => {
  const migrationSql = await readPhaseMigration();

  assert.match(migrationSql, /CONSTRAINT "ck_background_job_error_code_format"\s+CHECK \(/);
  assert.match(migrationSql, /"lastErrorCode" ~ '\^\[A-Z\]\[A-Z0-9_\]\*\$'/);
  assert.match(migrationSql, /CONSTRAINT "ck_background_job_error_summary_length"\s+CHECK \(/);
  assert.match(migrationSql, /"lastErrorSummary" = btrim\("lastErrorSummary"\)/);
  assert.match(migrationSql, /char_length\("lastErrorSummary"\) BETWEEN 1 AND 500/);
  assert.match(migrationSql, /CONSTRAINT "ck_background_job_timestamp_order"\s+CHECK \(/);
  for (const field of ["startedAt", "completedAt", "failedAt", "canceledAt", "lockedAt"]) {
    assert.match(migrationSql, new RegExp(`"${field}" IS NULL OR "${field}" >= "createdAt"`));
  }
});

test("BackgroundJob migration enforces active deduplication separately by scope", async () => {
  const migrationSql = await readPhaseMigration();

  assert.match(
    migrationSql,
    /CREATE UNIQUE INDEX "ux_background_job_platform_deduplication" ON "BackgroundJob"\("scope", "queue", "jobType", "deduplicationKey"\) WHERE "scope" = 'PLATFORM' AND "organizationId" IS NULL AND "deduplicationKey" IS NOT NULL AND "status" IN \('QUEUED', 'RUNNING'\)/,
  );
  assert.match(
    migrationSql,
    /CREATE UNIQUE INDEX "ux_background_job_organization_deduplication" ON "BackgroundJob"\("scope", "organizationId", "queue", "jobType", "deduplicationKey"\) WHERE "scope" = 'ORGANIZATION' AND "organizationId" IS NOT NULL AND "deduplicationKey" IS NOT NULL AND "status" IN \('QUEUED', 'RUNNING'\)/,
  );
});

test("BackgroundJob remains only a platform-service persistence model", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const job = block(schema, "model", "BackgroundJob");

  assert.equal([...job.matchAll(/@relation\(/g)].length, 1);
  assert.doesNotMatch(job, /NotificationType|NotificationStatus|eventType|provider|externalResource|actorId|action|occurredAt/);
  assert.doesNotMatch(schema, /^model (?:BackgroundJobAttempt|BackgroundJobDependency|Worker|Scheduler|QueueProcessor|NotificationDelivery)\b/m);
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
    ["20260722171607_add_notification", "d71c44c01edbf56e905a88cddc223716454b10a396681ee0ce14ef85fc013f5b"],
    ["20260722180124_add_integration_mapping", "368783ae2a1895ca2aeb5f53af1dd6a2f21b29ac22127be001b30b0ea052e4ab"],
  ]);

  for (const [directory, approvedHash] of approvedMigrations) {
    const migrationSql = await readFile(new URL(`${directory}/migration.sql`, migrationsPath), "utf8");
    assert.equal(
      createHash("sha256").update(migrationSql).digest("hex"),
      approvedHash,
      `${directory} migration source changed`,
    );
  }
});
