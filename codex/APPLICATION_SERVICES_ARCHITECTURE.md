# Passvero Application Services Architecture

## 1. Purpose and Scope

This document defines the shared architecture for Passvero application
services after Database Architecture Freeze v1.0. It is the common contract for
future use-case implementation, not an implementation plan for one service.

Application services translate trusted commands into authorized, consistent
business outcomes. They:

- enforce `SERVICE_INVARIANTS.md`;
- authorize tenant-scoped operations;
- own business transaction boundaries;
- coordinate narrow persistence operations;
- define concurrency and idempotency behavior;
- return stable service results and safe errors; and
- remain independent from presentation and provider technologies.

Application services represent business use cases, not database tables.
Passvero must not recreate generic CRUD around frozen persistence models.

This task creates an architecture contract only. It does not authorize service,
repository, API, route, adapter, worker, or schema implementation.

## 2. Authoritative Contracts

Application-service design must preserve these contracts:

1. Database Architecture Freeze v1.0 and the applied Prisma schema define the
   approved persistence architecture.
2. `SERVICE_INVARIANTS.md` defines mandatory application-owned invariants and
   production release gates.
3. Approved decisions in `DECISIONS.md` define cross-layer architectural
   choices.
4. The applied migrations define database behavior that Prisma alone cannot
   express, including CHECK constraints and partial unique indexes.

`DATABASE_ARCHITECTURE.md`, `DOMAIN_RULES.md`, and
`IMPLEMENTATION_ROADMAP.md` provide supporting implementation context. If a
supporting status marker predates the approved Freeze, the approved Freeze
governs. This precedence does not reopen or alter a database decision.

The database contract and service contract are complementary:

- PostgreSQL guarantees structural integrity, referential actions, uniqueness,
  CHECK constraints, and approved index behavior.
- Application services guarantee authorization, tenant isolation, ownership
  equality, lifecycle legality, workflow correctness, and transactional
  business consistency.

No service may weaken a database constraint or treat successful persistence as
proof that a business operation was valid. A conflict that genuinely requires
a schema or ADR change must stop implementation and enter the formal
architecture review process.

## 3. Architectural Principles

### Use-case-oriented services

A service describes one cohesive business outcome. Suitable names include
`CreateProduct`, `CreateProductDraft`, `PublishProduct`,
`AssociateProductDocument`, and `AcceptInvitation`, with a consistent
repository-wide naming convention selected during implementation.

Services must not be table-oriented facades. Guarded aggregates must not expose
unrestricted `create`, `update`, `upsert`, `delete`, or `save` operations.

### Layer independence

Core application services receive validated typed input, a trusted execution
context, and explicit application-owned dependencies. They do not depend on:

- HTTP requests, cookies, headers, or Next.js route objects;
- React components, UI state, form objects, or localization rendering;
- queue, storage, billing, notification, or integration provider SDKs; or
- concrete worker runtimes.

Route handlers, Server Actions, public pages, workers, and provider handlers
are adapters. They translate external mechanisms into service input and
translate service results into their own protocol.

### Explicit dependencies

Persistence, transaction coordination, clocks, identifier generation, and
external capabilities are injected through narrow application-owned
interfaces. Dependencies must reveal what a use case can do. A broad database
client or provider SDK must not become an implicit service locator.

### Authorization before mutation

Services load resources in tenant scope, verify permissions and lifecycle
state, and mutate only after validation. A valid UUID, a row that exists, or a
foreign key that resolves is not authorization.

### Pragmatic boundaries

Passvero should use enough separation to protect invariants and enable testing,
without adding framework layers that merely forward calls. Pure policies and
value normalization are shared when they express one rule; speculative
abstractions are not.

## 4. Trusted Execution Contexts

A trusted execution context contains server-derived identity and operational
facts required by a use case. It is created by a trusted adapter before the
service is called. Client input may select a requested operation, but it cannot
authoritatively populate actor or tenant identity.

Shared context data may include:

- correlation ID;
- invocation origin;
- trusted clock or request timing context where needed; and
- narrowly resolved permissions relevant to the operation.

Passvero uses distinct context kinds rather than one permissive actor object.

### Authenticated user context

Contains the authenticated User ID, active Organization ID, Membership ID, and
resolved role or permissions required by the use case. The authentication
adapter derives these values from the server session and current membership.
Services still verify resource ownership and any concurrency-sensitive
membership state.

### Public context

Represents an unauthenticated public invocation. It may contain a correlation
ID, safe request-origin classification, and abuse-control outcome. It contains
no trusted Organization, Product, Passport, or User ownership claim. Dedicated
public services derive eligibility by resolving stable public identifiers.

### Trusted worker context

Contains a verified worker identity, invocation origin, and the specific job
scope and lock context needed by the operation. For Organization-scoped work,
the Organization is derived from the claimed job or trusted scheduler input,
then revalidated. Worker trust does not grant unrestricted tenant access.

### Platform-administration context

Contains a verified platform administrator identity, explicitly resolved
platform permission, correlation ID, and operational reason where required.
Platform administration is a separate authority boundary, not an OWNER role
with global reach and not a generic bypass around service invariants.

Context construction, authentication-library integration, and session storage
belong to later authorization design. Services depend only on the trusted
context contract.

## 5. Service Responsibilities

A use-case service is responsible for the complete business decision:

1. accept an explicit command DTO and the required trusted context;
2. perform service-boundary input validation where needed;
3. load resources through tenant-scoped persistence operations;
4. authorize the actor and requested action;
5. validate lifecycle, ownership, readiness, and other service invariants;
6. establish the required transaction and revalidate volatile conditions;
7. execute narrow persistence operations;
8. append required audit history in the same transaction;
9. map persistence output to an explicit service result; and
10. return a stable result or safe application error.

Services also define:

- transaction ownership;
- expected concurrency behavior;
- idempotency semantics;
- external side-effect coordination;
- audit obligations; and
- output visibility.

Services do not parse HTTP, decide status codes, render localized messages,
query browser state, or expose raw persistence records.

## 6. Validation and Authorization Layers

Passvero separates three validation layers.

### 1. Input validation

Input validation establishes syntax, shape, allowed fields, basic formats, and
bounded sizes. Presentation adapters normally validate untrusted data with
Zod, reject unexpected fields where practical, and pass a typed command to the
service. A service must not assume that a TypeScript type makes data trusted
when it can be called from multiple adapters.

Input validation does not establish identity, ownership, permission, resource
existence, or workflow legality.

### 2. Authorization and tenant validation

Authorization resolves:

- which actor or infrastructure principal is calling;
- which Organization scope applies;
- whether Membership and permissions are sufficient;
- whether the resource belongs to that Organization; and
- whether the resource is visible through this private, public, worker, or
  platform context.

Tenant-scoped resources are loaded using the derived Organization whenever the
model carries direct ownership. For inherited ownership, the persistence query
must traverse the approved aggregate path. UI visibility is never
authorization.

### 3. Business invariant validation

Business validation enforces:

- lifecycle transitions and chronology;
- ownership equality between independently valid rows;
- aggregate mutability and publication readiness;
- one-primary and contextual multiplicity rules;
- cross-aggregate workflow rules;
- limit and entitlement rules;
- concurrency expectations; and
- idempotency compatibility.

The service owns these decisions. Persistence helpers may return the facts
needed to decide them but must not silently invent policy.

## 7. Transaction Boundaries

The top-level application service owns the business transaction. A transaction
is required whenever multiple reads or writes must form one invariant-preserving
state transition, including the mandatory cases in
`SERVICE_INVARIANTS.md`.

The transaction boundary follows this pattern:

1. parse and validate external input before opening the transaction;
2. perform preliminary context and permission checks;
3. open one Prisma transaction through an application-owned transaction
   coordinator;
4. pass the transaction-scoped persistence capability explicitly to all
   participating persistence operations;
5. re-read or conditionally validate ownership, expected state, and other
   concurrency-sensitive facts inside the transaction;
6. perform the complete business mutation and required AuditLog insertion; and
7. commit only when the resulting state satisfies every invariant.

Repositories and adapters must not start hidden independent transactions for
steps in a larger use case. A helper may own a transaction only when it is
itself the top-level use-case coordinator and that ownership is explicit.

The Prisma transaction client remains an infrastructure detail. Application
code should pass a transaction-scoped persistence session or unit-of-work
capability rather than import Prisma throughout the service layer. The final
TypeScript shape belongs to the transaction and persistence boundary design.

Slow external calls must not run inside a database transaction. Storage,
billing, queue, notification, and integration calls are coordinated by:

- validating and persisting an explicit recoverable state where the frozen
  model supports it;
- making the external call outside the database transaction;
- resuming through an idempotent service command; and
- recording success or failure through another explicit transition.

If reliable coordination requires new persistence infrastructure, it needs a
separate reviewed design and, where applicable, migration. This document does
not introduce an outbox, inbox, event ledger, or new workflow table.

## 8. Persistence and Repository Boundaries

Persistence code isolates Prisma queries and database-specific operations. It
exposes narrow operations that support a use case, for example:

- find a Product in an Organization scope;
- create the initial ProductVersion;
- assign a current draft only when the expected state still holds;
- acquire the Product state needed for publication;
- append an AuditLog event; or
- claim an eligible BackgroundJob conditionally.

These examples express intent; they are not prescribed method signatures.

Persistence helpers:

- accept explicit tenant, identity, and expected-state data;
- select only the fields the service needs;
- preserve Prisma transaction scope supplied by the service;
- express conditional mutations and database conflicts accurately;
- map known database outcomes to internal persistence outcomes; and
- remain server-only.

Persistence helpers do not:

- decide whether an actor is authorized;
- derive tenant identity from client input;
- expose unrestricted writes for guarded models;
- return Prisma models as public or presentation DTOs;
- catch every database error and report success; or
- start hidden transactions that fragment a use case.

Raw Prisma access is confined to reviewed infrastructure modules. Imports,
workers, administrative tooling, maintenance scripts, and future APIs must use
the same service boundary or an equivalent reviewed invariant-validation
layer.

## 9. DTO and Mapping Boundaries

Passvero distinguishes these data shapes:

- **Command/input DTO:** validated data requested by a caller; excludes trusted
  actor and ownership fields.
- **Trusted service context:** server-derived identity, tenant, permissions,
  origin, and correlation facts.
- **Persistence record:** database-oriented shape returned by narrow Prisma
  selection.
- **Service result DTO:** stable use-case outcome independent of HTTP, UI, and
  Prisma.
- **Public DTO:** strict allowlist for unauthenticated Passport, Document, and
  related public reads.

Prisma-generated input and model types must not automatically become API input,
API response, public Passport, or UI form types. This prevents mass assignment,
provider leakage, schema-coupled interfaces, and accidental exposure when a
database field is added.

Mapping occurs at explicit boundaries. Public mapping excludes internal IDs,
draft content, private Documents, storage identity, team and billing data,
AuditLog metadata, provider context, and operational payloads. Private results
also return only what their use case needs.

## 10. Error Model

Application services return or throw one stable application error abstraction
with categories equivalent to:

- `VALIDATION`
- `UNAUTHENTICATED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `INVALID_STATE`
- `LIMIT_EXCEEDED`
- `RATE_LIMITED`
- `EXTERNAL_DEPENDENCY`
- `INTERNAL`

An application error carries:

- a stable application error code;
- a safe, non-localized core message or message key;
- optional safe field or path context;
- correlation ID where appropriate; and
- retryability classification when the caller can act on it.

The category describes service meaning, not transport behavior. The core layer
does not decide HTTP status codes, redirects, form-state encoding, queue retry
headers, or UI copy.

Known Prisma constraint and transaction outcomes are translated at the
persistence/application boundary into stable conflicts or transient internal
outcomes only when their meaning is understood. Unknown failures become
`INTERNAL`, retain the correlation ID for protected logging, and do not expose:

- Prisma messages or error codes;
- SQL, table, column, or constraint details;
- stack traces;
- credentials, tokens, provider payloads, or storage paths; or
- internal identifiers not intended for the caller.

`NOT_FOUND` and `FORBIDDEN` presentation may intentionally converge for
tenant-isolation purposes. That policy belongs to authorization and
presentation design while preserving accurate protected diagnostics.

## 11. Concurrency and Idempotency

Concurrency strategy is selected per use case. Approved mechanisms include:

- expected-state predicates and conditional updates;
- transaction revalidation;
- existing unique and partial unique constraints;
- explicit row locking where justified and supported;
- idempotency keys or stable single-use tokens;
- BackgroundJob deduplication keys; and
- bounded retry of known transient database conflicts when the entire operation
  is safe to retry.

No universal optimistic-lock version field is introduced. A database field,
index, or constraint that is not already approved requires separate review.

Required concurrency cases include:

- **Publication race:** only one transition for a Product may assign the next
  version and current pointers; a loser receives an idempotent result or
  conflict according to command identity.
- **Last-owner removal:** the active owner set is revalidated while the
  mutation is serialized; two concurrent removals cannot leave zero owners.
- **Invitation double acceptance:** the PENDING state and token are consumed
  once; compatible retries do not create another Membership.
- **Primary image replacement:** clearing the old primary and setting the new
  primary are one transaction with expected aggregate state.
- **BackgroundJob claim:** a conditional claim moves one eligible job to
  RUNNING for one nonblank worker identity and lock.
- **IntegrationMapping conflict:** existing external and internal identities
  are revalidated; generic upsert cannot silently remap either side.

Idempotency is required when a command can be retried by a client, worker, or
provider without knowing the prior outcome. It is mandatory for invitation
acceptance, publication retries, active BackgroundJob deduplication, and future
provider event processing.

An idempotent retry must represent the same logical command. Reuse of an
idempotency identity with materially different input is a conflict, not
success. Idempotency must not conceal failed authorization or an incompatible
state transition.

## 12. Audit Integration

The application service decides whether a business mutation requires an
AuditLog event. Events are appropriate for important organization, membership,
product, publication, Passport, Document, and similarly significant changes.
Reads and trivial state observations do not automatically create audit rows.

When an event represents a database mutation:

- the business mutation and AuditLog insertion occur in the same transaction;
- Organization and actor attribution come from trusted context and loaded
  resources;
- action and entity identity use approved normalization;
- metadata is small, allowlisted, and necessary to understand the event; and
- the event records no secrets, complete payloads, file contents, or raw
  request data.

AuditLog remains append-only. Audit insertion is a narrow persistence
operation, not a generic logging fallback and not a substitute for protected
operational logs.

## 13. Public Read Services

Public Passport, QR resolution, and public Document delivery use dedicated read
services. They do not reuse private dashboard queries and then remove fields
afterward.

Dedicated public services:

- resolve stable public identifiers rather than accepting Organization
  ownership claims;
- verify current published ProductVersion, active or approved Passport state,
  Organization eligibility, association visibility, and Document eligibility;
- return explicit public DTOs;
- preserve the Product → Passport → QRCode → ScanEvent ownership chain; and
- exclude storage identities, private metadata, billing data, team data,
  internal lifecycle details, drafts, and AuditLog data.

Public QR resolution returns or redirects only to the approved stable public
target. Public document delivery performs its own authorization and does not
treat an association row or storage key as public authority.

Public analytics ingestion is a separate command boundary. `RecordScanEvent`
accepts privacy-minimized observations, derives QRCode and tenant context from
the public identifier, applies abuse controls, and never becomes a private
tenant mutation service.

## 14. Worker and External Adapter Boundaries

Trusted worker services use the same invariant discipline as authenticated
services. They verify:

- PLATFORM or ORGANIZATION scope;
- Organization ownership for scoped work;
- logical entity compatibility;
- expected BackgroundJob status;
- worker and lock ownership;
- attempt and scheduling rules;
- idempotency and deduplication; and
- payload and result allowlists.

A worker context represents authenticated infrastructure, not unrestricted
database authority. Worker code must not call generic repositories or mutate
domain state without the responsible use-case service.

Storage, billing, notification, integration, and queue capabilities sit behind
application-owned ports. Infrastructure adapters implement those ports using
provider SDKs and translate provider-specific outcomes into safe
application-owned results.

Core services do not import provider SDKs, credentials, webhook request types,
or queue message types. Concrete adapter selection, retry configuration,
credential handling, and provider payload design belong to subsequent
provider-specific work.

## 15. Service Composition Rules

One top-level use-case coordinator owns the command, transaction, and final
result. Composition remains explicit:

- a coordinator may call pure domain policies and value normalizers;
- it may call narrow persistence operations and application-owned ports;
- it may reuse a helper that has no hidden transaction or external
  orchestration; and
- it may delegate a separate post-commit command when the boundary and
  idempotency behavior are explicit.

One stateful service should not casually call another stateful service. That
pattern can duplicate authorization, nest or split transactions, obscure audit
ownership, and create cycles. Shared logic belongs in a pure policy or a
narrowly defined collaborator where it represents the same rule.

Service dependencies must be acyclic. Cross-domain workflows have one
coordinator and explicit participants; they do not create mutual service
imports.

## 16. Proposed Module Structure

The repository currently uses a root `app/` directory for Next.js presentation
and `src/` for shared implementation. Future service work should preserve that
layout rather than moving routes solely for architectural symmetry.

```txt
app/
  api/                         # future HTTP adapters
  [locale]/                    # pages and future Server Action adapters

src/
  application/
    context/
    errors/
    transactions/
    identity/
    products/
    documents/
    passports/
    notifications/
    integrations/
    jobs/
    billing/

  domain/
    policies/
    values/

  infrastructure/
    persistence/
      prisma/
    storage/
    providers/

  components/                  # existing presentation components
  i18n/                        # existing localization infrastructure
  lib/                         # existing focused shared utilities
```

This is a proposed boundary, not permission to create these directories now.
Exact names should be finalized during the boundary design without creating a
parallel `src/server` and `src/application` architecture. The goal is one clear
server-only application path, not formal Clean Architecture ceremony.

Presentation adapters may live in the existing root `app/`. Application and
infrastructure modules that access private dependencies must be server-only.
Provider-neutral domain policies must not import Next.js or Prisma.

## 17. Initial Service Inventory

This inventory is a planning aid, not a final API or permission to implement
all services together.

### Identity

Likely MVP foundation:

- CreateOrganization
- InviteMember
- AcceptInvitation
- ChangeMembershipRole
- RemoveMembership

These use cases establish trusted Organization context and enforce invitation,
membership, and last-owner invariants.

### Product

Likely MVP:

- CreateProduct
- CreateDraft
- UpdateDraftContent
- PublishProduct
- ArchiveProduct
- RestoreProduct

Publication is a dedicated coordinator. It must not be implemented as a generic
ProductVersion status update.

### Documents and media

Likely MVP:

- RegisterDocumentUpload
- FinalizeDocumentUpload
- AssociateProductDocument
- RemoveProductDocument
- AddProductImage
- SetPrimaryProductImage

Storage registration/finalization and version associations remain distinct so
external storage work does not hold a database transaction open.

### Passport and public access

Likely MVP:

- UpdatePassportState
- ResolvePublicPassport
- ResolvePublicDocument
- RecordScanEvent

Public reads and analytics ingestion remain separate from authenticated tenant
services.

### Platform services

Later application capability:

- CreateNotification
- MarkNotificationRead
- CreateIntegrationMapping
- TransitionIntegrationMapping
- EnqueueBackgroundJob

Future infrastructure capability:

- ClaimBackgroundJob
- CompleteBackgroundJob
- FailBackgroundJob

The persistence models already exist, but provider delivery, integration
execution, queue selection, and worker runtime remain future infrastructure.

### Billing

Later in the MVP sequence:

- AssignPlan
- TransitionSubscription
- CheckEntitlement

Subscription represents current Organization entitlement, not billing history.
Provider event ingestion, checkout, invoices, payments, and historical
commercial evidence require separately reviewed future billing infrastructure.

Each service should be designed and delivered as a narrow vertical slice in the
approved roadmap order. Inventory names may change to a consistent service
naming convention without changing use-case boundaries.

## 18. Testing Strategy

Testing follows the boundary being verified.

### Pure unit tests

Use unit tests for deterministic policies and value behavior, including
normalization, lifecycle decisions, permission policy, error mapping, and
visibility selection. These tests need no Prisma mocking.

### Service tests

Test orchestration with controlled persistence and port dependencies where the
test is about decision order, dependency interaction, safe errors, or external
outcome handling. Test doubles must preserve the contract and must not make
transactional behavior appear safer than it is.

### PostgreSQL/Prisma integration tests

Use real integration behavior for:

- transaction commit and rollback;
- CHECK, foreign-key, unique, and partial-index interaction;
- conditional mutation and concurrency races;
- tenant isolation and cross-tenant rejection;
- publication, invitation acceptance, primary replacement, and BackgroundJob
  claim;
- append-only repository behavior; and
- every release-gate group in `SERVICE_INVARIANTS.md`.

Avoid excessive mocking of Prisma transactions where database isolation,
constraint timing, or concurrent outcomes are the subject.

### Adapter contract tests

Provider adapters must satisfy application-owned port contracts using safe,
normalized results. Contract tests cover error translation, idempotency
identity propagation, payload allowlists, and secret exclusion.

### Presentation tests

API, route, Server Action, and public-page tests are added with those adapters.
They verify input translation, trusted context construction, safe result/error
mapping, and output allowlists without duplicating service invariant tests.

A service is not production-ready until all applicable
`SERVICE_INVARIANTS.md` tests pass.

## 19. Security Requirements

- Tenant access is deny-by-default. Every authenticated private operation uses
  a server-derived Organization context and verifies resource ownership.
- Client-supplied Organization, User, actor, role, ownership, price,
  entitlement, or operational timestamp fields are never authoritative.
- Command DTOs use explicit fields; Prisma mutation inputs are not accepted
  directly. This prevents mass assignment.
- Public and private outputs use explicit allowlists.
- Persistence, provider, and transaction modules are server-only.
- Logs, errors, AuditLog metadata, job payloads, and provider results remain
  secret-free and data-minimized.
- Raw Prisma, SQL, storage, provider, or stack-trace details are never returned
  to clients.
- Worker and platform-administration contexts are explicit, narrow, and
  independently authorized.
- No generic administrative repository or maintenance bypass may evade service
  invariants.
- Public write-like operations, including scan ingestion, use validation and
  appropriate abuse controls; rate-limit decisions remain outside the core
  transport-independent service error model.
- A least-privilege runtime database role should reinforce append-only and
  repository boundaries in future production infrastructure. It supplements,
  but does not replace, service authorization.

## 20. Non-Goals

This document does not define:

- exact API routes, HTTP methods, status codes, or response envelopes;
- exact request or Zod schemas;
- exact UI flows, forms, Server Actions, or localization messages;
- concrete repository method signatures or Prisma query code;
- concrete transaction wrapper types;
- authentication library or session configuration;
- worker runtime, scheduler, cron, or queue provider;
- storage, billing, notification, or integration provider implementations;
- RLS policies or runtime database-role deployment;
- provider webhook schemas or billing history infrastructure;
- new tables, fields, indexes, constraints, migrations, or database
  redesign; or
- implementation order beyond the approved high-level next design steps.

These concerns require subsequent focused design and implementation tasks.

## 21. Definition of Done for a Service

A future application service is complete only when:

- its use-case purpose and input contract are explicit;
- trusted context requirements are explicit;
- input, authorization, tenant, and business invariant validation are enforced;
- the transaction boundary and transaction owner are defined;
- concurrency behavior is defined and tested;
- idempotency behavior is defined where applicable, including mismatched retry
  handling;
- persistence operations are narrow, tenant-aware, and transaction-compatible;
- external capabilities use application-owned ports;
- persistence and provider failures map to safe application errors;
- audit behavior is explicitly required or explicitly not required;
- service and public outputs are explicitly mapped and allowlisted;
- applicable unit, service, and PostgreSQL/Prisma integration tests pass;
- every applicable `SERVICE_INVARIANTS.md` release gate passes;
- no generic write or administrative bypass exists;
- secret-free logging and correlation behavior are defined; and
- relevant documentation is synchronized.

Passing compilation alone does not satisfy this definition.

## 22. Next Design Steps

Proceed through focused design tasks in this order:

1. Authorization and Organization Context Design
2. Error and Result Contract Design
3. Transaction and Persistence Boundary Design
4. Product Application Service Design
5. API Boundary Design for the first implemented use cases
6. Implementation

The next task should be **Authorization and Organization Context Design**. It
must define trusted context construction, Organization switching, membership
resolution, permission evaluation, and public/worker/platform separation
without implementing authentication or services yet.
