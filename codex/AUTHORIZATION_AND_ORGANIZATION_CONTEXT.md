# Passvero Authorization and Organization Context

## 1. Purpose and Scope

This document defines how future Passvero application services establish
trusted actor identity, active Organization context, Membership state, roles,
permissions, and tenant-scoped authorization.

It is the authorization contract for private application services. It also
defines the separation between authenticated user, public, worker, and
platform-administration authorization contexts.

This contract ensures that:

- client-supplied ownership and actor identity are never authoritative;
- every private operation executes in an explicit trusted Organization context;
- Membership eligibility and permission checks are consistent;
- cross-tenant reads and writes are denied without leaking resource existence;
- application services remain independent from HTTP, UI, session storage, and
  the future authentication library; and
- public, worker, and platform authority cannot be confused with tenant
  Membership authority.

This is a provider-neutral design. It does not select or configure
authentication, implement authorization, or define a concrete service API.

## 2. Authoritative Contracts

Authorization design must preserve these contracts:

1. Database Architecture Freeze v1.0 and the applied Prisma schema define the
   approved tenant, ownership, relation, role, and status model.
2. `SERVICE_INVARIANTS.md` defines mandatory tenant, ownership, authorization,
   lifecycle, and repository obligations.
3. `APPLICATION_SERVICES_ARCHITECTURE.md` defines trusted context, service,
   transaction, persistence, DTO, and error boundaries.
4. Approved ADRs define server-side Organization authorization, stable public
   access, aggregate ownership, and public Passport relationships.

The exact implemented identity values are:

- `MembershipRole`: OWNER, ADMIN, EDITOR, VIEWER.
- `MembershipStatus`: ACTIVE, SUSPENDED, REMOVED.
- `OrganizationStatus`: ACTIVE, SUSPENDED, DEACTIVATED, PENDING_DELETION.

No new role, Membership status, Organization status, ownership relation, or
database permission model is introduced here.

`DATABASE_ARCHITECTURE.md`, `DOMAIN_RULES.md`, `PRISMA_DOMAIN_MODEL.md`, and
`IMPLEMENTATION_ROADMAP.md` provide supporting context. Where an older status
marker predates the approved Freeze, the Freeze governs. This precedence does
not reopen or modify a database or ADR decision.

If implementation reveals a requirement that cannot be satisfied without a
schema or ADR change, work must stop and enter the reviewed architecture
process.

## 3. Authorization Principles

- **Deny by default.** Access exists only when a use-case-specific policy
  grants it.
- **Server-derived authority.** Authentication, active Organization,
  Membership, role, permissions, worker identity, and platform authority come
  from trusted server evidence.
- **Explicit tenant scope.** Every private service receives one trusted active
  Organization context. It never reads a global mutable current Organization.
- **Use-case-specific capability.** Services authorize the capability required
  for the operation, then validate resource state and service invariants.
- **Authorization before mutation.** A row, UUID, foreign key, logical
  reference, route parameter, or UI control is not authority.
- **Scoped loading.** Private resources are loaded within authorized tenant
  scope or through their approved ownership path.
- **Safe disclosure.** Cross-tenant resource existence and identifiers are not
  disclosed through errors, timing-dependent branches, or response details.
- **Context separation.** Authenticated users, public callers, workers, and
  platform administrators use different trusted contexts.
- **Transport independence.** Services receive trusted context; they do not
  parse cookies, sessions, headers, middleware state, or HTTP requests.
- **Deterministic policy.** Permission evaluation is centralized, explicit, and
  testable without Next.js or an authentication provider.
- **Defense in depth.** Service authorization, scoped persistence, database
  constraints, tests, and future least-privilege runtime roles reinforce one
  another.

## 4. Trusted Context Types

Trusted contexts are resolved results, not raw session or request payloads.
Their conceptual fields are server-derived and limited to what the use case
needs. This design defines exactly four context types.

### AuthenticatedUserContext

Used for normal signed-in user operations.

It conceptually contains:

- User ID;
- active Organization ID;
- Membership ID;
- exact Membership role;
- exact Membership status;
- correlation ID; and
- authentication time or assurance metadata only if a later use case requires
  it.

The active Organization and Membership are resolved and validated server-side.
No value copied from client input becomes authoritative merely because it is
placed in a session-shaped object.

This context proves the authorization facts established at resolution time. It
does not freeze them indefinitely. Services must revalidate concurrency-
sensitive Membership, owner-set, Organization, permission, or resource state
inside the business transaction where required.

### PublicContext

Used for unauthenticated public Passport, QRCode, public Document, and
privacy-minimized scan operations.

It may contain:

- correlation ID;
- safe operational request-origin classification; and
- privacy-minimized ingestion context required by the public operation.

It never contains or implies:

- Organization authority;
- Membership;
- private resource access;
- trusted User identity; or
- permission to select draft or private data.

Public ownership is derived from a stable public identifier and the frozen
database relations. Caller-supplied Organization, Product, Passport, Document,
or visibility values do not grant public access.

### WorkerContext

Used for trusted background infrastructure.

It conceptually contains:

- verified worker identity;
- BackgroundJob ID;
- exact job scope;
- Organization ID only for an ORGANIZATION-scoped job;
- correlation ID; and
- current execution attempt and lock context where required.

Worker trust establishes infrastructure identity, not unrestricted database
authority. Worker services still validate job status, attempt, scope,
Organization ownership, logical entity context, worker lock ownership, and
payload allowlists. An Organization-scoped job cannot access another tenant.

### PlatformAdminContext

Used only for explicitly approved platform-level operations.

It conceptually contains:

- authenticated platform actor identity;
- explicitly approved platform permission or role;
- correlation ID; and
- safe operational reason or context when a sensitive action requires it.

Platform administration is separate from tenant Membership. Privileges are
narrow, purpose-specific, and cannot be constructed from ordinary client input.
There is no generic super-admin context, fake Membership, or implicit all-
tenant access.

Sensitive platform mutations require audit history. Step-up authentication may
be required by future authentication infrastructure, but this document does
not define its mechanism.

## 5. Organization Context Resolution

For a private user operation, the trusted context resolver performs this
conceptual sequence:

1. Authenticate the User from trusted server evidence.
2. Resolve the requested or currently selected Organization from a
   server-controlled selection flow.
3. Load Membership using both the authenticated User ID and selected
   Organization ID.
4. Verify that Membership exists and has an eligible status.
5. Verify that the Organization is eligible for the requested context.
6. Resolve the exact Membership role and use-case permissions.
7. Build `AuthenticatedUserContext`.
8. Pass only that trusted result and the validated command to the application
   service.

An Organization selector may originate from:

- an explicit switch completed through a trusted server flow;
- a persisted active-Organization preference;
- a route Organization slug or ID treated only as an untrusted selector and
  resolved server-side; or
- a single eligible Organization default.

Every mechanism ends with the same Membership and Organization validation. A
caller gains no authority by naming another Organization.

Normal private context requires an ACTIVE Membership and an Organization
eligible for normal operation. A missing, stale, inaccessible, suspended,
deactivated, pending-deletion, archived, or otherwise ineligible selection is
not reused. It is cleared or rejected safely.

The exact exceptional read or recovery capabilities for SUSPENDED,
DEACTIVATED, or PENDING_DELETION Organizations are not fully approved. They
must be defined in a focused Organization lifecycle and permission policy
before such workflows are implemented. Until then, these states do not
establish normal private user context.

Context resolution does not authorize a resource mutation by itself. The
service must still authorize the use case and load the resource within the
resolved Organization.

## 6. Membership Eligibility

Membership eligibility uses only the implemented statuses.

### ACTIVE

- May establish `AuthenticatedUserContext` when the Organization is eligible.
- May perform normal private reads allowed by resolved permissions.
- May perform mutations allowed by resolved permissions and resource policy.
- May access retained historical data only when the use case and permission
  permit it.
- Must be revalidated for concurrency-sensitive Membership and owner changes.

### SUSPENDED

- Does not establish normal `AuthenticatedUserContext`.
- Cannot perform normal private reads or mutations.
- Does not regain access through a stale Organization selection or cached
  permission result.
- May be viewed or changed as a retained Membership record only by another
  eligible actor through a purpose-specific administrative or recovery
  workflow.
- Does not erase historical attribution.

### REMOVED

- Does not establish `AuthenticatedUserContext`.
- Cannot perform normal private reads or mutations.
- Cannot be treated as pending, suspended, or active.
- May remain visible as retained historical Membership data to an authorized
  actor where the approved use case requires it.
- Does not erase historical actor or AuditLog meaning.

Normal operations require ACTIVE. Any future self-service recovery or retained
data access for an ineligible former member requires an explicit product and
authorization decision; it must not be inferred from the retained Membership
row.

## 7. Roles and Permission Policy

Passvero retains the exact stored roles:

- OWNER
- ADMIN
- EDITOR
- VIEWER

Roles are stored Membership identity. Permissions are application-policy
capabilities derived from trusted context, role, Organization eligibility, and
the requested use case.

Services authorize permissions rather than scattering direct role comparisons.
A centralized, deterministic policy maps an exact role to explicit
capabilities. Resource policies then apply tenant ownership, lifecycle,
visibility, and invariant checks.

The permission vocabulary must consider at least:

- `ORGANIZATION_READ`
- `ORGANIZATION_MANAGE`
- `MEMBERSHIP_INVITE`
- `MEMBERSHIP_MANAGE`
- `PRODUCT_READ`
- `PRODUCT_CREATE`
- `PRODUCT_EDIT`
- `PRODUCT_PUBLISH`
- `PRODUCT_ARCHIVE`
- `DOCUMENT_READ`
- `DOCUMENT_MANAGE`
- `PASSPORT_MANAGE`
- `ANALYTICS_READ`
- `AUDIT_READ`
- `BILLING_READ`
- `BILLING_MANAGE`
- `INTEGRATION_MANAGE`
- `NOTIFICATION_READ`
- `PLATFORM_PLAN_MANAGE`

These names are conceptual. They are not database values and do not require a
permission table or schema change. `PLATFORM_PLAN_MANAGE` belongs to explicit
platform policy, not ordinary tenant role authority.

The exact OWNER, ADMIN, EDITOR, and VIEWER capability matrix has not been
approved. It must be defined in
`codex/AUTHORIZATION_PERMISSION_MATRIX.md` before Membership or protected
domain services are implemented.

Until that matrix exists:

- no service may infer permissions from role names beyond already approved
  invariants such as last-owner protection;
- UI visibility is not authorization;
- sensitive operations require both a granted capability and resource-state
  checks; and
- permission evaluation must remain pure, deterministic, and independently
  testable.

## 8. Role Grant and Last-Owner Rules

Role and Membership-status changes are purpose-specific use cases, not generic
Membership updates.

Every role or status mutation must:

- load the actor and target Membership in the same Organization;
- require the exact capability defined by the approved permission matrix;
- verify that the actor may grant or remove the target authority;
- prevent an actor from granting permissions beyond their own authority;
- apply explicit rules to OWNER-level changes;
- preserve historical attribution; and
- append an AuditLog event when required.

The Organization must retain at least one ACTIVE OWNER. Removal, suspension,
demotion, self-removal, and self-demotion of an OWNER all use the same
protection.

The service must serialize or transactionally revalidate the active OWNER set
and apply the Membership change conditionally. Two individually valid
concurrent operations must not commit a zero-owner result.

The exact role grant hierarchy is intentionally deferred to the permission
matrix. No numeric role ranking or implicit OWNER > ADMIN > EDITOR > VIEWER
algorithm is approved by this document.

## 9. Tenant-Scoped Resource Loading

Private services must scope resource loading to the trusted Organization from
the start. They must not load a row by ID alone, compare ownership afterward,
and return distinguishable errors that reveal cross-tenant existence.

Conceptual lookup boundaries use:

- resource identity plus trusted Organization identity;
- parent identity plus the approved Organization ownership path; or
- stable public identity plus publication eligibility in dedicated public
  services.

Required ownership patterns include:

- **Product:** load by Product identity and trusted `organizationId`.
- **ProductVersion:** load within trusted Organization and verify its Product
  belongs to the same Organization; service invariants still require
  ProductVersion and Product ownership equality.
- **Document:** load by Document identity and trusted `organizationId`.
- **ProductDocument:** load through ProductVersion ownership and independently
  validate Document ownership before association, mutation, or delivery.
- **Passport:** load within trusted Organization and verify Product ownership.
- **Notification:** scope by Organization and then apply optional User-target
  or Organization-wide visibility policy.
- **IntegrationMapping:** scope every read and transition by Organization.
- **BackgroundJob:** for ORGANIZATION scope, require matching scope and trusted
  `organizationId`; PLATFORM jobs use a separate worker/platform policy.

Inherited ownership follows the frozen aggregate path:

- ProductTranslation, ProductIdentifier, ProductMaterial, ProductDocument, and
  ProductImage through ProductVersion;
- QRCode through Passport; and
- ScanEvent through QRCode and Passport.

Logical `entityType` and `entityId` fields are never authorization. The service
must resolve and validate the referenced entity through its real ownership
path.

Repositories expose narrow scoped persistence operations but do not decide
whether an actor is authorized.

## 10. Cross-Tenant Denial Rules

Every private operation denies by default:

- another tenant's resource ID;
- another tenant's parent-child combination;
- another tenant's Document or storage asset;
- a logical reference outside the active Organization;
- cross-tenant actor attribution;
- an Organization supplied only by the caller;
- a worker job or payload that names a resource outside its trusted scope; and
- an administration tool that lacks an explicit platform use case.

Cross-tenant denial applies to reads, writes, bulk operations, imports, workers,
administration tools, maintenance scripts, storage delivery, analytics, and
future integrations.

The service must not reveal whether the rejected ID exists for another tenant.
Protected diagnostics may record a safe reason and correlation ID, but they
must not log secrets or expose cross-tenant identifiers to the caller.

A cross-tenant relation cannot be made valid by independent foreign keys. For
example, ProductDocument creation rejects independently valid
ProductVersion/Document rows when their Organizations differ.

## 11. Error Disclosure Policy

Authorization uses stable application errors independent from HTTP.

### UNAUTHENTICATED

Used when a private operation has no valid authenticated user context.

### FORBIDDEN

Used when the actor is known, the Organization context is valid and safe to
disclose, and the actor lacks the required use-case capability or approved
resource action.

Examples include an ACTIVE member attempting a known Organization operation
outside their role-derived permission.

### NOT_FOUND

Used for a tenant-scoped resource lookup that finds no resource in the
authorized scope. This includes another tenant's identifier when distinguishing
it from an absent identifier would create enumeration or tenant-disclosure
risk.

A missing or inaccessible Organization selection may also use safe
non-disclosure behavior rather than confirming another Organization exists.

### INVALID_STATE or CONFLICT

Used when the actor is authorized for the resource but the requested lifecycle,
concurrency, ownership combination, or idempotent retry is incompatible with
current state.

If one side of a proposed relation is outside tenant scope, the service must
not expose it merely to provide a more specific relation error.

Application services return safe error categories and codes. Presentation
adapters later map them to HTTP, Server Action, or UI behavior. Core
authorization never depends on a client interpreting an HTTP status.

Protected logs may retain safe diagnostic context under a correlation ID. They
must not expose Prisma messages, SQL details, Membership internals, provider
data, or another tenant's identifiers to the caller.

## 12. Public Authorization Model

Public operations do not use Membership authorization and never construct
`AuthenticatedUserContext`.

Public Passport resolution conceptually requires:

- a valid stable public route or code;
- an eligible Passport state;
- an eligible QRCode state when QR resolution is involved;
- a current PUBLISHED ProductVersion;
- an eligible Product and Organization; and
- explicit public DTO mapping.

Draft, SUPERSEDED-as-current, private, archived-as-ineligible, or otherwise
unpublishable content is excluded. A WITHDRAWN Passport may resolve to an
approved safe withdrawn/unavailable response, but it must not expose the
withdrawn Passport's protected content as an active public Passport.

Public Document access independently validates:

- eligible public Passport state;
- the current PUBLISHED ProductVersion;
- ProductDocument relationship to that version;
- `isPublic`;
- Document availability; and
- storage-delivery authorization.

An association row or storage key alone is not public authority. Public callers
cannot change eligibility by supplying Organization IDs, internal IDs, status,
or visibility flags.

Public output is explicitly allowlisted and excludes storage identity, private
Documents, draft data, internal IDs, team data, billing data, AuditLog data,
provider context, and operational payloads.

## 13. Worker Authorization Model

Worker services derive authority from both `WorkerContext` and the trusted
BackgroundJob state.

For an ORGANIZATION-scoped job:

- Organization ID comes from the trusted job, not its payload;
- the job scope and Organization relation must agree;
- all resource access remains scoped to that Organization;
- logical entity references are resolved and validated;
- expected status, current attempt, worker identity, and lock ownership match;
- payload and result fields are allowlisted; and
- job existence alone does not authorize arbitrary domain writes.

For a PLATFORM-scoped job:

- Organization ID is absent from the job;
- authority is limited to the explicit platform use case;
- platform scope is not a generic tenant bypass; and
- any per-Organization work re-establishes an isolated tenant boundary and is
  audited where required.

Worker code calls the responsible use-case service or an equivalent reviewed
invariant layer. It cannot use generic repository writes, impersonate a User,
or treat a payload-provided actor or Organization as trusted.

## 14. Platform Administration Model

Platform administration uses `PlatformAdminContext` and purpose-specific
platform services.

Required rules:

- platform actor identity and permission are independently authenticated;
- ordinary Membership does not create platform authority;
- normal tenant services are not invoked with fabricated Membership data;
- silent bypass parameters such as `skipAuthorization` are forbidden;
- each service grants only the minimum platform capability required;
- tenant-scoped effects remain isolated and validate affected ownership;
- sensitive mutations require safe reason and correlation tracking;
- sensitive mutations create AuditLog events where the current model supports
  tenant attribution; and
- operational logs supplement, but do not replace, domain audit history.

Platform-admin provisioning, step-up authentication, screens, and provider
configuration are future authentication infrastructure. They are not defined
here.

## 15. Actor Attribution

Actor and provenance fields are populated only from trusted context and
validated service state.

- Authenticated user operations use the trusted User ID.
- `createdBy`, `updatedBy`, `publishedBy`, `archivedBy`, `invitedBy`,
  `acceptedBy`, `withdrawnBy`, and similar values are never accepted as
  authoritative client fields.
- The service validates actor eligibility and Organization relationship where
  the operation requires it.
- Worker operations use worker/job context and do not impersonate arbitrary
  Users or copy a User ID from the job payload.
- Platform operations use the real platform actor where the current domain
  field or AuditLog User relation supports that identity.
- Public unauthenticated operations never fabricate a User actor.

Domain provenance fields answer who performed or owns a specific domain
transition where the frozen model supports that fact. AuditLog records the
significant business event, Organization, safe actor attribution, action,
entity, time, and minimized metadata. A use case may require both; neither is a
substitute for the other.

For system or worker actions without a valid User actor, AuditLog `actorId`
remains null and the normalized action, summary, correlation, and allowlisted
metadata preserve safe operational meaning. A worker must not use an arbitrary
User to avoid a null actor.

Historical User relations use `SetNull` where approved. Losing the foreign-key
actor does not authorize deleting or rewriting the historical operation or
AuditLog event.

## 16. Organization Switching

Changing active Organization changes trusted context, not resource ownership.

The switch flow must:

1. authenticate the User;
2. resolve the target Organization server-side;
3. load Membership by authenticated User and target Organization;
4. require ACTIVE Membership and eligible Organization state;
5. resolve the target role and permissions;
6. persist or return the new selection through a trusted server mechanism; and
7. construct a new `AuthenticatedUserContext` for subsequent requests.

Stale, removed, suspended, or unauthorized selections are cleared or rejected.
Supplying a target Organization is only a request to switch, never proof of
access.

In-flight operations keep the immutable context resolved for that invocation.
A later switch does not silently retarget a running service call.

No service may read a process-global, module-global, or client-global current
Organization. The active Organization is an explicit context dependency.

Switching must invalidate or partition authorization-sensitive cached data so
that private data from the previous tenant cannot appear in the new context.

The exact route, session, cookie, or persistence mechanism for selection is
deferred.

## 17. Caching and Authorization

Caching never becomes an authorization source.

- Private cache keys include every authorization-relevant scope, including
  Organization and resource identity and, where results differ, User,
  Membership, permission, or visibility context.
- Private tenant results are never stored under global or public cache keys.
- Public caches contain only explicit public DTOs produced after publication
  eligibility checks.
- Client-side caches do not prove Membership, permission, Organization, or
  current resource state.
- Membership suspension, removal, role changes, Organization ineligibility,
  Passport withdrawal, publication changes, and visibility changes must not
  leave unsafe long-lived access.
- Request-local context does not mutate when a global preference changes.
- Cached storage URLs or private asset results remain scoped and time-bounded
  according to later storage policy.

Exact invalidation, lifetime, tag, and Next.js data-cache behavior must be
reviewed at the presentation and API boundary. Until then, private authorization
results must not depend on a long-lived shared cache.

## 18. Audit Requirements

Application services decide audit requirements for significant authorized
mutations.

Events likely requiring AuditLog include:

- Organization creation, status, profile, and sensitive setting changes;
- invitation creation, revocation, and acceptance;
- Membership role and status changes;
- Product publication, archive, and restore;
- Passport withdrawal and reactivation;
- ProductDocument changes that affect public output;
- IntegrationMapping lifecycle transitions;
- Subscription and Plan-assignment changes; and
- sensitive platform-administration actions.

AuditLog is not required for every read, permission check, failed lookup, or
trivial notification view. Security monitoring may record protected operational
events separately without placing raw request data in AuditLog.

When AuditLog represents a database mutation, event insertion occurs in the
same transaction as that mutation. Organization and actor attribution come
from trusted context and loaded resources. Metadata remains minimized,
allowlisted, and secret-free.

Authorization failure logs must not create a cross-tenant disclosure channel or
store unbounded attacker input.

## 19. Authorization Component Boundaries

Authorization is divided into explicit conceptual components.

### Context Resolver

Transforms trusted authentication, session, worker, or platform evidence into
one of the four trusted contexts. It validates Membership and Organization
eligibility but does not perform the business mutation.

### Permission Policy

Maps exact role and context to use-case capabilities. It is deterministic,
provider-independent, and has no persistence side effects.

### Resource Authorization Policy

Evaluates tenant ownership, inherited ownership paths, public visibility,
lifecycle eligibility, worker scope, and use-case-specific access using facts
loaded for the operation.

### Application Service

Coordinates input validation, context use, capability checks, resource
authorization, service invariants, transaction, mutation, result mapping, and
AuditLog creation.

### Presentation Adapter

Parses external input, obtains the trusted context, invokes the application
service, and maps safe service results and errors. It does not own business
authorization.

### Repository

Performs narrow tenant-scoped and transaction-scoped persistence operations. It
does not determine whether the actor is authorized and exposes no generic
write bypass.

Passvero must not replace these boundaries with one universal
`authorize(anything)` function whose scope, policy, loading, and error behavior
are hidden. Small explicit policies with clear inputs are preferred.

## 20. Required Authorization Test Matrix

These tests are release gates for affected services.

### Context resolution

- valid ACTIVE Membership and eligible Organization produce the expected
  authenticated context;
- no Membership cannot establish context;
- SUSPENDED and REMOVED Membership cannot establish normal context;
- stale or ineligible Organization selection fails safely;
- authorized Organization switching changes context;
- mismatched User and Membership is rejected; and
- client-supplied role, Membership, actor, or Organization claims are ignored.

### Role and permission

- every role receives exactly the capabilities in the approved matrix;
- every non-granted capability is denied;
- forbidden elevation and over-grant are rejected;
- last ACTIVE OWNER cannot be removed, suspended, or demoted;
- self-removal and self-demotion use the same protection;
- concurrent owner changes cannot leave zero ACTIVE owners; and
- sensitive Membership mutations create required audit events.

### Tenant isolation

- same-tenant access succeeds when permission and state allow it;
- cross-tenant read returns safe non-disclosure behavior;
- cross-tenant mutation is denied;
- mixed-parent and ProductDocument ownership relations are rejected;
- logical references do not bypass real ownership;
- cross-tenant actor attribution is rejected; and
- imports, workers, platform tools, and maintenance paths enforce equivalent
  isolation.

### Public access

- eligible current published Passport succeeds;
- draft content, protected content behind a WITHDRAWN Passport, content for an
  ineligible Product or Organization, and private content are excluded;
- a withdrawn/unavailable response exposes no protected Passport content;
- public Document access revalidates publication, association, `isPublic`,
  availability, and storage authorization; and
- storage identity and private metadata remain hidden.

### Worker

- a correctly claimed ORGANIZATION job accesses only its Organization;
- another Organization's resource is denied;
- wrong worker or lock owner cannot transition the job;
- invalid scope and logical entity context are rejected;
- job payload cannot grant authority; and
- PLATFORM scope does not become unrestricted tenant access.

### Platform administration

- valid explicit platform permission authorizes only its approved use case;
- an ordinary User cannot construct platform context;
- fake Membership and bypass flags do not exist;
- sensitive mutation creates required audit history; and
- tenant-scoped effects remain isolated.

### Error disclosure

- cross-tenant existence is not revealed;
- UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, INVALID_STATE, and CONFLICT follow the
  documented policy;
- presentation-independent application errors contain only safe data;
- correlation IDs support protected diagnostics; and
- Prisma, SQL, stack, provider, and internal authorization details never escape.

The applicable authorization tests supplement, and do not replace, the
integration-test release gates in `SERVICE_INVARIANTS.md`.

## 21. Non-Goals

This document does not define:

- an authentication provider or Auth.js/NextAuth configuration;
- session storage or session payload shape;
- cookie names or contents;
- middleware;
- exact route structures;
- exact TypeScript interfaces;
- exact Prisma queries;
- UI visibility or navigation rules;
- RLS policies;
- API response formats or HTTP status mappings;
- new database schema, roles, statuses, fields, or permission tables;
- platform-administrator User provisioning;
- concrete permission implementation code;
- cache APIs or Next.js cache configuration; or
- exceptional Organization lifecycle and recovery workflows.

These require subsequent focused design or implementation tasks.

## 22. Next Design Steps

Create the following focused artifacts in order:

1. `codex/AUTHORIZATION_PERMISSION_MATRIX.md`
   - exact OWNER, ADMIN, EDITOR, and VIEWER capability mapping;
   - use-case capability definitions;
   - grant and sensitive-operation rules.
2. `codex/APPLICATION_ERROR_CONTRACT.md`
   - stable application error codes;
   - safe error payload and disclosure rules.
3. `codex/TRANSACTION_AND_PERSISTENCE_BOUNDARIES.md`
   - Prisma transaction ownership;
   - transaction-scoped persistence and narrow repository operations.
4. Product Application Service Design.

The next document should be `codex/AUTHORIZATION_PERMISSION_MATRIX.md`. No
follow-up artifact is created by this task.
