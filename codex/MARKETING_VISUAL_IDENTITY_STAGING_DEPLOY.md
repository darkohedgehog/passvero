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
