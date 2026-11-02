-- EXECUTABLE MATERIAL FOR OPERATOR APPROVAL ONLY. Not executed.
-- Same additive grants as reviewed candidate; target/ledger/quiet guards replace approval abort.
BEGIN;
DO $$ BEGIN
 IF current_database() <> 'passvero' OR current_setting('port') <> '5432'
    OR current_setting('data_directory') <> '/var/lib/postgresql/16/main'
    OR session_user <> 'postgres' OR pg_is_in_recovery() THEN
   RAISE EXCEPTION 'PRODUCTION_ACL_TARGET_STOP';
 END IF;
 IF (SELECT count(*) FROM public._prisma_migrations) <> 33
    OR EXISTS (SELECT FROM public._prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL) THEN
   RAISE EXCEPTION 'PRODUCTION_ACL_LEDGER_STOP';
 END IF;
 IF EXISTS (SELECT FROM pg_prepared_xacts WHERE database=current_database())
    OR EXISTS (SELECT FROM pg_stat_activity WHERE datname=current_database()
      AND pid<>pg_backend_pid() AND backend_type='client backend') THEN
   RAISE EXCEPTION 'PRODUCTION_ACL_WRITER_STOP';
 END IF;
END $$;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = pg_catalog, public;
-- Apply only after exact target/17->33 migration, preservation and role guards.
-- Existing rights are never revoked by this additive candidate.
GRANT SELECT, INSERT ON TABLE public."User" TO passvero_app;
GRANT UPDATE ("id") ON TABLE public."User" TO passvero_app;
GRANT INSERT ON TABLE public."Organization" TO passvero_app;
GRANT UPDATE ("id") ON TABLE public."Organization" TO passvero_app;
GRANT INSERT ON TABLE public."Membership" TO passvero_app;
GRANT UPDATE ("id") ON TABLE public."Membership" TO passvero_app;
GRANT UPDATE ON TABLE public."ProductVersion" TO passvero_app;
GRANT UPDATE, DELETE ON TABLE public."ProductTranslation" TO passvero_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ProductIdentifier" TO passvero_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ProductMaterial" TO passvero_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."Document" TO passvero_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ProductDocument" TO passvero_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ProductImage" TO passvero_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."ProductImageAsset" TO passvero_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."Passport" TO passvero_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."QRCode" TO passvero_app;
GRANT SELECT ON TABLE public."Plan" TO passvero_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."Subscription" TO passvero_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."EconomicOperator" TO passvero_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ProductVersionManufacturer" TO passvero_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."CatalogImportBatch" TO passvero_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."CatalogImportRow" TO passvero_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."AccessRequest" TO passvero_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."AccessRequestAdminNotification" TO passvero_app;
GRANT SELECT ON TABLE public."OnboardingNotificationSettings" TO passvero_app;
GRANT SELECT ON TABLE public."PlatformGrant" TO passvero_app;
GRANT SELECT ON TABLE public."PlatformOnboardingGrant" TO passvero_app;
GRANT SELECT ON TABLE public."PlatformBillingGrant" TO passvero_app;
GRANT SELECT ON TABLE public."PlatformRegulatoryGrant" TO passvero_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."OrganizationBillingProfile" TO passvero_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."CommercialRequest" TO passvero_app;
GRANT SELECT, INSERT ON TABLE public."CommercialOffer" TO passvero_app;
GRANT SELECT, INSERT ON TABLE public."SubscriptionPaidPeriod" TO passvero_app;
GRANT SELECT, INSERT ON TABLE public."SubscriptionUpgradeReceipt" TO passvero_app;
GRANT SELECT, INSERT ON TABLE public."SubscriptionPaidPeriodActivation" TO passvero_app;
GRANT UPDATE ("status", "reasons", "checkedAt") ON TABLE public."SubscriptionPaidPeriodActivation" TO passvero_app;
GRANT SELECT, INSERT ON TABLE public."OrganizationEntitlementEnrollment" TO passvero_app;
GRANT UPDATE ("lifetimeCreatedProducts") ON TABLE public."OrganizationEntitlementEnrollment" TO passvero_app;
GRANT SELECT ON TABLE public."ReminderEnrollmentPolicy" TO passvero_app;
GRANT SELECT ON TABLE public."OrganizationReminderEnrollment" TO passvero_app;
GRANT SELECT ON TABLE public."ReminderCampaign" TO passvero_app;
GRANT SELECT ON TABLE public."SubscriptionReminder" TO passvero_app;
GRANT UPDATE ("status", "acceptedAt", "lastError", "receiptConfirmedAt") ON TABLE public."SubscriptionReminder" TO passvero_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."BillingEmailConfirmation" TO passvero_app;
GRANT SELECT ON TABLE public."ProductImageAsset" TO passvero_backup;
GRANT SELECT ON TABLE public."EconomicOperator" TO passvero_backup;
GRANT SELECT ON TABLE public."ProductVersionManufacturer" TO passvero_backup;
GRANT SELECT ON TABLE public."CatalogImportBatch" TO passvero_backup;
GRANT SELECT ON TABLE public."CatalogImportRow" TO passvero_backup;
GRANT SELECT ON TABLE public."AccessRequest" TO passvero_backup;
GRANT SELECT ON TABLE public."PlatformOnboardingGrant" TO passvero_backup;
GRANT SELECT ON TABLE public."OnboardingNotificationSettings" TO passvero_backup;
GRANT SELECT ON TABLE public."AccessRequestAdminNotification" TO passvero_backup;
GRANT SELECT ON TABLE public."OrganizationBillingProfile" TO passvero_backup;
GRANT SELECT ON TABLE public."PlatformGrant" TO passvero_backup;
GRANT SELECT ON TABLE public."PlatformBillingGrant" TO passvero_backup;
GRANT SELECT ON TABLE public."CommercialRequest" TO passvero_backup;
GRANT SELECT ON TABLE public."CommercialOffer" TO passvero_backup;
GRANT SELECT ON TABLE public."SubscriptionPaidPeriod" TO passvero_backup;
GRANT SELECT ON TABLE public."SubscriptionUpgradeReceipt" TO passvero_backup;
GRANT SELECT ON TABLE public."SubscriptionPaidPeriodActivation" TO passvero_backup;
GRANT SELECT ON TABLE public."OrganizationEntitlementEnrollment" TO passvero_backup;
GRANT SELECT ON TABLE public."PlatformRegulatoryGrant" TO passvero_backup;
GRANT SELECT ON TABLE public."ReminderCampaign" TO passvero_backup;
GRANT SELECT ON TABLE public."ReminderEnrollmentPolicy" TO passvero_backup;
GRANT SELECT ON TABLE public."OrganizationReminderEnrollment" TO passvero_backup;
GRANT SELECT ON TABLE public."BillingEmailConfirmation" TO passvero_backup;
GRANT SELECT ON TABLE public."SubscriptionReminder" TO passvero_backup;
GRANT SELECT ON TABLE public."ReminderAttempt" TO passvero_backup;
GRANT EXECUTE ON FUNCTION public.record_reminder_enrollment(UUID, UUID) TO passvero_app;
-- Auth delta = NONE: preserve the exact P0 provider-table matrix.
-- Migrator delta = NONE: existing object ownership/DDL only, no role/admin expansion.
-- PUBLIC/schema/default ACL baseline unchanged; do not grant future-table SELECT to app.
-- Trigger invocation uses existing migration-owner definition; do not add PUBLIC EXECUTE.
-- No function grant to create_period_reminder_campaign or lock_reminder_enrollment_gate:
-- the production worker is outside this launch profile. No policy/grant-table writes.
COMMIT;
