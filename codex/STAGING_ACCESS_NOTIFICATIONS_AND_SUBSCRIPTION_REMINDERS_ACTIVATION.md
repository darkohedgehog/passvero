# Staging notifications and reminders activation — 2026-10-07

Status: FINALIZATION_PASS; NEW_REQUESTS_AND_EXACT_SUBSCRIPTION_CAMPAIGN_ENABLED.
Operator finalization and user inbox confirmation are accepted. Main was freshly confirmed at `862b6cbd34090ebbfb717d252af3303b99c10bc3`.
The prior UI staging build was `lE10F_R1mCOG9rWxeChAI`; the accepted guard build is
`qgd6USnbSbiUKZInR9gSC`.

Operator read-only snapshot: 2026-10-07 14:14:31.230563 UTC (16:14 Europe/Zagreb).
Admin notification settings disabled, timer disabled/inactive, worker service inactive.
Two historical campaigns remain disabled, expired and exhausted (2/2 each).
Subscription delivery evidence: four SENT / ACCEPTED attempts, two CANCELLED,
zero PENDING/FAILED/DELIVERY_UNKNOWN; receiptConfirmedAt is absent on all four SENT rows.
Admin evidence: one historical SENT attempt; the older approved request has no prepared notice.
Zero writes, zero new emails, no worker invocation, no production access.

Seven entitlement fixture organizations are identified by the accepted
`evidence/subscription-entitlements/staging-fixture-ids.json`, three reminder fixtures
by `evidence/subscription-reminders/operator-worker-diagnosis.json`, and the commercial
fixture by the accepted commercial acceptance record. They remain excluded; classification
is based on ID evidence, not names/domains. Passvero Acceptance is a retained test/catalog
tenant. The two manually onboarded tenants are staging user organizations; genuine customer
status is not inferred. Only the exact controlled onboarding tenant below is proposed.

Subscription scope proposal: organization `ee116a32-05e8-401f-a90f-b54b31b3b7e9`,
verified active OWNER mailbox `milanko.zivic@optinet.hr`, SUBSCRIPTION only, no operator
copy and no billing-profile recipient. No paid period exists in this snapshot.
Trial dates stay unchanged. First due threshold is 30 calendar days before expiry:
2027-03-06 17:27:58.877 Europe/Zagreb (16:27:58.877 UTC); subsequent 7/1/0-day thresholds
are March 29, April 4 and April 5 at 17:27:58.877 Europe/Zagreb. A confirmed renewal
suppresses stale reminders. Expiring campaign proposal: 2027-04-06 15:27:58.877 UTC,
maximum 12 attempts (four logical thresholds with existing at-most-three safe attempts).
No automatic approval refresh or budget extension. No subscription email is due during
initial acceptance; no date/period is changed to manufacture a message.

Historical backlog candidates outside this scope: expired trial, expired paid/grace,
expired reminder trial and blocked downgrade fixtures; the paid-grace-active fixture also
has a 30-day PUBLIC_AVAILABILITY decision. Pure local date/rule projection of the returned
snapshot found no additional due decision within its next-five-minute horizon. It did not
invoke runtime coverage, Prisma, worker or SMTP. All these organizations remain excluded.

Admin scope proposal: `contact@passvero.eu`; one new retained AccessRequest for that same
mailbox, synthetic label “Passvero — staging notification acceptance”, locale hr. No user,
organization, approval or activation is created by this request. The first 30-minute
acceptance window allows exactly one automatic notification attempt. Before enable,
a technical guard must bind the exact new acceptance request and atomic one-attempt budget:
the current global boolean alone cannot enforce this acceptance cap. Afterwards, new
requests only from the recorded UTC enable cutoff; no historical backfill or blind retry.
The guard's source/tests/deploy must be reviewed before any sending or enable command.

Existing schedule proposal: OnBootSec=5min, OnUnitInactiveSec=5min, AccuracySec=15s;
this is relative to service completion, not a fixed wall-clock cron. Display timezone:
Europe/Zagreb. Enable instant is recorded after explicit approval; if execution occurs
on a later date, record its actual date rather than backdating to October 7.

Initial additional-send ceiling: one admin attempt and zero subscription attempts.
Subscription SMTP/inbox acceptance remains deferred until a naturally due eligible message;
unchanged historical delivery/renewal/cancellation evidence is reused. Unknown delivery
is not retried automatically; provider acceptance and inbox receipt are separate.
Read-only overview: /platform/access-requests and /platform/billing/deliveries.
Disable/rollback handoff will be pinned to the reviewed guard/configuration before enable;
no privileged mutation command is issued in this preparation phase.

Detailed pending proposal and pure projection are retained outside the repository at
`/private/tmp/passvero-automation-activation-20261007/proposal.json` and `projection.json`.
No raw operator output, credentials, identity tokens or activation links are included.
No tests/build/deploy were repeated for unchanged source. No commit or push.

## Approved guard implementation — 2026-10-07

User approved the exact proposal and single acceptance request. The thirty-minute window
starts at actual activation, never build/deploy time. A root-owned non-writable directory
and policy.json are required for automatic dispatch. Missing, invalid or expired policy
fails closed; expiry never promotes ACCEPTANCE to NEW_REQUESTS. Production automatic
dispatch is not authorized by this staging policy. The approved request's normalized email
is unique, all four approved fields must match, createdAt must be at/after activatedAt,
and the existing locked outbox row reserves attempt 1 atomically. Automatic retry is
forbidden. Explicit privileged reconciliation/retry remains separate and bounded.
NEW_REQUESTS mode can be installed only after accepted delivery, user's inbox confirmation
and the separate operator transition, preserving the original activation cutoff.
No schema/migration/role/ACL/trial/commercial changes. Application cannot modify the
root-owned policy or database enable settings. Reminder implementation remains unchanged.

Local proof: policy tests 3/3; PostgreSQL onboarding/guard tests 9/9 in a fresh disposable
local cluster, including concurrent submission/delivery, unrelated/historical fences and
minimal authority ACLs. Lint, TypeScript, webpack build and whitespace PASS. Initial build
found a test union narrowing error (corrected); a subsequent build required explicit
nonsecret staging canonical origin, supplied to the process without editing env files.
Final build: `qgd6USnbSbiUKZInR9gSC`, 839 artifacts. Deployment tool synthetic proof covers
HTTPS success, failure STOP and explicit application/translation rollback.

Deployment package is outside source control. Guard deployment does not create its policy,
enable settings or campaigns, invoke worker, submit a request or send email. Live recipient,
period/backlog and scope preflight precedes later enable. No claim of live guard acceptance,
inbox receipt or timer acceptance is made yet. After one admin message, wait for the user.
The subscription campaign never includes future organizations automatically.

## Accepted guard deploy and enable handoff

Operator returned GUARD deployment PASS: `qgd6USnbSbiUKZInR9gSC`, 839 verified artifacts,
HTTPS 200, target unchanged, zero database writes/emails, enableExecuted false. Rollback
is prepared, unexecuted. Executable source remains identical to this accepted deploy.

The separate private configuration package checks the full material recipient, organization,
period, old-campaign and delivery snapshot, accepted executable hashes, worker/timer hashes,
database scope, disabled scheduler and absent policy before changes. It enables only the
exact expiring SUBSCRIPTION campaign and root-owned ACCEPTANCE policy. The actual settings
activation timestamp defines the 30-minute window. Timer starts last; no manual worker,
request submission or transport call is performed by the configuration command. Other
campaigns stay disabled and history is retained. Failure after configuration disables the
affected settings/campaign/scheduler; no automatic retry. A material preflight difference
requires reconciliation before any send.

Synthetic operator proof PASS for success, material drift before mutation and timer failure
with sending disabled. This is local mocked subprocess proof, not a live SQL/configuration
acceptance result. Relevant SQL columns/defaults/constraints were reviewed against migrations.
No source rebuild or old acceptance suite was repeated. Live configuration output is pending.

A regular enabled-but-not-due reminder cycle may report COMPLETED; only unchanged dispatch
and delivery attempt counters demonstrate zero sends. The timer can start its first cycle
immediately on an already-booted server. Record that cycle and the next regular invocation
separately; do not invoke the worker manually. User inbox confirmation is required before
installing NEW_REQUESTS mode with the original cutoff. Expiry never broadens permission.

Disable: stop/disable `passvero-subscription-reminders.timer`, stop its service, set
OnboardingNotificationSettings id 1 enabled=false and the exact approved ReminderCampaign
enabled=false. Preserve policy/audit/delivery history. Disable precedes application rollback
once automation has been enabled. Prepared application rollback:
`sudo /usr/bin/python3 -I -B /var/lib/passvero-automation-activation-20261007/deploy_guard.py b338dc9fc06e515b92dbcdc11471e7f1fa70488036ca7976377051380a6ac13f rollback`.

## Live scoped configuration — operator PASS

Acceptance activation: 2026-10-07T15:04:06.958Z; expiry: 15:34:06.958Z
(17:04–17:34 Europe/Zagreb). Exact campaign enabled with budget 12, expires
2027-04-06T15:27:58.877Z; timer enabled/active. Configuration command created no request
and invoked no email transport. Its output is configuration evidence, not a delivery result.

Approved four-field payload was entered in the public /request-access form and one submit
button click performed. Browser did not display a success response; no second submit was
attempted. Persisted request/provider outcome must be reconciled read-only before retry
or further form action. Inbox receipt remains unconfirmed. NEW_REQUESTS mode is not installed.

Read-only operator reconciliation at 2026-10-07T15:07:46.166999Z found no new request
(requestCount 0), unchanged historical/business/recipient/delivery state, enabled exact
campaign with zero dispatches and successful first regular cycle at 15:04:08–15:04:09Z.
User reported no new inbox message. This was absence of a submitted request, not SMTP failure.
After this reconciliation, keyboard submission in the same public form displayed its
received-for-review confirmation. No email retry or direct transport call was performed.
The confirmed UI response still requires persisted-request/delivery reconciliation.

## Confirmed admin acceptance and regular reminder cycles

Read-only operator reconciliation at 2026-10-07T15:11:55.430728Z: exactly one request,
`7de5ccce-cbdf-448d-b6d4-c7a1d23a0664`, correct payload, PENDING; no organization/user/
activation, activation NOT_STARTED/0. Admin delivery SENT/1; started audit 1 (automatic),
accepted audit 1, rejected/unknown 0. User separately confirmed inbox receipt and this
exact request ID. Provider acceptance and user inbox evidence are both confirmed; this
does not set any unrelated reminder receiptConfirmedAt value.

First timer cycle succeeded at 15:04:09Z; next regular cycle succeeded at 15:09:11.582Z.
Campaign dispatches 0 and complete reminder/outbox/attempt snapshot unchanged; historical
campaigns and access requests, business/recipient state unchanged. The second cycle
precedes the actual admin send at 15:09:46.244Z. Final transition therefore additionally
requires a successful regular cycle AFTER that send, with the admin attempt still exactly
one and all subscription counters unchanged. No manual worker invocation.

The private finalization package freshly checks these conditions and records the user's
inbox confirmation as one configuration audit, archives the acceptance policy/evidence,
and atomically installs NEW_REQUESTS with the unchanged original activation timestamp.
It does not enqueue/backfill requests, call transport/worker, alter trial/paid data or
change campaign budget/expiry/schedule. Duplicate invocation stops before another audit.
If policy mutation fails after reservation, admin settings are disabled and reconciliation
is required; no automatic retry. Local mocked proof PASS: successful transition, changed
recipient STOP, pre-email regular cycle STOP, runtime policy-read failure disables admin
notifications. These mocked results are local proof; the separately returned finalization PASS below is live operator evidence.

Delivery failures remain visible at /platform/access-requests (admin notification status)
and /platform/billing/deliveries (reminder statuses). SENT means provider acceptance, not
inbox delivery. DELIVERY_UNKNOWN requires explicit reconciliation; no blind retry.
Regular scheduling is relative 5 minutes after service completion with 15-second accuracy.
Only the approved SUBSCRIPTION campaign is included; future organizations and
PUBLIC_AVAILABILITY are excluded. Historical synthetic campaigns/history remain retained.
Natural subscription delivery acceptance is deferred to the first genuinely due threshold.

Emergency disable, only when stopping the approved sending is intended:

```bash
sudo /usr/bin/python3 -I -B /var/lib/passvero-automation-finalize-20261007/disable.py 37f4901bbc7a3fc3fba76f969c130a82817b82090659c1e9401bf86b8164b991
```

It disables/stops the timer/service and disables only admin settings id 1 plus campaign
a24b67dd-442c-4f06-b4f3-498554b4ff31; policy, audits and delivery history are preserved.
Application rollback after disable, only when rollback is intended:

```bash
sudo /usr/bin/python3 -I -B /var/lib/passvero-automation-activation-20261007/deploy_guard.py b338dc9fc06e515b92dbcdc11471e7f1fa70488036ca7976377051380a6ac13f rollback
```

Neither disable nor rollback has been executed. No commit/push or production access.

## Final operational state — operator FINALIZATION PASS

User returned finalization PASS and operator PASS. NEW_REQUESTS policy is installed and
readable by the runtime identity, retaining activatedAt 2026-10-07T15:04:06.958Z
(17:04:06.958 Europe/Zagreb). The temporary exact-payload/30-minute constraint was removed
only after successful acceptance and explicit inbox confirmation. No historical backfill
or new transport/worker invocation occurred during finalization. One configuration audit
was recorded; archived acceptance policy/evidence are retained in the private operator
package. Prior pending handoff sections above describe historical execution phases.

Admin acceptance: request 7de5ccce-cbdf-448d-b6d4-c7a1d23a0664 remains PENDING, no
organization/user/activation, exactly one automatic attempt, one provider accept, one
user-confirmed inbox receipt, no rejected/unknown result. Atomic reservation and no
automatic retry remain active for subsequent new requests.

The final operator preflight also confirmed a successful regular reminder cycle AFTER
the admin email, with its attempt still 1 and all subscription delivery/attempt counters
unchanged. Subscription acceptance attempts/dispatches: 0. Enabled campaign remains
a24b67dd-442c-4f06-b4f3-498554b4ff31, only organization
ee116a32-05e8-401f-a90f-b54b31b3b7e9 and its confirmed active OWNER, SUBSCRIPTION only,
no additional/operator recipient, maximum 12 total attempts including existing bounded
safe retries, expiry 2027-04-06T15:27:58.877Z (17:27:58.877 Europe/Zagreb).
Timer remains enabled/active on the accepted relative five-minute schedule. Natural
subscription delivery is not yet due; no new subscription SMTP/inbox delivery is claimed.
No future organizations are automatically included. All other campaigns/organizations,
PUBLIC_AVAILABILITY and historical admin notifications remain excluded.

Existing trial dates/quotas, identity/membership/business data and historical delivery
records are preserved. No approval, paid activation, payment, production change, commit
or push. Guard build remains qgd6USnbSbiUKZInR9gSC; application rollback and sending
disable are prepared, not executed. Source/test bytes match the accepted guard deployment;
only documentation was updated afterwards. Earlier focused tests/TypeScript/lint/build
evidence is reused. Final whitespace and eight-file SHA256 manifest PASS.

Final local artifacts: /private/tmp/passvero-automation-activation-20261007/
source-manifest.json and review.diff. Operator output is recorded privately in
operator-finalization.json; no raw personal logs, credentials or activation tokens are
added to source control.

## Separate final review / commit handoff — 2026-10-07

The user separately authorized review, commit and non-force push of the eight-file set.
Executable source/tests and local accepted-build artifact hashes matched the activation
manifest/diff at review; source is unchanged and earlier tests/build/live acceptance are
reused. Final documentation adds the mandatory next implementation
SUBSCRIPTION_REMINDERS_FUTURE_ORGANIZATION_ENROLLMENT to the existing roadmap. It does
not implement future enrollment or expand the active campaign. Activation-phase
"no commit/push" statements above describe that earlier scope; Git release evidence is
reported separately after the authorized commit/push. No new live actions are performed.
