-- CreateTable
CREATE TABLE "ProductDocument" (
    "id" UUID NOT NULL,
    "productVersionId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "locale" TEXT,
    "displayLabel" TEXT,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductDocument_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_product_document_sort_order_non_negative"
        CHECK ("sortOrder" >= 0)
);

-- CreateIndex
CREATE INDEX "ProductDocument_productVersionId_idx" ON "ProductDocument"("productVersionId");

-- CreateIndex
CREATE INDEX "ProductDocument_documentId_idx" ON "ProductDocument"("documentId");

-- CreateIndex
CREATE INDEX "ProductDocument_productVersionId_category_idx" ON "ProductDocument"("productVersionId", "category");

-- CreateIndex
CREATE INDEX "ProductDocument_productVersionId_locale_idx" ON "ProductDocument"("productVersionId", "locale");

-- CreateIndex
CREATE INDEX "ProductDocument_productVersionId_isPublic_sortOrder_idx" ON "ProductDocument"("productVersionId", "isPublic", "sortOrder");

-- AddForeignKey
ALTER TABLE "ProductDocument" ADD CONSTRAINT "ProductDocument_productVersionId_fkey" FOREIGN KEY ("productVersionId") REFERENCES "ProductVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDocument" ADD CONSTRAINT "ProductDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
