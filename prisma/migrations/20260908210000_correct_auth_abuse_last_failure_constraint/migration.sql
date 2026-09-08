-- lastFailureAt is historical failure evidence, not current-window metadata.
BEGIN;

ALTER TABLE "AuthAbuseBucket"
DROP CONSTRAINT "ck_auth_abuse_bucket_timestamp_order";

ALTER TABLE "AuthAbuseBucket"
ADD CONSTRAINT "ck_auth_abuse_bucket_timestamp_order"
CHECK (
  "lastAttemptAt" >= "windowStartedAt"
  AND (
    "lastFailureAt" IS NULL
    OR "lastFailureAt" <= "lastAttemptAt"
  )
  AND (
    "blockedUntil" IS NULL
    OR "blockedUntil" >= "lastAttemptAt"
  )
  AND "expiresAt" > "lastAttemptAt"
);

COMMIT;
