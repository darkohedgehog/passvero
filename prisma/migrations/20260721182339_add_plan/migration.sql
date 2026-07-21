-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Plan" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "currencyCode" TEXT NOT NULL DEFAULT 'EUR',
    "monthlyPrice" DECIMAL(12,2) NOT NULL,
    "yearlyPrice" DECIMAL(12,2) NOT NULL,
    "maxProducts" INTEGER,
    "maxActivePassports" INTEGER,
    "maxMembers" INTEGER,
    "maxStorageBytes" BIGINT,
    "maxMonthlyScans" BIGINT,
    "features" JSONB NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ck_plan_name_length"
        CHECK (char_length("name") BETWEEN 1 AND 120),
    CONSTRAINT "ck_plan_slug_format"
        CHECK ("slug" = btrim("slug") AND char_length("slug") BETWEEN 2 AND 64 AND "slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT "ck_plan_currency_code_format"
        CHECK ("currencyCode" ~ '^[A-Z]{3}$'),
    CONSTRAINT "ck_plan_monthly_price_non_negative"
        CHECK ("monthlyPrice" >= 0),
    CONSTRAINT "ck_plan_yearly_price_non_negative"
        CHECK ("yearlyPrice" >= 0),
    CONSTRAINT "ck_plan_max_products_positive"
        CHECK ("maxProducts" IS NULL OR "maxProducts" > 0),
    CONSTRAINT "ck_plan_max_active_passports_positive"
        CHECK ("maxActivePassports" IS NULL OR "maxActivePassports" > 0),
    CONSTRAINT "ck_plan_max_members_positive"
        CHECK ("maxMembers" IS NULL OR "maxMembers" > 0),
    CONSTRAINT "ck_plan_max_storage_bytes_positive"
        CHECK ("maxStorageBytes" IS NULL OR "maxStorageBytes" > 0),
    CONSTRAINT "ck_plan_max_monthly_scans_positive"
        CHECK ("maxMonthlyScans" IS NULL OR "maxMonthlyScans" > 0),
    CONSTRAINT "ck_plan_features_object"
        CHECK (jsonb_typeof("features") = 'object'),
    CONSTRAINT "ck_plan_description_length"
        CHECK ("description" IS NULL OR char_length("description") BETWEEN 1 AND 1000),
    CONSTRAINT "ck_plan_sort_order_non_negative"
        CHECK ("sortOrder" >= 0),
    CONSTRAINT "ck_plan_archived_at_consistency"
        CHECK (
            ("status" = 'ARCHIVED'::"PlanStatus" AND "archivedAt" IS NOT NULL)
            OR
            ("status" IN ('DRAFT'::"PlanStatus", 'ACTIVE'::"PlanStatus") AND "archivedAt" IS NULL)
        ),
    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_slug_key" ON "Plan"("slug");

-- CreateIndex
CREATE INDEX "Plan_status_sortOrder_idx" ON "Plan"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "Plan_isPublic_status_sortOrder_idx" ON "Plan"("isPublic", "status", "sortOrder");

-- CreateIndex
CREATE INDEX "Plan_createdAt_idx" ON "Plan"("createdAt");

-- CreateIndex
CREATE INDEX "Plan_archivedAt_idx" ON "Plan"("archivedAt");
