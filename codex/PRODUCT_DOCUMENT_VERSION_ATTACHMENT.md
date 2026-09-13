# Product document version attachment

Classification: bounded current-draft attachment authoring and authenticated
published/draft read model. Canonical base:
`db9bbd49881586a88141759e75bf7be6e968429e`.

## Frozen boundaries

Existing Document and ProductDocument schema, no migration, dependencies or env
changes. No live ACL, staging, production or Supabase access. No Document binary,
checksum, storage identity, archive/delete or cleanup changes. No malware scanner
or anonymous route. Public DPP DTO, persistence and rendering remain document-free.
AVAILABLE means private upload completion, not malware-safe. Future public
presentation requires PUBLIC_DOCUMENT_MALWARE_SCAN_GATE_DESIGN first.

## Authoring metadata

- Categories: CERTIFICATE, DECLARATION, MANUAL, OTHER, validated with Zod.
- Locale: null or hr/en/de/sr/sl/pl, independent of ProductTranslation,
  sourceLocale and dashboard presentation language.
- displayLabel: NFC/trim, 1–200 Unicode code points; required on attach/edit.
  Legacy null/empty labels read as null and UI renders localized Untitled document.
  Original filename is never substituted. Such draft links block publication
  until corrected or removed; published historical data is not rewritten.
- description: nullable plain text, NFC/trim, at most 2,000 code points, blank
  becomes null. Text is escaped by React, never interpreted as HTML. Unsafe
  controls/bidi formatting rejected; descriptions permit newline/tab.
- isPublic: explicit boolean on attach/edit; checkbox initially false. It records
  future public intent, not availability. UI explicitly says public downloads are
  not enabled. The current published version still has private downloads only.
- isPrimary: false on attach; existing values preserved by edit and clone.
- sortOrder: append max+1, first zero; metadata editor supports nonnegative
  PostgreSQL Int values. Overflow fails atomically. Read order sortOrder ASC/id ASC.
  Equal orders have a stable tie-breaker; no reorder of neighboring rows.

## Services, HTTP and transaction

POST /api/products/[productId]/documents accepts a strict discriminated JSON body
for ATTACH, EDIT or REMOVE. Unknown fields are rejected. Body read capped at 32 KiB
and 10 seconds. Canonical origin/proxy and resolved authenticated context required.
Tenant comes exclusively from context. Responses contain only bounded status.

Each request carries expectedDraftVersionId, expectedProductUpdatedAt and
expectedDraftUpdatedAt. EDIT/REMOVE also require attachmentId and
expectedAttachmentUpdatedAt. ATTACH requires documentId and metadata; EDIT requires
metadata and sortOrder. There is no generic Document library/list endpoint.

The application service owns one transaction: tenant-scoped Product FOR UPDATE,
Membership/Organization shared locks and revalidation, exact current version
ownership and DRAFT/READY_FOR_REVIEW state, timestamp checks, then mutation and
one PRODUCT_UPDATED audit. Existing strictly increasing Product/draft touch
mechanism is reused. All persistence uses the transaction client.

PRODUCT_EDIT required for authoring; database eligibility is authoritative even
if an old session still claims permissions. Document lookup is tenant-scoped and
shared-locked. Attach/edit require AVAILABLE; remove can repair a draft containing
an unavailable owned asset. Removing a missing/stale link returns bounded conflict.
No mutation of another draft or historical link is possible by handle alone.

Logical duplicates (same draft/documentId/category/locale) are checked under
Product lock for attach and metadata edit. Concurrent identical requests produce
one link and bounded conflict for the loser, without schema constraints or retry.
An identical edit with current evidence returns NO_CHANGE before touches/audit.

Audit operation is only DOCUMENT_ATTACHED, DOCUMENT_METADATA_UPDATED or
DOCUMENT_REMOVED. No label, description, filename, checksum, storage identity or
provider diagnostics. Upload retains its separate DOCUMENT_UPLOADED event;
attachment authoring never emits it. Audit failure rolls back links and timestamps.

## UI and upload recovery

Private Product Detail has separate published and current-draft document sections,
localized in all six languages. Published/Viewer sections are read/download only.
Draft editors can upload, attach, edit metadata and confirm removal of the link.
The private GET/HEAD asset routes and their PRODUCT_READ authority are unchanged.
No download URL is offered for a non-AVAILABLE asset. Client DTO contains only
link/document handles, safe authoring metadata, availability and private route.

A small component-local flow performs existing POST /api/documents, then attachment
POST. There is no network I/O in the attachment DB transaction. A synchronous
in-flight guard prevents double submissions. The successful Document handle is
retained after attachment failure and only an explicit user retry can reuse it.
The flow pins Product/draft and both original timestamps; it never silently adopts
new evidence. Upload uncertainty prevents a second upload from that form. An
uncertain attachment may already have committed: Product lock/CAS/duplicate check
prevents an additional link when retried.

No tenant-wide asset browser. The retry handle is retained only while this form
is mounted, not in localStorage or a URL. Leaving the form warns about unsaved
metadata and retained private upload. After leaving/reload, an unattached asset
remains private; later reconciliation needs its exact handle through the service
or separately scoped recovery tooling. No automatic orphan cleanup.

## Publication and cloning

Readiness validates every attachment, including isPublic=false: same-tenant
AVAILABLE asset, canonical category/locale/label/description, explicit boolean and
valid sortOrder. Invalid metadata or unavailable assets block the entire version;
zero-document publication is unchanged. Product publication locking serializes
against link removal/edit/attachment.

Existing create-draft-from-published copies every link into a fresh identity with
the same Document ID and exact authoring metadata, including isPrimary/sortOrder.
No physical PDF copy. Replacement uploads B, attaches B in draft and removes only
the draft link to A. Published/historical A remains unchanged before and after
republication. Existing Passport/QR/publicCode lifecycle semantics remain intact.

## Runtime ACL contract (documentation only)

| Table | Required table privileges | Explicit exclusion |
| --- | --- | --- |
| Document | SELECT, INSERT, UPDATE | No DELETE, TRUNCATE, REFERENCES, TRIGGER |
| ProductDocument | SELECT, INSERT, UPDATE, DELETE | No TRUNCATE, REFERENCES, TRIGGER |

Document INSERT/UPDATE was the separately corrected staging prerequisite from the
previous asset acceptance. This slice performs no live grants. Existing Product
and ProductVersion SELECT/UPDATE, AuditLog SELECT/INSERT, Membership/Organization
SELECT plus existing UPDATE-column privilege for shared row locks remain required.
No new ownership, schema CREATE, database CREATE/TEMP or default grants.
Disposable proof also executes attachment operations as a restricted login role,
then proves Document DELETE denied. Runtime ACL verification/correction remains
an explicit later deployment gate.

## Verification

Focused validation/HTTP/UI orchestration and server-rendered presentation tests;
real isolated PostgreSQL migrations and tests for tenant/current-draft authority,
concurrency/CAS, no-op, atomic rollback, restricted runtime privileges, clone,
replacement, full publication readiness and document-free public DTO. Existing
asset, publication, translation, material and clone PostgreSQL regressions included.
Application, infrastructure and schema/governance suites, TypeScript, ESLint,
isolated safe-origin production build, both npm audits and diff checks required.
Live browser acceptance remains separately pending on staging; no live PDF upload
is performed by source verification.

## Source verification result

- Focused attachment validation/HTTP/UI/presentation: 35 passed.
- Application: 663 passed; infrastructure: 238 passed; schema/governance: 285 passed.
- Disposable PostgreSQL 16: all 19 committed migrations applied; final combined
  asset/attachment/clone/publication/material/translation run: 61 passed, including
  20 attachment proofs. Cluster stopped and completely removed afterward.
- Restricted runtime login successfully attached/edited/removed; Document DELETE
  was denied. No live grants or role access occurred.
- TypeScript and changed-file ESLint passed. Full ESLint: zero errors, 15 existing
  warnings in the unchanged historical auth proof harness.
- Final isolated production webpack build passed with safe .invalid origin and
  no .env files/private runtime configuration. All 69 client JS files checked:
  zero private configuration-name matches.
- npm audit and npm audit --omit=dev: zero vulnerabilities each.
- Tracked and newly added files checked for diff whitespace errors.
- Local server-rendered synthetic UI with actual build CSS inspected using
  isolated Chrome viewport emulation: 320, 375, 768, 1024 and 1440 px, no horizontal
  overflow. Mobile and desktop screenshots visually inspected. This verifies
  local layout, not live authenticated browser upload or hydration acceptance.
- No schema, migration, dependency, env, public DTO or live storage changes.
  No staging, production, SSH, live ACL, commit or push activity.

PRODUCT_DOCUMENT_VERSION_ATTACHMENT_BROWSER_ACCEPTANCE=PENDING_STAGING
DIRECT_PUBLISHED_DOCUMENT_MUTATION=DENIED
PUBLIC_DPP_DOCUMENT_EXPOSURE=NONE

The initial plain headless Chrome CLI timed out after writing a clipped screenshot;
that attempt was not counted as a pass. Exact viewport emulation subsequently
passed all five required widths. Initial test-fixture failures (legacy lowercase
category, pre-attachment detail allowlists, unordered test row selection) were
corrected; invalid timestamp validation was fixed and regression-tested.

## Changed files

- `app/[locale]/dashboard/products/[productId]/page.tsx`
- `app/api/products/[productId]/documents/route.ts`
- `codex/PRODUCT_DOCUMENT_VERSION_ATTACHMENT.md`
- `messages/de.json`
- `messages/en.json`
- `messages/hr.json`
- `messages/pl.json`
- `messages/sl.json`
- `messages/sr.json`
- `src/application/products/document-attachments/contracts.ts`
- `src/application/products/document-attachments/http.ts`
- `src/application/products/document-attachments/service.ts`
- `src/application/products/document-attachments/ui-client.ts`
- `src/application/products/get-product-detail/contracts.ts`
- `src/application/products/get-product-detail/get-product-detail.ts`
- `src/application/products/get-product-detail/ports.ts`
- `src/components/application/products/product-detail-presentation.tsx`
- `src/components/application/products/product-documents-section.tsx`
- `src/infrastructure/persistence/prisma/prisma-document-attachments.ts`
- `src/infrastructure/persistence/prisma/prisma-get-product-detail.ts`
- `src/infrastructure/persistence/prisma/prisma-publish-product.ts`
- `src/infrastructure/products/document-attachments-runtime.ts`
- `tests/application/document-attachments-http.test.ts`
- `tests/application/document-attachments-presentation.test.ts`
- `tests/application/document-attachments.test.ts`
- `tests/application/get-product-detail-service.test.ts`
- `tests/application/product-detail-presentation.test.ts`
- `tests/create-product-boundaries.test.mjs`
- `tests/document-attachments-boundaries.test.mjs`
- `tests/infrastructure/prisma-get-product-detail-composition.test.ts`
- `tests/infrastructure/prisma-get-product-detail.test.ts`
- `tests/infrastructure/prisma-publish-product.test.ts`
- `tests/infrastructure/translation-publication-readiness.test.ts`
- `tests/integration/create-draft-from-published-postgresql.test.ts`
- `tests/integration/document-attachments-postgresql.test.ts`
- `tests/product-detail-boundaries.test.mjs`
