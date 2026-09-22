# Controlled Early Access onboarding — staging

Source base: `2cb9d6ec55a48a7efdc55c48e79c18a4202dd744` (clean at start, 2026-09-22).
The reviewed change remains uncommitted. No push, staging migration/deployment,
production access or real email sending has occurred in this task.

## Contract and implementation

- Existing operator provisioning creates a new Organization, User, ADMIN Membership,
  72-hour AccountActivationIntent and minimized provisioning audit atomically.
  `createControlledCustomer` is the shared transaction operation; the original CLI
  contract and capability output remain unchanged.
- New `/request-access` and five locale-prefixed routes collect contact name (120),
  email (254), organization display name (200), and supported locale. Input is strict,
  server-validated, normalized and bounded to 8192 transport bytes. No billing data.
- `POST /api/access-requests` uses canonical origin/trusted proxy protection, existing
  persistent abuse buckets and risk-triggered Turnstile. REQUEST_ACCESS counts attempts,
  including successful duplicates. It deliberately does not trust forwarded network
  headers; current transport has global and normalized-account dimensions. More network
  attribution requires the existing trusted-proxy contract, not arbitrary XFF input.
- An email has one retained AccessRequest. Duplicate submission cannot overwrite the
  original statement, change a decision, create identities or send mail. Public replies
  do not reveal IDs, existing accounts, tenants or decision/delivery status.
- Public submission creates no business user, provider user, membership or activation.
  Organization display name is only the applicant's statement; approval always creates
  a new organization. Existing provider/business email stops approval without linking.
- Review shows request identity/contact/organization, planned ADMIN role and new-customer
  scope. `list` is pending-only, oldest first, capped at 50; `show` uses a UUID.
- OS-level staging operator execution with inherited service credentials is the privileged
  boundary. `--operator` is an audit reference, not authentication. Tenant ADMIN/OWNER
  roles cannot invoke an HTTP approval route; none exists. Provider lookup uses the
  existing auth provider authority, separate from the business database client.
- A row lock serializes approve/reject. Approval, new aggregate and outcome pointers are
  one transaction; any provisioning/audit failure rolls it back to PENDING. Retry can
  then execute the uncommitted work. Rejected requests never provision.
- Approval commits before SMTP. Delivery states: NOT_STARTED, DELIVERY_IN_PROGRESS,
  SENT, DELIVERY_UNKNOWN. SENT means provider send call completed, not inbox receipt
  or completed activation. Process death or post-send persistence failure leaves a
  reconciliation state; repeat approval never resends.
- No raw capability is persisted or emitted by the new CLI. The existing token format,
  HMAC separation, password policy, provider verification and verification-consume/recovery
  binding remain unchanged. No automatic login or email-only identity linking.
- New users use existing server-side session/organization resolution and dashboard/product
  permissions. No synthetic products, subscription or billing record is created.

## Operator commands (inside the authorized staging runtime)

The operator process must inherit the existing staging service configuration; do not
source arbitrary environment files, print environment values or paste secrets into chat.
The entry point rejects any runtime other than staging and `https://staging.passvero.eu`.

```sh
node --conditions=react-server --import tsx scripts/review-access-requests.ts list
node --conditions=react-server --import tsx scripts/review-access-requests.ts show --id REQUEST_UUID
node --conditions=react-server --import tsx scripts/review-access-requests.ts approve --id REQUEST_UUID --operator OPERATOR_REFERENCE --confirm APPLY
node --conditions=react-server --import tsx scripts/review-access-requests.ts reject --id REQUEST_UUID --operator OPERATOR_REFERENCE --confirm APPLY
```

Use `show` before deciding. Review output contains operator-only contact data; do not put
it into shared application logs or acceptance reports. Report only the synthetic request
ID and sanitized state. A provider/business-email conflict leaves PENDING; for acceptance,
choose another explicitly approved address instead of modifying existing users.

## Delivery and activation recovery

First inspect `show`. Never repeat the old provisioning CLI for an approved request.
If the recipient received the link, use it and the existing verification UI. If credential
creation has already happened, use the existing verification request/consume/recovery
path; an activation-email retry must not recreate or reset the credential.

For a confirmed missing/expired activation message, after inspecting the request and
confirming the intended recipient, the operator may explicitly run:

```sh
node --conditions=react-server --import tsx scripts/review-access-requests.ts retry-delivery --id REQUEST_UUID --operator OPERATOR_REFERENCE --confirm APPLY
```

This is bounded to two retries after initial delivery (three total). It reuses the same
organization/user/membership/activation and replaces only an unclaimed ISSUED capability
with a fresh digest and 72-hour deadline; the previous link becomes invalid. It does not
reset provider subjects, claims or verification state. DELIVERY_IN_PROGRESS is protected
for ten minutes. Before a retry after that interval, establish that the previous operator
process has ended and inspect the recipient/provider outcome; SMTP cannot guarantee
exactly-once delivery. A late old email may be unusable after explicit reissue.

IN_PROGRESS, AUTH_ACCOUNT_CREATED, EMAIL_VERIFIED, BOUND, EXPIRED, REVOKED and CONFLICT
intent states are not reset by this command. Stop and use existing controlled activation
reconciliation when it refuses. No public/unlimited resend feature exists. Rejection has
no automatic email.

## Data and retention

AccessRequest retains the original contact name, email, organization statement, locale,
creation time, decision/operator reference, delivery state/attempt count and timestamps.
After approval it also retains FK-protected organization/user/activation references;
rejection retains the request with no provisioning pointers. A failed transaction stays
PENDING; delivery failure retains the committed approved aggregate and explicit delivery
state. Minimal AuthAuditEvent entries contain request correlation ID, event and operator
reference, not the form payload or capability. Existing auth audit/intent retention applies.

One retained email cannot open another public request after rejection/approval. There is
no deletion job or automatic expiration of request PII. Before production, decide retention
periods and an authorized correction/reapplication/erasure procedure. No legal duration is
claimed. Disposable proof clusters contain synthetic identities only and are stopped;
the deliberately retained staging test records are listed in the final acceptance section.

## Local evidence

- 273 focused existing/new auth, activation, verification recovery, abuse, session and
  organization tests passed; subsequent focused tests cover CLI validation and all six
  activation-email subjects. Final focused set: 20/20.
- Affected auth schema and marketing-route tests: 25/25.
- Protected disposable PostgreSQL proof: 9/9. Fresh initdb, random loopback port, independent
  test URL, full migration history, explicit data-directory check and shutdown in finally.
  Proof covers duplicate/concurrent submission/decisions, provisioning rollback, existing
  provider/business conflict, SMTP failure, post-send audit failure, replay, bounded retry,
  verified binding and server-derived organization/ADMIN PRODUCT_CREATE permissions.
- TypeScript and whitespace pass. Lint has zero errors and 15 pre-existing harness warnings.
- Production webpack build passes with the explicit non-secret staging canonical URL.
  Default Turbopack was blocked by sandbox port binding; initial font fetching also required
  network permission. This is not a default-Turbopack PASS claim.
- Browser: all six routes rendered; Croatian desktop and 320px visual check, keyboard focus
  to locale selector, localized operational failure with focus on error. Local server had no
  DB/mail credentials. Success persistence was proved at transport/database layers; real UI
  success and inbox delivery were subsequently confirmed during staging acceptance. Other responsive widths were
  not separately inspected. No real passwords, tokens or cookies were captured.
- Broad historical suites are not fully green: before updating affected expectations,
  application/infrastructure had 1111/1132 pass (one new endpoint expectation fixed;
  remaining PDF presentation/runtime assertions and sandbox socket failures are outside scope).
  Schema suite had 266/288 pass; five affected auth/CTA expectations were fixed. A clean HEAD
  archive confirms the other 17 failure names predate this change (the archive also has three
  additional history/ignore checks because it has no .git metadata). Do not claim full-suite PASS
  or reopen Product/PDF acceptance here.

## Migration, deployment and rollback

Migration: `20260922120000_controlled_access_requests`. Adds only AccessRequest with
constraints/indexes/references and the REQUEST_ACCESS abuse enum value. No existing
user/organization/activation row is changed by the migration. Prisma client generation
is required. Staging runtime must receive the appropriate minimum AccessRequest privileges;
provider tables remain under the existing auth role, with no new business-role grant.

Target known from prior operator artifacts: host `srv1834647`, application
`/var/www/passvero-acceptance`, PM2 `passvero-acceptance` as `passvero-staging`, database
`passvero_acceptance` on port `5433`. These must be freshly confirmed before mutation.
Production database port 5432 and all scanner/broker/producer processes are out of scope.

The source SHA-256 manifest is prepared in `/private/tmp/passvero-onboarding-review/`.
It is a source review manifest, not a deployed artifact identity. The deployment package
and exact replacement/rollback commands will be bound to the confirmed staging build,
source/runtime layout and DB privileges after the read-only operator preflight. Previous
artifact deployment supports an uncommitted reviewed diff, so no commit/push is assumed.

Deployment phases: (1) read-only identity preflight; (2) verify package/backup and apply only
this migration with minimum grants; (3) atomically replace the reviewed application artifact
and operator code, restart only staging app, verify build hash and six form routes;
(4) one user-approved test-address journey. Each privileged phase is an operator block with
PENDING_OPERATOR_COMMAND and a returned sanitized result.

Rollback: restore the exact preflight-recorded prior app artifact/operator files and restart
only the staging app. This additive table/enum can remain inert under the prior app; retain
request/audit/approved aggregate data. Never drop the table or enum, delete new identities,
revert memberships, reset activation or restore the entire DB automatically. A data rollback
would require separate reconciliation and authorization. Reversion hides new request entry
points; already issued activation links still use the existing activation flow.

## Current acceptance status

CONTROLLED_EARLY_ACCESS_SOURCE=COMPLETE
REQUEST_ACCESS_FORM_STAGING=PASS
OPERATOR_APPROVAL_STAGING=PASS
PROVISIONING_IDEMPOTENCY=PASS (local PostgreSQL; live ALREADY_APPROVED replay, one delivery attempt)
ACTIVATION_EMAIL_DELIVERY_STAGING=PASS
REAL_USER_ACTIVATION_STAGING=PASS
ORGANIZATION_CONTEXT_STAGING=PASS
PUBLIC_SELF_SERVICE_SIGNUP_ENABLED=NO
PLATFORM_ADMIN_DASHBOARD_IMPLEMENTED=NO
PRODUCTION_CHANGES=NONE

Acceptance complete: the user confirmed the expected organization in the authenticated
dashboard and availability of product creation. No further email send is needed.

Billing company details, Platform Admin and annual subscriptions remain later work.

## Operator preflight and prepared package

User-returned VPS preflight confirms application `/var/www/passvero-acceptance`, build
`bO73SDxjxPBddEzd4Q2nd`, database `passvero_acceptance`, port `5433`, data directory
`/var/lib/postgresql/16/acceptance`, latest completed migration
`20260921120000_catalog_import_receipts`, no unfinished migrations and no AccessRequest table.
This is operator-reported evidence, not a new direct database query by the agent.

Prepared package: `/private/tmp/passvero-onboarding-staging-2cb9d6e`, transferred as darko
through the existing SSH alias to `/tmp/passvero-onboarding-staging-2cb9d6e` on the VPS.
All transferred files were SHA-256 verified. Target build: `GSumULnTFFOyxN9Mn6MiK`.
The source review retains the uncommitted code identity; these deployment notes are
post-build documentation only. Runtime package/lock hashes and installed dependency
versions are checked before migration/deployment; neither package file is replaced.

`migrate-once.py` is a single-attempt staging migration with a private backup and status
verification. `deploy.py` replaces only `.next`, messages and the new isolated operator
module, restarts only staging PM2 and checks six routes. `rollback.py` restores the old
application artifact and removes the new operator module from its active path, retaining
all request/activation/audit data. `operator.py` runs the bundled CLI under the staging
service identity using its existing in-memory configuration; it never prints that configuration.
At package preparation, migration was pending. Executed operator results follow below.

## Migration operator result

User-returned output confirms migration PASS, one executed migration attempt,
AccessRequest count 0, existing users/organizations/memberships/activations/identity/audit
and existing ACL unchanged, new table privileges SELECT/INSERT/UPDATE only, Prisma
UP_TO_DATE. Backup: `/var/lib/passvero-onboarding-deploy-2cb9d6e/migration/staging-before.dump`,
SHA-256 `dde73e5f6e30776d5522b5f93053a6ef2175fa7933117e792bc3ead5ba0dc99f`.
The earlier Python startup import failure did not reach migration code. The wrapper was
renamed to `run-onboarding-operator.py`; all privileged Python entries use `-I -B`.
At this migration phase, deployment and real onboarding were not yet proven. These are post-package
operator evidence notes; the frozen application artifact is unchanged.

## Application deployment operator result

User-returned deployment report: PASS, build `GSumULnTFFOyxN9Mn6MiK`, source base
`2cb9d6ec55a48a7efdc55c48e79c18a4202dd744` plus reviewed uncommitted diff (36 files),
review SHA-256 `f3ba4e7c78f4483912d929455bc1372ebb38f96396b60501e9de650260bda816`,
1122 artifact files verified, HTTPS `200 0`, startup error count 0. Runtime configuration
and scanners/broker/producer unchanged; no production access or changes.
Rollback: `/var/lib/passvero-onboarding-deploy-2cb9d6e/application/rollback.py`.
At deployment time, real onboarding acceptance had not yet run. Subsequent results are recorded below.

### Operator acceptance fixes (2026-09-22)

- The failed initial approval left the reviewed request PENDING, with zero delivery
  attempts and null provisioning references. Successful approval after the fixes is below.
- Confirmed wrapper fix: remove inherited `NODE_CHANNEL_FD` and
  `NODE_CHANNEL_SERIALIZATION_MODE` from the standalone CLI child environment. PM2's
  IPC descriptor is not inherited by Python subprocesses. Synthetic VPS reproduction
  exited -6 with the marker and 0 without it; corrected live `list` exited 0.
- Read-only preflight confirmed valid activation configuration and no existing provider
  or business account for the approved test address. Existing staging ACL permits
  INSERT but not UPDATE on User and Organization. The initial implementation's profile
  UPDATE statements therefore conflict with that boundary.
- Profile name/locales now enter the initial aggregate INSERTs. Original provisioning
  callers retain their defaults. No grants or migration changes are needed.
- Regression reproduced OPERATIONAL_FAILURE with an INSERT-only disposable role before
  the fix. Afterward: PostgreSQL 10/10, focused tests 53/53, TypeScript, targeted ESLint
  and whitespace PASS. Disposable cluster stopped.
- CLI-only patch prepared at `/private/tmp/passvero-onboarding-operator-ipc-fix`;
  bundle SHA256 `caac6bbc4fe5604c23837527c65aff1e35717580d7c079f7002f08406c87eda5`.
  Installation and live approval are now operator-confirmed PASS. Next.js build remains
  `GSumULnTFFOyxN9Mn6MiK`; original archive is retained as the base deployment and the
  CLI override is recorded separately in the runtime manifest. No commit/push.

## Real staging acceptance (2026-09-22)

Evidence is user-returned operator output and the user's UI/inbox confirmation, not an
agent inspection of the authenticated session. The approved test recipient submitted the
form, received activation/verification links, completed the flow and signed into the
admin dashboard. Operator approval returned APPROVED/SENT. A subsequent explicit replay
returned ALREADY_APPROVED/SENT; the request retained one delivery attempt and its outcome
references. Local concurrency tests independently verified aggregate cardinality.

Deliberately retained staging records (no deletion or automatic database restore):
- Request: `7e4751e8-7aba-4812-8421-8c3d55273a62`.
- Organization: `6d686789-6379-4824-ae02-df97043cbbc0`.
- User: `cbb590fa-1c67-41bf-883d-c2eb96bf6edb`.
- Activation record ID (not a token): `a322e58f-d1df-429a-b11c-396a75a8c2d9`.
- Request decision: APPROVED by operator `darko`; provisioning contract ADMIN in a new
  organization. Associated membership, identity, activation and audit records are retained.
- Delivery attempts: 1; SENT. Approval at 2026-09-22T17:36:59.485Z and delivery recorded
  at 2026-09-22T17:37:00.145Z.

The corrected wrapper SHA256 is
`af9568ebfda6d8ae46de5986e514c160a4a236b03eed2d9aefd09e89219bb631`.
CLI patch installation confirmed hash, list exit 0, unchanged database permissions, no
application restart and no email sent by the installer. Backups remain under
`/var/lib/passvero-onboarding-deploy-2cb9d6e/application/` as
`operator-before-insert-fix.mjs` and `manifest-before-insert-fix.json`.

No activation URLs, passwords, cookies or session artifacts were captured for this
acceptance. No synthetic products were seeded. The user confirmed that the authenticated dashboard displays the expected test
organization and offers product creation. This is user-observed UI evidence; actual
product creation was not needed or performed for this acceptance. Retention duration remains a
pre-production decision; no deletion scheduler was introduced.

## Final commit review (2026-09-22)

Full source base: `2cb9d6ec55a48a7efdc55c48e79c18a4202dd744`.
The final source inventory is `CONTROLLED_EARLY_ACCESS_FINAL_MANIFEST.json`. It hashes all
36 implementation/migration/test/report/roadmap files; the manifest excludes itself to
avoid a recursive hash and is protected by the enclosing Git commit.

Comparison with the reviewed source manifest for accepted staging build
`GSumULnTFFOyxN9Mn6MiK`: 31 files remain byte-identical. The five differences are the two
Prisma provisioning sources (profile fields moved into INSERT), the PostgreSQL regression
test, and final report/roadmap documentation. Documentation is not an executed artifact.
The current TypeScript CLI source and imports regenerate exactly the accepted corrected
CLI SHA256 `caac6bbc4fe5604c23837527c65aff1e35717580d7c079f7002f08406c87eda5`.
The Python IPC launcher correction is deployment tooling, documented by hash and live
results above; temporary Python installers and binary packages are excluded from this commit.

Final local webpack build PASS (build `oiHAOh46tsz4SEqrzX2j9`), with explicit staging origin;
this is a local verification artifact, not a new staging deployment. Previous 10/10
PostgreSQL and 53/53 focused results cover unchanged final executable sources, including
CLI argument validation, INSERT-only approval and original provisioning compatibility.
TypeScript, targeted lint and whitespace evidence remains applicable. Historical unrelated
suite failures remain as documented; no whole-suite PASS is claimed.

Final scoped review found no unresolved findings: public transport validation/abuse and
non-enumeration, explicit operator-only decisions, row-lock transaction/idempotency,
create-only provisioning under existing ACLs, bounded delivery recovery, additive schema,
localized form, and absence of capability output remain consistent with accepted evidence.
No dependency/environment changes, real credentials, raw email, temporary packages or
unrelated work are included. Retention remains a pre-production decision; public signup
and Platform Admin remain disabled/unimplemented.
