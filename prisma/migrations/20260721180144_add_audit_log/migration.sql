-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT,
    "metadata" JSONB,
    "correlationId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ck_audit_log_action_format"
        CHECK ("action" = btrim("action") AND char_length("action") BETWEEN 3 AND 128 AND "action" ~ '^[A-Z][A-Z0-9_]*$'),
    CONSTRAINT "ck_audit_log_entity_type_format"
        CHECK ("entityType" = btrim("entityType") AND char_length("entityType") BETWEEN 2 AND 96 AND "entityType" ~ '^[A-Z][A-Z0-9_]*$'),
    CONSTRAINT "ck_audit_log_entity_id_format"
        CHECK ("entityId" = btrim("entityId") AND char_length("entityId") BETWEEN 1 AND 255),
    CONSTRAINT "ck_audit_log_summary_length"
        CHECK ("summary" IS NULL OR char_length("summary") BETWEEN 1 AND 500),
    CONSTRAINT "ck_audit_log_correlation_id_format"
        CHECK ("correlationId" IS NULL OR ("correlationId" = btrim("correlationId") AND char_length("correlationId") BETWEEN 8 AND 128 AND "correlationId" ~ '^[A-Za-z0-9_.:-]+$')),
    CONSTRAINT "ck_audit_log_created_at_not_before_occurred_at"
        CHECK ("createdAt" >= "occurredAt"),
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_occurredAt_idx" ON "AuditLog"("organizationId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_entityType_entityId_occurredAt_idx" ON "AuditLog"("organizationId", "entityType", "entityId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_action_occurredAt_idx" ON "AuditLog"("organizationId", "action", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_occurredAt_idx" ON "AuditLog"("actorId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");

-- CreateIndex
CREATE INDEX "AuditLog_occurredAt_idx" ON "AuditLog"("occurredAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
