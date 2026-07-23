# Passvero Authorization Permission Matrix

## Purpose

This document defines the canonical authorization capability model for future
Passvero application services.

It specifies:

- the responsibilities of the implemented Membership roles;
- stable permission categories and capability names;
- normal role-to-capability assignment;
- use-case authorization requirements;
- ownership and resource-policy rules; and
- the separation between tenant, worker, public, and platform authority.

Permissions authorize application-service use cases. UI visibility, menus,
navigation, routes, and client state may reflect authorization outcomes but do
not grant authority.

This document defines policy only. It does not implement permissions, change
the Prisma schema, or select an authentication mechanism.

## Principles

- Authorization is deny-by-default.
- The active Organization, Membership, role, and trusted context are resolved
  server-side.
- The exact implemented Membership roles remain OWNER, ADMIN, EDITOR, and
  VIEWER.
- No permission is inferred from client input, UI state, a route, or a valid
  resource ID.
- Every private capability is evaluated within one trusted Organization
  context.
- A permission is necessary but may not be sufficient. Resource ownership,
  lifecycle state, service invariants, concurrency, and transaction rules still
  apply.
- Role-to-permission mapping is centralized and deterministic.
- Application services request capabilities; they do not scatter direct role
  comparisons.
- Repositories perform scoped persistence and never decide actor authority.
- Public, WorkerContext, and PlatformAdminContext authorization remain
  separate from Membership-role permissions.
- Capabilities are application policy constants, not database records.
- New capabilities are additive reviewed policy changes. New Membership roles
  require separate architecture review and are not introduced here.

## Permission Philosophy

Roles are identity. Permissions are capabilities.

A Membership role describes the person's normal responsibility in one
Organization. A permission names one stable class of authorized use case.
Application services ask:

> Does this trusted context have the required permission?

They do not ask:

> Is this User an OWNER?

Direct role checks are reserved for the centralized permission policy and the
few explicit role-sensitive invariants, such as last-active-OWNER protection
and role-grant rules.

Permission evaluation does not replace resource authorization. A context with
`PRODUCT_EDIT` may edit only an eligible draft ProductVersion in its active
Organization. It cannot edit another tenant's Product, mutate a published
aggregate, or bypass concurrency rules.

Capabilities describe authority, not implementation. They remain independent
from HTTP methods, routes, forms, pages, buttons, menus, and provider SDKs.

## Permission Categories

The canonical model contains 14 categories:

1. **Organization** — view and update ordinary Organization configuration.
2. **Membership** — view, invite, change, and remove Organization members.
3. **Products** — create and manage private Product and draft content.
4. **Publication** — publish an eligible ProductVersion.
5. **Documents** — view, upload, associate, and delete eligible assets.
6. **Passport** — manage private Passport lifecycle.
7. **QR** — regenerate the approved QR artifact or representation.
8. **Analytics** — read tenant-scoped scan analytics.
9. **Audit** — read private Organization AuditLog history.
10. **Notifications** — read, create, and manage application notifications.
11. **Integrations** — read and transition IntegrationMapping records.
12. **Background Jobs** — enqueue, inspect, or execute job lifecycle use cases.
13. **Billing** — read billing state and manage current tenant entitlement.
14. **Platform Administration** — perform explicit platform-only operations
    outside tenant Membership authority.

Categories organize policy and reviews. Possessing one capability does not
grant every capability in the same category.

## Canonical Permission List

The canonical list contains 35 permissions.

| Category | Permission | Authorized capability |
| --- | --- | --- |
| Organization | `ORGANIZATION_READ` | Read allowlisted private Organization profile and status data in the active tenant. |
| Organization | `ORGANIZATION_UPDATE` | Update ordinary Organization profile/configuration through an approved use case; excludes destructive lifecycle and platform operations. |
| Membership | `MEMBERSHIP_READ` | Read tenant-scoped Membership data allowed by the service result. |
| Membership | `MEMBERSHIP_INVITE` | Create or revoke invitations within grant and duplicate-invitation rules. |
| Membership | `MEMBERSHIP_UPDATE` | Change an eligible Membership role or status, subject to grant and OWNER rules. |
| Membership | `MEMBERSHIP_REMOVE` | Remove an eligible Membership, subject to self-action and last-OWNER rules. |
| Products | `PRODUCT_READ` | Read private Product, ProductVersion, and eligible version-content data in the active tenant. |
| Products | `PRODUCT_CREATE` | Create a Product and initial draft through the transactional create-then-point use case. |
| Products | `PRODUCT_EDIT` | Create or update eligible draft content; never mutate PUBLISHED or SUPERSEDED aggregates. |
| Products | `PRODUCT_ARCHIVE` | Archive an eligible Product through the approved lifecycle service. |
| Products | `PRODUCT_RESTORE` | Restore an eligible archived Product or create a new draft from historical content. |
| Publication | `PRODUCT_PUBLISH` | Execute the complete transactional publication workflow for an eligible ProductVersion. |
| Documents | `DOCUMENT_READ` | Read private Document metadata and authorized storage-delivery results. |
| Documents | `DOCUMENT_UPLOAD` | Register and finalize an eligible Document or ProductImage upload. |
| Documents | `DOCUMENT_ASSOCIATE` | Add, remove, reorder, or select eligible ProductDocument associations and ProductImage presentation entries in an editable ProductVersion. |
| Documents | `DOCUMENT_DELETE` | Delete an eligible unretained asset through the guarded storage/database workflow; published references remain protected. |
| Passport | `PASSPORT_MANAGE` | Withdraw, reactivate, archive, or otherwise transition an eligible Passport through its approved service. |
| QR | `QRCODE_REGENERATE` | Regenerate an approved QR artifact from the stable public identity without changing ownership or publication. |
| Analytics | `SCAN_ANALYTICS_READ` | Read tenant-scoped privacy-minimized scan analytics and approved aggregates. |
| Audit | `AUDIT_READ` | Read private tenant-scoped AuditLog results through an allowlisted service DTO. |
| Notifications | `NOTIFICATION_READ` | Read notifications visible to the current User or Organization context. |
| Notifications | `NOTIFICATION_CREATE` | Create an authorized User-targeted or Organization-wide application notification. |
| Notifications | `NOTIFICATION_MANAGE` | Change read, dismissed, or archived state only for a notification visible to the caller under notification policy. |
| Integrations | `INTEGRATION_READ` | Read tenant-scoped IntegrationMapping status and allowlisted metadata. |
| Integrations | `INTEGRATION_MANAGE` | Create, archive, reactivate, disable, or record an approved IntegrationMapping transition. |
| Background Jobs | `BACKGROUND_JOB_ENQUEUE` | Request an allowlisted BackgroundJob type in the authorized scope. |
| Background Jobs | `BACKGROUND_JOB_READ` | Read tenant-scoped operational job state and safe results. |
| Background Jobs | `BACKGROUND_JOB_MANAGE` | Claim, complete, fail, cancel, or retry a job as trusted worker infrastructure. |
| Billing | `BILLING_READ` | Read current Subscription, assigned Plan, limits, and allowlisted entitlement state. |
| Billing | `PLAN_ASSIGN` | Assign an eligible existing Plan to the active Organization through a guarded entitlement use case. |
| Billing | `SUBSCRIPTION_MANAGE` | Transition the Organization's current Subscription, including scheduled and terminal cancellation semantics. |
| Platform Administration | `PLATFORM_ORGANIZATION_MANAGE` | Perform an explicitly approved platform-level Organization operation through a dedicated platform service. |
| Platform Administration | `PLATFORM_PLAN_MANAGE` | Create or change global Plan configuration through a dedicated platform service. |
| Platform Administration | `PLATFORM_JOB_MANAGE` | Operate explicitly approved PLATFORM-scoped BackgroundJob administration. |
| Platform Administration | `PLATFORM_SUPPORT_READ` | Read the minimum data approved for a purpose-specific support operation with safe reason and audit controls. |

Capability names are stable policy identifiers. Renaming or changing their
meaning requires a documentation and test review because services and audit
expectations will depend on them.

## Membership Roles

### VIEWER

VIEWER is the read-oriented tenant role.

It may inspect Organization, Membership, Product, Document, and approved scan
analytics data. It may read visible notifications and update only its own
visible notification inbox state.

VIEWER cannot create or change business resources, invite or manage members,
publish, archive, manage billing, operate integrations, enqueue jobs, or access
AuditLog.

`NOTIFICATION_MANAGE` is a narrow personal-inbox exception to read-only
business access. It does not authorize notification creation or domain-state
mutation.

### EDITOR

EDITOR inherits VIEWER capabilities and prepares Product content.

It may create Products, create and edit drafts, upload assets, and manage
Document and ProductImage associations on editable ProductVersions.

EDITOR cannot publish, archive or restore Products, delete retained Documents,
manage Membership, change Passport state, regenerate QR artifacts, operate
integrations, enqueue arbitrary jobs, read AuditLog, or manage billing.

### ADMIN

ADMIN inherits EDITOR capabilities and performs ordinary tenant operations.

It may update ordinary Organization profile data, invite and manage eligible
non-OWNER Memberships, publish/archive/restore Products, delete eligible
unretained Documents, manage Passport and QR operations, read AuditLog, create
notifications, manage integrations, request approved jobs, inspect tenant job
state, and read billing state.

ADMIN does not receive ownership-sensitive Plan assignment or Subscription
mutation authority. It cannot alter OWNER Memberships, bypass last-OWNER
protection, manage global Plans, claim worker jobs, or perform platform
administration.

### OWNER

OWNER inherits every ADMIN tenant capability and carries final tenant
responsibility.

It may perform approved OWNER-level Membership changes and manage current
Organization entitlement through `PLAN_ASSIGN` and `SUBSCRIPTION_MANAGE`.

OWNER is not unrestricted. It remains bound to its Organization, service
invariants, retention rules, published immutability, transaction requirements,
last-active-OWNER protection, and safe public/private boundaries. OWNER has no
worker or platform-administration capability merely because of its tenant role.

## Role Capability Matrix

Tenant roles use additive inheritance:

```txt
OWNER includes ADMIN
ADMIN includes EDITOR
EDITOR includes VIEWER
```

Inheritance applies only to Membership-role capabilities. Resource policies and
special rules may further restrict a use case. Worker and platform permissions
are never inherited by a Membership role.

| Permission | VIEWER | EDITOR | ADMIN | OWNER |
| --- | :---: | :---: | :---: | :---: |
| `ORGANIZATION_READ` | ✓ | ✓ | ✓ | ✓ |
| `ORGANIZATION_UPDATE` | — | — | ✓ | ✓ |
| `MEMBERSHIP_READ` | ✓ | ✓ | ✓ | ✓ |
| `MEMBERSHIP_INVITE` | — | — | ✓ | ✓ |
| `MEMBERSHIP_UPDATE` | — | — | ✓ | ✓ |
| `MEMBERSHIP_REMOVE` | — | — | ✓ | ✓ |
| `PRODUCT_READ` | ✓ | ✓ | ✓ | ✓ |
| `PRODUCT_CREATE` | — | ✓ | ✓ | ✓ |
| `PRODUCT_EDIT` | — | ✓ | ✓ | ✓ |
| `PRODUCT_ARCHIVE` | — | — | ✓ | ✓ |
| `PRODUCT_RESTORE` | — | — | ✓ | ✓ |
| `PRODUCT_PUBLISH` | — | — | ✓ | ✓ |
| `DOCUMENT_READ` | ✓ | ✓ | ✓ | ✓ |
| `DOCUMENT_UPLOAD` | — | ✓ | ✓ | ✓ |
| `DOCUMENT_ASSOCIATE` | — | ✓ | ✓ | ✓ |
| `DOCUMENT_DELETE` | — | — | ✓ | ✓ |
| `PASSPORT_MANAGE` | — | — | ✓ | ✓ |
| `QRCODE_REGENERATE` | — | — | ✓ | ✓ |
| `SCAN_ANALYTICS_READ` | ✓ | ✓ | ✓ | ✓ |
| `AUDIT_READ` | — | — | ✓ | ✓ |
| `NOTIFICATION_READ` | ✓ | ✓ | ✓ | ✓ |
| `NOTIFICATION_CREATE` | — | — | ✓ | ✓ |
| `NOTIFICATION_MANAGE` | ✓ | ✓ | ✓ | ✓ |
| `INTEGRATION_READ` | — | — | ✓ | ✓ |
| `INTEGRATION_MANAGE` | — | — | ✓ | ✓ |
| `BACKGROUND_JOB_ENQUEUE` | — | — | ✓ | ✓ |
| `BACKGROUND_JOB_READ` | — | — | ✓ | ✓ |
| `BACKGROUND_JOB_MANAGE` | — | — | — | — |
| `BILLING_READ` | — | — | ✓ | ✓ |
| `PLAN_ASSIGN` | — | — | — | ✓ |
| `SUBSCRIPTION_MANAGE` | — | — | — | ✓ |
| `PLATFORM_ORGANIZATION_MANAGE` | — | — | — | — |
| `PLATFORM_PLAN_MANAGE` | — | — | — | — |
| `PLATFORM_JOB_MANAGE` | — | — | — | — |
| `PLATFORM_SUPPORT_READ` | — | — | — | — |

`BACKGROUND_JOB_MANAGE` is granted only through a validated WorkerContext and
job policy. Platform capabilities are granted only through a validated
PlatformAdminContext and purpose-specific platform policy.

## Special Authorization Rules

### Permission is necessary, not sufficient

Every service also validates:

- ACTIVE Membership and eligible Organization context;
- tenant ownership or approved inherited ownership;
- resource visibility and lifecycle state;
- service invariants;
- actor attribution;
- concurrency and expected state; and
- transaction and audit requirements.

### Last ACTIVE OWNER

The final ACTIVE OWNER cannot be removed, suspended, demoted, or allowed to
self-remove or self-demote. OWNER-set changes are serialized or revalidated
transactionally so concurrent mutations cannot leave zero ACTIVE owners.

### Role-grant ceiling

An actor cannot grant authority exceeding their own.

- ADMIN may invite or manage ADMIN, EDITOR, and VIEWER Memberships, but cannot
  create, demote, suspend, or remove an OWNER.
- Only OWNER may perform an approved OWNER-level grant or change.
- Granting OWNER still requires the target, invitation, tenant, and audit rules.
- Self-actions obey the same ceiling and last-OWNER protection.

The service authorizes `MEMBERSHIP_UPDATE` or `MEMBERSHIP_REMOVE`, then applies
these role-sensitive resource rules. The capability alone is not an OWNER
bypass.

### Editor and Viewer limits

EDITOR can prepare content but cannot publish. Publication requires
`PRODUCT_PUBLISH`, readiness validation, transactional pointer updates,
published immutability, and audit history.

VIEWER cannot mutate Organization business resources. Its only write-like
capability is the self-scoped notification lifecycle operation allowed by
`NOTIFICATION_MANAGE`.

### Administrative limits

`ORGANIZATION_UPDATE` covers ordinary profile/configuration changes. Destructive
Organization lifecycle changes, ownership transfer, merge, and deletion remain
separate reviewed workflows and are not granted by this matrix.

ADMIN may read billing state but cannot assign a Plan or transition a
Subscription. OWNER billing capabilities manage current entitlement only;
Subscription is not a ledger.

### BackgroundJob separation

`BACKGROUND_JOB_ENQUEUE` authorizes an explicit allowlisted enqueue use case; it
does not allow an arbitrary queue, job type, payload, Organization, or logical
entity.

A domain service may enqueue required follow-up work as an internal,
invariant-controlled consequence of a domain capability without granting the
caller a generic enqueue capability.

Claim, completion, failure, cancel, and retry use
`BACKGROUND_JOB_MANAGE` through WorkerContext, expected job state, scope, lock
ownership, and attempt policy. No Membership role receives it.

### Platform separation

Platform administration bypasses tenant-role evaluation only inside dedicated
platform services using PlatformAdminContext and an explicit platform
permission.

Platform services must not:

- fabricate Membership;
- pass `skipAuthorization`;
- reuse OWNER as a global role;
- treat platform scope as unrestricted tenant access; or
- omit required reason, correlation, tenant isolation, and audit controls.

### Public and invitation exceptions

Public Passport, QRCode, public Document, and ScanEvent operations use
PublicContext plus publication eligibility, not Membership permissions.

CreateOrganization is an authenticated onboarding bootstrap use case. It
creates the initial OWNER Membership transactionally and therefore cannot
require a pre-existing tenant permission.

AcceptInvitation is authorized by authenticated User identity, valid single-use
invitation evidence, normalized email match, invitation state, and
Organization eligibility. It does not require an existing Membership
permission.

## Application Service Mapping

The following mapping defines the normal minimum capability. Each service also
applies trusted-context, resource, invariant, concurrency, transaction, and
audit policy.

| Application service/use case | Required permission or authorization policy |
| --- | --- |
| CreateOrganization | Authenticated onboarding bootstrap policy; no pre-existing Membership permission. |
| ReadOrganization | `ORGANIZATION_READ` |
| UpdateOrganization | `ORGANIZATION_UPDATE`; sensitive lifecycle operations remain outside this capability. |
| ListMembers | `MEMBERSHIP_READ` |
| InviteMember / RevokeInvitation | `MEMBERSHIP_INVITE` plus grant-ceiling policy. |
| AcceptInvitation | Invitation acceptance policy; no existing Membership permission. |
| ChangeMembershipRole / ChangeMembershipStatus | `MEMBERSHIP_UPDATE` plus grant-ceiling and last-OWNER policy. |
| RemoveMembership | `MEMBERSHIP_REMOVE` plus self-action and last-OWNER policy. |
| ReadProduct / ReadProductVersion | `PRODUCT_READ` |
| CreateProduct | `PRODUCT_CREATE` |
| CreateDraft / UpdateDraftContent | `PRODUCT_EDIT` plus editable-version policy. |
| PublishProduct | `PRODUCT_PUBLISH` plus complete publication policy. |
| ArchiveProduct | `PRODUCT_ARCHIVE` |
| RestoreProduct | `PRODUCT_RESTORE` |
| ReadDocument | `DOCUMENT_READ` plus storage-delivery policy. |
| RegisterDocumentUpload / FinalizeDocumentUpload | `DOCUMENT_UPLOAD` |
| AssociateProductDocument / RemoveProductDocument | `DOCUMENT_ASSOCIATE` plus same-tenant and editable-version policy. |
| AddProductImage | `DOCUMENT_UPLOAD` and `PRODUCT_EDIT` |
| SetPrimaryProductImage | `PRODUCT_EDIT` plus primary-image transaction policy. |
| DeleteDocument | `DOCUMENT_DELETE` plus reference, retention, and storage policy. |
| UpdatePassportState | `PASSPORT_MANAGE` |
| RegenerateQRCode | `QRCODE_REGENERATE` plus stable-public-target policy. |
| ResolvePublicPassport / ResolvePublicDocument | PublicContext and publication/public-visibility policy. |
| RecordScanEvent | PublicContext, privacy-minimized ingestion, and abuse-control policy. |
| ReadScanAnalytics | `SCAN_ANALYTICS_READ` |
| ReadAuditLog | `AUDIT_READ` |
| ReadNotifications | `NOTIFICATION_READ` plus User/Organization visibility policy. |
| MarkNotificationRead / DismissNotification | `NOTIFICATION_MANAGE` plus caller-visible notification policy. |
| CreateNotification | `NOTIFICATION_CREATE` plus target-User and safe-routing policy. |
| ReadIntegrationMapping | `INTEGRATION_READ` |
| CreateIntegrationMapping / TransitionIntegrationMapping | `INTEGRATION_MANAGE` plus identity, provider, and lifecycle policy. |
| EnqueueBackgroundJob | `BACKGROUND_JOB_ENQUEUE` plus allowlisted job/scope/deduplication policy. |
| ReadBackgroundJob | `BACKGROUND_JOB_READ` plus tenant scope. |
| ClaimBackgroundJob / CompleteBackgroundJob / FailBackgroundJob | WorkerContext, `BACKGROUND_JOB_MANAGE`, scope, attempt, state, worker, and lock policy. |
| ReadBilling | `BILLING_READ` |
| AssignPlan | `PLAN_ASSIGN` plus Plan eligibility and entitlement policy. |
| TransitionSubscription | `SUBSCRIPTION_MANAGE` plus lifecycle and cancellation policy. |
| CheckEntitlement | Internal policy evaluation for the requested domain use case; direct billing display additionally requires `BILLING_READ`. |
| ManageGlobalPlan | PlatformAdminContext and `PLATFORM_PLAN_MANAGE`. |
| PlatformOrganizationOperation | PlatformAdminContext and `PLATFORM_ORGANIZATION_MANAGE`. |
| PlatformJobOperation | PlatformAdminContext and `PLATFORM_JOB_MANAGE`. |
| PlatformSupportRead | PlatformAdminContext and `PLATFORM_SUPPORT_READ` plus purpose, minimization, reason, and audit policy. |

No service may convert a broader permission into unrestricted CRUD. The
operation name, input contract, active tenant, resource state, and invariant
checks bound every capability.

## Permission Evaluation Flow

The conceptual flow is:

```txt
Resolve trusted context
        ↓
Resolve and validate Membership
        ↓
Resolve canonical permissions
        ↓
Evaluate tenant ownership and resource state
        ↓
Evaluate business invariants and concurrency
        ↓
Execute the use-case service and required audit
```

For authenticated private services:

1. The Context Resolver authenticates the User and resolves an ACTIVE
   Membership in an eligible Organization.
2. The Permission Policy expands the exact Membership role to this canonical
   capability set.
3. The service requires the capability mapped to the use case.
4. Scoped persistence loads the resource within the trusted Organization.
5. Resource policy validates ownership, lifecycle, visibility, and any
   role-sensitive rule.
6. The service validates all applicable `SERVICE_INVARIANTS.md` obligations.
7. Concurrency-sensitive facts are revalidated inside the owned transaction.
8. The mutation and required AuditLog event commit atomically.
9. The service returns an explicit safe result or application error.

Public, worker, and platform services replace Membership resolution with their
own trusted context and policy. They do not manufacture a tenant role to enter
the private flow.

## Future Extensions

New use cases should reuse an existing capability when its authority and risk
are genuinely equivalent. A new stable capability is preferred when reusing an
existing name would broaden its meaning or make sensitive authority ambiguous.

Capability changes require:

- documented purpose and category;
- affected service mapping;
- role-matrix decision;
- grant and special-rule review;
- tenant, public, worker, and platform boundary review;
- unit tests for every role;
- integration tests for resource and cross-tenant behavior; and
- synchronized authorization documentation.

Capabilities may be added without changing the database because they are
application policy. Removing or renaming a capability requires a compatibility
review for services, tests, audit expectations, and operational tooling.

Future custom roles, per-Membership overrides, deny rules, delegated
administration, or database-backed permissions require separate product and
architecture review. They must not be simulated by adding undocumented
exceptions to this matrix.

## Non-Goals

This document does not define:

- JWT or provider claims;
- authentication providers;
- cookies or session storage;
- middleware or route guards;
- HTTP routes, methods, or status codes;
- API request or response formats;
- frontend menus, navigation, buttons, or UI visibility behavior;
- exact TypeScript permission implementation;
- Prisma queries or repository signatures;
- database permission tables, new enums, schema changes, or migrations;
- PostgreSQL RLS;
- worker runtime or queue provider;
- platform-administrator provisioning; or
- exceptional Organization deletion, merge, or ownership-transfer workflows.

Those concerns require subsequent focused design or implementation tasks.
