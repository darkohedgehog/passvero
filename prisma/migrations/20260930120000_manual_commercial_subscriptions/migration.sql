BEGIN;
ALTER TABLE "Plan" ADD COLUMN "quarterlyPrice" DECIMAL(12,2);
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_quarterlyPrice_check" CHECK ("quarterlyPrice" IS NULL OR "quarterlyPrice" >= 0);
CREATE TABLE "PlatformBillingGrant" (
 "userId" UUID PRIMARY KEY REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "revokedAt" TIMESTAMP(3)
);
CREATE TABLE "CommercialRequest" (
 "id" UUID PRIMARY KEY, "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "idempotencyKey" UUID NOT NULL, "payloadHash" TEXT NOT NULL, "planSlug" TEXT NOT NULL CHECK ("planSlug" IN ('start','business','pro','custom')),
 "months" INTEGER NOT NULL CHECK ("months" IN (3,12)), "status" TEXT NOT NULL DEFAULT 'REQUESTED' CHECK ("status" IN ('REQUESTED','OFFERED','ACCEPTED','PAID','REPLACED')),
 "acceptedOfferId" UUID UNIQUE, "acceptedAt" TIMESTAMP(3), "createdById" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 UNIQUE ("organizationId","idempotencyKey"),
 CHECK (("acceptedOfferId" IS NULL) = ("acceptedAt" IS NULL)),
 CHECK ("status" NOT IN ('ACCEPTED','PAID') OR "acceptedOfferId" IS NOT NULL)
);
CREATE INDEX "CommercialRequest_organizationId_createdAt_idx" ON "CommercialRequest"("organizationId","createdAt");
CREATE UNIQUE INDEX "CommercialRequest_one_open_per_org" ON "CommercialRequest"("organizationId") WHERE "status" IN ('REQUESTED','OFFERED','ACCEPTED');
CREATE TABLE "CommercialOffer" (
 "revision" INTEGER NOT NULL CHECK ("revision">0),
 "id" UUID PRIMARY KEY, "requestId" UUID NOT NULL REFERENCES "CommercialRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "issuer" TEXT NOT NULL, "referenceYear" INTEGER NOT NULL CHECK ("referenceYear" BETWEEN 2000 AND 9999), "referenceNumber" TEXT NOT NULL,
 "snapshot" JSONB NOT NULL CHECK (jsonb_typeof("snapshot") = 'object'), "createdById" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL,
 UNIQUE ("issuer","referenceYear","referenceNumber"), CHECK ("expiresAt" > "createdAt")
);
CREATE UNIQUE INDEX "CommercialOffer_requestId_revision_key" ON "CommercialOffer"("requestId","revision");
CREATE INDEX "CommercialOffer_requestId_createdAt_idx" ON "CommercialOffer"("requestId","createdAt");
ALTER TABLE "CommercialRequest" ADD CONSTRAINT "CommercialRequest_acceptedOfferId_fkey" FOREIGN KEY ("acceptedOfferId") REFERENCES "CommercialOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "SubscriptionPaidPeriod" (
 "id" UUID PRIMARY KEY, "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "requestId" UUID NOT NULL UNIQUE REFERENCES "CommercialRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "offerId" UUID NOT NULL UNIQUE REFERENCES "CommercialOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "planSlug" TEXT NOT NULL CHECK ("planSlug" IN ('start','business','pro','custom')),
 "startsAt" TIMESTAMP(3) NOT NULL, "endsAt" TIMESTAMP(3) NOT NULL CHECK ("endsAt">"startsAt"), "anchor" JSONB NOT NULL,
 "snapshot" JSONB NOT NULL CHECK (jsonb_typeof("snapshot")='object'), "paymentKind" TEXT NOT NULL CHECK ("paymentKind" IN ('BANK_TRANSFER','SIMULATED_PAYMENT')),
 "issuer" TEXT NOT NULL, "referenceYear" INTEGER NOT NULL CHECK ("referenceYear" BETWEEN 2000 AND 9999), "referenceNumber" TEXT NOT NULL,
 "confirmedById" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT, "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("issuer","referenceYear","referenceNumber")
);
CREATE INDEX "SubscriptionPaidPeriod_organizationId_startsAt_endsAt_idx" ON "SubscriptionPaidPeriod"("organizationId","startsAt","endsAt");
CREATE FUNCTION commercial_immutable_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Commercial evidence is immutable'; END; $$;
CREATE TRIGGER "CommercialOffer_immutable" BEFORE UPDATE OR DELETE ON "CommercialOffer" FOR EACH ROW EXECUTE FUNCTION commercial_immutable_record();
CREATE TRIGGER "SubscriptionPaidPeriod_immutable" BEFORE UPDATE OR DELETE ON "SubscriptionPaidPeriod" FOR EACH ROW EXECUTE FUNCTION commercial_immutable_record();
CREATE FUNCTION commercial_request_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."organizationId" IS DISTINCT FROM OLD."organizationId" OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey" OR NEW."payloadHash" IS DISTINCT FROM OLD."payloadHash" OR NEW."planSlug" IS DISTINCT FROM OLD."planSlug" OR NEW."months" IS DISTINCT FROM OLD."months" OR NEW."createdById" IS DISTINCT FROM OLD."createdById" OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
  RAISE EXCEPTION 'Commercial request identity is immutable';
 END IF;
 IF OLD."acceptedOfferId" IS NOT NULL AND (NEW."acceptedOfferId" IS DISTINCT FROM OLD."acceptedOfferId" OR NEW."acceptedAt" IS DISTINCT FROM OLD."acceptedAt") THEN RAISE EXCEPTION 'Commercial acceptance is immutable'; END IF;
 IF NOT ((OLD.status='REQUESTED' AND NEW.status IN ('OFFERED','REPLACED')) OR (OLD.status='OFFERED' AND NEW.status IN ('OFFERED','ACCEPTED','REPLACED')) OR (OLD.status='ACCEPTED' AND NEW.status IN ('PAID','REPLACED'))) THEN RAISE EXCEPTION 'Invalid commercial transition'; END IF;
 IF NEW."acceptedOfferId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "CommercialOffer" WHERE id=NEW."acceptedOfferId" AND "requestId"=NEW.id) THEN RAISE EXCEPTION 'Offer does not belong to request'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "CommercialRequest_transition" BEFORE UPDATE ON "CommercialRequest" FOR EACH ROW EXECUTE FUNCTION commercial_request_transition();
CREATE FUNCTION commercial_paid_period_check() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM "id" FROM "Organization" WHERE "id"=NEW."organizationId" FOR UPDATE;
 IF NOT EXISTS (SELECT 1 FROM "CommercialRequest" r JOIN "CommercialOffer" o ON o.id=NEW."offerId" WHERE r.id=NEW."requestId" AND r."organizationId"=NEW."organizationId" AND r."acceptedOfferId"=o.id AND r.status='ACCEPTED' AND o."requestId"=r.id AND o.snapshot=NEW.snapshot AND r."planSlug"=NEW."planSlug") THEN RAISE EXCEPTION 'Payment requires matching accepted offer'; END IF;
 IF EXISTS (SELECT 1 FROM "SubscriptionPaidPeriod" WHERE "organizationId"=NEW."organizationId" AND "startsAt" < NEW."endsAt" AND "endsAt" > NEW."startsAt") THEN RAISE EXCEPTION 'Paid periods overlap'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "SubscriptionPaidPeriod_check" BEFORE INSERT ON "SubscriptionPaidPeriod" FOR EACH ROW EXECUTE FUNCTION commercial_paid_period_check();

-- Insert the approved catalog only where absent. Existing slugs require explicit reconciliation.
INSERT INTO "Plan" (id,name,slug,status,"currencyCode","monthlyPrice","quarterlyPrice","yearlyPrice","maxProducts","maxActivePassports","maxStorageBytes",features,"isPublic","sortOrder","updatedAt") VALUES
('f5960733-b2c2-4001-aadb-4982f0585011','Start','start','ACTIVE','EUR',0,147,490,100,25,2147483648,'{"maxPdfAttachments":10}',true,1,CURRENT_TIMESTAMP),
('f5960733-b2c2-4001-aadb-4982f0585012','Business','business','ACTIVE','EUR',0,297,990,400,100,10737418240,'{"maxPdfAttachments":10}',true,2,CURRENT_TIMESTAMP),
('f5960733-b2c2-4001-aadb-4982f0585013','Pro','pro','ACTIVE','EUR',0,597,1990,2000,500,53687091200,'{"maxPdfAttachments":10}',true,3,CURRENT_TIMESTAMP),
('f5960733-b2c2-4001-aadb-4982f0585014','Custom','custom','ACTIVE','EUR',0,NULL,0,NULL,NULL,NULL,'{}',false,4,CURRENT_TIMESTAMP)
ON CONFLICT (slug) DO NOTHING;
DO $$ BEGIN
 IF EXISTS (
  SELECT 1 FROM "Plan" p JOIN (VALUES ('start',147,490,100,25,2147483648::bigint),('business',297,990,400,100,10737418240::bigint),('pro',597,1990,2000,500,53687091200::bigint)) expected(slug,quarterly,yearly,stored,published,bytes) ON p.slug=expected.slug
  WHERE p.status<>'ACTIVE' OR p."currencyCode"<>'EUR' OR p."quarterlyPrice" IS DISTINCT FROM expected.quarterly OR p."yearlyPrice" IS DISTINCT FROM expected.yearly OR p."maxProducts" IS DISTINCT FROM expected.stored OR p."maxActivePassports" IS DISTINCT FROM expected.published OR p."maxStorageBytes" IS DISTINCT FROM expected.bytes OR (p.features->>'maxPdfAttachments') IS DISTINCT FROM '10'
 ) THEN RAISE EXCEPTION 'Existing standard Plan requires explicit commercial catalog reconciliation before migration'; END IF;
 IF EXISTS (SELECT 1 FROM "Plan" WHERE slug='custom' AND (status<>'ACTIVE' OR "currencyCode"<>'EUR')) THEN RAISE EXCEPTION 'Existing Custom Plan requires explicit commercial catalog reconciliation before migration'; END IF;
END; $$;

COMMIT;
