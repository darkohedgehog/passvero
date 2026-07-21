-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BillingProvider" AS ENUM ('STRIPE', 'MANUAL');

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "billingProvider" "BillingProvider" NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "externalCustomerId" TEXT,
    "externalSubscriptionId" TEXT,
    "providerConfigurationKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ck_subscription_period_order"
        CHECK ("currentPeriodEnd" >= "currentPeriodStart"),
    CONSTRAINT "ck_subscription_cancellation"
        CHECK (
            "status" NOT IN ('CANCELED'::"SubscriptionStatus", 'EXPIRED'::"SubscriptionStatus")
            OR "cancelAtPeriodEnd" = false
        ),
    CONSTRAINT "ck_subscription_status_consistency"
        CHECK (
            ("status" IN ('TRIAL'::"SubscriptionStatus", 'ACTIVE'::"SubscriptionStatus", 'PAST_DUE'::"SubscriptionStatus") AND "canceledAt" IS NULL)
            OR
            ("status" IN ('CANCELED'::"SubscriptionStatus", 'EXPIRED'::"SubscriptionStatus") AND "canceledAt" IS NOT NULL)
        ),
    CONSTRAINT "ck_subscription_manual_provider"
        CHECK (
            "billingProvider" <> 'MANUAL'::"BillingProvider"
            OR
            (
                "externalCustomerId" IS NULL
                AND "externalSubscriptionId" IS NULL
                AND "providerConfigurationKey" IS NULL
            )
        ),
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_organizationId_key" ON "Subscription"("organizationId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_planId_status_idx" ON "Subscription"("planId", "status");

-- CreateIndex
CREATE INDEX "Subscription_billingProvider_idx" ON "Subscription"("billingProvider");

-- CreateIndex
CREATE INDEX "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
