-- AlterEnum
ALTER TYPE "ProductIdentifierType" ADD VALUE 'CN';

-- AlterTable
ALTER TABLE "ProductIdentifier" ADD COLUMN "nomenclatureYear" INTEGER;

-- AddCheckConstraint
ALTER TABLE "ProductIdentifier"
ADD CONSTRAINT "ck_product_identifier_cn_nomenclature_year"
CHECK (
    (
        "type" = 'CN'::"ProductIdentifierType"
        AND "nomenclatureYear" IS NOT NULL
    )
    OR (
        "type" <> 'CN'::"ProductIdentifierType"
        AND "nomenclatureYear" IS NULL
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "ux_product_identifier_one_cn_per_version"
ON "ProductIdentifier"("productVersionId")
WHERE "type" = 'CN'::"ProductIdentifierType";
