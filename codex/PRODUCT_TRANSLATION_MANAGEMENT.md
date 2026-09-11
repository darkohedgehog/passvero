# Product translation management

Base: `b0a0c6f3d518e3e92ff1df91a42b5de1eafa3618` on clean `main`, equal to
`origin/main` after fetch. This is local implementation and disposable database
verification only. Final scoped review, commit, and staging acceptance are separate gates.

## Existing model and ownership

`ProductTranslation` belongs to exactly one `ProductVersion` through
`productVersionId`; ownership is inherited through the version's Product and
Organization. Its UUID primary key and unique `(productVersionId, locale)` remain
unchanged. The FK uses Cascade/Cascade. Required columns are id, version ID,
locale, productName, createdAt and updatedAt. All eleven other content columns
are nullable. A database NOT NULL name permits an empty draft name; publication
requires a trimmed name of 1–200 Unicode code points.

| Translation-owned fields | Meaning |
| --- | --- |
| productName | Public name in the selected content language |
| shortDescription, description, technicalDescription | Descriptive content |
| repairInstructions, sparePartsInformation | Repair and spare parts |
| recyclingInstructions, disposalInstructions, packagingInformation | End-of-life and packaging content |
| safetyInformation, warrantyInformation, publicNotes | Safety, warranty and public notes |

SKU/internal identity, CN/other identifiers, materials, lifecycle, Passport, QR
and publicCode are shared domain state, never copied into translated fields.
There is no separate usage field. Manufacturer/economic operator is deferred.

The previous content editor edits nine source-language optional fields. Its
endpoint remains supported. The base editor owns source productName together
with Product.internalName; that coupling is unchanged. ProductVersion owns
sourceLocale; this slice does not add a Product-level source-language field.

## Authoring contract

Supported content locales are exactly hr, en, de, sr, sl and pl. Dashboard locale
and content locale are independent. A new non-source translation has
`productName=""` and all nullable content fields null. No source text is copied,
and no automatic or external translation is used.

The selected translation's twelve content fields can be saved on the current
editable draft, except that source productName is read-only in this manager and
links to the existing base editor. Optional text is trimmed, blank text becomes
null, and the existing 5000-code-point bound is reused (also for warranty and
public notes). Names are trimmed and bounded to 200 code points. An empty
secondary name may be saved as incomplete. Readiness means only that the required
name is valid, not a translation-quality or legal-compliance score.

Only non-source current-draft translations can be removed, with explicit user
confirmation. The source translation, sourceLocale, ProductVersion identity,
Product pointers, published rows, Passport and QR are not changed by authoring.
Product and draft timestamps/updater are touched for concurrency; one canonical
PRODUCT_UPDATED audit records only operation and locale, never authored content.
An exact current no-op edit does not touch timestamps or write an audit.

## Authority, concurrency and HTTP

PRODUCT_READ permits viewing. PRODUCT_EDIT permits ADD/EDIT/REMOVE for active
OWNER, ADMIN and EDITOR memberships; VIEWER cannot mutate. Trusted session
context supplies tenant and actor. Membership, role and Organization eligibility
are rechecked inside the transaction using existing persistence logic.

The tenant-scoped Product row is locked with FOR UPDATE, consistent with
publication and edit-from-published. Product timestamp, current draft identity,
draft timestamp and, for edit/remove, exact translation ID, locale and timestamp
are validated before writes. Version ownership/status and translation ownership
are checked. Product/draft/translation timestamps increase strictly for new
mutations. Concurrent same-locale creation has one winner; the loser receives a
bounded stale/conflict result. The unique locale index remains the final database
constraint. No automatic retry, merge or last-write-wins behavior is added.

`POST /api/products/[productId]/translations` accepts only exact ADD/EDIT/REMOVE
payloads through the existing canonical-origin/trusted-proxy boundary. Client
Organization, actor, sourceLocale and arbitrary fields are rejected. Like the
existing purpose-specific Product endpoints, validation uses strict handwritten
allowlists; no validation dependency is introduced. Database errors are reduced
to safe outcomes, and responses are private/no-store.

## UI and published behavior

Product Detail has separate content-language managers within the published and
draft sections. Source is identified by code/name and Source label, never flags.
Draft controls expose the six supported languages and distinguish missing,
incomplete and ready secondary translations. Published controls list only the
version's existing translations and are read-only. A published-only Product uses
the existing Edit product action before authoring. Viewer rendering has no form
or add/save/remove controls.

Content selection uses local component state, initially sourceLocale. Switching
content language with edited fields prompts before discarding; cancel preserves
the editor. Saving is explicit. The dashboard language selector is unchanged:
route navigation may reset selection to source and discard unsaved form state,
as before, without a Product mutation. Each editor uses its content locale in
`lang` attributes independently of translated dashboard labels. Buttons have
44px minimum height, wrapping layout, text labels, pressed state and focus rings.
New manager and publication messages exist in all six UI locales.

The existing Public DPP selector already uses `?lang=` and availableLocales from
only the current PUBLISHED version. It is reused unchanged. Invalid/unavailable
URL language requests retain existing fallback: available explicit language;
otherwise negotiated Accept-Language when no supported explicit language was
requested; then available Passport default and source language. NEXT_LOCALE
remains unrelated to Product content negotiation.

## Publication and copy

Every translation row belongs to its ProductVersion and publishes atomically
with it. Publication now checks every translation's supported locale and required
name in addition to existing source, material, CN and asset checks. Any incomplete
translation rejects the entire transaction with a localized actionable message;
no translation is omitted silently. Only the source locale is required to exist.

Draft changes, including deletion of a copied translation, remain private until
republication. Existing publication transitions, Passport identity and
lastPublishedAt semantics are preserved. QR identity/status/target and publicCode
remain unchanged. Edit-from-published continues copying every translation with a
fresh row ID. Published/superseded translation content is immutable.

## Verification

- Focused application/persistence translation tests: 29 passed.
- Fresh isolated PostgreSQL 16 with all 19 committed migrations: 10 new
  translation integration tests plus 18 existing clone/publication regressions,
  28 passed. Covers database unique locale enforcement, concurrent add/edit,
  post-audit rollback for all three operations, tenant/role isolation, source
  protection, draft-only writes, private deletion, republication, fallback and
  copy preservation. The cluster is stopped and removed after proof.
- Application suite: 599 passed, including Product detail/create/edit, dashboard
  language, Public DPP, QR, authorization/context and proxy/origin regressions.
- Infrastructure suite: 232 passed.
- Schema/governance suite: 279 passed; only the approved-adapter inventory grows.
- TypeScript passed. ESLint: zero errors, 15 pre-existing warnings.
- Production webpack build passed in an isolated copy with a safe .invalid
  origin, no private runtime environment and no .env files. The first sandboxed
  attempt could not fetch existing Google Fonts; the network-enabled retry passed.
- npm audit and npm audit --omit=dev: zero vulnerabilities.
- Real-browser responsive/keyboard/multilingual DPP acceptance remains a separate
  staging phase. Local rendering tests and navigation-decision tests are not
  presented as staging browser evidence.

No schema, migration, dependency or environment file changes; no SSH, staging or
production access, commit or deployment. No AI/translation memory, manufacturer,
GTIN/GS1/barcode, image, search, CSV, regulatory schema or analytics work.
Controlled early access remains after Product package completion and before
platform administration.

## Changed files

- `app/[locale]/dashboard/products/[productId]/page.tsx`
- `app/api/products/[productId]/translations/route.ts`
- `codex/PRODUCT_TRANSLATION_MANAGEMENT.md`
- `messages/de.json`
- `messages/en.json`
- `messages/hr.json`
- `messages/pl.json`
- `messages/sl.json`
- `messages/sr.json`
- `src/application/products/publish-product/http.ts`
- `src/application/products/publish-product/ports.ts`
- `src/application/products/publish-product/publish-product.ts`
- `src/application/products/publish-product/ui-client.ts`
- `src/application/products/translation-management/content.ts`
- `src/application/products/translation-management/contracts.ts`
- `src/application/products/translation-management/http.ts`
- `src/application/products/translation-management/service.ts`
- `src/components/application/products/product-detail-presentation.tsx`
- `src/components/application/products/product-translation-manager.tsx`
- `src/components/application/products/product-translation-server-section.tsx`
- `src/components/application/products/publish-product-section.tsx`
- `src/infrastructure/persistence/prisma/prisma-publish-product.ts`
- `src/infrastructure/persistence/prisma/prisma-translation-management.ts`
- `src/infrastructure/products/translation-management-runtime.ts`
- `tests/application/product-translation-management.test.ts`
- `tests/application/publish-product-http.test.ts`
- `tests/application/publish-product-presentation.test.ts`
- `tests/application/publish-product-ui-client.test.ts`
- `tests/application/publish-product.test.ts`
- `tests/application/translation-management-http.test.ts`
- `tests/application/translation-management-presentation.test.ts`
- `tests/application/translation-management-service.test.ts`
- `tests/create-product-boundaries.test.mjs`
- `tests/infrastructure/prisma-publish-product.test.ts`
- `tests/infrastructure/translation-publication-readiness.test.ts`
- `tests/integration/translation-management-postgresql.test.ts`
