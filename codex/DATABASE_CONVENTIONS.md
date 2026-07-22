# Passvero Database Conventions

## Purpose and precedence

This document defines how the implemented Passvero PostgreSQL/Prisma database
is maintained. It does not redesign business entities. The committed schema,
applied migrations, ADRs, and architecture decision register override generic
examples.

## Naming

- Models: singular PascalCase.
- Fields and relation fields: camelCase.
- Foreign keys: semantic name ending in `Id`.
- Enums: specific PascalCase names.
- Enum values: UPPER_SNAKE_CASE.
- Public identifiers remain separate from primary keys.
- Multiple relations between the same models always use explicit names.

Canonical names are listed in `SCHEMA_NAMING_REFERENCE.md`.

## Primary keys and identifiers

All 21 implemented models use UUID primary keys named `id`. Business
identifiers such as SKU, GTIN, EAN, public code, external resource IDs, and
logical entity IDs are Strings. Leading zeros must be preserved.

Public APIs do not expose internal UUIDs unless explicitly required by an
authenticated contract. Public Passport routing uses stable opaque public
identity rather than sequential database identity.

## Ownership

Organization is the tenant boundary. Services derive organization context from
the authenticated session and Membership and never trust ownership from a
request body.

An organization-owned model contains `organizationId` only when the implemented
schema defines direct ownership. ProductVersion content, QRCode, and ScanEvent
use approved inherited ownership paths. PLATFORM BackgroundJob deliberately has
no Organization.

## Timestamps

Mutable major entities use `createdAt` and `updatedAt`. AuditLog and ScanEvent
are append-only records and intentionally omit `updatedAt`.

Domain timestamps describe actual events: `publishedAt`, `archivedAt`,
`withdrawnAt`, `occurredAt`, `scannedAt`, `scheduledAt`, `completedAt`, and
other implemented lifecycle names. They are not replaced by `updatedAt`.
Timestamps are stored as absolute instants and displayed in the selected user
or Organization timezone.

## Decimal and numeric types

Use Decimal for exact percentages and commercial prices. ProductMaterial uses
`Decimal(5,2)`; Plan prices use `Decimal(12,2)`. Use BigInt for byte/usage
limits where implemented. Never use Float for these values.

Numeric limits and ordering fields use database CHECK constraints when the
invariant is universal: positive sizes/dimensions, non-negative prices and sort
orders, positive optional Plan limits, and valid BackgroundJob attempts.

## Enum strategy

Enums are used for stable lifecycle, role, presentation, device, scope, and
provider vocabularies already implemented in the schema. Changing an enum
requires a reviewed migration.

Frequently extensible identifiers remain normalized Strings. Current examples
include AuditLog action/entity type, Notification event/entity type,
IntegrationMapping provider/resource/entity type, and BackgroundJob queue/job
type/entity type. Countries, locales, categories, and material names also
remain Strings unless a future decision changes them.

## JSON strategy

JSON is limited to:

- `AuditLog.metadata`
- `Plan.features`
- `Notification.metadata`
- `IntegrationMapping.metadata`
- `BackgroundJob.payload`
- `BackgroundJob.result`

Core Product data remains relational. JSON values are small and allowlisted.
Never store credentials, tokens, authorization headers, cookies, signed URLs,
raw provider/request/response payloads, complete entity snapshots, file or
document contents, binary/base64 data, or stack traces. No JSON GIN index is
implemented.

## Relations and referential actions

Every implemented foreign key has explicit update and delete behavior.

- Restrict protects independent or retained roots and cross-aggregate assets.
- SetNull preserves history when optional User actors, targets, or clone
  provenance are removed.
- Cascade applies to ProductVersion-owned content, Passport-owned QRCode, and
  QRCode-owned ScanEvent.
- All implemented foreign-key updates cascade.

Database cascade behavior is structural cleanup, not service authorization to
delete published or retained history.

## Uniqueness and indexes

Unique constraints model approved business identity only. Ordinary indexes
match actual tenant, lifecycle, lookup, ordering, analytics, and operational
queries in the committed schema.

Partial unique indexes live in migration SQL because Prisma cannot express
them. Implemented partial indexes cover pending Invitation uniqueness, one
active ProductVersion draft, IntegrationMapping null-account uniqueness, and
active BackgroundJob deduplication by scope.

Do not document or add speculative indexes. In particular, there is no
primary-image partial unique index and no JSON GIN index.

## Manual CHECK constraints

Manual migration CHECK constraints enforce storage-level universal rules that
Prisma cannot express, including formats, bounds, paired optional fields,
lifecycle timestamp combinations, timestamp ordering, scope ownership, locks,
and attempt limits.

Cross-row or cross-table workflows that require business context remain
Approved Service Invariants. Do not duplicate them with triggers without a new
reviewed architecture decision.

## Approved Service Invariants

Mandatory application services enforce:

- tenant authorization and cross-table tenant equality;
- Product current-pointer ownership and lifecycle;
- ProductDocument tenant safety and public delivery eligibility;
- valid lifecycle transitions and chronology beyond database CHECKs;
- primary media and contextual association multiplicity;
- Notification targeting and safe URL use;
- BackgroundJob normalization and execution chronology;
- published aggregate immutability;
- AuditLog and ScanEvent append-only behavior;
- canonical email and type-specific identifier/locale/country storage.

Repositories remain thin but must not expose generic mutation paths that bypass
these services. Imports, workers, administrative tools, and maintenance scripts
are subject to the same rules.

## Transactions and concurrency

Use transactions for multi-row invariants, including onboarding, invitation
acceptance, Product create-then-point, draft cloning, publication, Passport
withdrawal, Document association, Subscription updates, IntegrationMapping
transitions, and BackgroundJob claiming/transitions.

Use database uniqueness and appropriate locking/concurrency checks. Do not keep
transactions open during slow external network calls.

## Archive, retention, and deletion

Soft delete is not a universal convention. Archive is used only on models that
implement an archive lifecycle. Hard deletion requires authorization and must
respect published history, retained operational records, and foreign-key
restrictions.

No blanket retention automation, TTL, partitions, scheduled cleanup, or
archive tables are implemented. Future destructive workflows require explicit
retention policy, impact preview, audit, and recovery planning.

## Migrations

- Use one small reviewed migration per approved concern.
- Never edit an applied migration.
- Prisma-declarative objects stay in the schema; unsupported CHECK and partial
  index objects are reviewed in migration SQL and tests.
- Migration generation and deployment are separate approval steps.
- Never use `db push`, `db pull`, reset, resolve, or manual mutation SQL as a
  workaround.
- Seed data is never part of a production structural migration.

The current implemented history contains 16 applied migrations.

## RLS

RLS is not currently implemented. Direct and inherited ownership paths remain
compatible with a future separately reviewed RLS phase. RLS must not be
presented as a substitute for authenticated service authorization.

## Serialization and security

Prisma records are persistence objects. Services map them to explicit private
or public DTOs. Public responses use allowlists and never expose draft data,
private Documents, token hashes, storage identity, actor IDs, billing/provider
identifiers, audit metadata, or platform-service payloads.

## Verification

Future schema changes require focused schema/migration tests and full Prisma,
test, typecheck, lint, build, and diff verification appropriate to the task.
Applied migration hashes must remain unchanged. Deployment requires separate
approval and post-deployment status verification.

## Final principle

Database constraints enforce universal structural integrity. Authenticated
transactional services enforce contextual business invariants. Operational
roles and tests reinforce append-only and immutable behavior. Each obligation
must have one documented owner and must not be silently weakened.
