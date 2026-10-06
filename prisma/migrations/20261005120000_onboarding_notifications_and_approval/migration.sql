BEGIN;

-- CreateTable
CREATE TABLE "PlatformOnboardingGrant" (
    "userId" UUID NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "PlatformOnboardingGrant_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "OnboardingNotificationSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "recipientEmail" VARCHAR(254) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingNotificationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessRequestAdminNotification" (
    "requestId" UUID NOT NULL,
    "recipientEmail" VARCHAR(254) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "attemptId" UUID,
    "startedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessRequestAdminNotification_pkey" PRIMARY KEY ("requestId")
);

-- AddForeignKey
ALTER TABLE "PlatformOnboardingGrant" ADD CONSTRAINT "PlatformOnboardingGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequestAdminNotification" ADD CONSTRAINT "AccessRequestAdminNotification_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AccessRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "OnboardingNotificationSettings"
  ADD CONSTRAINT "OnboardingNotificationSettings_singleton" CHECK ("id" = 1),
  ADD CONSTRAINT "OnboardingNotificationSettings_email" CHECK ("recipientEmail" = lower(btrim("recipientEmail")) AND "recipientEmail" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');
ALTER TABLE "AccessRequestAdminNotification"
  ADD CONSTRAINT "AccessRequestAdminNotification_email" CHECK ("recipientEmail" = lower(btrim("recipientEmail")) AND "recipientEmail" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  ADD CONSTRAINT "AccessRequestAdminNotification_state" CHECK (
    ("status" = 'PENDING' AND "attempts" = 0 AND "attemptId" IS NULL AND "startedAt" IS NULL AND "sentAt" IS NULL)
    OR ("status" IN ('IN_PROGRESS', 'DELIVERY_UNKNOWN', 'REJECTED') AND "attempts" BETWEEN 1 AND 3 AND "attemptId" IS NOT NULL AND "startedAt" IS NOT NULL AND "sentAt" IS NULL)
    OR ("status" = 'SENT' AND "attempts" BETWEEN 1 AND 3 AND "attemptId" IS NOT NULL AND "startedAt" IS NOT NULL AND "sentAt" IS NOT NULL)
  );

COMMIT;
