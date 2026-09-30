BEGIN;
ALTER TABLE "CommercialRequest" ADD COLUMN "changeKind" TEXT NOT NULL DEFAULT 'STANDARD' CHECK ("changeKind" IN ('STANDARD','UPGRADE','DOWNGRADE','REPLACEMENT'));
CREATE TABLE "SubscriptionUpgradeReceipt" (
 "sequence" INTEGER NOT NULL CHECK (sequence>0),
 "id" UUID PRIMARY KEY, "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "requestId" UUID NOT NULL UNIQUE REFERENCES "CommercialRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "offerId" UUID NOT NULL UNIQUE REFERENCES "CommercialOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "planSlug" TEXT NOT NULL CHECK ("planSlug" IN ('start','business','pro','custom')),
 "basePeriodId" UUID NOT NULL REFERENCES "SubscriptionPaidPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "startsAt" TIMESTAMP(3) NOT NULL, "endsAt" TIMESTAMP(3) NOT NULL CHECK ("endsAt">"startsAt"),
 "snapshot" JSONB NOT NULL CHECK (jsonb_typeof("snapshot")='object'), "paymentKind" TEXT NOT NULL CHECK ("paymentKind" IN ('BANK_TRANSFER','SIMULATED_PAYMENT')),
 "issuer" TEXT NOT NULL, "referenceYear" INTEGER NOT NULL CHECK ("referenceYear" BETWEEN 2000 AND 9999), "referenceNumber" TEXT NOT NULL,
 "confirmedById" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT, "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("issuer","referenceYear","referenceNumber")
);
CREATE UNIQUE INDEX "SubscriptionUpgradeReceipt_basePeriodId_sequence_key" ON "SubscriptionUpgradeReceipt"("basePeriodId","sequence");
CREATE INDEX "SubscriptionUpgradeReceipt_organizationId_startsAt_endsAt_idx" ON "SubscriptionUpgradeReceipt"("organizationId","startsAt","endsAt");

CREATE TRIGGER "SubscriptionUpgradeReceipt_immutable" BEFORE UPDATE OR DELETE ON "SubscriptionUpgradeReceipt" FOR EACH ROW EXECUTE FUNCTION commercial_immutable_record();
CREATE TABLE "SubscriptionPaidPeriodActivation" (
 "periodId" UUID PRIMARY KEY REFERENCES "SubscriptionPaidPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVE','BLOCKED_REQUIRES_OPERATOR')),
 "reasons" JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(reasons)='array'),
 "checkedAt" TIMESTAMP(3),
 CHECK ((status='PENDING') = ("checkedAt" IS NULL))
);
CREATE FUNCTION commercial_activation_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR OLD.status<>'PENDING' OR NEW.status NOT IN ('ACTIVE','BLOCKED_REQUIRES_OPERATOR') OR NEW."periodId"<>OLD."periodId" THEN RAISE EXCEPTION 'Activation outcome is immutable'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "SubscriptionPaidPeriodActivation_transition" BEFORE UPDATE OR DELETE ON "SubscriptionPaidPeriodActivation" FOR EACH ROW EXECUTE FUNCTION commercial_activation_transition();
CREATE FUNCTION commercial_upgrade_check() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM id FROM "Organization" WHERE id=NEW."organizationId" FOR UPDATE;
 IF NOT EXISTS (SELECT 1 FROM "CommercialRequest" r JOIN "CommercialOffer" o ON o.id=NEW."offerId" JOIN "SubscriptionPaidPeriod" p ON p.id=NEW."basePeriodId" WHERE r.id=NEW."requestId" AND r."organizationId"=NEW."organizationId" AND p."organizationId"=NEW."organizationId" AND r."acceptedOfferId"=o.id AND r.status='ACCEPTED' AND r."changeKind"='UPGRADE' AND o."requestId"=r.id AND o.snapshot=NEW.snapshot AND r."planSlug"=NEW."planSlug" AND NEW."startsAt">=p."startsAt" AND NEW."endsAt"=p."endsAt") THEN RAISE EXCEPTION 'Supplement requires matching accepted offer and base period'; END IF;
 IF EXISTS (SELECT 1 FROM "SubscriptionPaidPeriod" WHERE issuer=NEW.issuer AND "referenceYear"=NEW."referenceYear" AND "referenceNumber"=NEW."referenceNumber") THEN RAISE EXCEPTION 'Payment reference already used'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "SubscriptionUpgradeReceipt_check" BEFORE INSERT ON "SubscriptionUpgradeReceipt" FOR EACH ROW EXECUTE FUNCTION commercial_upgrade_check();
CREATE FUNCTION commercial_change_kind_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."changeKind" IS DISTINCT FROM OLD."changeKind" THEN RAISE EXCEPTION 'Request change kind is immutable'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "CommercialRequest_change_kind" BEFORE UPDATE ON "CommercialRequest" FOR EACH ROW EXECUTE FUNCTION commercial_change_kind_immutable();
CREATE OR REPLACE FUNCTION commercial_paid_period_check() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM "id" FROM "Organization" WHERE "id"=NEW."organizationId" FOR UPDATE;
 IF NOT EXISTS (SELECT 1 FROM "CommercialRequest" r JOIN "CommercialOffer" o ON o.id=NEW."offerId" WHERE r.id=NEW."requestId" AND r."organizationId"=NEW."organizationId" AND r."acceptedOfferId"=o.id AND r.status='ACCEPTED' AND o."requestId"=r.id AND o.snapshot=NEW.snapshot AND r."planSlug"=NEW."planSlug") THEN RAISE EXCEPTION 'Payment requires matching accepted offer'; END IF;
 IF EXISTS (SELECT 1 FROM "SubscriptionPaidPeriod" p WHERE p."organizationId"=NEW."organizationId" AND p."startsAt" < NEW."endsAt" AND p."endsAt" > NEW."startsAt" AND NOT COALESCE((NEW.snapshot->>'changeKind'='REPLACEMENT' AND NEW.snapshot->>'basePeriodId'=p.id::text AND EXISTS (SELECT 1 FROM "SubscriptionPaidPeriodActivation" a WHERE a."periodId"=p.id AND a.status='BLOCKED_REQUIRES_OPERATOR')),false)) THEN RAISE EXCEPTION 'Paid periods overlap'; END IF;
 RETURN NEW;
END; $$;

COMMIT;
