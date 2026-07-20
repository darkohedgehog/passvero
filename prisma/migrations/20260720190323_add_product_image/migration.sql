-- CreateTable
CREATE TABLE "ProductImage" (
    "id" UUID NOT NULL,
    "productVersionId" UUID NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "fileExtension" TEXT,
    "storageProvider" TEXT NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "altText" TEXT,
    "caption" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ck_product_image_checksum_sha256_format"
        CHECK ("checksumSha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "ck_product_image_size_bytes_positive"
        CHECK ("sizeBytes" > 0),
    CONSTRAINT "ck_product_image_width_positive"
        CHECK ("width" > 0),
    CONSTRAINT "ck_product_image_height_positive"
        CHECK ("height" > 0),
    CONSTRAINT "ck_product_image_mime_type"
        CHECK ("mimeType" IN ('image/jpeg', 'image/png', 'image/webp', 'image/avif')),
    CONSTRAINT "ck_product_image_sort_order_non_negative"
        CHECK ("sortOrder" >= 0),
    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductImage_productVersionId_idx" ON "ProductImage"("productVersionId");

-- CreateIndex
CREATE INDEX "ProductImage_productVersionId_isPublic_sortOrder_idx" ON "ProductImage"("productVersionId", "isPublic", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductImage_productVersionId_isPrimary_idx" ON "ProductImage"("productVersionId", "isPrimary");

-- CreateIndex
CREATE INDEX "ProductImage_checksumSha256_idx" ON "ProductImage"("checksumSha256");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_storageProvider_storageBucket_storageKey_key" ON "ProductImage"("storageProvider", "storageBucket", "storageKey");

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productVersionId_fkey" FOREIGN KEY ("productVersionId") REFERENCES "ProductVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
