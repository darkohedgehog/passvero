-- CreateTable
CREATE TABLE "ReminderCampaign" (
    "id" UUID NOT NULL,
    "organizationIds" JSONB NOT NULL,
    "recipientEmails" JSONB NOT NULL,
    "operatorEmails" JSONB NOT NULL,
    "messageKinds" JSONB NOT NULL,
    "maxDispatches" INTEGER NOT NULL,
    "dispatches" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvalReference" VARCHAR(200) NOT NULL,
    "leaseToken" UUID,
    "leaseUntil" TIMESTAMP(3),
    "lastStartedAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEmailConfirmation" (
    "organizationId" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "profileRevision" INTEGER NOT NULL,
    "confirmedById" UUID NOT NULL,
    "evidenceReference" VARCHAR(200) NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "BillingEmailConfirmation_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "SubscriptionReminder" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "revision" VARCHAR(200) NOT NULL,
    "kind" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "recipient" VARCHAR(254) NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "leaseToken" UUID,
    "leaseUntil" TIMESTAMP(3),
    "lastError" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "receiptConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderAttempt" (
    "id" UUID NOT NULL,
    "reminderId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "token" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENDING',
    "reason" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ReminderAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubscriptionReminder_campaignId_status_nextAttemptAt_idx" ON "SubscriptionReminder"("campaignId", "status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "SubscriptionReminder_status_leaseUntil_idx" ON "SubscriptionReminder"("status", "leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_logical_key" ON "SubscriptionReminder"("organizationId", "revision", "kind", "threshold", "channel", "recipient");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderAttempt_token_key" ON "ReminderAttempt"("token");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderAttempt_reminderId_number_key" ON "ReminderAttempt"("reminderId", "number");

-- AddForeignKey
ALTER TABLE "BillingEmailConfirmation" ADD CONSTRAINT "BillingEmailConfirmation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionReminder" ADD CONSTRAINT "SubscriptionReminder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionReminder" ADD CONSTRAINT "SubscriptionReminder_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ReminderCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderAttempt" ADD CONSTRAINT "ReminderAttempt_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "SubscriptionReminder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReminderCampaign" ADD CONSTRAINT "reminder_campaign_budget" CHECK ("maxDispatches" BETWEEN 1 AND 100 AND "dispatches" BETWEEN 0 AND "maxDispatches");
ALTER TABLE "ReminderCampaign" ADD CONSTRAINT "reminder_campaign_scope" CHECK (
  jsonb_typeof("organizationIds")='array' AND jsonb_array_length("organizationIds") BETWEEN 1 AND 25 AND
  jsonb_typeof("recipientEmails")='array' AND jsonb_array_length("recipientEmails") BETWEEN 1 AND 32 AND
  jsonb_typeof("operatorEmails")='array' AND jsonb_array_length("operatorEmails") <= 16 AND
  jsonb_typeof("messageKinds")='array' AND jsonb_array_length("messageKinds") BETWEEN 1 AND 2);
ALTER TABLE "SubscriptionReminder" ADD CONSTRAINT "reminder_state" CHECK (
  "status" IN ('PENDING','CLAIMED','SENDING','SENT','FAILED','DELIVERY_UNKNOWN','CANCELLED') AND
  "kind" IN ('SUBSCRIPTION','PUBLIC_AVAILABILITY') AND "channel"='EMAIL' AND
  "threshold" IN (0,1,7,30) AND ("kind"<>'PUBLIC_AVAILABILITY' OR "threshold"<>0) AND
  "attempts" BETWEEN 0 AND 3 AND "recipient"=lower(btrim("recipient")));
ALTER TABLE "SubscriptionReminder" ADD CONSTRAINT "reminder_lease" CHECK (
  ("status" IN ('CLAIMED','SENDING')) = ("leaseToken" IS NOT NULL AND "leaseUntil" IS NOT NULL));
ALTER TABLE "ReminderAttempt" ADD CONSTRAINT "reminder_attempt_state" CHECK (
  "number" BETWEEN 1 AND 3 AND "status" IN ('SENDING','ACCEPTED','SAFE_RETRY','FAILED','DELIVERY_UNKNOWN'));
ALTER TABLE "BillingEmailConfirmation" ADD CONSTRAINT "billing_confirmation_revision" CHECK ("profileRevision">0 AND "email"=lower(btrim("email")));
ALTER TABLE "BillingEmailConfirmation" ADD CONSTRAINT "billing_confirmation_actor" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE RESTRICT;
