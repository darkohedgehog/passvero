-- CreateTable
CREATE TABLE "EconomicOperator" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "addressLine1" VARCHAR(200) NOT NULL,
    "addressLine2" VARCHAR(200),
    "city" VARCHAR(100) NOT NULL,
    "region" VARCHAR(100),
    "postalCode" VARCHAR(32),
    "countryCode" VARCHAR(2) NOT NULL,
    "publicEmail" VARCHAR(254),
    "website" VARCHAR(2048),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EconomicOperator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVersionManufacturer" (
    "productVersionId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "economicOperatorId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "addressLine1" VARCHAR(200) NOT NULL,
    "addressLine2" VARCHAR(200),
    "city" VARCHAR(100) NOT NULL,
    "region" VARCHAR(100),
    "postalCode" VARCHAR(32),
    "countryCode" VARCHAR(2) NOT NULL,
    "publicEmail" VARCHAR(254),
    "website" VARCHAR(2048),

    CONSTRAINT "ProductVersionManufacturer_pkey" PRIMARY KEY ("productVersionId")
);

-- CreateIndex
CREATE INDEX "EconomicOperator_organizationId_name_id_idx" ON "EconomicOperator"("organizationId", "name", "id");

-- CreateIndex
CREATE UNIQUE INDEX "EconomicOperator_id_organizationId_key" ON "EconomicOperator"("id", "organizationId");

-- CreateIndex
CREATE INDEX "ProductVersionManufacturer_economicOperatorId_organizationI_idx" ON "ProductVersionManufacturer"("economicOperatorId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVersionManufacturer_productVersionId_organizationId_key" ON "ProductVersionManufacturer"("productVersionId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVersion_id_organizationId_key" ON "ProductVersion"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "EconomicOperator" ADD CONSTRAINT "EconomicOperator_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVersionManufacturer" ADD CONSTRAINT "ProductVersionManufacturer_productVersionId_organizationId_fkey" FOREIGN KEY ("productVersionId", "organizationId") REFERENCES "ProductVersion"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVersionManufacturer" ADD CONSTRAINT "ProductVersionManufacturer_economicOperatorId_organization_fkey" FOREIGN KEY ("economicOperatorId", "organizationId") REFERENCES "EconomicOperator"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
