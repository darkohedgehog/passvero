# Dashboard UI review, Git and staging deployment — 2026-10-27

**Final outcome: staging deployment PASS; read-only UI review PASS with one existing
cosmetic note. User final acceptance PENDING.** Build `o881QhduK5s1O2SuiT9jr`
corresponds to implementation commit `45a04f6a202b9867ade081657ca545f9f19232ea`
(22 files, ordinary non-force push verified). All852 canonical members and paired
release pins verified by operator; backup state/timer baseline and retained history
preserved. Rollback prepared, not executed. No production, business-rule or scanner
changes. Final documentation closure is the single commit containing this report;
it requires no rebuild, redeploy or runtime repin.

Staging links: [dashboard](https://staging.passvero.eu/dashboard),
[billing](https://staging.passvero.eu/dashboard/billing),
[subscription](https://staging.passvero.eu/dashboard/subscription),
[existing admin](https://staging.passvero.eu/platform/organizations).
Detailed [release manifest](evidence/dashboard-ui-final-20261027/release-manifest.json)
and [native UI review](evidence/dashboard-ui-final-20261027/staging-read-only-ui-review.json).
Authenticated screenshots are intentionally local, outside Git, with paths/hashes
in the UI review record; accepted synthetic local screenshots remain under local/.


User accepted the local customer UI design and explicitly approved scoped commit,
non-force push to origin/main, one staging-origin rebuild if required by build-time
settings, and coordinated staging deployment with the existing paired rollback.
Final user acceptance is PENDING. Production is outside scope.

Reviewed exactly22 files (19 application/translation,3 focused tests) against the
accepted local manifest and build7Px-7MMCaXTkzsEYhcT7Z. Source hashes and accepted
build manifest/log hashes match. Both publication placements share the existing
handler/in-flight pending guard and original authority/confirmation/evidence; PDF
selection only updates filename and leaves upload/save separate. The customer
subscription branch labels the explicit staging-exception plan without payment.
Translation diff adds only three specified keys in six locales. No accepted tests or builds
were repeated just for Git; the subsequently authorized staging-origin build is recorded below. Prior limited checks and corrective attempts
remain honestly recorded in the immutable local evidence.

Actual admin scope: shared DashboardShell header LanguageSwitcher/SignOutButton
presentation is inherited by existing Platform Admin pages. Dashboard-only CSS is
under .customer-workspace, outside the Platform layout; CommercialOverview operator
branch remains unchanged. No dedicated admin page redesign or new design phase.
Representative live shared-component impact is pending read-only staging review;
local historical Platform billing presentation checks are accepted evidence only.

Source commit:45a04f6 (22 files),
style(dashboard): unify forms uploads and subscription presentation.
Ordinary non-force push succeeded; exact actual-remote readback is recorded in the
release manifest. Index empty. Preexisting legal draft and226-line roadmap change
are excluded and byte-preserved. No secrets/private data/env files/build artifacts
or temporary package were staged.

Local build embeds https://passvero-preview.invalid; it must not be deployed.
One approved build of the exact reviewed source with staging origin waits for a
fresh operator read-only baseline of effective existing build settings, current
canonical/config, retained rollback, idle capture/restore/recovery jobs and timer
window. Existing reviewed operator procedure is reused. No privileged action is
run by the assistant. No tests are repeated and no scanner/backup acceptance is
opened. Original NOT_PROVEN recovery statuses are unchanged.

Initial historical staging state: PENDING_OPERATOR_BASELINE (no mutation performed at that point).
USER_FINAL_UI_REVIEW=PENDING
BUSINESS_RULES_CHANGED=NO
BACKUP_ACCEPTANCE_REPEATED=NO
PRODUCTION_DEPLOY_PERFORMED=NO


## Operator baseline and one approved staging build — PASS

Operator read-only baseline at2026-10-27T17:17:02UTC verified current build
RVDJVB4UmvCtP7UnxGKi2, all852 canonical members, existing exact config/canonical
pins, and759 retained rollback members from the previous deployment. Existing
build-time origin, runtime staging flag and public Turnstile hash match. Local
Node and runtime Node are bothv24.22.1; dependency package/lock distinction matches
the exact previously reviewed2026-10-12 baseline;15 installed metadata pins match.
No installs or secret/configuration changes. Baseline monitor178s/reminder98s away:
not a deploy window. Timers/jobs were not stopped or run manually.

One authorized isolated git-archive staging-origin webpack build of exact commit
45a04f6a202b9867ade081657ca545f9f19232ea succeeded: **o881QhduK5s1O2SuiT9jr**.
No environment files copied; only explicit existing public/build settings supplied
to a clean child process. Python3.9 archive-extraction API compatibility was fixed
before any build; all archived members were validated trusted relative regular
files/directories. No failed or repeated build in this release task, no tests rerun.

Audit PASS:36 canonical/hreflang/OG sets,36 sitemap URLs, robots,264 generated text
responses contain no preview/localhost placeholders. Existing Next config matches.
839-member .next/messages package only; all13 retained canonical members stay unchanged, including all public assets.
The public-only classification was incorrect and is corrected below. Bundled barcode/
CSV code verified,83 traces exclude those absent external packages.

Artifact manifest SHA256 e35561c0986e8c97c3b18de024634952bc1938b0de098f0917b4dd7fb55abf8a.
Archive SHA256450393413b0153b933edaf234e0e46bcfaf4cd6e42e3ae2362754a43ec084930.
Exact candidate canonical/config pins still require the existing read-only package
preflight against the root-owned current manifest. Prepared paired deployment uses
existing bounded unit/independent closure with public swaps removed (no public asset
changes in this release). No new deploy helper is executable/uploaded until exact
candidate pins are read back and reviewed. No active runtime/pin mutation yet.


Current handoff: exact archive, artifact manifest and read-only package helper uploaded
to private `/tmp/passvero-dashboard-ui-release-20261027`; all three SHA256 values
verified over existing unprivileged SSH. No active application/configuration swap.
One complete package preflight block is PENDING_OPERATOR_COMMAND. Its output fixes
the exact new canonical/config pins before the paired deploy helper is finalized.
No additional build, tests, runtime/scanner recovery or acceptance is needed.


## Package preflight STOP — retained-set classification error, no deployment

Operator returned EXACT_CANDIDATE_PINS / RETAINED_PUBLIC_INVENTORY_CHANGED, with
no automatic retry. This read-only helper contains no application/config/timer
mutation. Before that guard, exact current canonical/config SHA256, all current
canonical member paths/bytes, runtime/dependency identity, package hashes/members,
legal namespace comparison and idle guards had already passed.

Cause: the new helper wrongly classified every retained path outside .next/messages
as public/. The canonical manifest is authoritative for the entire retained set;
the prior package and canonical counts imply13 retained entries, not13 public assets.
No new file/path is invented. Prepared package-preflight-v2 changes only that guard,
checks13 retained entries remain disjoint from the new839-member package, verifies
entry equality and exact current bytes, and prints the actual retained path inventory.
All original current canonical/config/package SHA256 checks stay intact. The original
failed helper52ebd2e0… and operator STOP are retained unchanged. New helper SHA256:
`dfba16c911191e2b4f887bc05fa42079bdd0bf34b51909f10e81afda01a84f4c`.

Buildo881QhduK5s1O2SuiT9jr, archive45039341… and manifest e35561c0… are unchanged;
no new build/test or broad verification. Corrected the same mistaken classification
in the private unexecuted deploy template; it remains local and unuploaded pending
actual candidate pin readback. No deploy or rollback was started, no scanner/backup
acceptance or transport call. Corrected read-only package check is pending operator.


## Exact package/pin preflight PASS; bounded deployment prepared

Operator at2026-10-27T17:26:54UTC confirmed corrected package preflight PASS.
Retained13 canonical entries are10 public assets plus three existing onboarding
code files (.controlled-onboarding/review-access-requests.mjs,
.onboarding-flow/onboarding-access.cjs, .onboarding-flow/review-access-requests.cjs).
All bytes unchanged; those onboarding files are neither executed nor modified.
Backup CONTINUOUS/hold=false/attempts17, state9bf03b98… unchanged, no job/transport
calls. Legal namespaces match deployed. Only buildId/canonicalSha256 config keys
change for the new839-member package and13 retained entries.

Exact candidate canonical:
44ce5b70fa98620b0c9166e1a666e2a750c881c039bbfac64a8d7c052bb9cefa.
Exact candidate config:
6bec53494e9b81485c27684f981c80bd57628da6f80d677f2c4aa55ce4734c04.
Final deploy helper97a139c9… and launch3f9abf9f… preserve the existing reviewed
bounded systemd unit/independent closure, using fresh idle/>20min launch and>15min
pre-swap guards plus the existing exclusive job lock. No public/onboarding swap.
On unsuccessful body, independent closure restores prior .next/messages and the
paired canonical/config pins; timer baseline and retained artifacts are verified.
Only backup/monitor timers are coordinated and restored, reminder timer unchanged.
No backup/scanner/producer/Freshclam/clamd/qpdf jobs or configuration changes.

Complete [deploy block](evidence/dashboard-ui-final-20261027/VPS-TERMINAL-DEPLOY.sh)
and separate [prepared rollback block](evidence/dashboard-ui-final-20261027/VPS-TERMINAL-ROLLBACK.sh).
Rollback location: /var/lib/passvero-dashboard-ui-deploy-20261027.
Privileged execution is pending operator output. No staging swap performed yet.
No source/build/tests repeated, no final documentation commit yet, legal/readiness
bytes and index preserved. Production and historical NOT_PROVEN statuses unchanged.


## Staging deployment and independent closure — PASS; private UI access pending

Operator returned unitReturnCode0, deployment PASS, no body/closure failure records,
NEW_ALIGNED closure. Exact buildo881QhduK5s1O2SuiT9jr is online under existing
passvero-acceptance runtime, cwd/var/www/passvero-acceptance, PID858670 at deploy.
All852 canonical members and exact candidate canonical/config pins match. New
839-member build/messages package plus13 retained canonical members are verified.
Independent closure confirms backup state unchanged, timers active/enabled/waiting
at their ordinary terms (monitor27October19:20CET; backup28October05:30CET), writer
timer unchanged, history/artifacts retained, rollback PREPARED_NOT_EXECUTED. Launch
guard observed2972s to monitor and39572s to backup. Zero capture/restore/worker/SMTP/
Telegram calls. No production/scanner/backup acceptance or broader recovery action.

Independent unauthenticated GET readback confirms HTTPS200/TLS0 and exact new build
for all six public canonical locale paths, expected staging canonical/hreflang/OG
metadata, no preview placeholder, and exact unchanged transparent-logo SHA256.
An initial /sr/ request returned the expected308 under trailingSlash=false; continued
on configured /sr with no repeated HR request. No app failure or redeploy needed.

Existing native Chrome has no active staging session; /dashboard redirected to
/login. Automatic review rejected submitting the existing autofilled credentials
before execution, because credential-bearing login/session creation was not deemed
explicitly authorized by the read-only review scope. No bypass or alternate auth
harness attempted. User choice is pending for explicit standard staging UI login
or manual browser login. Private dashboard and Platform Admin visual review are
NOT_YET_PROVEN on staging; accepted local synthetic evidence stays separate. This
auth-access boundary is not a deployed application failure and does not call for
rollback. User final UI acceptance remains PENDING.

Final documentation-only commit/push waits for UI review disposition; no source
changes, repeated build/test, additional deploy/repin, or unrelated/legal staging.
HEAD45a04f6/index empty and original legal/roadmap bytes remain unchanged.


## Completed native staging review after user manual login

User chose manual login and completed it in the existing Chrome window. No agent
credential submission, cookie extraction, alternate auth harness, CAPTCHA solving
or security bypass. Initial rejected login action and its manual resolution remain
recorded. Native cua_repl alone controlled the browser; existing DevTools responsive
mode390x685 was used and then closed, returning Chrome to the HR dashboard.

One bounded read-only review covered the actual dashboard/header, an existing
synthetic product and DPP content form desktop/mobile, PDF editor and native picker
(opened/cancelled without selection), top/bottom publish placements without clicks,
CSV file/delimiter/export presentation, billing and subscription without saving,
Platform Admin organizations desktop/mobile and existing billing list desktop.
HR/SR/EN/DE/SL/PL billing/header views were rendered and visually inspected on both
desktop and mobile; no visual overlap/page overflow seen in inspected areas. Native
language control showed six full-name options; HR→DE retained the billing route.
Native menu opened, Escape closed it and focus returned to its trigger. Product
source/content locale stayedHR. Staging exception was explicitly labelled, with
no current paid period claimed. No framework overlay or visible app failure.
Native console showed an existing extension informational log; no new comprehensive
console/DOM telemetry harness was introduced or claimed.

CSV mapping/preview evidence is the accepted local synthetic proof with matching
source hashes, reused as expressly allowed; no live file upload, headers/preview
POST, import confirmation/execute or export download was initiated. No product,
manufacturer, DPP, document, billing or commercial form was submitted; no scan,
publish, payment, email or Telegram action. Auth session was opened by the user.

Actual admin scope remains inherited shared language/sign-out header presentation,
not a redesign of dedicated Platform Admin pages. Existing admin list/table/card
layout renders correctly and stays outside customer-only CSS. Historical full
recovery/startup/backup/scanner NOT_PROVEN/PASS acceptance dispositions are unchanged;
this UI proof does not promote them or repeat those workflows.

One minor existing visual remainder is recorded: the outer Uvezi CSV accordion
summary keeps the darker default border from unchanged
app/[locale]/dashboard/products/page.tsx. Inner CSV controls/cards are polished.
This is not a release/runtime failure; no new source/design/build/deploy phase was
opened. User final UI review remainsPENDING, with this note visible for acceptance.

Screenshot links (local private captures, not committed):
[dashboard/header](/tmp/passvero-dashboard-release-20261027/staging-screenshots/review-crops/dashboard-desktop.png),
[DPP form](/tmp/passvero-dashboard-release-20261027/staging-screenshots/review-crops/dpp-desktop.png),
[mobile PDF](/tmp/passvero-dashboard-release-20261027/staging-screenshots/review-crops/pdf-mobile.png),
[bottom publish](/tmp/passvero-dashboard-release-20261027/staging-screenshots/review-crops/publish-bottom-mobile.png),
[CSV](/tmp/passvero-dashboard-release-20261027/staging-screenshots/review-crops/csv-desktop.png),
[billing six languages](/tmp/passvero-dashboard-release-20261027/staging-screenshots/review-crops/six-locale-mobile.png),
[subscription](/tmp/passvero-dashboard-release-20261027/staging-screenshots/review-crops/subscription-desktop.png),
[admin mobile](/tmp/passvero-dashboard-release-20261027/staging-screenshots/review-crops/platform-organizations-mobile.png).

STAGING_DEPLOY=PASS
USER_FINAL_UI_REVIEW=PENDING
BUSINESS_RULES_CHANGED=NO
BACKUP_ACCEPTANCE_REPEATED=NO
PRODUCTION_DEPLOY_PERFORMED=NO

## CSV accordion border final alignment — 2026-10-27

The separately approved final correction resolves the darker outer CSV summary
border recorded above. Commit `2c877f05dfcecd2694139cc1d8f504f912ff3d7d`
(`style(csv): align import accordion border`) changes one source file, adding only
`border-slate-200` to the catalog-import summary. The existing global keyboard
focus outline, inner forms, spacing, text, permissions and import/export behavior
are unchanged. No global accordion rule was added.

One final staging-origin build `YNJg-e6igvm0cUQHZ1S3I` passed compilation and
TypeScript. Generated canonical/hreflang/Open Graph metadata uses
`https://staging.passvero.eu`; 264 generated text responses contain no reviewed
preview/localhost placeholders. No tests or broad visual series were repeated.
The exact archive has 839 members; the deployed canonical inventory has 852,
including all 13 retained files unchanged. See
[evidence manifest](evidence/csv-accordion-final-20261027/release-manifest.json).

The first launch stopped before mutations because the regular monitor term was
too close. After that ordinary scheduled term, the operator supplied a fresh
idle/window PASS; the guarded launch then completed successfully. Operator body
and independent closure confirm `NEW_ALIGNED`, exact canonical/config pins,
HTTPS/TLS PASS, unchanged backup state and reminder timer, and restored active,
enabled backup/monitor timers. Only buildId/canonicalSha256 release config pins
changed. No scanner/producer changes, manual jobs, business writes, messages,
backup acceptance or production changes occurred.

Rollback is prepared, not executed:
`/var/lib/passvero-csv-border-deploy-20261027`, retaining the previous
`o881QhduK5s1O2SuiT9jr` artifacts and paired canonical/config pins. Older rollback
history remains unchanged. The reviewed rollback block is in the evidence folder.

Targeted read-only staging review passed for open/closed summary and Tab/Shift+Tab
focus with Return reopening on desktop and 390x685 mobile. The slate border is
consistent with adjacent surfaces; the original blue keyboard outline stays clear.
No file selection, import/export, save or other business action was triggered.
Public HTTPS returned 200 with TLS verification 0 and the exact new build ID.
Final user staging confirmation remains PENDING, distinct from this agent review.

Private screenshots remain outside Git:
[desktop open](/tmp/passvero-csv-border-release-20261027/screenshots/review-crops/desktop-open.png),
[desktop closed focus](/tmp/passvero-csv-border-release-20261027/screenshots/review-crops/desktop-closed-focus.png),
[desktop open focus](/tmp/passvero-csv-border-release-20261027/screenshots/review-crops/desktop-open-focus.png),
[mobile closed focus](/tmp/passvero-csv-border-release-20261027/screenshots/review-crops/mobile-closed-focus.png),
[mobile open focus](/tmp/passvero-csv-border-release-20261027/screenshots/review-crops/mobile-open-focus.png).
Their exact hashes are recorded in the targeted review evidence.

The separate legal draft and entire pre-existing roadmap diff retain their exact
baseline bytes and stay outside this release. Final evidence is a documentation-only
commit; it requires no additional build, deploy or runtime repin.
