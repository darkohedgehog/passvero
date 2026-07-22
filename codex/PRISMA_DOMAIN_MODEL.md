# Passvero Prisma Domain Model

## Purpose and authority

This document describes the implemented Passvero PostgreSQL domain model. The
committed `prisma/schema.prisma` and applied migrations are authoritative for
physical structure. `codex/DECISIONS.md` and
`codex/ARCHITECTURE_DECISIONS_FROM_AUDIT.md` define approved architecture and
service invariants.

The database currently contains exactly 21 models implemented through 16
applied migrations. No model in this document is merely planned.

## Implemented inventory

Identity:

- User
- Organization
- Membership
- Invitation

Product core:

- Product
- ProductVersion
- Passport

Version content:

- ProductTranslation
- ProductIdentifier
- ProductMaterial

Documents and media:

- Document
- ProductDocument
- ProductImage

Public access and analytics:

- QRCode
- ScanEvent

Infrastructure:

- AuditLog

Billing:

- Plan
- Subscription

Platform services:

- Notification
- IntegrationMapping
- BackgroundJob

## Implemented enums

- `OrganizationStatus`: ACTIVE, SUSPENDED, DEACTIVATED, PENDING_DELETION
- `MembershipRole`: OWNER, ADMIN, EDITOR, VIEWER
- `MembershipStatus`: ACTIVE, SUSPENDED, REMOVED
- `InvitationStatus`: PENDING, ACCEPTED, EXPIRED, REVOKED
- `ProductLifecycleStatus`: ACTIVE, ARCHIVED
- `ProductVersionStatus`: DRAFT, READY_FOR_REVIEW, PUBLISHED, SUPERSEDED,
  DISCARDED
- `ProductIdentifierType`: GTIN, EAN, UPC, MPN, SKU, CUSTOM
- `DocumentStatus`: PENDING_UPLOAD, AVAILABLE, FAILED, ARCHIVED
- `PassportStatus`: ACTIVE, WITHDRAWN, ARCHIVED
- `QRCodeStatus`: PENDING, ACTIVE, REVOKED
- `ScanDeviceType`: UNKNOWN, DESKTOP, MOBILE, TABLET, BOT
- `ScanReferrerType`: DIRECT, SEARCH, SOCIAL, EMAIL, MESSAGING, OTHER, UNKNOWN
- `PlanStatus`: DRAFT, ACTIVE, ARCHIVED
- `SubscriptionStatus`: TRIAL, ACTIVE, PAST_DUE, CANCELED, EXPIRED
- `BillingProvider`: STRIPE, MANUAL
- `NotificationType`: INFO, SUCCESS, WARNING, ERROR, ACTION_REQUIRED
- `NotificationStatus`: UNREAD, READ, DISMISSED, ARCHIVED
- `IntegrationMappingStatus`: ACTIVE, DISABLED, ERROR, ARCHIVED
- `BackgroundJobScope`: PLATFORM, ORGANIZATION
- `BackgroundJobStatus`: QUEUED, RUNNING, SUCCEEDED, FAILED, CANCELED

## Ownership and aggregate boundaries

Organization is the tenant boundary. Direct organization ownership is stored
on Membership, Invitation, Product, ProductVersion, Passport, Document,
AuditLog, Subscription, Notification, IntegrationMapping, and
ORGANIZATION-scoped BackgroundJob rows. PLATFORM BackgroundJob rows have no
Organization.

Ownership is inherited for ProductTranslation, ProductIdentifier,
ProductMaterial, ProductDocument, and ProductImage through ProductVersion.
QRCode inherits ownership through Passport. ScanEvent inherits ownership
through QRCode. Plan and User are platform-global.

Product is stable business identity. ProductVersion is the aggregate root for
all versioned product content. Document is an independent reusable
organization-owned asset; ProductDocument is the version-specific association.
Passport owns public publication state. QRCode is the public access point to a
Passport, and ScanEvent belongs only to QRCode.

## Identity models

### User

Fields: `id`, `email`, `displayName`, `avatarUrl`, `preferredLocale`,
`timezone`, `createdAt`, `updatedAt`.

`email` is unique. Application services must persist and compare its canonical
normalized form. User has inverse relations for memberships, invitation actor
roles, Product and ProductVersion actors, Document actors, Passport withdrawal,
AuditLog actor records, and optional Notification targeting.

### Organization

Fields: `id`, `displayName`, `legalName`, `slug`, `logoUrl`, `websiteUrl`,
`countryCode`, `vatNumber`, `publicEmail`, `billingEmail`, `timezone`,
`defaultLocale`, `status`, `createdAt`, `updatedAt`, `archivedAt`.

`slug` is optional and unique. Indexes cover `status` and `createdAt`.
Organization exposes inverse relations named by the implemented schema,
including `OrganizationMemberships`, `OrganizationInvitations`,
`OrganizationProducts`, `OrganizationProductVersions`,
`OrganizationDocuments`, `OrganizationPassports`, `OrganizationAuditLogs`,
`OrganizationSubscription`, `OrganizationNotifications`,
`OrganizationIntegrationMappings`, and `OrganizationBackgroundJobs`.

### Membership

Fields: `id`, `organizationId`, `userId`, `role`, `status`, `invitedById`,
`joinedAt`, `createdAt`, `updatedAt`.

Membership is unique by `(organizationId, userId)`. Organization and User
deletion are restricted; deletion of the optional inviter sets `invitedById`
to null. Updates cascade. Indexes cover `userId`, `invitedById`, and
`(organizationId, status)`.

The last-active-owner rule and transition validity are mandatory application
service invariants.

### Invitation

Fields: `id`, `organizationId`, `email`, `role`, `status`, `tokenHash`,
`expiresAt`, `invitedById`, `acceptedAt`, `acceptedById`, `createdAt`,
`updatedAt`.

`tokenHash` is unique; raw invitation tokens are never stored. A manual partial
unique index, `ux_invitation_one_pending_per_organization_email`, permits only
one PENDING invitation per Organization and lowercased email. Services must
also trim and normalize email consistently. Organization deletion is
restricted; optional User actor deletion sets the actor foreign key to null.

## Product core

### Product

Fields: `id`, `organizationId`, `internalName`, `sku`, `normalizedSku`,
`publicCode`, `lifecycleStatus`, `currentDraftVersionId`,
`currentPublishedVersionId`, `createdById`, `updatedById`, `archivedById`,
`createdAt`, `updatedAt`, `archivedAt`, `lastPublishedAt`.

`publicCode` is globally unique. `(organizationId, normalizedSku)` is unique;
PostgreSQL permits multiple null normalized SKU values. Both current-version
pointers are optional and individually unique. Organization and general
ProductVersion ownership relations use Restrict/Cascade. Current pointers use
SetNull/Cascade. User actor relations use SetNull/Cascade.

### ProductVersion

Fields: `id`, `productId`, `organizationId`, `status`, `sourceLocale`,
`versionNumber`, `versionLabel`, `changeSummary`, `clonedFromVersionId`,
`createdById`, `updatedById`, `publishedById`, `createdAt`, `updatedAt`,
`reviewReadyAt`, `publishedAt`, `supersededAt`, `discardedAt`.

`(productId, versionNumber)` is unique. The manual partial unique index
`ux_product_version_one_active_draft` permits at most one DRAFT or
READY_FOR_REVIEW row per Product. Product and Organization deletion are
restricted. The optional clone source and User actors use SetNull; updates
cascade.

ProductVersion owns ProductTranslation, ProductIdentifier, ProductMaterial,
ProductDocument, and ProductImage. These child relations cascade on parent
deletion and update. Services must forbid ordinary deletion or mutation of
PUBLISHED and SUPERSEDED aggregates.

### Passport

Fields: `id`, `productId`, `organizationId`, `status`, `defaultLocale`,
`firstPublishedAt`, `lastPublishedAt`, `withdrawnAt`, `withdrawnById`,
`withdrawalReasonCode`, `publicWithdrawalMessage`, `archivedAt`, `createdAt`,
`updatedAt`.

`productId` is unique, implementing one Passport per Product. Product and
Organization deletion are restricted. User deletion sets `withdrawnById` to
null. Updates cascade. Passport has one optional QRCode through
`PassportQRCode`.

## Version content

### ProductTranslation

Fields: `id`, `productVersionId`, `locale`, `productName`,
`shortDescription`, `description`, `technicalDescription`,
`repairInstructions`, `sparePartsInformation`, `recyclingInstructions`,
`disposalInstructions`, `packagingInformation`, `safetyInformation`,
`warrantyInformation`, `publicNotes`, `createdAt`, `updatedAt`.

`(productVersionId, locale)` is unique. The ProductVersion relation is
`ProductVersionTranslations` with Cascade/Cascade.

### ProductIdentifier

Fields: `id`, `productVersionId`, `type`, `value`, `issuingAuthority`, `notes`,
`createdAt`, `updatedAt`.

`(productVersionId, type, value)` is unique. Identifier normalization is
type-specific and mandatory in services; identifiers are not globally unique.
The parent relation is `ProductVersionIdentifiers` with Cascade/Cascade.

### ProductMaterial

Fields: `id`, `productVersionId`, `materialName`, `category`, `percentage`,
`isRecycled`, `recycledPercentage`, `supplier`, `notes`, `createdAt`,
`updatedAt`.

Percentages are `Decimal(5,2)`. Manual CHECK constraints keep both percentages
between 0 and 100 and forbid `recycledPercentage` when `isRecycled` is false.
Cross-row totals remain a service invariant. The parent relation is
`ProductVersionMaterials` with Cascade/Cascade.

## Documents and media

### Document

Fields: `id`, `organizationId`, `originalFilename`, `displayName`,
`fileExtension`, `storageProvider`, `storageBucket`, `storageKey`, `mimeType`,
`sizeBytes`, `checksumSha256`, `status`, `uploadedAt`, `failedAt`,
`failureCode`, `archivedAt`, `createdById`, `updatedById`, `archivedById`,
`createdAt`, `updatedAt`.

Storage identity `(storageProvider, storageBucket, storageKey)` is unique.
CHECK constraints enforce lowercase SHA-256 format, positive size, and required
lifecycle timestamps for AVAILABLE, FAILED, and ARCHIVED. Organization deletion
is restricted; User actor deletion sets actor keys to null.

### ProductDocument

Fields: `id`, `productVersionId`, `documentId`, `category`, `locale`,
`displayLabel`, `description`, `isPublic`, `isPrimary`, `sortOrder`, `createdAt`,
`updatedAt`.

`sortOrder` must be non-negative. ProductVersion deletion cascades to the
association; Document deletion is restricted. There is intentionally no unique
constraint on `(productVersionId, documentId)` and no database-enforced single
primary row. Contextual multiplicity and primary selection are mandatory
service invariants. Services must also prove that Document and ProductVersion
belong to the same Organization before association.

### ProductImage

Fields: `id`, `productVersionId`, `originalFilename`, `fileExtension`,
`storageProvider`, `storageBucket`, `storageKey`, `mimeType`, `sizeBytes`,
`checksumSha256`, `width`, `height`, `altText`, `caption`, `isPublic`,
`isPrimary`, `sortOrder`, `uploadedAt`, `createdAt`, `updatedAt`.

Storage identity is unique. CHECK constraints enforce lowercase SHA-256,
positive size and dimensions, non-negative sort order, and the MIME allowlist
`image/jpeg`, `image/png`, `image/webp`, `image/avif`. Primary-image selection
is a mandatory service invariant. The ProductVersion relation is
`ProductVersionImages` with Cascade/Cascade.

## Public access, analytics, and audit

### QRCode

Fields: `id`, `passportId`, `code`, `targetUrl`, `status`, `generatedAt`,
`activatedAt`, `revokedAt`, `createdAt`, `updatedAt`.

`passportId`, `code`, and `targetUrl` are individually unique. Code format,
HTTPS target URLs, and lifecycle timestamp consistency are enforced by CHECK
constraints. Passport deletion cascades to QRCode; QRCode deletion cascades to
ScanEvent. Both updates cascade. One QRCode per Passport is the implemented MVP
cardinality.

### ScanEvent

Fields: `id`, `qrCodeId`, `scannedAt`, `deviceType`, `referrerType`, `isBot`,
`countryCode`, `region`, `browser`, `operatingSystem`, `language`,
`referrerHost`, `createdAt`.

ScanEvent is append-only in normal application workflows and intentionally has
no `updatedAt`. It contains no raw IP, User relation, Product relation,
Passport relation, or direct `organizationId`. CHECK constraints enforce
country, language, host, bot/device, and timestamp consistency. Six indexes
support QR/time and approved analytics dimensions.

### AuditLog

Fields: `id`, `organizationId`, `actorId`, `action`, `entityType`, `entityId`,
`summary`, `metadata`, `correlationId`, `occurredAt`, `createdAt`.

AuditLog is organization-owned, optionally attributed to a User, and
append-only in normal application workflows. It intentionally has no
`updatedAt`. `action` and `entityType` are normalized uppercase Strings rather
than enums; `entityId` is a logical reference. CHECK constraints enforce
formats, bounded summaries, correlation IDs, and timestamp order. AuditLog is
not Product history, Notification, or BackgroundJob.

## Billing

### Plan

Fields: `id`, `name`, `slug`, `description`, `status`, `currencyCode`,
`monthlyPrice`, `yearlyPrice`, `maxProducts`, `maxActivePassports`,
`maxMembers`, `maxStorageBytes`, `maxMonthlyScans`, `features`, `isPublic`,
`sortOrder`, `archivedAt`, `createdAt`, `updatedAt`.

Plan is platform-global. `slug` is unique. Prices are `Decimal(12,2)` and
non-negative. Nullable limits mean unlimited or unenforced and must be positive
when present. `features` is a required JSON object with no default. CHECK
constraints also enforce name, slug, currency, description, sort order, and
archive lifecycle rules.

### Subscription

Fields: `id`, `organizationId`, `planId`, `status`, `billingProvider`,
`currentPeriodStart`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `canceledAt`,
`externalCustomerId`, `externalSubscriptionId`,
`providerConfigurationKey`, `createdAt`, `updatedAt`.

`organizationId` is unique, implementing at most one current Subscription per
Organization. Organization and Plan deletion are restricted; updates cascade.
CHECK constraints enforce period ordering, terminal cancellation consistency,
and absence of provider identifiers for MANUAL subscriptions.

Subscription is current commercial state, not a billing ledger. Invoices,
payments, provider history, idempotency, and historical commercial evidence
remain future separately reviewed infrastructure.

## Platform services

### Notification

Fields: `id`, `organizationId`, `userId`, `type`, `status`, `eventType`, `title`,
`message`, `actionUrl`, `entityType`, `entityId`, `metadata`, `readAt`,
`dismissedAt`, `archivedAt`, `expiresAt`, `createdAt`, `updatedAt`.

Notification is an organization-owned application message with an optional
User target. Relations are `OrganizationNotifications` (Restrict/Cascade) and
`UserNotifications` (SetNull/Cascade). It has no direct domain relation and is
not an email, push, SMS, webhook, delivery, retry, or provider record.

Nine CHECK constraints enforce event type, title, message, action URL, logical
entity pair and formats, status timestamps, and timestamp order. Metadata is
small allowlisted presentation context. Target-User organization eligibility
and safe URL consumption are mandatory service invariants.

### IntegrationMapping

Fields: `id`, `organizationId`, `provider`, `externalAccountId`,
`externalResourceType`, `externalResourceId`, `entityType`, `entityId`,
`status`, `lastSyncedAt`, `lastErrorAt`, `lastErrorCode`, `metadata`,
`archivedAt`, `createdAt`, `updatedAt`.

IntegrationMapping is retained organization-owned external identity mapping.
Its only relation is `OrganizationIntegrationMappings` with Restrict/Cascade.
Provider and entity references are normalized Strings, not enums or domain
foreign keys. It stores no credentials, OAuth tokens, provider configuration,
jobs, webhook data, or complete payloads.

Two Prisma composite unique constraints cover non-null external account
contexts. Partial unique indexes
`ux_integration_mapping_external_resource_without_account` and
`ux_integration_mapping_internal_entity_without_account` preserve equivalent
uniqueness when `externalAccountId` is null. Uniqueness intentionally remains
across ARCHIVED mappings; the stable mapping identity may be reactivated or
explicitly removed through reviewed services.

### BackgroundJob

Fields: `id`, `scope`, `organizationId`, `queue`, `jobType`, `status`,
`priority`, `attemptCount`, `maxAttempts`, `scheduledAt`, `payload`, `result`,
`entityType`, `entityId`, `deduplicationKey`, `correlationId`, `lockedAt`,
`lockOwner`, `startedAt`, `completedAt`, `failedAt`, `canceledAt`,
`lastErrorCode`, `lastErrorSummary`, `createdAt`, `updatedAt`.

The optional relation `OrganizationBackgroundJobs` uses Restrict/Cascade.
PLATFORM scope requires a null Organization; ORGANIZATION scope requires one.
Queue, job type, and logical entity references are normalized Strings rather
than enums or domain foreign keys.

CHECK constraints enforce scope ownership, formats, paired entity fields,
non-negative priority, attempts, lock pairing, status lifecycle, sanitized
error information, and timestamp order. Partial unique indexes
`ux_background_job_platform_deduplication` and
`ux_background_job_organization_deduplication` prevent equivalent active
QUEUED/RUNNING jobs while permitting terminal history.

BackgroundJob is persistence for requested asynchronous work. It is not a
queue provider, worker, scheduler, cron facility, retry service, AuditLog,
Notification delivery, IntegrationMapping, or credential store.

## Approved service invariants

The following are mandatory architecture, not missing schema defects:

1. ProductVersion and Passport organization ownership must equal their Product
   ownership.
2. Product current pointers must reference versions of the same Product and
   the correct lifecycle class.
3. ProductDocument may connect only a ProductVersion and Document belonging to
   the same Organization; public delivery must independently authorize the
   published association.
4. Lifecycle services must enforce valid transitions and any chronology not
   fully represented by PostgreSQL CHECK constraints.
5. ProductImage primary selection and ProductDocument primary/contextual
   multiplicity are transactionally service-controlled.
6. Notification User targeting and navigation safety are service-controlled.
7. BackgroundJob writers normalize logical references, deduplication keys,
   lock owners, and chronology.
8. Published ProductVersion aggregates are immutable through guarded services,
   repositories, tests, and runtime permissions.
9. AuditLog and ScanEvent are append-only through guarded repositories and
   runtime permissions.
10. Email, identifier, locale, country, and similar canonical values are
    normalized by every approved writer according to field-specific rules.

Imports, administration tools, background processes, and maintenance scripts
must not bypass these invariants.

## Partial unique indexes

The four implemented partial-index groups are:

- pending Invitation uniqueness by Organization and lowercased email;
- one active ProductVersion draft-like row per Product;
- two IntegrationMapping indexes for null external-account contexts;
- two BackgroundJob active-deduplication indexes separated by PLATFORM and
  ORGANIZATION scope.

Their predicates intentionally permit terminal or historical rows where the
domain requires history.

## Implemented uniqueness and index catalog

The following catalog mirrors the committed schema and manual migration
indexes. Primary-key indexes are implicit and omitted here.

- User: unique `email`.
- Organization: unique `slug`; indexes `status`, `createdAt`.
- Membership: unique `(organizationId, userId)`; indexes `userId`,
  `invitedById`, `(organizationId, status)`.
- Invitation: unique `tokenHash`; indexes `email`, `expiresAt`,
  `(organizationId, status)`, `invitedById`, `acceptedById`; partial unique
  pending Organization/lower-email index.
- Product: unique `publicCode`, `currentDraftVersionId`,
  `currentPublishedVersionId`, `(organizationId, normalizedSku)`; indexes
  `(organizationId, lifecycleStatus)`, `(organizationId, updatedAt)`,
  `createdById`, `updatedById`, `archivedById`.
- ProductVersion: unique `(productId, versionNumber)`; indexes
  `(productId, status)`, `(organizationId, status)`,
  `(organizationId, updatedAt)`, `publishedAt`, `clonedFromVersionId`,
  `createdById`, `updatedById`, `publishedById`; partial unique active-draft
  index.
- ProductTranslation: unique `(productVersionId, locale)`; index
  `productVersionId`.
- ProductIdentifier: unique `(productVersionId, type, value)`; index
  `productVersionId`.
- ProductMaterial: index `productVersionId`.
- Document: unique `(storageProvider, storageBucket, storageKey)`; indexes
  `(organizationId, status)`, `(organizationId, createdAt)`,
  `(organizationId, updatedAt)`, `checksumSha256`, `createdById`, `updatedById`,
  `archivedById`.
- ProductDocument: indexes `productVersionId`, `documentId`,
  `(productVersionId, category)`, `(productVersionId, locale)`,
  `(productVersionId, isPublic, sortOrder)`.
- ProductImage: unique `(storageProvider, storageBucket, storageKey)`; indexes
  `productVersionId`, `(productVersionId, isPublic, sortOrder)`,
  `(productVersionId, isPrimary)`, `checksumSha256`.
- Passport: unique `productId`; indexes `(organizationId, status)`,
  `firstPublishedAt`, `lastPublishedAt`, `withdrawnById`.
- QRCode: unique `passportId`, `code`, `targetUrl`; indexes `status`,
  `generatedAt`, `activatedAt`, `revokedAt`.
- ScanEvent: indexes `(qrCodeId, scannedAt)`, `scannedAt`,
  `(qrCodeId, isBot, scannedAt)`, `(qrCodeId, countryCode, scannedAt)`,
  `(qrCodeId, deviceType, scannedAt)`, `(qrCodeId, referrerType, scannedAt)`.
- AuditLog: indexes `(organizationId, occurredAt)`,
  `(organizationId, entityType, entityId, occurredAt)`,
  `(organizationId, action, occurredAt)`, `(actorId, occurredAt)`,
  `correlationId`, `occurredAt`.
- Plan: unique `slug`; indexes `(status, sortOrder)`,
  `(isPublic, status, sortOrder)`, `createdAt`, `archivedAt`.
- Subscription: unique `organizationId`; indexes `status`, `(planId, status)`,
  `billingProvider`, `currentPeriodEnd`.
- Notification: indexes `(organizationId, status, createdAt)`,
  `(userId, status, createdAt)`, `(organizationId, eventType, createdAt)`,
  `(organizationId, entityType, entityId, createdAt)`, `expiresAt`, `createdAt`.
- IntegrationMapping: composite unique external-resource and internal-entity
  keys; indexes `(organizationId, provider, status)`,
  `(organizationId, entityType, entityId)`,
  `(organizationId, provider, externalResourceType)`, `lastSyncedAt`,
  `lastErrorAt`, `archivedAt`; two null-account partial unique indexes.
- BackgroundJob: indexes `(status, scheduledAt)`,
  `(queue, status, scheduledAt)`, `(organizationId, status)`,
  `(entityType, entityId)`, `lockedAt`, `createdAt`; two active partial unique
  deduplication indexes.

There is no unique constraint beyond those listed, no primary-media partial
index, and no JSON GIN index.

## Delete strategy

Restrict protects tenant roots, stable product history, reusable Documents,
billing state, and retained platform-service records. SetNull preserves rows
when optional User actors or clone provenance disappear. Cascade is limited to
aggregate children: ProductVersion content, Passport-to-QRCode, and
QRCode-to-ScanEvent.

Database cascade configuration does not authorize a destructive workflow.
Services must prohibit ordinary deletion of published aggregates and must use
explicit authorization, impact preview, audit, and retention checks for any
future destructive operation.

## JSON boundary

JSON is implemented only for `AuditLog.metadata`, `Plan.features`,
`Notification.metadata`, `IntegrationMapping.metadata`,
`BackgroundJob.payload`, and `BackgroundJob.result`. These fields may contain
only small allowlisted data appropriate to their model. Secrets, credentials,
tokens, request headers, cookies, raw provider payloads, file contents, binary
data, and stack traces are prohibited. No JSON GIN index is implemented.

## Architecture status

Structural implementation and Structural Integrity Review are complete. No
reviewed finding requires a mandatory schema change before Database
Architecture Freeze v1.0. Service invariants remain mandatory production
obligations. Database Production Audit and final Architecture Freeze approval
remain pending.
