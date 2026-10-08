-- Operator applies only to the verified staging DB after the additive migration.
-- Existing commercial/entitlement ACLs remain in force. No campaign approval writes for runtime.
GRANT SELECT ON "ReminderCampaign" TO passvero_app;
GRANT UPDATE ("dispatches", "leaseToken", "leaseUntil", "lastStartedAt", "lastSuccessAt", "lastError") ON "ReminderCampaign" TO passvero_app;
GRANT SELECT, INSERT, UPDATE ON "SubscriptionReminder", "ReminderAttempt", "BillingEmailConfirmation" TO passvero_app;
-- Future enrollment policy and approval remain operator-owned.
GRANT SELECT ON "ReminderEnrollmentPolicy", "OrganizationReminderEnrollment" TO passvero_app;
GRANT UPDATE ("lastCheckedAt", "lastError") ON "OrganizationReminderEnrollment" TO passvero_app;
GRANT EXECUTE ON FUNCTION record_reminder_enrollment(UUID,UUID), create_period_reminder_campaign(UUID,TEXT,TIMESTAMP) TO passvero_app;
GRANT EXECUTE ON FUNCTION lock_reminder_enrollment_gate() TO passvero_app;
