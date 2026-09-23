-- Additive, optional profile. No backfill or change to existing organization identity.
CREATE TABLE "OrganizationBillingProfile" (
 "organizationId" UUID NOT NULL PRIMARY KEY,
 "legalName" VARCHAR(200) NOT NULL,
 "addressLine1" VARCHAR(200) NOT NULL,
 "addressLine2" VARCHAR(200),
 "city" VARCHAR(100) NOT NULL,
 "postalCode" VARCHAR(32),
 "countryCode" VARCHAR(2) NOT NULL,
 "billingEmail" VARCHAR(254) NOT NULL,
 "taxIdentifier" VARCHAR(64),
 "vatIdentifier" VARCHAR(64),
 "revision" INTEGER NOT NULL DEFAULT 1 CHECK ("revision" > 0),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "OrganizationBillingProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "OrganizationBillingProfile_required_check" CHECK (length(btrim("legalName")) > 0 AND length(btrim("addressLine1")) > 0 AND length(btrim("city")) > 0 AND length(btrim("billingEmail")) > 0 AND "countryCode" ~ '^[A-Z]{2}$')
);
