-- Additive structure only. Existing organizations require an explicitly approved enrollment.
CREATE TABLE "OrganizationEntitlementEnrollment" (
 "organizationId" uuid PRIMARY KEY REFERENCES "Organization"(id) ON DELETE RESTRICT,
 "enrolledAt" timestamp(3) NOT NULL,
 "trialStartedAt" timestamp(3), "trialEndsAt" timestamp(3),
 "lifetimeCreatedProducts" integer NOT NULL DEFAULT 0 CHECK ("lifetimeCreatedProducts" >= 0),
 "exceptionStartsAt" timestamp(3), "exceptionEndsAt" timestamp(3), "exceptionLimits" jsonb,
 "reason" text NOT NULL CHECK(length("reason") BETWEEN 1 AND 1000),
 CHECK (("trialStartedAt" IS NULL AND "trialEndsAt" IS NULL) OR
        ("trialStartedAt" IS NOT NULL AND "trialEndsAt" > "trialStartedAt")),
 CHECK (("exceptionStartsAt" IS NULL AND "exceptionEndsAt" IS NULL AND "exceptionLimits" IS NULL) OR
        ("exceptionStartsAt" IS NOT NULL AND "exceptionEndsAt" > "exceptionStartsAt" AND "exceptionLimits" IS NOT NULL))
);
CREATE TABLE "PlatformRegulatoryGrant" (
 "userId" uuid PRIMARY KEY REFERENCES "User"(id) ON DELETE RESTRICT,
 "grantedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "revokedAt" timestamp(3)
);
ALTER TABLE "Product" ADD COLUMN "regulatoryClassification" text NOT NULL DEFAULT 'UNRESOLVED',
 ADD COLUMN "regulatoryClassifiedAt" timestamp(3), ADD COLUMN "regulatoryClassifiedById" uuid REFERENCES "User"(id),
 ADD COLUMN "regulatoryReason" text,
 ADD CONSTRAINT "Product_regulatory_classification" CHECK (
 "regulatoryClassification" IN ('VOLUNTARY','MANDATORY','UNRESOLVED') AND
 (("regulatoryClassifiedAt" IS NULL AND "regulatoryClassifiedById" IS NULL AND "regulatoryReason" IS NULL AND "regulatoryClassification"='UNRESOLVED') OR
 ("regulatoryClassifiedAt" IS NOT NULL AND "regulatoryClassifiedById" IS NOT NULL AND length("regulatoryReason") BETWEEN 1 AND 1000)));
CREATE FUNCTION passvero_immutable_enrollment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'entitlement enrollment cannot be deleted'; END IF;
 IF (NEW."organizationId",NEW."enrolledAt",NEW."trialStartedAt",NEW."trialEndsAt",NEW."exceptionStartsAt",NEW."exceptionEndsAt",NEW."exceptionLimits",NEW.reason)
 IS DISTINCT FROM (OLD."organizationId",OLD."enrolledAt",OLD."trialStartedAt",OLD."trialEndsAt",OLD."exceptionStartsAt",OLD."exceptionEndsAt",OLD."exceptionLimits",OLD.reason)
 OR NEW."lifetimeCreatedProducts" < OLD."lifetimeCreatedProducts" THEN
 RAISE EXCEPTION 'entitlement enrollment cannot be reset'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "immutable_entitlement_enrollment" BEFORE UPDATE OR DELETE ON "OrganizationEntitlementEnrollment" FOR EACH ROW EXECUTE FUNCTION passvero_immutable_enrollment();
CREATE FUNCTION passvero_count_lifetime_product() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE "OrganizationEntitlementEnrollment" SET "lifetimeCreatedProducts"="lifetimeCreatedProducts"+1 WHERE "organizationId"=NEW."organizationId";
 RETURN NEW;
END $$;
CREATE TRIGGER "count_lifetime_product" AFTER INSERT ON "Product" FOR EACH ROW EXECUTE FUNCTION passvero_count_lifetime_product();

INSERT INTO "Plan" (id,name,slug,status,"currencyCode","monthlyPrice","quarterlyPrice","yearlyPrice","maxProducts","maxActivePassports","maxStorageBytes",features,"isPublic","sortOrder","updatedAt")
VALUES ('e65224d6-1708-4ad7-b4c3-22ba6b4cd119','Trial','trial','ACTIVE','EUR',0,0,0,3,3,104857600,'{"maxPdfAttachments":5}',false,0,CURRENT_TIMESTAMP)
ON CONFLICT (slug) DO NOTHING;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM "Plan" WHERE slug='trial' AND status='ACTIVE' AND "maxProducts"=3 AND "maxActivePassports"=3 AND "maxStorageBytes"=104857600 AND features->>'maxPdfAttachments'='5') THEN RAISE EXCEPTION 'trial catalog requires review'; END IF;
END $$;
