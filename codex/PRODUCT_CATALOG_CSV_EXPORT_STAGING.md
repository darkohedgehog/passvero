# Product catalog CSV export — format_version=1

Source base: `7af8874c1f38f911938af7b55fe7b39c3a158655`. Source remains uncommitted.
Previous accepted staging build: `F1RgM647Gr7wlY2TCJpsT` (catalog search).
This slice adds read-only CSV export; no migration, dependency, runtime configuration,
scanner, producer, production or import changes.

## Row and selection contract

One row per Product in the authenticated organization, including the same lifecycle
states as ListProducts. PRODUCT_READ is sufficient; PRODUCT_EDIT is not required.
GET `/api/products/export?q=...` uses server-resolved existing session organization.
No caller-supplied tenant authority. `cursor` is ignored. Unknown parameters and
repeated q are rejected. Search normalization and Prisma predicate are shared with
ListProducts: literal case-insensitive name/SKU substring, valid equivalent GTIN
of current draft/current publication. No historical GTIN selection.

All results across all list pages are exported. Every row uses the current draft,
otherwise current publication, otherwise empty version fields. Thus a match on a
published GTIN can output a different draft GTIN (or empty draft GTIN). Product
internal_name and sku belong to Product; all version columns come from one version.
Manufacturer columns use ProductVersionManufacturer snapshot, never EconomicOperator.
Existing partial unique indexes make CN and GTIN scalar; duplicate records fail closed.
Other ProductIdentifier types and their cardinality are untouched.

## Columns (fixed order, never localized)

| Column | Source / meaning |
| --- | --- |
| product_id | Product.id; export reference only, no import/upsert authority |
| internal_name | Product.internalName; not translated public productName |
| sku | Product.sku, text including leading zeros |
| lifecycle_status | Product.lifecycleStatus enum |
| version_number | Selected ProductVersion.versionNumber; draft may be null |
| version_status | Selected ProductVersion.status enum |
| source_locale | Selected ProductVersion.sourceLocale |
| gtin | Selected version's GTIN identifier value, text |
| cn_code | Selected version's CN identifier value, text |
| cn_nomenclature_year | CN identifier nomenclatureYear |
| manufacturer_name | Selected version's manufacturer snapshot name |
| manufacturer_country_code | Same snapshot countryCode |
| product_updated_at | Product.updatedAt, UTC ISO 8601 |
| version_updated_at | Selected version.updatedAt, UTC ISO 8601 |

Null/absent fields are empty cells. No version means all version fields empty.
UTF-8 BOM, comma delimiter, CRLF record endings, doubled embedded quotes, quoted
data cells. Embedded line breaks remain within quoted cells. Header-only output
is valid for zero matches. Filename `passvero-catalog-v1.csv`; no preamble or query
in filename. Attachment, `text/csv; charset=utf-8`, `nosniff`, `private, no-store`.
No tenant/user IDs, notes, audit data, images, documents, URLs or storage metadata.

## Spreadsheet protection and import limitations

SKU/GTIN/CN remain strings: `00012` stays `00012` in the parsed CSV. No formulas
such as `="00012"`. CSV has no cell types: import via the spreadsheet text/CSV
import dialog and explicitly set identifier columns to **Text**. Double-click
opening is not a guarantee of preserving zeros or avoiding numeric coercion.

Cells beginning with control/format characters (including after whitespace), or
formula prefixes `= + - @ ＝ ＋ － ＠` after whitespace/control/format characters,
receive a leading ASCII apostrophe. All cells are independently quoted and quotes
escaped, preventing separators/newlines from creating injected cells. This follows
[OWASP CSV Injection guidance](https://community.owasp.org/attacks/CSV_Injection)
for apostrophe-and-quoting protection, extended for disguised prefixes. Quoting
alone is not formula protection. The apostrophe is real exported data; this is
not lossless original text and not a complete Product round-trip format. There
is no universal spreadsheet safety guarantee, especially after saving/reopening
in Excel. Never treat this as certification across spreadsheet programs.
A future import must specify explicit decoding/escaping rules; never silently
strip apostrophes (an original leading apostrophe is indistinguishable here).

## Bounds and consistency

At most 10,000 products and 20 MiB of final UTF-8 CSV, including BOM/header/escaping.
Both bounds reject the entire export, never truncate to a successful partial file.
100-row keyset batches ordered updatedAt DESC, id DESC inside one PostgreSQL
REPEATABLE READ, READ ONLY transaction. Relation queries share the snapshot;
relation predicates use EXISTS semantics, not fanout joins. Transaction timeout
15 s, acquisition maxWait 2 s, statement_timeout 10 s. Application processing
also checks a 15 s deadline. HTTP response deadline 25 s includes context resolution;
a late context resolution cannot start export. An already-running transaction
still terminates at its own bound. Browser timeout 30 s, no in-flight double-click.
Transaction closes before a success response is constructed. CSV buffers are
bounded by 20 MiB plus assembly copies and one fetched batch; this is not a global
per-process memory cap or concurrency rate limiter. Stored fields are selected
narrowly. No streaming success response before completeness is known.

Limits/timeouts return a safe failure encouraging narrower search. Authorization,
validation and operational failures have JSON responses without attachment headers.
The client checks successful CSV content type before creating a download, so an
HTML login response or JSON error is not saved as CSV. Query text is not logged by
this implementation; existing infrastructure request logging is unchanged.

## Local evidence (separate from live)

- 22 focused serializer/application/HTTP plus affected list tests PASS; request deadline covered with a controlled timer.
- Independent Python stdlib csv parser: row/column count, BOM, diacritics, quoting,
  multiline, identifier zeros, formula/control prefixes, nulls and empty results.
  NUL is checked directly at serializer boundary; PostgreSQL text cannot store NUL,
  and the installed Python CSV parser rejects NUL.
- 10,000 accepted, 10,001 rejected; exact 20 MiB boundary including escaping;
  persistence failure after a consumed batch still returns JSON with no attachment.
- Fresh disposable PostgreSQL proof: 5,000 own + one other-tenant product, 50 batches,
  full and 1,000-result filtered export, both GTIN branches, published-only and
  no-version rows, tenant isolation, committed concurrent rename while reading
  later batches from original snapshot, real DB row-limit failure. Cluster stopped.
- Initial final snapshot run: 825,124 CSV bytes, 175.24 ms; RSS before 405,700,608,
  sampled peak 423,198,720 (delta 17,498,112 bytes). Single local warm-process run;
  5 ms sampling can miss peaks. 128 MiB incremental RSS test guard is local only,
  not a production SLA. No live bulk seed. pg emits its existing concurrency
  deprecation warning from Prisma relation-query execution; no test failure.
- Logs: `/private/tmp/passvero-csv-{focused,postgresql,tsc,lint,build}.log`.
- TypeScript passed; lint 0 errors/15 existing warnings. Isolated webpack build PASS: `1jeAIT6a93SlibJBd8Wm0`.
- No unrelated acceptance rerun. Previously documented unrelated failures in
  `PRODUCT_CATALOG_SEARCH_STAGING.md` remain separate evidence, not CSV failures.

## Staging acceptance (2026-09-21)

Operator deployment PASS: build `1jeAIT6a93SlibJBd8Wm0`, base
`7af8874c1f38f911938af7b55fe7b39c3a158655`, reviewed source 23 files,
review SHA-256 `45a72dd78fb9842b060fbb1d5b7b1f18a1c4bf966f64e7b0393d81399eaf09fa`.
664 artifact files verified, HTTPS 200/TLS 0, startup errors 0, migration not required.
Runtime configuration/scanner/broker/producer unchanged; no production access.
Manifest: `/private/tmp/passvero-csv-staging-7af8874/manifest.json`.
Operator stdout retained as `operator-deployment-report.json`; its pre-acceptance
NOT_YET_RUN value is preserved, with subsequent UI evidence in `live-acceptance.json`.

Actual Chrome UI downloads, saved through the native Save dialog and independently
parsed with Python csv (UTF-8 BOM, 14 ordered columns, CRLF):
- Full catalog: 5 rows, 1,258 bytes; SKU set matches the five visible products.
  GTIN product contains `6291041500213`; manufacturer snapshot contains
  `SINTETIČKI PROIZVOĐAČ — MFR-20260917` / `HR`; `PVA-001` uses DRAFT.
- Applied search `DPP-GTIN-20260920-01`: one row, 422 bytes, identical to that
  product's full-export row. UI explicitly says all applied-search results.
- Search `zz-csv-no-result-20260921`: zero rows, header-only 210-byte CSV.
- Anonymous GET `/api/products/export`: 403, `{"code":"FORBIDDEN"}`, no attachment,
  private/no-store and nosniff. No credentials/cookies used for this request.
- Six UI locales rendered their translated CSV controls/help; returned to Croatian.
  No horizontal page overflow at widths 320/375/768/1024/1440; mobile screenshot
  inspected at 375. Keyboard Tab reaches the export button; Enter submits search.
  Captured console warning/error list empty. Temporary viewport override reset.

Downloads are retained outside git as `catalog-full.csv`, `catalog-filtered.csv`,
`catalog-empty.csv` with SHA-256 values in `live-csv-parsing.json`. Source filename
suggested by Chrome was `passvero-catalog-v1.csv`; local evidence names were chosen
in the Save dialog. Spreadsheet UI NOT_PERFORMED; parsing is not spreadsheet UI.
Large-catalog/all-pages, concurrency, formula/control fixtures, byte/row limits and
leading-zero cases remain **local** proofs. The live catalog has only five products;
no large live dataset or live pagination claim. No products, assets or audits altered.

Only this document and IMPLEMENTATION_ROADMAP.md changed after the deployed source
review. Runtime source is hash-identical to the reviewed build. Final 23-file source
manifest: `/private/tmp/passvero-csv-staging-7af8874/final-source.sha256`.
No repeat tests/build/deploy for these documentation-only acceptance additions.

PRODUCT_CSV_EXPORT_SOURCE=COMPLETE
CSV_FULL_CATALOG_STAGING=PASS
CSV_FILTERED_EXPORT_STAGING=PASS
CSV_ALL_PAGES_LOCAL=PASS
CSV_TENANT_ISOLATION_LOCAL=PASS
CSV_FORMAT_AND_FORMULA_PROTECTION=PASS
CSV_LEADING_ZERO_PRESERVATION=PASS
CSV_5000_PRODUCT_EXPORT_LOCAL=PASS
SPREADSHEET_UI_CHECK=NOT_PERFORMED
PRODUCTION_CHANGES=NONE

Next separate task: CSV import mapping, preview, validation and duplicate handling.
