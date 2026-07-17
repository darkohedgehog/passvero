# Passvero Domain Rules

This document defines the business rules of the Passvero domain.

Codex must read this file before implementing or modifying:

- Prisma models;
- database migrations;
- authentication;
- organization onboarding;
- product management;
- product versions;
- Digital Product Passports;
- documents;
- QR codes;
- publication;
- analytics;
- team permissions;
- billing;
- audit logs;
- deletion and archival behavior.

This document supplements:

- `codex/AGENTS.md`
- `codex/PROJECT_CONTEXT.md`
- `codex/ARCHITECTURE.md`
- `codex/APPLICATION_DESIGN_SYSTEM.md`
- `codex/APPLICATION_FLOW.md`
- `codex/SECURITY.md`

This document defines business meaning and invariants.

It does not define the final Prisma schema.

The future `codex/PRISMA_DOMAIN_MODEL.md` must translate these rules into entities, relations, constraints, indexes and delete behavior.

---

# 1. Core domain principles

Passvero is a multi-tenant SaaS application.

Every private business record belongs to exactly one organization unless explicitly defined as system-wide.

The application must enforce:

1. organization isolation;
2. stable public identifiers;
3. immutable published history;
4. explicit publication;
5. truthful status labels;
6. public/private data separation;
7. reversible non-destructive workflows where practical;
8. auditability of important changes;
9. least-privilege access;
10. no unsupported legal certification claims.

The database is not the business rule layer by itself.

Business invariants must be enforced in server-side services and supported by database constraints where possible.

---

# 2. Tenant and ownership model

## 2.1 Organization as tenant

An Organization is the primary tenant boundary.

An organization represents a company or business entity using Passvero.

All organization-owned records must include an organization relationship.

Examples:

- memberships;
- products;
- product versions;
- documents;
- invitations;
- scan analytics;
- QR records;
- audit events;
- subscription data.

## 2.2 Organization isolation

A user must never access organization-owned data only by supplying an object ID.

Every authenticated private query must derive the organization from the authenticated session and verify membership.

Unsafe pattern:

```txt
find product where id = productId
```

Required pattern:

```txt
find product where:
- id = productId
- organizationId = authenticatedOrganizationId
```

The same rule applies to:

- updates;
- deletes;
- uploads;
- downloads;
- publication;
- version history;
- team management;
- analytics;
- billing.

## 2.3 No client-trusted ownership

The application must never trust organization ownership supplied by:

- form data;
- query parameters;
- route bodies;
- browser state;
- hidden inputs;
- local storage.

Organization identity comes from the authenticated server session and selected organization membership.

## 2.4 Cross-organization sharing

Cross-organization sharing is out of scope for the initial release.

A product, document, passport or QR code cannot belong to multiple organizations.

Future collaboration features must be explicitly designed before implementation.

---

# 3. User

## 3.1 User identity

A User represents a human account.

A user may belong to one or more organizations through Membership records.

User identity data may include:

- email;
- display name;
- authentication provider identifiers;
- profile preferences;
- preferred locale;
- created date;
- last active date.

## 3.2 User email

User email must be unique according to the chosen authentication architecture.

Email should be normalized before comparison where supported.

Do not expose user email publicly through product passports.

## 3.3 User deletion

Deleting a user account must not destroy published product history.

Important historical references should be preserved through one of:

- nullable actor relation;
- immutable actor display snapshot;
- system audit record;
- anonymized user reference.

The final approach must be defined in the Prisma model.

## 3.4 Personal preferences

User preferences belong to the user, not the organization.

Examples:

- application locale;
- timezone;
- notification preferences;
- table-density preferences later.

Do not store critical authorization state in user preferences.

---

# 4. Organization

## 4.1 Organization fields

An organization may contain:

- public display name;
- legal name;
- country;
- website;
- contact email;
- VAT or tax identifier;
- logo;
- default language;
- public support contact;
- organization slug.

Not every field is public.

## 4.2 Public organization identity

Only explicitly public organization fields may appear on a public passport.

Potential public fields:

- display name;
- public website;
- public contact email;
- logo;
- country;
- manufacturer/importer/distributor role.

Private organization fields must not be exposed:

- billing email;
- internal notes;
- subscription identifiers;
- private team information;
- authentication metadata.

## 4.3 Organization slug

An organization slug may be used for internal or future public routing.

If used, it must be:

- unique;
- normalized;
- stable unless changed through a controlled process;
- not relied on as the sole security boundary.

## 4.4 Organization deletion

Organization deletion is a high-impact destructive operation.

Initial release should prefer:

- deactivation;
- scheduled deletion;
- administrative review;
- export opportunity.

An organization with published passports must not be immediately hard-deleted without a defined retention and public-link policy.

## 4.5 Organization status

Potential organization states:

```txt
ACTIVE
SUSPENDED
DEACTIVATED
PENDING_DELETION
```

Do not expose these states publicly unless needed.

---

# 5. Membership

## 5.1 Membership meaning

Membership connects a User to an Organization.

A membership contains:

- organization;
- user;
- role;
- membership status;
- joined date;
- invited-by reference where available.

## 5.2 Unique membership

A user may have at most one active membership per organization.

Duplicate memberships for the same user and organization are not allowed.

## 5.3 Membership roles

Initial roles:

```txt
OWNER
ADMIN
EDITOR
VIEWER
```

Detailed permissions are defined in `codex/PERMISSIONS.md`.

## 5.4 Membership status

Potential states:

```txt
ACTIVE
SUSPENDED
REMOVED
```

Pending invitation is represented by Invitation, not an active Membership.

## 5.5 Last owner protection

An organization must always have at least one active owner.

The system must prevent:

- removing the last owner;
- demoting the last owner;
- deleting the last owner membership;
- owner self-removal without ownership transfer.

## 5.6 Membership deletion

Membership removal must not erase historical actions.

Audit history should retain a safe actor representation.

---

# 6. Invitation

## 6.1 Invitation meaning

An Invitation represents a request to join an organization.

It contains:

- organization;
- invitee email;
- role to grant;
- token or secure token hash;
- invited-by actor;
- expiration;
- status;
- acceptance date.

## 6.2 Invitation states

```txt
PENDING
ACCEPTED
EXPIRED
REVOKED
```

## 6.3 Invitation rules

- Only authorized roles may invite.
- Invitation role cannot exceed inviter authority.
- Duplicate active invitations to the same email and organization should be prevented or replaced.
- Expired or revoked invitations cannot be accepted.
- Invitation tokens must be single-use.
- Raw secure tokens must not be stored when a hash can be used.

## 6.4 Existing member invitation

A currently active member should not receive a new active invitation for the same organization.

---

# 7. Product

## 7.1 Product meaning

A Product is the stable business identity of an item managed by an organization.

It is not itself the complete published passport content.

The Product contains stable or operational fields such as:

- organization ownership;
- internal product name;
- SKU;
- stable public passport code;
- lifecycle status;
- archive state;
- current draft reference;
- current published version reference;
- created and updated timestamps.

Versioned passport content belongs to ProductVersion.

## 7.2 Product ownership

A product belongs to exactly one organization.

A product cannot be moved between organizations in the initial release.

Moving products across organizations requires an explicit future migration workflow.

## 7.3 Product stable identity

A product retains its identity across updates and publications.

The following must remain stable unless changed by a controlled process:

- product database identity;
- public passport code;
- public passport URL;
- organization ownership.

## 7.4 Product SKU

SKU uniqueness is organization-scoped.

Recommended rule:

- SKU may be optional;
- when present, SKU must be unique within an organization;
- SKU may be reused only after an explicit product archival or policy decision.

Case normalization rules must be decided before schema implementation.

## 7.5 Product public code

Each product receives a stable, non-sequential public code.

The code:

- is globally unique or sufficiently collision-resistant;
- does not expose database IDs;
- does not contain sensitive information;
- remains stable across versions;
- is used by the public passport URL and QR code.

Example:

```txt
https://passvero.eu/p/8F4KX9
```

Localized public routing may be implemented separately, but the underlying code remains stable.

## 7.6 Product status

Product lifecycle state and publication state must not be conflated.

A product may have:

- draft changes;
- an active published version;
- both at the same time.

Example:

```txt
Published version 3 is public.
Draft version 4 is being edited.
```

The product remains publicly published while the new draft is incomplete.

## 7.7 Product archival

Archiving a product:

- removes it from ordinary active lists;
- prevents ordinary editing unless restored;
- does not erase versions;
- does not automatically destroy public history;
- may disable public visibility only through an explicit policy.

The public behavior of archived products must be intentional.

Recommended initial behavior:

- archived product with a previously published passport remains publicly accessible;
- public page may show an archived or no-longer-active notice;
- QR URL remains stable.

## 7.8 Product deletion

Hard deletion should be allowed only when:

- the product has never been published;
- no compliance-relevant history must be retained;
- no shared documents would be improperly deleted;
- the user has required permission;
- destructive confirmation is completed.

A product that has ever been published should normally be archived, not hard-deleted.

## 7.9 Product duplication

Duplicating a product creates:

- a new Product;
- a new public code;
- a new draft version;
- copied eligible content;
- no copied publication history;
- no copied scan events;
- no copied QR identity.

Documents may be linked or copied based on future document-reuse rules.

---

# 8. ProductVersion

## 8.1 ProductVersion meaning

A ProductVersion is a versioned snapshot of passport content for a Product.

It may represent:

- an editable draft;
- a review-ready draft;
- a published immutable snapshot;
- an archived historical version.

## 8.2 Version ownership

A ProductVersion belongs to exactly one Product.

Organization ownership is inherited through the Product, but may also be denormalized where needed for query safety or performance.

## 8.3 Version numbering

Version numbers are product-scoped and sequential.

Example:

```txt
Product A:
Version 1
Version 2
Version 3
```

A version number must be unique within one product.

Version numbering should be assigned transactionally.

## 8.4 Draft version

A product may have at most one active editable draft in the initial release.

A draft version:

- may be incomplete;
- may be modified;
- is private;
- cannot be accessed through the public passport route;
- may be deleted if never published and no retention rule applies.

## 8.5 Published version immutability

A published ProductVersion is immutable.

After publication:

- ordinary fields cannot be edited;
- materials cannot be altered;
- document associations cannot be altered;
- translated content cannot be overwritten;
- publication timestamps cannot be rewritten.

Corrections require a new draft and a new publication.

## 8.6 New draft after publication

When editing a published product:

- create or reuse one new active draft;
- initialize it from the current published version when appropriate;
- preserve the published version unchanged;
- publish the draft as the next version only after explicit confirmation.

## 8.7 Current published version

A Product may have at most one current published version.

Historical published versions remain stored.

The current public passport page displays the current published version.

## 8.8 Previous versions

Previous versions may later support:

- historical viewing;
- internal comparison;
- restoration as a new draft;
- audit review.

Previous versions must not be silently deleted during ordinary updates.

## 8.9 Version deletion

An unpublished draft may be discarded.

A published version must not be hard-deleted through ordinary product UI.

Exceptional administrative deletion requires a separate retention and legal policy.

## 8.10 Version content

Versioned content may include:

- localized product name;
- descriptions;
- manufacturer;
- economic operator role;
- country of origin;
- identifiers;
- technical characteristics;
- materials;
- repairability information;
- spare-parts information;
- recycling and disposal information;
- public document associations;
- product images;
- regulatory notes;
- publication readiness data.

The exact structure will be defined in the Prisma domain model.

---

# 9. Localization of product data

## 9.1 Interface vs product-content localization

Application interface translations and product-content translations are separate concepts.

Application UI uses `next-intl`.

Product content is organization-managed domain data.

## 9.2 Source language

Every ProductVersion should have one designated source language.

The source language:

- is chosen by the organization;
- may default to organization default language;
- identifies the canonical authoring language;
- does not imply that translations are complete.

## 9.3 Product translation

Localized product content may include:

- product name;
- description;
- repair instructions;
- recycling information;
- document display titles;
- public warnings.

Translations should be stored as structured records or a carefully designed JSON model.

The final approach must preserve:

- per-language completeness;
- version history;
- validation;
- indexing needs;
- type safety.

## 9.4 Translation completeness

Translation completeness must not be confused with legal compliance.

Use labels such as:

```txt
Translation complete
Translation incomplete
Not translated
```

Do not show:

```txt
EU language compliant
```

## 9.5 Published translation immutability

Translations included in a published version are immutable with that version.

Translation corrections create a new product version.

---

# 10. Product identifiers

## 10.1 Identifier types

Potential identifier types:

```txt
SKU
GTIN
EAN
UPC
MODEL_NUMBER
MPN
BATCH
LOT
SERIAL_PATTERN
CUSTOM
```

Only approved identifiers should be implemented initially.

## 10.2 Identifier ownership

Identifiers belong to a ProductVersion when they are part of the published snapshot.

Stable internal SKU may also exist on Product for operational search.

## 10.3 Identifier uniqueness

Not every identifier type is globally unique.

Potential rules:

- public passport code: globally unique;
- SKU: unique within organization;
- GTIN/EAN: uniqueness may be organization-scoped or globally validated according to business requirements;
- model number: not necessarily unique;
- batch and lot: may belong to future item or batch-level passports.

Do not impose incorrect global uniqueness without approved rules.

## 10.4 Instance and batch passports

Initial Passvero scope is product-model-level passporting.

Batch-level and serial-item-level passports are future capabilities.

Do not prematurely model every physical unit unless explicitly requested.

---

# 11. Material

## 11.1 Material meaning

A Material entry represents one material or composition component included in a ProductVersion.

A material is versioned content.

## 11.2 Material ownership

A Material belongs to one ProductVersion.

Published material records are immutable with their published version.

## 11.3 Material fields

Potential fields:

- material name;
- standardized material code later;
- percentage;
- country of origin;
- recycled content percentage;
- renewable content;
- hazardous-substance notes;
- free-form notes;
- sort order.

## 11.4 Percentage rules

Material percentage:

- may be optional;
- must be between 0 and 100 when present;
- total may be less than 100 when composition is partial;
- total above 100 is invalid;
- exactly 100 should not be required unless product-category rules require it.

## 11.5 Material catalog

A global standardized material catalog is future scope.

Initial release may use organization-entered material names.

Do not imply that user-entered material names are officially standardized.

## 11.6 Material deletion

Deleting material from a draft is allowed.

Published material history remains immutable.

---

# 12. Document

## 12.1 Document meaning

A Document is an organization-owned uploaded file with metadata.

It is separate from the association that exposes it on a specific ProductVersion.

This separation allows future reuse across multiple products and versions.

## 12.2 Document ownership

A document belongs to exactly one organization.

A document may later be linked to multiple products or versions within that organization.

Cross-organization reuse is not allowed.

## 12.3 Document metadata

Potential fields:

- organization;
- storage key;
- original filename;
- safe display filename;
- title;
- type;
- MIME type;
- size;
- checksum;
- upload status;
- uploaded-by actor;
- created date;
- archived date;
- virus-scan state later.

## 12.4 Document categories

Initial categories:

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

## 12.5 Public and private visibility

Document storage ownership and public visibility are separate.

A document may be:

- private to organization;
- linked privately to product;
- exposed publicly through a specific published ProductVersion.

Public exposure must be explicit.

## 12.6 Published document association

A published ProductVersion should reference a stable document association or snapshot.

Removing a document from the organization library must not silently break published passport history.

Recommended rule:

- documents referenced by published versions cannot be physically deleted through ordinary UI;
- they may be archived;
- their published association remains resolvable.

## 12.7 Document replacement

Replacing a document should create:

- a new uploaded Document or document revision;
- a new draft ProductVersion association;
- no mutation of the file referenced by an already published version.

## 12.8 Document deletion

Hard deletion is allowed only when:

- no published version references the file;
- no active draft requires it;
- authorization permits deletion;
- storage deletion succeeds or is safely queued.

Otherwise archive the document.

## 12.9 File integrity

Store a checksum where useful.

Do not trust:

- extension alone;
- client MIME type alone;
- original filename as storage path.

## 12.10 Storage failure

Database state and storage state must remain consistent.

Upload and delete workflows must handle partial failure.

Avoid database records pointing to missing files without a recoverable status.

---

# 13. ProductDocument association

## 13.1 Association meaning

A ProductDocument association connects a Document to a ProductVersion.

It may include:

- document;
- product version;
- display title;
- public visibility;
- sort order;
- category override if needed;
- locale applicability;
- added date.

## 13.2 Versioned association

Document visibility and association are part of the ProductVersion snapshot.

Published associations are immutable.

## 13.3 Same document in multiple versions

A document may be referenced by multiple versions.

Do not duplicate physical storage unnecessarily.

## 13.4 Localized documents

A document may apply to:

- all languages;
- one language;
- multiple specific languages.

The final model must avoid ambiguous language ownership.

---

# 14. Product image

## 14.1 Image meaning

Product images are organization-owned media assets.

They may be modeled as a specialized Asset entity or document/media model.

## 14.2 Image versioning

Published ProductVersions must preserve references to the images used at publication time.

Replacing a product image should not silently alter previous published versions.

## 14.3 Primary image

A ProductVersion may have at most one primary image.

Additional gallery images may be supported later.

## 14.4 Image deletion

Images used by published versions should be archived rather than physically removed.

---

# 15. Digital Product Passport

## 15.1 Passport meaning

A Digital Product Passport is the public representation of the current published ProductVersion.

It is not necessarily a separate independent content entity.

The final model may use:

- Product as stable public identity;
- ProductVersion as immutable published data;
- optional Passport entity for publication metadata.

The exact choice belongs in the Prisma domain model.

## 15.2 Public availability

A passport is public only when:

- the Product has a current published version;
- the organization is active;
- the product is not explicitly withdrawn from public access;
- publication has completed successfully.

Draft content must never appear publicly.

## 15.3 Stable URL

The public passport URL is based on the stable Product public code.

The URL must remain stable across versions.

## 15.4 Public fields

Only fields approved for public exposure may appear.

Never expose:

- internal notes;
- private documents;
- internal database IDs;
- organization billing data;
- user identities;
- draft content;
- private audit logs;
- storage secrets.

## 15.5 Passport withdrawal

There must be a controlled way to stop ordinary public display when necessary.

Potential states:

```txt
ACTIVE
WITHDRAWN
ARCHIVED
```

A withdrawn passport URL should not become an unexplained 404 if consumers may still scan existing labels.

Recommended behavior:

- stable URL remains;
- page clearly states that the passport is withdrawn or no longer active;
- sensitive details may be hidden according to policy;
- reason may remain internal or have a safe public message.

## 15.6 No certification implication

Publishing a passport does not certify legal compliance.

The public page must not imply official approval by Passvero or the EU.

---

# 16. Publication

## 16.1 Publication meaning

Publication is the explicit transaction that makes one ProductVersion current and public.

## 16.2 Publication preconditions

Before publishing:

- required fields pass validation;
- organization is active;
- user has permission;
- product is not archived;
- version is an editable draft or review-ready version;
- public documents are available;
- public code exists;
- no conflicting publication transaction is active.

## 16.3 Publication transaction

Publication should be atomic where possible.

It should:

1. validate draft;
2. assign version number if not already assigned;
3. mark version immutable and published;
4. set publication timestamp;
5. update Product current published reference;
6. preserve previous published version;
7. create audit event;
8. make QR/public URL resolve to the new version.

Partial publication must not leave inconsistent public state.

## 16.4 Publication failure

If publication fails:

- previous published version remains current;
- draft remains available;
- user sees a safe actionable error;
- internal failure is logged;
- no half-published version is exposed.

## 16.5 Republishing

A published version cannot be republished after modification.

A correction creates a new version.

## 16.6 Unpublish

Unpublish should be a deliberate controlled action.

Potential behavior:

- Product has no current public version;
- stable public URL shows an unavailable or withdrawn state;
- historical versions remain stored;
- QR remains stable but resolves to the unavailable notice.

Unpublish permissions should be restrictive.

---

# 17. Passport readiness

## 17.1 Readiness meaning

Readiness indicates whether required data is complete enough to publish.

It does not indicate legal compliance.

## 17.2 Readiness calculation

Readiness must be based on defined rules.

Preferred display:

```txt
8 of 10 required sections complete
```

Avoid vague labels such as:

```txt
80% compliant
```

## 17.3 Category-specific rules

Different product categories may have different required fields in the future.

Initial release may use a common baseline schema.

Category-specific validation must be versioned and explicitly introduced later.

---

# 18. QR code

## 18.1 QR meaning

A QR code is a visual representation of the stable public passport URL.

It does not contain full passport data.

## 18.2 QR ownership

A QR record belongs to one Product and organization.

The Product public code is the source of the QR URL.

## 18.3 One stable QR identity

A product should normally have one stable active QR identity.

New published versions do not require a new QR code because the stable URL remains unchanged.

## 18.4 QR generation

QR images may be generated on demand rather than permanently stored.

If stored, the database should store configuration and asset references, not duplicate unnecessary data.

## 18.5 QR formats

Supported download formats may include:

```txt
PNG
SVG
PDF label later
```

## 18.6 QR safety

QR payload must not include:

- internal IDs;
- authentication tokens;
- personal data;
- private document URLs;
- mutable version-specific private URLs.

## 18.7 QR deletion

Deleting a generated QR image must not invalidate the Product public URL.

The image can always be regenerated from the stable URL.

---

# 19. ScanEvent

## 19.1 Scan event meaning

A ScanEvent represents a public passport access attributed to QR or public-link activity.

Exact attribution may be approximate.

## 19.2 Privacy minimization

Do not store raw IP addresses unless a documented requirement exists.

Preferred stored data:

- product;
- organization;
- timestamp;
- coarse country;
- device category;
- referrer category where safe;
- privacy-preserving IP hash if needed;
- user-agent-derived summary.

## 19.3 No user identity

Scan analytics must not attempt to identify individual consumers.

Avoid fingerprinting.

## 19.4 Scan retention

Retention duration should be documented.

Initial implementation may retain aggregated or minimal event data.

Future privacy policy changes must match implementation.

## 19.5 Bot filtering

Scan events may need bot or crawler filtering.

Do not promise exact “human scan” counts unless filtering exists.

Use neutral wording:

```txt
Passport views
QR and link opens
```

## 19.6 Scan deletion

Organization deletion or privacy requirements may require deletion or aggregation of scan data.

Published product history does not require permanent raw event retention.

---

# 20. AuditLog

## 20.1 Audit meaning

AuditLog records important organization actions.

Potential events:

```txt
ORGANIZATION_CREATED
MEMBER_INVITED
MEMBER_ROLE_CHANGED
PRODUCT_CREATED
PRODUCT_UPDATED
PRODUCT_ARCHIVED
DRAFT_DISCARDED
VERSION_PUBLISHED
PASSPORT_WITHDRAWN
DOCUMENT_UPLOADED
DOCUMENT_ARCHIVED
QR_DOWNLOADED
```

## 20.2 Audit ownership

Audit events belong to one organization.

## 20.3 Actor

Audit records should retain:

- actor user reference when available;
- actor display snapshot or email snapshot where safe;
- system actor for automated operations.

## 20.4 Audit immutability

Ordinary users cannot edit audit events.

Audit events should be append-only.

## 20.5 Audit visibility

Audit logs are private.

They must never appear on public passport pages.

## 20.6 Audit data minimization

Do not store secrets or full sensitive payloads in audit metadata.

Store concise relevant changes.

---

# 21. Activity feed

An application activity feed may be derived from audit events.

User-friendly activity and internal security audit are related but not always identical.

Do not expose raw internal audit metadata directly in the UI.

---

# 22. Subscription

## 22.1 Subscription meaning

Subscription represents the organization's commercial plan state.

Initial plan labels:

```txt
STARTER
PROFESSIONAL
ENTERPRISE
```

Final pricing and limits are not yet approved.

## 22.2 Subscription ownership

One active commercial subscription belongs to one organization.

Historical billing records may require separate entities.

## 22.3 Plan enforcement

Plan limits are enforced server-side.

Examples later:

- active product count;
- team member count;
- storage;
- API access;
- branding options;
- support level.

## 22.4 Grace periods

If billing fails, product passports should not disappear immediately without a defined policy.

Potential states:

```txt
TRIAL
ACTIVE
PAST_DUE
GRACE_PERIOD
CANCELED
SUSPENDED
```

Final billing rules must be defined before implementation.

## 22.5 Public passport continuity

Subscription changes must not unexpectedly break QR codes without a clear business and consumer-protection policy.

This requires explicit future decision.

---

# 23. Plan

Plan configuration may be stored:

- in code;
- in database;
- in billing provider metadata.

Do not create a complex editable Plan database model before pricing is finalized.

The Prisma domain model should keep billing architecture minimal and replaceable.

---

# 24. Product category

## 24.1 Initial scope

Initial categories may be organization-entered or use a small internal list.

## 24.2 Future category schema

Future DPP requirements may depend on category-specific templates.

A ProductTemplate or ProductCategoryRule entity may later define:

- required fields;
- optional sections;
- validation rules;
- document requirements;
- allowed identifiers.

Do not implement a regulatory rules engine in the initial schema without approved requirements.

---

# 25. Economic operator roles

A product may identify one or more economic operator roles:

```txt
MANUFACTURER
IMPORTER
DISTRIBUTOR
AUTHORIZED_REPRESENTATIVE
PRIVATE_LABEL_OWNER
OTHER
```

Initial implementation may store primary operator information on ProductVersion.

Do not assume the Passvero customer is always the manufacturer.

---

# 26. Public contact data

Public contact information may differ from internal organization contact information.

Examples:

- public support email;
- manufacturer contact;
- service contact;
- spare-parts contact.

Do not automatically expose billing or owner email publicly.

---

# 27. Archive vs soft delete vs hard delete

## 27.1 Archive

Archive means:

- hidden from ordinary active views;
- retained;
- potentially restorable;
- historical references remain valid.

Use archive for:

- published products;
- referenced documents;
- old organization assets;
- retired products.

## 27.2 Soft delete

Soft delete means marked as deleted but retained internally.

Use only when a real recovery or retention requirement exists.

Do not add `deletedAt` to every entity by habit.

## 27.3 Hard delete

Hard delete permanently removes data.

Allow only when:

- no historical or public dependency exists;
- user has permission;
- retention rules allow;
- confirmation is explicit.

## 27.4 Cascade deletion

Cascade must be conservative.

Safe possible cascades:

- deleting an unpublished draft may delete its draft-only material rows;
- deleting an unaccepted invitation may remove invitation-related records.

Unsafe cascades:

- deleting a user deletes published versions;
- deleting a product deletes published documents;
- deleting an organization immediately destroys public passport history.

Final cascade rules belong in the Prisma domain model.

---

# 28. Timestamps

Important entities should include:

```txt
createdAt
updatedAt
```

Additional timestamps as needed:

```txt
publishedAt
archivedAt
deletedAt
acceptedAt
expiresAt
lastViewedAt
withdrawnAt
```

Do not use `updatedAt` as a substitute for domain-specific timestamps.

---

# 29. Actor attribution

Important mutations should record the actor when practical:

- createdBy;
- updatedBy;
- publishedBy;
- archivedBy;
- invitedBy.

Actor references may become nullable if users are deleted.

Published history should remain understandable.

---

# 30. Concurrency

## 30.1 Draft edits

Concurrent editing may create lost updates.

Initial release should at minimum use:

- updated timestamp checks;
- optimistic concurrency token;
- clear “record changed” handling.

Do not silently overwrite newer changes.

## 30.2 Publication concurrency

Only one publication transaction per product may succeed at a time.

Version numbering and current published reference updates must be transactional.

## 30.3 Invitation concurrency

Invitation acceptance must be idempotent and single-use.

---

# 31. Idempotency

Operations that may be retried should be idempotent where practical.

Examples:

- accepting invitation;
- publication request;
- billing webhook;
- document upload finalization;
- scan event ingestion if external queues are used.

Do not create duplicate published versions from a retried request.

---

# 32. Validation hierarchy

Validation occurs at multiple layers.

## Client-side

For immediate user feedback only.

## Server-side

Authoritative validation.

## Database

Constraints for invariants such as:

- uniqueness;
- required relationships;
- valid foreign keys;
- one active membership relationship;
- version uniqueness.

Client validation never replaces server validation.

---

# 33. Public identifiers

Use separate public identifiers for entities exposed publicly.

Examples:

- product passport code;
- public document token only if needed;
- invitation token;
- organization public slug.

Never expose sequential IDs in public routes when avoidable.

Public identifiers are not authorization.

---

# 34. Slugs

Slugs are human-readable routing aids.

If used:

- normalize;
- ensure appropriate uniqueness;
- preserve stable redirects when changed;
- do not use slug as sole identity;
- keep public code stable.

Initial public passport URL may use only the stable code to avoid slug-change complexity.

---

# 35. Compliance-related language

Passvero provides tooling for structured product information and DPP workflows.

The system must not automatically claim:

```txt
Compliant
Certified
Approved
Verified by the EU
Legally complete
```

unless a defined review or certification process exists.

Allowed operational labels:

```txt
Ready for review
Published
Required fields complete
Data incomplete
Update required
```

---

# 36. Data accuracy responsibility

Organizations are responsible for:

- accuracy of product information;
- rights to uploaded documents;
- legality of public claims;
- correct public contact information;
- applicable product-category requirements;
- keeping data current.

Passvero may validate format and required fields but does not guarantee substantive legal accuracy.

---

# 37. Public passport trust signals

Allowed trust signals:

- publication date;
- last updated date;
- organization name;
- version number;
- document links;
- structured origin and material information.

Do not display an undefined “verified” badge.

If verification is introduced later, it requires a documented verification process and state model.

---

# 38. Data export

Organizations should later be able to export their data.

Export should include:

- products;
- versions;
- materials;
- document metadata;
- public links;
- team data where appropriate.

Raw provider secrets and internal audit metadata should not be included.

Export implementation is future scope, but schema design should avoid making export impractical.

---

# 39. Data import

CSV import is future scope.

Imported records must follow the same validation and ownership rules as manually entered records.

Import must not bypass:

- unique constraints;
- required fields;
- organization ownership;
- publication workflow.

Imported products begin as drafts unless explicitly approved otherwise.

---

# 40. External integrations

Future integrations may include:

- WooCommerce;
- Shopify;
- ERP systems;
- GS1 services;
- public APIs.

External source identifiers should be stored in a separate integration mapping model rather than overloading core Product IDs.

Do not add integration-specific columns to Product prematurely.

---

# 41. Webhooks

Future webhooks must include:

- organization ownership;
- signed delivery;
- retries;
- idempotency;
- delivery log;
- secret rotation.

Webhook architecture is future scope.

---

# 42. Notifications

Potential notifications:

- invitation received;
- product ready for review;
- passport published;
- document upload failed;
- subscription issue;
- update required.

Notification records must not become authorization sources.

Do not implement notification tables before approved need.

---

# 43. System-generated records

Automated actions must use a clear system actor.

Examples:

```txt
SYSTEM
BILLING_PROVIDER
IMPORT_PROCESS
```

Do not attribute automated actions to an arbitrary user.

---

# 44. Background jobs

Operations suitable for background processing:

- large file processing;
- image transformation;
- QR/PDF batch generation;
- scan aggregation;
- email delivery;
- exports;
- imports.

Job state should be explicit if implemented:

```txt
PENDING
PROCESSING
SUCCEEDED
FAILED
```

Do not block publication on non-critical analytics processing.

---

# 45. Product templates

Future templates may speed up creation by industry.

A template may define:

- default sections;
- recommended documents;
- optional fields;
- help text.

Templates do not certify compliance.

Do not copy template identity into published public claims.

---

# 46. Review workflow

Initial release may support:

```txt
Draft
Ready for review
Published
```

A dedicated reviewer role is not required initially.

Ready-for-review state indicates internal workflow only.

It does not imply Passvero review.

---

# 47. Notes

Internal notes may be useful later.

Internal notes:

- belong to organization;
- are never public;
- may be version-independent;
- must not leak through APIs or public serializers.

Do not mix internal notes with public descriptions.

---

# 48. Public serialization

Public passport responses must use an explicit allowlist.

Do not serialize entire Prisma records.

Public mapper should include only intended fields.

This protects against future schema additions leaking automatically.

---

# 49. Private API responses

Private dashboard APIs should still select only required fields.

Do not return:

- storage secrets;
- auth provider IDs;
- billing secrets;
- internal tokens;
- unnecessary audit metadata.

---

# 50. Domain services

Business logic should live in server-side services.

Recommended services later:

```txt
organization-service
membership-service
invitation-service
product-service
product-version-service
publication-service
document-service
passport-service
qr-service
scan-service
audit-service
subscription-service
```

Repositories provide persistence.

Services enforce domain rules.

React components and route handlers should not own domain logic.

---

# 51. Transactions

Use database transactions for multi-step invariants.

Required examples:

- publish version;
- accept invitation and create membership;
- transfer ownership;
- archive product and update state;
- finalize upload metadata;
- update subscription from webhook;
- assign next version number.

Do not keep transactions open during slow external network calls when avoidable.

---

# 52. Eventual consistency

Some secondary operations may be eventually consistent:

- analytics aggregation;
- notification delivery;
- image derivatives;
- search indexing;
- QR asset caching.

Primary publication state must be immediately consistent.

---

# 53. Search

Initial product search may use database text matching.

Search index is organization-scoped.

Public search across all organizations is out of scope.

Search must not reveal the existence of other organizations' records.

---

# 54. Analytics aggregation

Raw scan events and aggregated metrics may be separate.

Aggregates may include:

```txt
daily product views
country counts
device counts
```

Aggregates must remain organization-scoped.

Recomputing aggregates should be possible from retained raw or intermediate data, according to retention policy.

---

# 55. Time zones

Store timestamps in UTC.

Display using user or organization timezone when available.

Publication timestamp should be stored as an absolute instant.

Do not store localized date strings in domain tables.

---

# 56. Countries and locale codes

Use standardized codes where possible:

- ISO country codes;
- BCP 47 or approved app locale codes.

Do not store translated country names as the canonical database value.

---

# 57. URLs

Validate URLs server-side.

Store normalized URLs where appropriate.

Public display must escape and safely render external URLs.

External links should use secure attributes when opened in a new tab.

---

# 58. Email addresses

Normalize and validate email addresses.

Separate:

- user login email;
- organization internal contact;
- public support email;
- service/spare-parts contact;
- billing email.

Do not assume one email serves all purposes.

---

# 59. Legal entity data

Legal names, tax identifiers and addresses may be stored privately.

Public exposure requires explicit organization choice or product requirement.

Do not automatically publish VAT or legal identifiers.

---

# 60. Product ownership transfer

Transferring a product between organizations is not supported initially.

Future transfer requires:

- explicit consent;
- audit history;
- public issuer history;
- document ownership migration;
- QR continuity policy.

Do not implement by changing `organizationId` directly.

---

# 61. Organization merge

Organization merge is out of scope.

Do not design schema assumptions that make accidental merge possible through ordinary UI.

---

# 62. Restore behavior

Potential restore actions:

- restore archived product;
- restore archived document;
- restore historical version as new draft.

Restoring a version creates a new draft.

It does not make the old version editable.

---

# 63. Duplicate handling

The system may warn about possible duplicates based on:

- SKU;
- GTIN;
- product name;
- model number.

Warnings must not block legitimate duplicates unless a true uniqueness invariant exists.

---

# 64. Publication language coverage

A product may be published with only selected languages.

Public language selector should show only available published translations.

Fallback behavior must be explicit.

Do not silently show source-language content under another locale label.

Potential fallback:

- show source language;
- indicate translation unavailable;
- preserve page navigation.

Final UX belongs in the public passport specification.

---

# 65. Public passport locale routes

Public passport URLs may support:

```txt
/p/[passportCode]
/en/p/[passportCode]
/de/p/[passportCode]
```

The stable passport code remains unchanged.

Default locale follows Passvero routing.

Public metadata must reflect available translations.

---

# 66. Document locale coverage

A document may have locale applicability.

Example:

```txt
Manual — German
Manual — Polish
Safety sheet — All languages
```

Do not present a German document as Croatian solely because the page locale is Croatian.

---

# 67. Version publication languages

Publication should snapshot:

- which locales are public;
- translated content for each;
- locale-specific document associations.

Adding a language after publication creates a new ProductVersion.

---

# 68. Audit of public changes

Publication audit should capture:

- product;
- version;
- actor;
- timestamp;
- prior current version;
- new current version.

Do not store entire document bodies in audit logs.

---

# 69. Data retention

Retention policies must be documented before destructive automation.

Published history, raw scan events, invitation logs and billing records may have different retention periods.

Do not implement blanket cleanup jobs without explicit policy.

---

# 70. Backups

Database and document storage backups are infrastructure responsibilities.

Domain design must maintain referential integrity so backups can restore consistent state.

---

# 71. Seed data

Development seed data must be clearly fictional.

Do not ship fake customers or public claims to production.

Seed organizations and products must never appear in production sitemap or public routes.

---

# 72. Test invariants

Tests must cover at least:

- organization isolation;
- last owner protection;
- published version immutability;
- one active draft per product;
- one current published version per product;
- public allowlist serialization;
- stable public code;
- publication transaction;
- document deletion protection;
- invitation single use;
- permission enforcement.

---

# 73. Domain errors

Recommended domain error categories:

```txt
VALIDATION_ERROR
NOT_FOUND
FORBIDDEN
CONFLICT
INVALID_STATE_TRANSITION
LIMIT_EXCEEDED
EXTERNAL_SERVICE_ERROR
```

Do not expose raw database errors to the UI.

---

# 74. Domain decision log

When implementation requires changing a rule in this document:

1. do not silently deviate;
2. update `codex/DECISIONS.md`;
3. update this document;
4. explain migration impact;
5. update tests.

---

# 75. Initial MVP domain boundary

The initial MVP includes:

- users;
- organizations;
- memberships;
- invitations;
- products;
- one active draft per product;
- immutable published versions;
- materials;
- documents and version associations;
- stable public passport;
- QR generation;
- privacy-aware scan events;
- audit events;
- basic plan state later.

The initial MVP excludes:

- item-level serial passports;
- batch-level passports;
- cross-organization sharing;
- regulatory rules engine;
- external integrations;
- advanced approval chains;
- official certification;
- blockchain;
- native mobile apps;
- complex billing entitlements.

---

# 76. Final invariant summary

The following rules are non-negotiable unless explicitly changed by an architectural decision:

1. Every private record is organization-scoped.
2. Client-supplied organization IDs are never trusted.
3. A published ProductVersion is immutable.
4. Editing a published product creates a new draft.
5. A Product has at most one active draft.
6. A Product has at most one current published version.
7. Public passport URL remains stable across versions.
8. QR code points to the stable public URL.
9. Published history is not overwritten.
10. Public responses use an explicit allowlist.
11. Private documents never appear publicly.
12. Published document references are not silently broken.
13. A published product is archived, not ordinarily hard-deleted.
14. The last organization owner cannot be removed or demoted.
15. Publication is explicit and transactional.
16. Failed publication leaves the previous public version intact.
17. Readiness does not mean legal compliance.
18. Passvero does not provide official certification by default.
19. Scan analytics minimizes personal data.
20. Important domain changes create audit events.
21. All authorization is enforced server-side.
22. Historical records survive user removal where necessary.
23. Product content localization is versioned.
24. Public codes do not expose internal database IDs.
25. Future integrations must not distort the core domain model.

---

# 77. Codex implementation reporting

For domain implementation tasks, Codex must report:

1. rules implemented;
2. database constraints added;
3. service-layer checks added;
4. transactions used;
5. organization-isolation checks;
6. deletion behavior;
7. publication behavior;
8. tests added;
9. migration implications;
10. deviations from this document.

Do not claim domain correctness without tests for the relevant invariants.
