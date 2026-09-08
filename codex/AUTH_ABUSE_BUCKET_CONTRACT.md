# Current AuthAbuseBucket contract

This current contract supersedes the window lower bound in the historical
2026-08-22 persistence plan. Historical migrations and review/proposal artifacts
remain evidence of their original design; do not rewrite them.

`lastFailureAt` is the most recent globally recorded failure for this bucket,
not the most recent failure in the current counter window. `windowStartedAt`
is the fixed counter-window anchor. On a new-window attempt, the existing
repository sets attemptCount=1 and failureCount=0, advances windowStartedAt and
lastAttemptAt monotonically, and preserves historical lastFailureAt. Only a
real recorded failure advances lastFailureAt. Success preserves failure history.

Backoff history crosses windows. Rollover does not clear an active blockedUntil
or erase backoffLevel; existing decay/escalation policy still applies. Do not
move lastFailureAt forward or null it merely to satisfy window ordering.

Migration `20260908210000_correct_auth_abuse_last_failure_constraint` removes
only the erroneous lastFailureAt >= windowStartedAt lower bound. The exact
current timestamp CHECK is:

```sql
CHECK (
  "lastAttemptAt" >= "windowStartedAt"
  AND ("lastFailureAt" IS NULL OR "lastFailureAt" <= "lastAttemptAt")
  AND ("blockedUntil" IS NULL OR "blockedUntil" >= "lastAttemptAt")
  AND "expiresAt" > "lastAttemptAt"
)
```

The separate digest and nonnegative counter/backoff constraints remain intact,
including failureCount <= attemptCount. All previously valid rows satisfy the
corrected CHECK; no row transformation or Prisma model change is required.

Expiry is a separate whole-bucket lifecycle concern. The runtime refreshes
expiresAt by 30 days; this correction implements no cleanup job or expiry reset.
The older foundation proposal describes backoffUpdatedAt and scheduled pruning;
those are not the current runtime/model contract. Current decay uses
lastFailureAt ?? lastAttemptAt. This constraint correction does not redesign it.

Timestamps remain server-controlled. HTTP contracts, generic operational errors,
Turnstile, credentials, session behavior and auth authority are unchanged.

Verify upgrades using a fresh disposable cluster: deploy historical migrations,
seed valid prior-window failure evidence, observe SQLSTATE 23514 on rollover,
then deploy this migration through Prisma and repeat the same repository path.
Assert history/active blocks survive, invalid ordering and counters still fail,
concurrency and rollback remain atomic, and no business/audit rows are created.
No staging/production migration or auth retry is authorized by this document.
