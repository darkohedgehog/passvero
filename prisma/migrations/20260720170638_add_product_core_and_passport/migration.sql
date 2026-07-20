-- CreateEnum
CREATE TYPE "ProductLifecycleStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProductVersionStatus" AS ENUM ('DRAFT', 'READY_FOR_REVIEW', 'PUBLISHED', 'SUPERSEDED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "PassportStatus" AS ENUM ('ACTIVE', 'WITHDRAWN', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "internalName" TEXT NOT NULL,
    "sku" TEXT,
    "normalizedSku" TEXT,
    "publicCode" TEXT NOT NULL,
    "lifecycleStatus" "ProductLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentDraftVersionId" UUID,
    "currentPublishedVersionId" UUID,
    "createdById" UUID,
    "updatedById" UUID,
    "archivedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "lastPublishedAt" TIMESTAMP(3),

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVersion" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "status" "ProductVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceLocale" TEXT NOT NULL,
    "versionNumber" INTEGER,
    "versionLabel" TEXT,
    "changeSummary" TEXT,
    "clonedFromVersionId" UUID,
    "createdById" UUID,
    "updatedById" UUID,
    "publishedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewReadyAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "discardedAt" TIMESTAMP(3),

    CONSTRAINT "ProductVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Passport" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "status" "PassportStatus" NOT NULL DEFAULT 'ACTIVE',
    "defaultLocale" TEXT,
    "firstPublishedAt" TIMESTAMP(3) NOT NULL,
    "lastPublishedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "withdrawnById" UUID,
    "withdrawalReasonCode" TEXT,
    "publicWithdrawalMessage" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Passport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_publicCode_key" ON "Product"("publicCode");

-- CreateIndex
CREATE UNIQUE INDEX "Product_currentDraftVersionId_key" ON "Product"("currentDraftVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_currentPublishedVersionId_key" ON "Product"("currentPublishedVersionId");

-- CreateIndex
CREATE INDEX "Product_organizationId_lifecycleStatus_idx" ON "Product"("organizationId", "lifecycleStatus");

-- CreateIndex
CREATE INDEX "Product_organizationId_updatedAt_idx" ON "Product"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "Product_createdById_idx" ON "Product"("createdById");

-- CreateIndex
CREATE INDEX "Product_updatedById_idx" ON "Product"("updatedById");

-- CreateIndex
CREATE INDEX "Product_archivedById_idx" ON "Product"("archivedById");

-- CreateIndex
CREATE UNIQUE INDEX "Product_organizationId_normalizedSku_key" ON "Product"("organizationId", "normalizedSku");

-- CreateIndex
CREATE INDEX "ProductVersion_productId_status_idx" ON "ProductVersion"("productId", "status");

-- CreateIndex
CREATE INDEX "ProductVersion_organizationId_status_idx" ON "ProductVersion"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ProductVersion_organizationId_updatedAt_idx" ON "ProductVersion"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "ProductVersion_publishedAt_idx" ON "ProductVersion"("publishedAt");

-- CreateIndex
CREATE INDEX "ProductVersion_clonedFromVersionId_idx" ON "ProductVersion"("clonedFromVersionId");

-- CreateIndex
CREATE INDEX "ProductVersion_createdById_idx" ON "ProductVersion"("createdById");

-- CreateIndex
CREATE INDEX "ProductVersion_updatedById_idx" ON "ProductVersion"("updatedById");

-- CreateIndex
CREATE INDEX "ProductVersion_publishedById_idx" ON "ProductVersion"("publishedById");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVersion_productId_versionNumber_key" ON "ProductVersion"("productId", "versionNumber");

-- Prisma cannot express partial unique indexes. This enforces one editable
-- ProductVersion per Product across both editable workflow statuses.
CREATE UNIQUE INDEX "ux_product_version_one_active_draft"
ON "ProductVersion" ("productId")
WHERE "status" IN (
  'DRAFT'::"ProductVersionStatus",
  'READY_FOR_REVIEW'::"ProductVersionStatus"
);

-- CreateIndex
CREATE UNIQUE INDEX "Passport_productId_key" ON "Passport"("productId");

-- CreateIndex
CREATE INDEX "Passport_organizationId_status_idx" ON "Passport"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Passport_firstPublishedAt_idx" ON "Passport"("firstPublishedAt");

-- CreateIndex
CREATE INDEX "Passport_lastPublishedAt_idx" ON "Passport"("lastPublishedAt");

-- CreateIndex
CREATE INDEX "Passport_withdrawnById_idx" ON "Passport"("withdrawnById");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_currentDraftVersionId_fkey" FOREIGN KEY ("currentDraftVersionId") REFERENCES "ProductVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_currentPublishedVersionId_fkey" FOREIGN KEY ("currentPublishedVersionId") REFERENCES "ProductVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVersion" ADD CONSTRAINT "ProductVersion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVersion" ADD CONSTRAINT "ProductVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVersion" ADD CONSTRAINT "ProductVersion_clonedFromVersionId_fkey" FOREIGN KEY ("clonedFromVersionId") REFERENCES "ProductVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVersion" ADD CONSTRAINT "ProductVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVersion" ADD CONSTRAINT "ProductVersion_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVersion" ADD CONSTRAINT "ProductVersion_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passport" ADD CONSTRAINT "Passport_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passport" ADD CONSTRAINT "Passport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passport" ADD CONSTRAINT "Passport_withdrawnById_fkey" FOREIGN KEY ("withdrawnById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
