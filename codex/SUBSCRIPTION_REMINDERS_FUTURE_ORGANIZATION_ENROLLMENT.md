# SUBSCRIPTION_REMINDERS_FUTURE_ORGANIZATION_ENROLLMENT

## Status — accepted staging scope, 2026-10-08

Implementation, staging migration/deploy and approved enrollment/idle acceptance
completed. This final status supersedes the historical phase handoffs below.
Base main 6b418e50a2081755dc8f588839e595ac7f9140f4; no commit or push.
Staging build mMVPOjFPkw5L42RIqziS4, 33 migrations, 839 pinned artifacts.
Actual immutable activation boundary: **2026-10-08T15:22:24.818Z**.
Policy and existing timer remain enabled/active after two ordinary worker cycles.
One EXISTING_APPROVED enrollment for ee116a32-05e8-401f-a90f-b54b31b3b7e9;
current legacy campaign linked without a new 384-budget trial campaign.
Milank's current campaign remains 12/0, its approved recipient and original expiry.
Other 13 existing organizations are explicitly excluded, operators empty,
PUBLIC_AVAILABILITY disabled. Future eligible organization/recipient selection
and due subscription delivery are explicitly approved under the confirmed policy.

Both ordinary cycles completed with zero new outbox rows/SMTP attempts and
unchanged existing budgets/counters. Live future controlled activation was not
performed; local PostgreSQL activation/replay/rollback/concurrency proof is
separate from this live existing enrollment/idle proof. No new identity, period,
trial date change, commercial write, production change or inbox receipt claimed.

Final live evidence: `codex/evidence/reminder-future-enrollment/operator-acceptance-pass.json`.
Final source/artifact/evidence manifest: `codex/evidence/reminder-future-enrollment/source-manifest.json`.

## Source findings at the base commit and affected boundaries

- `PrismaControlledActivation.markActivationBound` starts trial inside the same
  transaction as binding the verified controlled activation. It runs only after
  the activation intent state changes successfully. Its historic ADMIN exception
  is bound to the exact approved AccessRequest/user/activation aggregate.
- `activateOrganizationTrial` uses the shared organization advisory lock and
  refuses to create a second entitlement enrollment. It currently records no
  reminder enrollment or campaign.
- `PrismaCommercial.confirmPayment` persists accepted paid periods and upgrade
  receipts in the existing commercial transaction. Requests, approval and offers
  alone do not confer paid coverage. No payment or authorization change is needed.
- `readReminderCoverage` takes the same organization lock and evaluates due
  conditional downgrades. A periodic reconciliation can reuse this path, so a
  page visit is not required to evaluate a due change.
- `reminderDecision` supplies exact period/deadline revision and only the latest
  due threshold. Confirmed contiguous continuation suppresses old-period messages.
  PUBLIC_AVAILABILITY has a separate decision and remains outside the new scope.
- `ReminderWorker` rechecks coverage and eligible recipients before dispatch,
  reserves the persistent campaign budget, fences leases and uses the unique
  organization/revision/kind/threshold/channel/recipient key. Ambiguous delivery
  remains DELIVERY_UNKNOWN with explicit operator resolution.
- Manual `campaignScopeSchema` requires a nonempty explicit recipient allowlist;
  `reminderRecipients` intersects active verified owners/confirmed billing with
  that list. Future enrollment needs a distinct governed recipient mode, while
  preserving existing manual allowlists and explicit operator approval.
- Runtime ACL permits campaign reads and selected worker-counter updates, but
  no campaign INSERT or approval edits. Automatic creation needs a narrow,
  policy-governed persistence boundary; broad approval-write authority is unsuitable.
- Current outbox cancellation plus `skipDuplicates` cannot automatically restore
  an identical CANCELLED logical message after temporary recipient ineligibility.
  The new mode must resume only proven unsent eligible messages, preserve attempt
  totals and never revive SENT, FAILED or DELIVERY_UNKNOWN blindly.
- Current worker adoption of stranded pending messages must not transfer an
  explicit tenant/campaign exclusion into a newly enabled automatic campaign.

## Confirmed business policy — 2026-10-08

1. Organization enrollment persists until explicit exclusion. An independent
   staging policy can suspend reconciliation/sending without losing provenance.
2. Each distinct authoritative trial or paid period receives one campaign,
   ending seven calendar days after that period ends (Europe/Zagreb). Late
   verification sends only the current threshold; missed thresholds are not
   replayed. Expiry delivery is limited to this seven-day window.
3. A new period has a finite total cap of 384 SMTP attempts: the existing maximum
   32 deduplicated recipients, four subscription thresholds and at most three
   attempts per logical message. Recipient churn shares the same finite cap.
   Operators remain absent unless separately configured and approved.
4. Upgrade within a base period and recipient changes do not replenish budget.
   A distinct confirmed renewal/replacement period obtains its own campaign;
   a blocked downgrade confers no active period or budget for sending as active.
5. Exhaustion is visible and stops dispatch. Additional capacity requires an
   explicit audited limit increase; neither scheduler execution nor replay
   automatically refills the campaign. A distinct renewal continues normally.
6. Milank's existing approved trial campaign retains its ID, history, recipient
   scope, expiry and limit 12. Subsequent confirmed periods use the new policy.
   No parallel campaign is created for its current trial.

The policy is accepted. It is not permission to enable or send to new recipients.

## Implemented persistence and worker design

The additive migration adds durable staging policy, organization enrollment/exclusion provenance and
unique period-to-campaign linkage to the existing reminder model. Policy is
initially disabled. Record the real enable boundary in the database; inventory
and persist existing organization exclusions at that boundary, with only the
explicitly approved Milank organization carried forward. Names and email domains
are never eligibility evidence. Re-enable must preserve the original boundary
and exclusions rather than open an implicit historical backfill.

On a newly successful controlled activation, record reminder eligibility inside
the trial transaction using the exact approved request, activation intent,
organization and trial enrollment. Rollback leaves no enrollment. Existing
organizations, even if activated later, remain excluded by the enable inventory.
Use common policy/organization locking for enable, activation and reconciliation
to make boundary races deterministic; do not infer eligibility just from timestamps.

The scheduled entrypoint reconciles only durable eligible enrollments against
existing authoritative coverage before selecting a campaign. This is the recovery
path when campaign creation is interrupted after enrollment; repeated execution
and concurrent workers must produce the same single period campaign. Coverage
evaluation also runs without eligible recipients. Preserve explicit disabled
campaign/tenant states. Avoid scheduler starvation by excluding exhausted/closed
campaigns from normal sending selection while retaining expired-lease recovery.

For automatic campaigns, reuse active verified OWNER and matching confirmed
billing checks with normalized deduplication and a finite recipient bound.
Revalidate enrollment policy, organization exclusion, period and recipients during
dispatch preparation. Retain manual campaigns unchanged. A replacement/renewal
cancels obsolete pending/claimed work; accepted and unknown attempts remain intact.

Expose enrollment, tracked period, no eligible recipient, sending disabled,
blocked transition and exhausted budget in the existing billing delivery view,
with existing UI components/colors and localization. Keep billing authorization;
read-only PlatformGrant must not acquire commercial mutation rights.

## Verification prepared

Reuse the disposable PostgreSQL harness in
`tests/proofs/subscription-entitlements-postgresql.mjs`, following the existing
focused reminder proof wrapper. New tests cover:

- successful controlled activation, duplicate invocation and transaction rollback;
- excluded historical tenant and existing Milank campaign linkage;
- trial to paid, confirmed renewal, upgrade without budget reset;
- executed replacement versus conditional/blocked downgrade;
- initially unverified owner, later verification, billing revision/email change;
- normalized owner/billing deduplication and absent unapproved operators;
- competing activation/reconciliation/workers, one campaign/logical outbox key;
- stale pending/claimed cancellation and no blind unknown-delivery retry;
- missed campaign creation recovery and controlled exhaustion/resumption;
- disabled policy/tenant/campaign and seven-day expiry limit;
- scheduler fairness with exhausted campaigns and abandoned-lease recovery.

Run relevant application/integration suites, lint, production build, TypeScript
after build completes, and whitespace checks. No unrelated antivirus/backup/full
commercial acceptance repetition. Executed checks and exact results are recorded below.

## Staging handoff and final evidence

After local verification, prepare a manifest-pinned deployment/migration package
with a rollback artifact. Privileged operations are complete VPS TERMINAL blocks,
marked PENDING_OPERATOR_COMMAND and awaiting actual operator output; no autonomous
sudo. First obtain fresh read-only staging/runtime/ACL/migration/recipient evidence.

Before enable, deliver one exact proposal containing the database enable boundary,
excluded-existing inventory, new eligible organization set, exact recipients,
currently due decisions, unchanged Milank trial scope, and one bounded enrollment
plus regular-worker idle acceptance scenario. No new live identity/period without
explicit approval, and no trial date changes to force delivery.

Disable procedure must suspend the new policy and its managed campaign sends
without deleting enrollment, outbox, budgets or audit. For application rollback,
quiesce the worker/timer and reconcile in-flight unknown outcomes before restoring
the pinned application and worker artifacts. Keep additive migration/history.
Exact commands and package pins will be supplied with the reviewed implementation.

Final report, contract, both roadmaps and manifest will distinguish local proof,
operator-confirmed staging evidence, enable/scope, provider acceptance and actual
inbox receipt. Existing accepted proofs apply only to unchanged source and are
not represented as new live evidence.

## Local evidence — 2026-10-08

- Disposable PostgreSQL focused reminder suite: 27 PASS, 0 FAIL; all migrations
  applied, isolated cluster stopped. Includes managed upgrade, blocked downgrade,
  executed replacement, concurrent binding/reconciliation/workers, strict ACL,
  provenance retention, recipient cap/dedup, exclusion, expiry, replay and budget.
  Log: `/private/tmp/reminder-enrollment-postgresql-final.log`.
- Focused reminder/controlled/verified-activation application and infrastructure
  tests: 26 PASS, 0 FAIL. Log: `/private/tmp/reminder-enrollment-focused-tests.log`.
- Full lint: exit 0, 16 existing warnings in unrelated historical proof assets;
  scoped lint on changed executable TypeScript/TSX: exit 0, no warnings.
- Production webpack build: PASS, ID `mMVPOjFPkw5L42RIqziS4`, with public
  `PASSVERO_RUNTIME_ENV=staging` and `BETTER_AUTH_URL=https://staging.passvero.eu`.
  No DB/SMTP credentials or live connections were supplied. Default Turbopack
  failed on internal port binding; the first webpack attempt correctly rejected
  missing canonical origin. Final log: `/private/tmp/reminder-enrollment-build-final.log`.
- TypeScript after successful build: PASS. Python preflight/launcher AST and
  bundled worker Node syntax: PASS. Whitespace checked for tracked and new files.
- Prepared local worker bundle: `/private/tmp/passvero-enrollment-worker-20261008-v1`.
  This prepared bundle was subsequently deployed and accepted; its hash and inputs
  are retained in the manifest and later operator evidence.
- No browser/physical-device visual acceptance is claimed for the added server
  delivery view. Existing components/colors and six locales are reused.

## Historical pre-deployment live scope and proof limits

No fresh operator output has been received in this task. The prior report records
only campaign `a24b67dd-442c-4f06-b4f3-498554b4ff31` for organization
`ee116a32-05e8-401f-a90f-b54b31b3b7e9`, limit 12. Treat that as historical evidence,
not a freshly confirmed active scope. The read-only preflight captures exact
current owners/billing confirmation, periods, outbox, attempts, scheduler,
canonical artifacts and runtime identity before preparing deployment/enable pins.
No new subscription provider acceptance or inbox receipt is claimed.

The migration initializes policy id 1 disabled, with no enable boundary or
organization enrollment. It creates no campaign and alters no existing campaign
scope, counters, trial, paid terms or delivery history. Runtime may execute only
constrained enrollment/campaign functions and update reconciliation status.
Policy, enrollment exclusion/provenance, approval fields and budgets remain
operator-owned. DB triggers prevent deletion/rewriting of provenance and moving
an established boundary or removing its historical exclusion inventory.

## Disable, controlled continuation and rollback contract

- Suspending the new policy (`enabled=false`) stops managed reconciliation/sends.
  Explicit tenant exclusion sets enrollment `enabled=false, excludedAt=<DB instant>`.
  Period campaign `enabled=false` stays false; reconciliation never replaces it.
  Historical excluded IDs and the original enable instant survive policy resume.
- New controlled activations while the enrollment policy is disabled are not
  enrolled. No automatic scan/backfill of those organizations occurs on resume.
  Any exception would require an exact explicit proposal, not inferred eligibility.
- Reconciliation derives new period campaigns from immutable paid receipts and
  activation state. Trial and paid keys remain distinct; upgrade in a base paid
  period reuses that key and budget. Coverage is revalidated before SMTP reservation.
- Exhaustion is shown in enrollment/delivery state and excluded from ordinary
  scheduler selection. An operator-approved increase must update the same campaign
  and append audit with old/new cap and decision reference in one transaction.
  Existing DB finite safety ceiling is 100000; normal automatic creation is always
  384. No automatic refill, new same-period campaign or UNKNOWN retry is allowed.
- Before executable rollback, stop the dedicated timer/service, account for
  in-flight attempts, disable the new policy and its managed campaigns, then restore
  exact pinned application/messages/worker/launcher artifacts and canonical manifest.
  Keep additive schema, enrollment, budgets, attempts, audit and migration history.
  The previous worker must not be restarted with managed campaigns enabled because
  it does not understand the new enrollment gate. Restore the separately approved
  legacy scope only after explicit state reconciliation.
- Actual migration/deploy/disable/rollback copy/paste blocks and package pins will
  be completed after the returned read-only operator inventory. None was executed.

Final local source manifest: `codex/evidence/reminder-future-enrollment/source-manifest.json`.
Task remains open through staging deployment and separately approved enrollment/idle acceptance.


## Read-only preflight correction — 2026-10-08

Operator returned STOP / RUNTIME_DATABASE_SCOPE, databaseWrites 0,
workerExecuted false, emailsSent 0. The Python guard mistakenly expected localhost;
the existing TypeScript staging resolver requires 127.0.0.1:5433/passvero_acceptance.
Only the operator preflight was corrected to that exact existing endpoint.
No runtime/env/DB change is needed or performed. Scope diagnostics expose only
allowlisted role/host/database, numeric port and validity; never URL/password.
The synthetic Python endpoint proof reproduces the wrong-host failure, then passes
3 tests after correction, including production rejection and secret-safe diagnostics.
Existing application/worker/build/PostgreSQL evidence is retained unchanged.
The corrected full VPS block is VPS-TERMINAL-PREFLIGHT-v2.sh in the prepared local
artifact directory. The corrected operator run subsequently returned PASS; see the fresh inventory below.


## Fresh operator inventory and deployment handoff — 2026-10-08

Read-only preflight PASS observed at 2026-10-08T16:56:24.89548+02:00.
Verified database passvero_acceptance, port 5433, acceptance data directory;
app/auth runtime endpoints both 127.0.0.1:5433 with their dedicated roles.
Canonical build qgd6USnbSbiUKZInR9gSC, 839 artifacts, 32 finished migrations.
14 existing organizations, 3 campaigns, 6 historical outbox rows (4 SENT,
2 CANCELLED), 4 ACCEPTED attempts; no pending/claimed/sending/unknown rows.
No database writes, worker execution or emails in this preflight.

Milank's authoritative trial starts 2026-10-05T15:27:58.877Z and ends
2027-04-05T15:27:58.877Z. Existing campaign
 a24b67dd-442c-4f06-b4f3-498554b4ff31 retains its approved deadline
2027-04-06T15:27:58.877Z, limit 12, dispatches 0, existing recipient scope
and empty operators. The confirmed future policy does not extend this legacy
trial's one-day acceptance campaign to seven days or replace its budget.

Prepared package: /private/tmp/passvero-future-enrollment-20261008-v2.tar.gz.
Hashes and complete operator-block pins are in staging-package.json.
It reuses the tested build mMVPOjFPkw5L42RIqziS4 and worker without rebuilding.
The guarded operator installer validates the fresh runtime/business inventory,
drains the existing timer without forcing an active worker to stop, deploys only
migration 20261008120000_reminder_future_enrollment and minimal runtime ACLs,
swaps pinned application/messages/worker/launcher, validates HTTPS and anonymous
admin boundary, and restores the pre-existing timer scope. Policy remains
false with no enabledAt, enrollments or managed campaigns. No direct worker
execution, fixture creation, enable, new recipient or SMTP call is performed.
Installer counters/approvals are checked before timer restoration.

Six isolated operator tests passed, including inventory/migration/path guards,
rollback orchestration on injected migration failure, and actual local filesystem
restoration of both artifact directories, worker, launcher and canonical manifest.
These are local simulations, not a claim of live rollback acceptance.
Existing application/PostgreSQL/build checks are reused unchanged.

Local upload: /private/tmp/LOCAL-TERMINAL-ENROLLMENT-UPLOAD-20261008.sh.
VPS install: /private/tmp/VPS-TERMINAL-ENROLLMENT-DEPLOY-20261008.sh.
Explicit rollback, only if required:
/private/tmp/VPS-TERMINAL-ENROLLMENT-ROLLBACK-20261008.sh.
Rollback retains the additive schema and all database/audit/delivery history.
It refuses unresolved delivery or an enabled new policy/managed campaign;
future enable must first be disabled and accounted for. Artifact/migration failure
never retries delivery. If rollback cannot pass its safety guards, timer stays
stopped and STOP requires operator review; migration failures are never retried.

Migration and deployment remain PENDING_OPERATOR_COMMAND. The separately approved
combined enable/recipient/acceptance projection follows actual deployed output.
No live enrollment, new identity, period, recipient, delivery or inbox acceptance
is claimed by this handoff. No production change, commit or push.


## Operator migration/deploy acceptance and combined enable projection

Returned operator report: deployment PASS, migration PASS, build
mMVPOjFPkw5L42RIqziS4, 33 migrations, 839 artifacts. New enrollment policy remains
false; enrollments 0, managed campaigns 0, retained campaigns 3, Milank 12/0.
The existing approved timer scope was restored. Installer worker execution false,
new recipients 0, emails sent by installer 0. Inbox receipt NOT_CLAIMED.
This is the guarded operator deployment evidence, not live new-enrollment proof.

One combined projection is recorded in enable-projection.json; the atomic
review-only SQL is enable-reviewed.sql. Neither is executed. Enable boundary is
the actual UTC DB timestamp recorded once by the approved transaction. Freeze
and retain the exact other 13 existing organization IDs as historical exclusions;
only Milank's approved organization is carried forward. Future eligibility
requires organization creation AND successful matching controlled activation/trial
binding at/after the boundary. No historical scan or disabled-window backfill.

Milank is inserted as EXISTING_APPROVED durable enrollment and the current
campaign is linked to trial:2026-10-05T15:27:58.877Z, retaining manual recipient
selection, original deadline, approval and 12/0. Reconciliation then finds this
campaign instead of creating a second 384-budget trial campaign. A future confirmed
new period gets the new model and budget. Exact current recipient:
milanko.zivic@optinet.hr as active verified OWNER. The same billing email is
unconfirmed and grants no additional eligibility. Operators remain empty.
Two disabled historic campaigns and PUBLIC_AVAILABILITY remain disabled.

Due messages now: 0. Earliest existing trial threshold is
2027-03-06T16:27:58.877Z (30 Zagreb calendar days before expiry).
No live test identity, changed period/date or forced message is proposed.
The bounded acceptance is one durable existing-approved enrollment, unchanged
3 campaigns, then normal scheduled worker reconciliation/idle and a second ordinary
cycle proving the same enrollment/campaign/outbox/attempt counts. A literal
COMPLETED worker status with zero messages is an idle business cycle. No SMTP
attempt is expected or authorized for this idle acceptance. New controlled
activation atomicity/replay remains covered by the local PostgreSQL evidence;
there is no claim that a new controlled activation occurred live.

The full automatic-model proposal explicitly includes recipient selection for
future eligible organizations: active verified OWNERs plus matching confirmed
billing email/revision, deduplicated, max 32, no operators. Future identity/email
values are not available today and are not represented as known exact addresses.
Confirmation limited to the currently named recipient must not be interpreted as
authorization for future dynamic recipient selection. Until the user confirms the
complete automatic enable/recipient scope, policy stays disabled. No enable or
acceptance worker command is supplied for execution in this handoff.

No repeated application tests/build/deploy/rollback: the accepted unchanged
source and artifact checks are retained. Source manifest updated with operator
PASS and pending approval; the deployment archive/manifest pins remain unchanged.


## Explicit enable approval and guarded operator procedure — 2026-10-08

User confirmed the complete staging scope: actual persisted UTC boundary, only
existing organization ee116a32-05e8-401f-a90f-b54b31b3b7e9 carried forward,
13 exact historical exclusions, linked current trial campaign with unchanged
12/0/deadline/manual recipients, automatic future eligible OWNER/confirmed
billing recipient selection and future due subscription delivery without per-address
approval. Operators remain empty; PUBLIC_AVAILABILITY remains excluded.
No extra live activation, identity, period, date change, commercial write,
production change, commit or push is permitted by this enable/idle procedure.

Complete VPS TERMINAL block:
/private/tmp/VPS-TERMINAL-ENROLLMENT-ENABLE-ACCEPTANCE-20261008.sh.
Input hashes are in enable-operator-handoff.json. The block contains its pinned
Python/SQL/projection inputs, validates the retained deployment package manifest,
839 canonical artifact hashes, dependencies/runtime metadata, installed
worker/launcher, acceptance DB/endpoints and 33-migration history. It checks
actual organizations, trial/paid terms, current verified recipients, approvals,
counters and historical outbox/attempts against the accepted inventory.

The timer is stopped and its active service is allowed to drain. No in-flight
worker/SMTP operation is killed. After rechecking business state, a root-owned
attempt marker is persisted before executing the reviewed transaction once.
It records actual enabledAt, enrollment provenance, links the old campaign
without changing its budget/expiry/recipients, and inserts the three exact audit
events. The original reviewed SQL business body is unchanged; only its authorization
comment now records approval. No bare SQL copy/paste execution is proposed.

The existing enabled timer is started and the procedure waits for two ordinary
completed service invocations with distinct InvocationIDs and start timestamps
newer than the pre-enable service invocation. It never manually starts the
service or worker. It checks the allowlisted worker JSON from each invocation's
journal and verifies unchanged approved business state, campaign count 3,
current trial cap 12/0, outbox and attempt deltas 0, one durable enrollment,
original boundary/exclusions, successful reconciliation and three audit rows.
Progress is emitted each minute. Expected duration about ten minutes; bounded
wait 720 seconds. Successful acceptance leaves policy and existing timer enabled.
Full reports remain in /var/lib/passvero-future-enrollment-20261008/state.

Material scope/recipient/period/outbox/counter differences are reported explicitly.
Failure stops future timer cycles and attempts to disable only the new enrollment
policy with an append-only suspension audit, retaining its original boundary,
enrollment, budgets and history. Timer-stop/suspension failure is reported as
NOT_PROVEN requiring operator reconciliation. A completed or uncertain enable
attempt is never automatically retried. No delivery retry is performed, and
DELIVERY_UNKNOWN cannot be converted into a safe retry or presumed zero delivery.

Four pure local operator tests passed: unchanged business scope after linking,
recipient/budget/outbox/attempt drift rejection with differences, unknown delivery
rejection, and two distinct completed new invocation requirements. Python/bootstrap
AST and bash syntax/input pins passed. These do not execute SQL, systemd or SMTP.
Existing accepted application/worker/build/PostgreSQL proofs are retained.
Live future controlled activation remains NOT_EXECUTED; the upcoming live proof
is exclusively the approved existing enrollment plus ordinary worker idle cycles.

Disable/rollback contract after enable: stop the dedicated timer, let active
service drain and reconcile any SENDING/UNKNOWN result. Suspend policy in an
operator transaction with audit, retaining enabledAt/excluded IDs and enrollment
provenance. Before reverting to the prior worker, disable automatic managed
campaigns and preserve all campaign/attempt/outbox/audit history; the prior worker
does not know the new policy gate. The pinned deployment rollback procedure then
checks artifacts/current deployment, restores exact prior application/messages/
worker/launcher/canonical manifest and retains the additive database schema.
Any restoration of the separately approved legacy timer scope must preserve its
existing approval, recipients, cap and counters. Neither disable nor rollback
is executed by this handoff or automatically after successful acceptance.

Enable and both live cycles remain PENDING_OPERATOR_COMMAND, awaiting actual
operator output. Do not label local future-activation proof as live activation,
or successful deployment as enrollment/idle acceptance.


## Final live acceptance evidence — 2026-10-08

Operator output confirms enable PASS at 2026-10-08T15:22:24.818Z and final
acceptance PASS. Approval reference USER_APPROVED_FUTURE_REMINDER_ENROLLMENT_20261008.
Three append-only audit records at transaction timestamp 2026-10-08T15:22:24.805Z:

| Action | Audit ID |
| --- | --- |
| REMINDER_ENROLLMENT_POLICY_ENABLED | 7b229d28-ad8b-47a5-986b-6565191125ba |
| REMINDER_LEGACY_CAMPAIGN_LINKED | 14a95c7c-8189-4377-b24a-a50bf3a3863f |
| REMINDER_ORGANIZATION_ENROLLED | e83ac957-9680-416a-bacb-a11723978986 |

Audit createdAt reflects the transaction start; enabledAt records the later actual
clock instant inside that transaction. Both are UTC and retained independently.

| Ordinary cycle | InvocationID | Enrollment lastCheckedAt (UTC) | Worker | New outbox / SMTP attempts |
| --- | --- | --- | --- | --- |
| 1 | 54afe5dbd05c4f6c8c482a803ba11971 | 2026-10-08T15:23:02.823Z | COMPLETED | 0 / 0 |
| 2 | 08e6fc776c2c432fab6808b530aa394a | 2026-10-08T15:28:05.377Z | COMPLETED | 0 / 0 |

These are distinct ordinary systemd timer invocations, not manually executed
worker calls. Reconciliation advanced on both cycles. One durable enrollment,
three total campaigns, no duplicate current-trial campaign, unchanged Milank 12/0,
zero outbox/attempt delta, original boundary and exact 13 historical exclusions.
The exact active current recipient is milanko.zivic@optinet.hr; operators empty.
The two historical campaigns remain disabled. No inbox receipt is claimed.
PolicyEnabled, timerEnabled and timerActive are all true in the accepted output.

Automatic future enrollment starts only with the matching successful controlled
activation/trial and organization created at/after the recorded boundary; replay
or rollback cannot duplicate enrollment. The normal worker recovers campaign
creation for durable enrollments, selects the authoritative period, keeps budgets
within a period and cancels stale unsent work on confirmed renewal/replacement.
The existing verified-recipient and DELIVERY_UNKNOWN rules remain in force.
Local evidence separately proves new controlled activation and commercial period
transitions; this live acceptance contains no new controlled activation or paid
period. The bounded requested staging outcome is complete.

Disable/rollback remains an operator-only action, not executed during acceptance:
stop the dedicated timer and drain the service, reconcile in-flight/UNKNOWN
attempts, audit policy suspension while retaining enabledAt and exclusion IDs,
and disable managed campaign sending before restoring the older worker. Restore
only pinned previous artifacts/canonical manifest through the existing guarded
rollback procedure; retain additive schema, enrollment provenance, campaigns,
budgets, attempts/outbox and all audit/migration history. Do not rerun the initial
enable block or reset its boundary; any later resume uses the preserved boundary
and a reviewed state/audited decision. See the detailed contract above and the
retained full VPS-TERMINAL-ENROLLMENT-ROLLBACK-20261008.sh procedure. A rollback
requires an explicit operator action and is not automatically run after success.

No repeated build/tests/deploy/worker/rollback actions were needed for finalizing
this returned evidence. Only documentation/evidence/source-manifest and whitespace
consistency checks were performed. No production change, commercial write,
commit or push; no additional acceptance action is pending for this approved scope.


## Final VCS release review — 2026-10-08

User separately authorized final review, commit and non-force push to origin/main.
Repository /Users/darkozivic/Desktop/Programiranje/passvero, branch main, base HEAD
6b418e50a2081755dc8f588839e595ac7f9140f4; origin
https://github.com/darkohedgehog/passvero.git. Index initially empty, exact pending
manifest set 38 files (37 hashed entries plus this source-manifest.json itself),
no unrelated worktree files. Fresh remote main matched the base before release.
The complete reviewed path set and its source classifications are recorded in
source-manifest.json, excluding only that manifest's own hash to avoid recursion.

Runtime source remains unchanged from the accepted evidence: 24 worker inputs,
worker bundle, packaged migration/schema, operator input pins and the 839-file
application artifact map/build mMVPOjFPkw5L42RIqziS4 were checked locally against
the retained accepted pins. The application source hashes match the accepted
source manifest. No fresh staging access, tests/build/deploy or acceptance runs.
Final release-only edits are documentation clarification and manifest review
metadata, separate from executable source and frozen deployed operator inputs.

Review retained authoritative transactional activation, durable/idempotent
provenance, original enable boundary and 13 historical exclusions, verified
OWNER/confirmed matching billing recipients, dedup/max32/revalidation, per-period
384 attempt default/3 per message and seven-day deadline without upgrade/recipient
budget reset, stale unsent-message cancellation on confirmed new periods, UNKNOWN
fencing, and Milank's legacy 12/0/current expiry/manual recipient scope. No unresolved
IMPORTANT/CRITICAL finding was identified in this final bounded review.
Local future controlled activation proof and the live existing enrollment/two
idle cycles remain separate; no new inbox or live controlled activation PASS.

Release content review found no actual credentials/tokens, activation links,
raw inventories/logs, binary/build/deployment archives or temporary artifacts.
Only the necessary approved recipient and exclusion/audit/campaign identifiers
are retained. The credential-URL scan match is an explicit synthetic-secret test
fixture, not a live secret; historical addresses elsewhere in the contract remain
pre-existing content. Private raw inventories, packages and logs stay outside Git.

The implementation snapshot's commitCreated/pushPerformed=false fields describe
its pre-release state, not the outcome of this separately authorized VCS step.
Commit SHA, remote equality and final clean index/worktree are reported after the
commit/push rather than embedded recursively in the committed manifest. The raw
rollbackCommand in the faithfully retained operator deployment report is not a
standalone executable instruction: use the full guarded VPS rollback wrapper,
which supplies the verified package import path and performs the recorded gates.
