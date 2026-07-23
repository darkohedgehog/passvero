# Passvero Service Invariants

# Introduction

This document is the implementation contract for the Passvero
application-service layer after Database Architecture Freeze v1.0. It is not an
architecture document, database specification, or ADR.

PostgreSQL guarantees referential integrity, ownership references, uniqueness,
CHECK constraints, and structural consistency. Those guarantees establish that
stored rows are structurally valid; they do not establish that a business
operation was authorized or that independently valid rows belong to the same
tenant, aggregate, or workflow.

Authenticated application services guarantee business consistency,
transactional consistency, authorization, lifecycle transitions, tenant
isolation, and workflow correctness. These responsibilities intentionally
remain outside PostgreSQL where enforcement requires authenticated context,
cross-row comparisons, status-aware workflow, or coordination of multiple
aggregates.

Database Architecture Freeze v1.0 fixes the persistence contract. It does not
remove or defer the service obligations defined here. These invariants are
mandatory. Failure to implement an applicable invariant is a production defect.

# General Principles

- Derive the active User and Organization from the authenticated server
  context. Never trust client-supplied User, Organization, actor, or ownership
  identifiers.
- Scope every private read and mutation by the derived Organization and verify
  active Membership and required role before persistence.
- Authorize before mutation. A valid identifier or existing relation is not
  authorization.
- Validate the complete operation before changing state. Revalidate relevant
  rows inside the write transaction when concurrency can invalidate an earlier
  check.
- Execute every multi-row or lifecycle-sensitive mutation atomically. A failed
  transaction must preserve the prior valid state.
- Use server-controlled timestamps, normalized values, and actor attribution.
  Client-provided operational timestamps and normalized identity fields are not
  authoritative.
- Apply field-specific canonicalization consistently across services, imports,
  workers, administration tools, and maintenance scripts. Normalization must
  not erase intentionally case-sensitive identity.
- Prevent lost updates through an approved concurrency check. Do not silently
  overwrite a newer mutation.
- Keep public serializers explicit and allowlisted. Persistence records are not
  public DTOs.
- Repository writes must not bypass the reviewed application services or an
  equivalent reviewed invariant-validation layer.

# Identity

## Organization

- Organization-scoped operations require an active Membership in the target
  Organization and the permission required by the operation.
- Organization identity is derived from authenticated context and is included
  in every private lookup, update, archive, and delete predicate.
- Deactivation and deletion are authorized workflows. An Organization with
  retained or published data must not be hard-deleted through a generic write.
- Public Organization data is selected through an explicit public allowlist;
  billing, team, and private contact data remain private.

## Membership

- Creating, changing, suspending, or removing Membership requires authority in
  the same Organization. A role grant must not exceed the actor's authority.
- The service must lock or otherwise serialize the relevant active owner set
  before an owner is demoted, suspended, removed, or self-removes.
- An Organization must retain at least one active OWNER after the transaction.
- Historical attribution must survive Membership removal; services must not
  delete retained business history as a side effect.

## Invitation

- Invitation email is validated and normalized before lookup, comparison, and
  persistence.
- Only an authorized member may invite, and the requested role must be allowed
  for that actor.
- The invitee must not already be an active member of the Organization.
- Acceptance requires a valid single-use token, a PENDING unexpired
  Invitation, and an authenticated User whose normalized email matches the
  invitation.
- Acceptance atomically revalidates the Invitation, creates or activates the
  Membership, records the accepting actor and timestamp, and marks the
  Invitation ACCEPTED.
- Concurrent or repeated acceptance is idempotent and must not create a second
  Membership. EXPIRED or REVOKED invitations cannot be accepted.

# Product

## Product creation

- The service derives Organization and actor context, validates Organization
  access, generates the stable public code, and normalizes any Organization
  SKU.
- Product creation follows the intentional create-then-point sequence:
  Product, initial ProductVersion, then current draft pointer in one
  transaction.
- Product ownership cannot be changed directly. Cross-Organization transfer is
  not an ordinary Product mutation.

## ProductVersion creation and draft management

- ProductVersion Organization must equal its Product Organization. The service
  derives this value from the tenant-scoped Product rather than accepting it
  from the client.
- A creator is required at creation even though historical actor relations may
  later become null.
- A clone source must belong to the same Product and Organization. Cloning
  copies only eligible versioned content and never copies publication,
  Passport, QRCode, or scan history.
- A Product has at most one editable DRAFT or READY_FOR_REVIEW version. Draft
  creation and reuse must handle concurrent requests.
- DRAFT and READY_FOR_REVIEW content may be edited only with authorization and
  concurrency protection. PUBLISHED and SUPERSEDED aggregates are immutable.
- Restoring historical content creates a new draft; it never makes the
  historical ProductVersion editable.

## Current version pointers

- `currentDraftVersion` and `currentPublishedVersion` must belong to the same
  Product and Organization as the Product that points to them.
- The draft pointer may reference only an approved editable status: DRAFT or
  READY_FOR_REVIEW.
- The published pointer may reference only PUBLISHED.
- Pointer assignment, clearing, and replacement are service operations, not
  generic Product updates.

## Passport ownership

- Passport Organization must equal its Product Organization. Creation and
  update load the Product under the authenticated Organization and derive
  ownership from it.
- Passport state changes preserve the stable public route and validate Product,
  current publication, Organization status, actor permission, and transition
  legality.
- Public Passport serialization independently verifies current publication and
  Passport eligibility. Association existence alone never makes content public.

## Publication

- Publication requires an active Organization, an authorized actor, an active
  Product, an editable target version, complete readiness validation, available
  public assets, and no conflicting publication.
- The service locks or otherwise serializes publication for the Product and
  transactionally:
  1. revalidates Product, ProductVersion, ownership, status, and readiness;
  2. assigns the next product-scoped version number;
  3. marks the target PUBLISHED with trusted actor and timestamp;
  4. marks the previous published version SUPERSEDED where applicable;
  5. updates current draft and published pointers and Product publication time;
  6. creates or updates Passport and QRCode state as required; and
  7. appends the audit event.
- A retry must not create a duplicate published version. A failed publication
  leaves the previous published version current and the draft unexposed.
- Publication and all Product, ProductVersion, pointer, and Passport ownership
  operations are transactional.

# ProductDocument

- Association creation loads ProductVersion and Document under the
  authenticated Organization inside the transaction.
- ProductVersion Organization and Document Organization must match. A
  cross-tenant association is always rejected.
- Only an editable ProductVersion may add, replace, reorder, reprioritize, or
  remove an association. PUBLISHED and SUPERSEDED associations are immutable.
- The Document must be in a lifecycle state suitable for the requested use.
  Public association requires an available Document and explicit public
  visibility.
- The service defines and enforces the approved primary scope and contextual
  identity for category and locale. It rejects unintended duplicate contexts
  while permitting deliberate reuse in distinct contexts.
- Primary replacement is atomic and deterministic. Public ordering uses a
  deterministic tie-breaker in addition to the stored order.
- Public document delivery independently verifies tenant ownership, the
  ProductVersion relationship, association visibility, current publication,
  Passport eligibility, and storage authorization. It never exposes storage
  identity or trusts association existence alone.
- Document archival or replacement must not silently break a published
  association. Physical deletion is prohibited while a published or active
  draft association requires the asset.

Required integration tests:

- same-Organization association succeeds;
- cross-Organization association is rejected;
- private Document is excluded from public output;
- public Document is included only for the eligible current publication;
- another tenant's storage asset cannot be accessed;
- unauthorized and immutable-version mutations are rejected;
- duplicate-context and multiple-primary rules are enforced; and
- legitimate multi-context reuse and atomic primary replacement succeed.

# ProductImage

- Image mutations load the owning ProductVersion through the authenticated
  Organization and require an editable version.
- A ProductVersion has at most one primary ProductImage. Selecting or replacing
  the primary image is one transaction that cannot leave multiple primaries.
- Ordering is non-negative and public serialization is deterministic. Equal
  order values use a stable tie-breaker.
- Public output includes only explicitly public images from the current
  published ProductVersion and never exposes storage identity.
- Publication validates that selected public images are available for public
  use and that the primary selection is valid.
- PUBLISHED and SUPERSEDED ProductImage rows cannot be updated or deleted
  through application services. Replacing a published image requires a new
  draft.

# Notification

- Notification creation derives Organization context and verifies the actor's
  authority for the event.
- If a User is targeted, the service verifies that the User has the approved
  current or historical relationship with that Organization. A User identifier
  alone is insufficient.
- `eventType` and optional logical entity context are normalized and validated;
  logical references do not grant visibility or authorization.
- `actionUrl` is trimmed and normalized before persistence. Relative targets
  must be application-internal; absolute targets must use approved HTTPS
  routing.
- Reject scheme-relative URLs, unsafe schemes, credential-bearing URLs, control
  characters, and targets outside the approved routing policy. Consumers must
  use the same safe routing policy rather than navigating stored text directly.
- Read, dismiss, archive, and visibility operations are scoped to the
  authenticated User and Organization and follow approved lifecycle
  transitions with trusted timestamps.
- Organization-wide and User-targeted visibility are explicit. Expired
  notifications are excluded from active inbox results and cannot be used as
  authorization or domain state.

# IntegrationMapping

- Organization is derived from authenticated or trusted worker context for
  every mapping read and mutation.
- Normalize provider, external resource type, entity type, and other
  normalization-sensitive identity values before comparison and persistence.
  Trim external and internal identifiers without applying an unapproved
  case-folding rule.
- Mapping creation validates that the logical internal entity exists, belongs
  to the Organization, and is compatible with the requested entity type.
- Mapping identities are scoped by Organization, provider, optional external
  account, and resource type. Mappings from different providers or provider
  accounts must not be merged or substituted implicitly.
- An existing mapping conflict is resolved through an explicit, authorized
  mapping operation. Generic upsert must not silently remap either the external
  resource or internal entity.
- ARCHIVED remains part of one stable mapping identity. Services may reactivate
  that row or explicitly remove it through a reviewed workflow; they must not
  create a replacement row merely to bypass lifecycle-spanning uniqueness.
- Archive, reactivate, disable, and error transitions validate current state,
  actor or worker authority, timestamp order, and sanitized error data.
- Credentials, tokens, provider configuration, complete provider payloads, and
  execution state do not belong in IntegrationMapping.

# BackgroundJob

- Job creation derives trusted scope and Organization context. PLATFORM jobs
  have no Organization; ORGANIZATION jobs require an authorized Organization.
- Normalize queue, job type, and optional entity type before comparison and
  persistence. Logical entity type and ID are both absent or both present.
- When logical entity context is supplied, the creator validates that the
  referenced entity exists, matches the declared type and scope, and is
  accessible to the Organization.
- Blank deduplication keys are normalized to null. Non-null keys are
  deterministic for the logical operation and are checked within the approved
  scope. Duplicate active work returns or conflicts with the existing job
  rather than creating parallel execution.
- Creation validates `maxAttempts`, initial attempt count, scheduling, priority,
  and the allowlisted size and content of payload data. All operational
  timestamps are server-generated.
- Claim is atomic: only an eligible QUEUED job may become RUNNING; the service
  increments the attempt count, records one nonblank worker identity, lock time,
  and start time, and prevents a second worker from claiming the same job.
- Start, complete, fail, cancel, reschedule, and retry operations compare the
  expected current status and worker ownership in the mutation predicate.
- Only the owning worker may complete or fail a RUNNING job. Terminal
  transitions clear the lock and write exactly the applicable trusted
  timestamp.
- Failure stores a normalized non-sensitive error code and short sanitized
  summary. Payload, result, and errors must not contain secrets, stack traces,
  binary data, or complete request, response, provider, document, or file
  payloads.
- Retries never exceed `maxAttempts`; they return the job to an eligible QUEUED
  state with a trusted schedule and no active lock or terminal timestamp.
  Attempt count is not decremented or reset.
- Worker ownership, lifecycle state, attempt accounting, and timestamps change
  in one transaction. External work is performed outside that transaction.

# AuditLog

- AuditLog is append-only in normal operation. Application repositories expose
  creation and authorized reads, never update, delete, or generic save methods.
- Creation derives Organization and actor context from the service operation.
  Callers cannot attribute an event to another Organization or arbitrary User.
- Action and entity identity are normalized, metadata is allowlisted and
  minimized, and timestamps are server-controlled.
- Audit reads require Organization-scoped authorization. Audit data and metadata
  are never included in public Passport output.
- Runtime database permissions should deny application-role update and delete
  where practical. Reviewed retention or legal maintenance is a separate
  privileged operational procedure, not an application service.

# ScanEvent

- ScanEvent is append-only. Normal services may create and aggregate events but
  expose no update or delete operation.
- Ingestion validates an eligible QRCode/public route and derives tenant and
  Product context through QRCode and Passport; it does not accept direct
  Product, Passport, or Organization ownership from the client.
- Collect only the approved privacy-minimized fields. Do not store raw IP
  addresses, raw User-Agent strings, User identity, authentication data, or
  fingerprinting inputs.
- Country, language, referrer host, device, referrer, and bot classifications
  are normalized by trusted server logic. Scan and creation times are trusted
  timestamps.
- Analytics reads and aggregations are Organization-scoped and must not expose
  another tenant's activity.
- Runtime database permissions should deny application-role update and delete
  where practical. Deletion or aggregation for an approved retention or privacy
  policy uses a separate reviewed operational workflow.

# Billing

## Plan

- Plan administration is platform-authorized. Organization users cannot create
  or mutate Plan configuration.
- Plan selection and limit enforcement use server-side current Plan data.
  Client-provided prices, limits, features, status, or entitlement claims are
  not authoritative.
- Only an eligible Plan may be assigned to an Organization. Archived or draft
  Plans are not selectable unless an explicit reviewed transition permits it.
- Plan feature data is allowlisted commercial configuration, not provider
  credentials, Organization overrides, usage state, or billing history.

## Subscription

- Subscription mutations load the Organization and Plan in the authorized
  context and preserve one current commercial-state row per Organization.
- Status changes follow an explicit transition policy and atomically validate
  period ordering, Plan eligibility, provider rules, and trusted timestamps.
- Scheduled cancellation is represented by `cancelAtPeriodEnd` while the
  Subscription remains TRIAL, ACTIVE, or PAST_DUE. It is distinct from terminal
  cancellation.
- Terminal CANCELED or EXPIRED state requires `canceledAt` and clears
  `cancelAtPeriodEnd`. Services must not set a terminal timestamp merely because
  cancellation is scheduled.
- Plan limits and entitlements are enforced server-side at the feature mutation
  boundary. Billing failure or Subscription change must not unexpectedly break
  public Passport or QRCode availability without an approved continuity policy.
- Provider-backed billing requires separately reviewed authoritative provider
  identity, idempotency, and configuration scope before release.

Subscription is not a ledger. It does not record invoices, payments, provider
events, webhook history, or historical commercial evidence. Those
responsibilities belong to separately reviewed future billing infrastructure
and must not be placed in Subscription, IntegrationMapping, AuditLog,
Notification, or BackgroundJob as a substitute.

# Transaction Rules

- A transaction starts only after external input is parsed and preliminary
  authorization is established. Relevant ownership, status, and concurrency
  conditions are revalidated inside it.
- The transaction contains every database mutation required to move from one
  valid business state to another, including audit creation where required.
- Mutation predicates include tenant and expected lifecycle state. A missing or
  stale row produces a safe domain conflict or authorization result, not a
  partial write.
- Product publication atomically changes version lifecycle, Product pointers,
  Passport/QRCode state, and audit history.
- Invitation acceptance atomically consumes the Invitation and creates or
  activates the Membership.
- ProductDocument association atomically validates both parents, version
  mutability, contextual multiplicity, primary selection, and the association
  write.
- BackgroundJob claim and every lifecycle transition atomically validate state,
  attempts, worker ownership, locks, and timestamps.
- Product create-then-point, draft cloning, Passport state changes,
  Subscription transitions, and transactional primary replacement follow the
  same all-or-nothing rule.
- Do not hold a database transaction open across file storage, provider,
  network, queue, or other slow external calls. Use an explicit recoverable
  state or separately reviewed idempotent coordination workflow.

# Repository Rules

Repositories must never expose generic write methods capable of bypassing
service invariants. This includes unrestricted `create`, `update`, `upsert`,
`delete`, bulk write, generic save, or raw mutation helpers for guarded models.

All mutations pass through reviewed application services or an equivalent
reviewed invariant-validation layer. Imports, workers, administration tools,
maintenance scripts, and future APIs are not exempt. Raw database access is
restricted to narrowly reviewed persistence operations whose inputs already
carry validated tenant, lifecycle, and concurrency conditions.

Repositories may expose purpose-specific operations such as guarded pointer
assignment, atomic primary replacement, conditional job claim, and append-only
event insertion. Their signatures must make required scope and expected state
explicit.

# Required Integration Tests

The following test groups are mandatory release gates:

- **Product ownership:** same-tenant creation succeeds; cross-tenant Product,
  ProductVersion, clone source, pointer, and actor assignments fail.
- **Passport ownership:** Passport Organization must match Product
  Organization; cross-tenant creation, update, and public access fail.
- **ProductDocument tenant validation:** all tests listed in the
  ProductDocument section, including public delivery authorization.
- **Notification authorization:** current and approved historical target
  relationships, Organization-wide visibility, cross-tenant rejection, unsafe
  URL rejection, and safe consumer routing.
- **BackgroundJob lifecycle:** normalization, null deduplication, scoped
  deduplication, atomic claim races, worker ownership, every approved
  transition, invalid transitions, attempts, retries, and timestamp chronology.
- **Publication workflow:** successful initial and replacement publication,
  pointer/status correctness, immutable published aggregates, concurrent and
  retried publication, and rollback preserving the prior public version.
- **Cross-tenant rejection:** every private query and mutation, including
  imports, workers, logical references, storage delivery, and administrative
  paths, rejects another tenant's identifiers.
- **Append-only behavior:** application repositories and services cannot update
  or delete AuditLog or ScanEvent rows; authorized reads remain tenant-scoped.
- **Identity:** last-owner protection under concurrency, invitation authority,
  normalized duplicate handling, single-use/idempotent acceptance, expiration,
  revocation, and existing-member rejection.
- **ProductImage:** multiple-primary rejection, atomic primary replacement,
  deterministic ordering, public visibility, and published immutability.
- **IntegrationMapping:** normalization, cross-provider/account separation,
  conflict handling, archive/reactivation, and stable identity across lifecycle
  states.
- **Billing:** Plan authorization and eligibility, server-side limits,
  Subscription transitions, scheduled cancellation versus terminal
  cancellation, and public Passport continuity policy.

# Production Requirements

No application feature is production-ready until all applicable service
invariants are implemented and covered by passing integration tests.

Production deployment also requires reviewed repository boundaries,
least-privilege runtime permissions where specified, safe public serializers,
and equivalent enforcement in imports, workers, administration tools, and
maintenance procedures.

# Future Rule

A future PostgreSQL constraint may replace a service invariant only after:

1. architecture review;
2. an approved migration;
3. synchronized documentation;
4. service and database tests; and
5. explicit approval.

Until that process is complete and deployed, the service invariant remains
mandatory. Database enforcement may supplement service authorization and
workflow checks, but it does not remove them unless the review explicitly says
so.
