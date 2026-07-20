-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING_UPLOAD', 'AVAILABLE', 'FAILED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "displayName" TEXT,
    "fileExtension" TEXT,
    "storageProvider" TEXT NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "uploadedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdById" UUID,
    "updatedById" UUID,
    "archivedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_document_checksum_sha256_format"
        CHECK ("checksumSha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "ck_document_size_bytes_positive"
        CHECK ("sizeBytes" > 0),
    CONSTRAINT "ck_document_available_uploaded_at"
        CHECK ("status" <> 'AVAILABLE'::"DocumentStatus" OR "uploadedAt" IS NOT NULL),
    CONSTRAINT "ck_document_failed_at"
        CHECK ("status" <> 'FAILED'::"DocumentStatus" OR "failedAt" IS NOT NULL),
    CONSTRAINT "ck_document_archived_at"
        CHECK ("status" <> 'ARCHIVED'::"DocumentStatus" OR "archivedAt" IS NOT NULL)
);

-- CreateIndex
CREATE INDEX "Document_organizationId_status_idx" ON "Document"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Document_organizationId_createdAt_idx" ON "Document"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Document_organizationId_updatedAt_idx" ON "Document"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "Document_checksumSha256_idx" ON "Document"("checksumSha256");

-- CreateIndex
CREATE INDEX "Document_createdById_idx" ON "Document"("createdById");

-- CreateIndex
CREATE INDEX "Document_updatedById_idx" ON "Document"("updatedById");

-- CreateIndex
CREATE INDEX "Document_archivedById_idx" ON "Document"("archivedById");

-- CreateIndex
CREATE UNIQUE INDEX "Document_storageProvider_storageBucket_storageKey_key" ON "Document"("storageProvider", "storageBucket", "storageKey");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
