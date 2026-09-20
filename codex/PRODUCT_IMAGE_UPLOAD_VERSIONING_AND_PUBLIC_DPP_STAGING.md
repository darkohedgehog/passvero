# Product image upload, versioning and Public DPP staging

Base: `b223b109111f62e5f86ca720b887095ac42b2348`. No commit/push or production access.

## Contract and implementation plan

One main image in this UI; JPEG/PNG only. No gallery, crop editor, imports or AI.
Normalize with existing sharp 0.35.4 (no added dependency), reserve an immutable
asset, upload and verify exact bytes, then atomically attach under Product lock,
current draft CAS and minimized IMAGE_SET/IMAGE_REMOVE audit. Physical storage
operations never run inside a database transaction. A failed replacement retains
the previous image. Public delivery rechecks current publication after reading.

Limits: 8 MiB input/output; 8192 px per input side; 24,000,000 input pixels;
2048 px maximum output side without enlargement; two in-process concurrent
uploads/normalizations, 20s body/storage deadlines, 5s sharp processing timeout.
PNG control chunks reject APNG explicitly; JPEG/PNG magic precedes decoder use;
strict decoder errors, single-frame metadata, EXIF auto-orientation, sRGB output,
JPEG quality 85 or PNG compression 6. Default metadata removal strips EXIF/ICC/XMP.
Only normalized bytes are persisted. This is not a universal antivirus guarantee.
Existing Document PDF/scanner/broker/producer contracts remain unchanged.

References checked 2026-09-20:
- https://sharp.pixelplumbing.com/api-constructor/ (strict decode, pixel limits)
- https://sharp.pixelplumbing.com/api-output/ (metadata removal and timeout)
- https://supabase.com/docs/guides/storage/buckets/fundamentals (private buckets)

## Asset/version semantics and migration

`20260920180000_product_image_assets` renames the old ProductImage table to
ProductImageAsset, preserving the existing unique storage index (same index OID).
It creates version-owned ProductImage references with the original IDs, timestamps,
altText/caption/public/primary/sort metadata, copying every existing row. It does
not choose among or remove multiple primary images. Existing image assets become
LEGACY policy 0; no unverified bytes are relabelled normalized. They can be cloned
without copying storage, but the new transport delivers only READY policy 1.

New assets use PENDING -> READY or ABANDONED, with immutable tenant, storage
identity and byte metadata enforced by a database trigger. Reference triggers
reject foreign-tenant and non-ready/non-legacy assets; restrictive asset FK
prevents deletion while referenced. Cloning copies all associations, including
additional/private images, into the transaction that creates the draft. Historical
versions keep their original links and bytes. UI refuses ambiguous primary rows.
The existing temporary blanket cloning rejection is replaced by reference checks.

No automatic deletion of READY/LEGACY assets, even when currently unreferenced.
Only a successful locked PENDING -> ABANDONED transition with no references permits
exact-object failed-upload cleanup. An uncertain finalize commit never authorizes
removing a READY asset. Process crashes/cleanup failures retain durable pending or
abandoned asset identities for a separately bounded operator recovery. No TTL-only
or prefix cleanup. Retained historical assets are not orphans.

Migration preparation must inspect existing counts, asset/link preservation,
multiple primaries, owner/ACL, complete migration checksums and exact staging DB
identity. Back up before applying. Renaming a table transfers its privileges;
new ProductImage must retain the prior application's exact table privileges.
Migration/deploy must use a staging maintenance window because the old application
expects the old table columns. Stop staging app, apply reviewed migration, deploy
new build, verify. Never restore a database automatically after user writes.
Schema rollback requires explicit reconciliation/restore; old application artifact
alone is not a compatible rollback after this normalization migration.

## Delivery

Dedicated private `passvero-staging-images` bucket; existing server-only validated
Supabase credentials reused, no new credential files. Production untouched.
`POST/DELETE /api/products/:productId/image`: canonical proxy/origin, resolved
session, PRODUCT_EDIT, active DB membership/org, current draft and CAS.
Private GET/HEAD `/api/products/:productId/images/:imageId`: PRODUCT_READ and
current private/current published association in the trusted tenant.
Public GET/HEAD `/api/public/products/:publicCode/images/:imageId`: active product,
organization, passport and exact current PUBLISHED version, public primary link,
READY policy 1 asset. All responses no-store, nosniff, no ranges/ETags/304 or signed
redirects. Downloaded copies cannot be revoked. Next optimizer localPatterns allow
only `/marketing/**`, excluding these endpoints. Plain img intrinsic dimensions
preserve aspect ratio; no optimized protected images. Public DTO has only delivery
URL, alt text and dimensions; no storage key, filename or audit metadata.

## Local evidence and staging handoff

- 33 disposable PostgreSQL tests PASS, including legacy migration and role-grant
  preservation, same unique-index OID, schema-only rollback, image A/B/removal,
  version history, concurrency, uncertain commit, clone rollback, GTIN and
  manufacturer regressions. Cluster stopped. Log: passvero-image-postgresql-final.log.
- 74 focused application/public-DPP/normalization/clone/private-storage tests PASS. Strict TypeScript PASS.
- Wider app/infrastructure: 1107/1110; only the same three previously documented
  document presentation/runtime assertions fail. The affected source/test files
  are unchanged from the accepted GTIN commit. No unrelated repairs.
- Schema suite retained the 17 historical snapshot/allowlist failures. One new
  boundary assertion still prohibited any ProductImage UI; updated only that
  assertion for the authorized server-section handoff. Its focused suite passes.
- Lint: 0 errors, 15 existing warnings. Secret-free webpack build PASS (final
  build `uXHDuXfdNBCLINFdIWQ0m`). No dependency changes.
- Actual built Next optimizer request for public image endpoint: HTTP 400,
  `"url" parameter is not allowed`. Test server stopped.
- Chrome rendered the actual PublicDppDocument with a deterministic PNG at 320,
  375, 768, 1024, 1440 px: loaded image, preserved 3:2 aspect ratio, no horizontal
  overflow. All six locale previews loaded at 320 px. Viewport override reset.
  Authenticated editor and live staging flow passed after the runtime grant
  correction described below.

Operator package: `/private/tmp/passvero-image-staging-b223b10`.
Only the staging app is stopped for coordinated migration/deploy. The image bucket
is dedicated/private; no environment file, credential, scanner or producer edit.
Retain backup, previous artifact, source manifest and all image/audit evidence.
Rollback is explicit, never automatic: the tested schema-only rollback refuses
any normalized/pending/abandoned asset or cloned image reference, and the operator
wrapper checks original image-row digest. It preserves other domain tables and
storage bytes. If those guards fail, preserve the database and repair forward;
never restore the full backup over later writes.

Operator-reported staging migration/deployment PASS for build
`uXHDuXfdNBCLINFdIWQ0m`, reviewed source SHA-256
`701f8f1ed49c32680c6012775844ee8451c907efb511830fce0a5887e1b0f28e`.
Database identity: `passvero_acceptance`, port 5433,
`/var/lib/postgresql/16/acceptance`. Zero legacy rows; image rows, storage unique
index and owner/ACL preserved. Dedicated private bucket created. HTTPS 200;
runtime configuration/scanner/producer unchanged; production changes NONE.
Backup SHA-256: `9aabcc7bdf08139b22270925f4e703dff04e8e364af3dc0bd6ee90f91c5d6308`.
Exact sanitized operator report saved in the local package as
`operator-deployment-report.json`. Authenticated UI created one synthetic draft:
`2beb96a0-ac51-43d7-b626-ffcaebe01196`, SKU `DPP-IMAGE-20260920-01`, name
`SINTETIČKI TEST — SLIKA 20260920`. Retain this product and its audit. Initial browser file-access issue was resolved by the user.
The first submitted A upload then returned the UI operational-failure message
`Slika trenutačno nije dostupna. Pokušajte ponovno.` At that point no image preview or published
version existed. The read-only operator script
`diagnose-upload.py` in the local package checks exact staging build/database,
image table privileges, test-product references/recent tenant asset states and
private bucket settings without exposing credentials or changing data.
Operator diagnosis confirmed root cause: runtime role has SELECT only on both
image tables (INSERT/UPDATE/DELETE false). Test draft has zero image links and
no recent assets; no failed-upload orphan exists. Private bucket returned HTTP
200, public=false, JPEG/PNG allowlist and 8388608 byte limit.

Prepared staging-only `grant-image-runtime.py`: grant INSERT/UPDATE/DELETE on
ProductImage and INSERT/UPDATE on ProductImageAsset to the exact live business
DB role. No asset DELETE, TRUNCATE, schema-wide grants, ownership, auth-role or
production changes. Applied migration bytes and build remain unchanged. Existing
ACL preservation was correct but insufficient for the newly enabled write path;
deployment readiness must additionally verify these effective runtime privileges.
Script verifies host/build/DB/role and exact baseline rights, retains a root-only
pre-change record, verifies resulting rights, and supports explicit `--rollback`
which revokes only these additions while preserving data and SELECT. No restart.
Local disposable PostgreSQL proof passed baseline denial, minimal DML, absence of
asset DELETE/TRUNCATE and rollback to SELECT; cluster stopped at
`/private/tmp/passvero-image-acl-proof-a102f_z0`. Application suites/build are
unchanged and were not repeated. Operator confirmed staging grants PASS; retry of A and the remaining live
flow passed without a new deployment.

Retained evidence fixtures: synthetic red PNG A,
blue JPEG B and invalid PNG-named text under `/private/tmp/passvero-image-ui`.
No commit/push. Next roadmap slices remain search, CSV export and CSV import.

PRODUCT_IMAGE_SOURCE_IMPLEMENTATION=COMPLETE
PRODUCT_IMAGE_STAGING_UPLOAD=PASS
PRODUCT_IMAGE_PUBLIC_DPP=PASS
PRODUCT_IMAGE_DRAFT_ACCESS_DENIED=PASS
PRODUCT_IMAGE_VERSION_CLONING=PASS
PUBLISHED_IMAGE_IMMUTABILITY=PASS
IMAGE_VALIDATION_AND_NORMALIZATION_LOCAL=PASS
IMAGE_ASSET_REFERENCE_INTEGRITY=PASS
STAGING_TEST_DATA_CLEANUP=EXPLICIT_RETENTION
PRODUCTION_CHANGES=NONE

## Live image flow after runtime grant correction

Operator applied minimal runtime grants successfully, no restart/data/production
changes. Same build `uXHDuXfdNBCLINFdIWQ0m`. Retried A on the existing product:
private image loaded 480x320; anonymous private GET returned 403. Published V1;
public A returned 200. New draft inherited A with a new association. Replaced
with B; public V1 still returned identical A bytes. Invalid PNG-named text was
rejected with the validation message; reloaded editor retained B (320x480).
Published V2; same public URL shows B/version 2, anonymous B GET 200; old public
A link now 404. No new product or extra draft created for the negative test.

Public URL: https://staging.passvero.eu/p/Toife7Tdl9baRE49d9W2nw
V1 image association: `e40812c5-ece6-4b3c-b139-82a2346f256e`.
V2 image association (inherited then replaced): `f749772c-f909-4504-a72b-f839d35501eb`.
A SHA-256: `51dd677743759c78316611044edf4cdaa524d2030f2de2d43c0888d0f25aa362`.
B SHA-256: `87a8da88e06291cafd523339d437d0cc57244e0f1e21ecf7d2e1666048acb354`.
Responses: private/no-store/max-age=0, CDN no-store, nosniff, no ranges.
HTTP evidence retained in local staging package. Operator `verify-image-history.py`
returned historical_image_acceptance=PASS: V1 SUPERSEDED retains READY policy-1
asset `3de2218b-aa87-458f-b971-1df1e1b31ccf`; V2 PUBLISHED uses READY policy-1
asset `2b7f5320-3922-4fd1-ac4e-214571ab0c8c`. Both stored byte checksums match
the independently downloaded public bytes above; both references have matching
organization ownership. Counts: 2 assets, 0 unreferenced assets, 2 IMAGE_SET
audits. This is operator-provided staging DB/private-storage evidence.
Retain synthetic product, both versions/assets and audit. No cleanup deletion
has occurred. No commit, push, additional deploy or production changes.
