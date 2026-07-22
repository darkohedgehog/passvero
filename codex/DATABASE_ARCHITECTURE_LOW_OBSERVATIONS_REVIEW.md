# Passvero Database Architecture LOW Findings and Observations Review

Review date: 2026-07-22

## Executive Summary

Both LOW findings are technically grounded, but neither proves a schema defect
that must be corrected before Database Architecture Freeze.

L-01 covers several values with different normalization semantics. User email
deserves the strongest canonicalization guarantee, but exact database
uniqueness is sufficient when every authentication and administrative writer
stores one canonical form. Invitation email uses a case-insensitive pending
index and still depends on the same trim/canonicalization service. Product
identifiers, locales, and country codes require type- or feature-specific rules;
a universal lowercase, enum, `citext`, or functional-index strategy would encode
assumptions that are not shared by all values. L-01 is accepted as a service
invariant.

L-02 accurately observes that schema comments do not make AuditLog, ScanEvent,
or published version content physically immutable. The architecture
intentionally avoids triggers and assigns ordinary immutability to restricted
repository surfaces, transactional services, application database roles, and
tests. Migration and administrative credentials necessarily retain greater
authority, so absolute database immutability is neither achievable nor the
approved goal. L-02 is accepted as a service invariant.

All four Observations are confirmed. The Product/ProductVersion cycle is safe
with nullable pointers and create-then-point transactions. Aggregate cascades
are structurally correct but require guarded destructive workflows. All four
partial-unique-index groups correctly implement their scoped semantics.
AuditLog, Notification, IntegrationMapping, and BackgroundJob preserve clean
platform-service boundaries.

Final decisions:

- L-01: **Accepted as Service Invariant**
- L-02: **Accepted as Service Invariant**
- O-01: **Confirmed with Future Obligation**
- O-02: **Confirmed with Future Obligation**
- O-03: **Confirmed**
- O-04: **Confirmed with Future Obligation**

No structural audit finding requires a mandatory schema change before Database
Architecture Freeze v1.0. Documentation synchronization, the Database
Production Audit, the final Freeze record, and explicit approval remain pending.

## LOW Findings

### L-01 — Normalization-sensitive uniqueness relies on writers

#### Restatement

Several logical identities and standardized strings use raw database values.
User email uniqueness is case-sensitive, the pending Invitation index lowercases
but does not trim email, ProductIdentifier uniqueness uses the stored value, and
most locale or country strings are not database-normalized.

#### Technical correctness

The finding is technically correct, but the affected values must be evaluated
separately.

**User.email**

`User.email` is ordinary PostgreSQL `TEXT` with an exact unique index. The
schema comment requires application services to normalize before persistence.
Without canonical storage, values differing only by case or surrounding space
can coexist.

User email is the strongest candidate for database hardening because it is a
login identity. Even so, adding `citext` or `lower(email)` alone does not define
the full canonicalization contract: trimming, Unicode handling, provider-
verified address form, and whether provider-specific transformations are safe
remain authentication decisions.

**Invitation.email**

The partial unique index scopes pending invitations by Organization and
`lower(email)`. PostgreSQL therefore blocks case-only pending duplicates but
allows space variants. Its migration comment and Prisma schema explicitly
require consistent service normalization before persistence and comparison.
Terminal invitation history remains repeatable by design.

**ProductIdentifier.value**

Uniqueness is scoped by ProductVersion, identifier type, and raw value. There is
no universal normalization shared by GTIN, EAN, UPC, MPN, SKU, and CUSTOM.
Numeric identifiers may reject separators, while manufacturer and custom values
may have case-sensitive or provider-defined semantics. Lowercasing every value
would be incorrect.

**Locale fields**

Locale values appear in source, translation, preference, document-association,
and default-locale contexts. The application has an approved locale set, but
using Strings avoids a database enum migration for every future locale. Service
validation should use canonical BCP 47 or approved application constants and
must not silently treat differently formatted tags as different languages.

**Country codes and similar normalized strings**

ScanEvent already enforces an uppercase two-letter country format. Other country
and region fields have different authoring and lifecycle contexts. Services
should store approved ISO codes where the field contract requires them, but not
every country-like or provider-supplied string warrants the same database CHECK.

#### Realistic production risk

An unnormalized authentication writer could create two User rows for one
logical email, causing account ambiguity. An unnormalized invitation writer
could bypass pending deduplication with whitespace. Identifier searches or
duplicate detection could disagree across import paths. Noncanonical locale or
country values could cause missing translations, incorrect fallback, or
fragmented reporting.

These failures require inconsistent writers. They are not produced by normal
database operation when canonical values are stored.

#### Database responsibility

The database owns exact uniqueness, declared case-insensitive pending
Invitation uniqueness, and any narrow format constraint already frozen for a
specific field. Database hardening may be justified later for a universal,
stable identity rule, especially User email, but it must follow the approved
authentication canonicalization policy.

The database should not guess provider-specific identifier semantics or turn
the supported locale list into a closed vocabulary without an architectural
decision.

#### Application-service responsibility

Application services must:

- canonicalize and validate User email before every create, lookup, and update;
- apply the identical email function to Invitation creation and acceptance;
- normalize ProductIdentifier values according to `type`, without assuming all
  values are case-insensitive;
- validate locale and country fields against feature-appropriate constants;
- persist the canonical value rather than only normalizing during comparison;
- reject ambiguous or invalid external input before repository access.

#### Operational or permission responsibility

Imports, administrative tools, authentication callbacks, background processes,
and maintenance scripts must reuse the same canonicalization functions. Direct
write access must not become an alternate normalization path. Operational data-
quality checks should detect noncanonical email, identifier, locale, and country
values before downstream features rely on them.

#### Arguments supporting the audit

- A case-sensitive User index cannot independently guarantee one logical login
  identity.
- The Invitation functional index demonstrably omits trimming.
- Different writers can otherwise produce values that compare differently in
  PostgreSQL but identically in application or provider logic.
- Database uniqueness is concurrency-safe and protects all writers.
- Identity drift is difficult to repair after memberships or history attach to
  duplicate User rows.

#### Arguments against the audit

- The schema and migration comments explicitly assign email normalization to
  services.
- Exact uniqueness correctly protects already-canonical User email values.
- `citext` adds an extension and collation behavior without solving trimming or
  provider-specific canonicalization.
- Functional indexes are manual Prisma migration concerns and must exactly
  match every lookup expression.
- Product identifiers do not share one case or punctuation rule.
- Locale and country Strings preserve extensibility and avoid unnecessary enum
  migrations.
- A mixture of database normalization schemes can be harder to understand than
  one canonical service layer.

#### Existing architectural mitigation

The schema documents service normalization for User and Invitation email. The
pending Invitation index adds case-insensitive concurrency protection after
normalization. ProductIdentifier uniqueness is correctly type- and version-
scoped. Domain rules require standardized locale and country codes, server-side
validation, and normalized storage. AGENTS guidance requires external input
validation and server-side ownership checks.

#### Complexity and maintainability impact of changing the schema

A database-wide normalization change would require choosing among `citext`,
generated canonical columns, expression indexes, or duplicated normalized
fields. Each choice affects Prisma queries, migration portability, collation,
existing data cleanup, and future authentication-provider behavior.

Applying one approach to identifiers or locale/country values would be worse:
it would encode false universal semantics. A narrowly reviewed User-email
constraint may be useful later, but only after the authentication canonical form
and migration of existing values are approved.

#### Final recommendation

**Accepted as Service Invariant**

L-01 identifies real canonical-input obligations. The current schema is
acceptable if all writers persist canonical values and tests prove consistent
normalization. User email should receive dedicated authentication-contract and
concurrency tests. Product identifiers must use type-specific normalization;
locale and country validation must remain feature-specific.

#### Freeze effect

- Is a schema change mandatory before Freeze? **No.**
- Is a service or infrastructure obligation mandatory before production?
  **Yes.** Canonicalization utilities, guarded writers, import/admin reuse, and
  negative/duplicate tests are release requirements.
- Should this finding remain documented in the final Freeze record? **Yes.** It
  records the boundary between exact database uniqueness and canonical service
  input.

### L-02 — Append-only and published-immutability guarantees

#### Restatement

AuditLog and ScanEvent are described as append-only, and published
ProductVersion content is described as immutable, but the applied schema does
not prevent UPDATE or DELETE through triggers or table permissions. Published
version children can also be changed or removed if a writer bypasses services.

#### Technical correctness

The finding is technically correct.

**AuditLog**

AuditLog has no `updatedAt` field and is documented and tested as append-only,
but PostgreSQL accepts UPDATE or DELETE from a role with table privileges. Its
CHECK constraints validate content, not mutation history.

**ScanEvent**

ScanEvent likewise has no `updatedAt`, is documented as an append-only raw
event, and remains mutable to a sufficiently privileged role. Deleting its
QRCode cascades deletion of the event.

**Published ProductVersion**

The status enum and relationships do not prevent UPDATE or DELETE solely
because a version is PUBLISHED or SUPERSEDED. ProductVersion deletion is
restricted by Product ownership and current pointers where applicable, but
status-based immutability is not a database rule.

**Version children after publication**

ProductTranslation, ProductIdentifier, ProductMaterial, ProductDocument, and
ProductImage belong to ProductVersion and use aggregate-child cascade behavior.
Their tables cannot inspect the parent status through a CHECK. A privileged or
unguarded writer can update or delete them after publication.

#### Realistic production risk

A generic repository, compromised application credential, or unsafe
administrative script could rewrite an audit event, alter analytics evidence,
or change already published passport content without creating a new version.
Public output and historical records could then differ from what was originally
published.

No trigger or grant can make data absolutely immutable to a database superuser
or migration owner. The realistic objective is to prevent ordinary application
and operational paths from mutating retained history.

#### Database responsibility

PostgreSQL should enforce structural validity, ownership relations, and
constraints that do not require interpreting a multi-table workflow. Separate
runtime and migration roles can enforce append-only privileges more naturally
than triggers: the ordinary application role can receive INSERT/SELECT without
UPDATE/DELETE on event tables where operational requirements permit it.

Published-child immutability cannot be expressed by an ordinary CHECK because
the parent status is in another table. Trigger enforcement would duplicate
publication logic and complicate cloning, retention, repair, and migrations.

#### Application-service responsibility

Services and repositories must:

- expose create/read operations but no ordinary AuditLog or ScanEvent mutation;
- reject ProductVersion and child mutations when the parent is PUBLISHED or
  SUPERSEDED;
- implement corrections by cloning a new draft and publishing a new version;
- perform status checks and writes transactionally;
- prevent ordinary deletion of published ProductVersion, Passport, QRCode, and
  retained history.

#### Operational or permission responsibility

Production infrastructure must use least-privilege database roles where
practical. Migration and emergency-administration credentials must remain
separate from ordinary application credentials. Imports and maintenance tools
must use guarded service operations or equivalent reviewed validation.

Any exceptional historical repair or retention deletion must require explicit
authorization, affected-row preview, audit evidence, and a documented recovery
or retention reason. Database backups and access logging remain part of the
operational control set.

#### Arguments supporting the audit

- Schema comments and absence of `updatedAt` do not prevent mutation.
- Every Prisma model normally exposes update and delete operations unless the
  repository layer restricts them.
- Append-only data and published history are important enough to warrant strong
  controls beyond UI behavior.
- Role grants can protect ordinary application credentials without triggers.
- Bulk imports and maintenance scripts are realistic bypass paths.

#### Arguments against the audit

- The architecture explicitly assigns published immutability to services and
  avoids triggers without a separate decision.
- PostgreSQL CHECK constraints cannot inspect parent ProductVersion status from
  a child row.
- Triggers would duplicate domain workflow, obscure failures, and require
  bypass or special handling for cloning, retention, repair, and migrations.
- Append-only retention still needs authorized deletion for privacy, policy, or
  storage management.
- Migration/admin roles necessarily remain capable of changing data.
- Repository restrictions and runtime grants target the realistic threat model
  more directly than claims of absolute immutability.

#### Existing architectural mitigation

The model omits ordinary update timestamps from AuditLog and ScanEvent and
documents both as append-only. Focused tests exclude update-oriented fields and
forbidden relations. ProductVersion documentation requires new drafts for
corrections and explicitly assigns immutability to services. Aggregate
relationships preserve versioned snapshots, while ordinary Product and
Document deletion paths use conservative restrictions.

#### Complexity and maintainability impact of changing the schema

Triggers on every version-owned table would couple storage behavior to parent
status and require coordinated exceptions for publication, supersession,
cloning, cleanup, migrations, and emergency repair. They would create logic that
Prisma schema cannot represent and that every future migration must preserve.

Runtime grants are lower complexity but belong to deployment and security-role
design rather than the Prisma model. Repository interfaces and integration tests
remain necessary under either approach. The layered service/permission design
is therefore more maintainable than mandatory trigger enforcement.

#### Final recommendation

**Accepted as Service Invariant**

L-02 identifies real immutability obligations, but no schema trigger or new
field is required solely by the finding. Enforce append-only and published-
history rules through restricted repositories, transactional services, runtime
database roles where practical, negative tests, and controlled administrative
procedures.

#### Freeze effect

- Is a schema change mandatory before Freeze? **No.**
- Is a service or infrastructure obligation mandatory before production?
  **Yes.** Repository restrictions, publication guards, role separation,
  negative mutation tests, and controlled maintenance procedures are required.
- Should this finding remain documented in the final Freeze record? **Yes.** It
  records that immutability is a layered service, permission, and operational
  guarantee rather than a trigger guarantee.

## OBSERVATIONS

### O-01 — Product/ProductVersion FK cycle

#### Restatement

ProductVersion requires Product, while Product optionally points back to its
current draft and current published ProductVersions. This creates a deliberate
foreign-key cycle with nullable convenience pointers.

#### Technical verification

The observation is correct.

- Product can be inserted with both current-version pointers null.
- ProductVersion can then be inserted with its required Product foreign key.
- Product can subsequently point to that version in the same transaction.
- Both pointer foreign keys use `onDelete: SetNull`, so deleting a referenced
  version does not cascade into Product.
- ProductVersion's ownership relation uses `onDelete: Restrict`, so deleting a
  Product with versions is blocked rather than cascaded.
- No destructive cascade cycle exists.
- Prisma supports the intended sequence through an interactive or sequential
  transaction using create-then-update operations.

#### Architecture implication

The cycle models two different facts: Product owns the version collection, and
nullable Product pointers select current workflow state. It is not an accidental
mutual-ownership graph. Transaction sequencing is mandatory, and the service
must validate pointer ownership and status as already recorded by H-01.

#### Realistic risk or benefit

The benefit is direct, efficient resolution of current draft and published
versions while preserving full history. The realistic risk is a partially
completed create/publish operation if writes occur outside a transaction, or an
incorrect pointer if H-01 service validation is bypassed.

#### Whether any action is required before Freeze

No schema change is required. The final Freeze document should identify this as
an intentional nullable-pointer cycle and reference the transactional sequence.

#### Mandatory future obligation

Product creation, draft creation, publication, and pointer replacement services
must use atomic create-then-point transactions and test rollback, wrong-Product,
wrong-Organization, and wrong-status cases.

#### Final recommendation

**Confirmed with Future Obligation**

### O-02 — Aggregate cascade paths

#### Restatement

ProductVersion cascades to version-owned children, and Passport cascades to
QRCode, which cascades to ScanEvent. These paths match ownership but can delete
retained content or events if a protected parent is deleted.

#### Technical verification

The observation is correct.

- ProductTranslation, ProductIdentifier, ProductMaterial, ProductDocument, and
  ProductImage are ProductVersion-owned children and use `onDelete: Cascade`.
- ProductDocument's separate Document relation uses `Restrict`; deleting an
  association does not delete the reusable Document.
- Passport owns its single QRCode through a cascade.
- QRCode owns ScanEvent rows through a cascade.
- Organization and Product ownership relations remain restrictive, so there is
  no blanket tenant-root cascade.

#### Architecture implication

Cascade is appropriate for genuine aggregate children because they have no
independent lifecycle after their owner is legitimately removed. The public
Passport/QRCode/ScanEvent chain is also an ownership chain, but its retained
history makes parent deletion a high-impact administrative operation rather
than an ordinary cleanup action.

#### Realistic risk or benefit

Cascades simplify deletion of unpublished drafts and prevent orphaned child
rows. The realistic risk is that an unsafe administrative deletion of a
published ProductVersion, Passport, or QRCode also erases version content or raw
scan history. This is a consequence of bypassing the documented deletion and
retention service, not an accidental cascade route from Organization.

#### Whether any action is required before Freeze

No database change is required. Replacing all cascades with Restrict would make
legitimate aggregate cleanup cumbersome and would not itself define retention
authorization.

#### Mandatory future obligation

Destructive workflows must distinguish unpublished aggregate cleanup from
retained-history deletion. They must require authorization, descendant counts
or preview, retention checks, explicit confirmation, audit evidence, and tests
showing that ordinary post-publication deletion is forbidden.

#### Final recommendation

**Confirmed with Future Obligation**

### O-03 — Partial unique indexes

#### Restatement

The applied partial unique indexes for pending Invitations, active editable
ProductVersions, null-account IntegrationMappings, and active BackgroundJobs
correctly model state- or null-dependent uniqueness.

#### Technical verification

The observation is correct.

**Invitation**

`ux_invitation_one_pending_per_organization_email` indexes Organization and
`lower(email)` only when status is PENDING. It blocks concurrent case-only
pending duplicates within one Organization while allowing terminal invitation
history. Trim normalization remains the L-01 service obligation.

**ProductVersion**

`ux_product_version_one_active_draft` indexes `productId` only for DRAFT and
READY_FOR_REVIEW. It permits at most one editable version per Product while
allowing multiple PUBLISHED, SUPERSEDED, or DISCARDED historical rows.

**IntegrationMapping**

Ordinary composite unique indexes cover non-null `externalAccountId` contexts.
PostgreSQL treats null values as distinct in those indexes, so
`ux_integration_mapping_external_resource_without_account` and
`ux_integration_mapping_internal_entity_without_account` correctly supply the
two null-account identity rules. Both include Organization, provider, resource
type, and the relevant external or internal identity. Their all-status scope is
the stable-identity decision confirmed when M-05 was rejected.

**BackgroundJob**

`ux_background_job_platform_deduplication` and
`ux_background_job_organization_deduplication` separate nullable Organization
scope correctly. Both require a non-null deduplication key and apply only to
QUEUED or RUNNING jobs. Terminal jobs therefore do not block later equivalent
work.

Index names and migration definitions match the focused schema tests.

#### Architecture implication

These indexes use PostgreSQL-specific features only where Prisma cannot express
the required predicate or null behavior. Their scopes align with tenant,
account, aggregate, and active-state semantics without making historical rows
globally unique.

#### Realistic risk or benefit

They prevent concurrent duplicate active work and mappings that ordinary
application pre-checks cannot safely prevent alone. Their principal maintenance
risk is accidental loss or predicate drift in a later migration, already
mitigated by migration-source and focused tests.

#### Whether any action is required before Freeze

No action is required. The definitions should be retained unchanged.

#### Mandatory future obligation

No new obligation is created. Future migrations that change relevant statuses,
account scope, or lifecycle semantics must explicitly review and test the index
predicates.

#### Final recommendation

**Confirmed**

### O-04 — Platform-service boundaries

#### Restatement

AuditLog, Notification, IntegrationMapping, and BackgroundJob remain separate
platform-service records with no material responsibility leakage.

#### Technical verification

The observation is correct.

- AuditLog is an Organization-owned logical event with optional User actor and
  no domain-entity foreign-key graph.
- Notification is an Organization-owned, optionally User-targeted application
  message with no delivery provider, channel, retry, or transport-result state.
- IntegrationMapping stores provider-neutral external/internal identity and
  limited metadata, but no credentials, OAuth tokens, provider configuration,
  jobs, or domain foreign keys.
- BackgroundJob stores durable work identity and execution state, but no worker,
  queue processor, scheduler, cron model, notification-delivery state,
  credentials, AuditLog action fields, or domain foreign keys.
- ScanEvent remains privacy-minimized public analytics and is not folded into
  any of these platform-service records.
- Optional JSON is limited and explicitly excludes secrets and complete
  payloads; none of these models has a JSON GIN index or default payload.

Focused tests assert these negative boundaries and migration isolation.

#### Architecture implication

Each record has one purpose and can evolve without turning Product lifecycle or
AuditLog into a catch-all. Future notification delivery, integration
credentials/connections, workers, schedulers, webhook handling, retries, and
analytics aggregation require separate reviewed infrastructure.

#### Realistic risk or benefit

The benefit is reduced coupling, narrower sensitive-data exposure, and clearer
retention and authorization policy. The future risk is responsibility creep:
adding provider delivery fields to Notification, secrets to IntegrationMapping,
worker infrastructure to BackgroundJob, or user-facing inbox behavior to
AuditLog would erase these boundaries.

#### Whether any action is required before Freeze

No schema change is required. The final Freeze document should record these
separations as explicit preservation principles.

#### Mandatory future obligation

Every later platform-service phase must preserve these boundaries or introduce
a separately reviewed model and, where architecturally significant, an ADR.
Focused tests must continue to reject credentials, delivery state, provider
payloads, worker/scheduler concerns, domain lifecycle fields, and unintended
cross-domain relations.

#### Final recommendation

**Confirmed with Future Obligation**

## Final Decision Table

| Item | Original classification | Reviewed classification | Final decision | Schema change required | Future obligation | Freeze effect |
| --- | --- | --- | --- | --- | --- | --- |
| L-01 | LOW | LOW | Accepted as Service Invariant | No | Canonical writers, type-specific normalization, import/admin reuse, and tests before production | Retain as service boundary; does not block Freeze |
| L-02 | LOW | LOW | Accepted as Service Invariant | No | Restricted repositories, runtime roles, publication guards, mutation tests, and controlled maintenance | Retain as layered immutability boundary; does not block Freeze |
| O-01 | OBSERVATION | OBSERVATION | Confirmed with Future Obligation | No | Transactional create-then-point services/tests and explicit Freeze documentation | Does not block Freeze |
| O-02 | OBSERVATION | OBSERVATION | Confirmed with Future Obligation | No | Authorized destructive workflows with preview, retention, audit, and tests | Does not block Freeze |
| O-03 | OBSERVATION | OBSERVATION | Confirmed | No | Review predicates if future lifecycle scopes change | No action before Freeze |
| O-04 | OBSERVATION | OBSERVATION | Confirmed with Future Obligation | No | Preserve service boundaries in future models, ADRs, and focused tests | Does not block Freeze |

## Final Verdict

After completing review of HIGH, MEDIUM, LOW, and OBSERVATION items, does any
structural audit finding still require a mandatory database schema change before
Database Architecture Freeze v1.0?

**NO**

All technically valid invariants not already enforced by PostgreSQL have been
formally assigned to authenticated transactional services, restricted
repositories, runtime permissions, operational controls, or future feature
infrastructure. The confirmed Observations describe deliberate and structurally
sound patterns. Optional database hardening may be proposed later through
separate review, but it is not a Freeze prerequisite.

Non-schema prerequisites remain before final Freeze:

1. Complete the H-03 documentation synchronization against the committed
   schema, applied migrations, ADRs, and approved decisions.
2. Record the intentional FK cycle, guarded cascade consequences, platform-
   service boundaries, and all accepted service invariants in the final Freeze
   document.
3. Complete the Database Production Audit.
4. Issue explicit final Architecture Freeze approval.

Service, repository, permission, operational, and test obligations recorded in
this register remain mandatory production-release gates for their affected
features, even though they do not require pre-Freeze schema changes.
