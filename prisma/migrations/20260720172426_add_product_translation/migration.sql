-- CreateTable
CREATE TABLE "ProductTranslation" (
    "id" UUID NOT NULL,
    "productVersionId" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT,
    "technicalDescription" TEXT,
    "repairInstructions" TEXT,
    "sparePartsInformation" TEXT,
    "recyclingInstructions" TEXT,
    "disposalInstructions" TEXT,
    "packagingInformation" TEXT,
    "safetyInformation" TEXT,
    "warrantyInformation" TEXT,
    "publicNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductTranslation_productVersionId_idx" ON "ProductTranslation"("productVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductTranslation_productVersionId_locale_key" ON "ProductTranslation"("productVersionId", "locale");

-- AddForeignKey
ALTER TABLE "ProductTranslation" ADD CONSTRAINT "ProductTranslation_productVersionId_fkey" FOREIGN KEY ("productVersionId") REFERENCES "ProductVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
