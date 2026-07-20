-- CreateTable
CREATE TABLE "ProductMaterial" (
    "id" UUID NOT NULL,
    "productVersionId" UUID NOT NULL,
    "materialName" TEXT NOT NULL,
    "category" TEXT,
    "percentage" DECIMAL(5,2),
    "isRecycled" BOOLEAN NOT NULL DEFAULT false,
    "recycledPercentage" DECIMAL(5,2),
    "supplier" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductMaterial_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_product_material_percentage_range"
        CHECK ("percentage" IS NULL OR ("percentage" >= 0 AND "percentage" <= 100)),
    CONSTRAINT "ck_product_material_recycled_percentage_range"
        CHECK ("recycledPercentage" IS NULL OR ("recycledPercentage" >= 0 AND "recycledPercentage" <= 100)),
    CONSTRAINT "ck_product_material_recycled_consistency"
        CHECK ("isRecycled" = true OR "recycledPercentage" IS NULL)
);

-- CreateIndex
CREATE INDEX "ProductMaterial_productVersionId_idx" ON "ProductMaterial"("productVersionId");

-- AddForeignKey
ALTER TABLE "ProductMaterial" ADD CONSTRAINT "ProductMaterial_productVersionId_fkey" FOREIGN KEY ("productVersionId") REFERENCES "ProductVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
