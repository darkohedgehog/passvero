# Public pricing and marketing contract alignment — 2026-10-09

Current status (2026-10-12): COMPLETE — user-approved restored design deployed as
_tkSUOn0PCoHjpx8V7FVr with exact staging backup pin alignment and independent closure.
Read-only hero/laptop checks PASS in six locales desktop/mobile; earlier card replacement
remains rejected. [Restored-design deployment report](MARKETING_VISUAL_IDENTITY_STAGING_DEPLOY.md).
Legal draft remains internal/excluded; no commit/push or production change.
Earlier status sections below are preserved historical evidence.

Initial 2026-10-09 status: local implementation and verification PASS; staging deployment and read-only
acceptance DEFERRED_BACKUP_ACCEPTANCE_COORDINATION; operator read-only preflight PASS.
The deploy is deferred by confirmed coordination, not failed. This is not staging acceptance evidence.
Base: `main`, `1ba7b34c78d56960014d18e5f4cfef637e057d26`. No commit, push, production,
migration, business write, form submission or email. Existing backup work is retained.

## Commercial presentation

The authoritative commercial contract §§1, 3–4 and the unchanged
`src/application/subscriptions/catalog.ts` agree. Pricing reuses `STANDARD_PLANS`,
not a second price catalogue. All prices are totals in EUR excluding VAT.

| Plan | Occupied published products | 3 calendar months | 12 calendar months |
| --- | ---: | ---: | ---: |
| Start | 25 | 147 EUR | 490 EUR |
| Business | 100 | 297 EUR | 990 EUR |
| Pro | 500 | 597 EUR | 1990 EUR |
| Custom | Explicit offer | Explicit offer | Explicit offer |

Both periods are directly comparable; no derived monthly price, invented popularity,
discount, purchase button or package selection. Stored-product, storage and PDF limits
also come from the same catalogue. Six locales use `Intl.NumberFormat` for EUR.

Trial: one per organization, 6 months from successful controlled activation, up to
3 lifetime-created products including imports and 3 occupied published slots.
This is not a limit of 3 publication operations; revisions of a published product
occupy the same slot. Archiving does not restore a slot. Published, draft and retained
product/file metrics are explained separately. The source is the confirmed contract
and `src/application/subscriptions/entitlements.ts` (`TRIAL_LIMITS`, `trialWindow`,
`quotaDenials`, `publicAvailability`); business rules are unchanged.

Access requests do not activate accounts or buy/select plans. B2B bank transfer is
against an offer; an authorized operator activates paid rights after payment review.
Content changes and new publication lock at expiry. A native keyboard-accessible
explanation linked from pricing describes paid VOLUNTARY public grace of 6 months,
no trial grace, separate MANDATORY/UNRESOLVED long-term policy, and private retention
of 12 paid / 3 trial months. It promises neither lifetime access nor automatic deletion.
It does not promise public-availability reminders, whose enablement remains separate.

## Claims changed, in all six locales

| Before | Current claim and evidence |
| --- | --- |
| Verified/trusted/authentic passports or data | Structured data deliberately published by the organization. No independent truthfulness/authenticity claim. |
| GS1/EPCIS/API interoperability | GTIN format/check-digit validation and barcode display. `src/application/products/gtin/validation.ts`; registry/ownership/certification are excluded. No current EPCIS/API integration claim. |
| Built for compliance; avoid fines | Organize product information and supporting documents. PDF structure/malware checks do not prove authenticity, truthfulness or regulatory compliance (`src/application/documents/scan-document.ts`, `malware-scan.ts`). |
| Real-time events, scan analytics, performance insights | Catalogue search, drafts/published versions, versioned images/PDF, CSV import/export. ScanEvent/IntegrationMapping schema alone is not an available integration/analytics feature; no corresponding implementation was found in `src`/`app`. |
| Automated collection and verification | Manual structured entry and existing CSV catalogue import, without claiming automated verification. |
| Broad security/scalability guarantees | Organization permissions, private workspace separated from public publication, immutable published content while editing a draft. No uptime or universal security guarantee. |
| Setup in minutes | Controlled access and activation after approval; no elapsed-time promise. |
| Hero verified label/scan-to-verify; dashboard invented scans/100% complete | Localized illustrative HTML examples inside existing frames, using existing icons/colors/spacing. No synthetic customer totals, scan count or certification status. Old PNG files remain untouched and unused by these components. |

Metadata, landing page and shared sections were reviewed; About/Contact already use
bounded business copy. Their early-access CTA now uses the existing localized
`/request-access`, as do pricing and dashboard-preview CTA. Direct general-contact
email remains unchanged. Request-access form/backend and all private/business/legal
translation namespaces are unchanged. No new dependency or client component.

## Verification and evidence

Preserved reviewed package/evidence:
`codex/evidence/public-pricing/reviewed-package-20261009/`.
Original working evidence remains in `/private/tmp/passvero-public-pricing-20261009/`.
The archive, source/artifact manifests and existing proof files were copied byte for
byte, not rebuilt or retested; `preservation-manifest.json` records their hashes.

- `npm run build -- --webpack`, with process-only `BETTER_AUTH_URL=https://staging.passvero.eu`: PASS.
  Initial origin-less attempt failed `ORIGIN_MISSING`; no environment file was edited.
- `npx tsc --noEmit` after the build: PASS.
- `npm run lint`: PASS, 0 errors / 16 pre-existing warnings outside changed files.
  ESLint on all six changed TSX files: PASS, no warnings.
- `node --test tests/marketing-accessibility.test.mjs`: 2/2 PASS.
- `copy-check.py`: matching marketing keys across HR/SR/EN/DE/SL/PL, unchanged unrelated
  and legal namespaces, and unchanged protected backup file hashes: PASS.
- Installed Playwright + system Chrome (Browser plugin unavailable): six localized
  landing pages, 4 plans, 6 exact formatted prices per locale, localized pricing CTA,
  request-access destination, About/Contact CTA, focus and Enter interaction on native
  details/CTA, VOLUNTARY/MANDATORY/UNRESOLVED explanation: PASS.
- Widths 320, 375, 768, 1024, 1440 in each locale: no horizontal overflow or clipped
  pricing CTA. 24 screenshots; `visual-results.json`. No console/page errors.
- Targeted hero follow-up corrects a German 320px word wrap and desktop feature/CTA
  overlap; `hero-results.json`. Pricing proof is reused because pricing source did
  not change in that follow-up. Full-page screenshots are refreshed.
- Browser requests are restricted to GET/HEAD. No submitted AccessRequest, email,
  subscription/payment action, auth mutation or commercial/antivirus/backup replay.
- Whitespace: `git diff --check` PASS. No files staged.

These are desktop Chrome and responsive emulation, not physical-device or Safari proof.
Local evidence is not a new live staging visual acceptance.

## Staging boundary and rollback preparation

Fresh unprivileged SSH confirmed host `srv1834647`, user `darko`, and
`passvero-staging-backup.service` inactive. Initial BUILD_ID read was denied; the subsequent operator preflight below confirms
the privileged release identity. Listed historical failed restore units are not active
restore evidence and were not rerun. No sudo command was executed by the agent.

The current backup installation proof records a two-attempt acceptance on
10/11 October at 04:30 UTC / 06:30 Europe/Zagreb. Results reading is scheduled after
11 October 05:10 UTC / 07:10 Europe/Zagreb. `recurring.py:runtime` verifies the exact
canonical manifest SHA256 and BUILD_ID against installed config before capture.
The recorded backup build is `mMVPOjFPkw5L42RIqziS4`, canonical pin
`f7039de22d508baac9d70cda13eed9a98b550af93f8b0f92fadbea9fa8106c40`.
Operator output at 2026-10-09 15:21:42 UTC confirms both current pins exactly match
these values and both exact-build/canonical checks are installed. Backup attempts
and completed captures are 0, hold is false, active recovery units/processes are empty.
This proves current release coupling and absence of observed active recovery at that
instant; it is not backup capture/restore acceptance. Evidence:
`codex/evidence/public-pricing/operator-preflight-20261009.json`.

Deploying a new build without reconciling that release baseline could make capture
fail `CANONICAL_RELEASE_CHANGED` / `BUILD_CHANGED` even outside the capture window.
The task explicitly forbids backup configuration changes. Do not bypass this guard,
relabel a new build with an old BUILD_ID, modify pins, stop backup, or silently consume
the two capture attempts. One read-only privileged preflight is prepared in
`vps-preflight.sh`; the equivalent hashed `vps-preflight.py` was uploaded to
`/tmp/passvero-public-pricing-preflight-20261009.py` on the staging host. The complete
operator block is `vps-operator-block.sh`. Only this read-only helper was uploaded,
not the application archive. Operator output was received and accepted. The user
confirmed the deferred sequence below; no repeated preflight is requested now.

### Confirmed coordination sequence — 2026-10-09

1. Preserve the scheduled capture attempts on 10 and 11 October 2026 at 04:30 UTC /
   06:30 Europe/Zagreb. No marketing deploy, release-pin or backup-config change.
2. After 11 October 2026 05:10 UTC / 07:10 Europe/Zagreb, first review capture
   results and complete the already approved B–D backup acceptance checks.
3. Only after backup acceptance is closed, prepare one combined minimal proposal
   for exact release-pin alignment and marketing deploy with rollback. Wait for
   separate approval before executing any pin/configuration change or deployment.
4. Preserve exact-artifact verification. No wildcards, disabling checks or bypassing
   pin protection. Do not rebuild or repeat tests of the unchanged reviewed package.

This sequence is explicitly confirmed by the user. No marketing deployment/restart
has occurred; its status is deferred for backup-acceptance coordination, not failed.

`application.tar.gz` and `artifact-manifest.json` contain the local staging-target
build/messages only: build `853RYrj-r5cyoSGuJudap`, 754 pinned files, archive
SHA256 `8c3e74a998966976aa92777a37fb1b040b2d02dea1ac49c4a1f148744e062a1e`. Rollback design is to verify and retain exact previous `.next`
and `messages`, retain previous canonical manifest, stop/restart only
`passvero-acceptance`, restore those artifacts on an explicitly invoked rollback,
then verify prior hashes/BUILD_ID/HTTPS. No database or Storage rollback. An executable
rollback command awaits the chosen deployment/release-baseline scope and exact prior
artifact inventory at that time; rollback is NOT_EXECUTED. The received operator
preflight confirms current identity but does not authorize backup-pin changes. Never deploy/rollback during active capture or
restore; wait for completion without stopping backup.

## Legal follow-up (texts unchanged)

`Legal.Privacy.sections.scope` in all six locales still describes a public site
without user accounts/contact form, while controlled access/auth/billing/documents/
audit/reminders now exist. Privacy/data-provider/retention wording requires its
separate legal review. Terms need review against individual accepted B2B offers,
activation/expiry/retention and the separate mandatory/unresolved DPP policy.
Cookies statements must be reviewed against actual deployed storage/tracking use;
this task makes no legal conclusion or cookie-policy change.

## Manifest ownership

`source-manifest.json` and `source-review.diff`: 12 executable source/translation
files only. Unchanged catalogue and contract are recorded as reference inputs.
`documentation-manifest.json`: this report and the marketing-only roadmap delta;
`roadmap-task-only.diff` applies against the saved pre-marketing roadmap, preserving
all existing backup content/status. Whole-roadmap git diff includes earlier backup
work and must never be treated as this task's release manifest.
Artifacts/screenshots/logs are separate from source and final documentation.


## MARKETING_STAGING_DEPLOY_AND_EXACT_BACKUP_PIN_ALIGNMENT_RESUME — 2026-10-12

Status: **PENDING_OPERATOR_COMMAND — fresh read-only exact-pin planning**.
Backup A–D COMPLETE and commit `5dba99b474d5fabbabc75855f15c912bb9c4b8c6`
remain accepted. Main/HEAD confirmed, index empty; no commit/push in this task.
Current marketing source is byte-identical to the reviewed 12-file source manifest.
Archive SHA256 `8c3e74a998966976aa92777a37fb1b040b2d02dea1ac49c4a1f148744e062a1e`,
artifact-manifest SHA256 `8222518bd18a446278df3e375a2fdfe1af92c598cddecc46d072c6b745e13817`,
build `853RYrj-r5cyoSGuJudap`: all 754 archive members/hash/size checks PASS.
Package/lock/catalogue/entitlements/contract references match accepted inputs.
No rebuild or repetition of accepted local tests. All six Legal namespaces match
HEAD; internal legal/privacy draft and shared legal/readiness documentation are
outside the archive, whose only members are `.next/` and `messages/`.

### Concrete coordinated operator plan

1. Use the [single read-only preflight](evidence/public-pricing/pin-alignment-20261012/VPS-TERMINAL-PREFLIGHT.sh).
   Verify old runtime/canonical/config/source-dependency pins and every current
   canonical artifact, exact new archive members and unchanged **deployed** Legal
   namespaces. Require CONTINUOUS/hold=false/completed attempt, active/enabled
   backup/monitor timers, no active capture/restore/resume unit/process and an
   available existing job lock. Check staging process scope without SQL or
   invoking any backup/worker/SMTP/Telegram entrypoint. Return exact derived new
   canonical/config SHA256 and next schedule before preparing the mutation block.
2. Old build `mMVPOjFPkw5L42RIqziS4` → `853RYrj-r5cyoSGuJudap`.
   Existing canonical at
   `/var/lib/passvero-onboarding-deploy-2cb9d6e/application/manifest.json`:
   SHA256 `f7039de22d508baac9d70cda13eed9a98b550af93f8b0f92fadbea9fa8106c40`.
   Preserve all fields/files outside `.next/` and `messages/`; update `build_id`,
   replace those two file inventories from exact reviewed manifest and add its
   pinned provenance field `marketing_artifact_manifest_sha256`.
   New whole canonical SHA256 awaits operator-derived actual baseline.
3. At `/usr/local/libexec/passvero-staging-backup/config.json`, change **only**
   `buildId` and `canonicalSha256` to that exact release. Old whole config SHA256
   `399a693588167747cd565fdf179ecfc2dc5a6c6d756a7498bdf73f93fe959d62`;
   new whole config hash awaits the deterministic two-key candidate.
   Helper/verifier/reader/worker pins and all other config fields stay unchanged.
4. Mutation block will recheck those exact old/new hashes and idle state under
   exclusive existing job lock. Require sufficient distance from the next ordinary
   04:30UTC capture and bounded coordination timeout; STOP near a due term.
   Preserve timer active/enabled states and stop only the two staging backup/monitor
   timers during the transition, without disable/reconfiguration or worker stop.
   Recheck no capture/restore/monitor service started, then prepare private copies
   of prior artifact inventory, canonical/config bytes and timer baseline. Preserve
   exact old `.next`/`messages` by rename; no removal or pruning.
5. Stop only `passvero-acceptance`, swap exact prepared `.next`/`messages`, atomically
   install derived canonical then two-key backup config, restart the same existing
   PM2 process using reviewed daemon RPC. Verify full new/retained canonical files,
   build/config/helper pins, HTTPS certificate and 200 result. Static backup identity
   checks suffice; no backup main, capture, restore, retention, signal or sending.
6. Independent close/finally must restore prior timer active/enabled baseline after
   complete new alignment or complete rollback. If alignment/rollback cannot be
   proved, keep staging backup coordinated/paused and report exact normalized
   failure instead of allowing a capture with mismatched artifact/pins. No counter,
   hold, mode, history, production job, reminder, qpdf/updater/producer changes.
7. Rollback is paired: stop only staging web; retain failed new artifacts separately,
   restore exact saved old `.next`/`messages`, canonical and old config; restart web,
   verify old artifact/pin identity/HTTPS, then restore timer baseline. No DB/Storage
   rollback or file deletion. One explicit reviewed rollback command will be supplied
   with the deployment block. No automatic deploy retry or acceptance series.
8. After returned deployment proof, read-only live visual/CTA/pricing checks for
   six locales and desktop/mobile; no form submission, email, offer/payment or new
   test record. Update this report/roadmap/final resume manifest with actual results.

The user already authorizes this minimal coordinated staging execution. This first
handoff is needed to obtain exact candidate hashes from the installed canonical
structure and confirm current idle state, **not to request another approval**.
Only unprivileged transport of archive/manifest/read-only helper to
`/tmp/passvero-marketing-pin-alignment-20261012/` has been performed so far;
deployment/pin changes/coordination/rollback remain NOT_EXECUTED.
[Resume manifest](evidence/public-pricing/pin-alignment-20261012/resume-manifest.json)
distinguishes accepted package/local proof from pending operator/live results.


### Returned preflight STOP — dependency identity comparison

User output: `CHECK_ID=REVIEWED_PACKAGE`,
`RUNTIME_DEPENDENCY_IDENTITY_CHANGED`, automaticRetry=false.
The preflight stopped at package/lock hash comparison, before current-release
inventory/candidate derivation and before any deployment/pin/timer change.
[Exact normalized output](evidence/public-pricing/pin-alignment-20261012/operator-preflight-stop.json).
The initial preflight compared local build input whole-package hashes directly to
VPS runtime package/lock; that identity assumption requires reconciliation.
Accepted 08 October staging evidence already records runtime package SHA256
`df4c1ac1b1d409c5db06c9614fc2a2cf8c5fe4fb4c6daa13f1ed3b88088ddd6e`
and lock SHA256 `f82a6356bd1201994d00d2032eabc7da5334de234bf36998b00c277e61f29b3c`,
which differ from the local marketing manifest. Its twelve core package metadata
hashes match the current local installed inputs; this is historical context, not
fresh VPS proof or permission to bypass dependency verification.
One [bounded read-only diagnosis](evidence/public-pricing/pin-alignment-20261012/VPS-TERMINAL-DEPENDENCY-DIAGNOSIS.sh)
is PENDING_OPERATOR_COMMAND: actual package/lock fingerprints, changed package
field names, direct runtime dependency declarations, seventeen installed package
versions/metadata hashes, and normalized non-dev lock differences. No raw script,
environment, credentials or connection strings; no package install, build, deploy
retry, runtime/pin/automation mutation or backup acceptance replay. Return output
before deciding whether exact historical runtime evidence is sufficient or a
real dependency mismatch needs a narrowly scoped correction.


### Dependency reconciliation — exact staging baseline confirmed

[Returned diagnosis](evidence/public-pricing/pin-alignment-20261012/operator-dependency-diagnosis.json)
confirms package/lock match the accepted staging baseline, old build/canonical/config
unchanged and backup release pins matching. Only declared/lock runtime differences
are `bwip-js` and `csv-parse`; both absent as separate VPS node_modules packages.
All other fifteen direct runtime package metadata hashes match reviewed local inputs.
Inspection of the exact accepted 754-file archive finds barcode code bundled in
`.next/server/chunks/5484.js` and CSV parser code bundled in
`.next/server/app/api/products/import/route.js`. All artifact `.nft` inventories contain
no external bwip-js/csv-parse path; all JavaScript contains no external literal
require/import of either. Their external-import negative guard rejects injected
`require("bwip-js/node")` and `import('csv-parse/sync')`. Static checks only; no application
execution, build, package install, accepted test replay or changed runtime source.

[Minimal preflight delta](evidence/public-pricing/pin-alignment-20261012/preflight-v2-reviewed.diff)
replaces the invalid local whole-package identity assumption with the two exact
accepted VPS package/lock fingerprints plus fifteen exact installed metadata pins.
Adds exact archive bundled-code/no-external-import checks for those two packages;
any other dependency/artifact difference still STOP. No backup helper/verifier/
configuration/architecture change. Original failed preflight and diagnosis retained.

[Read-only preflight v2](evidence/public-pricing/pin-alignment-20261012/VPS-TERMINAL-PREFLIGHT-V2.sh)
is PENDING_OPERATOR_COMMAND to complete the previously unreached release inventory,
Legal namespace comparison, idle/runtime checks and exact canonical/config candidate
hash derivation. Deployment/pin/timer coordination and visual acceptance remain
NOT_EXECUTED; no deploy retry performed. User execution approval remains in force.


### Exact candidate accepted — one deploy/paired-close handoff

[User-returned preflight summary](evidence/public-pricing/pin-alignment-20261012/operator-release-preflight-pass.json),
12.10 16:02:02UTC: old build/canonical/config exact, 754 new files + 3 retained canonical
files, Legal namespaces UNCHANGED_FROM_DEPLOYED, CONTINUOUS/hold=false/attempts2,
backup/monitor active/enabled; reminder service observed activating (not an idle proof).
Exact new canonical SHA256 `b2a5866a532ecc9912fae5ebeb83086ff0a5f2d162b40a5c031723471ab898e9`;
exact new two-key config SHA256 `c93266b5d07a7afcfb97ab9ebbbac49dc342348ec61344dc1e9d53f1e8ea1f9a`.

[Complete one-shot deploy block](evidence/public-pricing/pin-alignment-20261012/VPS-TERMINAL-DEPLOY.sh)
seals exact uploaded inputs into root-private `/var/lib/passvero-marketing-pin-alignment-20261012`,
then one bounded systemd unit runs the [reviewed deploy helper](evidence/public-pricing/pin-alignment-20261012/deploy.py)
with independent ExecStopPost close on success/error/timeout/death. No automatic retry.
Reuses exact read-only v2 preflight; preserves old canonical/config and renamed old
`.next`/messages. Waits at most60s for natural writer completion, then requires idle;
never stops/starts writer service or timer. Under existing exclusive backup job lock,
require idle capture/restore/monitor and each next timer term >15min away; pause only
backup/monitor timers without changing enablement. Swap application, atomic canonical,
atomic two-key config, restart exact staging PM2 process via existing daemon RPC.
All757 new/retained artifact hashes, build/config identity, staging runtime and
HTTPS200/TLS verification must pass; backup state/history bytes unchanged.

Independent post accepts proved new alignment or automatically restores the saved
old artifacts/canonical/config as a pair before restoring both active/enabled timers.
If rollback/state integrity cannot be proved, timers stay coordinated/paused and a
normalized closure failure is returned for review. Random unique atomic candidate
names preserve interrupted-write artifacts without deleting or blocking rollback.
Artifacts remain retained. Body/closure failures are separately reported with CHECK_ID.
[Explicit paired rollback command](evidence/public-pricing/pin-alignment-20261012/VPS-TERMINAL-ROLLBACK.sh)
is retained, not executed; it applies the same due/lock checks and preserves failed
new artifacts separately. No DB/Storage rollback, package install, removal or prune.

Local verification of **new coordination helper only**: AST/shell syntax and four
synthetic closure checks PASS (new alignment, partial-swap rollback, rollback-failure
keeps timers paused, state-change keeps timers paused). No application/backup accepted
test repeat, build or live operation. Existing backup helpers/verifiers/policies/pins
and marketing build/source unchanged. Deployment is PENDING_OPERATOR_COMMAND;
return unit/body/closure results before six-locale live read-only visual acceptance.


### Protective near-term STOP — preparation retained, no coordination started

[Returned operator result](evidence/public-pricing/pin-alignment-20261012/operator-deploy-near-term-stop.json):
NEXT_REGULAR_TERM_TOO_CLOSE_STOP at PREPARE_AND_PRESERVE. body-pass absent, independent
closure NOT_STARTED/timerChanges NONE/rollback NOT_NEEDED; no closure failure.
At least one next timer term was <=15min away; output does not identify which timer.
Exact archive extraction and saved old/new canonical/config precede this guard;
no attempt reservation, timer stop, application swap or pin mutation was reached.
The original one-shot installation block must not be repeated (private root exists).

[One guarded prepared continuation](evidence/public-pricing/pin-alignment-20261012/VPS-TERMINAL-RESUME-PREPARED.sh)
is PENDING_OPERATOR_COMMAND. It installs only a separately reviewed/hash-pinned
continuation helper in the existing private root, requires the exact original STOP
and NOT_STARTED closure, no original attempt or resume marker, intact existing old
application/pins, and all754 prepared file hashes/sizes/ownership/modes plus saved
old/new pin input bytes. It reuses preparation without re-extraction or redownload.
The same >900s due guard, idle requirements, exact pin identity, exclusive job lock,
paired rollback and independent close remain. Only after guards succeed does it
reserve one durable continuation and original coordination attempt; no counters,
hold/mode/history reset. Original first-failure/closure files retained, continuation
body/closure failures and closure go to separate resume files.

Operator timing: execute once at :25–:55 of an ordinary hour, after the :20 monitor
has completed, outside the hour containing daily04:30UTC backup. These times avoid
the observed monitor-near-term conflict; live typed timer margins remain authoritative.
No forced/accelerated job or monitor execution. If STOP repeats, return exact output
for review; no automatic attempt or general acceptance series. Local changed-function
AST review (only deployment/close/main differ), shell/Python syntax, exact due
boundary rejection at900s/acceptance at901s and manifest/whitespace checks PASS.
Execution/visual acceptance still PENDING; backup A–D/legal/marketing source preserved.


### Second protective STOP — diagnose exact timer values before any continuation

[Returned prepared-continuation result](evidence/public-pricing/pin-alignment-20261012/operator-prepared-continuation-near-term-stop.json)
again records NEXT_REGULAR_TERM_TOO_CLOSE_STOP at PREPARE_AND_PRESERVE;
resume closure NOT_STARTED/timerChanges NONE, no closure failure, no body-pass.
Original first-failure and closure retained. Neither coordination nor prepared-resume
attempt reservation was reached; this is not a failed application swap or rollback.
No further deploy attempt is prepared/executed pending precise timer evidence.
Earlier :25–:55 timing guidance is insufficient to explain this returned result and
must not substitute for actual typed due/clock measurements.

One [read-only clock/timer diagnostic](evidence/public-pricing/pin-alignment-20261012/VPS-TERMINAL-TIMER-DIAGNOSIS.sh)
PENDING_OPERATOR_COMMAND: for each backup/monitor timer record VPS epoch/UTC, raw
typed D-Bus next/last realtime and monotonic microseconds, exact helper-derived due,
remaining seconds, unchanged900s guard decision, and systemctl calendar/state values.
Also confirm coordination markers and exact backup state/config/canonical hashes.
No sleep/retry, timer change, guard bypass, job start or application/backup operation.
Only syntax/manifest/whitespace reviewed locally; operator evidence pending.


### Exact timer review — existing-helper continuation pending

[User-returned diagnostic summary](evidence/public-pricing/pin-alignment-20261012/operator-timer-diagnosis-pass.json)
at 2026-10-12 16:21:29UTC / 18:21:29CEST shows both typed next-realtime
values agree with calendar terms: monitor17:20UTC, remaining3510.88s;
backup2026-10-13 04:30UTC, remaining43710.94s. Both unchanged900s guards pass.
No timer-reader defect is demonstrated; previous STOP outputs do not identify
the timer or clock at failure. Old canonical/config/backup-state hashes unchanged,
backup/monitor/reminder services idle, no coordination/prepared-resume reservation.
This evidence is point-in-time; future execution must recheck current terms.

[One existing-helper continuation](evidence/public-pricing/pin-alignment-20261012/VPS-TERMINAL-RESUME-AFTER-TIMER-REVIEW.sh)
is PENDING_OPERATOR_COMMAND. No helper/source/pin/guard change or reconstruction.
Before launch require both current margins >1200s, exact existing helper hash,
idle jobs, old pins, active/enabled timers and no coordination reservations.
Under the existing job lock, preserve exact prior resume STOP/NOT_STARTED closure
by renaming to resume-first-failure-before-timer-review.json and
resume-closure-before-timer-review.json; original initial failure/closure retained.
Reserve a separate one-shot timer-reviewed-continuation.json marker, release lock,
then launch the same helper in one bounded8min unit with independent ExecStopPost.
The helper rechecks prepared inventory/pins, original STOP, unchanged900s guard
and lock before coordination. No reset of backup counters/hold/mode/history;
no forced scheduled job, re-download/extraction or automatic retry. Paired rollback
and baseline restoration remain required; return fresh body/failure/closure output.
Shell and embedded Python syntax and manifest/whitespace PASS; no test/build replay.
Deploy/live visual acceptance remain pending; legal draft excluded, backup A–D reused.


### Deploy and paired rollback health STOP — closure unconfirmed

[Operator result](evidence/public-pricing/pin-alignment-20261012/operator-deploy-and-closure-health-stop.json):
new release verification and paired rollback both reached
STAGING_HTTPS_OR_RUNTIME_NOT_READY; no body-pass or resume-closure, unit exit1.
Prior STOP/closure archived retained. This failure occurred after coordination
was reserved, unlike earlier near-term STOPs. Successful rollback, web readiness
and timer restoration are NOT_PROVEN. Reviewed control flow verifies old artifact
manifest/config before rollback health, and restores timers only after health
and unchanged backup state; actual current state requires fresh evidence.
Do not rerun deploy/resume/rollback or start timers blindly.

One [read-only failed-closure diagnostic](evidence/public-pricing/pin-alignment-20261012/VPS-TERMINAL-FAILED-CLOSURE-DIAGNOSIS.sh)
PENDING_OPERATOR_COMMAND: exact current build/canonical/config/state, both old/new
artifact verification, retained directory presence, timer/service state, precise
runtime-scope reason, safe PM2 metadata, public HTTPS and confirmed-port loopback
HTTP independently. Bounded historical log tails produce only error categories
and narrowly filtered missing-module names; no raw logs/env/credentials exposed.
No PM2 action, timer change, file mutation, backup entrypoint or automatic retry.
Shell/embedded-Python syntax and manifest/whitespace reviewed; no application test
or build repeated. Marketing deploy remains incomplete; legal and backup A–D retained.


### Old rollback exact PASS; canonical-route health guard defect confirmed

[Returned diagnostic summary](evidence/public-pricing/pin-alignment-20261012/operator-restored-old-release-diagnosis.json)
confirms old build mMVPOjFPkw5L42RIqziS4, all842 old canonical files, old config
and canonical hashes, unchanged backup state (CONTINUOUS/holdfalse/attempts2),
online scoped PM2 runtime. Previous directories are already restored; failed-new
artifacts retained. Both backup/monitor timers inactive but enabled; writer timer
active/enabled, services idle. No closure confirmation and no marketing acceptance.

[Independent read-only route check](evidence/public-pricing/pin-alignment-20261012/canonical-route-health-review.json):
/hr ->307 Location:/; canonical / ->200 with TLS verification0. Routing uses
defaultLocale hr and localePrefix as-needed. The deploy helper wrongly requires
direct200 on /hr; this incorrect helper condition blocked both new release and
old rollback health. This does not prove new-build visual acceptance or all-service
readiness. Do not repeat deploy or rollback to resolve this routing condition.

[One targeted old-release closure](evidence/public-pricing/pin-alignment-20261012/VPS-TERMINAL-CLOSE-RESTORED-CANONICAL-RELEASE.sh)
PENDING_OPERATOR_COMMAND. No executable helper/application/pin change or PM2 action.
Verify exact original failure records, existing reservation, restored old842 files
and pins, state bytes, retained failed-new artifacts, scoped runtime and direct200
TLS0 at fixed same-origin canonical root with Croatian request locale (no redirect
following or blanket307 acceptance). Under existing exclusive job lock, require idle
backup/restore, original inactive/enabled timer baseline and writer unchanged.
Check unchanged calendars and typed last triggers against latest regular terms,
reject any missed term or next term <=900s to avoid a catch-up/forced scheduled job.
Reserve one canonical-closure-attempt marker then only start original two timers;
record separate canonical-closure.json with identities/next typed terms. Original
failures/attempts remain retained, no reset. Failure records current timer state
and leaves coherent old artifacts untouched; no automatic retry. No build/test
replay; syntax, manifest and whitespace checked. Live execution is pending.


### Old canonical closure PASS; corrected exact-artifact deploy handoff

[Operator closure summary](evidence/public-pricing/pin-alignment-20261012/operator-canonical-old-release-closure-pass.json)
confirms old842-file release, old canonical/config, healthy canonical root200/TLS0,
online runtime, unchanged backup state/writer, both backup and monitor active/enabled
waiting. Next regular terms: monitor2026-10-12 17:20UTC, backup2026-10-13 04:30UTC.
Failure history/new artifacts retained. These are returned point-in-time results;
marketing deployment remains not accepted and rolled back.

[Minimal reviewed helper delta](evidence/public-pricing/pin-alignment-20261012/deploy-canonical-reviewed.diff)
fixes health URL to exact canonical https://staging.passvero.eu/ with Croatian
request locale. Still require direct200/TLS0 and independent scoped runtime;
no redirect following/307 acceptance, weakened backup guard or application change.
[Four targeted isolated checks](evidence/public-pricing/pin-alignment-20261012/canonical-health-targeted-checks.json)
PASS: canonical200/TLS0 allowed;307, TLS60 and invalid runtime rejected. All helper
functions except health/deployment/close/main have identical ASTs; changes in latter
functions add accepted old-closure prerequisite, existing retained754-file inventory
reuse and canonical-deploy-* result/reservation namespace. No download/extraction,
old attempt/failure/closure reset or overwrite. No application build/unrelated tests.

[One corrected deployment block](evidence/public-pricing/pin-alignment-20261012/VPS-TERMINAL-DEPLOY-CANONICAL-REVIEWED.sh)
PENDING_OPERATOR_COMMAND. Seals only the new reviewed helper under a distinct name;
old helpers/pins/runtime configuration unchanged until coordinated swap. Fresh
prelaunch >1200s margin for both active regular timers; unchanged >900s helper guard.
Require accepted old closure and exact original two health failures, old release
and dependency identities, same reviewed archive/source manifest and all754 retained
failed-new artifact hashes/sizes/modes/owners, exact saved pin input bytes.

Old/new identities remain mMVPOjFPkw5L42RIqziS4 ->853RYrj-r5cyoSGuJudap;
canonical f7039de22d508baac9d70cda13eed9a98b550af93f8b0f92fadbea9fa8106c40
->b2a5866a532ecc9912fae5ebeb83086ff0a5f2d162b40a5c031723471ab898e9;
config399a693588167747cd565fdf179ecfc2dc5a6c6d756a7498bdf73f93fe959d62
->c93266b5d07a7afcfb97ab9ebbbac49dc342348ec61344dc1e9d53f1e8ea1f9a.
Only config buildId/canonicalSha256 keys change at
/usr/local/libexec/passvero-staging-backup/config.json; canonical artifact manifest
at /var/lib/passvero-onboarding-deploy-2cb9d6e/application/manifest.json accompanies
exact .next/messages swap under /var/www/passvero-acceptance.

Sequence unchanged: naturally wait for writer idle (<=60s); reserve separate one-shot
attempt under existing job lock; idle-check capture/restore and backup/monitor; stop
only staging backup/monitor timers; stop existing PM2 runtime via accepted RPC; move
old directories to previous-* and retained new directories into application; apply
paired exact manifests/config; restart existing runtime; verify artifact and canonical
HTTPS/pins/state/writer. Independent ExecStopPost performs new alignment confirmation
or paired old rollback before restoring prior timer baseline. Unit bounded8min,
Restart=no. Never invoke scheduled backup/monitor/worker/transport manually.

[Matching paired rollback](evidence/public-pricing/pin-alignment-20261012/VPS-TERMINAL-ROLLBACK-CANONICAL-REVIEWED.sh)
uses the same corrected hash-pinned helper and separate current-attempt namespace;
previous rollback wrappers target historical helpers and must not be used for this
new attempt. Preserve old/new artifacts and all failure history. No rollback execution
now; initial unsuccessful deploy rollback was already confirmed separately.
Return new body/failure/closure output, no automatic retry. Source/archived build/legal
namespaces unchanged. Live six-locale responsive/CTA/read-only marketing acceptance
remains pending; backup A–D reused and internal legal draft excluded.


### Final staging marketing deployment and read-only acceptance — COMPLETE

[Returned deploy/closure summary](evidence/public-pricing/pin-alignment-20261012/operator-canonical-deploy-closure-pass.json)
PASS, exit0, no new body/closure failure. Build853RYrj-r5cyoSGuJudap online at
/var/www/passvero-acceptance; exact757-file canonical manifest verified (754 reviewed
marketing artifacts plus3 retained canonical files), canonical SHA
b2a5866a532ecc9912fae5ebeb83086ff0a5f2d162b40a5c031723471ab898e9, config SHA
c93266b5d07a7afcfb97ab9ebbbac49dc342348ec61344dc1e9d53f1e8ea1f9a.
Only config buildId/canonicalSha256 keys changed. Old/current source/archive and
manifest hash checks PASS; all12 executable source entries unchanged from reviewed
source manifest, archive unchanged, no rebuild. No backup verifier/source/runtime
architecture or repository/selector/retention/worker/updater/qpdf/reminder change.

Backup/monitor active/enabled waiting after independent closure. Returned next terms:
monitor2026-10-12 19:20CEST (17:20UTC), capture2026-10-13 06:30CEST (04:30UTC).
Backup state and writer baseline unchanged; no capture/restore/worker/SMTP/Telegram
entrypoint called. No acceptance replay, scheduling acceleration, hold/counter reset
or retention deletion. Backup A–D remains accepted COMPLETE; this release adds no
new restore, future scheduled-capture or inbox receipt claim. Results are point-in-time.

[Live read-only results](evidence/public-pricing/pin-alignment-20261012/live-marketing-read-only-results.json)
PASS for hr/sr/en/de/sl/pl at1440x1000 and375x812:12 landing views plus6 localized
pricing CTA navigations to request-access forms, no form submission. Start/Business/
Pro/Custom rendered with147/490,297/990,597/1990EUR standard prices,3/12 calendar
months, exVAT,6-month controlled trial and manual B2B offer/bank-payment text.
Availability details open in each view and display exact reviewed counting,
VOLUNTARY/MANDATORY/UNRESOLVED availability and retention explanations. Existing
unchanged local keyboard/five-width/capability-copy proofs reused.

Page identity/nonblank/overlay checks PASS; no horizontal overflow, browser console
or page errors. Visual inspection supports readable desktop cards and mobile hero/
pricing flow. Screenshots outside repository in /tmp/passvero-live-marketing-20261012
(24 images with hashes recorded in live-results); HR/PL focused pricing-element
captures supplement primary screenshots. Browser plugin absent; existing Playwright
and system Chrome used with TLS verification. All non-GET/HEAD/OPTIONS requests
blocked by QA guard; none attempted. No live sending/business writes/test data.
An ancillary screenshot-only networkidle wait timed out; primary18-check run passed
and focused captures completed using rendered-element readiness. No product changes.

Rollback remains the reviewed hash-pinned canonical helper/block above, using
previous-.next/previous-messages and saved old canonical/config as one paired unit.
It restores old build mMVPOjFPkw5L42RIqziS4, old canonicalf7039de2… and config399a6935…,
retains new artifacts, verifies old manifest/runtime/canonical HTTPS, and restores
prior timer baseline under the same idle/window/job-lock guards. It was not executed
for successful corrected deployment. Never use historical rollback wrappers for
this new namespace or rerun any deployment block automatically.

Legal draft remains internal outside deploy: no legal page/source change; Legal
translation namespaces match HEAD in all6 locales and accepted deployed baseline.
Previously approved public commercial explanations are deployed; no draft/placeholder
legal policy added. Marketing/legal/shared-document worktree edits remain preserved.
Report/roadmap/final resume manifest updated; manifest hashes and whitespace PASS.
Index empty, HEAD unchanged5dba99b474d5fabbabc75855f15c912bb9c4b8c6; no commit/push.


### User visual review — restoration prepared locally, no deploy

User did not accept generic HTML cards replacing passport/phone/QR and laptop
illustrations. Earlier visual PASS was automated technical evidence, not user
visual acceptance. [Restoration report](MARKETING_VISUAL_IDENTITY_RESTORATION.md)
records new accurate image assets, recovered composition and limited six-locale
local checks. User approved this restored local design on 2026-10-12:
“Odobravam dizajn.” Status USER_VISUAL_APPROVED_LOCAL_ONLY.
Historical build853RYrj-r5cyoSGuJudap/backup pins unchanged; current source differs
from that package. No deploy/repin, backup replay, commit or push in this task.
