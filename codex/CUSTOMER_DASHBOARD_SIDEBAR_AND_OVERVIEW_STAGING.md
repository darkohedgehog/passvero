# CUSTOMER_DASHBOARD_SIDEBAR_AND_OVERVIEW_STAGING

2026-09-23 checkpoint. Base `889f78d1d01f13107dbdc4aa1edf567a1bab5a5d`, branch
`main`; initial worktree/index clean. No commit/push. Local implementation and
checks complete; staging deployment and the bounded UI acceptance below completed.
Scanner operational readiness remains NOT_READY.

## UI and data definitions

Shared dashboard layout keeps a fixed 256px navy sidebar on all dashboard routes,
including product subroutes and loading boundaries. Only Overview and Products
are linked; product subroutes mark Products active. Native modal dialog on mobile
supports keyboard/Escape, focus return, route-change close and desktop-resize close.
Existing inverse BrandLogo avoids a white background. Compact page header preserves
organization, language selector and sign-out; no duplicate header/navigation.
Public, marketing and auth routes are outside this layout.

Server resolver remains authoritative. PRODUCT_READ and ACTIVE membership required
before querying. One RepeatableRead snapshot aggregates the whole tenant catalog
and selects at most five recent products. No shared data cache and no browser counting.
Both ACTIVE and ARCHIVED are included, matching the unfiltered catalog; archived
count and recent-row label are explicit. Current version pointers define cards:
- total: all organization products;
- published: current published pointer;
- draft: current draft pointer, including READY_FOR_REVIEW;
- exclusive distribution: draft only, published only, both, neither.

Pointer ownership and expected statuses are checked; invalid relationships fail
closed. Load errors render unavailable, never zero. Recent products use
Product.updatedAt DESC, id DESC; not an audit stream or a promise that every child
edit updates the parent. Images prefer the current draft, otherwise current
published version, and only one unambiguous primary image; existing authenticated
`/api/products/:productId/images/:imageId` delivery rechecks access. No storage URL.

New-product action requires PRODUCT_CREATE; CSV import requires CREATE+EDIT;
export requires READ. CSV actions navigate to the existing catalog controls;
`?action=import#catalog-import` opens the existing import disclosure, export anchors
the existing export control. Import/export logic and API authorization unchanged.

Reference used for navy sidebar/composition/hierarchy, not for fabricated metrics,
new navigation entries or analytics. Existing product editor component code unchanged.
No migrations, permission changes, billing, Platform Admin, scanner or producer work.

## Local evidence

- Five new unit/presentation tests PASS: permission-before-read, tenant rejection,
  overlapping cards and exclusive categories, error vs zero, Viewer actions,
  escaping/private image route, nav boundaries and six matching label contracts.
- Relevant regression batch: 83 tests, initially 7 obsolete header assertions;
  six were updated for intentional identity-card removal; route composition uses
  runtime persistence factory. Affected 23 tests re-run: all PASS; other 60 unchanged PASS.
- Dedicated disposable PostgreSQL harness PASS: 31-product tenant (beyond first
  catalog page), 20 published/20 drafts, exclusive categories 10/10/10/1; other
  tenant, empty tenant, archive, recent limit/order and cross-tenant pointer rejection.
  Temporary cluster stopped. No shared/staging/production DB touched for this proof.
- TypeScript PASS; full lint 0 errors, 15 prior warnings plus private-image warning,
  now explicitly exempted because authenticated images bypass the optimizer;
  final scoped lint PASS. Build webpack PASS: `qwLCXFTd9EEGdvqaB9SZS`.
- Local real-component synthetic fixture: 1440px desktop, 390px menu, DE 320px full
  page without observed overflow; Escape and visible focus return verified.
  Synthetic browser fixture is not staging data proof.
- Prior unrelated PDF assertion failures and historical NOT_PROVEN states retained;
  no repeated scanner, CSV mutation/export or publication acceptance.

## Staging preparation

Previous accepted build `U97P6q7YqVzFHSNqoWAT9`. Root preflight checks its installed
hashes against the current deployment manifest before replacing anything.
Package `/tmp/passvero-dashboard-ui-889f78d`; only `.next` and six message catalogs
are replaced. Existing operator module remains SHA-256
`caac6bbc4fe5604c23837527c65aff1e35717580d7c079f7002f08406c87eda5`.
Operator runtime artifact metadata is synchronized and backed up, without CLI edits.
Rollback `/var/lib/passvero-dashboard-ui-889f78d/application/rollback.py` restores
previous `.next`, messages and artifact metadata, retaining database/application data.
Only staging app restart; no scanner/producer/configuration changes.

Independent comparison script uses the existing staging runtime database principal,
explicit READ ONLY transaction and a bounded separate raw-row calculation for
`Passvero Acceptance`, the organization observed in the authenticated browser.
It emits only organization/product evidence and counts; no credentials/session values.
No new staging data was created; no form was saved during this acceptance.


## Final staging evidence — authorized fail-closed scanner deployment

Operator deployment PASS: build `qwLCXFTd9EEGdvqaB9SZS`, 1123 artifact files verified,
zero startup errors, HTTPS `200`, TLS verification `0`. Retained operator hash and
runtime configuration unchanged. Only staging application restarted. Dedicated
`pm2-passvero-staging.service` and scanner/updater/qpdf configuration preserved.

Independent READ ONLY comparison for Passvero Acceptance: total 9, published 5,
draft 5, archived 0; exclusive categories 4 draft-only / 4 published-only / 1 both /
0 neither. Browser cards, category counts and five recent product identities/order
match. No claim of live large-catalog or cross-tenant testing; those proofs are local.

Browser acceptance in Chrome:
- Existing authenticated session opens overview; login endpoint HTTPS availability
  confirmed by recovery operator. Fresh credential entry/login was not repeated.
- Desktop overview → catalog → synthetic product details → basic editor, then
  refresh, browser Back and sidebar return to overview succeeded. Sidebar remains
  visible and Products active on editor. Direct dashboard URLs load successfully.
- HR/EN/DE/SR/SL/PL overview routes loaded with translated labels and 9/5/5 counts.
  Full-page HR and DE mobile screenshots reviewed; other four received a rendered
  mobile overview/label check, not an exhaustive locale-by-breakpoint matrix.
- 390px mobile layout wraps long product names and actions without observed clipping.
  Menu opens/closes; Tab traverses dialog controls, Escape returns focus to its
  trigger, keyboard navigation to catalog closes it. Earlier local 320px DE,
  desktop/breakpoint and focus evidence retained.
- No CSV, upload, PDF, scan, publication or data-mutation acceptance repeated.
  Browser emitted font-preload warnings; no blocking UI error observed.

### Security and operational boundaries

Exactly one staging health-provider read under `passvero-staging` returned
`REJECTED`, without scan or database write. This confirms rejection of the current
unavailable proof, not scanner operational success. Existing unchanged code and
accepted tests cover missing, expired and untrusted evidence: reader returns null;
`scan-document.ts` returns SIGNATURES_UNTRUSTED before scanner invocation, and also
rejects absent/changed evidence after scanning. Tests referenced:
`signature-health-reader.test.ts` and `document-scan.test.ts` (missing health skips
scanner; freshness boundary; changed provenance discards verdict). Not rerun here.

- Recovered staging runtime: PASS; previous build preserved by dashboard rollback.
- Producer recovery: BLOCKED; no trust-recovery work performed in this deployment.
- Malware scanning operational readiness: NOT_READY.
- Reboot acceptance: NOT_PROVEN; enabled/active startup is not a reboot test.
- Historical PDF test failures and all unrelated NOT_PROVEN statuses preserved.

### Artifact linkage and final files

Original reviewed source: 21 files, source-review SHA-256
`fb74e2ce37e8d216bd3fdf61afaf230dbea72393a338a826aaad3c2a8209d86d`.
Original package checksum-manifest SHA-256:
`2da3590fe0f59fee14958bf5378b3b293657a2dbc245a3dcf648be886164bb70`.
Separate operator resume package checksum-manifest SHA-256:
`a7c3cddf08257aea2f7dd23a0446944cf486189e6a41b07554a8a543f696dae3`.
Its reviewed deploy adaptation recognizes an idle socket-activated qpdf service,
requires a listening socket, and preserves the enabled staging startup service.
It introduces no scanner bypass or application-source change.

The 19 implementation/translation/test files remain byte-identical to the reviewed
source. This report and IMPLEMENTATION_ROADMAP.md are final documentation updates;
the recovery report and four PNG screenshots are additional evidence, not deployed
application content. Final manifest: CUSTOMER_DASHBOARD_SIDEBAR_AND_OVERVIEW_STAGING.sha256
(26 entries; manifest excludes itself). No temporary bundles or secrets included.

Dashboard rollback: `/var/lib/passvero-dashboard-ui-889f78d/application/rollback.py`
restores `U97P6q7YqVzFHSNqoWAT9`, messages and metadata while preserving startup
configuration and data. Startup-only rollback is separately recorded in the
post-reboot recovery report and must not be confused with dashboard rollback.

Screenshots (full-page capture; fixed sidebar ends at viewport height in the image):
- [Desktop overview](evidence/dashboard-889f78d/passvero-staging-dashboard.png)
- [Editor with sidebar](evidence/dashboard-889f78d/passvero-staging-editor.png)
- [Mobile overview](evidence/dashboard-889f78d/passvero-staging-mobile.png)
- [German mobile overview](evidence/dashboard-889f78d/passvero-staging-de-mobile.png)
