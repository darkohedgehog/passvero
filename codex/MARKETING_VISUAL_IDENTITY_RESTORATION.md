# Marketing visual identity restoration — local review, 2026-10-12

Status: USER_VISUAL_APPROVED_LOCAL_ONLY. User approved the restored design on
2026-10-12: “Odobravam dizajn.” This approval covers the reviewed local visual result.
No deploy,
VPS operation, backup repin/acceptance replay, production change, commit or push.
HEAD remains5dba99b474d5fabbabc75855f15c912bb9c4b8c6 (backup commit only).
The marketing changes have not been committed/pushed; no Git history rewritten.
Previous automated staging visual checks did not constitute user acceptance.

## Restored composition and accurate imagery

Hero retains text left and a large navy passport/phone/QR composition right, original
0.92fr/1.08fr grid, sizes, typography, palette/background and responsive stacking.
Restore original feature-row lg:-mt-28 offset (replacement had lg:-mt-12). Restore
localized noun emphasis so confirmed digital title starts in navy and passport noun
continues in teal; remove forced anywhere wrapping. Preserve min-width overflow guard.
Generic HTML illustration cards removed; rendering uses next/image again.

Workspace retains original0.62fr/1.38fr grid, large laptop illustration, white rounded
container, soft shadow/blue glow and mix-blend-multiply treatment. Existing description,
feature claims and localized request-access CTA unchanged in both sections.

Two new sibling assets preserve originals:

- public/marketing/hero-passport-restored.png (1019x1544, alpha): replaces old phone
  verification/garbled claims and Scan to verify wording with actual public DPP UI
  and View product passport; navy passport/globe metaphor and QR card retained.
- public/marketing/dashboard-preview-restored.png (1619x972): replaces old Scans,
  Analytics, Complete100% and fabricated large counters/sidebar with existing
  DashboardOverviewPanel:4 products,2 published,2 draft, existing quick actions and
  product-state distribution. This chart exists in the dashboard and is not scan
  analytics. No new certified/Verified capability implied.

Imagegen edited the original local PNG references using synthetic screenshots as
explicit screen inputs. Screenshots were rendered from existing DashboardOverviewPanel
and PublicDppDocument with typed synthetic fixtures; no persistence/auth calls.
Example workshop, Oak chair and the fixed sample date are fictional presentation
data, not account/test data inserted into the app. Phone chair is a synthetic SVG
image rendered through the existing public image field. UI screens use English,
matching the prior shared illustrative asset convention; labels/alt text are localized.
QR is an illustrative graphic, not an accepted functional scan workflow.
Discreet illustrative labels remain; whole illustrations are physical device mockups.

## Preserved content and exact scope

Compare against the reconstructed pre-task source whose12 hashes match the immutable
reviewed-package source manifest. In each of6 message files, only Hero.highlight
changed. The entire approved title and every other key remain byte/structure-equivalent
for this task. Start/Business/Pro/Custom pricing,3/12-month periods/quotas, trial/manual
B2B contract, accurate capability/privacy statements and CTA routes preserved.
Pricing/compliance/about/contact source unchanged against pre-task reviewed hashes.
Original marketing assets and separate legal draft untouched.

Executable scope:2 marketing components,6 Hero.highlight locale edits,2 new PNGs.
[Visual-only text diff](evidence/marketing-visual-restoration-20261012/visual-restoration-only.diff)
is relative to the pre-task marketing source, not HEAD, so it does not mix earlier
commercial corrections into this restoration.
[Exact manifest](evidence/marketing-visual-restoration-20261012/visual-restoration-manifest.json)
records before/after hashes, new assets, documentation and outside-repo screenshots.
Historical pricing deploy report/manifest and roadmap updated to make user-review
gate explicit; old technical runtime evidence remains historical and unmodified.

## Limited local verification

[Results](evidence/marketing-visual-restoration-20261012/local-visual-checks.json):18
views for hr/sr/en/de/sl/pl at1440x1100,375x812 and320x812, scoped only to hero/laptop
images, confirmed heading/emphasis, overflow and unchanged CTA hrefs. PASS: no
horizontal overflow or console/page errors, both images decode and render.
24 local section screenshots (desktop/mobile,6 locales) stored outside repository
in /tmp/passvero-visual-restoration-20261012, hashes in manifest. Final4 HR captures
hide only the Next dev badge in browser CSS. User sees product composition, not a
placeholder. ESLint and isolated TypeScript includes for the2 components PASS;
JSON/content/hash/link/whitespace checks PASS. No general tests or application build.

Preview is an explicit app/src/messages/public copy in /tmp/passvero-visual-preview-20261012
with existing node_modules, no env files. BETTER_AUTH_URL=https://preview.invalid is
only a process metadata origin; browser uses127.0.0.1:3139 and blocks all external or
non-read-only requests. Original .next and accepted archive unchanged.

User visual acceptance is confirmed for the restored local composition and imagery.
Do not deploy/repackage/repin/commit/push this source until the next authorized phase.
This current source differs from the historical staging853RYrj-r5cyoSGuJudap package.
New public PNG files must be explicit executable members of any future reviewed
package/manifest; do not reuse the old .next/messages-only package for this diff.

USER_VISUAL_APPROVED_LOCAL_ONLY

## Subsequent separately authorized staging phase

User subsequently authorized deployment (“Možeš uraditi deploy”). The approved local
design is now deployed and read-only staging checks PASS in the separate
[deployment completion report](MARKETING_VISUAL_IDENTITY_STAGING_DEPLOY.md).
The local-only boundaries above describe the original restoration phase; this later
phase changes only the exact approved staging release and two backup identity pins.
No commit/push or production change; legal draft remains excluded.
