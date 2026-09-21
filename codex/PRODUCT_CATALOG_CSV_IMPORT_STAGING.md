# Product catalog CSV import — create-only v1

Source base: `33adf1cfbc443ad2980df13ead995a27ea00feb5` (clean before work).
Source is uncommitted. Built locally: `bO73SDxjxPBddEzd4Q2nd`.
Previous accepted staging build: `1jeAIT6a93SlibJBd8Wm0` (CSV export).
Staging migration/deployment operator reports PASS; actual small UI import acceptance PASS.

## Format and scope

Maintained `csv-parse` 7.0.2 is the single exact new dependency: no existing parser
was installed; quoted fields/newlines require a real parser. UTF-8 with/without
BOM, explicit comma/semicolon delimiter, escaped quotes and embedded newlines.
Limits: 20 MiB, 10,000 data records, 64 columns, 4,096 characters/cell, 32,768
parser record buffer; unique nonempty headers up to 128 characters. Domain field
limits also apply. Invalid encoding, NUL, malformed structure and excess rejected.
100 detailed validation error codes maximum; accurate total error count and
per-row invalid/conflict flags remain. Preview UI shows 50 rows per page.

Map internal_name, optional sku, source_locale (or selected default when unmapped),
optional gtin, optional paired cn_code/cn_nomenclature_year. Existing CreateProduct
normalization sets both internalName and initial source translation productName
from internal_name. New Product is ACTIVE, initial version DRAFT, never published.
Name/SKU trim follows CreateProduct; SKU comparison is tenant-local, case-sensitive
normalizedSku. All duplicate SKU rows within a file conflict; no arbitrary winner.
GTIN/CN validators are the existing domain validators; GTIN remains optional and
there is no new cross-product/global unique constraint. Current draft/publication
GTIN match (zero-padded equivalence) or repeated file GTIN needs explicit separate-
product acknowledgement. A matching name ignoring case is informational only;
this is exact case-folded matching, not fuzzy entity resolution.

Identifiers stay strings, including leading zeros. Scientific SKU notation warns;
invalid scientific GTIN fails. No guessing lost digits. Export v1 protection is
not reversibly distinguishable from an original apostrophe: preserve apostrophes,
show final values and warning, never strip them or offer a fictitious decoder.
Cells render as text; there is no downloadable error report. Ignored columns are
listed before confirmation, including export authority/manufacturer columns.
This is not a full export round-trip: no existing-product update/upsert, publication,
manufacturer, other translations, materials, images, PDFs, history or XLSX import.
No spreadsheet certification; prior SPREADSHEET_UI_CHECK=NOT_PERFORMED is unchanged.

## Confirmation, atomicity and bounds

POST /api/products/import uses canonical-origin/proxy checks and actual session.
Tenant/user come from the server context, never CSV. Both PRODUCT_CREATE and
PRODUCT_EDIT are required. Preview only reads; confirmation stores receipt hashes,
not Product data. A 30-minute HMAC token binds exact file bytes, ordered mapping,
delimiter/default locale, tenant/user/membership. Confirmation validates again and
persists a hash of the exact sorted selected set and GTIN acknowledgement. Changes
to file/mapping invalidate preview; no preselected valid subset or silent import.

Each execution call accepts at most 25 confirmed row payloads and revalidates
values/hash and real organization/membership/permissions inside each transaction.
CreateProduct, GTIN and CN services share that transaction with normal audits and
the success receipt. Any identifier failure rolls back the entire row. Concurrent
confirmation uses native INSERT ON CONFLICT; batch row lock serializes execution,
so a successful receipt cannot create again after a lost response/replay.
Only committed rows survive a later failure. Expected SKU conflicts and row failures
become bounded error codes, not leaked DB messages. Authorization loss stops work.
Transactions: execute 5 s, acquisition 2 s, statement 4 s; inspect/confirm transaction
15 s. Execution checks a 10 s deadline between rows; an in-flight row still has its
own bound. Request bodies bounded and read within 10 s; browser timeout 45 s.
No queue/Redis or whole-file transaction. These are request bounds, not a process
memory/concurrency cap or production performance SLA.

Resume requires same file, mapping/options, tenant and user; original selection is
frozen. Reports include success/failed/pending and links. Re-delivering completed
report rows is idempotent. Cancel stops future rows; an already committed/in-flight
row may finish. Cancel does not undo products. Failed rows do not auto-retry; use a
corrected/new file for deliberate new work. A changed file hash is a new import,
not a deduplication guarantee across different files (SKU conflict rules still apply).

## Receipt migration and retention

`20260921120000_catalog_import_receipts`: additive CatalogImportBatch and
CatalogImportRow, tenant/user/contentHash uniqueness, batch/row primary key,
status/hash/bounds checks and RESTRICT foreign keys. No existing data rewritten.
ProductId in receipt is a historical reference, not a cascading Product FK.
Runtime gets SELECT/INSERT/UPDATE on these two new tables only, no DELETE/TRUNCATE/
REFERENCES/TRIGGER. Existing owners/ACL/data must remain unchanged.

No raw CSV, filename or normalized row payload is stored server-side. File/preview
remain browser memory until reset/navigation; retries upload it again. Receipt
hashes, tenant/user, selected row numbers, statuses, product IDs and bounded errors
are retained as persistent idempotency evidence, alongside existing Product audits.
There is no automatic expiry that could silently enable duplicate replay. Retention
of these metadata follows an explicitly controlled future policy; raw-file retention
is zero. Temporary live synthetic CSV will be removed after acceptance; synthetic
products and their receipts/audits remain and will be listed here.

Operator phase 1: exact migration history/checksum and staging DB/build guards,
root-only backup, one Prisma migrate deploy, minimal runtime grants and verification.
Phase 2: prebuilt .next/messages artifact with old/new manifest verification and
staging-only PM2 restart. No npm install on VPS: parser bundled by webpack.
Application rollback restores prior .next/messages; leave additive receipt tables,
created drafts and audit intact. Never automatically restore DB/drop tables.
Package: `/private/tmp/passvero-import-staging-33adf1c`.

## Local evidence (not live)

- 64 focused parser/service/HTTP and affected CreateProduct/GTIN/CN tests PASS.
- Disposable PostgreSQL proof PASS: 5,000 products, 25-row calls, 202 calls including
  replay, exact initial versions/translations/audit, 0 preview Product writes.
- Concurrent confirmation/execution, lost-response replay, resume and completed
  replay created no duplicates. Other-tenant scope/identical identifiers and forged
  row hashes rejected/isolated as applicable.
- Injected identifier failure after creation rolled back Product/version/audit;
  another row succeeded, remaining row cancelled. Membership suspension stopped
  remaining work while preserving earlier committed result.
- 12,259.206 ms local creation loop; RSS before 241,664,000 and after 525,828,096 bytes
  includes fixture/proof state and is not peak RSS. One disposable local run, not
  live performance or SLA. Cluster stopped; no live bulk seed.
- TypeScript PASS; lint 0 errors, 15 existing warnings; isolated webpack PASS.
  Logs `/private/tmp/passvero-import-{focused,postgresql,tsc,lint,build}.log`.
- Initial proof found a Prisma upsert race; fixed with native ON CONFLICT and the
  full protected proof rerun PASS. No unresolved import regression from that run.
- Existing broader test debt remains as previously documented in search/export
  evidence; no unrelated fixes or broad rerun. Local results do not prove live UI.

PRODUCT_CSV_IMPORT_SOURCE=COMPLETE
CSV_MAPPING_PREVIEW_STAGING=PASS
CSV_VALIDATION_AND_CONFLICT_UI=PASS
CSV_CREATE_ONLY_STAGING=PASS
CSV_ROW_ATOMICITY_LOCAL=PASS
CSV_IDEMPOTENCY_AND_RESUME_LOCAL=PASS
CSV_TENANT_AUTHORIZATION_LOCAL=PASS
CSV_5000_ROW_IMPORT_LOCAL=PASS
CSV_EXPORT_ESCAPE_HANDLING=PASS
PRODUCTION_CHANGES=NONE

## Staging acceptance and final review (2026-09-21)

Operator migration PASS: one attempt, passvero_acceptance port 5433, empty receipt
tables, existing Product/version/translation/identifier/audit and owners/ACL unchanged.
Only SELECT/INSERT/UPDATE on the two receipt tables. Backup SHA-256:
`da2523a277c8539a126372f01424ccdf7a8eef8e3808a58719d8de132358a5b4`.
Operator deploy PASS: build `bO73SDxjxPBddEzd4Q2nd`, 670 artifact files, 23 source
files, source review SHA-256
`368ccd04739fda9b7f15e98cf4df0d571c0485f0fd4fb54bbe78d57828de4a8c`.
HTTPS 200/TLS 0, zero startup errors, runtime/scanner/broker/producer unchanged.
Operator stdout reports remain separate JSON artifacts; their NOT_YET_RUN live
status is preserved. Subsequent UI evidence is in live-acceptance.json.

Actual authenticated Chrome UI: UTF-8 BOM/comma five-row CSV, visible mapping,
source_locale explicitly unmapped with default hr. Manufacturer/lifecycle columns
visibly ignored. Fresh separate catalog read after preview still five products.
Preview showed two errors: invalid GTIN and existing SKU conflict, both disabled.
Apostrophe warning preserved the original text; current GTIN match required explicit
acknowledgement. Explicit select-valid chose rows 1/2/3, summary 3 selected/2 excluded,
then checked confirmation created 3 successes/0 failures/0 pending.
Completed-report refresh re-delivered the same batch rows: same three Product IDs,
fresh catalog eight products, no invalid/conflict product. Each detail is ACTIVE
with initial HR draft/source translation, no publication or public DPP.
First GTIN/CN/zeros verified, second apostrophe preserved, third matching GTIN
allowed as separate product. Ignored manufacturer absent. Console warnings/errors
empty; desktop result screenshot inspected. No new responsive/six-locale live
acceptance claim. No live bulk seed, concurrent browser execution, auth revocation
or injected failure; those remain local proofs. Live audit SQL was not queried;
existing service audit atomicity is local proof, audit records were not deleted.

Intentionally retained synthetic drafts (and associated receipts/audits):

| SKU | Product ID | Verified values |
| --- | --- | --- |
| 00092101 | 49b7356c-ce50-4e65-b682-51548bfbf16a | Živić, stolica; GTIN 012345000058; CN 01012100 / 2026 |
| 00092102 | 2c87a2c7-8d2e-422d-9a20-cb029031d04c | Leading apostrophe and Đakovo; optional identifiers absent |
| 00092103 | 183d8c53-f3ab-4aae-911a-405b166ada31 | Explicit separate-product GTIN 6291041500213 |

Temporary live-synthetic.csv removed after acceptance; only fixture hash/metadata
retained. Browser navigation clears uploaded file/preview memory. Deployment package,
backup references and local proof logs/manifests remain evidence, not raw import
retention. No existing product edits, publishing, production changes, commit or push.

Only this document and IMPLEMENTATION_ROADMAP.md changed after deployed source
review. All other 21 source files remain hash-identical. Final reviewed list and
SHA-256 manifest: `/private/tmp/passvero-import-staging-33adf1c/final-source.sha256`.
No repeated tests/build/deploy for documentation-only acceptance additions.
