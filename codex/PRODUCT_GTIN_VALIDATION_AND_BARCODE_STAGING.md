# GTIN validation and barcode — bounded staging implementation

Base: `97199377c07dbe6eff4d2584d6c3be89cdcc9981`; uncommitted source diff.
User-approved contract: one optional GTIN per ProductVersion, identifying the
concrete trade item described by this product/DPP. Packaging/variant modeling
is excluded. Other identifier types retain their existing cardinality.

## Input and identity contract

- Store the exact ASCII digit string, including leading zeroes. Length: 8, 12,
  13 or 14. Reject all whitespace, signs, separators and non-ASCII digits; no trim.
- The last digit must equal `(10 - weightedSum % 10) % 10`; starting at the
  rightmost data digit, weights alternate 3, 1. No number generation/allocation.
- Compare equivalent representations using left zero-padding to 14 digits.
  An equivalent representation replaces the same slot, preserving the newly
  entered length; it cannot become a second identifier. No cross-product,
  cross-tenant or historical-version uniqueness.
- SET adds/replaces; REMOVE clears only the current editable draft. Product row
  lock, current pointer, product/draft CAS, active membership/organization,
  PRODUCT_EDIT and atomic minimal audit are required. GET requires PRODUCT_READ.
  HTTP uses the existing canonical-origin/proxy/session boundary and bounded JSON.
- `issuingAuthority` is not accepted from users and is cleared on SET. No GS1
  registration, ownership, registry, account or external lookup is performed.
- Published/superseded versions remain unchanged. The existing explicit identifier
  cloning allowlist already copies GTIN into a fresh draft. Publication/QR identity
  is unchanged and no GTIN requirement or automatic backfill is introduced.

## Sources and barcode contract

Official sources reviewed 2026-09-20:

- [GS1 check digit calculation](https://www.gs1.org/services/how-calculate-check-digit-manually):
  alternating weights and official GTIN-13 example `6291041500213`.
- [GS1 retail implementation guideline, table 4-2](https://ref.gs1.org/guidelines/2d-in-retail/):
  lengths, zero-padding, EAN-8 `95200002`, UPC-A `012345000058`, and EAN-13 mapping.
- [GS1 communicating item numbers](https://www.gs1.org/edi-xml/technical-user-guide/Item_Numbers):
  14-character zero-padded representation for comparing shorter formats.
- [GS1 ITF-14 support](https://support.gs1.org/support/solutions/articles/43000734528-what-type-of-gtin-can-be-encoded-in-itf-14-):
  ITF-14 carries 14 digits, including padded shorter GTINs.
- [GS1 example](https://ref.gs1.org/standards/digital-link/uri-syntax/1.7.0/):
  `09520123456788` is a published 14-character example. Only the example is used;
  no Digital Link implementation is added.

Mapping by supplied length: 8 → EAN-8; 12 → UPC-A; 13 → EAN-13;
14 → ITF-14. A padded representation is still displayed exactly as supplied.
ITF-14 is not a retail POS certification. No generic Code 128 substitution.

`bwip-js@4.11.4` (MIT, including its distributed upstream license notices) is the
only added runtime dependency, with no transitive npm dependencies. Existing
`qrcode` cannot render these linear symbols. [Maintainer documentation](https://github.com/metafloor/bwip-js)
confirms the maintained renderer and SVG interface. It is used through the Node
entry point, only in server presentation. Webpack bundles it into the artifact;
no external bwip-js files appear in Next output tracing.

Black bars on white, intrinsic SVG proportions, renderer defaults for symbol
geometry, plus 16-point horizontal/8-point vertical padding at scale 2. The image
shrinks proportionally to its container; number remains text with an accessible
image label. No GTIN is sent to a rendering API. QR remains the DPP link.

Public DTO exposes a GTIN string or null, from the current PUBLISHED version only.
No issuingAuthority, notes, identifier IDs, tenant IDs or audit data are selected.
Ambiguous or invalid legacy GTIN content fails closed; no silent repair. Private
editor permits correcting a single invalid legacy value. Missing GTIN renders
no barcode and does not prevent publication. Copy is provided in hr/en/de/sr/sl/pl.

## Migration and rollback

`20260920120000_one_gtin_per_version/migration.sql` performs only:

1. A transaction and ProductIdentifier write lock.
2. An explicit duplicate-version check; abort on any count above one.
3. `CREATE UNIQUE INDEX ux_product_identifier_one_gtin_per_version ON
   ProductIdentifier(productVersionId) WHERE type = 'GTIN'`.

No generic `(productVersionId,type)` unique, table/column changes, deletion,
backfill, grants, RLS changes or CN modifications. Existing migration bytes are
unchanged. A pre-deploy read-only duplicate query is also required:

```sql
SELECT "productVersionId", count(*) AS gtin_count
FROM "ProductIdentifier" WHERE type = 'GTIN'
GROUP BY "productVersionId" HAVING count(*) > 1;
```

If any exist: stop and ask for an explicit data decision; never choose or delete
one. The migration repeats the check under its lock to close the race.

Staging only: port 5433, database passvero_acceptance, data directory
/var/lib/postgresql/16/acceptance. Operator script must assert this exact identity,
all previous migration hashes, no failed migrations, and exactly one pending
migration before `prisma migrate deploy`. Root-only custom pg_dump plus validated
archive listing precedes the single deploy attempt. Application stays running
while the bounded index migration takes its lock; 5s lock/30s statement timeouts
abort rather than wait indefinitely. Failure is STOP, not automatic retry.

Application rollback restores the previous `.next` and messages artifacts.
Leave the index, entered GTINs and audit intact. Removing the index would reopen
multiple-GTIN writes and requires a separate decision. Restoring the database
backup would lose writes after the backup and is not an automatic rollback.
No production database, scanner or producer infrastructure is modified.

## Evidence so far

- Validation, CN regression, public DTO/persistence/HTTP, barcode: targeted tests
  PASS: 76 focused tests.
- Disposable PostgreSQL: 18 integration tests PASS, including real concurrent
  service CAS and direct inserts, cross-tenant and revoked permissions, rollback,
  clone/publish/history and stable DPP identity, optional removal and unchanged
  CUSTOM/CN cardinality. Non-superuser application role. Empty/populated migration
  PASS; duplicate migration abort preserved both existing values. Cluster stopped.
- Independent ZXing `@zxing/library@0.21.3`, installed only under /private/tmp:
  rendered SVG → sharp grayscale pixels → decoder. All four expected numbers and
  EAN-8/UPC-A/EAN-13/ITF formats PASS. This is software decode of generated images,
  not physical scanning, print verification or certification.
- Secret-free staging-origin webpack build PASS: `wgtuXd933MYwDwiVUjVt4`.
  TypeScript PASS; lint 0 errors, 15 pre-existing warnings.
- Full application/infrastructure run: 1090/1093 PASS before the final eight
  added assertions. Three pre-existing failures reproduced on base:
  document-attachments-presentation (editor copy and form copy), and
  document-scan-runtime (outdated source import assertion).
- Static schema/boundary suite: 272/289 PASS. All 17 failure names reproduced
  on the base archive: 13 historical model/enum count assertions, generated
  Prisma adapter allowlist, document-runtime boundary, Public DPP boundary and
  locale key-count assertion. Base archive has three extra git-context failures
  because it is not a checkout. No unrelated test repair is included.
- Actual Public DPP HTML inspected in desktop Chrome with GTIN-14 and barcode.
  Staging editor/public desktop flow also passed below. Mobile visual testing was not performed.

## Staging deployment evidence

Operator output confirms migration PASS in one attempt, zero duplicate versions,
GTIN rows and owner/ACL unchanged; Prisma UP_TO_DATE on passvero_acceptance:5433,
data directory /var/lib/postgresql/16/acceptance. Backup:
`/var/lib/passvero-gtin-deploy-9719937/migration/staging-before.dump`, SHA-256
`1a0ecd177fab5e6e2f75c0d69f20cb00bf5442208d02e3ecc3e981a03874cafc`.

Application deployment PASS: `wgtuXd933MYwDwiVUjVt4`, 648 artifact files verified,
38 reviewed source files, review SHA-256
`e5f92d757683bbd77fee7b11d216afdca9a03f08e34058778dd976704fe7fc97`.
Staging HTTPS 200/TLS 0; zero startup errors. Runtime configuration and
scanner/broker/producer unchanged. No production access or changes.
Rollback: `/var/lib/passvero-gtin-deploy-9719937/application/rollback.py`.
Existing NEW_HANDOFF_RUNTIME_ISOLATION=NOT_PROVEN remains unchanged.
Only evidence documentation changes after the deployed source review.

## Staging acceptance and retention

UI acceptance PASS on 2026-09-20 using the authenticated staging application:

1. Created synthetic `SINTETIČKI TEST — GTIN 20260920`, SKU
   `DPP-GTIN-20260920-01`, product ID `45ad6142-69d3-4a46-aeba-9902b3f9c756`.
2. Saved `012345000058` with its leading zero. Invalid check digit
   `012345000059` produced the localized validation error; reload showed the
   original saved value unchanged.
3. Published V1. Anonymous HTTP retrieval showed the number and barcode.
4. Created a draft through Uredi proizvod; its field inherited `012345000058`.
   Replaced it with `6291041500213`. Published section and anonymous public
   response still showed the original V1 number and barcode, without draft GTIN.
5. Published V2; UI showed version 2, no remaining draft and the new number.
   Anonymous response and desktop Chrome Public DPP showed the new barcode.
   Both versions used the same public URL:
   https://staging.passvero.eu/p/QybqFARtYhGvUEt0JtZjEw
6. Independently decoded SVG images extracted from anonymous V1, during-draft,
   and V2 HTML using ZXing: exact expected UPC-A, UPC-A, EAN-13 values PASS.

Version history preservation after V2 is proven by the real local PostgreSQL
integration test. Live evidence proves V1 isolation during draft editing and
V2 publication at the stable URL; historical staging database rows were not
separately queried. QR activation was not needed or changed.

Retain this synthetic product, V1/V2 and their audit. No cleanup/deletion was
performed; PVA-001 and manufacturer acceptance products were not changed.
Examples do not assert GS1 assignment to the user. Local disposable data remains
in the stopped temporary cluster. Anonymous HTML snapshots, live-public-evidence.json,
operator reports, build and review artifacts remain under
`/private/tmp/passvero-gtin-staging-9719937` (temporary handoff storage).
No physical scan, print certification or mobile visual acceptance is claimed.
No commit/push.

GTIN_SOURCE_IMPLEMENTATION=COMPLETE_STAGING_DEPLOYED
GTIN_VALIDATION_LOCAL=PASS
GTIN_STAGING_UI=PASS
GTIN_PUBLIC_DPP=PASS_ANONYMOUS_STAGING
GTIN_VERSION_IMMUTABILITY=PASS_LOCAL_DB_AND_LIVE_DRAFT_ISOLATION
BARCODE_RENDERING=PASS_STAGING
BARCODE_INDEPENDENT_DECODE=PASS_LOCAL_ALL_FOUR_AND_LIVE_V1_V2_SOFTWARE_ONLY
GS1_REGISTRY_VERIFICATION=NOT_PERFORMED
PRODUCTION_CHANGES=NONE

## Final commit review (2026-09-20)

HEAD verified as `97199377c07dbe6eff4d2584d6c3be89cdcc9981` before staging.
All 38 accepted files matched final-source-review.json before this evidence update.
Runtime source, dependency lock, messages and migration match the accepted build
`wgtuXd933MYwDwiVUjVt4`. Build-copy differences are documentation, eight final
focused tests, and the independent decode proof; no application-code difference.
Final focused log covers those tests: 76/76 PASS. Standalone `npx tsc --noEmit`
was repeated at the commit gate (exit 0) because the saved build predates those
final test additions. Existing `npm run lint`: 0 errors/15 pre-existing warnings;
secret-free `next build --webpack`: PASS including TypeScript and 102 static pages.
Existing 18-test disposable PostgreSQL proof and accepted migration/deploy operator
reports are retained; no database or live acceptance was repeated for this commit.

Migration re-review: transaction plus write-excluding table lock closes the
precheck/index race; duplicates abort before changes; partial unique index covers
only GTIN per version. No data deletion, global uniqueness, grants or other
identifier cardinality changes. No unresolved task regression identified.
The existing manual QA limits (including mobile/viewport matrix not performed)
remain explicitly recorded; this commit does not expand the accepted UI evidence.

Post-deploy documentation changes: IMPLEMENTATION_ROADMAP.md records acceptance;
this document records live evidence and this commit review. The new
GTIN_BARCODE_COMMIT_MANIFEST.json preserves the exact 38-file list and SHA-256
hashes, plus evidence-log hashes and deployed identity. The manifest excludes its
own bytes to avoid a recursive hash; Git records that 39th documentation file.
No secrets, temporary build files, raw HTML or unrelated files are included.

### Existing broader-test failures (not rerun)

Each title below appears in both implementation and isolated clean-base logs.
The baseline failure-bearing test files were checked byte-for-byte against Git
base blobs at this gate. The three additional failures in the base schema archive
are Git-context tests (the archive has no .git); they are not implementation failures.

| Test location | Exact failing test | Existing baseline evidence |
|---|---|---|
| `tests/application/document-attachments-presentation.test.ts:2:3136` | editor sees bounded draft management with honest public-intent wording | `passvero-gtin-base-targeted.log` |
| `tests/application/document-attachments-presentation.test.ts:2:4585` | new attachment form has explicit unchecked public intent and all labeled inputs | `passvero-gtin-base-targeted.log` |
| `tests/infrastructure/document-scan-runtime.test.ts:2:5826` | missing config and constructor errors are normalized without accessing other runtimes | `passvero-gtin-base-targeted.log` |
| `tests/audit-log-schema.test.mjs:34:1` | Phase 4 adds only AuditLog and no enum | `passvero-gtin-base-schema.log` |
| `tests/background-job-schema.test.mjs:34:1` | Phase 6C adds exactly BackgroundJob and its two approved enums | `passvero-gtin-base-schema.log` |
| `tests/create-product-boundaries.test.mjs:61:1` | keeps generated Prisma access inside approved infrastructure adapters | `passvero-gtin-base-schema.log` |
| `tests/document-assets-boundaries.test.mjs:11:1` | document runtime owns secret reads behind server-only; no client or public DPP dependency | `passvero-gtin-base-schema.log` |
| `tests/document-schema.test.mjs:34:1` | Phase 2C.1 retains Document and DocumentStatus | `passvero-gtin-base-schema.log` |
| `tests/integration-mapping-schema.test.mjs:34:1` | Phase 6B adds exactly IntegrationMapping and its approved status enum | `passvero-gtin-base-schema.log` |
| `tests/notification-schema.test.mjs:34:1` | Phase 6A adds exactly Notification and its two approved enums | `passvero-gtin-base-schema.log` |
| `tests/plan-schema.test.mjs:34:1` | Phase 5A retains Plan and PlanStatus | `passvero-gtin-base-schema.log` |
| `tests/product-document-schema.test.mjs:34:1` | Phase 2C.2 adds only ProductDocument and no enum | `passvero-gtin-base-schema.log` |
| `tests/product-identifier-schema.test.mjs:43:1` | Phase 2B.2 retains ProductIdentifier and ProductIdentifierType | `passvero-gtin-base-schema.log` |
| `tests/product-image-schema.test.mjs:34:1` | Phase 2C.3 adds only ProductImage and no enum | `passvero-gtin-base-schema.log` |
| `tests/product-material-schema.test.mjs:33:1` | Phase 2B.3 retains ProductMaterial without a ProductMaterial enum | `passvero-gtin-base-schema.log` |
| `tests/public-dpp-boundaries.test.mjs:30:1` | keeps Prisma and environment access in server-only infrastructure | `passvero-gtin-base-schema.log` |
| `tests/public-dpp-boundaries.test.mjs:51:1` | all six locales expose the same complete PublicDpp message contract | `passvero-gtin-base-schema.log` |
| `tests/qr-code-schema.test.mjs:34:1` | Phase 2D adds only QRCode and QRCodeStatus | `passvero-gtin-base-schema.log` |
| `tests/scan-event-schema.test.mjs:34:1` | Phase 3 adds only ScanEvent and the two approved enums | `passvero-gtin-base-schema.log` |
| `tests/subscription-schema.test.mjs:34:1` | Phase 5B adds only Subscription and its two approved enums | `passvero-gtin-base-schema.log` |

Full log files are retained in `/private/tmp`; their hashes are preserved in the commit manifest. Broader suites remain 1090/1093 and 272/289, not all-green.
