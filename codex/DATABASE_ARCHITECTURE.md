# Passvero Database Architecture

## 1. Purpose

This document provides a concise architectural overview of the Passvero
database.

It explains:

- the primary domain boundaries;
- aggregate roots;
- ownership and multi-tenancy;
- product versioning;
- reusable assets;
- public Digital Product Passport access;
- database-enforced integrity;
- service-level invariants;
- planned analytics, audit, billing, and integration layers.

This document is not a replacement for:

- `DOMAIN_RULES.md`
- `PRISMA_DOMAIN_MODEL.md`
- `SCHEMA_IMPLEMENTATION_GUIDE.md`
- `DATABASE_CONVENTIONS.md`
- `SCHEMA_NAMING_REFERENCE.md`
- `DECISIONS.md`

Those documents remain authoritative for detailed business rules,
implementation contracts, naming, and migration behavior.

This document is the shortest path to understanding the overall database
architecture.

---

## 2. Architectural Goals

The Passvero database is designed to support a multi-tenant Digital Product
Passport SaaS platform.

Its primary goals are:

1. strict organization-level data isolation;
2. immutable published product history;
3. clear separation between internal product identity and public passport state;
4. reusable document assets without duplicating stored files;
5. version-specific product content;
6. stable public QR access;
7. privacy-conscious scan analytics;
8. durable audit history;
9. subscription-aware platform behavior;
10. safe future extension without redesigning the Product domain.

The architecture favors explicit ownership, versioned content, narrow models,
small migrations, and service-enforced cross-aggregate workflows.

---

## 3. High-Level Domain Map

```text
Identity and Tenancy
────────────────────────────────────────

User
  │
  └── Membership ───────── Organization
                              │
                              ├── Invitation
                              ├── Product
                              ├── ProductVersion
                              ├── Passport
                              └── Document


Product Domain
────────────────────────────────────────

Organization
  │
  └── Product
        │
        ├── ProductVersion
        │     │
        │     ├── ProductTranslation
        │     ├── ProductIdentifier
        │     ├── ProductMaterial
        │     ├── ProductDocument ─── Document
        │     └── ProductImage
        │
        └── Passport
              │
              └── QRCode


Planned Operational Domains
────────────────────────────────────────

QRCode
  └── ScanEvent

Organization / User / Domain Entities
  └── AuditLog

Organization
  ├── Subscription
  ├── Notification
  ├── IntegrationMapping
  └── BackgroundJob

Plan
  └── Subscription

---

# 4. Domain Layers


The database is divided conceptually into five layers.

# 4.1 Identity and Tenancy

Models:

* User
* Organization
* Membership
* Invitation

Responsibilities:

* user identity;
* organization ownership;
* role assignment;
* organization membership;
* invitation lifecycle;
* tenant authorization context.

Organization is the tenant boundary.

Most business data is either directly owned by an Organization or inherits
organization ownership through another domain entity.

---


# 4.2 Product Core

Models:

* Product
* ProductVersion
* Passport

Responsibilities:

* stable internal product identity;
* immutable version history;
* draft and published version pointers;
* public passport lifecycle;
* publication timestamps;
* archive and withdrawal behavior.

This layer is the center of the Passvero business domain.

⸻

# 4.3 Versioned Product Content

Models:

* ProductTranslation
* ProductIdentifier
* ProductMaterial
* ProductDocument
* ProductImage

Responsibilities:

* localized public product text;
* product identifiers;
* material composition;
* version-specific document associations;
* version-specific product images.

All versioned product content belongs to ProductVersion.

This rule is formalized by ADR-008.

⸻

# 4.4 Public Access and Analytics

Implemented:

* QRCode

Planned:

* ScanEvent

Responsibilities:

* public access to a Passport;
* stable QR payload identity;
* activation and revocation lifecycle;
* privacy-conscious scan analytics;
* public usage reporting.

QRCode belongs to Passport, not directly to Product.

This rule is formalized by ADR-010.

ScanEvent will belong to QRCode, not directly to Product.

This rule is formalized by ADR-011.

⸻

# 4.5 Platform Services

Planned models:

* AuditLog
* Plan
* Subscription
* Notification
* IntegrationMapping
* BackgroundJob

Responsibilities:

* durable audit history;
* billing and plan limits;
* user and organization notifications;
* external-system identity mapping;
* asynchronous processing state.

These models remain loosely coupled from the Product aggregate.

⸻

## 5. Aggregate Roots

An aggregate root defines the primary consistency boundary through which related
domain content is managed.

#5.1 Organization

Organization is the tenant aggregate root.

Directly organization-owned entities include:

* Membership
* Invitation
* Product
* ProductVersion
* Passport
* Document
* future Subscription
* future Notification
* future IntegrationMapping
* future BackgroundJob

Organization ownership must always be included in service authorization and
tenant-scoped queries.

⸻

# 5.2 Product

Product is the stable product identity.

It owns lifecycle-level concerns such as:

* organization ownership;
* internal name;
* SKU;
* normalized SKU;
* public code;
* product lifecycle;
* current draft pointer;
* current published pointer;
* product creation, update, archive, and publication timestamps.

Product does not contain public product descriptions, materials, documents, or
images.

Those belong to ProductVersion.

⸻

# 5.3 ProductVersion

ProductVersion is the aggregate root for all versioned product content.

This rule is formalized by ADR-008.

Owned content includes:

* ProductTranslation
* ProductIdentifier
* ProductMaterial
* ProductDocument
* ProductImage

Future version-specific product data must also attach to ProductVersion unless a
new architectural decision explicitly states otherwise.

Services must not attach versioned public content directly to Product.

⸻

# 5.4 Passport

Passport is the public-state aggregate for a Product.

It represents:

* whether a public Digital Product Passport exists;
* first and last publication timestamps;
* public default locale;
* withdrawal state;
* public withdrawal messaging;
* archive state.

Passport does not duplicate ProductVersion content.

The currently published ProductVersion remains the source of published product
content.

⸻

# 5.5 QRCode

QRCode is the current public QR access point for one Passport.

It stores:

* opaque public code;
* exact HTTPS target URL;
* activation state;
* generation, activation, and revocation timestamps.

QRCode does not contain:

* QR image data;
* Passport content;
* Product content;
* scan counters;
* analytics aggregates.

Generated QR images are derived artifacts.

⸻

## 6. Multi-Tenancy and Ownership

# 6.1 Tenant Boundary

Organization is the canonical tenant boundary.

A User may belong to multiple organizations through Membership.

A User does not directly own Products or Documents.

Users act on organization-owned data through Membership permissions.

⸻

# 6.2 Direct Ownership

The following models contain organizationId directly:

* Product
* ProductVersion
* Passport
* Document
* Membership
* Invitation

Direct organization ownership is used when:

* tenant-scoped queries are frequent;
* the entity has an independent lifecycle;
* the entity is operationally useful without loading another parent;
* future RLS policies benefit from direct organization ownership.

⸻

# 6.3 Inherited Ownership

The following models inherit ownership:
ProductTranslation
  → ProductVersion
  → Organization

ProductIdentifier
  → ProductVersion
  → Organization

ProductMaterial
  → ProductVersion
  → Organization

ProductDocument
  → ProductVersion
  → Organization

ProductImage
  → ProductVersion
  → Organization

QRCode
  → Passport
  → Product
  → Organization

Future ScanEvent
  → QRCode
  → Passport
  → Product
  → Organization

Inherited models must not receive redundant organizationId fields without a
new reviewed architectural decision.

# 6.4 Cross-Organization Invariants

Some organization-consistency rules span multiple tables and cannot be expressed
cleanly through basic Prisma relations.

Services must enforce:
ProductVersion.organizationId
=
Product.organizationId

Passport.organizationId
=
Product.organizationId

Product.currentDraftVersion.productId
=
Product.id

Product.currentPublishedVersion.productId
=
Product.id

ProductDocument.document.organizationId
=
ProductDocument.productVersion.organizationId

These rules must be validated inside transactional application services.

Future RLS policies should reinforce tenant isolation but must not replace
service validation.


## 7. Product Versioning Architecture

# 7.1 Stable Identity vs Versioned Content

Passvero separates:
Product
= stable internal identity

from:
ProductVersion
= one immutable content snapshot

This prevents published content from being overwritten.

# 7.2 Draft Pointer

Product contains:
currentDraftVersionId


This points to the ProductVersion currently being edited or reviewed.

The database includes a partial unique index preventing more than one active
draft-like version per Product.

Active draft-like statuses are:

* DRAFT
* READY_FOR_REVIEW

⸻

# 7.3 Published Pointer

Product contains:
currentPublishedVersionId

This points to the ProductVersion currently presented through the public
Passport.

Older published versions remain preserved as historical records.

⸻

# 7.4 Version Lifecycle
DRAFT
  │
  ▼
READY_FOR_REVIEW
  │
  ▼
PUBLISHED
  │
  ▼
SUPERSEDED

A draft may also transition to:
DISCARDED

Transition enforcement belongs to application services.

Database constraints protect structural consistency but do not implement the
complete workflow as triggers.

⸻

# 7.5 Immutable Publication

Once a ProductVersion becomes PUBLISHED:

* its public content must no longer be edited;
* its translations must not be edited;
* its identifiers must not be edited;
* its material records must not be edited;
* its ProductDocument associations must not be edited;
* its ProductImage records must not be edited.

Corrections require a new ProductVersion.

This is primarily a domain-service rule.

⸻

# 7.6 Version Cloning

ProductVersion.clonedFromVersionId records the source version used to create a
new draft.

Cloning may copy:

* translations;
* identifiers;
* materials;
* ProductDocument associations;
* ProductImage metadata.

Cloning does not make the new version published.

Storage reuse and file-copy behavior remain application-service concerns.

⸻

## 8. Product Content Models

# 8.1 ProductTranslation

Purpose:

Stores localized public product text for one ProductVersion.

Cardinality:
ProductVersion 1 ──── N ProductTranslation

Uniqueness:
productVersionId + locale

Only productName is required.

Other translated sections remain optional.

Application-interface translations are not stored here; those remain in
next-intl message files.

⸻

# 8.2 ProductIdentifier

Purpose:

Stores standardized or custom product identifiers for one ProductVersion.

Supported MVP types:

* GTIN
* EAN
* UPC
* MPN
* SKU
* CUSTOM

Uniqueness:
productVersionId + type + value

The same identifier value may exist in historical versions.

Checksum and format validation belong to services.

⸻

# 8.3 ProductMaterial

Purpose:

Stores material composition entries for one ProductVersion.

Fields include:

* material name;
* optional category;
* optional percentage;
* recycled-content indicator;
* optional recycled percentage;
* optional supplier;
* notes.

Database checks enforce:

* percentage between 0 and 100;
* recycledPercentage between 0 and 100;
* recycledPercentage cannot exist when isRecycled is false.

The database does not require all material percentages to sum to 100 because
partial disclosure may be valid.

Aggregate composition validation belongs to services.

⸻

## 9. Document and Media Architecture

# 9.1 Document

Document represents a reusable organization-owned physical file asset.

This is formalized by ADR-009.

Document stores:

* original filename;
* optional display name;
* storage provider;
* storage bucket;
* storage key;
* MIME type;
* file size;
* SHA-256 checksum;
* upload lifecycle;
* actor history.

Document does not contain product-specific category, locale, visibility, label,
or ordering.

⸻

# 9.2 ProductDocument

ProductDocument represents the business relationship between a reusable
Document and one ProductVersion.

It stores association-specific metadata:

* category;
* locale;
* display label;
* description;
* public visibility;
* primary hint;
* sort order.

This allows one physical file to be reused in different business contexts.

Example:
Document
  originalFilename: technical-file-2026.pdf

ProductDocument A
  category: USER_MANUAL
  locale: en
  displayLabel: User manual

ProductDocument B
  category: INSTALLATION_GUIDE
  locale: de
  displayLabel: Installationsanleitung

ProductDocument does not duplicate storage metadata.

⸻

# 9.3 ProductImage

ProductImage is different from Document.

It belongs directly to ProductVersion and stores both:

* image storage metadata;
* version-specific presentation metadata.

Fields include:

* storage identity;
* MIME type;
* file size;
* checksum;
* width;
* height;
* alt text;
* caption;
* public visibility;
* primary hint;
* sort order.

Supported image MIME types are currently:

* image/jpeg
* image/png
* image/webp
* image/avif

SVG and GIF are excluded from the MVP.

ProductImage does not use the reusable Document association architecture.

⸻

## 10. Public Passport Architecture

# 10.1 Product Public Code

Product.publicCode is the stable public product-facing identifier.

It does not directly represent QR lifecycle or the exact QR payload.

⸻

# 10.2 Passport

Passport represents the public publication state of Product.

The Passport public page should resolve published data from:
Passport
  → Product
  → currentPublishedVersion
The Passport must never silently expose current draft content.

# 10.3 QRCode

QRCode represents a public access point to Passport.

This is formalized by ADR-010.
QRCode
  → Passport
  → Product
  → currentPublishedVersion
For MVP:
Passport 1 ──── 0..1 QRCode

QRCode stores the exact target URL encoded in the physical QR payload.

QRCode lifecycle:
PENDING
  │
  ▼
ACTIVE
  │
  ▼
REVOKED

The database enforces timestamp consistency for each state.

Transition permissions remain service-controlled.

⸻

## 11. Planned Scan Analytics Architecture

ScanEvent is not yet implemented.

Its planned ownership is:
QRCode
  └── ScanEvent

This is formalized by ADR-011.

ScanEvent must not belong directly to Product.

This allows analytics to remain accurate if:

* QR codes are regenerated;
* multiple QR access points are introduced later;
* a QR is revoked;
* future access technologies coexist.

Planned ScanEvent principles include:

* append-only event records;
* privacy-minimized data;
* no raw long-lived IP storage;
* coarse location only;
* coarse device and user-agent classification;
* tenant ownership inherited through QRCode;
* analytics indexes optimized for QR and time-based queries.

Aggregated analytics may later be materialized separately if event volume
requires it.

⸻

## 12. Audit Architecture

AuditLog is planned but not yet implemented.

AuditLog will record durable domain actions such as:

* Product creation;
* draft creation;
* version review readiness;
* publication;
* Product archive;
* Passport withdrawal;
* QR activation;
* QR revocation;
* Membership changes;
* Invitation changes;
* Document archive;
* billing-plan changes.

AuditLog should be append-only.

AuditLog should not store sensitive secrets, complete request bodies, file
contents, or access tokens.

Actor foreign keys may be nullable to preserve history after user deletion.

Audit logging should be written transactionally with the domain operation where
practical.

⸻

## 13. Platform and Billing Architecture

# 13.1 Plan

Plan will define commercial capability limits such as:

* number of Products;
* active Passports;
* organization members;
* document storage;
* scan analytics retention;
* API access;
* integrations.

Plan is platform-owned, not organization-owned.

⸻

# 13.2 Subscription

Subscription will belong to Organization and reference Plan.

Subscription records should describe billing state but must not become the
authoritative financial ledger.

External billing providers remain authoritative for payment settlement.

IntegrationMapping may store external subscription and customer identifiers.

⸻

# 13.3 Notification

Notification will represent application-level messages for users or
organizations.

It should remain separate from email delivery logs unless a future requirement
requires a dedicated delivery model.

⸻

# 13.4 IntegrationMapping

IntegrationMapping will connect Passvero entities to external provider
identifiers.

Examples:

* Stripe customer;
* Stripe subscription;
* ERP product;
* PIM product;
* external document;
* GS1 resource.

External identifiers must not be placed directly across unrelated domain
models.

⸻

# 13.5 BackgroundJob

BackgroundJob will represent durable asynchronous work such as:

* document processing;
* image optimization;
* QR artifact generation;
* export generation;
* notification delivery;
* integration synchronization;
* analytics aggregation.

BackgroundJob state must not replace the business lifecycle state of Product,
Passport, Document, or QRCode.

⸻

## 14. Delete Strategy

Passvero avoids indiscriminate cascade deletion.

# 14.1 Restrict

Use Restrict where dependent business history must be protected.

Examples:
Organization → Product
Organization → ProductVersion
Organization → Passport
Organization → Document
Product → ProductVersion
Product → Passport
Document → ProductDocument

# 14.2 Cascade

Use Cascade for content that has no independent meaning without its parent.

Examples:
ProductVersion → ProductTranslation
ProductVersion → ProductIdentifier
ProductVersion → ProductMaterial
ProductVersion → ProductDocument
ProductVersion → ProductImage
Passport → QRCode
QRCode → future ScanEvent

Application rules still prevent deletion of published historical content.

Database cascade behavior does not imply that every parent is freely deletable.

⸻

# 14.3 SetNull

Use SetNull for historical actor references and optional provenance.

Examples:

* createdBy;
* updatedBy;
* publishedBy;
* archivedBy;
* withdrawnBy;
* invitedBy;
* acceptedBy;
* clonedFromVersion.

Removing a User must not destroy historical business records.

⸻

## 15. Archive and Withdrawal Strategy

Passvero distinguishes between:

* archive;
* withdrawal;
* deletion.

# 15.1 Archive

Archive means the entity is retained but removed from normal active workflows.

Examples:

* Product lifecycle ARCHIVED;
* Document status ARCHIVED;
* Passport status ARCHIVED.

⸻

# 15.2 Withdrawal

Passport withdrawal represents a public compliance event.

A withdrawn Passport may display a public withdrawal message.

Withdrawal history must be retained.

Withdrawal is not equivalent to deleting the Product.

⸻

# 15.3 Deletion

Hard deletion is reserved primarily for:

* unpublished drafts;
* dependent draft content;
* legally permitted account cleanup;
* test or development environments;
* explicitly reviewed retention workflows.

Published product history should normally remain preserved.

⸻

## 16. Database-Enforced Integrity

The database currently protects important invariants using:

* primary keys;
* foreign keys;
* unique constraints;
* partial unique indexes;
* composite indexes;
* PostgreSQL CHECK constraints.

Examples include:

ProductVersion

* one active draft-like version per Product;
* unique version number per Product.

ProductTranslation

* one locale per ProductVersion.

ProductIdentifier

* unique type/value combination per ProductVersion.

ProductMaterial

* percentage range;
* recycled-percentage range;
* recycled flag consistency.

Document

* durable storage identity uniqueness;
* valid SHA-256 format;
* positive file size;
* lifecycle timestamp consistency.

ProductDocument

* non-negative sort order.

ProductImage

* storage identity uniqueness;
* valid SHA-256 format;
* positive size;
* positive dimensions;
* allowed MIME types;
* non-negative sort order.

QRCode

* one QR per Passport for MVP;
* unique public code;
* unique target URL;
* controlled code format;
* HTTPS-only target URL;
* lifecycle timestamp consistency.

⸻

## 17. Service-Level Invariants

Not every business rule belongs in PostgreSQL.

Application services must enforce:

* tenant authorization;
* Membership permissions;
* cross-organization relation consistency;
* ProductVersion ownership consistency;
* current-version pointers referencing the same Product;
* ProductVersion lifecycle transitions;
* immutable published versions;
* publication completeness;
* required translations before publication;
* normalized identifier validation;
* ProductMaterial aggregate rules;
* Document availability before association;
* ProductDocument primary selection;
* ProductImage primary selection;
* QR lifecycle transitions;
* cryptographically secure QR code generation;
* valid canonical public URLs;
* Passport withdrawal authorization;
* plan limits;
* billing entitlement checks.

Cross-aggregate operations should run inside transactions.

⸻

## 18. Transaction Boundaries

The following operations should normally be transactional.

Organization onboarding

* create Organization;
* create OWNER Membership;
* write AuditLog later.

Product creation

* create Product;
* create initial ProductVersion;
* set currentDraftVersionId;
* write AuditLog later.

Draft creation from published version

* create ProductVersion;
* clone versioned children;
* update currentDraftVersionId;
* write AuditLog later.

Publication

* validate ProductVersion;
* mark previous published version SUPERSEDED;
* mark new version PUBLISHED;
* update Product.currentPublishedVersionId;
* clear or replace currentDraftVersionId;
* create or update Passport;
* create or activate QRCode if required;
* write AuditLog later.

Passport withdrawal

* update Passport status and timestamps;
* revoke QRCode if required by the chosen policy;
* write AuditLog later.

Document association

* verify Document availability;
* verify organization consistency;
* create ProductDocument;
* write AuditLog later.

⸻

## 19. Query Architecture

# 19.1 Organization Product List

Query Product by:

* organizationId;
* lifecycleStatus;
* updatedAt;
* search filters handled by services.

Do not load complete ProductVersion content for list views unless required.

⸻

# 19.2 Product Workspace

Load:
Product
├── currentDraftVersion
│   ├── translations
│   ├── identifiers
│   ├── materials
│   ├── productDocuments
│   │   └── document
│   └── images
├── currentPublishedVersion
└── passport
    └── qrCode

The exact selection should remain DTO-driven.

Avoid returning raw Prisma records directly to UI or public APIs.

⸻

# 19.3 Public Passport

Resolve:
QRCode code or Product publicCode
  → Passport
  → Product
  → currentPublishedVersion
      ├── requested translation
      ├── fallback translation
      ├── identifiers
      ├── materials
      ├── public ProductDocuments
      └── public ProductImages

Public queries must explicitly select allowlisted fields.

Internal notes, actor IDs, storage keys, and unpublished content must not leak.

⸻

# 19.4 Analytics

Future analytics queries should be based on:
QRCode + timestamp range

and then aggregate by:

* day;
* country or region;
* device class;
* referrer category;
* campaign context if introduced.

Product-level analytics can be derived through QRCode → Passport → Product.

⸻

## 20. DTO and API Boundaries

Prisma models are persistence models.

They are not automatically safe public response objects.

The application must use explicit DTOs for:

* dashboard lists;
* product workspace;
* public passport;
* document access;
* QR export;
* scan analytics;
* audit views;
* billing status.

Public DTOs must never expose:

* storage bucket;
* storage key;
* internal actor IDs;
* internal notes;
* unpublished ProductVersions;
* token hashes;
* invitation token material;
* billing-provider secrets;
* integration credentials;
* raw audit metadata;
* future raw scan-network data.

⸻

## 21. RLS Compatibility

Row Level Security is not yet enabled.

The schema is designed to remain compatible with future PostgreSQL RLS.

Directly organization-owned tables can use organizationId policies.

Inherited tables may require policies using parent relations.

Examples:
ProductTranslation
  → ProductVersion.organizationId

ProductDocument
  → ProductVersion.organizationId

QRCode
  → Passport.organizationId

ScanEvent
  → QRCode
  → Passport.organizationId

RLS must be introduced through separate reviewed migrations.

RLS must not be enabled without corresponding service, connection, migration,
and operational testing.

⸻

## 22. Migration Strategy

Passvero uses small, reviewable migrations.

Each domain addition should normally follow:

1. inspect authoritative documentation;
2. verify current migration state;
3. modify Prisma schema;
4. generate one focused migration without applying it;
5. manually add PostgreSQL constraints if required;
6. run focused tests;
7. run the complete suite;
8. run Prisma validation and generation;
9. run typecheck, lint, and production build;
10. review migration SQL;
11. deploy in a separate explicitly approved task;
12. verify database status;
13. commit the reviewed change.

Never modify an applied migration.

Never use db push as a production migration substitute.

Never reset a shared or production database to resolve migration problems.

⸻

## 23. Current Implemented Model Inventory

Identity

* User
* Organization
* Membership
* Invitation

Product Core

* Product
* ProductVersion
* Passport

Product Content

* ProductTranslation
* ProductIdentifier
* ProductMaterial

Documents and Media

* Document
* ProductDocument
* ProductImage

Public Access

* QRCode

⸻

## 24. Planned Model Inventory

Analytics

* ScanEvent

Audit

* AuditLog

Billing

* Plan
* Subscription

Platform Services

* Notification
* IntegrationMapping
* BackgroundJob

These models must be implemented through separate reviewed phases.

⸻

## 25. Architectural Decisions Summary

The current architecture relies on these core decisions:

ADR-008

ProductVersion is the aggregate root for all versioned product content.

ADR-009

Document represents a reusable physical asset.

ProductDocument represents the version-specific business relationship.

ADR-010

QRCode represents a public access point to Passport, not to Product.

ADR-011

ScanEvent belongs to QRCode, not directly to Product.

Future architectural decisions must remain consistent with these boundaries or
explicitly supersede them through a new ADR.

⸻

## 26. Architecture Freeze

The following implemented Product Domain models are considered architecturally
frozen:

* Product
* ProductVersion
* Passport
* ProductTranslation
* ProductIdentifier
* ProductMaterial
* Document
* ProductDocument
* ProductImage
* QRCode

They should not be changed merely for convenience during API or UI
implementation.

Changes require at least one of:

* a validated business requirement;
* a regulatory requirement;
* an identified data-integrity defect;
* a demonstrated performance problem;
* a reviewed architectural decision.

Convenience alone is not sufficient reason to change the database model.

⸻

## 27. Final Architecture Principles

1. Organization is the tenant boundary.
2. Product is stable identity.
3. ProductVersion owns versioned content.
4. Published versions are immutable.
5. Passport owns public publication state.
6. QRCode is a Passport access point.
7. ScanEvent belongs to QRCode.
8. Document is a reusable asset.
9. ProductDocument stores version-specific document meaning.
10. ProductImage is independent versioned media.
11. Actor deletion must not erase history.
12. Public APIs use explicit DTO allowlists.
13. Cross-aggregate invariants belong to transactional services.
14. PostgreSQL protects structural integrity.
15. Application services protect business workflows.
16. Small reviewed migrations are preferred over broad schema changes.
17. Future platform services remain loosely coupled from the Product aggregate.
18. Existing Product Domain models remain frozen unless a real requirement
    justifies change.