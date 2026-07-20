-- CreateEnum
CREATE TYPE "ProductIdentifierType" AS ENUM ('GTIN', 'EAN', 'UPC', 'MPN', 'SKU', 'CUSTOM');

-- CreateTable
CREATE TABLE "ProductIdentifier" (
    "id" UUID NOT NULL,
    "productVersionId" UUID NOT NULL,
    "type" "ProductIdentifierType" NOT NULL,
    "value" TEXT NOT NULL,
    "issuingAuthority" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductIdentifier_productVersionId_idx" ON "ProductIdentifier"("productVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductIdentifier_productVersionId_type_value_key" ON "ProductIdentifier"("productVersionId", "type", "value");

-- AddForeignKey
ALTER TABLE "ProductIdentifier" ADD CONSTRAINT "ProductIdentifier_productVersionId_fkey" FOREIGN KEY ("productVersionId") REFERENCES "ProductVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
