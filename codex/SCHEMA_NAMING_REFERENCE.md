# Passvero Schema Naming Reference

This document defines the canonical naming vocabulary for the Passvero database and Prisma schema.

It exists to prevent inconsistent terminology across:

- `schema.prisma`;
- migrations;
- repositories;
- services;
- DTOs;
- API routes;
- validation schemas;
- tests;
- application code;
- documentation.

Codex must read this file before creating or renaming Prisma models, fields, enums, relations or indexes.

When this file conflicts with an implementation name, the implementation should be corrected unless a documented architectural decision updates this reference.

This document supplements:

- `codex/DOMAIN_RULES.md`
- `codex/PRISMA_DOMAIN_MODEL.md`
- `codex/SCHEMA_IMPLEMENTATION_GUIDE.md`
- `codex/DATABASE_CONVENTIONS.md`

---

# 1. Naming goals

Passvero naming must be:

- consistent;
- explicit;
- domain-oriented;
- predictable;
- readable without surrounding code;
- stable across application layers;
- resistant to ambiguous synonyms.

One concept must have one canonical name.

Do not use different terms for the same concept in different parts of the application.

---

# 2. General naming conventions

## Prisma model names

Use:

```txt
PascalCase
singular nouns
```

Examples:

```txt
Organization
Membership
Product
ProductVersion
ProductMaterial
Document
Passport
ScanEvent
AuditLog
```

Do not use:

```txt
organizations
Products
tblProduct
ProductEntity
ProductModel
```

## Prisma field names

Use:

```txt
camelCase
```

Examples:

```txt
organizationId
createdAt
publicCode
currentPublishedVersionId
```

Do not use:

```txt
organization_id
OrganizationID
orgId
created_at
```

## Enum names

Use:

```txt
PascalCase
```

Examples:

```txt
OrganizationStatus
MembershipRole
ProductLifecycleStatus
ProductVersionStatus
DocumentStatus
PassportStatus
```

## Enum values

Use:

```txt
UPPER_SNAKE_CASE
```

Examples:

```txt
ACTIVE
READY_FOR_REVIEW
PAST_DUE
SAFETY_INFORMATION
```

## Relation fields

Use semantic nouns describing the related records.

Singular relation:

```txt
organization
product
currentDraftVersion
uploadedBy
```

Plural relation:

```txt
memberships
products
versions
documents
scanEvents
```

Do not append `Relation` to relation fields.

## Foreign key fields

Foreign keys end with:

```txt
Id
```

Examples:

```txt
organizationId
productId
userId
publishedById
```

Never use:

```txt
organizationID
orgId
productFk
owner
```

---

# 3. Canonical model names

## Identity domain

```txt
User
Organization
Membership
Invitation
```

| Canonical | Do not use |
|---|---|
| `User` | AccountHolder, Person, AppUser |
| `Organization` | Company, Tenant, Workspace, Business |
| `Membership` | OrganizationUser, TeamMember, UserOrganization |
| `Invitation` | Invite, TeamInvite, MembershipInvite |

Notes:

- `Organization` is both the business account and tenant boundary.
- `Membership` is the authorization link between User and Organization.
- `Invitation` exists before Membership creation.

## Product domain

```txt
Product
ProductVersion
ProductTranslation
ProductIdentifier
ProductMaterial
ProductDocument
ProductImage
Document
Passport
QRCode
```

| Canonical | Do not use |
|---|---|
| `Product` | Item, Article, CatalogItem |
| `ProductVersion` | Version, ProductRevision, PassportVersion |
| `ProductTranslation` | Translation, ProductLocale, LocalizedProduct |
| `ProductIdentifier` | Identifier, ProductCode, ExternalCode |
| `ProductMaterial` | Material, Composition, ProductComposition |
| `ProductDocument` | DocumentLink, ProductFile, ProductAttachment |
| `ProductImage` | Image, ProductMedia, ProductPhoto |
| `Document` | File, Attachment, AssetDocument |
| `Passport` | DPP, DigitalPassport, ProductPassport |
| `QRCode` | QrCode, QR, Qr |

## Operational domain

```txt
ScanEvent
AuditLog
```

| Canonical | Do not use |
|---|---|
| `ScanEvent` | Scan, ViewEvent, PassportVisit, AnalyticsEvent |
| `AuditLog` | Activity, History, EventLog, AuditEvent |

## Platform domain

```txt
Plan
Subscription
Notification
IntegrationMapping
BackgroundJob
```

| Canonical | Do not use |
|---|---|
| `Plan` | PricingPlan, Tier |
| `Subscription` | BillingAccount, OrganizationPlan |
| `Notification` | Alert, Message |
| `IntegrationMapping` | ExternalMapping, SyncMapping |
| `BackgroundJob` | Job, Task, QueueItem |

---

# 4. Reserved future model names

```txt
MediaAsset
DocumentRevision
ProductTemplate
ProductCategory
ProductCategoryRule
MaterialCatalogEntry
ApiKey
WebhookEndpoint
WebhookDelivery
IntegrationConnection
ProductBatch
ProductInstance
ExternalIdentifierMapping
DailyScanMetric
OrganizationPreference
UserPreference
```

Do not implement these models until explicitly requested.

---

# 5. Canonical primary key field

Every Prisma model uses:

```txt
id
```

Do not use:

```txt
uuid
userId as primary key
productUuid
recordId
```

---

# 6. Canonical common timestamp fields

Required common timestamps:

```txt
createdAt
updatedAt
```

Lifecycle timestamps:

```txt
archivedAt
deletedAt
publishedAt
supersededAt
discardedAt
withdrawnAt
suspendedAt
deactivatedAt
canceledAt
acceptedAt
joinedAt
expiresAt
startedAt
finishedAt
trialEndsAt
lastPublishedAt
firstPublishedAt
lastDownloadedAt
lastSeenAt
```

Do not use ambiguous names such as:

```txt
date
timestamp
time
inactiveAt
ended
publishDate
```

---

# 7. Canonical actor fields

```txt
createdById
updatedById
publishedById
archivedById
withdrawnById
invitedById
uploadedById
addedById
reviewedById
removedById
```

Corresponding relation fields:

```txt
createdBy
updatedBy
publishedBy
archivedBy
withdrawnBy
invitedBy
uploadedBy
addedBy
reviewedBy
removedBy
```

Exception:

```txt
AuditLog.actorId
AuditLog.actor
```

---

# 8. Organization ownership fields

Use:

```txt
organizationId
organization
```

Do not use:

```txt
tenantId
companyId
workspaceId
businessId
ownerOrganizationId
```

---

# 9. Canonical identity-domain fields

## User

```txt
id
email
displayName
avatarUrl
preferredLocale
timezone
createdAt
updatedAt
```

Avoid:

```txt
name
fullName
profileImage
language
timeZoneName
```

## Organization

```txt
id
displayName
legalName
slug
logoUrl
websiteUrl
countryCode
vatNumber
publicEmail
billingEmail
timezone
defaultLocale
status
createdAt
updatedAt
archivedAt
```

## Membership

```txt
id
organizationId
userId
role
status
invitedById
joinedAt
createdAt
updatedAt
```

## Invitation

```txt
id
organizationId
email
role
status
tokenHash
expiresAt
acceptedAt
invitedById
acceptedById
createdAt
updatedAt
```

Never persist a raw invitation token.

---

# 10. Canonical Product fields

## Product

```txt
id
organizationId
internalName
sku
normalizedSku
publicCode
lifecycleStatus
currentDraftVersionId
currentPublishedVersionId
createdById
updatedById
archivedById
createdAt
updatedAt
archivedAt
lastPublishedAt
```

Relations:

```txt
organization
versions
currentDraftVersion
currentPublishedVersion
passport
createdBy
updatedBy
archivedBy
```

## ProductVersion

```txt
id
productId
organizationId
status
versionNumber
versionLabel
sourceLocale
changeSummary
clonedFromVersionId
createdById
updatedById
publishedById
createdAt
updatedAt
reviewReadyAt
publishedAt
supersededAt
discardedAt
```

## ProductTranslation

```txt
id
productVersionId
locale
productName
shortDescription
description
technicalDescription
repairInstructions
sparePartsInformation
recyclingInstructions
disposalInstructions
packagingInformation
safetyInformation
warrantyInformation
publicNotes
status
createdAt
updatedAt
```

## ProductIdentifier

```txt
id
productVersionId
type
value
normalizedValue
label
issuer
scheme
isPrimary
sortOrder
createdAt
```

## ProductMaterial

```txt
id
productVersionId
name
materialCode
percentage
recycledContentPercentage
renewableContentPercentage
countryOfOriginCode
notes
hazardousSubstanceNotes
isPrimaryMaterial
sortOrder
createdAt
updatedAt
```

---

# 11. Canonical Document fields

## Document

```txt
id
organizationId
storageKey
storageBucket
originalFilename
displayFilename
title
description
mimeType
detectedMimeType
sizeBytes
checksum
category
status
sourceLocale
documentDate
validFrom
validUntil
uploadedById
archivedById
createdAt
updatedAt
archivedAt
```

## ProductDocument

```txt
id
productVersionId
documentId
visibility
displayTitle
description
locale
categoryOverride
sortOrder
isFeatured
addedById
createdAt
```

Use `visibility`, not `isPublic`.

---

# 12. Canonical ProductImage fields

```txt
id
productVersionId
assetId
isPrimary
sortOrder
altText
caption
locale
addedById
createdAt
```

---

# 13. Canonical Passport fields

```txt
id
productId
organizationId
status
defaultLocale
firstPublishedAt
lastPublishedAt
withdrawnAt
withdrawnById
withdrawalReasonCode
publicWithdrawalMessage
archivedAt
createdAt
updatedAt
```

Stable public identity remains:

```txt
Product.publicCode
```

---

# 14. Canonical QRCode fields

```txt
id
passportId
errorCorrectionLevel
margin
logoEnabled
designVersion
generatedAt
lastDownloadedAt
createdAt
updatedAt
```

Potential cached asset fields:

```txt
pngStorageKey
svgStorageKey
```

---

# 15. Canonical ScanEvent fields

```txt
id
organizationId
passportId
productId
scannedAt
countryCode
regionCode
locale
deviceType
operatingSystem
browser
referrerType
campaignCode
qrSource
ipHash
userAgentHash
processingVersion
createdAt
```

---

# 16. Canonical AuditLog fields

```txt
id
organizationId
actorId
actorEmailSnapshot
action
entityType
entityId
metadata
requestId
sessionId
source
severity
createdAt
```

---

# 17. Canonical platform fields

## Plan

```txt
id
code
name
description
sortOrder
isActive
featureFlags
createdAt
updatedAt
```

## Subscription

```txt
id
organizationId
planId
status
billingProvider
externalCustomerId
externalSubscriptionId
startsAt
trialEndsAt
currentPeriodStartsAt
currentPeriodEndsAt
renewalDate
canceledAt
suspendedAt
createdAt
updatedAt
```

## Notification

```txt
id
userId
organizationId
type
severity
title
message
actionUrl
metadata
readAt
archivedAt
createdAt
```

## IntegrationMapping

```txt
id
organizationId
provider
entityType
entityId
externalId
externalParentId
syncStatus
lastSyncedAt
metadata
createdAt
updatedAt
```

## BackgroundJob

```txt
id
organizationId
type
status
payload
result
retryCount
maxRetries
priority
startedAt
finishedAt
availableAt
failureCode
failureMessage
createdAt
updatedAt
```

---

# 18. Canonical enum names

## Identity enums

```txt
OrganizationStatus
MembershipRole
MembershipStatus
InvitationStatus
```

## Product enums

```txt
ProductLifecycleStatus
ProductVersionStatus
ProductTranslationStatus
ProductIdentifierType
DocumentCategory
DocumentStatus
DocumentVisibility
PassportStatus
```

## Operational enums

```txt
ScanDeviceType
ScanReferrerType
AuditAction
AuditEntityType
AuditSeverity
AuditSource
```

## Platform enums

```txt
SubscriptionStatus
BillingProvider
NotificationType
NotificationSeverity
IntegrationProvider
IntegrationEntityType
IntegrationSyncStatus
BackgroundJobType
BackgroundJobStatus
```

Do not use generic enum names such as:

```txt
Status
Role
Type
Visibility
Category
```

---

# 19. Canonical enum values

## OrganizationStatus

```txt
ACTIVE
SUSPENDED
DEACTIVATED
PENDING_DELETION
```

## MembershipRole

```txt
OWNER
ADMIN
EDITOR
VIEWER
```

## MembershipStatus

```txt
ACTIVE
SUSPENDED
REMOVED
```

## InvitationStatus

```txt
PENDING
ACCEPTED
EXPIRED
REVOKED
```

## ProductLifecycleStatus

```txt
ACTIVE
ARCHIVED
```

## ProductVersionStatus

```txt
DRAFT
READY_FOR_REVIEW
PUBLISHED
SUPERSEDED
DISCARDED
```

## ProductTranslationStatus

```txt
DRAFT
COMPLETE
NEEDS_REVIEW
```

Omit this enum from MVP if it is not actively used.

## ProductIdentifierType

```txt
GTIN
EAN
UPC
MPN
MODEL_NUMBER
CUSTOM
```

## DocumentCategory

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

## DocumentStatus

```txt
UPLOADING
PROCESSING
READY
FAILED
ARCHIVED
```

## DocumentVisibility

```txt
PRIVATE
PUBLIC
```

## PassportStatus

```txt
ACTIVE
WITHDRAWN
ARCHIVED
```

## ScanDeviceType

```txt
DESKTOP
MOBILE
TABLET
BOT
UNKNOWN
```

## ScanReferrerType

```txt
DIRECT
QR
SEARCH
SOCIAL
EMAIL
UNKNOWN
```

## AuditSeverity

```txt
INFO
WARNING
ERROR
CRITICAL
```

## SubscriptionStatus

```txt
TRIAL
ACTIVE
PAST_DUE
GRACE_PERIOD
CANCELED
SUSPENDED
```

## BackgroundJobStatus

```txt
PENDING
RUNNING
SUCCEEDED
FAILED
RETRYING
```

---

# 20. Canonical relation names

Use explicit Prisma relation names whenever multiple relations exist between the same model pair.

## Product and ProductVersion

Use:

```txt
ProductVersions
CurrentDraftVersion
CurrentPublishedVersion
ClonedProductVersions
```

Conceptual mapping:

```txt
Product.versions
ProductVersion.product
```

Use relation name:

```txt
ProductVersions
```

For current draft:

```txt
Product.currentDraftVersion
ProductVersion.currentDraftForProduct
```

Use relation name:

```txt
CurrentDraftVersion
```

For current published:

```txt
Product.currentPublishedVersion
ProductVersion.currentPublishedForProduct
```

Use relation name:

```txt
CurrentPublishedVersion
```

For cloned versions:

```txt
ProductVersion.clonedFromVersion
ProductVersion.clonedVersions
```

Use relation name:

```txt
ClonedProductVersions
```

## User actor relations

Recommended explicit relation names:

```txt
ProductCreatedBy
ProductUpdatedBy
ProductArchivedBy
ProductVersionCreatedBy
ProductVersionUpdatedBy
ProductVersionPublishedBy
OrganizationInvitationsCreated
OrganizationInvitationsAccepted
DocumentUploadedBy
DocumentArchivedBy
PassportWithdrawnBy
```

Do not use:

```txt
UserRelation1
ActorRelation
CreatedByRelation
```

---

# 21. Collection field names

Use meaningful English plurals:

```txt
memberships
organizations
invitations
products
versions
translations
identifiers
materials
documents
images
passports
scanEvents
auditLogs
subscriptions
notifications
integrationMappings
backgroundJobs
```

Do not use:

```txt
productVersionsList
allDocuments
userMembershipsArray
```

---

# 22. Boolean naming

Boolean fields begin with:

```txt
is
has
can
should
```

Preferred examples:

```txt
isPrimary
isFeatured
isActive
logoEnabled
```

Avoid negative boolean names and booleans representing workflows.

Bad:

```txt
isDraft
isPublished
isArchived
isWithdrawn
```

Use status enums instead.

---

# 23. Count and numeric field naming

Use clear unit suffixes:

```txt
sizeBytes
pageCount
retryCount
maxRetries
sortOrder
versionNumber
downloadCount
processingVersion
```

For durations, include the unit:

```txt
retentionDays
timeoutSeconds
durationMinutes
```

---

# 24. URL and storage naming

URL values end with:

```txt
Url
```

Examples:

```txt
websiteUrl
logoUrl
avatarUrl
actionUrl
```

Storage identifiers:

```txt
storageKey
storageBucket
```

---

# 25. Locale and country naming

Use:

```txt
locale
sourceLocale
defaultLocale
preferredLocale
countryCode
countryOfOriginCode
regionCode
```

Current approved application locales:

```txt
hr
en
de
sr
sl
pl
```

---

# 26. Normalized fields

Use the prefix:

```txt
normalized
```

Examples:

```txt
normalizedSku
normalizedValue
normalizedEmail
```

---

# 27. External provider fields

Use:

```txt
provider
externalId
externalCustomerId
externalSubscriptionId
externalParentId
```

Avoid provider-specific fields in core models:

```txt
stripeCustomerId
shopifyProductId
woocommerceId
```

---

# 28. Metadata field naming

Use:

```txt
metadata
```

only for intentionally flexible, non-core structured data.

Exceptions:

```txt
BackgroundJob.payload
BackgroundJob.result
```

Avoid generic names such as:

```txt
data
extra
options
config
```

---

# 29. Error field naming

Use:

```txt
failureCode
failureMessage
failureReasonCode
```

Avoid:

```txt
error
errorText
reason
```

---

# 30. Public and private naming

Use explicit variants:

```txt
publicEmail
billingEmail
publicNotes
internalNotes
publicWithdrawalMessage
```

---

# 31. Status vs lifecycle naming

Use `status` for one clear workflow state:

```txt
ProductVersion.status
Document.status
Passport.status
Subscription.status
```

Use a qualified field where concepts might conflict:

```txt
Product.lifecycleStatus
```

---

# 32. Version naming

Use:

```txt
ProductVersion
versionNumber
versionLabel
processingVersion
designVersion
```

Avoid generic standalone `version` where ambiguous.

---

# 33. Public identifier naming

Canonical public product identifier:

```txt
Product.publicCode
```

Do not use:

```txt
passportCode
publicId
publicUuid
shortCode
slugCode
```

---

# 34. Index and constraint naming in migrations

Manual SQL migration objects should use:

```txt
ux_<table>_<columns>
ix_<table>_<columns>
fk_<table>_<column>
ck_<table>_<rule>
```

Examples:

```txt
ux_product_version_one_active_draft
ux_product_image_one_primary
ix_scan_event_organization_scanned_at
ck_product_material_percentage_range
```

---

# 35. Migration naming

Use descriptive names:

```txt
init_identity_domain
add_product_core
add_product_versioning
add_product_translations
add_documents
add_passport_publication
add_operational_core
add_partial_unique_indexes
```

Avoid:

```txt
init
changes
update_schema
fix
final
```

---

# 36. DTO naming alignment

Examples:

```txt
OrganizationDto
ProductListItemDto
ProductDetailDto
ProductVersionDto
PublicPassportDto
PublicDocumentDto
ScanAnalyticsDto
```

Do not expose Prisma model types directly.

---

# 37. Repository and service naming alignment

Repositories:

```txt
organizationRepository
membershipRepository
productRepository
productVersionRepository
documentRepository
passportRepository
```

Services:

```txt
organizationService
membershipService
invitationService
productService
productVersionService
publicationService
documentService
passportService
qrService
scanService
auditService
subscriptionService
```

---

# 38. Canonical API resource terms

Use:

```txt
organizations
memberships
invitations
products
product-versions
documents
passports
scan-events
audit-logs
subscriptions
```

Public passport route:

```txt
/p/[publicCode]
```

---

# 39. Forbidden terminology summary

```txt
Company → Organization
Tenant → Organization
Workspace → Organization
TeamMember → Membership
OrganizationUser → Membership
Invite → Invitation
Item → Product
Revision → ProductVersion
Version → ProductVersion when referring to product publication data
Translation → ProductTranslation as a model
Material → ProductMaterial as the version child model
Attachment → Document
DocumentLink → ProductDocument
ProductFile → ProductDocument
DigitalPassport → Passport
ProductPassport → Passport
DPP model → Passport
QrCode → QRCode model
ViewEvent → ScanEvent
ActivityLog → AuditLog
PricingPlan → Plan
BillingAccount → Subscription
QueueJob → BackgroundJob
ExternalMapping → IntegrationMapping
```

---

# 40. Naming conflict resolution

When a required name is not covered:

1. identify the business concept;
2. check `DOMAIN_RULES.md`;
3. check `PRISMA_DOMAIN_MODEL.md`;
4. prefer an explicit noun over an abbreviation;
5. avoid synonyms assigned to another concept;
6. update this document;
7. record significant changes in `DECISIONS.md`;
8. rename all affected layers consistently.

---

# 41. MVP naming subset

The initial Identity Domain schema should use exactly:

## Models

```txt
User
Organization
Membership
Invitation
```

## Enums

```txt
OrganizationStatus
MembershipRole
MembershipStatus
InvitationStatus
```

## Organization fields

```txt
id
displayName
legalName
slug
logoUrl
websiteUrl
countryCode
vatNumber
publicEmail
billingEmail
timezone
defaultLocale
status
createdAt
updatedAt
archivedAt
```

## User fields

```txt
id
email
displayName
avatarUrl
preferredLocale
timezone
createdAt
updatedAt
```

## Membership fields

```txt
id
organizationId
userId
role
status
invitedById
joinedAt
createdAt
updatedAt
```

## Invitation fields

```txt
id
organizationId
email
role
status
tokenHash
expiresAt
acceptedAt
invitedById
acceptedById
createdAt
updatedAt
```

Codex must not invent alternative names for the first migration.

---

# 42. Initial relation field subset

## User relations

```txt
memberships
invitationsCreated
invitationsAccepted
membershipsInvited
```

Only add relations actually required by the implemented schema.

## Organization relations

```txt
memberships
invitations
```

Future:

```txt
products
documents
auditLogs
scanEvents
subscription
```

## Membership relations

```txt
organization
user
invitedBy
```

## Invitation relations

```txt
organization
invitedBy
acceptedBy
```

Use explicit Prisma relation names where User is referenced multiple times.

---

# 43. Naming review checklist

Before approving a Prisma change, verify:

- [ ] Model names are singular PascalCase.
- [ ] Field names are camelCase.
- [ ] Enum names are specific PascalCase.
- [ ] Enum values are UPPER_SNAKE_CASE.
- [ ] Foreign keys end with `Id`.
- [ ] Organization ownership uses `organizationId`.
- [ ] Public product identity uses `publicCode`.
- [ ] Business identifiers remain strings.
- [ ] Lifecycle fields are not represented by conflicting booleans.
- [ ] Public/private variants are clearly named.
- [ ] Actor fields use canonical `...ById` names.
- [ ] Timestamp names describe their business event.
- [ ] URL fields end with `Url`.
- [ ] Byte sizes end with `Bytes`.
- [ ] Locale and country fields use canonical names.
- [ ] Multiple Prisma relations have explicit relation names.
- [ ] No forbidden synonym has been introduced.
- [ ] Migrations use descriptive names.
- [ ] Renames are applied consistently across schema, services, DTOs and tests.

---

# 44. Final naming principles

The canonical Passvero vocabulary is:

```txt
User
Organization
Membership
Invitation

Product
ProductVersion
ProductTranslation
ProductIdentifier
ProductMaterial
Document
ProductDocument
ProductImage
Passport
QRCode

ScanEvent
AuditLog

Plan
Subscription
Notification
IntegrationMapping
BackgroundJob
```

The most important distinctions are:

```txt
Organization is the tenant.
Membership grants access.
Invitation exists before membership.

Product is stable identity.
ProductVersion is versioned content.
Passport is public publication state.
QRCode points to the stable Passport URL.

Document is the reusable file.
ProductDocument defines version-specific use and visibility.

ScanEvent is analytics.
AuditLog is operational history.
```

Do not collapse these concepts.

Do not rename them locally.

Consistent vocabulary is part of the Passvero architecture.
