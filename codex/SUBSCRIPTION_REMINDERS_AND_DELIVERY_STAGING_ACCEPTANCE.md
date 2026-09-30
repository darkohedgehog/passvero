# Subscription reminders and delivery — source/local and staging acceptance

Task: SUBSCRIPTION_REMINDERS_AND_DELIVERY_STAGING_ACCEPTANCE. Base HEAD and local
origin/main: `1fc84aa8ccc3118f8158029e8edf99275c8f7f6e`; initial worktree/index clean.
The five approved staging demonstration steps are complete, with the evidence limits below.

## Final boundary — 2026-10-01

Approved migration/deployment PASS from operator output; staging build
`8QNIYVVZWEsQaCL9uLZ5Q`. The user approved the exact three synthetic organizations,
OWNER prodaja@zivic-elektro.com, sole billing operator zivic.darko79@gmail.com, two
campaigns and maximum four SMTP dispatches, plus both documented business rules.

All five staging demonstration steps are supported by retained evidence:
1. Two trial reminders accepted by SMTP; user confirms two total messages per approved
   address across the trial/public kinds. Four provider accepts and four user-confirmed
   receipts are separate evidence. Inbox/spam folder was not specified.
2. Repeated trial worker added zero dispatches or attempts.
3. Approved simulated renewal cancelled two stale messages before transport.
4. Dedicated VOLUNTARY fixture passed live public HTTPS and sent two public-deadline reminders.
5. A separate real timer-triggered cycle completed successfully with campaigns disabled:
   worker IDLE/NO_APPROVED_CAMPAIGN, new service start632464053267 and invocation
   `8f41d476624547248dd60efc650cc285`. Entire campaign/outbox/attempt snapshot unchanged;
   additional SMTP dispatches0. This proves timer/launcher/worker execution, not a new
   scheduled email delivery or ongoing unattended scheduling.

Final scope: timer disabled/inactive, service inactive with success/exit0, enabled campaigns0,
both campaign budgets exhausted2/2. Four SENT rows, two CANCELLED rows, four ACCEPTED
attempts; all fixtures, commercial history, attempts and audit evidence retained.
Receipt confirmation is retained as user evidence; receiptConfirmedAt remains null in DB.
No further operator command or sending approval is needed for this demonstration.
Do not rerun historical acceptance blocks or reset budgets.

Evidence: `operator-acceptance-v3-stop.json`, `operator-timer-diagnosis.json`,
`operator-inbox-confirmation.json`, `operator-scheduler-acceptance.json` and
`local-verification.json` under `evidence/subscription-reminders/`.

Historical operator failures remain recorded: fixture child lacked the staging supplementary
group; installer umask reduced the code directory to0700; v3 stopped with ValueError at the
timer boundary after all four sends. The first two causes were reproduced and corrected.
The exact original ValueError input was not captured. A concrete parser defect was fixed:
nonzero systemctl USec values are formatted timespans, now observed live as
`1w 7h 41min 4.038970s`; the proof compares markers and independently verifies numeric
service start plus journal invocation. Earlier stop records are not rewritten as successes.
Nine operator regressions, six scheduler checks and the directory regression passed locally.
The latest turn changes evidence/documentation only; unchanged application/build proofs reused.

## Implementation

- Existing Zagreb calendar resolver now supports signed calendar-day shifts. Reminder
  thresholds are 30/7/1 local calendar days and exact UTC expiry. A delayed run chooses
  only the latest due threshold, never a backlog of 30/7/1 together. After expiry there
  is one logical expiry message per current deadline/recipient, with no automatic repeat.
- Existing entitlement coverage and publicAvailability remain authoritative. Confirmed
  continuous renewal suppresses obsolete lock warnings. A future gap is explicit; a
  pending smaller plan is conditional; a blocked activation cannot grant continued rights.
  Active staging exceptions do not masquerade as paid subscriptions. Last upgraded plan
  identity is retained after expiry (regression observed Start vs Business, then fixed
  in the shared coverage mapping without extending the period or granting expired rights).
- Public warnings count only ACTIVE products with a current PUBLISHED version, ACTIVE
  passport and VOLUNTARY classification. MANDATORY/UNRESOLVED are excluded. The public
  deadline is obtained from the existing gate; no separate six-month computation exists.
- Six email languages and operator UI languages: hr/sr/en/de/sl/pl. Recipient preference,
  then organization locale, then Croatian. HTML escapes organization data, displays the
  exact UTC instant and Zagreb-local date/time, and links to the existing protected flow.
- Recipients require current active OWNER membership and a unique, non-revoked verified
  Better Auth identity, or an explicit billing-email confirmation matching current
  profile revision/address. Operators additionally require current PlatformBillingGrant
  and explicit campaign operator-list membership. Read-only PlatformGrant gives no access.
  Normalized mailbox is deduplicated across roles; customer content takes precedence.
- Durable logical key: organization + authoritative deadline revision + kind + threshold
  + EMAIL + normalized mailbox. Database uniqueness spans worker runs and campaigns.
  No roles, provider errors, tokens or administrative recipient lists reach tenant UI.
- Five-minute database leases, SKIP LOCKED claims, fenced completion and bounded recovery.
  SENDING is committed before external I/O. Abandoned SENDING and uncertain outcomes
  become DELIVERY_UNKNOWN. Recovery also works after a campaign expires or is disabled.
  A new explicit campaign can adopt matching stranded PENDING rows without changing their
  identity or attempt history; SENT and DELIVERY_UNKNOWN never auto-resend.
- Immediately before dispatch the worker rereads authoritative coverage, deadline,
  threshold, publication eligibility, recipient identity/grant/profile and campaign scope.
  There remains an unavoidable external-I/O boundary after that final transaction;
  no claim of an atomic transaction spanning renewal and SMTP is made.
- SMTP: maximum three transport attempts, backoff 5 then 30 minutes only for proven
  connection-establishment failure or explicit transient SMTP rejection. Timeouts and
  ambiguous disconnects are UNKNOWN. Stable Message-ID aids investigation but is **not**
  provider idempotency. No SMTP exactly-once guarantee. [Nodemailer SMTP](https://nodemailer.com/smtp)
  and [result semantics](https://nodemailer.com/) were checked alongside installed code.
- Operator resolution records an evidence reference: confirmed provider acceptance,
  proven non-acceptance (terminal FAILED, no resend), or confirmed inbox receipt after
  SENT. Each action and protected overview read is audited. Provider acceptance and
  inbox receipt are separate timestamps. No blind manual retry action is exposed.
- `/platform/billing/deliveries` requires fresh existing billing authorization, is
  dynamic/no-store and shows last successful cycles, status counts, latest 100 deliveries,
  normalized reasons, attempt count and next permitted retry. The same canonical HTTP
  boundary protects the two explicit operations. No customer cross-organization view.

## Staging bounds and scheduling

`ReminderCampaign` is explicit, expires and defaults disabled. It allowlists at most
25 organizations, 32 normalized recipient addresses, 16 operator addresses and message
kinds. The global dispatch counter is incremented transactionally and cannot exceed its
approved maximum (schema cap 100; approved staging proposal is four total across two campaigns).
The runtime DB role cannot create, enable or expand campaign approvals. Every manual and
scheduled call uses the same gate and budget. Worker entrypoint rejects non-staging runtime
or a canonical origin other than `https://staging.passvero.eu`.

Prepared systemd oneshot/timer follows the existing VPS scheduling family: five minutes
after boot and five minutes after the previous invocation finishes (15-second accuracy),
without overlapping the same service. Each invocation selects one campaign fairly,
enqueues at most its bounded organization/recipient set and dispatches at most ten messages;
the send loop has a two-minute admission budget, per-call hard uncertainty cutoff 45 seconds,
and the launcher/service have outer 185/210-second bounds. With several active campaigns,
each is visited round-robin; this is not a five-minute-per-campaign SLA. No server-clock
changes. Enforcement remains independent of the scheduler.

Launcher obtains only required existing staging runtime variables in memory from the
verified application PID, drops to the existing runtime UID and never prints values.
No environment file is created or changed. Preflight dependency hashes match the local
runtime libraries; the package pins the historical metadata and verifies newer build-bundled
libraries need no external runtime dependency. Manual delivery and one real timer-triggered
IDLE cycle are proven by operator output. The timer is disabled/inactive after acceptance.

## Verification ledger

- 18 focused application tests: reminder calendar/content/transport, calendar regressions,
  billing/commercial HTTP boundary and platform authorization — PASS.
- 5 existing entitlement decision tests after shared coverage correction — PASS.
- 10 subscription foundation/schema tests — PASS. One stale full-model inventory was
  updated for the four already-accepted entitlement models and four new additive models;
  old migrations and Subscription fields/enums remain unchanged.
- 14 reminder disposable PostgreSQL tests — PASS; all 31 migrations applied to a new
  temporary cluster and the cluster stopped. Coverage: real unique constraints, competing
  workers, verified recipient dedup, revocation/profile change, renewal, public classification,
  backoff/limits, crash recovery, expired approval, approval rollover, narrow runtime ACL,
  SMTP accepted/DB-finalization failed, upgrade expiry and blocked future activation.
- TypeScript, lint, build and artifact hashes: exact final values in
  [local-verification.json](evidence/subscription-reminders/local-verification.json).
  Full lint has 0 errors and 16 pre-existing unused-variable warnings in unrelated evidence
  and historical harness files. New scoped source lint has no warnings.
- Independent review found two issues (expired-approval recovery and stranded pending
  messages); both corrected and covered. Bounded re-review found no remaining blocker.
- Live SMTP acceptance4, user-confirmed receipts4, renewal cancellation2, replay0 and
  one actual timer-triggered IDLE cycle — PASS from returned evidence.
- Live delivery UI review on 2026-10-01 — PASS in the existing authorized Chrome session:
  desktop and responsive widths 320, 375, 390, 768, 1024 and 1440 CSS pixels. Navigation,
  mobile menu, status readability, wrapped dates/addresses and visible form layout passed.
  Six expected deliveries belong only to the three approved synthetic organizations.
  The billing-operator overview is intentionally global; the tenant billing page showed
  only the current organization. No forms were submitted or delivery actions invoked.
  Fresh unauthorized-identity challenges were not run; existing authorization tests and
  source review remain the separate negative-access evidence. Physical devices, Safari,
  full keyboard/screen-reader and six-language live sweeps are outside this bounded review.
  See [browser-ui-review.json](evidence/subscription-reminders/browser-ui-review.json).
- Final independent source review found no unresolved IMPORTANT/CRITICAL findings.
  No UI correction was needed. Live provider faults were intentionally not simulated;
  fault/recovery/concurrency evidence is local/disposable.

## Acceptance status

| Required label | Source/local | Staging |
| --- | --- | --- |
| SUBSCRIPTION_REMINDER_SCHEDULE | PASS; all thresholds/boundaries | PASS; approved one-day trial example |
| PUBLIC_AVAILABILITY_REMINDERS | PASS | PASS; VOLUNTARY HTTPS and two reminders |
| RECIPIENT_AUTHORIZATION_AND_DEDUPLICATION | PASS; grant/revocation/dedup | PASS; exact approved OWNER/operator recipients; other cases local |
| OUTBOX_CONCURRENCY_AND_REPLAY | PASS | Replay PASS; live concurrency NOT_PROVEN |
| RENEWAL_STALE_MESSAGE_INVALIDATION | PASS | PASS; two cancelled before SMTP |
| DELIVERY_UNKNOWN_HANDLING | PASS; retry/crash/uncertain transport | Live faults intentionally NOT_PROVEN |
| OPERATOR_DELIVERY_VISIBILITY | Source/auth/audit PASS | PASS; authorized desktop/mobile review, expected fixture records only |
| STAGING_EMAIL_RECEIPT | Local mock transport only | PASS; four provider accepts and user confirms two per address |
| SCHEDULED_WORKER_ACCEPTANCE | PASS; isolated operator regressions | PASS; one timer-triggered IDLE cycle, zero extra sends |

Retained staging organization IDs (creation confirmed by v2 operator output):
`8c789610-9953-58c8-9cd7-1b5815dd6fd4`, `371ef379-7e1f-5775-842f-9eba78838046`,
`8504ae2e-059e-5b7d-974d-175e3d3c39c1`. Other generated IDs are retained in operator-worker-diagnosis.json. Actual staging scheduler
state: disabled/inactive after successful real timer proof. Both approved campaigns remain disabled; the allowlist
is restricted to the two approved addresses. Four live SMTP dispatches and user-confirmed receipts are recorded. Existing prior NOT_PROVEN scopes (including new live
image/PDF grace transport, backup/restore and full file recovery) remain unchanged.

## Handoff and rollback

The approved staging demonstration is complete across the retained v3 delivery evidence,
user receipt confirmation and separate scheduler-only evidence. No operator command is
pending. The [runbook](../docs/superpowers/runbooks/subscription-reminders-staging.md)
retains historical commands for audit; they must not be repeated.

The user authorized the exact reviewed commit, titled
`feat(subscriptions): add reminders and delivery tracking`, after UI review and final
manifest/index checks. `SOURCE_SHA256SUMS` covers every file in this change except itself;
the commit identity is reported from Git after creation, avoiding a self-referential hash.
Prior unrelated NOT_PROVEN scopes remain separate. No production, real payment, data
deletion or backup/restore. No email acceptance series was repeated during final review.

Rollback: disable the reminder timer and explicit campaigns first; wait for active leases
or retain ambiguous attempts as UNKNOWN. Restore the recorded previous application and
worker artifacts via a scoped operator package, retaining additive schema, attempts, audits,
commercial history and fixtures. Never delete sent history, reset budgets, replay UNKNOWN
or roll back commercial data. The pinned rollback guards current deployment identity, verifies prior/new artifact hashes and
handles partial installation or absent timer units. Six isolated filesystem/mock scenarios pass;
independent re-review found no remaining blocker. Live rollback has not been executed.

PRODUCTION_CHANGES=NONE; AUTOMATIC_DATA_DELETION=NO; COMMIT_SCOPE=REVIEWED_MANIFEST; PUSH_CREATED=NO.
