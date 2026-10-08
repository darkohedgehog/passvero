CREATE TABLE "ReminderEnrollmentPolicy" (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id=1),
  enabled BOOLEAN NOT NULL DEFAULT false,
  "enabledAt" TIMESTAMP(3),
  "approvalReference" VARCHAR(200) NOT NULL,
  "excludedOrganizationIds" JSONB NOT NULL DEFAULT '[]',
  CHECK (NOT enabled OR "enabledAt" IS NOT NULL),
  CHECK (jsonb_typeof("excludedOrganizationIds")='array')
);
INSERT INTO "ReminderEnrollmentPolicy" ("approvalReference") VALUES ('NOT_ENABLED');
CREATE TABLE "OrganizationReminderEnrollment" (
  "organizationId" UUID PRIMARY KEY REFERENCES "Organization"(id) ON DELETE RESTRICT,
  "activationId" UUID UNIQUE REFERENCES "AccountActivationIntent"(id) ON DELETE RESTRICT,
  "enrolledAt" TIMESTAMP(3) NOT NULL,
  origin VARCHAR(32) NOT NULL CHECK (origin IN ('CONTROLLED_ACTIVATION','EXISTING_APPROVED')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  "excludedAt" TIMESTAMP(3),
  "approvalReference" VARCHAR(200) NOT NULL,
  "lastCheckedAt" TIMESTAMP(3), "lastError" TEXT,
  CHECK (origin<>'CONTROLLED_ACTIVATION' OR "activationId" IS NOT NULL),
  CHECK (NOT enabled OR "excludedAt" IS NULL)
);
ALTER TABLE "ReminderCampaign"
  ADD COLUMN "enrollmentOrganizationId" UUID REFERENCES "OrganizationReminderEnrollment"("organizationId") ON DELETE RESTRICT,
  ADD COLUMN "periodKey" VARCHAR(100),
  ADD COLUMN "automaticRecipients" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "ReminderCampaign_enrollmentOrganizationId_periodKey_key" ON "ReminderCampaign"("enrollmentOrganizationId","periodKey");
ALTER TABLE "ReminderCampaign" DROP CONSTRAINT reminder_campaign_budget;
ALTER TABLE "ReminderCampaign" ADD CONSTRAINT reminder_campaign_budget CHECK (
  "maxDispatches" BETWEEN 1 AND 100000 AND dispatches BETWEEN 0 AND "maxDispatches" AND
  ("enrollmentOrganizationId" IS NOT NULL OR "maxDispatches"<=100));
ALTER TABLE "ReminderCampaign" DROP CONSTRAINT reminder_campaign_scope;
ALTER TABLE "ReminderCampaign" ADD CONSTRAINT reminder_campaign_scope CHECK (
  jsonb_typeof("organizationIds")='array' AND jsonb_array_length("organizationIds") BETWEEN 1 AND 25 AND
  jsonb_typeof("recipientEmails")='array' AND jsonb_array_length("recipientEmails") BETWEEN CASE WHEN "automaticRecipients" THEN 0 ELSE 1 END AND 32 AND
  jsonb_typeof("operatorEmails")='array' AND jsonb_array_length("operatorEmails")<=16 AND
  jsonb_typeof("messageKinds")='array' AND jsonb_array_length("messageKinds") BETWEEN 1 AND 2 AND
  (NOT "automaticRecipients" OR ("enrollmentOrganizationId" IS NOT NULL AND "periodKey" IS NOT NULL AND
    "organizationIds"=jsonb_build_array("enrollmentOrganizationId"::text) AND "messageKinds"='["SUBSCRIPTION"]' AND "operatorEmails"='[]')) AND
  (("enrollmentOrganizationId" IS NULL)=("periodKey" IS NULL)));

-- Runtime can execute these constrained writes, never edit policy/approval fields.
CREATE FUNCTION record_reminder_enrollment(p_org UUID, p_activation UUID) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE policy public."ReminderEnrollmentPolicy"%ROWTYPE; inserted INTEGER;
BEGIN
  SELECT * INTO policy FROM public."ReminderEnrollmentPolicy" WHERE id=1 FOR SHARE;
  IF NOT policy.enabled OR policy."enabledAt" IS NULL OR policy."excludedOrganizationIds" ? p_org::text THEN RETURN false; END IF;
  INSERT INTO public."OrganizationReminderEnrollment" ("organizationId","activationId","enrolledAt",origin,"approvalReference")
  SELECT o.id,a.id,a."boundAt",'CONTROLLED_ACTIVATION',policy."approvalReference"
  FROM public."Organization" o
  JOIN public."AccessRequest" r ON r."organizationId"=o.id AND r.status='APPROVED' AND r."activationId"=p_activation
  JOIN public."AccountActivationIntent" a ON a.id=r."activationId" AND a."userId"=r."userId" AND a.status='BOUND'
  JOIN public."OrganizationEntitlementEnrollment" e ON e."organizationId"=o.id AND e."trialStartedAt"=a."boundAt" AND e."trialEndsAt">a."boundAt"
  WHERE o.id=p_org AND o.status='ACTIVE' AND o."createdAt">=policy."enabledAt" AND a."boundAt">=policy."enabledAt" AND a."boundAt">=o."createdAt"
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted=ROW_COUNT;
  RETURN inserted=1;
END $$;

CREATE FUNCTION create_period_reminder_campaign(p_org UUID, p_key TEXT, p_at TIMESTAMP(3)) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE policy public."ReminderEnrollmentPolicy"%ROWTYPE; deadline TIMESTAMP(3); expiration TIMESTAMP(3); campaign UUID; inserted INTEGER;
BEGIN
  SELECT * INTO policy FROM public."ReminderEnrollmentPolicy" WHERE id=1 FOR SHARE;
  IF NOT policy.enabled OR NOT EXISTS (SELECT 1 FROM public."OrganizationReminderEnrollment" WHERE "organizationId"=p_org AND enabled AND "excludedAt" IS NULL) THEN RETURN NULL; END IF;
  SELECT id INTO campaign FROM public."ReminderCampaign" WHERE "enrollmentOrganizationId"=p_org AND "periodKey"=p_key;
  IF campaign IS NOT NULL THEN RETURN campaign; END IF;
  SELECT e."trialEndsAt" INTO deadline FROM public."OrganizationEntitlementEnrollment" e
    WHERE e."organizationId"=p_org AND p_key='trial:'||to_char(e."trialStartedAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  IF deadline IS NULL THEN
    SELECT p."endsAt" INTO deadline FROM public."SubscriptionPaidPeriod" p
    LEFT JOIN public."SubscriptionPaidPeriodActivation" a ON a."periodId"=p.id
    WHERE p."organizationId"=p_org AND p_key='paid:'||p.id::text AND p."startsAt"<=p_at AND (a.status IS NULL OR a.status='ACTIVE');
  END IF;
  IF deadline IS NULL THEN RETURN NULL; END IF;
  expiration := (((deadline AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Zagreb') + interval '7 days') AT TIME ZONE 'Europe/Zagreb' AT TIME ZONE 'UTC';
  -- Match the existing calendar resolver: advance a DST gap, choose the earlier overlap.
  IF ((expiration AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Zagreb') = (((expiration - interval '1 hour') AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Zagreb') THEN
    expiration := expiration - interval '1 hour';
  END IF;
  INSERT INTO public."ReminderCampaign" (id,"enrollmentOrganizationId","periodKey","automaticRecipients","organizationIds","recipientEmails","operatorEmails","messageKinds","maxDispatches",enabled,"expiresAt","approvalReference")
  VALUES (gen_random_uuid(),p_org,p_key,true,jsonb_build_array(p_org::text),'[]','[]','["SUBSCRIPTION"]',384,true,
    expiration,policy."approvalReference")
  ON CONFLICT ("enrollmentOrganizationId","periodKey") DO NOTHING;
  GET DIAGNOSTICS inserted=ROW_COUNT;
  SELECT id INTO campaign FROM public."ReminderCampaign" WHERE "enrollmentOrganizationId"=p_org AND "periodKey"=p_key;
  IF inserted=1 THEN
    INSERT INTO public."AuditLog" (id,"organizationId",action,"entityType","entityId",metadata,"correlationId","createdAt")
    VALUES (gen_random_uuid(),p_org,'REMINDER_PERIOD_CAMPAIGN_CREATED','REMINDER_CAMPAIGN',campaign::text,
      jsonb_build_object('periodKey',p_key,'maxDispatches',384,'approvalReference',policy."approvalReference"),gen_random_uuid()::text,CURRENT_TIMESTAMP);
  END IF;
  RETURN campaign;
END $$;
REVOKE ALL ON FUNCTION record_reminder_enrollment(UUID,UUID), create_period_reminder_campaign(UUID,TEXT,TIMESTAMP) FROM PUBLIC;

CREATE FUNCTION lock_reminder_enrollment_gate() RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT enabled FROM public."ReminderEnrollmentPolicy" WHERE id=1 FOR SHARE
$$;
REVOKE ALL ON FUNCTION lock_reminder_enrollment_gate() FROM PUBLIC;

CREATE FUNCTION preserve_reminder_enrollment_provenance() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'reminder provenance must be retained'; END IF;
  IF TG_TABLE_NAME='ReminderEnrollmentPolicy' THEN
    IF OLD."enabledAt" IS NOT NULL AND (NEW."enabledAt" IS DISTINCT FROM OLD."enabledAt" OR
      NOT (NEW."excludedOrganizationIds" @> OLD."excludedOrganizationIds")) THEN
      RAISE EXCEPTION 'original reminder boundary and historical exclusions must be retained';
    END IF;
  ELSIF NEW."organizationId" IS DISTINCT FROM OLD."organizationId" OR NEW."activationId" IS DISTINCT FROM OLD."activationId" OR
    NEW."enrolledAt" IS DISTINCT FROM OLD."enrolledAt" OR NEW.origin IS DISTINCT FROM OLD.origin OR
    NEW."approvalReference" IS DISTINCT FROM OLD."approvalReference" OR (OLD."excludedAt" IS NOT NULL AND NEW.enabled) THEN
    RAISE EXCEPTION 'reminder enrollment provenance or explicit exclusion cannot be overwritten';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER reminder_policy_provenance BEFORE UPDATE OR DELETE ON "ReminderEnrollmentPolicy" FOR EACH ROW EXECUTE FUNCTION preserve_reminder_enrollment_provenance();
CREATE TRIGGER reminder_organization_provenance BEFORE UPDATE OR DELETE ON "OrganizationReminderEnrollment" FOR EACH ROW EXECUTE FUNCTION preserve_reminder_enrollment_provenance();
