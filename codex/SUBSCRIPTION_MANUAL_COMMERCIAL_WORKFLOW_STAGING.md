# Manual commercial subscription workflow — staging delivery record

Task: SUBSCRIPTION_MANUAL_COMMERCIAL_WORKFLOW_STAGING. Source base:
`2a8faf17489ab3e6072c29e9d801f1671387317e`, branch `main`.
The pre-existing four-file documentation diff is preserved. Final reviewed commit is explicitly authorized; no push. The delivery receipt records the resulting commit SHA.

## Final status — 2026-09-30

**Initial purchase commercial flow: STAGING PASS.** Migration, artifact deploy,
explicit billing grant, synthetic fixture and actual OWNER/operator UI sequence
completed. Read-only DB evidence: exactly one request, one paid period and one
confirmation audit after the UI double-click; Subscription ACTIVE and immutable
period snapshot equals accepted offer. Evidence: `evidence/subscription-commercial/staging-acceptance.json`.

Start period: 2026-09-30 15:22:05.515 through 2026-12-31 15:22:05.515 exclusive,
Europe/Zagreb. SIMULATED_PAYMENT only. Existing organizations unchanged.
Local renewal/concurrent replay/authorization/calendar proofs PASS; live HTTP
replay and live renewal are not separately claimed. Desktop UI flow and Croatian
rendering verified. Bounded HR/DE mobile visual review PASS in Chrome responsive
emulation at 390×844; physical-device and full six-language live sweep NOT_PROVEN.
Application rollback tooling is prepared but live rollback was not executed.
The chronology below retains earlier stops/pending states as historical evidence.

## Authority and scope

User confirmed §§3–4 of [the commercial contract](SUBSCRIPTION_COMMERCIAL_CONTRACT_AND_BACKUP_SCOPE_RECONCILIATION.md), with downgrade blocked until smaller quotas are met and publication slots not released by archive/withdrawal.
Initial purchase and renewal of the same package only. Offers/invoices are external;
Passvero stores references and immutable accepted terms. No bank or Stripe integration.

User explicitly confirmed staging actors and test plan in this session:

- OWNER: `prodaja@zivic-elektro.com`.
- Billing operator: `zivic.darko79@gmail.com` (separate billing grant; existing read-only grant retained).
- New organization: `SYNTHETIC — Subscription commercial acceptance`.
- Start / three months / 147 EUR net; `SIMULATED_PAYMENT`, no real payment claimed.
- Period starts at the test confirmation instant, no backdating.
- No existing organization transition, historical trial start or automatic identity inference.
- No administrator reminder recipients configured; reminders are deferred.

No privileged command is executed by the agent. Complete copy/paste commands are
operator-run only; production, backup/restore, scanner changes and deletion excluded.

## Execution ledger

- Contract refinements and implementation plan written; previous documentation retained.
- Calendar/catalog test-first: missing-module failure observed, then 7 focused tests PASS, including explicit issuance parsing.
- Independent calendar/catalog review: no blocking finding; two suggested anchor-reuse
  cases added and passed.
- Backend and UI source work: SOURCE_COMPLETE; independent review fixes applied.
- Additive migration `20260930120000_manual_commercial_subscriptions`: quarterlyPrice,
  PlatformBillingGrant, CommercialRequest, CommercialOffer, SubscriptionPaidPeriod;
  explicit standard catalog seed, conflicting existing catalog entries fail without repricing.
- External offer issuance is explicit Zagreb-local input, retained as UTC in immutable
  snapshot; expiry is 30 calendar days after external issuance, not recording time.
- Immutable offers use monotonic revisions, accepted billing/price/limits/terms snapshots,
  and protected paid receipts. Actor/audit records stay transactional.
- First/late activation starts confirmation time; early same-plan renewal appends a future
  period while retaining current start/end. Replayed payment does not append again.
- Separate billing grant, fresh session/identity/tenant checks; production simulation rejected.
- Customer and operator UI, six locales, occupied publication metric, explicit simulation,
  localized login CTA, mobile layout classes and safe HTTP boundary implemented.
- Read-only staging preflight: PASS; verified approved account IDs, 27 completed matching migrations and no existing synthetic organization.
- Staging additive migration and required runtime ACL: PASS (operator output).
- Staging artifact deployment and HTTPS/anonymous checks: PASS (operator output).
- Billing grant and synthetic fixture: PASS (operator output).
- Authenticated initial commercial flow and final DB receipt/projection/audit counts: STAGING PASS.

## Evidence boundaries

- Commercial flow: SOURCE_COMPLETE / LOCAL_PASS / STAGING initial-purchase PASS.
- Global rights/quota enforcement: NOT_IMPLEMENTED in this slice. UI quota figures are
  informational, including occupied published slots for archived/withdrawn products.
- Upgrade/downgrade execution and reminders: DEFERRED.
- Full DB + Storage backup/restore and export/retention procedure: production prerequisites;
  prior NOT_PROVEN statuses remain. No automatic permanent deletion.

## Rollback policy

Restore the previous staging application artifact if deployment fails, retain additive
schema, commercial/audit history and synthetic evidence. Never rollback payment history by
SQL deletion or database restore. Revoke the separately added billing grant via the explicit
operator service if authorized; no automatic grant revocation or tenant changes.

## Local verification (2026-09-30)

| Check | Result |
| --- | --- |
| Focused application/UI/HTTP + existing touched billing/platform regressions | 28 tests PASS |
| Plan/Subscription schema source and historical migration checks | 19 tests PASS |
| Disposable PostgreSQL | 28 migrations + 3 workflow/setup scenarios PASS; final cluster `/private/tmp/passvero-commercial-proof-8JDsVT` stopped |
| TypeScript | `npx tsc --noEmit` PASS; build TypeScript also PASS |
| ESLint | All changed/new TS/TSX/MJS PASS |
| Build | `NEXT_PUBLIC_SITE_URL=https://staging.passvero.eu BETTER_AUTH_URL=https://staging.passvero.eu npm run build -- --webpack` PASS; `2nLJShFD4kXdyT54nYC0Z` |
| Build-source manifest | 476 source files hashed; hashes rechecked after build |
| Operator tooling | Python AST / Node syntax PASS; generated Prisma client/compiler/WASM load proof PASS without DB |
| Whitespace | Tracked diff and new text files checked |
| Browser/mobile visual acceptance | Desktop Croatian flow verified; bounded HR/DE Chrome responsive emulation 390×844 PASS (read-only); physical-device/full six-locale live sweep NOT_PROVEN; static six-locale rendering tests PASS |
| Staging | Initial purchase UI + final DB counts PASS; earlier preparation stops resolved |

The PostgreSQL proof exercises OWNER/ADMIN/read-only platform separation, cross-tenant
rejection, fresh revocation, standard-price validation, disabled/non-EUR Custom denial,
Custom explicit/same-plan limits, same-millisecond offer replacement, immutable billing
and catalog snapshots, expired/future/delayed issuance, exact expiry, duplicate/open-request
races, concurrent payment, audit rollback, immutable SQL records, early/late renewal and
period rollover. Synthetic data only; no staging/production connection.

The initial restricted-role test failed because Prisma's AuditLog INSERT RETURNING
requires SELECT; the proof now explicitly demonstrates permission denial and rollback,
then grants SELECT in its disposable test role. No live ACL was changed by this diagnosis.

## Delivery artifacts and gates

- Build/source evidence: `evidence/subscription-commercial/build-report.json` and
  `BUILD_SOURCE_SHA256SUMS`.
- Reviewable operator sources: `preflight.py`, `migrate.py`, `deploy.py`, `setup.py`,
  `rollback.py` in the same evidence directory.
- Local preparation: `node scripts/prepare-subscription-staging.mjs PREFLIGHT_JSON
  BUILD_REPORT_JSON SOURCE_SHA256 NEW_OUTPUT_DIRECTORY`.
- Preparation requires actual preflight evidence, verifies exact migration history,
  approved verified account IDs, dependency pins and build/source hashes, then emits
  an archive and manifest. No final staging-bound package is claimed without that input.
- Operators install the verified package root-owned under `/var/lib`, then run each
  pinned operation once. No sudo is executed by the agent. Migration/deploy/setup
  remain NOT_EXECUTED until operator output proves otherwise.
- Backup/restore is absent from these scripts. Application rollback retains database,
  offer/payment history, synthetic fixtures and audit; it restores only prior application
  artifacts and their canonical runtime manifest. Failed commands require state review.

## Important first-slice limit

Commercial reads derive the effective current/future interval from immutable paid periods.
The persisted Subscription interval is refreshed on payment and may still contain the
prior interval after a future renewal begins. No global entitlement consumer was added.
Before implementing enforcement, all consumers must use the canonical effective-period
resolver or a separately reviewed projection reconciliation; do not treat the raw row's
old interval as grounds for locking an organization.

## Next live proof after preflight/migration/deploy

1. Explicit operator grant to the confirmed Gmail identity; create the named synthetic
   organization with the confirmed OWNER and clearly synthetic billing profile. No
   subscription or payment is fabricated during fixture setup.
2. OWNER selects Start/3 months and submits. Operator records a synthetic external
   offer reference and actual issue time, EUR147 net and explicitly synthetic terms.
   OWNER reviews the snapshot and accepts. Operator chooses SIMULATED_PAYMENT and
   confirms once, then repeats to prove one paid period/one confirmation audit.
3. Verify customer/operator current period and retained synthetic marker. Same-plan early
   renewal is locally proven; live renewal can use the same synthetic organization with
   another clearly simulated reference under the approved test scope. No actual bank payment.

Authenticated UI, mobile/keyboard visual acceptance, live payment replay counts and
live application rollback are NOT_PROVEN until executed and recorded separately.

## Staging preflight follow-up

Operator output confirms previous build `vwSSh_nI3c5X-dORRWq6S`. Approved OWNER ID
`cbb590fa-1c67-41bf-883d-c2eb96bf6edb`; billing operator ID
`40e51001-912c-4bcf-aa45-d866632aac85`. Both verified; only the latter has
the existing read-only platform grant. No fixture, grant or payment was written.

Artifact preparation stopped before output creation on package/lock hash mismatch.
Both staging hashes exactly match Git revision
`db9bbd49881586a88141759e75bf7be6e968429e`. The only dependency differences to
current HEAD are additions of `bwip-js` 4.11.4 and `csv-parse` 7.0.2, with no
other lock entry changes. Installed runtime package fingerprints must be checked
before adapting the artifact-only delivery plan; the mismatch check has not been
bypassed. Additional read-only operator output is pending.

## Verified runtime and prepared package

The follow-up operator probe passed: all 12 installed runtime package fingerprints,
Prisma compiler JS/WASM and retained operator script match local/accepted pins.
The absent `bwip-js` and `csv-parse` are bundled; production Next file traces do
not require their node_modules directories. Preparation permits only the exact
historical metadata pair and the two reviewed additions, with a matching probe;
all other deltas fail. No dependency install or metadata mutation is planned.
Development output `.next/dev` and `.next/cache` are excluded from the artifact.

Prepared package: `/private/tmp/passvero-commercial-staging-package-v2`.
Manifest SHA256: `deb54c562d283c8f816bcc225808d46869b4c102646d38994a8b12cbcd48cac9`.
Build remains `2nLJShFD4kXdyT54nYC0Z`; 799 application files.
Package hashes/archive inventory/content verification PASS; preparation lint and
syntax PASS. Migration, deploy, billing grant and fixture remain NOT_EXECUTED.
Next operator step: verified root-owned package installation and additive migration.

## Operator migration stop

Operator reported `VERIFIED_PACKAGE_INSTALL=PASS`, followed by
`EXISTING_READ_ACL_REQUIRED`. In the pinned migration script this check runs
before creation of the migration state directory, Prisma migrate deploy or any
GRANT statement. The error does not identify whether AuditLog or Plan lacks
SELECT. Migration remains NOT_EXECUTED; no automatic retry or ACL mutation.
A read-only report of existing table/column privileges and migration state is
required to determine the minimal correction.

## ACL diagnosis and bounded continuation

Operator read-only proof: AuditLog SELECT/INSERT already present; Plan and
Subscription SELECT absent; Organization SELECT/INSERT present but UPDATE(id)
absent. Commercial migration records=0; migration state/work directories absent.
The repository uses SELECT id FROM Organization ... FOR UPDATE to serialize
commercial operations; the disposable restricted-role proof uses UPDATE(id)
for this lock. Proposed operator correction is exactly SELECT on Plan and
Subscription plus UPDATE(id) on Organization for passvero_app. This is a DB
runtime privilege change, not a PlatformBillingGrant assignment. It permits
column updates at the DB layer; the application uses it only for row locking.
After transaction commit, the unchanged pinned migration script may continue
once with all scope/hash/no-prior-attempt checks. ACL correction and resumed
migration remain PENDING_OPERATOR_COMMAND until output is supplied. No deploy
or organization/account mutation is part of this continuation.

## Staging migration completed

Operator output: `COMMERCIAL_RUNTIME_ACL=PASS`, `STAGING_MIGRATION=PASS`.
The pinned migration script verifies all 28 migration checksums/statuses, new
table ownership and runtime privileges before reporting PASS. The package
manifest remains `deb54c562d283c8f816bcc225808d46869b4c102646d38994a8b12cbcd48cac9`.
No application restart, PlatformBillingGrant, synthetic organization or payment
has been performed. Next operator operation is the prepared application deploy
with bounded HTTPS/anonymous boundary checks; authenticated acceptance stays
NOT_PROVEN. Earlier pending/stop entries are historical execution evidence.

## Staging application deployed

Operator output: `STAGING_ARTIFACT_AND_HTTPS=PASS; AUTHENTICATED_ACCEPTANCE=NOT_PROVEN`.
Build `2nLJShFD4kXdyT54nYC0Z` deployed; the pinned deploy script verified deployed
file hashes, retained runtime files, scoped PM2 restart, HTTPS and anonymous
subscription/billing boundaries. No authenticated commercial acceptance claimed.
Next: approved separate billing grant for `zivic.darko79@gmail.com`
(`40e51001-912c-4bcf-aa45-d866632aac85`) and new synthetic fixture owned by
`prodaja@zivic-elektro.com` (`cbb590fa-1c67-41bf-883d-c2eb96bf6edb`).
Both operations remain pending; setup creates no subscription or payment.

## Billing grant and fixture setup correction

Operator confirmed billing grant GRANTED for the approved Gmail UUID. Fixture
command then failed. Local disposable PostgreSQL reproduced Prisma rejecting the
void result of SELECT pg_advisory_xact_lock; explicit ::text AS lock fixes it.
All 28 migrations and three integration scenarios PASS in stopped cluster
`/private/tmp/passvero-commercial-proof-8JDsVT`. Source CLI corrected.
The application build is unchanged; its source snapshot retains the original CLI
hash as historical evidence. Only the operator bundle needs the one SQL-string
correction. Original package/manifest remain immutable. Correction bundle hash:
`caae305e547d2ff67f6f6ca88bf6a29cdb809fc792e3eb20b0ead8b84626ddf7`.
`repair-fixture-lock.py` requires zero matching fixtures and one active approved
billing grant before running the corrected fixture-only bundle. Live fixture
creation remains pending operator output; no repeated grant, payment or deploy.

## Synthetic fixture created and UI handoff

Operator correction precheck confirmed fixtures=0 and active billingGrants=1.
Fixture CREATED: `ffe171d1-b6a6-43d5-83bb-890e2fa23c9f`, OWNER
`cbb590fa-1c67-41bf-883d-c2eb96bf6edb`. subscriptionCreated=false,
paymentRecorded=false, existingOrganizations=UNCHANGED, productionChanges=NONE.

Native Chrome control is now available, although browser connector inventory is
empty. Opened staging /dashboard/subscription, which redirected to /login.
Observed Croatian login CTA “Zatražite pristup” linking to /request-access.
Requested user to sign in directly as the approved OWNER; no password requested
or read. Authenticated request/offer/acceptance/payment and mobile visual proof
remain pending.

## OWNER request accepted in staging UI

User signed in as approved OWNER. Native Chrome UI showed organization selection;
selected the synthetic organization and verified its header before mutation.
Subscription page displayed no paid period, Start / 3 calendar months / EUR147 net,
25 publication slots, 100 stored products, 2 GiB and 10 PDF attachments/version.
Submitted the request and observed “Zahtjev podnesen”. UI now requires explicit
checkbox confirmation to replace the open request. No offer/acceptance/payment yet.
Opened a separate private Chrome window for the billing operator, preserving
OWNER session. Anonymous /platform/billing returned 404 as expected; navigated
to /login for user login as the approved Gmail operator. Operator login pending.

## Authenticated initial purchase demonstrated

Native Chrome UI flow completed in separate OWNER and billing operator sessions.
Recorded synthetic external offer `SIM-OFFER-20260930-01`, issued
2026-09-30 15:18:46 Europe/Zagreb, net/total EUR147 with explicit synthetic tax
label and `SYNTHETIC-NONBINDING-v1` terms. Test reference document retained in
`evidence/subscription-commercial/SYNTHETIC-OFFER-20260930-01.md`.
OWNER reviewed and accepted; operator explicitly selected simulated payment,
reference `SIMULATED-PAYMENT-20260930-01`, and double-clicked confirmation.
UI switched to payment confirmed; both operator and refreshed OWNER view show
Start active 2026-09-30 15:22 to 2026-12-31 15:22 (exclusive, Europe/Zagreb),
with synthetic-payment warning and 0/25 publication, 0/100 product counters.
Month-end anchor explains December 31 for a September 30 activation.
No actual payment or legally binding offer was represented. Desktop offer
layout visually inspected. Final read-only DB receipt/projection/audit counts
are pending; do not infer duplicate HTTP delivery from the UI double-click.
Local concurrency/replay proof remains distinct from this live click test.


## Final bounded review and commit scope — 2026-09-30

[Mobile visual evidence](evidence/subscription-commercial/mobile-visual-review.md):
OWNER subscription HR/DE, billing operator paid-offer detail HR/DE and HR empty
request list inspected at 390×844 in Chrome responsive emulation. Readability,
long-label/reference wrapping, visible buttons, navigation and absence of visible
horizontal overflow PASS. No UI defect found; no application source change,
new build/deploy, functional-test or PostgreSQL-proof rerun was needed.
No commercial form submitted, grant/period/service changed or rollback performed.

The original 55-file manifest matched the working set and its file hashes before
this review. Final scope is 56 files: that complete set, preserving the earlier
four-file documentation diff, plus mobile evidence. Only the report, roadmap and
execution-plan status were refreshed within the existing set. The final manifest
and unified diff are in `/private/tmp/passvero-subscription-commercial-review/`;
the external delivery receipt records manifest SHA-256 and commit SHA without
introducing a circular hash into committed documentation.

SIMULATED_PAYMENT is synthetic evidence, not a real bank payment. Initial live
commercial activation and matching DB receipt/audit are proven; global rights and
quota enforcement remains unimplemented. Renewal/concurrent replay proofs remain
local, not live acceptance. Rollback is documented/prepared, not live executed.
Reminders and upgrade/downgrade execution remain deferred; backup/retention
unknowns remain production prerequisites. No push or production change authorized.
