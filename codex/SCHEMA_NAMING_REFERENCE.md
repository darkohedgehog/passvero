# Passvero Schema Naming Reference

## Authority

This document records canonical names implemented in `prisma/schema.prisma`.
The committed schema and applied migrations take precedence over older naming
examples. Model names are singular PascalCase, fields are camelCase, foreign
keys end in `Id`, enums are PascalCase, and enum values are UPPER_SNAKE_CASE.

## Implemented model names

Exactly 21 models are implemented:

```txt
User
Organization
Membership
Invitation
Product
ProductVersion
Passport
ProductTranslation
ProductIdentifier
ProductMaterial
Document
ProductDocument
ProductImage
QRCode
ScanEvent
AuditLog
Plan
Subscription
Notification
IntegrationMapping
BackgroundJob
```

Do not replace these with AccountHolder, Company, Tenant, Workspace,
TeamMember, Invite, Item, Revision, Material, Attachment, ProductFile,
DigitalPassport, QrCode, ViewEvent, ActivityLog, PricingPlan, BillingAccount,
Alert, Message, ExternalMapping, SyncMapping, QueueJob, or Task.

## Implemented enum names and values

```txt
OrganizationStatus
  ACTIVE SUSPENDED DEACTIVATED PENDING_DELETION

MembershipRole
  OWNER ADMIN EDITOR VIEWER

MembershipStatus
  ACTIVE SUSPENDED REMOVED

InvitationStatus
  PENDING ACCEPTED EXPIRED REVOKED

ProductLifecycleStatus
  ACTIVE ARCHIVED

ProductVersionStatus
  DRAFT READY_FOR_REVIEW PUBLISHED SUPERSEDED DISCARDED

ProductIdentifierType
  GTIN EAN UPC MPN SKU CUSTOM

DocumentStatus
  PENDING_UPLOAD AVAILABLE FAILED ARCHIVED

PassportStatus
  ACTIVE WITHDRAWN ARCHIVED

QRCodeStatus
  PENDING ACTIVE REVOKED

ScanDeviceType
  UNKNOWN DESKTOP MOBILE TABLET BOT

ScanReferrerType
  DIRECT SEARCH SOCIAL EMAIL MESSAGING OTHER UNKNOWN

PlanStatus
  DRAFT ACTIVE ARCHIVED

SubscriptionStatus
  TRIAL ACTIVE PAST_DUE CANCELED EXPIRED

BillingProvider
  STRIPE MANUAL

NotificationType
  INFO SUCCESS WARNING ERROR ACTION_REQUIRED

NotificationStatus
  UNREAD READ DISMISSED ARCHIVED

IntegrationMappingStatus
  ACTIVE DISABLED ERROR ARCHIVED

BackgroundJobScope
  PLATFORM ORGANIZATION

BackgroundJobStatus
  QUEUED RUNNING SUCCEEDED FAILED CANCELED
```

## Canonical fields

### User

```txt
id email displayName avatarUrl preferredLocale timezone createdAt updatedAt
```

### Organization

```txt
id displayName legalName slug logoUrl websiteUrl countryCode vatNumber
publicEmail billingEmail timezone defaultLocale status createdAt updatedAt
archivedAt
```

### Membership

```txt
id organizationId userId role status invitedById joinedAt createdAt updatedAt
```

### Invitation

```txt
id organizationId email role status tokenHash expiresAt invitedById acceptedAt
acceptedById createdAt updatedAt
```

Never use or persist a raw invitation token.

### Product

```txt
id organizationId internalName sku normalizedSku publicCode lifecycleStatus
currentDraftVersionId currentPublishedVersionId createdById updatedById
archivedById createdAt updatedAt archivedAt lastPublishedAt
```

### ProductVersion

```txt
id productId organizationId status sourceLocale versionNumber versionLabel
changeSummary clonedFromVersionId createdById updatedById publishedById
createdAt updatedAt reviewReadyAt publishedAt supersededAt discardedAt
```

### Passport

```txt
id productId organizationId status defaultLocale firstPublishedAt
lastPublishedAt withdrawnAt withdrawnById withdrawalReasonCode
publicWithdrawalMessage archivedAt createdAt updatedAt
```

Stable public product identity is `Product.publicCode`.

### ProductTranslation

```txt
id productVersionId locale productName shortDescription description
technicalDescription repairInstructions sparePartsInformation
recyclingInstructions disposalInstructions packagingInformation
safetyInformation warrantyInformation publicNotes createdAt updatedAt
```

### ProductIdentifier

```txt
id productVersionId type value issuingAuthority notes createdAt updatedAt
```

Use `issuingAuthority` for the optional authority value.

### ProductMaterial

```txt
id productVersionId materialName category percentage isRecycled
recycledPercentage supplier notes createdAt updatedAt
```

Use `materialName` and `recycledPercentage`; do not substitute `name` or
`recycledContentPercentage`.

### Document

```txt
id organizationId originalFilename displayName fileExtension storageProvider
storageBucket storageKey mimeType sizeBytes checksumSha256 status uploadedAt
failedAt failureCode archivedAt createdById updatedById archivedById createdAt
updatedAt
```

Use `displayName`, `checksumSha256`, and the three implemented actor fields.

### ProductDocument

```txt
id productVersionId documentId category locale displayLabel description
isPublic isPrimary sortOrder createdAt updatedAt
```

Use `isPublic` and `displayLabel`.

### ProductImage

```txt
id productVersionId originalFilename fileExtension storageProvider
storageBucket storageKey mimeType sizeBytes checksumSha256 width height altText
caption isPublic isPrimary sortOrder uploadedAt createdAt updatedAt
```

ProductImage stores its own image storage metadata and relates only to
ProductVersion.

### QRCode

```txt
id passportId code targetUrl status generatedAt activatedAt revokedAt createdAt
updatedAt
```

There are no design, margin, logo, download, or cached-asset fields.

### ScanEvent

```txt
id qrCodeId scannedAt deviceType referrerType isBot countryCode region browser
operatingSystem language referrerHost createdAt
```

ScanEvent has no direct organizationId, passportId, productId, User relation,
raw IP, IP hash, user-agent string, or updatedAt.

### AuditLog

```txt
id organizationId actorId action entityType entityId summary metadata
correlationId occurredAt createdAt
```

AuditLog has no updatedAt, actor email snapshot, requestId, sessionId, source,
or severity. `action` and `entityType` are normalized Strings, not enums.

### Plan

```txt
id name slug description status currencyCode monthlyPrice yearlyPrice
maxProducts maxActivePassports maxMembers maxStorageBytes maxMonthlyScans
features isPublic sortOrder archivedAt createdAt updatedAt
```

### Subscription

```txt
id organizationId planId status billingProvider currentPeriodStart
currentPeriodEnd cancelAtPeriodEnd canceledAt externalCustomerId
externalSubscriptionId providerConfigurationKey createdAt updatedAt
```

Use singular `currentPeriodStart` and `currentPeriodEnd`. Scheduled
cancellation is `cancelAtPeriodEnd`; terminal cancellation is `canceledAt`.

### Notification

```txt
id organizationId userId type status eventType title message actionUrl
entityType entityId metadata readAt dismissedAt archivedAt expiresAt createdAt
updatedAt
```

`NotificationType` is presentation style. `eventType` is the business event.
Notification contains no delivery channel, provider, retry, recipient address,
or transport status.

### IntegrationMapping

```txt
id organizationId provider externalAccountId externalResourceType
externalResourceId entityType entityId status lastSyncedAt lastErrorAt
lastErrorCode metadata archivedAt createdAt updatedAt
```

`provider` and `entityType` are normalized uppercase Strings, not enums.

### BackgroundJob

```txt
id scope organizationId queue jobType status priority attemptCount maxAttempts
scheduledAt payload result entityType entityId deduplicationKey correlationId
lockedAt lockOwner startedAt completedAt failedAt canceledAt lastErrorCode
lastErrorSummary createdAt updatedAt
```

Use `scheduledAt`, `attemptCount`, `maxAttempts`, and `completedAt`.
`queue`, `jobType`, and `entityType` are normalized Strings, not enums.

## Canonical relation names

```txt
UserMemberships
MembershipsInvitedByUser
OrganizationInvitations
OrganizationInvitationsCreated
OrganizationInvitationsAccepted
OrganizationProducts
ProductVersions
CurrentDraftVersion
CurrentPublishedVersion
ClonedProductVersions
ProductCreatedBy
ProductUpdatedBy
ProductArchivedBy
OrganizationProductVersions
ProductVersionCreatedBy
ProductVersionUpdatedBy
ProductVersionPublishedBy
ProductVersionTranslations
ProductVersionIdentifiers
ProductVersionMaterials
OrganizationDocuments
DocumentCreatedBy
DocumentUpdatedBy
DocumentArchivedBy
ProductVersionDocuments
DocumentProductVersions
ProductVersionImages
ProductPassport
OrganizationPassports
PassportWithdrawnBy
PassportQRCode
QRCodeScanEvents
OrganizationAuditLogs
UserAuditLogs
PlanSubscriptions
OrganizationSubscription
OrganizationNotifications
UserNotifications
OrganizationIntegrationMappings
OrganizationBackgroundJobs
```

Relation fields use semantic singular or plural names. Never append `Relation`
or invent numbered relation aliases.

## Referential-action vocabulary

- Organization-owned retained roots use `onDelete: Restrict` and
  `onUpdate: Cascade`.
- Optional historical User actor and targeting relations use
  `onDelete: SetNull` and `onUpdate: Cascade`.
- ProductVersion content uses `onDelete: Cascade` and `onUpdate: Cascade`.
- ProductDocument-to-Document uses Restrict/Cascade.
- Passport-to-QRCode and QRCode-to-ScanEvent use Cascade/Cascade.
- Product current-version pointers and cloned-version provenance use
  SetNull/Cascade.

## Canonical partial index names

```txt
ux_invitation_one_pending_per_organization_email
ux_product_version_one_active_draft
ux_integration_mapping_external_resource_without_account
ux_integration_mapping_internal_entity_without_account
ux_background_job_platform_deduplication
ux_background_job_organization_deduplication
```

Do not document an implemented primary-image partial index; none exists.

## Common naming rules

- Every primary key is `id` with UUID storage.
- Public identifiers are separate from primary keys.
- URL fields end in `Url`; byte sizes end in `Bytes`.
- Actor keys use `...ById`, except `AuditLog.actorId`.
- Organization ownership uses `organizationId`, never tenantId, companyId, or
  workspaceId.
- JSON uses `metadata` except the intentional BackgroundJob `payload` and
  `result`, and Plan `features`.
- Product, ProductVersion, Passport, and Subscription status concepts retain
  their qualified or canonical implemented names.

## Reserved future concepts

Models such as NotificationDelivery, NotificationPreference,
IntegrationConnection, WebhookEndpoint, WebhookDelivery, Invoice,
PaymentTransaction, DocumentRevision, MediaAsset, DailyScanMetric, ProductBatch,
and ProductInstance are not implemented. They must not be described as current
schema or added without a separately reviewed phase.
