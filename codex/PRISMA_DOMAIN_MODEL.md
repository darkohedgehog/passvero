# Prisma Domain Model

This document defines the database architecture for Passvero.

It is the authoritative source describing the domain model that will later be implemented in Prisma.

This document intentionally does **not** contain Prisma syntax.

Instead, it describes:

- entities
- ownership
- relationships
- identifiers
- constraints
- indexes
- lifecycle
- deletion rules
- versioning
- extensibility

Codex must implement the Prisma schema according to this document.

When this document conflicts with implementation, the implementation must be corrected unless a documented architectural decision updates this specification.

---

# 1. Goals

The domain model must satisfy the following goals:

- support multi-tenant architecture
- guarantee organization isolation
- preserve immutable publication history
- support future Digital Product Passport regulations
- scale to millions of products
- support future integrations
- remain understandable
- avoid premature complexity
- minimize future migrations
- preserve long-term data integrity

The model should prioritize correctness over convenience.

---

# 2. Architectural Principles

The database is not merely storage.

It represents the core business domain.

Every entity must have:

- clear ownership
- clear lifecycle
- clear purpose

No entity should exist without a business reason.

---

# 3. Domain Layers

The domain consists of four logical layers.

## Layer 1

Identity

Responsible for:

- users
- organizations
- memberships
- invitations

---

## Layer 2

Business

Responsible for:

- products
- versions
- materials
- documents

---

## Layer 3

Public Passport

Responsible for:

- published versions
- QR codes
- public access
- scans

---

## Layer 4

Operational

Responsible for:

- audit logs
- subscriptions
- notifications
- analytics
- integrations

These layers must remain loosely coupled.

---

# 4. Entity Categories

Entities belong to one of the following categories.

## Identity

Examples:

- User
- Organization
- Membership
- Invitation

---

## Business

Examples:

- Product
- ProductVersion
- Material
- Document

---

## Public

Examples:

- Passport
- QRCode
- ScanEvent

---

## Operational

Examples:

- AuditLog
- Subscription
- Notification

---

## System

Examples:

- BackgroundJob
- IntegrationMapping

---

# 5. Ownership Rules

Every entity must clearly define ownership.

Possible ownership types:

## Global

Shared by the entire application.

Example:

Future plan definitions.

---

## Organization-owned

Belongs to exactly one organization.

Examples:

Products

Documents

Versions

Audit events

---

## User-owned

Belongs to one user.

Examples:

Preferences

---

## Derived ownership

Ownership inherited through another entity.

Example:

Material

↓

ProductVersion

↓

Product

↓

Organization

The database may store organizationId redundantly only when justified for performance or security.

---

# 6. Entity Lifecycle

Every entity must define its lifecycle.

Possible lifecycle types:

## Permanent

Created once.

Never changes ownership.

Example:

Product

---

## Mutable

Can be edited.

Example:

Organization

---

## Versioned

Never overwritten after publication.

Example:

ProductVersion

---

## Ephemeral

Temporary records.

Example:

Invitation

---

## Generated

Derived from other entities.

Example:

QR images

---

# 7. Identifier Strategy

Passvero intentionally separates internal identifiers from public identifiers.

Every entity has an internal identifier.

Only selected entities receive a public identifier.

Never expose internal IDs publicly.

---

## Internal IDs

Used only inside:

- database
- APIs
- services

Characteristics:

- immutable
- unique
- never shown publicly

---

## Public IDs

Examples:

Passport Code

Organization Slug

Invitation Token

Characteristics:

- stable
- safe
- opaque
- globally unique when required

---

## Human-readable identifiers

Examples:

SKU

Model Number

EAN

GTIN

These belong to the business domain.

They are not database identifiers.

---

# 8. UUID Strategy

Every major entity should use UUID identifiers.

Reasons:

- easier replication
- safer APIs
- no sequential enumeration
- easier imports
- future distributed systems

Sequential integer IDs are intentionally avoided.

---

# 9. Public Identifier Strategy

Public identifiers must never expose:

- database IDs
- row counts
- organization size
- creation order

Passport URLs must remain stable for the lifetime of the product.

Example:

https://passvero.eu/p/AB7F2K91

Changing a published passport must never change this identifier.

---

# 10. Timestamp Strategy

Every major entity includes:

createdAt

updatedAt

Additional timestamps depend on the entity.

Examples:

publishedAt

archivedAt

expiresAt

acceptedAt

withdrawnAt

Use UTC exclusively.

Never store localized timestamps.

---

# 11. Naming Conventions

Entity names:

Singular.

Examples:

Product

Document

Material

Field names:

camelCase.

Foreign keys:

organizationId

productId

versionId

Never abbreviate field names unless universally accepted.

Avoid names such as:

org

prod

usr

---

# 12. Soft Delete Philosophy

Soft delete is not the default.

Entities receive soft delete only when business recovery is required.

Examples:

Products

Documents

Organizations

Entities such as Material or Invitation generally do not require soft delete.

---

# 13. Versioning Philosophy

Versioning exists only where business history matters.

Versioning is not applied universally.

Current versioned entities:

ProductVersion

Future versioned entities:

Possibly Documents.

Versioning must never be simulated by overwriting rows.

---

# 14. Audit Philosophy

Audit history is append-only.

Audit entries are never edited.

Audit entries are never reused.

Deleting business entities must not invalidate audit history.

---

# 15. Multi-tenancy

Organization is the tenant boundary.

Every private query must filter by organization.

Never rely solely on primary keys.

All organization-owned entities include organization ownership directly or indirectly.

This rule is mandatory.

---

# 16. Database Normalization

The schema should generally follow Third Normal Form.

Intentional denormalization is allowed only when justified by:

- performance
- security
- reporting

Every denormalized field must have documented ownership.

---

# 17. Extensibility

Future functionality should be additive.

Examples:

GS1

ERP

WooCommerce

Shopify

API Keys

Serial-level passports

Batch passports

The schema should allow these features without redesigning existing entities.

---

# 18. Entity Maturity

Every entity belongs to one implementation phase.

## MVP

Organization

Membership

User

Invitation

Product

ProductVersion

Material

Document

Passport

QRCode

ScanEvent

AuditLog

---

## Phase 2

Notifications

Product Templates

Translations

Saved Filters

---

## Phase 3

Subscriptions

Billing

API Keys

Webhooks

---

## Phase 4

ERP Integrations

GS1

Marketplace Sync

Workflow Automation

---

# 19. Anti-patterns

The following are explicitly forbidden.

❌ Store public passport fields directly in Product.

❌ Overwrite published versions.

❌ Generate a new QR after every publication.

❌ Trust organizationId from client requests.

❌ Expose database IDs publicly.

❌ Cascade delete published history.

❌ Duplicate immutable published data.

❌ Put business logic inside Prisma schema.

❌ Mix authentication with business entities.

❌ Couple billing to products.

---

# 20. Design Priority

Whenever trade-offs exist, prioritize in this order:

1. Data integrity

2. Business correctness

3. Security

4. Future extensibility

5. Developer convenience

6. Performance optimizations

Performance improvements must never compromise domain correctness.
---

# Identity Domain

The Identity Domain is responsible for authentication, tenant isolation and access control.

It contains the following entities:

- Organization
- User
- Membership
- Invitation

No Product, Document or Passport may exist outside this domain.

Every authenticated action originates from these entities.

The Identity Domain is the root of the complete application model.

---

# Organization

## Purpose

Organization represents a company using Passvero.

It is the tenant boundary of the application.

Everything that belongs to a customer ultimately belongs to one Organization.

The Organization entity is one of the core aggregates of the system.

---

## Responsibilities

Organization is responsible for:

- tenant isolation
- ownership
- branding
- company information
- subscriptions
- products
- team members
- documents
- analytics
- public identity

Organization is never responsible for authentication.

Authentication belongs to User.

---

## Ownership

Organization owns:

- Membership
- Product
- ProductVersion (indirectly)
- Material (indirectly)
- Document
- Passport
- QRCode
- ScanEvent
- AuditLog
- Subscription
- Invitation

---

## Lifecycle

Organization states:

ACTIVE

↓

SUSPENDED

↓

DEACTIVATED

↓

PENDING_DELETION

Organization is never physically deleted immediately.

---

## Required Fields

At minimum:

- id
- displayName
- createdAt
- updatedAt

---

## Optional Fields

Possible fields:

- legalName
- slug
- logo
- website
- country
- vatNumber
- publicEmail
- billingEmail
- timezone
- defaultLocale

---

## Constraints

Display name is required.

Slug must be unique.

Billing email is private.

Public email is optional.

One organization must always have at least one active Owner.

---

## Relationships

Organization

1:N Membership

1:N Product

1:N Document

1:N Invitation

1:N AuditLog

1:1 Subscription

---

## Indexes

Primary index:

id

Additional indexes:

slug

status

createdAt

---

## Delete Behavior

Hard delete:

Not allowed through normal application flow.

Preferred:

Archive

↓

Scheduled deletion

↓

Background cleanup

Published history must never disappear immediately.

---

## Audit

The following actions create audit entries:

- Organization created
- Organization updated
- Organization archived
- Organization restored
- Organization suspended

---

## Security Notes

Organization is the tenant boundary.

Every authenticated query must validate organization ownership.

This rule is mandatory.

---

## Future Extensions

Possible additions:

- Multiple brands
- Business units
- Multiple billing accounts
- Multiple locations

These should be implemented as separate entities.

Never overload Organization.

---

# User

## Purpose

Represents one authenticated human.

A User may belong to multiple Organizations.

User identity is global.

Organization membership is local.

---

## Responsibilities

Responsible for:

- authentication
- profile
- preferences
- locale
- timezone

Not responsible for:

- permissions
- ownership

Permissions belong to Membership.

---

## Ownership

User owns:

Preferences

User does NOT own:

Products

Documents

Organization

Membership records

---

## Lifecycle

Registered

↓

Verified

↓

Active

↓

Suspended

↓

Deleted

Deleting a user must not destroy business history.

---

## Required Fields

- id
- email
- createdAt
- updatedAt

---

## Optional Fields

- displayName
- avatar
- preferredLocale
- timezone

---

## Constraints

Email must be unique.

Email should be normalized.

Authentication provider identifiers must be unique.

---

## Relationships

User

1:N Membership

1:N Invitation (created)

1:N AuditLog (actor)

---

## Delete Behavior

User deletion must anonymize or detach actor references.

Historical ProductVersion records remain valid.

Audit history remains.

---

## Indexes

email

createdAt

---

## Security Notes

Never expose authentication identifiers publicly.

Never expose internal provider IDs.

---

## Future Extensions

- MFA
- Passkeys
- User API tokens
- Notification preferences

---

# Membership

## Purpose

Membership connects Users and Organizations.

It defines authorization.

Membership is the source of truth for permissions.

---

## Responsibilities

Responsible for:

- role
- organization
- joinedAt
- active state

Not responsible for authentication.

---

## Ownership

Belongs to:

Organization

User

---

## Lifecycle

Invited

↓

Accepted

↓

Active

↓

Suspended

↓

Removed

---

## Required Fields

- organizationId
- userId
- role

---

## Optional Fields

- invitedBy
- joinedAt

---

## Constraints

One active membership per:

User

+

Organization

Role cannot be null.

---

## Relationships

Membership

N:1 Organization

N:1 User

---

## Roles

Initial roles:

OWNER

ADMIN

EDITOR

VIEWER

Detailed permissions are defined elsewhere.

---

## Indexes

organizationId

userId

(role)

Composite:

organizationId + userId

UNIQUE

---

## Delete Behavior

Removing Membership must never remove User.

Removing Membership must never remove Organization.

Removing Membership must never remove Products.

---

## Audit

Membership changes generate audit events.

Examples:

Role changed

Member removed

Owner transferred

---

## Security Notes

Membership is checked on every authenticated request.

Never cache permissions permanently.

---

## Future Extensions

Possible fields:

department

jobTitle

lastSeenAt

---

# Invitation

## Purpose

Invitation allows organizations to invite future members.

Invitation exists independently from Membership.

Membership is created only after acceptance.

---

## Responsibilities

Responsible for:

- email
- token
- expiration
- target role

---

## Ownership

Invitation belongs to Organization.

Created by User.

Accepted by future User.

---

## Lifecycle

Pending

↓

Accepted

↓

Expired

↓

Revoked

---

## Required Fields

- email
- organizationId
- role
- token
- expiresAt

---

## Constraints

Invitation token must be unique.

Email may have only one active invitation per organization.

Expired invitations cannot be accepted.

---

## Relationships

Invitation

N:1 Organization

N:1 User (creator)

---

## Indexes

token

organizationId

email

expiresAt

Composite:

organizationId + email

---

## Delete Behavior

Expired invitations may be safely removed later.

Accepted invitations remain for audit purposes.

---

## Audit

Invitation created

Invitation accepted

Invitation revoked

Invitation expired

---

## Security Notes

Never store raw invitation tokens.

Store only secure hashes whenever practical.

Invitation links must be single-use.

---

## Future Extensions

Future support:

- Bulk invitations
- Domain-based invitations
- Auto-join by verified company domain
- Invitation reminders

---

# Identity Domain Summary

The Identity Domain guarantees:

✓ tenant isolation

✓ secure authentication

✓ organization ownership

✓ permission assignment

✓ invitation workflow

✓ future scalability

All remaining entities in the application depend on this domain.

No Product entity may exist without an Organization.

No authenticated action may bypass Membership validation.

---

# Product and Passport Domain

The Product and Passport Domain is the core business domain of Passvero.

It is responsible for:

- stable product identity;
- versioned product information;
- localized product content;
- materials and composition;
- product media;
- supporting documents;
- publication;
- public Digital Product Passport access;
- stable QR code resolution.

This domain must preserve historical integrity.

Published information must never be overwritten.

The following entities belong to this domain:

- Product
- ProductVersion
- ProductTranslation
- ProductIdentifier
- ProductMaterial
- Document
- ProductDocument
- ProductImage
- Passport
- QRCode

Some entities may be implemented in later phases, but the initial schema must not prevent their future introduction.

---

# Product aggregate overview

Product is the aggregate root of the product domain.

The primary aggregate structure is:

```txt
Organization
└── Product
    ├── ProductVersion
    │   ├── ProductTranslation
    │   ├── ProductIdentifier
    │   ├── ProductMaterial
    │   ├── ProductDocument
    │   └── ProductImage
    ├── Passport
    └── QRCode
```

Document is organization-owned and exists outside the Product aggregate.

ProductDocument connects a Document to a ProductVersion.

A Product represents stable identity.

A ProductVersion represents editable or published product content.

A Passport represents public publication state and public routing metadata.

A QRCode represents the stable visual link to the Passport.

---

# Product

## Purpose

Product represents the stable identity of one product managed by an Organization.

Product is not the complete Digital Product Passport content.

Product stores only information that must remain stable across versions or is required for internal product management.

Versioned public content belongs to ProductVersion.

---

## Responsibilities

Product is responsible for:

- organization ownership;
- stable internal identity;
- stable public passport code;
- internal product name;
- internal SKU;
- lifecycle state;
- archive state;
- current draft reference;
- current published version reference;
- passport relation;
- QR code relation;
- version history root.

Product is not responsible for:

- public localized descriptions;
- published materials;
- published document visibility;
- repairability content;
- recycling content;
- published technical specifications.

Those belong to ProductVersion and its child entities.

---

## Ownership

Product belongs to exactly one Organization.

A Product cannot exist without an Organization.

A Product cannot be moved between Organizations through ordinary application logic.

---

## Lifecycle

Recommended Product lifecycle:

```txt
ACTIVE
ARCHIVED
```

Publication state is not stored directly as the Product lifecycle.

A Product may simultaneously have:

- one current published version;
- one active editable draft.

Therefore, avoid a single Product status such as:

```txt
DRAFT
PUBLISHED
```

That model would be misleading.

Instead:

- Product lifecycle describes whether the product is active or archived.
- ProductVersion status describes draft or publication state.
- Passport status describes public availability.

---

## Required fields

Product should contain:

- id;
- organizationId;
- internalName;
- publicCode;
- lifecycleStatus;
- createdAt;
- updatedAt.

---

## Optional fields

Product may contain:

- sku;
- currentDraftVersionId;
- currentPublishedVersionId;
- archivedAt;
- archivedById;
- createdById;
- updatedById;
- lastPublishedAt;
- searchText if intentionally denormalized later.

---

## Internal name

`internalName` is used in the authenticated application.

It helps users identify the product even when localized public content is incomplete.

It may initially match the source-language product name.

It is not automatically public.

---

## SKU

SKU is an organization-scoped business identifier.

Rules:

- SKU may be optional.
- When present, it should be normalized.
- Uniqueness is scoped to Organization.
- SKU must not be used as the primary key.
- SKU must not be used as the public passport URL.
- SKU changes must not change Passport or QR identity.

Recommended composite uniqueness:

```txt
organizationId + normalizedSku
```

If PostgreSQL case-insensitive uniqueness is required, implementation must use an approved normalization strategy.

---

## Public code

`publicCode` is the stable opaque identifier used in the public Passport URL.

Example:

```txt
https://passvero.eu/p/AB7F2K91
```

Rules:

- globally unique;
- immutable after Product creation;
- sufficiently collision-resistant;
- non-sequential;
- does not expose database identity;
- does not encode Organization identity;
- remains stable across all ProductVersions;
- remains stable after archival;
- remains stable after Passport withdrawal;
- must not be reused.

Public code generation must happen server-side.

A collision must be handled safely by retrying.

---

## Current draft reference

Product may contain `currentDraftVersionId`.

Rules:

- nullable;
- points only to a ProductVersion belonging to the same Product;
- referenced version must be editable;
- one Product has at most one active draft;
- clearing the field does not delete the draft automatically;
- setting the field must happen inside controlled domain logic.

This relation may require careful Prisma relation naming due to multiple Product-to-ProductVersion relationships.

---

## Current published version reference

Product may contain `currentPublishedVersionId`.

Rules:

- nullable;
- points only to a ProductVersion belonging to the same Product;
- referenced version must be published;
- one Product has at most one current published version;
- historical published versions remain related through the general versions relation;
- publishing a new version replaces this pointer transactionally;
- replacing this pointer does not mutate the previous version.

---

## Relationships

Product has:

```txt
N:1 Organization
1:N ProductVersion
0:1 current draft ProductVersion
0:1 current published ProductVersion
0:1 Passport
0:1 QRCode
0:N AuditLog
```

ProductVersion belongs to Product through the main versions relation.

The current draft and current published references are convenience and integrity pointers.

---

## Constraints

Required constraints:

```txt
publicCode UNIQUE
```

Recommended composite constraint:

```txt
organizationId + normalizedSku UNIQUE
```

Only when SKU is present.

The database must prevent version-number duplicates through ProductVersion constraints.

Some invariants cannot be expressed completely in Prisma and must be enforced in services:

- current draft belongs to same Product;
- current published version belongs to same Product;
- current draft has editable status;
- current published version has published status.

---

## Indexes

Recommended indexes:

```txt
organizationId
organizationId + lifecycleStatus
organizationId + updatedAt
organizationId + internalName
publicCode
currentDraftVersionId
currentPublishedVersionId
archivedAt
```

Potential search index later:

```txt
organizationId + normalizedSku
```

Full-text search should not be introduced before real need.

---

## Delete behavior

Hard delete is allowed only when:

- Product has never been published;
- no Passport publication history exists;
- no ScanEvent history requires retention;
- no protected Document dependency exists;
- user has permission;
- operation is explicitly confirmed.

Ordinary behavior for a Product that has ever been published:

```txt
Archive
```

Hard deletion must never cascade into published historical data by default.

---

## Archive behavior

Archiving Product:

- sets lifecycle state to archived;
- records archivedAt;
- records actor when possible;
- removes Product from active lists;
- prevents ordinary editing;
- preserves ProductVersions;
- preserves Passport;
- preserves QR;
- preserves public code;
- preserves audit history.

Public behavior is controlled by Passport state.

Archive does not automatically mean Passport withdrawal unless explicitly implemented as one transaction.

---

## Restore behavior

Restoring Product:

- changes lifecycle state to active;
- clears archivedAt;
- records audit event;
- does not modify published version;
- does not automatically create a draft;
- does not change public code.

---

## Duplication behavior

Duplicating Product creates a new Product.

The new Product receives:

- new internal ID;
- new publicCode;
- copied internalName with suitable suffix;
- copied or empty SKU depending on conflict rules;
- new draft ProductVersion;
- no current published version;
- no Passport publication history;
- no ScanEvents;
- no shared QR identity.

Document reuse must follow ProductDocument rules.

---

## Audit

Important Product audit events:

```txt
PRODUCT_CREATED
PRODUCT_UPDATED
PRODUCT_ARCHIVED
PRODUCT_RESTORED
PRODUCT_DUPLICATED
PRODUCT_DELETED
```

Published content changes are audited primarily through ProductVersion and Passport events.

---

## Security

Every Product query in private application context must include Organization scope.

Required query condition:

```txt
id = productId
AND
organizationId = authenticatedOrganizationId
```

Public Product resolution uses `publicCode`, but public serialization must use an explicit allowlist.

---

## Public exposure

Product should expose publicly only:

- publicCode;
- lifecycle-related public notice when approved;
- current published version relation;
- Passport public state.

Do not serialize Product database record directly.

---

## Future extensions

Possible future Product-level additions:

- external integration mappings;
- batch passports;
- serial-item passports;
- product family;
- product template;
- brand relation;
- category relation;
- GS1 identifiers;
- ownership transfer workflow.

Do not add integration-specific fields directly to Product.

---

## Anti-patterns

Never:

- store complete public product content directly in Product;
- overwrite current published content;
- use SKU as Passport identity;
- generate a new public code for every version;
- trust organizationId from request body;
- cascade-delete published history;
- move Product to another Organization by changing organizationId.

---

# ProductVersion

## Purpose

ProductVersion represents one versioned snapshot of product passport content.

It may be:

- editable draft;
- ready for internal review;
- published immutable version;
- superseded historical version.

ProductVersion is the main source of public Passport content.

---

## Responsibilities

ProductVersion is responsible for:

- version number;
- workflow state;
- source language;
- product classification data;
- manufacturer and economic operator data;
- country of origin;
- technical information;
- repairability information;
- recycling information;
- compliance-oriented structured fields;
- translations;
- identifiers;
- materials;
- document associations;
- image associations;
- publication metadata.

---

## Ownership

ProductVersion belongs to exactly one Product.

Organization ownership is inherited through Product.

The schema may also store `organizationId` directly for:

- tenant-safe querying;
- index efficiency;
- RLS support;
- analytics.

If denormalized, it must always match Product.organizationId.

This invariant must be enforced by service logic and tested.

---

## Lifecycle status

Recommended ProductVersion status:

```txt
DRAFT
READY_FOR_REVIEW
PUBLISHED
SUPERSEDED
DISCARDED
```

Meaning:

### DRAFT

Editable private version.

### READY_FOR_REVIEW

Editable or restricted-edit internal state indicating that required sections are complete enough for review.

It is not public.

It does not imply Passvero approval.

### PUBLISHED

Immutable version that has been made public.

### SUPERSEDED

Previously published version replaced by a newer published version.

It remains immutable and retained.

### DISCARDED

Unpublished version intentionally abandoned.

It may later be hard-deleted according to retention rules.

---

## Status transition overview

Recommended transitions:

```txt
DRAFT
→ READY_FOR_REVIEW
→ DRAFT

READY_FOR_REVIEW
→ PUBLISHED

PUBLISHED
→ SUPERSEDED

DRAFT
→ DISCARDED

READY_FOR_REVIEW
→ DISCARDED
```

Forbidden:

```txt
PUBLISHED → DRAFT
SUPERSEDED → DRAFT
PUBLISHED → deleted through ordinary UI
```

Historical version restoration creates a new DRAFT.

---

## Required fields

ProductVersion should contain:

- id;
- productId;
- organizationId if denormalized;
- status;
- sourceLocale;
- createdAt;
- updatedAt;
- createdById.

Version number may be nullable until publication, depending on strategy.

---

## Optional fields

ProductVersion may contain:

- versionNumber;
- versionLabel;
- reviewReadyAt;
- publishedAt;
- publishedById;
- supersededAt;
- discardedAt;
- updatedById;
- clonedFromVersionId;
- changeSummary;
- manufacturerName;
- brandName;
- modelNumber;
- countryOfOriginCode;
- productCategory;
- productCategoryCode;
- economicOperatorRole;
- manufacturerContact;
- importerContact;
- technicalSummary;
- repairabilitySummary;
- sparePartsInformation;
- recyclingInformation;
- disposalInformation;
- packagingInformation;
- environmentalNotes;
- warrantyInformation;
- safetyInformation;
- regulatoryNotes;
- dataCompleteness state or cached score if justified.

Large localized text should generally belong in ProductTranslation rather than repeated ProductVersion fields.

---

## Version number strategy

Version number is scoped to Product.

Required uniqueness:

```txt
productId + versionNumber UNIQUE
```

Recommended behavior:

- draft may have no final version number;
- final version number is assigned transactionally during publication;
- first published version is 1;
- each later published version increments by 1;
- discarded drafts do not consume a publication version number unless intentionally chosen.

Alternative behavior:

- assign draft sequence numbers immediately.

The recommended initial model is:

```txt
versionNumber nullable until publication
```

This avoids visible version gaps from discarded drafts.

---

## Version label

Optional human-readable label.

Examples:

```txt
Initial publication
Packaging update
German translation added
Material composition correction
```

Version label does not replace versionNumber.

---

## Source locale

`sourceLocale` identifies the canonical authoring language of that version.

Rules:

- required;
- uses an approved locale code;
- does not automatically create translations;
- may default to Organization.defaultLocale;
- remains immutable after publication.

---

## Product data placement

Stable operational data belongs to Product.

Versioned public data belongs to ProductVersion or its child entities.

Examples:

### Product

```txt
internalName
internalSku
publicCode
archive state
```

### ProductVersion

```txt
model number
manufacturer name
country of origin
materials
public descriptions
repair information
public documents
```

When uncertain, ask:

> Should changing this field create a new public historical version?

If yes, it belongs to ProductVersion.

---

## Relationships

ProductVersion has:

```txt
N:1 Product
N:1 Organization when denormalized
1:N ProductTranslation
1:N ProductIdentifier
1:N ProductMaterial
1:N ProductDocument
1:N ProductImage
0:N AuditLog
0:1 parent or cloned-from ProductVersion
```

ProductVersion may also be referenced by Product as:

```txt
currentDraftVersion
currentPublishedVersion
```

---

## Current draft invariant

One Product may have at most one active editable version.

Editable statuses:

```txt
DRAFT
READY_FOR_REVIEW
```

Prisma cannot easily enforce a partial unique index through schema syntax alone.

Implementation options:

1. Product.currentDraftVersionId as authoritative pointer.
2. Database partial unique index added through manual SQL migration.
3. Service-level invariant with transaction and locking.

Recommended:

- use Product.currentDraftVersionId;
- additionally add a PostgreSQL partial unique index when practical;
- test both service and database behavior.

---

## Published immutability

After ProductVersion status becomes PUBLISHED:

- no ordinary update is allowed;
- child translations cannot be updated;
- child materials cannot be updated;
- document associations cannot change;
- image associations cannot change;
- publication metadata cannot be rewritten;
- status may only transition to SUPERSEDED through publication transaction.

Immutability must be enforced in service logic.

Database triggers are optional and should not be added without documented decision.

---

## Draft creation after publication

When a user edits a published Product:

1. verify no active draft exists;
2. clone current published version;
3. create a new ProductVersion with status DRAFT;
4. copy translations;
5. copy identifiers;
6. copy materials;
7. copy ProductDocument associations;
8. copy ProductImage associations;
9. set clonedFromVersionId;
10. set Product.currentDraftVersionId;
11. preserve published version unchanged.

This operation should use a database transaction.

---

## Publication transaction

Publishing ProductVersion must:

1. verify Product and Organization;
2. verify actor permission;
3. verify Product is active;
4. verify version is current draft;
5. validate required fields;
6. validate public document references;
7. calculate next version number;
8. assign versionNumber;
9. set status PUBLISHED;
10. set publishedAt;
11. set publishedById;
12. mark previous current published version SUPERSEDED;
13. set previous supersededAt;
14. update Product.currentPublishedVersionId;
15. clear Product.currentDraftVersionId;
16. update Product.lastPublishedAt;
17. activate or update Passport state;
18. preserve stable QR identity;
19. create AuditLog records.

The transaction must be atomic.

If any step fails:

- previous published version remains current;
- draft remains editable or review-ready;
- Passport continues resolving to previous version.

---

## Review readiness

Readiness should not be stored as a legally meaningful state.

Potential fields:

```txt
status = READY_FOR_REVIEW
readinessScore
missingRequiredFields
```

If a score is cached, it is derived data.

The source of truth remains validation rules and actual fields.

Do not expose wording such as:

```txt
EU compliant
```

---

## Change summary

`changeSummary` may be required before publishing version 2 or later.

It should describe meaningful public changes.

Examples:

- updated repair instructions;
- corrected material percentages;
- added Polish translation;
- replaced technical certificate.

Change summary becomes immutable after publication.

---

## Indexes

Recommended indexes:

```txt
productId
organizationId
productId + status
productId + versionNumber
organizationId + status
organizationId + updatedAt
publishedAt
createdAt
clonedFromVersionId
```

Required uniqueness:

```txt
productId + versionNumber UNIQUE
```

Because versionNumber may be nullable before publication, database behavior must be verified for PostgreSQL.

---

## Delete behavior

### Draft

A DRAFT may be hard-deleted if:

- it has never been published;
- it is not referenced as current published version;
- it is not needed for audit retention;
- Product.currentDraftVersionId is cleared transactionally.

Its child rows may safely cascade:

- translations;
- identifiers;
- materials;
- document associations;
- image associations.

The underlying Documents and media assets must not cascade-delete.

### Ready for review

Same as draft, with stricter confirmation.

### Published

Hard delete forbidden through ordinary application flow.

### Superseded

Hard delete forbidden through ordinary application flow.

### Discarded

May be retained temporarily and later hard-deleted through cleanup policy.

---

## Audit

Important events:

```txt
PRODUCT_VERSION_CREATED
PRODUCT_VERSION_UPDATED
PRODUCT_VERSION_READY_FOR_REVIEW
PRODUCT_VERSION_RETURNED_TO_DRAFT
PRODUCT_VERSION_PUBLISHED
PRODUCT_VERSION_SUPERSEDED
PRODUCT_VERSION_DISCARDED
PRODUCT_VERSION_RESTORED_AS_DRAFT
```

---

## Security

ProductVersion private queries must verify Organization scope through Product or direct organizationId.

Public access must resolve only:

- current published ProductVersion;
- belonging to active Passport;
- belonging to allowed Product and Organization state.

Never expose DRAFT or READY_FOR_REVIEW publicly.

---

## Public exposure

Public serializers may include approved ProductVersion data only.

Do not expose:

- internal actor IDs;
- private notes;
- internal readiness details;
- private document associations;
- database IDs;
- discarded or draft data;
- raw audit metadata.

---

## Future extensions

Possible future additions:

- category-specific schemas;
- structured technical property records;
- regulatory requirement snapshots;
- approval workflow;
- reviewer comments;
- AI-assisted field extraction;
- data provenance;
- digital signatures;
- GS1 linkage;
- batch-level versions.

---

## Anti-patterns

Never:

- edit PUBLISHED version;
- use one mutable row for current product data;
- delete superseded versions;
- assign version number without transaction;
- expose draft relations publicly;
- duplicate Product identity for every publication;
- store translation JSON without considering validation and indexing;
- mark version legally compliant solely from field completeness.

---

# ProductTranslation

## Purpose

ProductTranslation stores localized public content for one ProductVersion.

Application interface translation is not stored here.

ProductTranslation contains organization-authored product data.

---

## Responsibilities

ProductTranslation may store:

- localized product name;
- short description;
- full description;
- technical description;
- repair instructions;
- spare-parts information;
- recycling instructions;
- disposal instructions;
- packaging information;
- safety information;
- warranty text;
- public warnings;
- custom public notes.

Only fields requiring language-specific content belong here.

---

## Ownership

ProductTranslation belongs to exactly one ProductVersion.

Organization ownership is inherited through ProductVersion and Product.

---

## Required fields

ProductTranslation should contain:

- id;
- productVersionId;
- locale;
- productName;
- createdAt;
- updatedAt.

---

## Optional fields

Potential fields:

- shortDescription;
- description;
- technicalDescription;
- repairInstructions;
- sparePartsInformation;
- recyclingInstructions;
- disposalInstructions;
- packagingInformation;
- safetyInformation;
- warrantyInformation;
- publicNotes;
- translationStatus;
- translatedBy;
- sourceTranslationId if future workflow requires it.

---

## Locale

Locale must use an approved application/product-content locale code.

Examples:

```txt
hr
en
de
sr
sl
pl
```

The exact canonical format must be consistent across the application.

Do not mix:

```txt
hr
hr-HR
HR
```

without explicit normalization.

---

## Constraints

Required uniqueness:

```txt
productVersionId + locale UNIQUE
```

A ProductVersion may have at most one translation per locale.

---

## Source translation

One ProductTranslation should match ProductVersion.sourceLocale.

That translation is the canonical source-language content.

The database cannot easily guarantee its existence solely through a foreign key.

Service validation must verify:

- source-language translation exists;
- productName exists for source locale;
- source translation is included before publication.

---

## Translation status

Recommended status:

```txt
DRAFT
COMPLETE
NEEDS_REVIEW
```

This status is internal.

It does not imply legal or linguistic certification.

Alternative simpler MVP approach:

- omit translationStatus;
- derive completeness from required fields.

Do not add status if it will not be used.

---

## Published immutability

Translations belonging to a PUBLISHED or SUPERSEDED ProductVersion are immutable.

A translation correction requires:

- new ProductVersion draft;
- copied translation;
- modification in draft;
- new publication.

---

## Fallback behavior

Public locale fallback is an application concern.

Database stores actual available translations only.

Do not create fake translations by copying source content into every locale.

Public API should clearly distinguish:

- requested locale available;
- source-language fallback used;
- translation unavailable.

---

## Relationships

ProductTranslation:

```txt
N:1 ProductVersion
```

Potential future relations:

```txt
0:N localized custom fields
0:N translation review records
```

---

## Indexes

Recommended indexes:

```txt
productVersionId
locale
productVersionId + locale
```

Locale-only index may be unnecessary unless querying translations globally.

Prefer composite index.

---

## Delete behavior

When an unpublished ProductVersion is deleted:

```txt
ProductTranslation CASCADE DELETE
```

When a translation is removed from a draft:

- allowed;
- source-language translation cannot be removed if it would invalidate the draft;
- publication validation must ensure required languages.

Translations for published versions are protected.

---

## Audit

Translation-level audit may be represented through ProductVersion update events.

Detailed field-level audit is not required for MVP.

Important events may include:

```txt
PRODUCT_TRANSLATION_ADDED
PRODUCT_TRANSLATION_REMOVED
PRODUCT_TRANSLATION_COMPLETED
```

---

## Public exposure

Only translations belonging to current published version may be returned publicly.

Use explicit field allowlists.

---

## Future extensions

Possible future fields:

- machineTranslationProvider;
- machineTranslatedAt;
- reviewedById;
- reviewedAt;
- translationQualityState;
- translation provenance;
- locale-specific SEO metadata.

Do not store external AI prompts or secrets here.

---

## Anti-patterns

Never:

- store UI translations in ProductTranslation;
- use locale as free-form text without validation;
- overwrite published translation;
- claim translated content is certified;
- silently label fallback content as requested locale;
- store all languages in one unstructured text field.

---

# ProductIdentifier

## Purpose

ProductIdentifier stores versioned business identifiers associated with a ProductVersion.

It supports multiple identifier types without adding many nullable columns.

---

## Responsibilities

ProductIdentifier may represent:

- GTIN;
- EAN;
- UPC;
- model number;
- manufacturer part number;
- custom identifier;
- product classification code.

Internal SKU remains on Product when used for application operations.

---

## Ownership

ProductIdentifier belongs to one ProductVersion.

---

## Identifier types

Recommended initial enum:

```txt
GTIN
EAN
UPC
MPN
MODEL_NUMBER
CUSTOM
```

Do not add batch, lot or serial identifiers until those passport levels are implemented.

---

## Required fields

ProductIdentifier should contain:

- id;
- productVersionId;
- type;
- value;
- createdAt.

---

## Optional fields

Potential fields:

- label;
- issuer;
- scheme;
- isPrimary;
- sortOrder;
- normalizedValue;
- verificationStatus later.

---

## Constraints

Recommended uniqueness:

```txt
productVersionId + type + normalizedValue UNIQUE
```

This prevents duplicate identifier entries within one version.

Do not assume all identifiers are globally unique.

GTIN may later require broader validation, but do not enforce global uniqueness without an approved business rule.

---

## Primary identifier

A ProductVersion may designate one primary identifier.

Prisma cannot directly guarantee one `isPrimary = true` row per ProductVersion.

Possible enforcement:

- service logic;
- PostgreSQL partial unique index.

For MVP, `isPrimary` may be omitted unless UI requires it.

---

## Normalization

Identifier normalization depends on type.

Examples:

- remove spaces from EAN;
- preserve meaningful leading zeros;
- uppercase MPN when approved;
- trim custom values.

Never parse identifiers as numeric database types.

Use strings.

Leading zeros are meaningful.

---

## Relationships

```txt
N:1 ProductVersion
```

---

## Indexes

Recommended indexes:

```txt
productVersionId
type
normalizedValue
productVersionId + type
```

Organization-scoped cross-product search may require denormalized organizationId later.

Do not add it without query need.

---

## Delete behavior

Identifiers on draft versions may be added, updated or deleted.

Identifiers on published versions are immutable.

Draft deletion may cascade to identifiers.

---

## Public exposure

Only approved identifier types should be public.

Internal identifiers must be excluded through serializer rules.

---

## Future extensions

Potential additions:

- identifier issuer;
- GS1 verification result;
- external registry reference;
- identifier validity dates;
- batch and serial-level identifier entities.

---

## Anti-patterns

Never:

- store EAN or GTIN as integer;
- assume every identifier is globally unique;
- use identifiers as database primary keys;
- overwrite identifiers in published versions;
- mix internal SKU with public code.

---

# ProductMaterial

## Purpose

ProductMaterial represents one material or composition component in a ProductVersion.

It is versioned public product data.

---

## Responsibilities

ProductMaterial may store:

- material name;
- percentage;
- recycled-content percentage;
- renewable-content percentage;
- material origin;
- material notes;
- hazardous-substance notes;
- standardized material code later;
- display order.

---

## Ownership

ProductMaterial belongs to exactly one ProductVersion.

---

## Required fields

ProductMaterial should contain:

- id;
- productVersionId;
- name;
- sortOrder;
- createdAt;
- updatedAt.

---

## Optional fields

Potential fields:

- percentage;
- recycledContentPercentage;
- renewableContentPercentage;
- countryOfOriginCode;
- materialCode;
- notes;
- hazardousSubstanceNotes;
- isPrimaryMaterial.

---

## Percentage representation

Percentages should use an exact decimal database type.

Do not use floating-point types.

Recommended precision should support practical values such as:

```txt
25
25.5
25.75
```

Exact Prisma precision will be decided during schema implementation.

Potential recommendation:

```txt
Decimal with precision sufficient for 0.01%
```

---

## Percentage validation

When present:

```txt
0 <= percentage <= 100
```

Same rule for:

- recycledContentPercentage;
- renewableContentPercentage.

The sum of material percentages:

- must not exceed 100;
- may be below 100 when composition is partial;
- should not be required to equal 100 unless product category rules demand it.

Cross-row sum validation belongs to service logic.

---

## Material name

Initial MVP may use organization-entered material names.

Material name is not automatically standardized.

Do not imply that free-form material names map to official material taxonomies.

---

## Material code

`materialCode` is optional future-ready structured data.

It should not be required until an approved taxonomy is selected.

---

## Sort order

`sortOrder` controls public and dashboard display.

Recommended uniqueness:

```txt
productVersionId + sortOrder UNIQUE
```

This is optional if reordering logic can tolerate temporary duplicates.

If enforced, reorder operations must be transactional.

---

## Relationships

```txt
N:1 ProductVersion
```

Potential future relation:

```txt
N:1 MaterialCatalogEntry
```

Do not implement a global material catalog prematurely.

---

## Indexes

Recommended indexes:

```txt
productVersionId
productVersionId + sortOrder
countryOfOriginCode
materialCode
```

Only add country or materialCode indexes when real queries require them.

---

## Delete behavior

Draft materials may be created, updated, reordered and deleted.

Published materials are immutable.

Deleting a draft version may cascade-delete its ProductMaterial rows.

---

## Audit

Material edits may be summarized through ProductVersion audit.

Detailed material audit is optional before publication.

Publication preserves the full immutable material snapshot.

---

## Public exposure

Published materials may be public when included by organization.

Internal notes must be separated from public notes if both are needed.

Do not expose internal material review comments.

---

## Future extensions

Potential additions:

- material supplier;
- recycled source type;
- mass instead of percentage;
- measurement unit;
- hazardous classification;
- standardized taxonomy relation;
- circularity indicators;
- carbon-related metadata.

Do not add fields without approved use cases.

---

## Anti-patterns

Never:

- use Float for percentages;
- require total exactly 100 for every product;
- mutate published material rows;
- mix supplier confidential notes with public material notes;
- claim user-entered material names are officially verified.

---

# Document

## Purpose

Document represents one organization-owned uploaded file and its stable metadata.

Document exists independently from ProductVersion.

This allows one file to be reused across multiple products or versions within the same Organization.

---

## Responsibilities

Document is responsible for:

- organization ownership;
- storage identity;
- original filename;
- safe display filename;
- MIME type;
- file size;
- checksum;
- document category;
- upload status;
- archive state;
- upload actor;
- storage lifecycle.

Document does not directly define public visibility.

Public visibility belongs to ProductDocument association.

---

## Ownership

Document belongs to exactly one Organization.

A Document cannot be shared across Organizations.

A Document may be linked to multiple ProductVersions within the same Organization.

---

## Lifecycle

Recommended Document lifecycle:

```txt
UPLOADING
PROCESSING
READY
FAILED
ARCHIVED
```

Optional future state:

```txt
QUARANTINED
```

Meaning:

### UPLOADING

Upload initiated but not finalized.

### PROCESSING

File stored and undergoing validation or transformation.

### READY

Available for internal association.

### FAILED

Upload or processing failed.

### ARCHIVED

Hidden from active library but retained due to history or user choice.

---

## Required fields

Document should contain:

- id;
- organizationId;
- storageKey;
- originalFilename;
- displayFilename;
- mimeType;
- sizeBytes;
- category;
- status;
- createdAt;
- updatedAt;
- uploadedById.

---

## Optional fields

Potential fields:

- title;
- description;
- checksum;
- storageBucket;
- archivedAt;
- archivedById;
- failureReasonCode;
- pageCount;
- detectedMimeType;
- virusScanStatus;
- virusScannedAt;
- sourceLocale;
- documentDate;
- validFrom;
- validUntil;
- externalReference;
- metadata JSON for controlled technical metadata.

---

## Storage key

`storageKey` is the canonical provider path or object key.

Rules:

- unique;
- generated server-side;
- does not use raw filename as full path;
- includes organization-safe namespace;
- never exposed directly when storage is private;
- immutable after successful upload.

Example conceptual structure:

```txt
organizations/{organizationId}/documents/{documentId}/{safeFilename}
```

The exact provider path is infrastructure-specific.

---

## Original filename

`originalFilename` preserves user-uploaded name for audit and display fallback.

It must be sanitized before rendering.

Never trust it as a storage path.

---

## Display filename

`displayFilename` is a safe user-facing name.

It may be edited without changing the storage object.

---

## MIME type

Store detected or validated MIME type.

Do not trust browser-provided MIME type alone.

Allowed file types must be enforced server-side.

---

## File size

Store bytes as an integer type capable of large values.

Do not store formatted strings such as:

```txt
2.4 MB
```

Formatting belongs to UI.

---

## Checksum

Checksum supports:

- integrity checks;
- duplicate detection;
- safe replacement logic;
- provider verification.

Recommended algorithm should be documented in implementation.

Checksum is not a security authorization mechanism.

---

## Document category

Recommended enum:

```txt
MANUAL
CERTIFICATE
TECHNICAL_SHEET
WARRANTY
SAFETY_INFORMATION
DECLARATION
REPAIR_INSTRUCTIONS
RECYCLING_INSTRUCTIONS
OTHER
```

Category may later be expanded.

Avoid encoding category in filename.

---

## Source locale

Optional `sourceLocale` identifies the language of the file.

It does not make the document public.

For multilingual applicability, ProductDocument may need an explicit locale relation or applicability field.

---

## Relationships

Document has:

```txt
N:1 Organization
1:N ProductDocument
N:1 User as uploadedBy
0:N AuditLog
```

Potential future:

```txt
1:N DocumentRevision
```

---

## Constraints

Required:

```txt
storageKey UNIQUE
```

Potential duplicate warning:

```txt
organizationId + checksum
```

Do not necessarily enforce uniqueness because identical files may be intentionally uploaded with different metadata.

---

## Indexes

Recommended indexes:

```txt
organizationId
organizationId + status
organizationId + category
organizationId + createdAt
checksum
uploadedById
archivedAt
```

---

## Public visibility

Document itself is private by default.

A Document becomes publicly reachable only through:

- current published ProductVersion;
- public ProductDocument association;
- controlled public download endpoint or signed access mechanism.

Never expose private storage bucket paths directly.

---

## Replacement behavior

Replacing a file must not overwrite an object used by a published version.

Recommended behavior:

1. upload new Document;
2. associate new Document with draft ProductVersion;
3. preserve old Document;
4. publish new version;
5. archive old Document only if no longer actively used.

---

## Delete behavior

Hard deletion allowed only when:

- no published ProductDocument association references it;
- no active draft references it;
- no retention rule requires it;
- storage deletion succeeds or is safely queued;
- user has permission.

Otherwise:

```txt
Archive
```

ProductDocument deletion must never cascade-delete Document.

---

## Partial failure handling

### Upload succeeds, database fails

Attempt storage cleanup or create recoverable orphan-cleanup job.

### Database row exists, upload fails

Mark status FAILED.

Do not mark READY.

### Storage delete fails

Do not pretend deletion completed.

Use pending cleanup or retain archived record.

---

## Audit

Important events:

```txt
DOCUMENT_UPLOAD_STARTED
DOCUMENT_UPLOADED
DOCUMENT_UPLOAD_FAILED
DOCUMENT_UPDATED
DOCUMENT_ARCHIVED
DOCUMENT_RESTORED
DOCUMENT_DELETED
```

---

## Security

Document access requires Organization membership.

Download endpoint must verify:

- organization scope for private access;
- published association for public access;
- safe content disposition;
- file type handling;
- no path traversal;
- no client-controlled storage keys.

---

## Public exposure

Public serializer may expose:

- display title;
- category;
- language;
- public download route;
- file size;
- optional document date.

Never expose:

- storageKey;
- storage bucket;
- internal checksum;
- uploader identity;
- failure metadata;
- private notes.

---

## Future extensions

Potential additions:

- document revisions;
- digital signatures;
- certificate validity reminders;
- virus scanning;
- OCR extraction;
- AI metadata extraction;
- document approval;
- public document access analytics.

---

## Anti-patterns

Never:

- store file bytes directly in PostgreSQL without explicit decision;
- expose storageKey publicly;
- overwrite published file objects;
- delete Document through ProductDocument cascade;
- trust file extension;
- use originalFilename as storage identity;
- mark upload READY before storage finalization.

---

# ProductDocument

## Purpose

ProductDocument links a Document to one ProductVersion.

It defines how the Document is used in that specific version.

This association is versioned content.

---

## Responsibilities

ProductDocument is responsible for:

- ProductVersion association;
- Document association;
- public or private visibility;
- display title override;
- category override if approved;
- locale applicability;
- sort order;
- public description;
- inclusion in published Passport.

---

## Ownership

Ownership is derived through:

```txt
ProductDocument
→ ProductVersion
→ Product
→ Organization
```

The associated Document must belong to the same Organization.

This cross-entity invariant must be enforced in service logic.

---

## Required fields

ProductDocument should contain:

- id;
- productVersionId;
- documentId;
- visibility;
- sortOrder;
- createdAt.

---

## Optional fields

Potential fields:

- displayTitle;
- description;
- locale;
- categoryOverride;
- validFrom;
- validUntil;
- addedById;
- isFeatured;
- publicDownloadName.

---

## Visibility

Recommended enum:

```txt
PRIVATE
PUBLIC
```

Meaning:

### PRIVATE

Visible only inside authenticated application.

### PUBLIC

Eligible for display on public Passport once ProductVersion is published.

A PUBLIC association on a draft is not yet publicly accessible.

---

## Constraints

Recommended uniqueness:

```txt
productVersionId + documentId UNIQUE
```

This prevents linking the same Document twice to the same version.

If the same file must appear in multiple categories, reconsider whether category belongs to Document or association.

---

## Locale applicability

Simple MVP option:

```txt
locale nullable
```

Meaning:

- null = applies to all languages;
- locale value = applies to one language.

Future multi-locale applicability may require a join entity.

Avoid storing comma-separated locale values.

---

## Sort order

Sort order controls public display order.

Potential uniqueness:

```txt
productVersionId + sortOrder
```

This is optional.

Reordering may be easier without strict uniqueness if temporary duplicate order values are allowed during transaction.

---

## Relationships

```txt
N:1 ProductVersion
N:1 Document
N:1 User as addedBy when stored
```

---

## Indexes

Recommended indexes:

```txt
productVersionId
documentId
productVersionId + visibility
productVersionId + sortOrder
locale
```

---

## Published immutability

ProductDocument associations belonging to PUBLISHED or SUPERSEDED ProductVersion are immutable.

To replace or hide a published document:

1. create new draft version;
2. copy existing associations;
3. modify draft association;
4. publish new version.

---

## Delete behavior

Deleting ProductDocument from draft:

- allowed;
- does not delete Document;
- may affect readiness.

Deleting draft ProductVersion may cascade-delete ProductDocument.

Deleting Document must be blocked if published ProductDocument references it.

---

## Public access

A public document endpoint must verify:

```txt
ProductDocument.visibility = PUBLIC
AND
ProductVersion is current PUBLISHED version
AND
Passport is ACTIVE
```

Historical public document access requires a separate explicit policy.

---

## Audit

Document association changes may be included in ProductVersion audit.

Potential events:

```txt
PRODUCT_DOCUMENT_ADDED
PRODUCT_DOCUMENT_REMOVED
PRODUCT_DOCUMENT_VISIBILITY_CHANGED
```

---

## Future extensions

Potential additions:

- locale-many-to-many relation;
- document role;
- mandatory document status;
- regulatory requirement mapping;
- access count;
- external public URL;
- document revision pinning.

---

## Anti-patterns

Never:

- put public visibility directly on Document only;
- allow a Document from another Organization;
- cascade-delete Document when association is removed;
- mutate published association;
- use comma-separated locale values;
- expose storage identity.

---

# ProductImage

## Purpose

ProductImage links an image asset to a ProductVersion.

It preserves the images used in each published version.

---

## Responsibilities

ProductImage is responsible for:

- ProductVersion association;
- image asset reference;
- primary-image designation;
- sort order;
- localized alt text if needed;
- public visibility.

The underlying image may use:

- a dedicated MediaAsset entity;
- Document with image category;
- storage metadata specialized for images.

The final schema decision should avoid duplicating storage logic.

---

## Recommended architecture

Preferred future-ready option:

```txt
MediaAsset
└── ProductImage
```

However, if initial MVP needs only one product image, a simpler model may store a stable asset reference through ProductImage.

Do not store image binary data in ProductVersion.

---

## Required fields

ProductImage should contain:

- id;
- productVersionId;
- asset or document reference;
- sortOrder;
- isPrimary;
- createdAt.

---

## Optional fields

Potential fields:

- altText;
- locale;
- caption;
- width;
- height;
- publicVisibility;
- crop metadata;
- addedById.

---

## Primary image invariant

A ProductVersion may have at most one primary image.

Possible enforcement:

- service logic;
- PostgreSQL partial unique index on `productVersionId WHERE isPrimary = true`.

For MVP, service logic may be sufficient if tested.

---

## Constraints

Recommended uniqueness:

```txt
productVersionId + assetId UNIQUE
```

Potential:

```txt
productVersionId + sortOrder UNIQUE
```

Only if reorder operations are transactional.

---

## Published immutability

Images associated with published ProductVersion are immutable.

Changing image creates a new draft version.

Underlying stored image used by published history must not be overwritten.

---

## Delete behavior

Removing ProductImage from draft:

- allowed;
- does not delete shared underlying asset automatically.

Deleting draft ProductVersion may cascade-delete ProductImage association.

Underlying asset deletion requires dependency checks.

---

## Public exposure

Public Passport may expose:

- optimized image URL;
- width;
- height;
- alt text;
- caption.

Never expose raw private storage key.

---

## Future extensions

Potential additions:

- gallery;
- image variants;
- WebP/AVIF derivatives;
- localized captions;
- 3D models;
- product video;
- label images.

---

## Anti-patterns

Never:

- overwrite published image object;
- store base64 images in database;
- expose storage key;
- allow multiple primary images;
- use mutable Product-level image when historical accuracy matters.

---

# Passport

## Purpose

Passport represents the stable public publication identity and state of one Product.

It separates public availability from Product lifecycle.

A Passport is associated with one Product and uses that Product's stable public code.

---

## Architectural role

Passport does not duplicate all ProductVersion content.

Public content comes from:

```txt
Passport
→ Product
→ currentPublishedVersion
```

Passport stores publication-facing metadata and public state.

---

## Responsibilities

Passport is responsible for:

- public availability;
- public route identity;
- activation state;
- withdrawal state;
- first publication timestamp;
- last publication timestamp;
- public withdrawal message;
- optional custom public settings;
- relation to stable QRCode.

---

## Ownership

Passport belongs to exactly one Product.

Organization ownership is inherited through Product.

The schema may denormalize organizationId for:

- fast public resolution;
- analytics;
- tenant filtering;
- RLS.

If stored, it must match Product.organizationId.

---

## Cardinality

Recommended:

```txt
Product 1 : 0..1 Passport
```

Passport may be created:

- when Product is created;
- when first published.

Recommended MVP behavior:

Create Passport at first publication.

This avoids public records for products never published.

---

## Lifecycle status

Recommended enum:

```txt
ACTIVE
WITHDRAWN
ARCHIVED
```

Meaning:

### ACTIVE

Public route resolves to current published version.

### WITHDRAWN

Public route remains stable but displays controlled withdrawal notice.

### ARCHIVED

Passport is no longer an active market-facing passport, but historical access behavior remains controlled.

Do not use 404 as the default for known withdrawn Passport.

---

## Required fields

Passport should contain:

- id;
- productId;
- publicCode or derived product publicCode;
- status;
- createdAt;
- updatedAt;
- firstPublishedAt.

---

## Optional fields

Potential fields:

- organizationId;
- lastPublishedAt;
- withdrawnAt;
- withdrawnById;
- withdrawalReasonCode;
- publicWithdrawalMessage;
- archivedAt;
- defaultLocale;
- customBrandingEnabled later;
- publicSettings JSON only if tightly controlled.

---

## Public code duplication decision

Preferred source of truth:

```txt
Product.publicCode
```

Passport should not duplicate publicCode unless there is a clear indexing or lifecycle reason.

If Passport stores publicCode too, one field must be authoritative and consistency must be enforced.

Recommended:

- Product owns publicCode;
- Passport resolved through Product relation;
- database index remains on Product.publicCode.

---

## Relationships

```txt
1:1 Product
0:1 QRCode
1:N ScanEvent
0:N AuditLog
```

---

## Constraints

Required:

```txt
productId UNIQUE
```

If organizationId is stored:

```txt
organizationId + productId
```

must remain consistent.

---

## Indexes

Recommended indexes:

```txt
productId
status
firstPublishedAt
lastPublishedAt
organizationId + status
```

Public resolution primarily uses Product.publicCode index.

---

## Activation

Passport becomes ACTIVE during successful publication transaction.

Required conditions:

- Product is active;
- ProductVersion is published;
- Product.currentPublishedVersionId is set;
- Organization is active;
- public code exists.

---

## Withdrawal

Withdrawal is explicit.

Withdrawal transaction should:

1. verify permission;
2. set status WITHDRAWN;
3. set withdrawnAt;
4. set actor;
5. preserve ProductVersions;
6. preserve publicCode;
7. preserve QRCode;
8. create AuditLog;
9. make public route show safe notice.

Withdrawal does not delete Product.

Withdrawal does not delete current published version.

---

## Reactivation

A withdrawn Passport may be reactivated if:

- Organization is active;
- Product is active;
- a valid current published version exists;
- actor has permission.

Reactivation should create audit event.

---

## Archival

Passport archival may accompany Product archival.

Public behavior must be defined consistently.

Recommended:

- route remains stable;
- page shows archived or no-longer-active notice;
- historical metadata may remain visible according to policy.

---

## Delete behavior

Passport associated with a Product that has ever been published must not be hard-deleted through ordinary UI.

If an unpublished erroneous Passport row exists, administrative cleanup may remove it.

---

## Public serialization

Passport public response may include:

- public code;
- status;
- first published date;
- last updated date;
- current version number;
- approved Organization public identity;
- current published ProductVersion content;
- public documents;
- public images.

Never expose:

- Passport database ID;
- Product database ID;
- Organization database ID;
- actor IDs;
- internal withdrawal reason;
- audit logs;
- private settings;
- draft references.

---

## SEO

Passport may later support:

- canonical URL;
- localized alternates;
- public metadata;
- structured data.

SEO data should generally be derived from current published translation rather than duplicated.

---

## Future extensions

Potential additions:

- custom public slug;
- branded Passport theme;
- custom domain;
- digital signature;
- verification workflow;
- product recall notice;
- status history;
- external resolver interoperability.

---

## Anti-patterns

Never:

- duplicate full ProductVersion data in Passport;
- generate new Passport for every publication;
- change public URL after update;
- delete Passport when version changes;
- expose draft data;
- use Passport status as legal certification;
- return unexplained 404 for withdrawn Passport by default.

---

# QRCode

## Purpose

QRCode represents configuration and identity for the stable QR link associated with a Product Passport.

The QR payload contains the stable public Passport URL.

QRCode does not contain the full product data.

---

## Responsibilities

QRCode is responsible for:

- Product or Passport association;
- stable target URL;
- QR configuration;
- generation metadata;
- optional stored asset references;
- download history summary if needed later.

---

## Ownership

QRCode belongs to one Product or Passport.

Recommended ownership:

```txt
QRCode belongs to Passport
```

Because QR exists for public Passport access.

Organization ownership is inherited.

---

## Cardinality

Recommended initial cardinality:

```txt
Passport 1 : 0..1 QRCode
```

One stable QR identity per Passport.

Multiple visual exports do not require multiple QR database records.

---

## Required fields

QRCode may contain:

- id;
- passportId;
- createdAt;
- updatedAt.

If generation is fully deterministic, even a persistent QRCode entity may be optional.

The model should exist only if configuration or lifecycle data must be stored.

---

## Optional fields

Potential fields:

- targetUrl;
- errorCorrectionLevel;
- margin;
- foreground setting;
- background setting;
- logoEnabled;
- generatedAt;
- lastDownloadedAt;
- pngStorageKey;
- svgStorageKey;
- designVersion.

---

## Target URL

Preferred source of truth:

```txt
application base URL + Product.publicCode
```

Do not store targetUrl if it can be safely derived.

If stored, it must be updated only through controlled domain logic.

The publicCode remains the stable identity.

---

## QR payload

QR payload must contain only the public Passport URL.

Never include:

- database IDs;
- signed private URLs;
- authentication tokens;
- user information;
- organization secrets;
- complete product JSON;
- version-specific temporary links.

---

## QR generation

Preferred MVP approach:

- generate PNG or SVG on demand;
- derive content from stable public URL;
- avoid storing generated assets unless performance or branding requires it.

If stored assets are used:

- they are cacheable derivatives;
- deletion does not invalidate Passport;
- assets can be regenerated.

---

## Constraints

Required:

```txt
passportId UNIQUE
```

This enforces one QR configuration per Passport.

---

## Indexes

Recommended:

```txt
passportId
generatedAt
```

Additional indexes usually unnecessary.

---

## Version behavior

Publishing a new ProductVersion must not create a new QRCode.

The same QR continues resolving to the stable Passport URL.

---

## Delete behavior

Deleting generated QR files is allowed.

Deleting QRCode configuration:

- must not delete Passport;
- must not delete Product;
- must not delete versions;
- QR can be regenerated.

A published Passport should always be capable of generating a QR.

---

## Download tracking

Detailed QR download events are not required for MVP.

Potential future fields:

- lastDownloadedAt;
- downloadCount.

These are operational metrics, not business-critical data.

Avoid storing one database row for every download unless needed.

---

## Public exposure

QRCode may expose generated image response.

Do not expose internal QRCode database ID.

---

## Future extensions

Potential additions:

- label templates;
- custom logo;
- print-safe variants;
- batch export;
- QR design presets;
- GS1 Digital Link;
- NFC target identity;
- short-link redirects;
- campaign-specific codes.

Campaign-specific QR codes must be separate from the stable primary Passport QR.

---

## Anti-patterns

Never:

- regenerate public identity per version;
- encode version ID into primary QR;
- store private data in QR;
- make QR asset the source of truth;
- break public link when deleting cached image;
- create multiple primary QR records for one Passport.

---

# Product domain relation summary

The canonical relationships are:

```txt
Organization
1 ─── N Product

Product
1 ─── N ProductVersion

Product
1 ─── 0..1 Passport

Product
1 ─── 0..1 currentDraftVersion

Product
1 ─── 0..1 currentPublishedVersion

ProductVersion
1 ─── N ProductTranslation

ProductVersion
1 ─── N ProductIdentifier

ProductVersion
1 ─── N ProductMaterial

ProductVersion
1 ─── N ProductDocument

ProductVersion
1 ─── N ProductImage

Organization
1 ─── N Document

Document
1 ─── N ProductDocument

Passport
1 ─── 0..1 QRCode
```

---

# Product domain ownership summary

Direct Organization ownership:

```txt
Product
Document
```

Derived Organization ownership:

```txt
ProductVersion
ProductTranslation
ProductIdentifier
ProductMaterial
ProductDocument
ProductImage
Passport
QRCode
```

Organization ownership may be denormalized on selected high-volume entities only when justified.

---

# Product domain delete matrix

## Organization deleted

Ordinary immediate hard delete:

```txt
FORBIDDEN
```

Requires controlled retention workflow.

---

## Product deleted

Allowed only if never published and dependency-safe.

Otherwise:

```txt
ARCHIVE
```

---

## ProductVersion deleted

```txt
DRAFT: allowed
READY_FOR_REVIEW: allowed with confirmation
PUBLISHED: forbidden
SUPERSEDED: forbidden
DISCARDED: allowed by retention policy
```

---

## ProductTranslation deleted

Allowed only when parent version is editable.

May cascade with deletable draft version.

---

## ProductIdentifier deleted

Allowed only when parent version is editable.

May cascade with deletable draft version.

---

## ProductMaterial deleted

Allowed only when parent version is editable.

May cascade with deletable draft version.

---

## ProductDocument deleted

Association may be removed from editable draft.

Underlying Document remains.

---

## Document deleted

Allowed only when no protected version association exists.

Otherwise archive.

---

## ProductImage deleted

Association may be removed from editable draft.

Underlying asset remains unless dependency-safe.

---

## Passport deleted

Forbidden after publication history exists.

---

## QRCode deleted

Configuration or cached asset may be deleted.

Passport remains valid.

---

# Product domain unique constraints summary

Recommended unique constraints:

```txt
Product.publicCode
```

```txt
Product:
organizationId + normalizedSku
```

```txt
ProductVersion:
productId + versionNumber
```

```txt
ProductTranslation:
productVersionId + locale
```

```txt
ProductIdentifier:
productVersionId + type + normalizedValue
```

```txt
ProductDocument:
productVersionId + documentId
```

```txt
ProductImage:
productVersionId + assetId
```

```txt
Passport.productId
```

```txt
QRCode.passportId
```

Potential partial unique constraints:

```txt
one active draft per Product
```

```txt
one primary image per ProductVersion
```

These may require manual PostgreSQL migrations.

---

# Product domain indexing summary

High-priority indexes:

```txt
Product.organizationId
Product.publicCode
Product.organizationId + lifecycleStatus
Product.organizationId + updatedAt
```

```txt
ProductVersion.productId
ProductVersion.organizationId
ProductVersion.productId + status
ProductVersion.productId + versionNumber
ProductVersion.organizationId + updatedAt
```

```txt
ProductTranslation.productVersionId + locale
```

```txt
ProductMaterial.productVersionId
```

```txt
Document.organizationId
Document.organizationId + status
Document.organizationId + category
```

```txt
ProductDocument.productVersionId
ProductDocument.documentId
ProductDocument.productVersionId + visibility
```

```txt
Passport.productId
Passport.status
```

```txt
QRCode.passportId
```

Indexes must reflect actual query patterns.

Do not create indexes for every field automatically.

---

# Publication integrity requirements

The schema and service layer together must guarantee:

1. one Product has at most one current editable draft;
2. one Product has at most one current published version;
3. published versions are immutable;
4. previous published versions are preserved;
5. version numbers are unique per Product;
6. publication is atomic;
7. QR identity remains stable;
8. Passport route remains stable;
9. public content comes only from current published version;
10. private Documents never leak publicly;
11. ProductDocument associations cannot cross Organizations;
12. deleting associations does not delete shared Documents;
13. archived Products retain history;
14. failed publication preserves prior public state.

---

# Product domain query patterns

## Active product list

Expected filter:

```txt
organizationId
+
lifecycleStatus = ACTIVE
```

Typical sort:

```txt
updatedAt DESC
```

Potential includes:

```txt
currentDraftVersion
currentPublishedVersion
Passport status
```

---

## Product detail

Required filter:

```txt
product.id
+
product.organizationId
```

Include only required relations.

Avoid loading all historical versions by default.

---

## Current draft

Resolve through:

```txt
Product.currentDraftVersionId
```

Then verify:

```txt
ProductVersion.productId = Product.id
```

---

## Current public Passport

Resolve:

```txt
Product.publicCode
```

Then verify:

```txt
Passport.status = ACTIVE
Product.currentPublishedVersionId IS NOT NULL
Product.lifecycleStatus allows public display
Organization status allows public display
```

---

## Version history

Filter:

```txt
productId
```

Sort:

```txt
versionNumber DESC
```

Draft without version number should be handled separately.

---

## Organization document library

Filter:

```txt
organizationId
```

Optional filters:

```txt
status
category
sourceLocale
createdAt
```

---

## Public documents

Filter through current published version:

```txt
ProductDocument.productVersionId = currentPublishedVersionId
AND
visibility = PUBLIC
AND
Document.status = READY
```

---

# Product domain MVP scope

Initial MVP should implement:

- Product;
- ProductVersion;
- ProductTranslation;
- ProductMaterial;
- Document;
- ProductDocument;
- Passport;
- deterministic QR generation;
- optional lightweight QRCode configuration;
- one primary ProductImage or simple asset relation;
- one current draft;
- one current published version;
- immutable publication history.

ProductIdentifier may be included in MVP if the product wizard requires multiple identifier types.

---

# Product domain deferred scope

Do not implement initially:

- batch-level passports;
- serial-item passports;
- global material taxonomy;
- full regulatory rules engine;
- digital signatures;
- blockchain;
- GS1 synchronization;
- external marketplace integrations;
- complex document revision workflow;
- multi-stage legal approval;
- campaign QR codes;
- product ownership transfer;
- cross-organization document sharing;
- custom Passport domains;
- advanced media galleries.

---

# Product domain schema implementation checklist

Before generating Prisma schema, confirm:

- Product contains only stable fields.
- Versioned public content belongs to ProductVersion.
- Localized text belongs to ProductTranslation.
- Material percentages use Decimal.
- Business identifiers use String.
- Public code is globally unique.
- SKU uniqueness is organization-scoped.
- ProductVersion number is product-scoped.
- Draft status and published status are separate.
- Published versions cannot be cascaded away.
- Document exists independently from ProductVersion.
- ProductDocument controls visibility.
- Document deletion is protected.
- Passport does not duplicate version content.
- QR uses stable public URL.
- Current draft and current published references use clearly named relations.
- Multiple Product-to-ProductVersion relations have explicit Prisma relation names.
- Manual SQL migration needs are documented.
- Partial unique indexes are considered.
- Organization isolation is testable.
- Public serialization does not depend on raw Prisma records.

---

# Product domain anti-pattern summary

The following are forbidden:

```txt
Product contains all current public fields
```

```txt
Published ProductVersion is updated in place
```

```txt
Every publication creates a new Product
```

```txt
Every publication creates a new primary QR
```

```txt
Document visibility exists only on Document
```

```txt
Deleting ProductDocument deletes Document
```

```txt
Product public URL uses database ID
```

```txt
Material percentages use Float
```

```txt
GTIN or EAN stored as integer
```

```txt
All translations stored in one unvalidated string
```

```txt
Passport duplicates the complete published snapshot
```

```txt
Draft data is returned by public API
```

```txt
Product is considered legally compliant because fields are complete
```

---

# Product and Passport Domain summary

This domain guarantees:

- stable Product identity;
- immutable published history;
- controlled draft workflow;
- localized public content;
- material composition history;
- safe Document reuse;
- explicit public visibility;
- stable Passport URLs;
- stable QR resolution;
- controlled archive and withdrawal behavior;
- tenant isolation;
- future extensibility.

The Product entity is stable.

The ProductVersion entity changes over time.

Published ProductVersions never change.

The Passport points to the current published state.

The QR code points to the stable Passport URL.

This structure is the central architectural rule of Passvero.

---

# Operational Core

The Operational Core stores historical, analytical and operational data.

Unlike the Product domain, these entities do not define the business itself.

Instead they describe:

- what happened;
- when it happened;
- who performed it;
- how the system was used.

Operational entities are append-oriented.

Most records are created once and rarely updated.

The Operational Core currently consists of:

- ScanEvent
- AuditLog

Future operational entities are described later.

---

# ScanEvent

## Purpose

ScanEvent records one public access to a Digital Product Passport.

It is the foundation for:

- analytics
- reporting
- usage statistics
- adoption metrics
- future dashboards

ScanEvent does not identify consumers.

Its purpose is statistical observation rather than user tracking.

---

## Responsibilities

ScanEvent records:

- when a passport was opened
- which Passport was opened
- which Product was viewed
- coarse geographic information
- coarse device information
- referrer category
- request metadata suitable for analytics

ScanEvent is not responsible for authentication.

ScanEvent is not responsible for access control.

---

## Ownership

ScanEvent belongs to:

Passport

↓

Product

↓

Organization

Organization ownership may be stored directly.

Recommended:

Store organizationId.

Reason:

Analytics queries will almost always be organization scoped.

---

## Lifecycle

Lifecycle:

Created

↓

Stored

↓

Aggregated

↓

Retained

↓

Archived or Deleted
(optional)

A ScanEvent is never edited.

---

## Required Fields

Recommended fields:

- id
- organizationId
- passportId
- productId
- scannedAt

---

## Optional Fields

Possible fields:

- countryCode
- region
- city (future)
- language
- deviceType
- operatingSystem
- browser
- referrerType
- campaign
- qrSource
- ipHash
- userAgentHash
- processingVersion

Avoid storing raw values whenever summarized values are sufficient.

---

## Device Type

Recommended enum:

```txt
DESKTOP

MOBILE

TABLET

BOT

UNKNOWN
```

Do not attempt excessive device fingerprinting.

---

## Referrer Type

Recommended enum:

```txt
DIRECT

QR

SEARCH

SOCIAL

EMAIL

UNKNOWN
```

Avoid storing complete URLs unless explicitly required.

---

## Country

Country should use ISO country codes.

Examples:

HR

DE

PL

SI

Never store translated country names.

---

## Privacy

Privacy is one of the most important requirements.

Recommended:

Store:

- country
- coarse region
- device category

Avoid storing:

- raw IP
- precise GPS
- user identity
- cookies
- fingerprint identifiers

If IP processing is needed:

Store only irreversible hash.

Never expose it publicly.

---

## Relationships

ScanEvent

N:1 Passport

N:1 Product

N:1 Organization

---

## Constraints

No uniqueness constraints.

Multiple scans are valid.

Duplicate events are expected.

---

## Indexes

Recommended:

organizationId

passportId

productId

scannedAt

Composite:

organizationId + scannedAt

organizationId + productId

organizationId + passportId

---

## Aggregation

Dashboard should never calculate analytics directly from millions of ScanEvents.

Instead:

ScanEvents

↓

Aggregation Job

↓

Daily Statistics

Future aggregated entities may exist.

Raw ScanEvents remain source of truth.

---

## Retention

Retention policy should remain configurable.

Possible:

Raw events:

24 months

↓

Aggregated statistics

Unlimited

Final policy depends on legal requirements.

---

## Delete Behavior

Raw ScanEvents may eventually be removed according to retention.

Aggregated metrics remain.

Deleting ScanEvents must never affect:

Products

Passports

Audit

---

## Audit

Creating ScanEvent does not generate AuditLog.

Reason:

Would generate excessive audit noise.

---

## Security

ScanEvents are private.

Consumers never access them.

Organization A must never see analytics of Organization B.

---

## Public Exposure

None.

No ScanEvent fields are public.

---

## Future Extensions

Possible additions:

Campaign tracking

UTM

Heatmaps

Time series

Hourly aggregation

Unique visitor estimation

Do not implement visitor tracking before explicit approval.

---

## Anti-patterns

Never:

Store raw IP

Track individual consumers

Identify users

Use ScanEvent for authentication

Join ScanEvent with User

Expose analytics publicly

Calculate dashboard directly from raw millions of rows

---

# AuditLog

## Purpose

AuditLog records important business actions.

Audit history exists for:

- traceability
- debugging
- security
- accountability
- administration

AuditLog is append-only.

---

## Responsibilities

AuditLog records:

Who

Did what

To which entity

When

Optional metadata

AuditLog is not business data.

AuditLog never replaces Product history.

---

## Ownership

AuditLog belongs to:

Organization

Actor (optional)

Entity (optional)

Organization ownership should be stored directly.

---

## Lifecycle

Created

↓

Stored forever

Recommended:

Never update

Never reuse

Never reorder

---

## Required Fields

Recommended:

- id
- organizationId
- action
- entityType
- entityId
- createdAt

---

## Optional Fields

Possible fields:

- actorId
- actorEmailSnapshot
- metadata
- ipHash
- requestId
- sessionId
- source
- severity

---

## Action

Recommended enum examples:

ORGANIZATION_CREATED

PRODUCT_CREATED

PRODUCT_UPDATED

PRODUCT_ARCHIVED

VERSION_CREATED

VERSION_PUBLISHED

DOCUMENT_UPLOADED

DOCUMENT_ARCHIVED

MEMBER_INVITED

MEMBER_REMOVED

PASSPORT_WITHDRAWN

LOGIN

LOGOUT

Future enums may be added.

Enums should never be reused for different meanings.

---

## Entity Type

Recommended enum:

ORGANIZATION

USER

MEMBERSHIP

PRODUCT

PRODUCT_VERSION

DOCUMENT

PASSPORT

QRCODE

SUBSCRIPTION

UNKNOWN

---

## Actor

AuditLog should reference:

User

when available.

If user later disappears:

retain

actorEmailSnapshot

or equivalent immutable representation.

History must remain understandable.

---

## Metadata

Metadata should remain concise.

Suitable examples:

```json
{
  "oldStatus":"DRAFT",
  "newStatus":"PUBLISHED"
}
```

Avoid storing:

entire Product

large JSON blobs

complete request bodies

sensitive secrets

tokens

passwords

---

## Severity

Possible enum:

INFO

WARNING

ERROR

CRITICAL

Useful primarily for administration.

---

## Relationships

AuditLog

N:1 Organization

N:1 User (optional)

Entity reference by:

entityType

entityId

Entity relation remains polymorphic.

Avoid dozens of nullable foreign keys.

---

## Polymorphic Reference

Recommended approach:

entityType

+

entityId

Reason:

Simple

Scalable

Prisma-friendly

Future-proof

---

## Constraints

No uniqueness constraints.

Audit entries are append-only.

---

## Indexes

Recommended:

organizationId

createdAt

actorId

action

entityType

Composite:

organizationId + createdAt

organizationId + action

organizationId + entityType

entityType + entityId

---

## Delete Behavior

Audit entries are not deleted through normal application flow.

If privacy regulations require anonymization:

Remove actor reference.

Retain event.

---

## Update Behavior

AuditLog rows are immutable.

No ordinary update operation exists.

---

## Public Exposure

None.

Audit is always private.

Never expose Audit through public Passport.

---

## Security

Audit must never contain:

passwords

tokens

API keys

JWTs

session cookies

storage secrets

private documents

Store references.

Never secrets.

---

## Storage Size

Audit tables grow continuously.

Large metadata should be avoided.

Indexes should remain compact.

Periodic archival may be implemented later.

---

## Future Extensions

Possible additions:

Actor IP

API key

Webhook source

BackgroundJob source

Correlation ID

Distributed tracing

External system IDs

---

## Anti-patterns

Never:

Edit audit entries

Delete audit entries casually

Store passwords

Store tokens

Store full Product JSON

Store uploaded files

Use AuditLog instead of ProductVersion history

Generate audit for every ScanEvent

---

# Operational Core Summary

Operational Core guarantees:

Append-only history

Immutable audit

Privacy-aware analytics

Organization isolation

Future BI support

Scalable reporting

Minimal personal data

Historical traceability

The Operational Core never replaces the Product domain.

It only records what happened around it.

Business truth remains inside:

Product

ProductVersion

Passport

Operational truth remains inside:

ScanEvent

AuditLog

---

# Platform Services

Platform Services provide operational capabilities for the Passvero SaaS platform.

Unlike the Product Domain, these entities are not responsible for Digital Product Passport content.

Instead, they support:

- subscriptions
- billing
- notifications
- integrations
- background processing

These entities should remain loosely coupled to the Product Domain.

Business entities must not depend on billing or notification logic.

---

# Subscription

## Purpose

Subscription represents the commercial relationship between an Organization and Passvero.

Subscription determines platform limits.

It does not define application permissions.

Permissions belong to Membership.

---

## Responsibilities

Subscription is responsible for:

- current plan
- subscription status
- trial period
- billing period
- renewal information
- subscription lifecycle

Subscription is not responsible for:

- invoices
- payment provider implementation
- payment history

Those belong to future billing integrations.

---

## Ownership

Subscription belongs to exactly one Organization.

Recommended cardinality:

```txt
Organization
1 : 0..1 Subscription
```

One active subscription per Organization.

---

## Lifecycle

Recommended states:

```txt
TRIAL

ACTIVE

PAST_DUE

GRACE_PERIOD

CANCELED

SUSPENDED
```

Meaning:

### TRIAL

Organization uses trial features.

---

### ACTIVE

Normal operation.

---

### PAST_DUE

Payment overdue.

Do not immediately disable Passport access.

---

### GRACE_PERIOD

Temporary access remains.

---

### CANCELED

Subscription ended.

Business policy determines Passport behavior.

---

### SUSPENDED

Administrative suspension.

---

## Required Fields

Recommended:

- id
- organizationId
- planId
- status
- createdAt
- updatedAt

---

## Optional Fields

Possible fields:

- startsAt
- trialEndsAt
- renewalDate
- canceledAt
- suspendedAt
- externalCustomerId
- externalSubscriptionId
- billingProvider
- notes

---

## Relationships

```txt
Subscription

N:1 Organization

N:1 Plan
```

---

## Constraints

One Organization

↓

One active Subscription

Historical subscriptions may become separate entities later.

MVP may keep a single current subscription row.

---

## Indexes

Recommended:

organizationId

status

renewalDate

trialEndsAt

---

## Delete Behavior

Subscription should never be hard deleted.

Historical commercial state is valuable.

Preferred:

Archive

or

Historical status.

---

## Public Exposure

None.

---

## Future Extensions

Possible additions:

Stripe

Paddle

Lemon Squeezy

Invoices

Coupons

Seat-based billing

Usage billing

---

## Anti-patterns

Never:

Store invoices here

Store payment methods

Store credit card data

Use Subscription for permissions

---

# Plan

## Purpose

Plan defines commercial capabilities.

Plans should remain simple.

Plans are configuration.

Not business entities.

---

## Responsibilities

Defines:

limits

branding

storage

team size

future features

---

## Recommended Plans

STARTER

PROFESSIONAL

ENTERPRISE

---

## Ownership

Global entity.

Not Organization owned.

---

## Required Fields

- id
- name

---

## Optional Fields

Possible:

- description
- sortOrder
- active
- featureFlags

---

## Future Limits

Examples:

Products

Storage

Team Members

API

Integrations

Branding

---

## Delete Behavior

Plans should never be deleted.

Inactive is preferred.

---

## Anti-patterns

Never hardcode pricing into Product logic.

---

# Notification

## Purpose

Notification represents an application-level message intended for an
Organization, one specific User inside that Organization, or the Organization
generally when no User is targeted.

Notifications improve user experience.

They never replace business logic.

Notification is the user-facing message record. It is not an email delivery
log, push-delivery record, SMS record, AuditLog, BackgroundJob, or domain
lifecycle model.

---

## Responsibilities

Examples:

- ProductVersion published

- Passport withdrawn

- Document upload failed

- Subscription past due

- Invitation accepted

- Background process completed

Business context is expressed by `eventType`, a stable uppercase snake-case
identifier. `eventType` remains a String rather than an enum so the event
vocabulary can evolve without coupling Notification to domain models.

---

## Ownership

Every Notification belongs to exactly one Organization.

Organization ownership is explicit through `organizationId`.

A Notification may optionally target one User through `userId`.

When `userId` is null, the Notification is organization-wide or visible
according to application rules. Application services must verify that a
targeted User has or had an appropriate relationship with the Organization.

Notification does not relate directly to Membership.

---

## Lifecycle

Created

↓

UNREAD

↓

READ, DISMISSED, or ARCHIVED according to application behavior

`NotificationStatus` contains exactly:

- UNREAD
- READ
- DISMISSED
- ARCHIVED

Application services control lifecycle transitions and keep `readAt`,
`dismissedAt`, and `archivedAt` consistent with the current status.

`expiresAt` may exclude a Notification from normal application views. It does
not delete, archive, or otherwise change the Notification automatically.

`NotificationStatus` replaces the earlier `NotificationSeverity` concept.
Delivery and transport states do not belong to Notification.

---

## Presentation Type

`NotificationType` expresses presentation style and urgency, not business
domain or delivery channel.

It contains:

- INFO
- SUCCESS
- WARNING
- ERROR
- ACTION_REQUIRED

Business context belongs in `eventType`.

---

## Required Fields

- id
- organizationId
- type
- status
- eventType
- title
- message
- createdAt
- updatedAt

---

## Optional Fields

- userId
- actionUrl
- entityType
- entityId
- readAt
- dismissedAt
- archivedAt
- expiresAt
- metadata

---

## Logical Entity Context

`entityType` and `entityId` provide optional logical context without foreign
keys to Product, ProductVersion, Passport, Document, Subscription, or other
domain entities.

Both fields must be null or both must be populated.

This keeps Notification loosely coupled to the Product and operational
domains.

---

## Metadata

`metadata` is optional JSON for small, allowlisted presentation context.

It must never contain secrets, provider credentials, signed URLs, request
headers, cookies, raw payloads, file contents, document contents, complete
entity snapshots, or stack traces.

Application services must allowlist metadata keys per `eventType`.

---

## Relationships

```txt
Organization 1:N Notification
User         1:N Notification (optional on Notification)
```

Use explicit relation names:

- `OrganizationNotifications`
- `UserNotifications`

Organization deletion is restricted and Organization updates cascade.

User deletion sets `userId` to null and User updates cascade.

Notification has no direct relation to domain entities or delivery providers.

---

## Delivery Boundary

Notification records application messages, not transport attempts or provider
outcomes.

Email, push, SMS, webhook, and other delivery infrastructure may reference
Notification through separate models in a future reviewed phase. Provider
identifiers, delivery channels, delivery status, retries, and failure metadata
do not belong to Notification.

---

## Delete Behavior

Notification history belongs to the Organization and must not be silently
deleted through Organization cascade behavior.

Retention and explicit deletion policy are separate reviewed concerns.

---

## Public Exposure

None.

---

## Anti-patterns

Never use Notification as AuditLog.

Never use Notification for permissions.

Never use Notification as BackgroundJob or as a domain lifecycle record.

Never store email, push, SMS, webhook, or provider delivery state on
Notification.

---

# IntegrationMapping

## Purpose

Maps Passvero entities to external systems.

Allows future integrations without polluting Product.

---

## Responsibilities

Stores:

External System

External ID

Internal Entity

Synchronization Status

---

## Ownership

Organization owned.

---

## Required Fields

- id
- organizationId
- provider
- entityType
- entityId
- externalId

---

## Providers

Future:

WooCommerce

Shopify

GS1

ERP

Custom API

---

## Relationships

```txt
Organization

1:N IntegrationMapping
```

---

## Constraints

Composite uniqueness:

organizationId

provider

entityType

entityId

---

## Delete Behavior

Safe to delete.

Only mapping disappears.

Never Product.

---

## Anti-patterns

Never add WooCommerce fields directly into Product.

---

# BackgroundJob

## Purpose

Represents asynchronous processing.

Background jobs prevent long-running HTTP requests.

---

## Responsibilities

Examples:

Image optimization

QR generation

Email sending

Exports

Imports

Analytics aggregation

---

## Ownership

System entity.

Organization optional.

---

## Lifecycle

PENDING

↓

RUNNING

↓

SUCCEEDED

↓

FAILED

↓

RETRYING

---

## Required Fields

- id
- type
- status
- createdAt

---

## Optional Fields

- organizationId
- payload
- result
- retryCount
- startedAt
- finishedAt
- failureReason

---

## Relationships

Organization optional.

---

## Delete Behavior

Old jobs may be archived or removed.

Retention policy depends on operations.

---

## Future Extensions

Queue priority

Worker name

Distributed execution

Dead-letter queue

---

## Anti-patterns

Never perform long-running operations synchronously.

Never use BackgroundJob as AuditLog.

---

# Platform Service Boundaries

Platform entities must never own Product data.

Allowed direction:

```txt
Subscription

↓

Organization
```

Forbidden:

```txt
Subscription

↓

Product
```

---

Allowed:

```txt
Notification

↓

Organization

Notification

↓

User (optional target)
```

Forbidden:

```txt
Notification

↓

Passport
```

---

Allowed:

```txt
IntegrationMapping

↓

Product
```

Forbidden:

```txt
Product

↓

WooCommerce fields
```

---

# Platform Summary

Platform Services provide:

✓ Billing

✓ Notifications

✓ Integrations

✓ Background processing

without affecting

✓ Product identity

✓ Passport history

✓ Publication workflow

Platform entities remain replaceable.

The Product Domain must continue functioning independently from commercial infrastructure.

---

# MVP Scope

Implement initially:

✓ Subscription (basic)

✓ Plan (simple)

✓ BackgroundJob (optional)

Current Platform Services milestone:

Notification

Defer:

IntegrationMapping

Advanced billing

Invoices

Coupons

Usage billing

---

# Platform Architecture Principles

The following rules are mandatory:

1. Billing must never own Product data.

2. Notification visibility may expire, but retention and deletion require a
   separate reviewed policy.

3. Integrations are mappings, not Product extensions.

4. Background jobs are infrastructure.

5. Product domain remains independent.

6. Platform entities may evolve independently.

7. Future billing provider replacement must require minimal schema changes.

8. Every platform entity must be replaceable without redesigning the Product Domain.

---

# Part 4 Summary

Identity Domain

↓

Business Domain

↓

Operational Core

↓

Platform Services

Together these four domains form the complete conceptual database model for Passvero.

The remaining work is translating this architecture into an efficient relational schema.

---

# Database Architecture & Implementation

This chapter defines how the conceptual domain model should be translated into a relational PostgreSQL database using Prisma.

It intentionally focuses on implementation strategy rather than business rules.

Business rules remain defined in:

- DOMAIN_RULES.md
- APPLICATION_FLOW.md

This chapter defines:

- relationships
- relation naming
- indexes
- transactions
- migrations
- delete behavior
- Prisma recommendations
- performance strategy

---

# Entity Relationship Overview

The recommended relationship graph is:

```txt
User
│
├── Membership
│        │
│        ▼
│   Organization
│        │
│        ├───────────── Product
│        │                    │
│        │                    ├──────── ProductVersion
│        │                    │               │
│        │                    │               ├── ProductTranslation
│        │                    │               ├── ProductIdentifier
│        │                    │               ├── ProductMaterial
│        │                    │               ├── ProductDocument
│        │                    │               └── ProductImage
│        │                    │
│        │                    ├──────── Passport
│        │                    │               │
│        │                    │               ├── QRCode
│        │                    │               └── ScanEvent
│        │                    │
│        │                    └──────── AuditLog
│        │
│        ├───────────── Document
│        │
│        ├───────────── Subscription
│        │
│        └───────────── Invitation
```

No circular ownership should exist.

---

# Aggregate Roots

The following entities are aggregate roots.

Identity Domain

Organization

User

Business Domain

Product

Operational Domain

Subscription

BackgroundJob

Every other entity belongs to one aggregate.

---

# Aggregate Rules

A child entity must never exist without its aggregate root.

Examples:

ProductVersion

↓

Product

↓

Organization

---

ProductTranslation

↓

ProductVersion

↓

Product

---

ProductMaterial

↓

ProductVersion

↓

Product

---

The aggregate root is responsible for enforcing invariants.

---

# Prisma Relation Naming

Whenever multiple relations exist between the same models, explicit relation names are mandatory.

Example:

Product

↓

ProductVersion

contains:

versions

currentDraftVersion

currentPublishedVersion

These relations should never rely on Prisma automatic naming.

Explicit names improve:

readability

migration stability

future maintenance

---

# Foreign Key Strategy

Every relationship should explicitly define:

owner

reference

delete behavior

update behavior

Avoid implicit defaults.

---

# Delete Strategy

The database should use conservative delete behavior.

Recommended defaults:

```txt
onDelete: Restrict
```

unless explicitly documented.

Never rely on cascade by accident.

---

# Cascade Delete Matrix

Safe cascades:

Draft ProductVersion

↓

Translations

↓

Identifiers

↓

Materials

↓

ProductDocuments

↓

Images

---

Unsafe cascades:

Organization

↓

Products

↓

Published Versions

↓

Passport

↓

Audit

FORBIDDEN

---

Deleting Document

↓

ProductDocument

Cascade

FORBIDDEN

---

Deleting Product

↓

Published Version

Cascade

FORBIDDEN

---

# Restrict Matrix

Recommended Restrict:

Organization

Product

Passport

Document

Subscription

AuditLog

QRCode

These entities contain historical information.

---

# Set Null Matrix

Recommended SetNull:

actorId

updatedBy

publishedBy

removedBy

Reason:

Historical events survive deleted users.

---

# Index Strategy

Indexes should be added because of query patterns.

Never index every field.

Recommended categories:

Tenant

Lookup

Sorting

Publication

Analytics

---

# Tenant Indexes

Every tenant-owned table should index:

organizationId

Examples:

Product

Document

AuditLog

ScanEvent

Invitation

Subscription

---

# Lookup Indexes

Examples:

publicCode

slug

normalizedSku

checksum

token

These fields are frequently searched.

---

# Publication Indexes

Examples:

status

publishedAt

currentPublishedVersionId

currentDraftVersionId

Useful for dashboard and publication logic.

---

# Composite Indexes

Recommended examples:

Product

organizationId

+

updatedAt

---

ProductVersion

productId

+

status

---

ProductTranslation

productVersionId

+

locale

---

AuditLog

organizationId

+

createdAt

---

ScanEvent

organizationId

+

scannedAt

---

Document

organizationId

+

category

---

Composite indexes should reflect actual queries.

---

# Partial Indexes

Some constraints cannot be expressed directly in Prisma.

Examples:

One active draft per Product.

One primary image.

One active Membership.

Use PostgreSQL partial indexes.

Document these migrations separately.

---

# Transactions

The following operations require transactions.

Publish ProductVersion

Invite User

Accept Invitation

Transfer Ownership

Archive Product

Subscription Update

Background Import

Failure should roll back completely.

---

# Optimistic Concurrency

Recommended for editable entities.

Use:

updatedAt

or

version field

to prevent lost updates.

Never silently overwrite concurrent changes.

---

# UUID Strategy

Every primary key should use UUID.

Benefits:

No enumeration

Distributed-safe

Replication-friendly

Stable imports

Avoid integer IDs.

---

# Decimal Strategy

Financial and percentage values must use Decimal.

Examples:

Material percentages

Prices (future)

Storage quotas

Never use Float.

---

# Text Strategy

Use:

String

for identifiers.

Examples:

EAN

GTIN

SKU

Passport Code

Never use integer types.

Leading zeros matter.

---

# JSON Strategy

JSON should be used sparingly.

Good candidates:

Notification metadata

Audit metadata

BackgroundJob payload

Avoid storing core Product data as JSON.

Structured data belongs in relational tables.

---

# Enum Strategy

Use enums for:

Status

Lifecycle

Visibility

Role

DocumentType

DeviceType

Avoid enums for frequently changing business lists.

Examples:

Categories

Materials

Countries

These should remain data-driven.

---

# Migration Strategy

Small migrations.

One concern per migration.

Examples:

Create Product

↓

Create Version

↓

Create Materials

↓

Create Documents

Avoid giant migrations.

---

# Seed Strategy

Seed only:

Plans

Development Organization

Development Users

Example Products

Never seed production examples.

---

# Row Level Security

If Supabase RLS is enabled:

Every tenant table must include:

organizationId

Policies should verify:

authenticated Organization

Never expose rows only by ID.

---

# Query Principles

Always:

Select only required fields.

Avoid:

SELECT *

Especially for public APIs.

---

# Serialization

Prisma models are not API responses.

Always map:

Database

↓

DTO

↓

API

Public APIs use allowlists.

---

# Performance

Prefer:

correct schema

before

premature optimization.

Optimize only after measuring.

---

# Repository Layer

Repositories:

Persistence only.

No business rules.

No authorization.

No validation.

Repositories should remain thin.

---

# Service Layer

Services enforce:

Permissions

Transactions

Business rules

Versioning

Publication

Repositories do not.

---

# API Layer

Routes should:

Authenticate

Call Services

Return DTOs

Routes should not contain domain logic.

---

# Testing Strategy

Every aggregate root requires:

Unit tests

Integration tests

Publication tests

Permission tests

Organization isolation tests

---

# Migration Safety

Every migration should answer:

Can data be migrated?

Can rollback happen?

Will history survive?

Will public Passport remain valid?

---

# Backup Considerations

Backups must preserve:

UUIDs

Public Codes

Publication history

Audit

Documents

Never regenerate public identifiers after restore.

---

# Prisma Recommendations

Prefer explicit relation names.

Prefer explicit indexes.

Prefer explicit delete rules.

Prefer explicit enum names.

Avoid magical defaults.

Schema readability is a long-term investment.

---

# MVP Database Scope

Initial schema should implement:

Identity Domain

Business Domain

Operational Core

Minimal Platform Services

Everything else remains future work.

---

# Future Schema Extensions

Reserved for:

GS1

ERP

WooCommerce

Shopify

Webhooks

API Keys

Serial Passports

Batch Passports

Workflow Engine

Do not distort the MVP schema to accommodate speculative features.

---

# Schema Generation Checklist

Before generating schema.prisma verify:

✓ Every entity has one clear owner.

✓ Aggregate roots are respected.

✓ Published history is immutable.

✓ One Product has one current draft.

✓ One Product has one current published version.

✓ ProductVersion is versioned.

✓ ProductTranslation is localized.

✓ ProductMaterial uses Decimal.

✓ ProductDocument separates visibility.

✓ Document is reusable.

✓ Passport uses stable publicCode.

✓ QRCode is stable.

✓ ScanEvent is privacy-aware.

✓ AuditLog is append-only.

✓ Subscription is independent.

✓ All tenant tables contain organization ownership.

✓ Composite indexes reflect queries.

✓ Partial indexes are documented.

✓ Delete behavior is explicit.

✓ Transactions are defined.

✓ DTO mapping is planned.

✓ Public serialization uses allowlists.

✓ RLS strategy is compatible.

---

# Final Architectural Principles

The Passvero database must guarantee:

1. Multi-tenant isolation.

2. Stable public identities.

3. Immutable publication history.

4. Version-first architecture.

5. Explicit ownership.

6. Explicit relationships.

7. Explicit delete behavior.

8. Explicit transactions.

9. Minimal duplication.

10. Future extensibility.

11. Predictable migrations.

12. High readability.

A future developer should be able to understand the schema without reading application code.

The database should express the domain, not merely store data.

This document is the canonical source for generating `schema.prisma`.

No implementation should intentionally diverge from this specification without updating this document and recording the decision in `DECISIONS.md`.
