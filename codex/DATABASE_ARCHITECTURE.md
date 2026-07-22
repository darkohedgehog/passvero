# Passvero Database Architecture

## Purpose

This document is the concise architectural overview of the implemented
Passvero PostgreSQL database. Detailed fields, relations, constraints, and
indexes are recorded in `PRISMA_DOMAIN_MODEL.md` and
`SCHEMA_NAMING_REFERENCE.md`.

Authoritative precedence is:

1. `prisma/schema.prisma`
2. applied migrations
3. `codex/DECISIONS.md`
4. `codex/ARCHITECTURE_DECISIONS_FROM_AUDIT.md`
5. remaining documentation

## Current structural status

- Structural implementation: **complete**
- Implemented models: **21**
- Applied migrations: **16**
- Structural Integrity Review: **complete**
- Architecture Decision Review: **complete**
- Mandatory schema blockers: **none**
- Documentation synchronization: **complete**
- Database Production Audit: **pending**
- Database Architecture Freeze v1.0: **pending**

This status does not approve Architecture Freeze. Accepted Service Invariants
remain mandatory production obligations.

## Implemented domain map

```txt
Identity and tenancy
User ── Membership ── Organization ── Invitation

Product and versioned content
Organization ── Product ── ProductVersion
                               ├── ProductTranslation
                               ├── ProductIdentifier
                               ├── ProductMaterial
                               ├── ProductDocument ── Document
                               └── ProductImage

Public access and analytics
Product ── Passport ── QRCode ── ScanEvent

Infrastructure and billing
Organization ── AuditLog
Plan ── Subscription ── Organization

Platform services
Organization ── Notification ── User (optional target)
Organization ── IntegrationMapping
Organization ── BackgroundJob (only ORGANIZATION scope)
BackgroundJob (PLATFORM scope has no Organization)
```

## Implemented inventory

Identity: User, Organization, Membership, Invitation.

Product core: Product, ProductVersion, Passport.

Version content: ProductTranslation, ProductIdentifier, ProductMaterial.

Documents and media: Document, ProductDocument, ProductImage.

Public access and analytics: QRCode, ScanEvent.

Infrastructure: AuditLog.

Billing: Plan, Subscription.

Platform services: Notification, IntegrationMapping, BackgroundJob.

## Tenant and ownership architecture

Organization is the tenant boundary. Private service operations derive tenant
context from authenticated membership and never trust a client-supplied
organization identifier.

Direct `organizationId` ownership exists on Membership, Invitation, Product,
ProductVersion, Passport, Document, AuditLog, Subscription, Notification,
IntegrationMapping, and ORGANIZATION-scoped BackgroundJob.

Derived ownership paths are:

```txt
ProductTranslation  ─┐
ProductIdentifier   ─┤
ProductMaterial     ─┤── ProductVersion ── Organization
ProductDocument     ─┤
ProductImage        ─┘

QRCode ── Passport ── Organization
ScanEvent ── QRCode ── Passport ── Organization
```

User and Plan are platform-global. PLATFORM BackgroundJob rows deliberately
have `organizationId = NULL`; ORGANIZATION rows require a non-null Organization
through a database CHECK constraint.

## Aggregate roots and boundaries

### Organization

Organization is the tenant aggregate root. Retained organization-owned roots
use restrictive deletion. An Organization cannot be silently deleted while
Products, ProductVersions, Passports, Documents, AuditLogs, Subscription,
Notifications, IntegrationMappings, or BackgroundJobs depend on it.

### Product

Product is stable business identity. It owns `publicCode`, internal naming,
organization-scoped normalized SKU, lifecycle state, and nullable current draft
and published pointers.

The nullable Product/ProductVersion pointer cycle is intentional. Services
create Product, create ProductVersion, then set the pointer inside one
transaction. Pointer foreign keys use SetNull, so there is no destructive
cascade cycle.

### ProductVersion

ProductVersion is the aggregate root for ProductTranslation,
ProductIdentifier, ProductMaterial, ProductDocument, and ProductImage. These
children cascade only with their ProductVersion. ProductVersion itself is
protected from Product deletion by Restrict.

### Document

Document is a reusable organization-owned physical asset. ProductDocument is
the version-specific business relationship. Removing ProductDocument never
deletes Document.

### Passport and QRCode

Passport is one-to-one with Product and stores public publication state.
QRCode is one-to-one with Passport for the implemented MVP and stores the exact
public HTTPS target. ScanEvent belongs only to QRCode.

### Platform services

AuditLog, Notification, IntegrationMapping, and BackgroundJob each have one
narrow purpose. They do not own Product data and do not replace one another.

## Product lifecycle and publication

Product lifecycle uses ACTIVE and ARCHIVED. ProductVersion lifecycle uses
DRAFT, READY_FOR_REVIEW, PUBLISHED, SUPERSEDED, and DISCARDED. Passport uses
ACTIVE, WITHDRAWN, and ARCHIVED. QRCode uses PENDING, ACTIVE, and REVOKED.

One Product may simultaneously have one published version and one active
draft-like version. The manual partial index
`ux_product_version_one_active_draft` permits only one DRAFT or
READY_FOR_REVIEW row per Product.

Publication is a transactional service workflow. It validates ownership and
readiness, assigns the product-scoped version number, publishes the draft,
supersedes the previous version, updates Product pointers and timestamps,
maintains Passport and QR state, and writes audit history. A failed transaction
must leave the previous public version current.

Published and superseded ProductVersion aggregates are immutable. PostgreSQL
does not use status-aware triggers for this rule. Guarded services,
repositories, negative tests, and runtime permissions enforce it.

## Documents and media

Document stores reusable file identity and upload lifecycle. Its storage tuple
is unique, and CHECK constraints enforce SHA-256, positive size, and lifecycle
timestamps.

ProductDocument stores category, optional locale, label, description, public
visibility, primary hint, and ordering for one ProductVersion. Services must
verify Document and ProductVersion tenant equality transactionally. They also
define allowed contextual multiplicity and primary selection.

ProductImage is specialized version-owned media with its own storage metadata,
dimensions, checksum, MIME allowlist, visibility, primary hint, and ordering.
It is not a Document association. One-primary behavior is a mandatory service
invariant.

## Public analytics and audit

ScanEvent is privacy-minimized, append-only analytics attributed to QRCode. It
stores coarse device, referrer, country, region, browser, operating-system,
language, and host data. It has no raw IP, User relation, direct Product or
Passport relation, direct `organizationId`, or `updatedAt`.

AuditLog is append-only organization history with an optional User actor and a
logical `(entityType, entityId)` reference. `action` and `entityType` are
normalized Strings rather than closed enums. AuditLog contains no update
timestamp and is never public.

Append-only behavior is enforced through restricted repository APIs, runtime
database roles where practical, tests, and controlled maintenance procedures.
No mechanism can make history immutable to the database owner or superuser.

## Billing architecture

Plan is a global commercial configuration record with status, prices, limits,
allowlisted feature JSON, visibility, ordering, and archive state.

Subscription is the single current commercial-state row for an Organization.
It references Plan, records billing provider, current period,
`cancelAtPeriodEnd`, terminal `canceledAt`, and limited external identifiers.

Subscription is not a ledger. Invoices, payments, provider events,
idempotency, and historical commercial evidence require future reviewed
billing infrastructure. IntegrationMapping does not replace that future
infrastructure.

## Notification boundary

Notification is an organization-owned application message and may target one
User. `NotificationType` expresses presentation style;
`NotificationStatus` expresses inbox lifecycle; `eventType` carries business
context. Logical entity fields are not foreign keys.

Notification is not email, push, SMS, webhook, provider delivery, AuditLog,
BackgroundJob, or domain lifecycle state. Services validate target-User tenant
eligibility and safe internal/HTTPS navigation.

## IntegrationMapping boundary

IntegrationMapping is retained organization-owned mapping between a Passvero
logical entity and an external resource. Provider and resource/entity types are
normalized Strings. The model stores no credentials, OAuth tokens, provider
configuration, jobs, or provider payloads.

Uniqueness intentionally spans lifecycle states, including ARCHIVED. Partial
indexes compensate for PostgreSQL null semantics when `externalAccountId` is
null. Replacing archived rows is not an approved architecture requirement.

## BackgroundJob boundary

BackgroundJob persists requested asynchronous work and execution state. It
supports PLATFORM and ORGANIZATION scope, normalized queue/job type, scheduling,
attempt limits, optional allowlisted payload/result, logical entity context,
active locks, lifecycle timestamps, normalized errors, correlation, and active
deduplication.

It does not implement a queue provider, worker, scheduler, cron, automatic
retry, webhook processor, notification delivery, integration connection,
AuditLog, or domain lifecycle. Those are application or future infrastructure.

## Database-enforced integrity

The database uses UUID primary keys, foreign keys with explicit referential
actions, unique constraints, exact query indexes, partial unique indexes, and
manual PostgreSQL CHECK constraints.

Implemented partial unique indexes cover:

- one pending Invitation per Organization and normalized email comparison;
- one active draft-like ProductVersion per Product;
- IntegrationMapping null-account external and internal identities;
- PLATFORM and ORGANIZATION active BackgroundJob deduplication.

Terminal invitation, mapping, and job history remains permitted according to
the corresponding predicate and uniqueness contract.

## Approved Service Invariants

The decision register assigns the following mandatory obligations to
authenticated transactional services rather than treating them as schema
defects:

1. ProductVersion and Passport organization ownership equals Product ownership.
2. Product current pointers belong to the same Product and correct lifecycle.
3. ProductDocument parents belong to the same Organization, and public
   delivery reauthorizes publication and visibility.
4. Lifecycle transitions and chronology not fully covered by CHECK constraints
   remain valid.
5. ProductImage primary selection and ProductDocument primary/contextual
   multiplicity remain consistent.
6. Notification User targeting and URL consumption are tenant-safe.
7. BackgroundJob logical references, deduplication keys, worker identifiers,
   and execution chronology are normalized and valid.
8. Published ProductVersion aggregates remain immutable.
9. AuditLog and ScanEvent remain append-only.
10. Email, identifier, locale, country, and similar strings use the approved
    field-specific canonical form across every writer.

These obligations apply equally to repositories, imports, background
processes, administration tools, and maintenance scripts. Mandatory service
and integration tests are production-release gates.

## Delete and retention strategy

Restrict is used for independent and retained business roots. SetNull preserves
history after deletion of optional actors or provenance. Cascade is reserved
for true aggregate children: version-owned content, Passport-owned QRCode, and
QRCode-owned ScanEvent.

Cascade configuration does not grant service authorization to delete published
or retained history. Future destructive workflows require authorization,
affected-row preview, audit, retention review, and recovery planning.

Retention automation, partitions, TTL, archive tables, and scheduled cleanup
are not implemented. RLS is also not implemented; it requires a separate
reviewed phase.

## JSON and sensitive-data boundary

Implemented JSON fields are `AuditLog.metadata`, `Plan.features`,
`Notification.metadata`, `IntegrationMapping.metadata`,
`BackgroundJob.payload`, and `BackgroundJob.result`. They contain only small
allowlisted values appropriate to the owning model. No JSON GIN index is
implemented.

Passwords, hashes, access or refresh tokens, API keys, provider secrets,
authorization headers, cookies, signed URLs, complete provider/request/response
payloads, files, binary content, sensitive personal data, and stack traces do
not belong in these JSON fields.

## Transaction boundaries

Transactions are mandatory for organization onboarding, invitation acceptance,
ownership transfer, Product create-then-point sequencing, draft cloning,
publication, Passport withdrawal/reactivation, Document association,
Subscription updates, Notification lifecycle changes that touch related state,
IntegrationMapping transitions, and BackgroundJob claim/transition handling.

Do not hold a database transaction open across slow external network calls.

## DTO and public boundaries

Prisma records are persistence objects, not API responses. Public Passport and
Document responses use explicit allowlists. Draft content, private Documents,
storage identity, actor IDs, token hashes, billing identifiers, provider data,
audit metadata, and platform-service payloads must not leak publicly.

## Architecture review outcome

Structural Integrity Review and all HIGH, MEDIUM, LOW, and Observation decision
reviews are complete. No reviewed structural finding requires a database schema
change before Freeze. Rejected audit conclusions are not architecture:

- Subscription is not a financial ledger.
- Billing history is future infrastructure.
- IntegrationMapping archive uniqueness is intentional.
- Documentation drift was governance work, not a runtime schema defect.

Database Production Audit is the current next task. Database Architecture
Freeze v1.0 remains pending and must not be declared complete before that audit,
the final Freeze record, and explicit approval.
