-- USER APPROVED 2026-10-08. Execute only through the pinned operator procedure.
-- Operator wrapper must verify deployed package/runtime pins and drain the timer.
-- No worker or SMTP invocation here; the guarded normal-cycle proof follows approval.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL TIME ZONE 'UTC';
LOCK TABLE "Organization" IN SHARE MODE;
LOCK TABLE "ReminderCampaign", "OrganizationReminderEnrollment" IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE boundary TIMESTAMP(3); org UUID := 'ee116a32-05e8-401f-a90f-b54b31b3b7e9';
        campaign UUID := 'a24b67dd-442c-4f06-b4f3-498554b4ff31';
        approval TEXT := 'USER_APPROVED_FUTURE_REMINDER_ENROLLMENT_20261008';
BEGIN
  PERFORM id FROM "ReminderEnrollmentPolicy" WHERE id=1 FOR UPDATE;
  IF (SELECT count(*) FROM "ReminderEnrollmentPolicy" WHERE id=1 AND NOT enabled AND "enabledAt" IS NULL AND "approvalReference"='NOT_ENABLED' AND "excludedOrganizationIds"='[]')<>1
    OR EXISTS (SELECT 1 FROM "OrganizationReminderEnrollment")
    OR EXISTS (SELECT 1 FROM "ReminderCampaign" WHERE "enrollmentOrganizationId" IS NOT NULL OR "periodKey" IS NOT NULL OR "automaticRecipients") THEN
    RAISE EXCEPTION 'initial policy/enrollment scope drift; no retry';
  END IF;
  IF (SELECT jsonb_agg(id::text ORDER BY id) FROM "Organization")<> '["2a9a42d5-9d24-4003-aca7-fb3a7bf155f9","2f6ef99e-4cc9-4127-8562-ab7d3ea2e622","371ef379-7e1f-5775-842f-9eba78838046","6ba064b9-517b-4bea-8627-28aefc8d6fa4","6d686789-6379-4824-ae02-df97043cbbc0","7c3a894e-34e0-4897-b61d-df9e672f5340","8504ae2e-059e-5b7d-974d-175e3d3c39c1","8c789610-9953-58c8-9cd7-1b5815dd6fd4","bdc5aed5-b05a-42e6-895b-9f2f9f8a79a0","c7f37fd1-10c0-40f8-a66d-c99b14e92635","d9d1c9f6-9fee-4df1-8623-02085eb2e9de","da02e9b0-645e-42f1-96aa-4808d32c857d","ee116a32-05e8-401f-a90f-b54b31b3b7e9","ffe171d1-b6a6-43d5-83bb-890e2fa23c9f"]'::jsonb THEN
    RAISE EXCEPTION 'organization inventory drift; reproject before enable';
  END IF;
  IF (SELECT count(*) FROM "ReminderCampaign")<>3 OR
    (SELECT count(*) FROM "ReminderCampaign" WHERE enabled)<>1 OR
    NOT EXISTS (SELECT 1 FROM "ReminderCampaign" WHERE id=campaign AND enabled AND "maxDispatches"=12 AND dispatches=0
      AND "organizationIds"=jsonb_build_array(org::text) AND "recipientEmails"='["milanko.zivic@optinet.hr"]'
      AND "operatorEmails"='[]' AND "messageKinds"='["SUBSCRIPTION"]'
      AND "expiresAt"='2027-04-06T15:27:58.877Z'::timestamp
      AND "leaseToken" IS NULL AND "leaseUntil" IS NULL
      AND "approvalReference"='USER_APPROVED_STAGING_AUTOMATION_20261007') THEN
    RAISE EXCEPTION 'approved campaign scope/counter drift';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "Organization" o JOIN "OrganizationEntitlementEnrollment" e ON e."organizationId"=o.id
      WHERE o.id=org AND o.status='ACTIVE' AND e."trialStartedAt"='2026-10-05T15:27:58.877Z'::timestamp
      AND e."trialEndsAt"='2027-04-05T15:27:58.877Z'::timestamp AND e."exceptionStartsAt" IS NULL AND e."exceptionEndsAt" IS NULL)
    OR EXISTS (SELECT 1 FROM "SubscriptionPaidPeriod" WHERE "organizationId"=org)
    OR clock_timestamp()>='2027-03-06T16:27:58.877Z'::timestamptz THEN
    RAISE EXCEPTION 'trial/period/due scope drift';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "Membership" m JOIN "User" u ON u.id=m."userId"
      WHERE m."organizationId"=org AND m.role='OWNER' AND m.status='ACTIVE' AND u.id='b128ff32-11fd-4de7-bad0-f2fa66a56c75'
      AND lower(btrim(u.email))='milanko.zivic@optinet.hr'
      AND (SELECT count(*) FROM "AuthIdentity" i WHERE i."userId"=u.id AND i.provider='BETTER_AUTH' AND i."revokedAt" IS NULL)=1
      AND (SELECT count(*) FROM "AuthIdentity" i JOIN "AuthProviderUser" a ON a.id=i."providerSubject" AND a.email=u.email AND a."emailVerified"
        WHERE i."userId"=u.id AND i.provider='BETTER_AUTH' AND i."revokedAt" IS NULL)=1) THEN
    RAISE EXCEPTION 'approved verified recipient drift';
  END IF;
  IF (SELECT count(*) FROM "SubscriptionReminder")<>6
    OR EXISTS (SELECT 1 FROM "SubscriptionReminder" WHERE status NOT IN ('SENT','CANCELLED'))
    OR (SELECT count(*) FROM "ReminderAttempt")<>4
    OR EXISTS (SELECT 1 FROM "ReminderAttempt" WHERE status<>'ACCEPTED') THEN
    RAISE EXCEPTION 'delivery history requires reconciliation; no blind retry';
  END IF;
  boundary := clock_timestamp() AT TIME ZONE 'UTC';
  UPDATE "ReminderEnrollmentPolicy" SET enabled=true, "enabledAt"=boundary, "approvalReference"=approval,
    "excludedOrganizationIds"='["2a9a42d5-9d24-4003-aca7-fb3a7bf155f9","2f6ef99e-4cc9-4127-8562-ab7d3ea2e622","371ef379-7e1f-5775-842f-9eba78838046","6ba064b9-517b-4bea-8627-28aefc8d6fa4","6d686789-6379-4824-ae02-df97043cbbc0","7c3a894e-34e0-4897-b61d-df9e672f5340","8504ae2e-059e-5b7d-974d-175e3d3c39c1","8c789610-9953-58c8-9cd7-1b5815dd6fd4","bdc5aed5-b05a-42e6-895b-9f2f9f8a79a0","c7f37fd1-10c0-40f8-a66d-c99b14e92635","d9d1c9f6-9fee-4df1-8623-02085eb2e9de","da02e9b0-645e-42f1-96aa-4808d32c857d","ffe171d1-b6a6-43d5-83bb-890e2fa23c9f"]'::jsonb WHERE id=1;
  INSERT INTO "OrganizationReminderEnrollment" ("organizationId","activationId","enrolledAt",origin,enabled,"approvalReference")
    VALUES (org,NULL,boundary,'EXISTING_APPROVED',true,approval);
  -- Preserve the manual current-trial recipient list, expiry, 12/0 budget and approval.
  UPDATE "ReminderCampaign" SET "enrollmentOrganizationId"=org, "periodKey"='trial:2026-10-05T15:27:58.877Z' WHERE id=campaign;
  INSERT INTO "AuditLog" (id,"organizationId",action,"entityType","entityId",metadata,"correlationId","createdAt") VALUES
    (gen_random_uuid(),org,'REMINDER_ENROLLMENT_POLICY_ENABLED','REMINDER_ENROLLMENT_POLICY','1',
      jsonb_build_object('enabledAt',boundary,'approvalReference',approval,'excludedOrganizationIds','["2a9a42d5-9d24-4003-aca7-fb3a7bf155f9","2f6ef99e-4cc9-4127-8562-ab7d3ea2e622","371ef379-7e1f-5775-842f-9eba78838046","6ba064b9-517b-4bea-8627-28aefc8d6fa4","6d686789-6379-4824-ae02-df97043cbbc0","7c3a894e-34e0-4897-b61d-df9e672f5340","8504ae2e-059e-5b7d-974d-175e3d3c39c1","8c789610-9953-58c8-9cd7-1b5815dd6fd4","bdc5aed5-b05a-42e6-895b-9f2f9f8a79a0","c7f37fd1-10c0-40f8-a66d-c99b14e92635","d9d1c9f6-9fee-4df1-8623-02085eb2e9de","da02e9b0-645e-42f1-96aa-4808d32c857d","ffe171d1-b6a6-43d5-83bb-890e2fa23c9f"]'::jsonb),gen_random_uuid()::text,CURRENT_TIMESTAMP),
    (gen_random_uuid(),org,'REMINDER_ORGANIZATION_ENROLLED','ORGANIZATION_REMINDER_ENROLLMENT',org::text,
      jsonb_build_object('origin','EXISTING_APPROVED','approvalReference',approval),gen_random_uuid()::text,CURRENT_TIMESTAMP),
    (gen_random_uuid(),org,'REMINDER_LEGACY_CAMPAIGN_LINKED','REMINDER_CAMPAIGN',campaign::text,
      jsonb_build_object('periodKey','trial:2026-10-05T15:27:58.877Z','maxDispatches',12,'dispatches',0,'approvalReference',approval),gen_random_uuid()::text,CURRENT_TIMESTAMP);
END $$;
COMMIT;
SELECT json_build_object('enabled',enabled,'enabledAt',"enabledAt",'approvalReference',"approvalReference") FROM "ReminderEnrollmentPolicy" WHERE id=1;
