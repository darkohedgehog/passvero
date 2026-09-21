# PRODUCT_CATALOG_SEARCH_STAGING

Base: `8ecfb4688f74e0fe1e234867ba7fef04953210a6`; initially clean worktree/index.
Source remains uncommitted. No production access or changes.

## Search contract

The existing ListProducts service/persistence/server page is extended, not replaced.
One GET `q` field searches Product.internalName (the existing display name), SKU,
and valid whole GTINs. Text is trimmed, at most 200 input characters; control
characters and repeated q parameters are rejected through the existing safe list
error response. Empty text uses the existing list. PostgreSQL ILIKE substring
matching escapes backslash, percent and underscore. Invalid GTIN text still searches
name/SKU. GTIN uses existing check-digit validation and zero-padding equivalence;
all valid 8/12/13/14-character representations of the same identifier are matched.
No numeric conversion or lost leading zeroes; no GS1 registration claim.

Only currentDraftVersion (DRAFT/READY_FOR_REVIEW) and currentPublishedVersion
(PUBLISHED) identifiers participate. Historical SUPERSEDED/DISCARDED identifiers
are excluded. Relation predicates return each product once. Top-level trusted
organizationId scopes text/GTIN OR branches and cursor conditions; each GTIN version
also has the trusted organization condition. Existing PRODUCT_READ authorization,
server-derived tenant, name/status projection and 25-item page size are retained.
No new write permission, client filtering or whole-catalog read is introduced.

Sorting stays updatedAt DESC, id DESC. Search cursors carry SHA-256 of the trimmed
query; a different query (including empty vs nonempty) is rejected. Existing v1
non-search cursors remain valid only without search. Cursor is not an authorization
token or a catalog snapshot: concurrent updates may move rows across page boundaries.
The service always reapplies tenant and search predicates. Changing input submits a
GET form with q only, resetting cursor. Next link retains normalized q. Refresh/back
use normal browser URL navigation; reset links to the unfiltered localized list.
Visible label/help/no-result text and controls cover hr/en/de/sr/sl/pl.

## Local verification

- 15 focused list service/persistence/presentation tests PASS.
- Strict TypeScript PASS; lint 0 errors, 15 existing warnings.
- Secret-free isolated webpack build PASS: `F1RgM647Gr7wlY2TCJpsT`.
  Initial sandbox font-fetch denial was resolved by granting network access to
  this build only. No env files/credentials were copied into the build tree.
- Real Prisma/PostgreSQL integration PASS: 5000 pilot-tenant products plus 1000
  other-tenant products, 6000 current drafts/identifiers, additional publication
  and historical/discarded versions. Covers case-insensitive name/SKU, escaped
  literal pattern characters, padded GTINs, current draft/published matches,
  historical exclusion, no duplicate products, cross-tenant scope, empty/no-result
  queries, three pages without duplicates and query/cursor mismatch rejection.
- Fresh disposable cluster stopped: `/private/tmp/passvero-search-proof-xqk73w`.
  No pilot-volume test data was written to staging.
- Actual Prisma SQL and EXPLAIN ANALYZE BUFFERS JSON saved in `plans.json` there.
  Name: 0.084 ms; SKU: 0.895 ms; GTIN: 4.620 ms; no-result: 0.702 ms;
  next page: 0.209 ms. Warm local single-run measurements, not a production SLA.
  Name/next-page use existing organization/updatedAt index with incremental sort;
  selective SKU/no-result use sequential scan; GTIN uses joins and existing version
  PK. At this scale no new index, extension or schema migration is justified.

Logs: `/private/tmp/passvero-search-{focused,postgresql,tsc,lint,build,unit,schema}.log`.
The broad sandbox run also hit local socket permission denials; only affected
qpdf-broker-client (2 tests) and clamav-unix-scanner (16 tests) were rerun with local
socket permission and passed. They use fake local servers, not staging scanners.
The remaining three document failures match prior unchanged image evidence:

- document-attachments-presentation: editor sees bounded draft management with honest public-intent wording;
- document-attachments-presentation: new attachment form has explicit unchecked public intent and all labeled inputs;
- document-scan-runtime: missing config and constructor errors are normalized without accessing other runtimes.

Prior evidence: `/private/tmp/passvero-image-unit-final.log`; affected tests/runtime
source unchanged. Schema suite 271/288, exactly the same 17 failure names as
`/private/tmp/passvero-image-schema-final.log` (legacy snapshots/generated-adapter
allowlist/document/public-DPP assertions). No unrelated repairs or relabeling.

## Staging handoff

Package: `/private/tmp/passvero-search-staging-8ecfb46`.
Replace only reviewed .next/messages artifacts, retaining image build
`uXHDuXfdNBCLINFdIWQ0m` as rollback. No migration, new grants, env edits, dependency
installation, scanner/producer changes or live writes in the deployment script.
Operator executes sudo; review/hash/build/runtime checks precede replacement.
Rollback restores the previous application artifacts without restoring a database.
Existing retained synthetic image/GTIN products will be used for one UI flow.
No new synthetic data needed. Live name/SKU/GTIN/no-results/reset/refresh/back/detail
acceptance passed after operator deployment. Live pagination was not exercised:
the staging list has five products, below the 25-item page size. The multi-page
PostgreSQL integration proof remains the pagination evidence.

PRODUCT_CATALOG_SEARCH_SOURCE=COMPLETE
SEARCH_NAME_SKU_STAGING=PASS
SEARCH_GTIN_STAGING=PASS
SEARCH_EMPTY_AND_RESET_STAGING=PASS
SEARCH_CURSOR_INTEGRATION=PASS
SEARCH_TENANT_ISOLATION_LOCAL=PASS
SEARCH_5000_PRODUCT_QUERY_REVIEW=PASS
PRODUCTION_CHANGES=NONE

Next: CSV export, then CSV import with preview/validation/duplicate handling.
Neither is implemented here. No commit/push authorized.

## Completed staging acceptance (2026-09-21)

Operator deployment PASS: base `8ecfb4688f74e0fe1e234867ba7fef04953210a6`,
review SHA-256 `640ed89fa474e8ee176b9482a8224fc632993c6b2664855516e716d6ff3a0f69`,
build `F1RgM647Gr7wlY2TCJpsT`, 660 artifact files verified, HTTPS 200/TLS verified,
zero startup errors. Runtime configuration and scanner/broker/producer unchanged.
No migration. Sanitized operator report retained in the local staging package.

Authenticated Chrome UI evidence:
- `slika` matches only SINTETIČKI TEST — SLIKA 20260920 (case-insensitive substring).
- `dpp-gtin-20260920-01` matches the retained GTIN product by SKU.
- Open result resolves the correct product detail; browser Back restores SKU query
  and result. No product edits or new drafts were made.
- Displayed published GTIN is 6291041500213; query `06291041500213` returns that
  product once, proving the equivalent padded representation through the live UI.
- Refresh preserves the GTIN URL/query/result.
- `zz-search-no-result-20260921` shows the explicit no-results state.
- Clear search removes q and restores the five-product list.
- Enter from the focused search field submits successfully.
- At 320/375/768/1024/1440px the search controls stay within the viewport and there
  is no horizontal page overflow. Mobile cards remain usable. Override reset.
- Search label/help/button render in all six locales through the actual language
  selector. Existing language switching opens the localized list without query;
  query persistence above covers refresh/back and copied URLs within a locale.

Tenant isolation, historical/draft GTIN cases, pagination and malformed cursors are
local integration evidence, not a new cross-tenant or publication live campaign.
Only existing synthetic products were queried; no new data, assets or audit
mutations were created or removed by acceptance. Retained historical artifacts,
products, assets and audits remain intact. Source implementation unchanged after
build; only this evidence document and central roadmap changed after deployment.
Final SHA-256 source manifest is stored separately from the immutable deploy
manifest as `final-source.sha256` / `final-source-review.json` in the package.
No commit/push, additional deploy or production access occurred.
