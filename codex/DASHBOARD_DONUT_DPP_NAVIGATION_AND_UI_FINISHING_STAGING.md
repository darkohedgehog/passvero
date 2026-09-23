# Dashboard donut, DPP navigation and UI finishing — staging

Date: 2026-09-23. Source base: `main`,
`1f43a09715017755e3430d057f849c4f23bdcb5b`. Initial worktree/index clean.
Implementation is uncommitted. No push, production access, migration or business-data write.

## Implemented scope

- Inline SVG donut uses the existing mutually exclusive distribution, with textual
  counts, rounded percentages and center total. Zero categories have no segment;
  zero total retains the neutral ring and existing empty state. Archive scope and
  overlapping headline-card definitions are unchanged.
- Authorized `/dashboard/dpp` uses PRODUCT_READ and the resolved tenant. A bounded
  server query reads 26 rows for a 25-row page, ordered by product UUID descending.
  It includes only current published pointers, including published + new draft.
  Name and primary image come exclusively from that published version; SKU remains
  product-level. Historical publications without a current pointer are excluded.
  Archived products remain visible privately, with an archive label and no public
  action. Withdrawn, suspended or otherwise unavailable passports have no public
  action. The existing public DPP service checks availability without additional
  per-row database reads. Public endpoint and permission schema are unchanged.
  No DPP search is introduced. The existing pagination presentation is shared.
- Small recent-product and DPP thumbnails use square cover/center sizing, clipping,
  rounded borders and a missing/error fallback through the existing authorized
  image route. Large product and public DPP images are unchanged. Previous source
  used object-contain without padding, which can create aspect-ratio letterboxing;
  the existing synthetic blue portrait was inspected through its public DPP and
  fills its original edges. Its square thumbnail now fills the frame; the former
  letterboxing was consistent with object-contain. No image processing.
- Dashboard language and logout controls retain native select, text, auth and
  pending/disabled behavior; decorative globe/logout icons, subtle backgrounds,
  borders and focus styles are added. Supported catalog search/cursor and DPP
  cursor survive locale changes; unrelated query parameters are dropped.
- All six message contracts are present. No dependency changes.

## Local evidence

- Targeted dashboard/public DPP tests: 35 PASS, 0 failures.
- Catalog pagination presentation regression: PASS (separate existing test file).
- Disposable PostgreSQL published-snapshot/query proof: PASS; fresh loopback
  cluster, existing migrations, no staging/production database. Covers empty list,
  current published + new draft name/image separation, historical-only exclusion,
  tenant isolation, 25+2 pagination, archived/withdrawn links and suspended tenant.
  Cluster stopped. No unrelated persistence, CSV, PDF or scanner acceptance rerun.
- `npx tsc --noEmit`: PASS.
- Scoped ESLint: PASS. Full `npm run lint`: 0 errors; 15 existing warnings in the
  unrelated Better Auth proof harness. Those files are unchanged.
- `BETTER_AUTH_URL=https://staging.passvero.eu npm run build -- --webpack`: PASS.
  Build ID: `kiXCpv3nqiz1u_K4f8Pbv`.
- `git diff --check`: PASS before packaging; final documentation also checked.
- Browser connection initially failed and was subsequently restored after user
  setup. Actual staging visual/keyboard results are recorded below. Missing-image
  placeholders were observed; an induced network image error was not exercised live.

## Original staging handoff (superseded by accepted v2 below)

Verified package: `/home/darko/passvero-ui-finishing-1f43a09`.
Checksum-file SHA-256:
`b6398baa9a5274cb1a72153e792837f0a8f7fad241fdc7e585c0ff4e16e9dbf8`.
Source-review SHA-256:
`17f32ca16243bba31f9480d26b2a266ff93e87e5588f3d7391f29e13477aeebe`.
25 implementation/test files pinned separately from this report and roadmap.
1134 build/message artifacts pinned. Package copied and checksums verified over SSH.

Expected previous build: `qwLCXFTd9EEGdvqaB9SZS`. Unprivileged reading of the
runtime BUILD_ID is denied; the operator wrapper must verify the previous artifact
manifest and every pinned old artifact before any replacement. No runtime mutation
has been performed by the agent.

The existing deploy procedure is adapted only to the new task paths/artifact pins
and current reporting. It preserves runtime environment, startup, passvero-staging
identity, onboarding operator, scanner/producer/qpdf configuration and service
state. It saves the old `.next`, messages and artifact manifest before replacement;
only the existing staging app is restarted. No second PM2 daemon or new process.

Planned rollback:
`/var/lib/passvero-ui-finishing-1f43a09/application/rollback.py`.
This path is created by deployment; it is not yet a confirmed live rollback.
Failure after stopping the app invokes this existing artifact-only rollback.

At handoff, staging deploy, authenticated DPP/public/back flow, desktop/mobile, six locales,
thumbnail image inspection, focus/keyboard and final logout: PENDING.
Logout must happen last. No new acceptance products are needed.

## Preserved boundaries

Prior explicit operator signature-health recovery and bounded PDF acceptance remain
accepted historical evidence; they are not rerun here. Automatic recovery after
reboot, actual reboot acceptance, long-term unattended continuity and unrelated
NOT_PROVEN statuses remain unchanged. No whole-system readiness claim is made.
Next business scope remains company billing details; no billing/Platform Admin work.

The adjacent source SHA-256 manifest covers the current reviewed implementation,
report and roadmap; the manifest itself is additional. Documentation will record
actual operator and UI results before the final review-ready manifest is finalized.

## Deploy preflight correction — qpdf socket activation

Operator v1 result: STOP / VERIFY / QPDF_SOCKET_NOT_LISTENING. This assertion
precedes PREPARE, backup creation and app stop/replacement. No deployment occurred.
Read-only systemctl confirmed the socket active/running, Accept=no, triggering
passvero-qpdf-acceptance.service; that service was active/running with PID 18487.
`ss -xlH` confirmed LISTEN on /run/passvero-qpdf-broker/validate.sock. The deployment
check incorrectly required SubState=listening even after socket activation.

Only the temporary deploy wrapper is corrected: active listening/running socket,
exact existing service trigger, Accept=no, and actual LISTEN socket are required.
Running socket additionally requires the expected active/running service with a
positive PID. Five isolated guard cases pass, including rejection of absent
listener, failed socket and running socket without its service. No qpdf config,
policy, resource limits, service restart, scan or database operation was performed.

v2 package: /home/darko/passvero-ui-finishing-1f43a09-v2. Checksum-file SHA-256:
`b628e4d9c2996fd31c6a3aaca81665ea7a2360dd16240d49c267917bc9363cc4`.
app.tar.gz, manifest.json, source-review.json, source.diff and rollback.py are
byte-identical to v1. Build and all 25 reviewed source/test files are unchanged;
local application tests/build are not repeated. Same planned rollback path.
The v2 handoff was PENDING_OPERATOR_COMMAND; the accepted result follows.

## Accepted staging deployment

The operator verified v2 checksums and returned deployment PASS for build
`kiXCpv3nqiz1u_K4f8Pbv`: all 1134 artifact files verified, HTTPS/TLS `200 0`,
startup error count 0, runtime configuration and scanners/broker/producer unchanged.
No production access or changes and no migration. The retained onboarding operator
hash matches. [Sanitized operator evidence](evidence/ui-finishing/20260923-deployment.json).

The confirmed deployment rollback is
`/var/lib/passvero-ui-finishing-1f43a09/application/rollback.py`, restoring previous
application build `qwLCXFTd9EEGdvqaB9SZS` and its messages/artifact metadata.

## Final bounded staging UI acceptance — PASS

Computer Use was restored; the user signed in to Passvero Acceptance. The actual
staging flow completed: dashboard → DPP → existing image public DPP → browser Back
→ all six languages → mobile checks → logout last. Login page was confirmed after
logout, with the transient disabled “Proszę czekać…” state observed.

- Desktop overview: total 9, overlapping cards 5 published / 5 draft; exclusive
  donut 4/4/1/0 and rounded 44%/44%/11%/0%. Counts remain authoritative (99% rounded
  sum is expected). Zero category remains in legend without a visible segment.
- DPP: five current publications; draft-only products absent, PVA-001 published
  version 4 included. Published/draft content separation, cross-tenant exclusion,
  archived/withdrawn restrictions and multi-page boundaries use the local query
  proof; they were not recreated by writing staging data.
- DPP refresh/direct loaded route and Back worked. DPP alone was active in the
  sidebar. The existing image public link opened successfully with the expected
  published name/version/image; large public image presentation is unchanged.
- HR, SR, EN, DE, SL and PL DPP views were inspected. Locale changes retained the
  route; supported published English translation and existing HR fallback were
  visible. Long German/Polish labels fit the desktop layout.
- Responsive viewport width 390 CSS px: vertical donut/legend, wrapping recent
  names, DPP rows/actions and language/logout controls without visible horizontal
  overflow. Polish long labels were inspected. Mobile menu opens, navigates and
  closes; Escape returns focus to Menu. Tab reaches the native language control
  with a visible blue focus ring. This is browser emulation, not a physical-device
  acceptance or an exhaustive screen-reader audit.
- Missing-image placeholders and the blue cover thumbnail were observed. Empty
  total, single-category distribution and failed-image handler are covered by
  local tests/source review; no live empty tenant or forced network failure.
- No business data changed. No upload/scan, CSV, PDF or recovery acceptance rerun.

Screenshots contain only application content with synthetic acceptance data;
Chrome profile/bookmarks/toolbars are excluded and the cropped files were reviewed:
[Desktop dashboard](evidence/ui-finishing/dashboard.png),
[DPP](evidence/ui-finishing/dpp.png),
[Mobile donut](evidence/ui-finishing/mobile.png),
[Mobile DPP/header](evidence/ui-finishing/mobile-dpp.png).

## Final source and evidence boundary

All 25 source/test files still match the deployed source-review SHA-256
`17f32ca16243bba31f9480d26b2a266ff93e87e5588f3d7391f29e13477aeebe`.
The final report, roadmap, sanitized deployment record and four screenshots are
post-build documentation/evidence, not changes to the executed artifact.
The adjacent manifest lists 32 files; the manifest itself is the 33rd changed file.
Final whitespace and manifest verification pass; index remains empty. No commit,
push, repeated build/test/deploy or service changes. Prior NOT_PROVEN statuses,
including reboot and long-term unattended recovery, remain unchanged.
