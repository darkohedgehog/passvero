# Approved restored marketing design — staging deployment, 2026-10-12

Status: COMPLETE — USER_APPROVED_DESIGN_DEPLOYED_AND_READ_ONLY_STAGING_VERIFIED. User approved the local
restored design (“Odobravam dizajn.”) and staging deployment (“Možeš uraditi deploy”).
Operator deployment and independent closure PASS; only approved two-key staging
backup pin alignment performed. No commit/push or production change.

## Reviewed source and package

Isolated build from HEAD 5dba99b474d5fabbabc75855f15c912bb9c4b8c6 plus exactly14
reviewed marketing source/asset files; both new public PNGs explicitly included.
Generated Prisma client copied as an existing build input. No env files or legal
worktree changes copied. Six Legal namespaces match HEAD; deployed Legal namespace
comparison remains required in operator preflight. Build and subsequent TypeScript
PASS. First isolated build failed on sandbox font DNS and missing generated client;
corrected build inputs/network, with no application source or dependency changes.
Existing18-view local visual evidence and user approval reused; no acceptance replay.

Build: `_tkSUOn0PCoHjpx8V7FVr`; executable members:756.
Archive SHA256: `0fa2668e2ce1eaa5aac34fb7e7ff44add1bd66aeca7c13d2439d448ac73ce3e0`.
Artifact manifest SHA256: `f99e967366651aeca151d68a5c9b243196023b8eb10e0294df767c9c2d985c82`.

[Source manifest](evidence/marketing-visual-deploy-20261012/source-manifest.json),
[Artifact manifest](evidence/marketing-visual-deploy-20261012/artifact-manifest.json),
[Scoped build/package checks](evidence/marketing-visual-deploy-20261012/local-checks.json),
[Operator read-only preflight](evidence/marketing-visual-deploy-20261012/VPS-TERMINAL-PREFLIGHT.sh).

## Coordinated staging plan

Expected old build853RYrj-r5cyoSGuJudap, canonical
b2a5866a532ecc9912fae5ebeb83086ff0a5f2d162b40a5c031723471ab898e9,
backup configc93266b5d07a7afcfb97ab9ebbbac49dc342348ec61344dc1e9d53f1e8ea1f9a.
These are historical accepted identities; fresh exact preflight must confirm them.
Only buildId and canonicalSha256 may change in
/usr/local/libexec/passvero-staging-backup/config.json. New exact values will be
printed by preflight and pinned in the reviewed mutation block before execution.
Canonical path: /var/lib/passvero-onboarding-deploy-2cb9d6e/application/manifest.json.
Application path: /var/www/passvero-acceptance. Preserve all other canonical members;
replace .next/messages and install only the two reviewed new public image files.

Verify no capture/restore/monitor execution, exact package/runtime/dependency pins,
CONTINUOUS/hold=false and completed prior attempt. Retain current backup state;
do not assume historical attempts=2 still describes the next scheduled interval.
For mutation use fresh typed D-Bus due times with >20min prelaunch and >15min guard,
exclusive existing backup job lock, save baseline and paired rollback material,
stop only staging backup/monitor timers briefly, swap exact artifacts and canonical/
config pins, restart only existing staging web process, then check hashes/TLS200 at
canonical root. Independent closure verifies aligned new release or restores exact
old application/canonical/config together before resuming saved automation baseline.
Writer configuration/timer remains unchanged; wait for idle naturally, never kill it.
No skipped/catch-up capture, retention deletion, worker/SMTP/Telegram or production action.

Rollback preserves new assets/artifacts by moving them into private evidence storage,
restores old .next/messages and exact paired manifest/config, checks old health, then
restores timer baseline. Both original marketing image assets remain untouched.
Failure history retained; one bounded operator execution, no automatic retry.
Read-only staging hero/laptop checks follow successful body and independent closure.

## Initial preflight handoff (historical)

Uploaded archive/manifest/read-only helper into a new private operator-owned /tmp
folder; upload does not change runtime. At this initial handoff, user preflight output was pending before deriving
new pin values and delivering the complete reviewed deployment/rollback blocks.
Backup A–D remains accepted; legal draft and unrelated edits preserved.

## Accepted preflight and exact deployment identity

User preflight at17:15:38UTC PASS; exact old release/config verified,756 new and3
retained members, Legal unchanged from deployed, CONTINUOUS/hold=false/attempts2,
backup state83a853dd… unchanged, no mutations or transport/backup calls. Monitoring
was due17:20UTC, so launch requires a fresh >1200s margin after its ordinary run;
no manual monitor/capture invocation or skipped term.

New canonical SHA256: `e30e2afa0dc470b149f94f4437d032603a7cf7cfeb66fdc1a6b39b11fe52f590`.
New config SHA256: `a79c6c856d5bb75fe17be7f47ec2e700250a6b9f3d916eed9dc08f76b328c839`.
Exact reviewed helper SHA256: `db04d71b65c6b382b0796bdf3fe32aea07b9fd97c82b13c996b0c26be1af2082`.
Canonical members after deploy:759 (756 package +3 unchanged).
[Complete operator deploy block](evidence/marketing-visual-deploy-20261012/VPS-TERMINAL-DEPLOY.sh)
and [prepared paired rollback](evidence/marketing-visual-deploy-20261012/VPS-TERMINAL-ROLLBACK.sh).
Rollback wrapper is prepared only; do not run together with deploy. Independent
ExecStopPost closure performs failure rollback automatically within this bounded
attempt; any STOP output must be reviewed before further execution.

New root-private evidence namespace /var/lib/passvero-marketing-visual-deploy-20261012;
all prior attempt/failure/closure history retained unchanged. Helper uploaded only,
not executed by agent. Shell/embedded Python syntax and six local isolated cases
PASS: before swap, old-next moved, directories swapped, first asset swapped, both
assets swapped, unreviewed public archive member rejected. Mock PM2/health and
temporary files only; no application/backup acceptance or runtime test.

## Completion — operator closure and read-only staging visual proof

[Operator output](evidence/marketing-visual-deploy-20261012/operator-deploy-and-closure-pass.json)
confirms unitReturnCode0, body PASS and independent closure NEW_ALIGNED,759 canonical
artifacts verified, runtime online at /var/www/passvero-acceptance (PM2 id0,
pid1119166). New build/canonical/config exactly match the reviewed pins above.
Both failure artifacts null; rollback PREPARED_NOT_EXECUTED; artifacts and prior
history retained. Backup state and writer timer unchanged; attempts/hold/mode from
preflight remain2/false/CONTINUOUS, without a backup acceptance replay.

Closure point-in-time schedule:
- staging backup timer active/enabled/waiting, next13.10.2026 06:30CEST (04:30UTC);
- staging backup monitor timer active/enabled/waiting, next12.10.2026 20:20CEST (18:20UTC).
No claim of future scheduled execution or message receipt follows from these values.

[Read-only staging evidence](evidence/marketing-visual-deploy-20261012/live-read-only-visual-results.json)
records12 views (hr/sr/en/de/sl/pl ×1440×1100 and375×812). Browser plugin absent;
existing Playwright/system Chrome used. Requests restricted to staging GET/HEAD/OPTIONS,
no form submission, worker/SMTP/Telegram/capture/restore or mutation request allowed.
The two new public PNG hashes and build-specific _buildManifest.js match artifact
manifest exactly over HTTPS with normal certificate verification. Title/highlight,
images loaded, localized CTA hrefs and no horizontal overflow PASS in all12 views.
One HR CTA click reached /request-access and a real form without submission.

| Check | Result |
|---|---|
| Page identity and meaningful content | PASS, six marketing routes200 |
| Blank page / framework overlay | No blank/overlay seen; localized hero/laptop present |
| Console/runtime errors | 0 errors |
| Asset identity | PASS two PNGs and new build manifest exact hashes |
| Responsive screenshot evidence | 24 section screenshots, desktop/mobile, outside repo |
| CTA interaction | PASS HR request-access navigation, no submission |

Manual inspection of HR hero/laptop desktop/mobile confirms the approved composition:
large passport/phone/QR hero, laptop workspace, palette and stacking preserved.
All24 screenshot paths/hashes are in the live evidence JSON; key review files:
/tmp/passvero-visual-staging-20261012/hr-hero-desktop.png,
/tmp/passvero-visual-staging-20261012/hr-hero-mobile.png,
/tmp/passvero-visual-staging-20261012/hr-laptop-desktop.png,
/tmp/passvero-visual-staging-20261012/hr-laptop-mobile.png.

Confirmed prices/quotas/periods/trial/B2B/capabilities remain byte-identical to reviewed
source apart from the approved imagery/composition/highlight restoration. Pricing
acceptance proofs reused, not repeated. Legal namespaces were compared against deployed
content in operator preflight; internal legal draft is excluded and preserved. Physical
mobile/Safari/full application recovery and transport delivery are outside this check.
Prepared rollback restores853RYrj-r5cyoSGuJudap, exact old canonical/config and paired
application directories, retains the new illustrations privately, and restores saved
staging timer baseline after verifying old health. Do not use earlier historical
marketing rollback wrappers for this release. No commit/push performed; index empty.

## Authorized final Git release review — 2026-10-12

User authorized final marketing review, commit and non-force push. The accepted
build remains _tkSUOn0PCoHjpx8V7FVr; changing Git HEAD does not change runtime pins.
All14 executable source/asset hashes match the accepted build source manifest.
No build, test, staging visual/deploy, VPS or backup acceptance was repeated.
The final Git set includes pricing/capability copy, restored illustrations, and
non-secret preparation/deployment/closure/visual evidence and final documentation.

[Authoritative commit manifest](evidence/marketing-final-review-20261012/commit-manifest.json)
lists exact commit-content SHA256 values. Roadmap is staged from a separate reviewed
index blob containing only marketing additions; the full worktree keeps pre-existing
readiness/legal additions unchanged. Their hashes and the exact residual diff are
recorded separately, rather than requiring worktree/commit hashes to match.

Two application archives,24 earlier local screenshots and the broad pre-task roadmap
snapshot are retained outside Git with unchanged hashes and explicit locations in
the commit manifest. They are not executable source members of this Git release.
Historical preparation manifests record their earlier snapshots; the consolidated
commit manifest is authoritative for this final source/documentation set.
The internal legal draft is excluded and byte-identical to the initial review state.
Index/remote/hash/whitespace checks apply to this Git release only. All earlier
“No commit/push” statements describe their point-in-time phase boundaries.

Staged whitespace review found formatting in historical diff/log evidence only.
Six text copies were normalized; original byte-for-byte evidence is retained outside
Git with original and commit hashes in the final commit manifest. Unified patches
still parse; executable source, package and accepted runtime identity are unchanged.


## Approved marketing UI final review — 2026-10-21

User accepted the local combined design and authorized the exact marketing commit,
non-force push to origin/main, staging deploy and minimal coordinated release-pin
alignment through the existing operator procedure. Source scope is 23 files:
language control/local flags/login icon, primary workspace CTA, six promo translations,
caption removal, warm scoped colors, glass header, transparent logo and mobile final-CTA
separation. Prices, business rules, illustrations and all Legal namespaces are unchanged.

[Final source manifest](evidence/marketing-ui-final-20261021/source-manifest.json),
[commit-content manifest](evidence/marketing-ui-final-20261021/commit-manifest.json),
[approved build log](evidence/marketing-ui-final-20261021/accepted-build.log),
[desktop](evidence/marketing-ui-final-20261021/approved-desktop.png),
[mobile](evidence/marketing-ui-final-20261021/approved-mobile.png),
[final mobile CTA](evidence/marketing-ui-final-20261021/approved-mobile-final-cta.png).

Latest accepted build is `Edl3N_JJEbBPamNQ84Jxn`, after the header/logo/mobile corrections.
Current source hashes match its final combined source manifest and BUILD_ID matches.
Existing lint/TypeScript/build, six-language responsive/header and targeted mobile
CTA evidence are reused; no build or test series is repeated for Git integration.
Actual remote main before integration equals local main HEAD
`2e0eefad7d250a5751bdb25eb72e8942621990c9`; initial index is empty.

**Staging deployment STOP: canonical origin mismatch.** The accepted build used
process-only `BETTER_AUTH_URL=https://passvero-preview.invalid`. Its six static home
pages contain canonical links to that placeholder (including `/en`, `/de`, `/sr`,
`/sl`, `/pl`) and structured metadata also uses it. Staging requires the origin
confirmed by fresh read-only preflight; prior reviewed procedure uses
`https://staging.passvero.eu`. Do not deploy or patch/relabel this package in place.
No replacement build has been authorized/executed at this review checkpoint.
A decision on one staging-origin build of the identical source was requested.

[Complete read-only VPS operator block](evidence/marketing-ui-final-20261021/VPS-TERMINAL-PREFLIGHT.sh)
reads exact current canonical/config/artifact hashes, origin, TLS, automation baseline,
backup state digest, idle locks/jobs and typed real/monotonic timer deadlines. It
makes no application, pin, automation, scanner or backup mutation. Operator output
is required before any dependent release preparation. A PASS baseline alone does
not clear the known local-package gate or authorize deploying another artifact.

Existing reviewed swap/independent-closure/paired-rollback procedure remains the
2026-10-12 visual deployment procedure above. Its concrete old/new hashes and rollback
namespace are historical and must not be reused for this release. No new runtime
rollback location exists before fresh baseline and a deployable reviewed package.
Only exact buildId/canonicalSha256 may change in backup config during a later
coordinated swap; preserve other config, state/history/retention, reminder baseline
and scanner/producer configuration. No capture/restore/worker/SMTP/Telegram call,
VPS execution, production change, migration, business write or deployment performed.

Git outcome and eventual operator evidence will be appended after the corresponding
operations. The entire preexisting roadmap/readiness/legal diff remains outside this
commit; only this task's new roadmap appendix is staged from a separate index blob.

### Git result and blocked staging handoff — 2026-10-21

Implementation commit `e0616fc20f53e0e9ad0bbb12a3aa099db5481695` —
`style(marketing): polish navigation colors and page presentation`, 37 files
(23 source/assets +14 documentation/evidence). Non-force `git push origin main` PASS.
Fresh `git ls-remote` confirms HEAD == origin/main == actual remote main. Index empty.
All23 committed source/asset hashes match the accepted manifest. Existing legal draft
and all preexisting roadmap hunks are preserved, unstaged and uncommitted.

Deploy remains STOP_CANONICAL_ORIGIN_MISMATCH; no VPS command has run and current
staging build/automation baseline remains NOT_PROVEN in this turn. No new rollback
location was created because no runtime/pin swap occurred. The existing historical
rollback path is not a rollback for this unperformed release. No build, tests or
backup acceptance repeated. Replacement staging-origin build decision and operator
read-only output are pending. This Git/deploy-disposition documentation remains
local until the one authorized final documentation commit after deployment disposition.

### Replacement build authorized — 2026-10-21

User approved one new staging build of the identical reviewed source, only after
fresh read-only confirmation of `https://staging.passvero.eu` and existing build-time
settings. No tests repeated, secrets or business configuration changed. The operator
preflight now also reads the current PM2/proc staging identity and origin, Node and
framework versions, package/lock hashes, relevant Next config, and a SHA256/presence
summary of the existing public Turnstile build-time value without printing it.
New build ID/package and static canonical/hreflang/Open Graph/structured URL outputs
must be audited before any active swap; preview placeholders or remaining mismatch
are STOP. This authorization removes the decision gate, not the pending operator
baseline gate. No new build or VPS action has occurred at this checkpoint.

### Read-only preflight stopped — operator handoff

Operator returned `STOP / READ_COMMAND_FAILED`, `automaticRetry=false`,
`mutations=NONE`. The original wrapper did not identify the failing external command,
so the failure cause is NOT_PROVEN. No build or deploy started. A bounded command-only
diagnostic now labels each external read and stops on the first failure with its
exit code and a sanitized stderr class; it does not rerun artifact inventory or mutate
units, environment files, runtime, pins, scanner or backup state. No blind retry.
[Complete diagnostic block](evidence/marketing-ui-final-20261021/VPS-TERMINAL-DIAGNOSE-PREFLIGHT-01.sh).
Operator output is required before a targeted correction or further release work.

### Effective-build settings child aborted — pending controlled-child correction

Operator diagnosis reached `EFFECTIVE_BUILD_SETTINGS`; child exit code -6, stdout
192 bytes, stderr 0, mutations NONE. Its preceding external command probes completed,
but no full release-baseline PASS exists. The helper cloned the complete active
Node/PM2 process environment into a new diagnostic Node process; this unnecessary
inheritance is a candidate cause, not a proven SIGABRT root cause. Pending helper
now verifies `/usr/bin/node` is the same running executable, runs as staging UID,
and passes only PATH/LANG/NODE_ENV, validated origin/runtime environment and existing
NEXT_PUBLIC values. It reads .env through the existing loader, prints only public
setting presence/hash and never edits environment files. Excluded Node control key
names may be reported without values. Parent runtime/environment is unchanged.
All nonzero child exits remain STOP; output from the failed child is not accepted
as build evidence. Updated preflight labels any failed command and records bounded
exit/byte metadata without printing raw stderr/secrets. No VPS execution of the
corrected helper, build, tests or deploy performed. Await one operator output.

### Confirmed baseline and one corrected staging build

User-returned read-only baseline at 2026-10-21 16:05:04 UTC PASS: current staging
build `_tkSUOn0PCoHjpx8V7FVr`, canonical e30e2afa… and backup config a79c6c85…
match the accepted existing release; all759 canonical members verified. TLS200/0,
origin `https://staging.passvero.eu`; all three timers enabled/active, services inactive.
Only895.811s remained to the monitor, so deployment window was false and no swap
was attempted. New launch will require a fresh >20min prelaunch / >15min swap guard.
Node control key names NODE_CHANNEL_FD and NODE_CHANNEL_SERIALIZATION_MODE were
excluded from the successful diagnostic child; no runtime environment changes.

Runtime package/lock fingerprints exactly match the previously reconciled baseline;
local input package/lock and17 dependency metadata hashes are unchanged from the
reviewed reconciliation. No dependency install or configuration update. Staging
Node v24.22.0 and build Node v24.15.0 are recorded separately. The existing public
Turnstile value SHA256 matches the local build input; Next public routing/config
settings match. Only confirmed origin/runtime marker and that unchanged public
value were supplied to a clean build process. No secret/env file copied or edited.

The one authorized build from an isolated archive of commit e0616fc, using the existing
webpack packaging procedure and existing generated Prisma/dependency inputs, PASS.
Build `RVDJVB4UmvCtP7UnxGKi2`. No tests repeated. Generated artifact audit PASS:
36 canonical/hreflang/Open Graph page sets,36 staging sitemap URLs,robots origin,
267 generated responses without preview placeholders. Initial audit handled binary
icon bodies as text; validator corrected its decoding only, with no source/artifact
change or rebuild. All23 source/assets still match the reviewed commit.

Exact package:847 members, archive SHA256 `866a4ddcf930c23202dd1e041af1ce60130b42315d970d6eb6c7a29e1e33dc0c`,
artifact manifest SHA256 `d8d63fb009d6c0db28ac02826e65be7dd7ff0c1c1f1008ff918c9a5d6247fe1f`. Both absent-on-VPS
libraries remain bundled with no external imports/traces; barcode in chunks/6074.js,
CSV parser in the existing import route. Public package members are only the reviewed
transparent logo and local flag assets/license; existing illustrations are retained.
Archive preserved outside Git at `/tmp/passvero-marketing-ui-release-20261021/application.tar.gz`. Uploaded only
archive/manifest/read-only preflight to a new operator-owned private /tmp directory;
remote SHA256 values match local. No sudo/runtime/pin/automation/scanner mutation.

[Package/pin operator preflight](evidence/marketing-ui-final-20261021/VPS-TERMINAL-PACKAGE-PREFLIGHT.sh)
now verifies the exact package, unchanged existing dependencies/Legal and current
release/config, logo/flag target posture, idle state, and derives the exact new
canonical/config candidates. Operator output is needed to pin the subsequent
existing coordinated swap and paired rollback. No active artifact replacement yet.

### Package preflight stopped on stale new-illustration guard

Operator returned STOP at EXACT_CANDIDATE_PINS / NEW_ASSET_ALREADY_PRESENT_STOP.
The copied 2026-10-12 helper still required the hero/laptop illustration paths to
be absent from the canonical manifest; those illustrations are already part of the
accepted current release. This is an obsolete helper assumption, not new runtime
asset drift. Earlier guards in this run reached exact candidate derivation. No
application, pin or automation mutation occurred.

Prepared one focused correction under new `preflight-v2.py`: both illustration
entries must exist in the prior manifest, must be absent from this UI package,
must remain identical in the candidate manifest, and current bytes must match
prior manifest SHA256. All other guard logic is unchanged. Original failed helper
and operator STOP are retained. New helper SHA256
`c24643dc7ab1663edcfb520574cddeeac1450030e0b38b21edf2ba01bc543543`.
Build RVDJVB4UmvCtP7UnxGKi2, archive and artifact manifest hashes remain unchanged;
no build/tests repeated. Uploaded only the new read-only helper; awaiting operator
output before a coordinated swap. No source or legal changes.

### Exact package PASS and coordinated deploy/rollback prepared

Operator package preflight PASS at2026-10-21 16:13:32UTC: old build/canonical/config
unchanged, Legal namespaces match deployed, flags absent, original logo SHA256
aa8ada63…, retained5 canonical members,847 new package artifacts. Backup mode
CONTINUOUS/hold=false/attempts11 and state dfa9e3ac… unchanged; no transport/job calls.
Exact new canonical `e8fd04e3716ca71d1f9f32e88176897718739fedd48ff29afba5c2cd0093f467`;
exact new backup config `a85326aea9316f6bc94ee255f33956f062b8788a0f3d74cefe3075ed9f1d1e7f`.
Only buildId/canonicalSha256 change; no policy/state/history/retention/helper change.

Prepared existing bounded-unit/independent-closure procedure in new namespace
`/var/lib/passvero-marketing-ui-deploy-20261021`. Exact helper hash3fbd9ce3… and
launch hash16acb66f… are pinned in complete operator blocks. Launcher rechecks idle
and typed calendar deadlines >1200s before creating the private namespace; helper
rechecks >900s before swap under the existing exclusive job lock. At observed18:13
CEST the monitor was due18:20; launch must follow its ordinary completed run, never
stop/skip that due job. No automatic retry or service kill. Reminder timer is kept
unchanged; existing writer is only allowed to become idle naturally.

Scoped public adaptation: archive members are only approved logo/flags, while old
illustration bytes remain canonical and untouched. Existing opaque logo is renamed
into private previous-public storage; new logo and flags directory are renamed in.
Independent closure handles partial swaps: restore old .next/messages/logo and
paired canonical/config on failure, preserving new assets privately. On success it
verifies exact new artifacts/pins/public inventory/TLS and restores saved backup/
monitor timer states. Scanner/producer/Freshclam configuration is not accessed or
modified by this adaptation. Runtime uses the existing PM2 daemon via reviewed
prepare/capture helper RPC functions only, without invoking any backup main/job.

Complete [deploy block](evidence/marketing-ui-final-20261021/VPS-TERMINAL-DEPLOY.sh)
and separate [prepared rollback block](evidence/marketing-ui-final-20261021/VPS-TERMINAL-ROLLBACK.sh).
Pending operator execution; no privileged deployment or rollback has run yet.

### Fresh launch window STOP — no deployment started

Operator launch returned NEXT_REGULAR_TERM_TOO_CLOSE_NO_DEPLOY at the fresh idle/
timer guard: monitor118.679s away, backup43918.709s away, mutations NONE, no automatic
retry. This is the intended guard before private deploy namespace creation or any
application/timer/pin mutation. Ordinary monitor must run and finish naturally.
Same reviewed build/archive/helper pins remain valid; next action is a fresh
read-only window/idle observation after the ordinary18:20CEST term, with no job
start/stop, reconfiguration, rebuild, tests or acceptance repetition.

### Ordinary monitor completed; known near-term gate cleared

Read-only unprivileged systemctl observations before/after the ordinary18:20CEST
term confirm monitor start/exit18:20, Result=success, ExecMainStatus=0 and inactive/dead.
Timer remains active/waiting, next deadline19:20CEST. No manual monitor/job invocation
or acceptance replay. The prior118s near-term cause has passed naturally. Same
reviewed launch/helper/package pins remain valid; operator may execute the existing
launch block, whose fresh idle/>20min guard still controls the action. No deploy
namespace/runtime/pin mutation has been performed by the assistant.


### Final staging deploy and read-only visual review — PASS

Operator returned unitReturnCode=0, deployment PASS and independent closure
NEW_ALIGNED. Exact build `RVDJVB4UmvCtP7UnxGKi2` is online under the existing
passvero-acceptance runtime (/var/www/passvero-acceptance, PID228736 at deployment).
847 reviewed package members plus5 retained files produce852 canonical members.
Canonical SHA256 `e8fd04e3716ca71d1f9f32e88176897718739fedd48ff29afba5c2cd0093f467`;
backup config SHA256 `a85326aea9316f6bc94ee255f33956f062b8788a0f3d74cefe3075ed9f1d1e7f`.
Only exact buildId/canonicalSha256 release pins changed. Archive and source hashes
match the reviewed implementation commit; no scanner changes were required.
[Operator deployment and closure](evidence/marketing-ui-final-20261021/operator-deploy-closure-pass.json).

Backup state is unchanged; previous history and rollback artifacts are retained.
Backup and monitor timers returned active/enabled/waiting to their recorded ordinary
terms (monitor19:20CEST, backup22October06:30CEST); writer timer unchanged. Capture,
restore, worker, SMTP and Telegram calls:0. No backup acceptance was repeated.
Prepared paired rollback remains unexecuted at
`/var/lib/passvero-marketing-ui-deploy-20261021`; use the reviewed separate rollback
block with fresh guards if needed. No production or business configuration changes.

One read-only browser pass covered HR/SR/EN/DE/SL/PL at1440px and375px: correct new
build in server HTML, HTTPS responses200, canonical/hreflang/OG staging origin,
no preview placeholder, no horizontal overflow, expected page/industry backgrounds,
transparent logo with exact SHA256, glass header, login/localized CTA paths,
six-option language selector and HR→SL cookie/navigation. Mobile menu open/close,
initial close-button focus, selector focus-visible and Escape passed. No browser
errors, blocked non-read requests, forms or business writes. Accepted local lint,
TypeScript and content evidence were reused; test suites were not repeated.
[Browser results](evidence/marketing-ui-final-20261021/staging-results.json).

A final screenshot wait for the existing lazy-loaded shield to decode confirmed
24px separation below the mobile notes, with no additional locale-matrix run.
[CTA image readback](evidence/marketing-ui-final-20261021/staging-final-cta-image-readback.json).
The unprivileged direct .next/BUILD_ID read was permission-denied after deployment;
permissions were preserved. Exact operator canonical verification and public HTTPS
HTML build identity supply the release readback instead.

Screenshots: [desktop hero/header](evidence/marketing-ui-final-20261021/staging-hr-1440-hero.png),
[mobile hero/header](evidence/marketing-ui-final-20261021/staging-hr-375-hero.png),
[open mobile menu](evidence/marketing-ui-final-20261021/staging-hr-375-menu.png),
[mobile final CTA](evidence/marketing-ui-final-20261021/staging-hr-375-final-cta.png),
[six language headers](evidence/marketing-ui-final-20261021/staging-six-language-headers.png).

Final closure is one documentation/evidence-only commit after implementation
commit e0616fc20f53e0e9ad0bbb12a3aa099db5481695 (37files), followed by ordinary
non-force push and exact remote readback. It does not change executable source,
require another build/deploy, or repin runtime to a documentation-only commit.
Preexisting legal/readiness roadmap hunks and separate legal draft remain outside
both marketing commits. Application source/assets remain the exact23 accepted hashes.

MARKETING_HEADER_LOCAL_IMPLEMENTATION=COMPLETE
STAGING_DEPLOY_PERFORMED=YES
STAGING_READ_ONLY_VISUAL_REVIEW=PASS
USER_STAGING_VISUAL_REVIEW=PENDING
PRODUCTION_CHANGES=NONE
