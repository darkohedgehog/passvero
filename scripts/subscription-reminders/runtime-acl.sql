-- Operator applies only to the verified staging DB after the additive migration.
-- Existing commercial/entitlement ACLs remain in force. No campaign approval writes for runtime.
GRANT SELECT ON "ReminderCampaign" TO passvero_app;
GRANT UPDATE ("dispatches", "leaseToken", "leaseUntil", "lastStartedAt", "lastSuccessAt", "lastError") ON "ReminderCampaign" TO passvero_app;
GRANT SELECT, INSERT, UPDATE ON "SubscriptionReminder", "ReminderAttempt", "BillingEmailConfirmation" TO passvero_app;
