-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR', 'ACTION_REQUIRED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'DISMISSED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID,
    "type" "NotificationType" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actionUrl" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ck_notification_event_type_format"
        CHECK ("eventType" = btrim("eventType") AND char_length("eventType") BETWEEN 3 AND 128 AND "eventType" ~ '^[A-Z][A-Z0-9_]*$'),
    CONSTRAINT "ck_notification_title_length"
        CHECK (char_length("title") BETWEEN 1 AND 200),
    CONSTRAINT "ck_notification_message_length"
        CHECK (char_length("message") BETWEEN 1 AND 4000),
    CONSTRAINT "ck_notification_action_url_format"
        CHECK (
            "actionUrl" IS NULL OR (
                "actionUrl" = btrim("actionUrl")
                AND char_length("actionUrl") BETWEEN 1 AND 2048
                AND ("actionUrl" LIKE '/%' OR "actionUrl" LIKE 'https://%')
            )
        ),
    CONSTRAINT "ck_notification_entity_reference_pair"
        CHECK (
            ("entityType" IS NULL AND "entityId" IS NULL)
            OR ("entityType" IS NOT NULL AND "entityId" IS NOT NULL)
        ),
    CONSTRAINT "ck_notification_entity_type_format"
        CHECK (
            "entityType" IS NULL OR (
                "entityType" = btrim("entityType")
                AND char_length("entityType") BETWEEN 2 AND 96
                AND "entityType" ~ '^[A-Z][A-Z0-9_]*$'
            )
        ),
    CONSTRAINT "ck_notification_entity_id_format"
        CHECK (
            "entityId" IS NULL OR (
                "entityId" = btrim("entityId")
                AND char_length("entityId") BETWEEN 1 AND 255
            )
        ),
    CONSTRAINT "ck_notification_status_timestamps"
        CHECK (
            (
                "status" = 'UNREAD'::"NotificationStatus"
                AND "readAt" IS NULL
                AND "dismissedAt" IS NULL
                AND "archivedAt" IS NULL
            )
            OR (
                "status" = 'READ'::"NotificationStatus"
                AND "readAt" IS NOT NULL
                AND "dismissedAt" IS NULL
                AND "archivedAt" IS NULL
            )
            OR (
                "status" = 'DISMISSED'::"NotificationStatus"
                AND "dismissedAt" IS NOT NULL
                AND "archivedAt" IS NULL
            )
            OR (
                "status" = 'ARCHIVED'::"NotificationStatus"
                AND "archivedAt" IS NOT NULL
            )
        ),
    CONSTRAINT "ck_notification_timestamp_order"
        CHECK (
            ("readAt" IS NULL OR "readAt" >= "createdAt")
            AND ("dismissedAt" IS NULL OR "dismissedAt" >= "createdAt")
            AND ("archivedAt" IS NULL OR "archivedAt" >= "createdAt")
            AND ("expiresAt" IS NULL OR "expiresAt" >= "createdAt")
        ),
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_organizationId_status_createdAt_idx" ON "Notification"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_status_createdAt_idx" ON "Notification"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_organizationId_eventType_createdAt_idx" ON "Notification"("organizationId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_organizationId_entityType_entityId_createdAt_idx" ON "Notification"("organizationId", "entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_expiresAt_idx" ON "Notification"("expiresAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
