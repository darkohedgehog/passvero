# Platform Admin organizations and billing overview — staging task

Source base: `c5136792ef95c094ab88e0d261dc51dcc69db2fa`; initial worktree/index clean.
Source implementation and bounded local verification complete. Staging migration and
deployment and approved grant PASS (operator-returned evidence); authenticated staging UI acceptance PASS.
UI alignment supplement: local build/tests, staging deploy and authenticated visual acceptance PASS.
No commit/push or production changes.

## Authorization and data boundary

`PlatformGrant` is one explicit record per canonical User; no backfill, no tenant-role
inheritance. An active grant maps only to `PLATFORM_ORGANIZATIONS_READ`, not broader
platform management/support authority. The server-created PlatformAdminContext includes
this capability and a correlation ID. Existing provider-neutral authentication is reused.
Every read checks the grant again inside its bounded repeatable-read transaction, verifies
an unexpired provider session with the existing 30-day absolute age limit, verified provider
account and matching non-revoked canonical identity. No shared/persistent authorization cache.
User has no separate active-status field: revoked binding, missing user/session, expired
session and unverified provider identity are the available invalid-account conditions.
Suspended tenant membership/organization neither grants nor revokes independent platform
permission; tenant access continues to enforce those conditions independently.

Provider reads retain the dedicated auth-role Prisma lifecycle. Business reads use only
the existing business role; no new business access to provider tables. Runtime must have
SELECT only on PlatformGrant. The CLI runs only as the privileged postgres OS operator,
connects through the fixed staging Unix socket (5433/passvero_acceptance) with
`passvero_migrator` as SQL role, and retains the existing auth role for verification.
It never needs a new credential or environment-file edit. Its staging guards and OS identity
prevent web/runtime use. No HTTP/UI self-grant path exists.

The CLI accepts `grant|revoke`, exact existing canonical email and a safe operator reference.
Grant requires exactly one non-revoked matching verified provider identity. Revoke can remove
access even after identity revocation. Both operations are idempotent; only changes create
an atomic AuthAuditEvent with target user, operator reference and correlation ID. No billing
values or tokens are logged. Serialization conflict fails safely; inspect status before retry.
The user explicitly approved the existing staging account in the conversation on 2026-09-29;
the approved grant is now confirmed by operator-returned evidence; no account was inferred from screenshots.

Organization DTOs include only ID for navigation, display name, existing status, creation
date and profile-presence flag. Detail adds the current billing field allowlist and updatedAt.
No auth identities, sessions, secrets, document content or storage paths enter the DTO.
Search is server-side, bounded to 100 characters, across display/general legal/private billing
legal names. LIKE metacharacters are escaped. UUID keyset ordering is stable, 25 rows plus
one lookahead; the cursor does not require a surviving row. No browser-wide organization fetch.
Profile presence is explicitly not company verification or invoice readiness.

`/platform/organizations` and its detail page authorize independently of the layout and
navigation visibility. Both are dynamic/no-store, deny safely on direct access, and are not
indexed. The separate shell reuses language/sign-out controls and offers the tenant return
link only when existing read-only tenant resolution permits it. Existing tenant filters,
billing editing, product services, auth login and scanner/producer configuration are unchanged.

## Local verification

- Focused platform/billing application and six-locale rendering: 7 tests PASS.
- Existing tenant/context/dashboard regression batch: 33 tests PASS.
- Identity/auth persistence schema: 15 tests PASS; previous migration sources unchanged.
- Disposable PostgreSQL 16, all 27 migrations applied through Prisma migrate deploy;
  subsequent migrate status UP_TO_DATE. New platform and existing billing integration tests
  PASS (2). Separate business/auth/operator ACLs, OWNER/ADMIN/VIEWER denial without grant,
  runtime inability to insert grants, FK, verified grant, absent profile, literal and legal-name
  search, 25+4 pagination without duplicates, revoke, expired session, revoked identity,
  unverified account, no extra memberships, tenant denial and atomic audit rollback covered.
  Initial audit proof required correcting the fixture to the established SELECT/INSERT audit
  ACL (Prisma INSERT RETURNING); no production authorization relaxation was introduced.
  The temporary cluster was stopped automatically; no live database was used.
- Prisma generate/validate: PASS. TypeScript: PASS. Full lint: 0 errors, 15 pre-existing
  Better Auth harness warnings. Final affected-file lint: PASS. Whitespace: PASS.
- Final webpack build: PASS, `GYvXvPhAmXDRhwUj_u9nm`. Initial network-restricted font fetch
  failed; normal existing font fetch with network access passed. One test ProcessEnv type
  was corrected before the successful build; no dependencies/configuration changed.
- Direct anonymous local built-server list/detail/English-list requests: HTTP 404 with
  `private, no-cache, no-store, max-age=0, must-revalidate`. This does not substitute for
  authenticated live acceptance.
- Two public-DPP source tests fail unchanged on the exact base commit and working tree:
  stale ban on ProductImage and expected message-key count 41 vs current 44. Confirmed
  independently in a git-archive baseline. Their unrelated implementation was not changed;
  the entire repository test suite is not claimed green.

## Local UI proof and limits

Actual OrganizationsView/OrganizationDetailView components were server-rendered with the
built CSS and synthetic fixtures into a temporary local preview (not a shipped route).
Desktop list -> detail interaction, detail at 375 px, six translated detail pages at 320 px,
no horizontal overflow and Tab focus on Search: PASS. Captured console errors/warnings: none.
This preview has no production session, live search backend or hydrated shell; real sign-in,
language switching, sign-out and tenant return remain staging acceptance, not local proof.

- [Synthetic desktop detail](evidence/platform-admin/local-desktop.png)
- [Synthetic mobile detail](evidence/platform-admin/local-mobile.png)
- [Keyboard focus](evidence/platform-admin/local-keyboard.png)
- [Six-locale 320 px measurements](evidence/platform-admin/local-responsive.json)

## Historical staging handoff log (completed; do not rerun)

The chronological entries below preserve earlier pending states. Final results follow at the end.

### Prepared staging artifacts and next operator step

Local package: `/private/tmp/passvero-platform-c513679`.
Application build plus messages: 753 files; deploy archive excludes build cache/diagnostics.
24 changed source/schema/test/operator files in source-review archive; no environment files.
The package contains a reviewed migration, all Prisma migration sources for status comparison,
bundled operator CLI, application/source hash manifests and a read-only preflight script.

SSH read-only verification confirmed hostname `srv1834647` and the existing application
path `/var/www/passvero-acceptance`. The nonprivileged account cannot read current BUILD_ID;
therefore no current release, migration state or account binding is assumed from older notes.
The operator must run the prepared preflight. It emits only target identity, build/package pins,
migration state, selected-account UUID/verified flag and relevant ACL booleans. It performs
no grant, migration, deployment or sudo internally. No runtime environment/session data is printed.

After returned preflight, bind migration/deploy commands to that exact prior artifact:
1. Require only `20260929120000_platform_grant` pending and no partial migration; verify all
   older migration hashes and runtime dependency pins. Back up the staging database privately.
2. Use the existing migrator procedure with Prisma migrate deploy; no db push/reset/resolve.
   Check migration status and an empty PlatformGrant table. Grant only SELECT on the new
   table to passvero_app; the migrator owns operator writes. Preserve all other ACLs.
3. Save the current `.next`, messages and existing operator artifact (if any), hashes and
   build ID under `/var/lib/passvero-platform-c513679/application` before replacing anything.
   Install the hash-verified application/messages and isolated operator bundle; restart only
   staging `passvero-acceptance`. Preserve PM2 environment/configuration and scanner/producer.
4. Run the approved exact-identity grant via the privileged operator wrapper; remove inherited
   NODE_CHANNEL_FD/NODE_CHANNEL_SERIALIZATION_MODE before starting the standalone Node CLI.
   Retain only sanitized GRANTED/NO_CHANGE plus canonical user ID as operator evidence.
5. Login -> Platform Admin -> list/search -> existing Passvero Acceptance detail -> compare
   retained synthetic billing values -> return. No new users or billing edits. Check desktop,
   mobile, all six languages and save screenshots without unrelated real organization data.

Rollback contract: restore the saved prior application/messages/operator artifact and restart
only the staging application. Keep the additive PlatformGrant table and all audit history;
no automatic database restore, table drop, membership/auth change or billing-data cleanup.
If disabling the new operator grant is desired, use the audited idempotent revoke first.
Exact executable migration/deploy/rollback handoff is bound to the returned preflight instead
of guessing privileged paths/state. The prior live artifact is NOT_YET_BACKED_UP by this task.

Earlier NOT_PROVEN statuses, including reboot and unattended scanner/producer continuity,
remain unchanged. Next business slice: agree and implement manual annual invoices/subscriptions;
no financial rules, invoice/PDF/Stripe/subscription statuses are invented here.

## Package handoff and review

Independent bounded source review: no blocking findings. Runtime SELECT-only grant ACL
remains an explicit live operator verification, not implied by that source review.
Package uploaded without replacing the active app to `/home/darko/passvero-platform-c513679`.
Remote file checksum verification PASS. Package SHA256SUMS digest:
`56fb996573a1b76974432fc94e8ef19cf0fddb5865a5805868475eba881d46fb`.
Source-review manifest digest:
`a704a303b3ff3bc6247e5fd55346df446550e42821cc4d3892c43557d7ded89b`.
Preflight script digest:
`ce88aba11b6c552f866102b684953a0f1daf63ff58fe8e017f069f1722181443`.
These are package identities; the adjacent repository manifest additionally covers this
subsequent report, roadmap, permission documentation and local screenshots.

PENDING_OPERATOR_COMMAND: run the read-only preflight with the approved account.
No new permission confirmation is required; the pause is the user's explicit privileged
operator execution boundary. Exact live migration/deploy/rollback pins follow its output.

## Operator preflight returned — PASS; migration prepared

[Sanitized operator preflight](evidence/platform-admin/operator-preflight.json) confirms
current build `OD9e4NOtu9LlMjE_0U2Dz`, verified approved canonical user, fixed staging
DB/port/data directory, no unfinished migration and absent PlatformGrant. It is
operator-returned evidence. No grant, data write or deployment occurred.

Staging package/lock hashes differ from source packaging but exactly match the previous
accepted billing-icon manifest, fetched read-only from the existing operator package.
The migration handoff pins those two live hashes and individually checks installed runtime
dependency versions against the local build's versions before any database write. No package
replacement, install or dependency upgrade is planned.

`migrate-once.py` reuses the prior accepted billing migrator procedure. Its only schema scope
is `20260929120000_platform_grant`: private pg_dump first, exact historical migration checksums,
one Prisma migrate deploy attempt, empty new table, FK/PK/index verification, and SELECT-only
runtime ACL. Existing owner/ACL inventory, identity/audit records and billing profiles are
compared before/after. No account grant. The application must retain the preflight build.
Failures stop without a blind retry or database restore. Syntax, package inventory/hashes,
new-object/privilege expectations, one-deploy-attempt guard and generated catalog SQL reviewed.
The earlier disposable proof covers the migration SQL and persistence behavior.

[Reviewable migration operator script](evidence/platform-admin/migrate-once.py).
Migration handoff manifest SHA-256:
`a1b24d9aeb0208919a0ee907ff13e282e81ae849559d3fd871cac3f57574ac60`.
This additive handoff does not alter the previously verified application archive or original
SHA256SUMS. Migration backup/report target:
`/var/lib/passvero-platform-c513679/migration`.
PENDING_OPERATOR_COMMAND now means the one-time staging migration; deployment/grant remain
pending its result. Previous application rollback remains the required next deploy preparation.

## Staging migration PASS; deployment handoff prepared

[Operator migration result](evidence/platform-admin/operator-migration.json): one attempt,
20260929120000_platform_grant applied, Prisma UP_TO_DATE, zero grants, runtime SELECT only;
existing data/owner/ACL unchanged. Backup confirmed by operator at
`/var/lib/passvero-platform-c513679/migration/staging-before.dump`, SHA-256
`42fc43d3f59f228a53cb13f13c3eedff0aa15f4c4b8ba047ac3e52005cf771aa`.
Application is not yet deployed and no grant is active from this task.

[Deploy script](evidence/platform-admin/deploy.py) and
[rollback script](evidence/platform-admin/rollback.py) reuse the previously accepted
billing-icon artifact procedure. Exact prior build: OD9e4NOtu9LlMjE_0U2Dz; exact new build:
GYvXvPhAmXDRhwUj_u9nm, 753 application/message files. Before replacing the app, verify the
prior deployment manifest and every prior artifact, migration report, runtime package hashes,
dependency versions and protected configuration. Preserve prior .next/messages through
same-filesystem renames and save the old runtime manifest. Restart only passvero-acceptance.
Verify six public localized pages plus anonymous platform list/detail: 404 private/no-store
on each of six locales, startup error count zero and untouched runtime/scanner configuration.
No grant is part of this script. Rollback restores the prior app and metadata, retaining all
new table/audit data. A caught failure after stop triggers the saved application rollback.
No reboot or scanner/producer operation is performed.

Syntax, archive inventory/hashes, pins and diff from the accepted procedure reviewed.
Local filesystem simulation verified rollback's restore logic after zero, one or both artifact
swaps. This is not a claim of a live restart/rollback exercise. The saved rollback path after
successful preparation is `/var/lib/passvero-platform-c513679/application/rollback.py`.
Deploy handoff SHA256SUMS digest:
`ff62548d94306477788b11f7956d0f9011af11b0048cc66e0ac189c14c59c86f`.
PENDING_OPERATOR_COMMAND: deploy the pinned application; await returned deployment evidence.

Remote deploy handoff checksums PASS. Independent bounded deploy/rollback review found
no blocking findings; reviewed 753 archive hashes, build pins, partial-swap rollback and
six-locale anonymous read checks. No live execution by the reviewer or agent.

## Staging deployment PASS; approved operator grant handoff

[Operator deployment result](evidence/platform-admin/operator-deployment.json) confirms
GYvXvPhAmXDRhwUj_u9nm deployed, all 753 artifact files verified, HTTPS/TLS 200/0,
zero startup errors, six-locale anonymous list/detail denial with private/no-store headers.
Runtime configuration, early-access operator, scanner/broker/producer unchanged. Prior build
and saved rollback confirmed at `/var/lib/passvero-platform-c513679/application/rollback.py`.
The grant has not yet been executed; the account approval from the conversation remains valid.

[Explicit operator wrapper](evidence/platform-admin/operator.py) checks the supplied email
against the explicit preflight-confirmed canonical UUID, deployed build, pinned bundle and
fixed staging DB. It whitelists only the existing runtime DB URLs, runtime marker and canonical
origin into a standalone Node process; no PM2 IPC variables, Node options or session tokens.
No credentials are printed or persisted. The child runs as OS postgres with only the app's
primary group added temporarily for dependency read access; no OS group membership or
filesystem ACL is changed. SQL peer connection sets passvero_migrator, provider reads still
use the existing dedicated auth connection. The runtime role retains SELECT-only grants.

Postconditions verify active grant/revocation, expected audit delta and unchanged membership
count. Grant/revoke remain idempotent in the previously tested transactional service. The
wrapper emits only sanitized status/UUID and records a private operator result; failures stop
without a blind retry. Syntax, environment whitelist and result truth table checked locally;
independent bounded review found no blocking findings. No new app build is needed.
Operator handoff manifest digest:
`0aebc1c1d09717220d9f9f7ce3ae73df0a6d204cb86b414ba19a16fb28004e88`.
PENDING_OPERATOR_COMMAND: apply the already approved exact-account grant, then proceed to
real-session read-only acceptance. No additional account approval or credentials requested.

## Grant attempt stopped; read-only diagnostic pending

User-returned wrapper output reports CLI_ONCE failure after one attempted invocation.
The captured CLI error was not retained. Grant and audit state are UNKNOWN until read-only
inspection; no retry is authorized by this failure alone. Existing account approval remains
valid. The diagnostic checks the exact canonical identity and grant/audit counts first,
then imports the same dependencies and reads through the operator/auth clients inside
read-only transactions. It never calls grant/revoke and prints only sanitized error codes
and categories. Application acceptance remains pending.

PENDING_OPERATOR_COMMAND: run diagnose.py and return its sanitized output.

## Read-only diagnosis: no active grant; operator packaging fix

User-returned diagnosis confirms verified canonical account, active=false,
zero platform audit events, one membership. The first Prisma operator read fails
with ERR_MODULE_NOT_FOUND. Generated Prisma dynamically imports its PostgreSQL
query compiler and WASM module. Externalized ESM imports cannot use the wrapper's
NODE_PATH from the /tmp bundle location. The isolated local reproduction fails with
the same code before the fix and passes compiler load plus WebAssembly.Module
construction after including those two modules in the bundle (39 runtime exports).

Only operator packaging changes: application source/build, database schema, dependencies
and configuration are unchanged. operator-fixed.py checks the exact approved account
and observed initial state, runs diagnostic-fixed.cjs read-only, requires its sole PASS
result and unchanged snapshot, then invokes the grant CLI once. A failed probe performs
no grant. A failed grant prints a fresh read-only state and stops without retry.

OPERATOR_FIX_SHA256SUMS SHA-256:
8ddb04eb33f622430860ba4b767075a7b8756e8bbd126b43515e5db68a4bf74c

Local compiler reproduction and fixed module/WASM check PASS; wrapper AST parse PASS.
Live fixed-package probe and grant remain PENDING_OPERATOR_COMMAND.

## Approved staging grant PASS

User-returned operator-fixed.py output confirms read-only probe PASS, GRANTED for
canonical user 40e51001-912c-4bcf-aa45-d866632aac85, grant_active=true, audit_delta=1,
memberships UNCHANGED, database passvero_acceptance:5433 and production_changes NONE.
No further grant invocation is needed. Authenticated staging UI acceptance remains pending.

## Final authenticated staging acceptance — PASS

Observed through native Chrome UI on staging after the approved grant:
- Sign-in to the existing approved account; dashboard shows Platform Admin.
- List contains the existing organizations; display-name search returns Passvero Acceptance.
- Legal-name search for the existing synthetic billing fixture returns that organization;
  Tab focuses Search and Enter submits successfully.
- Detail separates organization identity from private billing data. All entered synthetic
  values match the existing customer billing screen, including leading-zero postal/tax fields.
  The empty VAT field is omitted from the read-only detail. No form save was performed.
- Language control switches the same detail through hr/en/de/sl/pl/sr, translating labels,
  dates and country while preserving data and organization identity.
- Desktop full-page screenshot at 1280 CSS px and mobile full-page screenshot at 390 CSS px
  inspected: readable cards, controls and billing data, no visible clipping.
- Return to customer workspace and subsequent Platform Admin navigation work.
- Sign-out returns to login. Temporary test tab closed; original DevTools width restored.

[Synthetic staging desktop](evidence/platform-admin/staging-desktop.png) ·
[Synthetic staging mobile](evidence/platform-admin/staging-mobile.png)

Browser extension control was unavailable; native Chrome UI was used. No tokens or
credentials were extracted. Screenshots contain only page content and synthetic billing data.
Live multi-page pagination, revoke, ordinary-member denial and invalid-session permutations
were not repeated: they remain local/disposable PostgreSQL proof. Only two organizations
were present on the live list, so no live next-page proof is claimed. Console/network
instrumentation was not collected in this native UI run. Existing unrelated NOT_PROVEN
statuses remain unchanged; no scanner/producer/reboot acceptance was reopened.

## Retained operator maintenance and rollback

The original externalized compiler bundle is obsolete. Use the fixed bundle for future
explicitly authorized grant/revoke operations. The successful operator-fixed.py is a
one-time recovery wrapper requiring the pre-grant state; do not rerun it.
The general operator-maintenance.py retains the original grant/revoke arguments and guards,
with only the fixed bundle path/hash changed. It is prepared, not executed live.
OPERATOR_MAINTENANCE_SHA256SUMS SHA-256:
4cf518425807d6cf7e5c69a2bd70c570c01896db34d5ab7ec3af44456ca1fcb2

Future VPS procedure: in /home/darko/passvero-platform-c513679 verify the manifest digest
above and its entries, then install operator-maintenance.py and platform-access-fixed.cjs
root:root mode 0644 into /tmp/passvero-platform-c513679. Invoke with sudo python3 -I -B,
followed by action grant|revoke, exact email, canonical UUID and operator reference.
Expect PASS with GRANTED/REVOKED and audit_delta=1 for a change, or NO_CHANGE/audit_delta=0
for an idempotent request; memberships must remain UNCHANGED. STOP means inspect state,
never blind retry. Revoke is documented, not requested or executed as part of live acceptance.

Application rollback remains /var/lib/passvero-platform-c513679/application/rollback.py;
keep additive schema and audit history, no automatic database restore. Accepted build:
GYvXvPhAmXDRhwUj_u9nm; migration: 20260929120000_platform_grant.
Final source/evidence manifest is PLATFORM_ADMIN_ORGANIZATIONS_AND_BILLING_OVERVIEW_STAGING.sha256.
No commit/push, production access/change, billing edit or membership mutation was performed.

## UI alignment supplement — local PASS (pre-deployment record)

The accepted functional diff and evidence are preserved. Pre-edit snapshot:
/tmp/passvero-platform-before-ui.tar.gz. Eleven UI/test/message files differ from that
snapshot; combined reviewed implementation now has 25 source files. No authorization,
service query, persistence, migration, operator or auth/session source changed.

DashboardNavigation has an explicit platform presentation mode using the same fixed navy
sidebar, brand, native dialog, Escape/close/focus and route-change behavior. It renders
Organizations active for list/detail and conditional tenant return only. DashboardShell
adds an optional administrative context label; existing dashboard defaults are unchanged.
The shared language/sign-out controls remain unchanged. There is no tenant organization
label in the platform header. The organization list uses the catalog's desktop table and
mobile-card pattern, search icon, explicit reset, distinct empty states, textual status
badges, and existing pagination. Detail has separate organization/billing sections,
read-only facts, optional-value labels, wrapping and a back-to-list action. Previous list
return did not preserve query/cursor, so this supplement does not change that behavior.

New verification: 28 targeted UI/dashboard tests PASS; TypeScript PASS; affected lint PASS;
full lint 0 errors/16 existing warnings (15 prior harness plus retained packaging evidence);
whitespace PASS. First build lacked BETTER_AUTH_URL and stopped ORIGIN_MISSING; rerun with
existing public staging origins succeeded. No environment files changed.
Final build: vwSSh_nI3c5X-dORRWq6S, 758 artifact files. Source review: no blockers.
Local browser preview uses actual components, synthetic data and mocked routing: desktop
sidebar/list and mobile cards inspected; modal opening, Escape and trigger focus verified.
This is not real authenticated staging acceptance. The six-locale static presentation and
shared-header regression tests pass. Live navigation/locale/responsive screenshots follow deployment.
Existing PostgreSQL, grant/audit and authorization proofs are reused, not repeated.

UI deployment package: /home/darko/passvero-platform-ui-c513679.
DEPLOY_SHA256SUMS digest: 728dfe695130bfa3735071bcd6ee02600c1136786d2b4b03484e23dd4f9cffc4.
New rollback: /var/lib/passvero-platform-ui-c513679/application/rollback.py restores
GYvXvPhAmXDRhwUj_u9nm. Older functional rollback and evidence remain retained.
Deploy changes .next/messages only; no migration, grant, revoke or audit commands.
Historical handoff: PENDING_OPERATOR_COMMAND was resolved by the deployment evidence below.
Final screenshots and the consolidated manifest are completed below. Earlier NOT_PROVEN statuses remain unchanged.

## UI alignment staging deployment PASS

Operator-returned evidence confirms build vwSSh_nI3c5X-dORRWq6S, 758 verified
artifacts, 25 combined source files, HTTPS 200/TLS 0, zero startup errors, anonymous
private/no-store denial in six locales. Existing approved grant, runtime configuration,
scanners/broker/producer unchanged. Rollback retained at
/var/lib/passvero-platform-ui-c513679/application/rollback.py. No migration or grant rerun.
Authenticated visual acceptance completed after user sign-in; see the final record below.

## UI alignment authenticated staging acceptance PASS — 2026-09-29

New live read-only Chrome proof: desktop list/search/detail and mobile cards/detail;
no-results hint and reset to the unfiltered list; back-to-list; active Organizations link
on detail; mobile initial focus, Tab to close control, Escape restoring trigger focus,
and menu closing after navigation. Mobile customer-dashboard return and Platform Admin
round-trip passed with the existing customer context retained only in the customer UI.
List and detail headings/routes were checked in all six locales at 320 px. Width checks
at 320, 375, 768, 1024 and 1440 px found no whole-page horizontal overflow.
Four screenshots were visually reviewed: desktop 1440 x 1000, mobile 375 x 900 viewport
(full-page detail). Only synthetic acceptance billing data appears. No captured console
warnings/errors. Temporary viewport override reset and test tab closed.

- [Desktop list](evidence/platform-admin/ui-alignment/staging-list-desktop.png)
- [Desktop detail](evidence/platform-admin/ui-alignment/staging-detail-desktop.png)
- [Mobile list](evidence/platform-admin/ui-alignment/staging-list-mobile.png)
- [Mobile detail](evidence/platform-admin/ui-alignment/staging-detail-mobile.png)
- [Structured UI evidence](evidence/platform-admin/ui-alignment/staging-ui-acceptance.json)

Existing authorization/PostgreSQL/grant/audit proofs are reused because their source and
dependencies are unchanged. Live next-page (only two organizations), revoke and sign-out
were not repeated. Empty initial collection/profile branches retain local presentation
proof. No new staging data, billing edits, grant operations or production access.
Earlier unrelated NOT_PROVEN statuses remain unchanged. No commit/push.
Final build: vwSSh_nI3c5X-dORRWq6S; 758 deployed artifact files, 25 reviewed combined
source files, 11 UI supplement files. Application rollback:
/var/lib/passvero-platform-ui-c513679/application/rollback.py (restores GYvXvPhAmXDRhwUj_u9nm).
The consolidated .sha256 manifest covers implementation, documents and reviewed screenshots;
it excludes itself to avoid a self-referential hash.
Final consolidated manifest: 66 files (plus the manifest itself).
