-- CreateEnum
CREATE TYPE "BackgroundJobScope" AS ENUM ('PLATFORM', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "BackgroundJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- CreateTable
CREATE TABLE "BackgroundJob" (
    "id" UUID NOT NULL,
    "scope" "BackgroundJobScope" NOT NULL,
    "organizationId" UUID,
    "queue" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "status" "BackgroundJobStatus" NOT NULL DEFAULT 'QUEUED',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB,
    "result" JSONB,
    "entityType" TEXT,
    "entityId" TEXT,
    "deduplicationKey" TEXT,
    "correlationId" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockOwner" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ck_background_job_scope_ownership"
        CHECK (
            ("scope" = 'PLATFORM'::"BackgroundJobScope" AND "organizationId" IS NULL)
            OR ("scope" = 'ORGANIZATION'::"BackgroundJobScope" AND "organizationId" IS NOT NULL)
        ),
    CONSTRAINT "ck_background_job_queue_format"
        CHECK ("queue" = btrim("queue") AND "queue" ~ '^[A-Z][A-Z0-9_]*$'),
    CONSTRAINT "ck_background_job_job_type_format"
        CHECK ("jobType" = btrim("jobType") AND "jobType" ~ '^[A-Z][A-Z0-9_]*$'),
    CONSTRAINT "ck_background_job_entity_reference_pair"
        CHECK (
            ("entityType" IS NULL AND "entityId" IS NULL)
            OR ("entityType" IS NOT NULL AND "entityId" IS NOT NULL)
        ),
    CONSTRAINT "ck_background_job_priority"
        CHECK ("priority" >= 0),
    CONSTRAINT "ck_background_job_attempts"
        CHECK ("attemptCount" >= 0 AND "maxAttempts" > 0 AND "attemptCount" <= "maxAttempts"),
    CONSTRAINT "ck_background_job_lock_consistency"
        CHECK (
            (
                ("lockedAt" IS NULL AND "lockOwner" IS NULL)
                OR ("lockedAt" IS NOT NULL AND "lockOwner" IS NOT NULL)
            )
            AND ("lockedAt" IS NULL OR "status" = 'RUNNING'::"BackgroundJobStatus")
        ),
    CONSTRAINT "ck_background_job_status_lifecycle"
        CHECK (
            (
                "status" = 'QUEUED'::"BackgroundJobStatus"
                AND "startedAt" IS NULL
                AND "completedAt" IS NULL
                AND "failedAt" IS NULL
                AND "canceledAt" IS NULL
                AND "lockedAt" IS NULL
                AND "lockOwner" IS NULL
            )
            OR (
                "status" = 'RUNNING'::"BackgroundJobStatus"
                AND "startedAt" IS NOT NULL
                AND "lockedAt" IS NOT NULL
                AND "lockOwner" IS NOT NULL
                AND "completedAt" IS NULL
                AND "failedAt" IS NULL
                AND "canceledAt" IS NULL
            )
            OR (
                "status" = 'SUCCEEDED'::"BackgroundJobStatus"
                AND "startedAt" IS NOT NULL
                AND "completedAt" IS NOT NULL
                AND "failedAt" IS NULL
                AND "canceledAt" IS NULL
                AND "lockedAt" IS NULL
                AND "lockOwner" IS NULL
            )
            OR (
                "status" = 'FAILED'::"BackgroundJobStatus"
                AND "startedAt" IS NOT NULL
                AND "failedAt" IS NOT NULL
                AND "lastErrorCode" IS NOT NULL
                AND "completedAt" IS NULL
                AND "canceledAt" IS NULL
                AND "lockedAt" IS NULL
                AND "lockOwner" IS NULL
            )
            OR (
                "status" = 'CANCELED'::"BackgroundJobStatus"
                AND "canceledAt" IS NOT NULL
                AND "completedAt" IS NULL
                AND "failedAt" IS NULL
                AND "lockedAt" IS NULL
                AND "lockOwner" IS NULL
            )
        ),
    CONSTRAINT "ck_background_job_error_code_format"
        CHECK (
            "lastErrorCode" IS NULL
            OR (
                "lastErrorCode" = btrim("lastErrorCode")
                AND "lastErrorCode" ~ '^[A-Z][A-Z0-9_]*$'
            )
        ),
    CONSTRAINT "ck_background_job_error_summary_length"
        CHECK (
            "lastErrorSummary" IS NULL
            OR (
                "lastErrorSummary" = btrim("lastErrorSummary")
                AND char_length("lastErrorSummary") BETWEEN 1 AND 500
            )
        ),
    CONSTRAINT "ck_background_job_timestamp_order"
        CHECK (
            ("startedAt" IS NULL OR "startedAt" >= "createdAt")
            AND ("completedAt" IS NULL OR "completedAt" >= "createdAt")
            AND ("failedAt" IS NULL OR "failedAt" >= "createdAt")
            AND ("canceledAt" IS NULL OR "canceledAt" >= "createdAt")
            AND ("lockedAt" IS NULL OR "lockedAt" >= "createdAt")
        ),

    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackgroundJob_status_scheduledAt_idx" ON "BackgroundJob"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "BackgroundJob_queue_status_scheduledAt_idx" ON "BackgroundJob"("queue", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "BackgroundJob_organizationId_status_idx" ON "BackgroundJob"("organizationId", "status");

-- CreateIndex
CREATE INDEX "BackgroundJob_entityType_entityId_idx" ON "BackgroundJob"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "BackgroundJob_lockedAt_idx" ON "BackgroundJob"("lockedAt");

-- CreateIndex
CREATE INDEX "BackgroundJob_createdAt_idx" ON "BackgroundJob"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ux_background_job_platform_deduplication" ON "BackgroundJob"("scope", "queue", "jobType", "deduplicationKey") WHERE "scope" = 'PLATFORM' AND "organizationId" IS NULL AND "deduplicationKey" IS NOT NULL AND "status" IN ('QUEUED', 'RUNNING');

-- CreateIndex
CREATE UNIQUE INDEX "ux_background_job_organization_deduplication" ON "BackgroundJob"("scope", "organizationId", "queue", "jobType", "deduplicationKey") WHERE "scope" = 'ORGANIZATION' AND "organizationId" IS NOT NULL AND "deduplicationKey" IS NOT NULL AND "status" IN ('QUEUED', 'RUNNING');

-- AddForeignKey
ALTER TABLE "BackgroundJob" ADD CONSTRAINT "BackgroundJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
