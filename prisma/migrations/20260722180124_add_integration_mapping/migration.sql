-- CreateEnum
CREATE TYPE "IntegrationMappingStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ERROR', 'ARCHIVED');

-- CreateTable
CREATE TABLE "IntegrationMapping" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "externalResourceType" TEXT NOT NULL,
    "externalResourceId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" "IntegrationMappingStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSyncedAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "metadata" JSONB,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ck_integration_mapping_provider_format"
        CHECK ("provider" = btrim("provider") AND char_length("provider") BETWEEN 2 AND 96 AND "provider" ~ '^[A-Z][A-Z0-9_]*$'),
    CONSTRAINT "ck_integration_mapping_external_account_id_format"
        CHECK ("externalAccountId" IS NULL OR ("externalAccountId" = btrim("externalAccountId") AND char_length("externalAccountId") BETWEEN 1 AND 255)),
    CONSTRAINT "ck_integration_mapping_external_resource_type_format"
        CHECK ("externalResourceType" = btrim("externalResourceType") AND char_length("externalResourceType") BETWEEN 2 AND 96 AND "externalResourceType" ~ '^[A-Z][A-Z0-9_]*$'),
    CONSTRAINT "ck_integration_mapping_external_resource_id_format"
        CHECK ("externalResourceId" = btrim("externalResourceId") AND char_length("externalResourceId") BETWEEN 1 AND 512),
    CONSTRAINT "ck_integration_mapping_entity_type_format"
        CHECK ("entityType" = btrim("entityType") AND char_length("entityType") BETWEEN 2 AND 96 AND "entityType" ~ '^[A-Z][A-Z0-9_]*$'),
    CONSTRAINT "ck_integration_mapping_entity_id_format"
        CHECK ("entityId" = btrim("entityId") AND char_length("entityId") BETWEEN 1 AND 255),
    CONSTRAINT "ck_integration_mapping_archived_at_consistency"
        CHECK (
            ("status" = 'ARCHIVED'::"IntegrationMappingStatus" AND "archivedAt" IS NOT NULL)
            OR ("status" = 'ACTIVE'::"IntegrationMappingStatus" AND "archivedAt" IS NULL)
            OR ("status" = 'DISABLED'::"IntegrationMappingStatus" AND "archivedAt" IS NULL)
            OR ("status" = 'ERROR'::"IntegrationMappingStatus" AND "archivedAt" IS NULL)
        ),
    CONSTRAINT "ck_integration_mapping_error_consistency"
        CHECK ("status" <> 'ERROR'::"IntegrationMappingStatus" OR "lastErrorAt" IS NOT NULL),
    CONSTRAINT "ck_integration_mapping_last_error_code_format"
        CHECK ("lastErrorCode" IS NULL OR ("lastErrorCode" = btrim("lastErrorCode") AND char_length("lastErrorCode") BETWEEN 2 AND 128 AND "lastErrorCode" ~ '^[A-Z][A-Z0-9_]*$')),
    CONSTRAINT "ck_integration_mapping_timestamp_order"
        CHECK (
            ("lastSyncedAt" IS NULL OR "lastSyncedAt" >= "createdAt")
            AND ("lastErrorAt" IS NULL OR "lastErrorAt" >= "createdAt")
            AND ("archivedAt" IS NULL OR "archivedAt" >= "createdAt")
        ),

    CONSTRAINT "IntegrationMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationMapping_organizationId_provider_status_idx" ON "IntegrationMapping"("organizationId", "provider", "status");

-- CreateIndex
CREATE INDEX "IntegrationMapping_organizationId_entityType_entityId_idx" ON "IntegrationMapping"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "IntegrationMapping_organizationId_provider_externalResource_idx" ON "IntegrationMapping"("organizationId", "provider", "externalResourceType");

-- CreateIndex
CREATE INDEX "IntegrationMapping_lastSyncedAt_idx" ON "IntegrationMapping"("lastSyncedAt");

-- CreateIndex
CREATE INDEX "IntegrationMapping_lastErrorAt_idx" ON "IntegrationMapping"("lastErrorAt");

-- CreateIndex
CREATE INDEX "IntegrationMapping_archivedAt_idx" ON "IntegrationMapping"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationMapping_external_resource_key" ON "IntegrationMapping"("organizationId", "provider", "externalAccountId", "externalResourceType", "externalResourceId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationMapping_internal_entity_key" ON "IntegrationMapping"("organizationId", "provider", "externalAccountId", "externalResourceType", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "ux_integration_mapping_external_resource_without_account" ON "IntegrationMapping"("organizationId", "provider", "externalResourceType", "externalResourceId") WHERE "externalAccountId" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ux_integration_mapping_internal_entity_without_account" ON "IntegrationMapping"("organizationId", "provider", "externalResourceType", "entityType", "entityId") WHERE "externalAccountId" IS NULL;

-- AddForeignKey
ALTER TABLE "IntegrationMapping" ADD CONSTRAINT "IntegrationMapping_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
