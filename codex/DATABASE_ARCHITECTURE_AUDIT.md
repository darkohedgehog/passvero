# Passvero Database Structural Integrity Audit

Audit date: 2026-07-22

Scope: the 21 implemented Prisma models, 20 enums, 16 applied migrations, all
schema and migration tests, and the authoritative database documentation.
Performance, query optimization, RLS, APIs, services, authentication, workers,
schedulers, and frontend behavior were intentionally excluded.

# Executive Summary

The database has a mature and generally disciplined foundation: ownership is
usually explicit, aggregate children are narrow, foreign-key actions are
declared, historical actor references use `SetNull`, destructive Organization
cascades are avoided, migrations are small, and platform-service boundaries are
clear.

It is not ready for Architecture Freeze. The principal structural weakness is
that several tenant and publication invariants are represented by independent
foreign keys without a database guarantee that the referenced rows belong to
the same Product or Organization. A malformed write can therefore produce a
valid relational graph that is invalid for tenancy and publication. The most
direct exposure is `ProductDocument`, which can connect an Organization's
ProductVersion to another Organization's Document.

The second blocking concern is authoritative-documentation drift. Several
documents still describe pre-implementation fields, statuses, ownership paths,
and planned models that contradict the applied schema and reviewed migrations.
Freezing while those sources disagree would make future implementation unsafe.

- Architecture maturity: strong foundation, incomplete structural closure
- Production readiness: not structurally ready for freeze
- Structural integrity score: **68/100**
- Confidence level: **High**
- Validation: Prisma schema valid; all 16 migrations applied; database schema up to date

Finding count:

| Classification | Count |
| --- | ---: |
| CRITICAL | 0 |
| HIGH | 3 |
| MEDIUM | 6 |
| LOW | 2 |
| OBSERVATION | 4 |

# Findings

## CRITICAL

No CRITICAL finding was identified. Required parent relations have foreign
keys, Organization deletion is broadly restricted, and no direct cascade path
from Organization deletes the complete tenant graph.

## HIGH

### HIGH H-01 — Product ownership and publication pointers permit cross-tenant graphs

- Affected models: `Product`, `ProductVersion`, `Passport`
- Explanation: `ProductVersion.productId` and `ProductVersion.organizationId`
  independently reference valid rows, but the database does not require the
  Product and Organization to match. `Passport` has the same duplicated-owner
  gap. `Product.currentDraftVersionId` and `currentPublishedVersionId` reference
  any ProductVersion ID and do not enforce same Product, same Organization, or
  the required editable/published status.
- Invalid state accepted: Product A in Organization A can point to a published
  ProductVersion of Product B in Organization B; a Passport for Product A can
  carry Organization B's ID.
- Impact: tenant attribution, public Passport resolution, authorization filters,
  and future ownership policies can disagree about which tenant owns the same
  row. A service defect or import can expose the wrong published content.
- Recommendation: before freeze, decide and document a database-enforced
  composite-key strategy for same-Product/same-Organization references, or
  explicitly accept this as a service-only invariant with mandatory
  integration tests and a consistency audit. Pointer-status rules still require
  transactional service enforcement unless a reviewed database mechanism is
  introduced.

### HIGH H-02 — ProductDocument can connect content across Organizations

- Affected models: `ProductDocument`, `ProductVersion`, `Document`
- Explanation: the two foreign keys prove only that both parents exist.
  `Document.organizationId = ProductVersion.organizationId` is a schema comment
  and service rule, not a database constraint.
- Invalid state accepted: a public ProductDocument under Organization A can
  reference the storage asset owned by Organization B.
- Impact: this is a direct tenant-boundary violation and can make another
  tenant's document eligible for public Passport serialization.
- Recommendation: add a reviewed database guarantee based on composite
  organization keys, or an equivalent integrity mechanism. If the architecture
  intentionally keeps this service-only, it must be treated as a release gate
  with transaction-level cross-tenant rejection tests and periodic integrity
  detection.

### HIGH H-03 — Authoritative documentation materially contradicts the applied schema

- Affected models: most pre-Platform models, especially `Document`,
  `ProductDocument`, `ProductImage`, `QRCode`, `ScanEvent`, `AuditLog`, `Plan`,
  and `Subscription`
- Explanation: the implementation and migrations are internally aligned, but
  the authoritative documents are not. Examples include:
  - `DOMAIN_RULES.md` describes QRCode as Product/Organization-owned and lists
    obsolete Subscription states such as `GRACE_PERIOD` and `SUSPENDED`;
  - `PRISMA_DOMAIN_MODEL.md` describes ScanEvent with direct Passport/Product/
    Organization ownership, older AuditLog fields and enums, old Document
    statuses, a visibility enum and uniqueness for ProductDocument, and an
    asset-based ProductImage architecture;
  - `SCHEMA_NAMING_REFERENCE.md` still declares obsolete canonical fields and
    enums, including `DocumentVisibility`, old Document statuses, old
    Subscription statuses, `ProductImage.assetId`, and `ProductDocument.visibility`;
  - `DATABASE_ARCHITECTURE.md` still calls ScanEvent, AuditLog, billing, and
    Platform Services planned and its implemented inventory ends at QRCode;
  - `IMPLEMENTATION_ROADMAP.md` still marks BackgroundJob current after its
    migration has been applied.
- Impact: future agents and engineers can implement mutually incompatible
  contracts while each believes it is following an authoritative source.
- Recommendation: perform a documentation-only synchronization against the
  committed schema and applied migration history before Architecture Freeze.
  Record any intended schema change separately rather than silently editing the
  historical implementation contract.

## MEDIUM

### MEDIUM M-01 — Core lifecycle rows permit contradictory statuses and timestamps

- Affected models: `Organization`, `Invitation`, `Product`, `ProductVersion`,
  `Document`, `Passport`
- Explanation: several central lifecycle invariants have no CHECK constraint or
  are only one-directional. Examples include an ACCEPTED Invitation without
  `acceptedAt`, an ACTIVE Product with `archivedAt`, a PUBLISHED ProductVersion
  without `publishedAt` or `versionNumber`, a WITHDRAWN Passport without
  `withdrawnAt`, and a PENDING_UPLOAD Document carrying failure/archive
  timestamps. Document checks require a timestamp for selected statuses but do
  not forbid incompatible timestamps from other statuses.
- Impact: structurally valid rows can be ambiguous or impossible for services
  to interpret, weakening publication history and operational recovery.
- Recommendation: define a narrow set of lifecycle consistency and timestamp
  ordering constraints for states whose meaning is already frozen. Keep
  transition authorization in services.

### MEDIUM M-02 — Primary media and association multiplicity are not guaranteed

- Affected models: `ProductImage`, `ProductDocument`
- Explanation: `ProductImage.isPrimary` is indexed but not partially unique, so
  one ProductVersion can have multiple primary images despite the domain rule.
  ProductDocument permits duplicate `(productVersionId, documentId)` rows and
  multiple `isPrimary` rows without a documented database-level scope.
- Impact: public serializers can receive ambiguous primary content and duplicate
  documents even when every row individually validates.
- Recommendation: decide the exact primary scope and whether duplicate document
  associations are legitimate. Add partial/composite uniqueness only for the
  invariants that are truly required.

### MEDIUM M-03 — Notification targeting and internal URL semantics are under-enforced

- Affected models: `Notification`, `User`, `Membership`
- Explanation: any User can be targeted by any Organization because membership
  or historical relationship is service-only. The action URL CHECK accepts any
  string beginning with `/`, including scheme-relative values such as
  `//external.example`, which browsers can interpret as an external host.
- Impact: a malformed write can cross-target a user or turn an intended internal
  navigation target into an external redirect.
- Recommendation: require service-level organization-target validation as a
  tested invariant and tighten the internal-path rule to reject `//` while
  continuing to allow explicit HTTPS URLs.

### MEDIUM M-04 — Billing provider identity and commercial history can be ambiguous

- Affected models: `Subscription`, `Plan`, `IntegrationMapping`
- Explanation: `externalCustomerId` and `externalSubscriptionId` have no
  provider-scoped uniqueness, so provider events can map to multiple
  subscriptions. Subscription also points to a mutable current Plan row without
  a plan-version or commercial snapshot; this is acceptable for current
  entitlements but not sufficient historical evidence of what terms applied.
- Impact: webhook correlation may be ambiguous, and later Plan edits can alter
  the interpretation of historical subscription periods.
- Recommendation: define provider/configuration-scoped identity uniqueness and
  explicitly choose whether historical commercial terms belong in a future
  billing-history model. Do not turn Subscription into a payment ledger.

### MEDIUM M-05 — Archived IntegrationMappings permanently block equivalent replacements

- Affected model: `IntegrationMapping`
- Explanation: both external-resource and internal-entity unique constraints
  apply to all statuses. An ARCHIVED row therefore prevents creation of an
  equivalent new mapping. Reactivating the same row clears the archive state and
  weakens the meaning of retained historical mapping.
- Impact: reconnecting or replacing an external integration may require mutating
  history or inventing different identity values.
- Recommendation: decide whether archive means reusable inactive identity or
  immutable historical record. If replacement rows are required, scope
  uniqueness to non-archived mappings while separately preserving any true
  historical uniqueness requirement.

### MEDIUM M-06 — BackgroundJob accepts malformed logical references and impossible event order

- Affected model: `BackgroundJob`
- Explanation: `entityType`/`entityId` are paired but have no trim, nonblank,
  length, or uppercase-format checks despite the documented normalized-string
  contract. Terminal timestamps must follow `createdAt` but need not follow
  `startedAt`, so a SUCCEEDED job can complete before it started. Empty
  `deduplicationKey` and `lockOwner` values are also accepted.
- Impact: operational identity and chronology can become ambiguous, and empty
  deduplication keys can unintentionally collide active work.
- Recommendation: add focused format/nonblank constraints and require terminal
  timestamps to be no earlier than `startedAt` when a start exists.

## LOW

### LOW L-01 — Normalization-sensitive uniqueness relies entirely on writers

- Affected models: `User`, `Invitation`, `ProductIdentifier`, localized fields
- Explanation: User email uniqueness is case-sensitive at the database layer;
  Invitation pending uniqueness lowercases email but does not trim it;
  ProductIdentifier uniqueness uses raw values. Locale/country strings outside
  ScanEvent are generally unconstrained.
- Impact: noncanonical values or duplicate logical identities are possible if a
  writer bypasses normalization.
- Recommendation: centralize normalization and add contract tests for every
  write path. Consider database normalization only where the canonical rule is
  stable and universal.

### LOW L-02 — Append-only and published-immutability guarantees are policy, not storage guarantees

- Affected models: `AuditLog`, `ScanEvent`, published `ProductVersion` children
- Explanation: comments and domain rules prohibit ordinary updates/deletes, but
  the schema itself permits them. This is an intentional service/privilege
  boundary, not a migration defect.
- Impact: privileged scripts or future repositories can mutate history without
  violating a table constraint.
- Recommendation: preserve the current no-trigger design, but make repository
  surfaces and database-role permissions explicit and test that ordinary
  application paths cannot update these records.

## OBSERVATION

### OBSERVATION O-01 — The Product/ProductVersion FK cycle is deliberate and currently safe

- Affected models: `Product`, `ProductVersion`
- Explanation: ProductVersion requires Product, while nullable Product pointers
  reference ProductVersion. The cycle requires create-then-point transactions,
  but nullable pointers plus `SetNull` avoid an unresolvable insert or cascade
  cycle.
- Impact: transaction sequencing is mandatory but the model is workable.
- Recommendation: retain the explicit transaction boundary and do not add a
  cascading pointer action.

### OBSERVATION O-02 — Existing cascade paths follow aggregate ownership but can erase retained events

- Affected models: ProductVersion children, `QRCode`, `ScanEvent`
- Explanation: ProductVersion children cascade correctly because they have no
  independent owner. Passport deletion cascades QRCode, which cascades ScanEvent.
  This is consistent with the documented raw-event retention model, but only if
  ordinary Passport deletion remains prohibited after publication.
- Impact: administrative parent deletion is intentionally high impact.
- Recommendation: retain the cascades, but include descendant-loss preview and
  retention authorization in any future destructive workflow.

### OBSERVATION O-03 — All implemented partial unique indexes are structurally correct

- Affected models: `Invitation`, `ProductVersion`, `IntegrationMapping`,
  `BackgroundJob`
- Explanation: pending invitations are unique per lowercased organization email;
  only one DRAFT/READY_FOR_REVIEW ProductVersion can exist per Product;
  IntegrationMapping handles PostgreSQL NULL semantics with separate no-account
  indexes; BackgroundJob deduplicates active PLATFORM and ORGANIZATION jobs
  separately.
- Impact: the intended active-row uniqueness is enforced without making terminal
  history globally unique.
- Recommendation: retain these indexes. The archive behavior in M-05 is a
  separate lifecycle question.

### OBSERVATION O-04 — Platform-service responsibility boundaries are otherwise clean

- Affected models: `Notification`, `IntegrationMapping`, `BackgroundJob`,
  `AuditLog`
- Explanation: Notification has no delivery/provider state; IntegrationMapping
  has no credentials or domain FKs; BackgroundJob implements persistence rather
  than a worker/queue/scheduler; AuditLog remains a logical append-only event
  record. Optional JSON is limited to explicitly approved models and has no GIN
  indexes or defaults.
- Impact: future delivery, integration, and execution infrastructure can be
  added without coupling Product lifecycle to those services.
- Recommendation: preserve these boundaries.

# Model Review

1. **User** — Correct global identity root. Membership supplies tenant context;
   actor relations use `SetNull`. L-01 applies to email normalization.
2. **Organization** — Correct tenant root. All retained organization-owned roots
   restrict deletion. M-01 applies to status/archive consistency.
3. **Membership** — Correct Organization/User join; pair uniqueness prevents
   duplicates. Last-owner and invited-actor membership rules correctly remain
   service invariants. No additional finding.
4. **Invitation** — Correct Organization ownership, token-hash uniqueness, and
   pending partial uniqueness. M-01 and L-01 apply.
5. **Product** — Correct stable-identity role and conservative deletion. H-01 and
   M-01 apply.
6. **ProductVersion** — Correct aggregate root for versioned content; active-draft
   partial uniqueness is sound. H-01, M-01, and L-02 apply.
7. **ProductTranslation** — Correct ProductVersion child with version-local locale
   uniqueness and cascade behavior. L-01 applies to locale normalization.
8. **ProductIdentifier** — Correct ProductVersion child and appropriately scoped
   uniqueness. L-01 applies to raw-value normalization.
9. **ProductMaterial** — Correct ProductVersion child. Decimal ranges and recycled
   consistency are enforced; aggregate totals correctly remain a service rule.
   No additional finding.
10. **Document** — Correct reusable Organization-owned asset; storage identity is
    unique and associations restrict deletion. M-01 applies to lifecycle state.
11. **ProductDocument** — Correct version-specific join and Document deletion
    protection. H-02 and M-02 apply.
12. **ProductImage** — Correct version-owned media record with safe storage and
    media checks. M-02 applies to primary-image ambiguity.
13. **Passport** — Correct one-to-one public state object between Product and
    QRCode. H-01 and M-01 apply.
14. **QRCode** — Correct Passport access point, one-per-Passport MVP cardinality,
    unique code/URL, and coherent lifecycle checks. O-02 applies to deletion.
15. **ScanEvent** — Correct privacy-minimized QRCode child with no consumer
    identity or direct Product coupling. L-02 and O-02 apply.
16. **AuditLog** — Correct Organization-owned logical event with optional actor and
    no domain FK explosion. L-02 and O-04 apply.
17. **Plan** — Correct global configuration model with numeric/JSON/archive
    validation. M-04 applies to historical interpretation, not current ownership.
18. **Subscription** — Correct one-current-row-per-Organization ownership and
    separation from payment ledger details. M-04 applies.
19. **Notification** — Correct Organization-owned, optionally user-targeted inbox
    message independent from delivery. M-03 and O-04 apply.
20. **IntegrationMapping** — Correct Organization-owned provider-neutral logical
    mapping with no credentials or domain FKs. M-05 and O-04 apply.
21. **BackgroundJob** — Correct PLATFORM/ORGANIZATION-scoped persistence model with
    active deduplication and no worker/scheduler concerns. M-06 and O-04 apply.

# Aggregate Review

- **Organization aggregate:** ownership direction is correct and all retained
  roots use `Restrict`. H-02 is the principal boundary escape.
- **Product aggregate:** Product is stable identity; ProductVersion owns all
  versioned content. H-01 and M-01 prevent declaring the aggregate structurally
  closed.
- **ProductVersion aggregate:** Translation, Identifier, Material,
  ProductDocument, and ProductImage are correctly attached. Cascade is appropriate
  for deletable versions, conditional on service protection of published rows.
- **Document aggregate:** Document remains independently reusable. The
  ProductDocument join correctly prevents Document deletion, but tenant equality
  is missing (H-02).
- **Passport/QRCode/ScanEvent aggregate:** the public chain Product → Passport →
  QRCode → ScanEvent is conceptually correct and avoids direct Product analytics
  coupling. Deletion consequences are documented in O-02.
- **Operational aggregates:** AuditLog and ScanEvent remain separate from business
  lifecycle state.
- **Billing aggregate:** Plan is global and Subscription is Organization-owned;
  permissions remain in Membership. M-04 is unresolved.
- **Platform Services:** Notification, IntegrationMapping, and BackgroundJob are
  loosely coupled logical-reference models with clean responsibility boundaries.

# Referential Integrity Review

All declared relations specify `onDelete` and `onUpdate`; all updates cascade.

- **Restrict is appropriate:** Membership→Organization/User,
  Invitation→Organization, Product→Organization,
  ProductVersion→Product/Organization, Passport→Product/Organization,
  Document→Organization, ProductDocument→Document,
  AuditLog→Organization, Subscription→Organization/Plan,
  Notification→Organization, IntegrationMapping→Organization, and
  BackgroundJob→Organization.
- **SetNull is appropriate:** Membership/Invitation provenance, Product,
  ProductVersion, Document and Passport actor references, clone provenance,
  Product current-version pointers, AuditLog actor, and Notification target.
  These choices preserve history after optional referenced rows disappear.
- **Cascade is appropriate with service guards:** ProductVersion→Translation,
  Identifier, Material, ProductDocument and ProductImage; Passport→QRCode; and
  QRCode→ScanEvent. O-02 records the retained-history consequence.
- **Missing composite integrity:** H-01 and H-02 identify the foreign keys that
  prove existence but not same-tenant/same-aggregate equality.

# Tenant Isolation Review

Direct ownership is present on Organization-level roots, and inherited ownership
is clear for ProductVersion children and the public analytics chain. There are no
cross-Organization sharing models.

Tenant isolation is nevertheless not structurally complete because H-01 and
H-02 allow inconsistent ownership paths. Notification's optional User target is
another service-level tenant invariant (M-03). Optional actor relations to global
Users are acceptable because actors may be removed or may belong to multiple
Organizations; authorization must never be inferred from those references.

# Versioning Review

The stable Product versus immutable ProductVersion split is strong. The
active-draft partial unique index correctly includes DRAFT and READY_FOR_REVIEW,
and `(productId, versionNumber)` protects assigned version numbers.

The database does not ensure pointer ownership/status, positive or required
published version numbers, lifecycle timestamp consistency, or immutability of
published rows. This is partly an intentional service boundary, but H-01 and
M-01 mean malformed persistence remains possible and must be resolved or
explicitly accepted before freeze.

# Deletion Safety Review

Organization deletion is safely blocked by retained business, billing, audit,
notification, integration, and job records. User deletion does not cascade into
business history. Document deletion is blocked while associations exist. Product
and ProductVersion use conservative `Restrict` in the ownership direction.

Dependent version content cascades correctly. Passport→QRCode→ScanEvent is the
only long descendant cascade with operational-history consequences; it is
acceptable only while post-publication Passport deletion remains a protected
service operation (O-02). The schema contains no blanket soft-delete or
unreviewed cleanup mechanism.

# Future Extensibility Review

Flexible String vocabularies for Notification events, integration providers and
entities, and BackgroundJob queue/job types avoid unnecessary enum migrations.
Logical entity references keep platform services decoupled. Document reuse and
ProductVersion child ownership can support additional product content without
changing Product identity.

Growth risks are concentrated in BillingProvider and ProductIdentifierType enum
expansion, one-QRCode-per-Passport MVP cardinality, current-only Subscription,
IntegrationMapping archive semantics, and absent database closure of tenant
equality. These are manageable if resolved or explicitly recorded before freeze.

# Architecture Strengths

- Stable Product identity is cleanly separated from immutable versioned content.
- Passport owns public state; QRCode owns the public access point; ScanEvent owns
  privacy-minimized access observations.
- Reusable Document storage is separated from version-specific ProductDocument
  meaning.
- Organization deletion is conservative and historical actor deletion uses
  `SetNull`.
- Partial unique indexes correctly model active-state uniqueness and PostgreSQL
  NULL semantics.
- Manual CHECK constraints provide strong validation for media, materials,
  notifications, integrations, jobs, plans, subscriptions, QR codes, audit data,
  and scan privacy.
- AuditLog, Notification, IntegrationMapping, and BackgroundJob responsibilities
  are distinct.
- Migration history is small, additive, applied, and protected by source-hash
  tests.

# Remaining Risks

The real remaining risks are:

1. tenant ownership can disagree across ProductVersion, Passport, Product
   pointers, and ProductDocument;
2. central lifecycle rows can contain contradictory status/timestamp state;
3. public media/document selection can be ambiguous;
4. provider identity and retained mapping history need clearer uniqueness rules;
5. BackgroundJob logical references and chronology are not fully normalized;
6. authoritative documentation conflicts with the implemented database.

# Final Verdict

**REQUIRES CHANGES**

The schema is coherent enough for continued reviewed development, but it is not
ready for Architecture Freeze or the Database Production Audit. At minimum,
H-01, H-02, and H-03 require an explicit resolution. Medium findings should be
either corrected or formally accepted as service-level invariants with concrete
tests and ownership before the freeze decision is revisited.
