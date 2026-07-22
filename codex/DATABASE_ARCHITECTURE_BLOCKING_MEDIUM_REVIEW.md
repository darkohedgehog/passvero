# Passvero Database Architecture Blocking MEDIUM Findings Review

Review date: 2026-07-22

# Executive Summary

The four blocking recommendations identify technically observable states, but
the earlier MEDIUM review did not establish that preventing those states in
PostgreSQL is mandatory before Database Architecture Freeze.

M-01, M-03, and M-06 describe real invariants. Their realistic failures arise
only when an unvalidated writer bypasses the authenticated domain or platform
service that already owns the complete operation. Additional CHECK constraints
would provide defense in depth, but they would enforce only fragments of the
workflow, introduce manual migration maintenance, and not remove the service
obligation. They are therefore accepted as service invariants.

M-04 combines current Subscription state with provider-event identity and
historical accounting requirements that the approved architecture explicitly
defers. Subscription is not the payment ledger, Plan is intentionally mutable,
and provider correlation has no approved production workflow yet. That finding
is rejected as a current database-freeze blocker. Provider-backed billing must
define its authoritative identity model before that future feature is released.

Final outcome:

- M-01: **Accepted as Service Invariant**
- M-03: **Accepted as Service Invariant**
- M-04: **Rejected**
- M-06: **Accepted as Service Invariant**

No database schema change remains mandatory before Database Architecture Freeze
v1.0 based only on these four findings.

# M-01 — Core lifecycle rows

## Restatement

Organization, Invitation, Product, ProductVersion, Document, and Passport can
store status and timestamp combinations that conflict with expected lifecycle
meaning because lifecycle CHECK constraints are absent or one-directional.

## Technical correctness

The database observation is correct. PostgreSQL can accept examples such as an
ACCEPTED Invitation without `acceptedAt`, an ACTIVE Product with `archivedAt`,
a PUBLISHED ProductVersion without `publishedAt` or `versionNumber`, a WITHDRAWN
Passport without `withdrawnAt`, and Document timestamps that do not correspond
to its current status.

The finding does not establish one safe database truth table across all listed
models. Several timestamps are retained milestones rather than mutually
exclusive current-state markers. Restoration, retry, supersession, archival,
and historical retention rules differ by model. Organization and Document
lifecycle semantics are also less fully frozen than the finding assumes.

## Database responsibility

**Shared responsibility.**

PostgreSQL is a reasonable place for stable row-local constraints. Application
services remain the natural owner of transition authorization, actor
attribution, multi-row publication effects, restoration, retries, and the
decision about which earlier timestamps remain as history.

The existence of a possible CHECK does not make that CHECK mandatory when the
full lifecycle contract is not frozen and the approved service transaction can
enforce the invariant atomically.

## Arguments supporting the Medium Review

- Required timestamps and status are columns on the same row.
- A CHECK can reject malformed writes from imports and privileged scripts.
- Later models already use status/timestamp consistency constraints.
- Missing publication or withdrawal timestamps can make retained history
  difficult to interpret.
- Simple timestamp ordering is useful defense in depth.

## Arguments against the Medium Review

- The finding groups six models with different lifecycle and retention
  semantics into one proposed migration obligation.
- ProductVersion transitions and publication are expressly assigned to an
  atomic application service.
- Product archive/restore and Passport withdrawal/reactivation are controlled
  domain operations, not independent column edits.
- A strict nullability matrix could reject legitimate retained milestones, such
  as a SUPERSEDED version retaining `publishedAt`.
- Status evolution would require coordinated manual SQL changes in addition to
  service changes and tests.
- Database checks would still not enforce authorization, legal transition
  order, actor validity, publication completeness, or cross-row effects.
- The earlier review showed that constraints could be added, but not that the
  service boundary is inadequate without them.

## Complexity impact

A correct implementation would first require six model-specific lifecycle
specifications, legacy-row compatibility analysis, manual migrations, and
expanded migration tests. It would duplicate part of each service transition
contract while leaving the majority of that contract in services. That
increases migration and status-evolution cost without simplifying the
application architecture.

Narrow CHECKs may still be adopted later as reviewed hardening once each truth
table is stable. They are not required to make the current architecture
coherent.

## Realistic production risk

If no additional CHECK is added, a defective import, administrative script, or
repository method could persist a status without its required timestamp. A
public or administrative read could then show incorrect lifecycle state or
lose the date needed to explain a publication, withdrawal, or failure.

The realistic risk is data-quality and history ambiguity after a writer has
already violated the approved write boundary. The absence of a CHECK does not
itself cause a transition or expose data.

## Existing architectural mitigation

The approved architecture prevents the failure by requiring:

- explicit domain services for invitation acceptance, Product archive/restore,
  publication, Document processing, and Passport withdrawal/reactivation;
- atomic status and timestamp writes inside the same transaction;
- publication services to assign `versionNumber`, `publishedAt`, actor data,
  Product pointers, Passport state, and audit events together;
- generic repositories, imports, and administration tools to use the same
  invariant-validation layer;
- transition and negative-path tests before affected features are released.

These controls validate the complete business operation rather than only a
partial column matrix.

## Recommendation

**Accepted as Service Invariant**

The technical invariant is real, but no schema change is required solely by
M-01. Lifecycle services must validate status/timestamp consistency and ordering
transactionally, and tests must cover every approved transition plus malformed
status/timestamp combinations. Direct or generic lifecycle writes must not be
exposed. Database CHECKs remain optional future hardening after model-specific
semantics are frozen.

# M-03 — Notification targeting and internal URL semantics

## Restatement

Notification can reference a User who has no appropriate relationship with its
Organization, and its action URL CHECK accepts scheme-relative values beginning
with `//` as though they were internal paths.

## Technical correctness

The finding is technically correct.

The User foreign key proves existence, not present or historical Membership in
the Notification's Organization. The action URL condition accepts any value
matching `/%`, including `//external.example`, which a browser can resolve to an
external host.

Those observations concern different layers. User eligibility is tenant
authorization. Full URL interpretation is request validation and safe rendering.
The database CHECK provides only coarse storage validation and cannot establish
either authorization or safe navigation by itself.

## Database responsibility

**Application Services.**

The Notification service must authorize the Organization/User relationship.
The command/request boundary must parse and normalize action targets, and the UI
or navigation helper must refuse unsafe destinations. PostgreSQL may enforce a
coarse lexical allowlist, but it is not the authoritative URL parser or
authorization engine.

## Arguments supporting the Medium Review

- Cross-targeting could place tenant-specific content in another User's inbox.
- Rejecting a second leading slash is straightforward defense in depth.
- A tighter CHECK would protect non-service writers.
- Future UI code might incorrectly assume every stored internal-looking value
  is safe.

## Arguments against the Medium Review

- The approved model intentionally has no Membership relation because targeting
  may depend on a current or historical Organization relationship.
- PostgreSQL cannot decide that authorization policy from the two foreign keys.
- The Notification architecture explicitly assigns target validation to
  application services.
- Complete URL validation includes parsing, canonicalization, route policy, and
  safe consumption; `NOT LIKE '//%'` would address only one representation.
- A stored string does not redirect anyone unless a consumer navigates without
  validation.
- Tightening one SQL pattern would not remove request-layer or rendering-layer
  validation and would duplicate a subset of their responsibility.

## Complexity impact

A database-only fix is small but incomplete. It adds a migration and permanent
SQL contract for one URL spelling while every creation path and consumer still
needs the full validator. Attempting database-level target authorization would
be substantially worse: it would add Membership coupling while failing to
represent historical eligibility cleanly.

Centralized service validation and a shared safe-navigation policy keep the
complete rule in one maintainable layer. A later lexical CHECK improvement may
be added as hardening without being a freeze prerequisite.

## Realistic production risk

Without a tighter CHECK, a malformed or compromised writer could store a
Notification for an unrelated User or persist `//external.example`. If an inbox
query exposes that cross-targeted row, tenant content could be disclosed. If a
frontend subsequently navigates to the URL without validation, the user could
be sent to an external site.

Both failures require bypass or failure of the approved service boundary; the
URL case additionally requires an unsafe consumer.

## Existing architectural mitigation

The approved application architecture prevents these failures by:

- creating Notifications only through a tenant-aware service;
- loading or validating the targeted User's appropriate current or historical
  Organization relationship before insertion;
- rejecting client-supplied Organization authority;
- parsing and normalizing `actionUrl` at the request/command boundary;
- allowing only approved internal routes or explicit HTTPS destinations;
- using a safe navigation helper that never treats stored data as inherently
  trusted;
- testing cross-Organization targeting, `//` values, unsafe schemes, and
  consumer behavior.

## Recommendation

**Accepted as Service Invariant**

M-03 identifies real authorization and validation obligations, but does not
prove that a migration is mandatory. The Notification service and navigation
layer must enforce them and must have negative tests. No direct Membership
relation or database URL-parser responsibility should be introduced solely by
this finding.

# M-04 — Billing provider identity and commercial history

## Restatement

Subscription permits repeated external customer or subscription identifiers
within a provider context, and its mutable Plan relation cannot reconstruct the
commercial terms that applied during an earlier subscription period.

## Technical correctness

The column-level observations are correct. Subscription has no provider-scoped
unique constraint on `externalCustomerId` or `externalSubscriptionId`, and Plan
updates can change the present interpretation of earlier periods.

The finding assumes responsibilities that the current model does not claim.
Subscription represents one Organization's current commercial state. It is not
the authoritative payment ledger, invoice history, webhook record, or immutable
commercial contract. The architecture also identifies IntegrationMapping as a
possible provider-resource identity boundary. No approved provider-event
workflow establishes the Subscription columns as the authoritative lookup key.

## Database responsibility

**Future infrastructure.**

The future billing integration must choose its authoritative provider identity
and idempotency model. If that design uses Subscription columns for lookup, a
provider/configuration-scoped database constraint may be appropriate. If it uses
IntegrationMapping, that model already provides scoped mapping uniqueness.

Historical pricing, invoices, settlements, and commercial terms belong to a
separate billing-history or ledger model. They do not belong in the mutable
current Subscription row.

## Arguments supporting the Medium Review

- A production webhook handler needs deterministic provider identity.
- Duplicate external subscription IDs could route an event to the wrong tenant
  if code treats the current columns as authoritative.
- Database uniqueness is stronger than a check-then-insert service operation
  under concurrency.
- Mutable Plan values cannot prove historical terms.
- Resolving identity before provider integration reduces later migration risk.

## Arguments against the Medium Review

- Provider webhook processing and reconciliation are not implemented or
  approved current responsibilities of Subscription.
- Provider ID scope differs by provider and account/configuration context; a
  universal constraint would encode assumptions before the integration model
  exists.
- MANUAL subscriptions intentionally have no provider identifiers.
- IntegrationMapping is explicitly designed to map provider resources without
  placing provider-specific identity throughout domain models.
- Plan mutability is intentional because Plan describes current configuration.
- Historical commercial evidence is explicitly deferred to future billing
  models.
- A future feature gate is not a defect that must block freezing the current
  database architecture.

## Complexity impact

Adding uniqueness now requires choosing null semantics, provider account scope,
configuration identity, identifier reuse policy, and the authoritative source
between Subscription and IntegrationMapping. Making that choice without the
provider workflow risks redundant identities and migrations that later need to
be reversed.

Adding snapshots or plan versions to Subscription would broaden it into the
billing-history responsibility the architecture deliberately excludes. Deferral
simplifies the current model and keeps the future integration cohesive.

## Realistic production risk

If a future webhook implementation queries Subscription directly by a duplicate
external ID, it could find multiple rows and apply an entitlement or
cancellation update to the wrong Organization. If historical terms are inferred
from the current Plan, reporting could state the wrong past price or limits.

Neither failure exists in the current architecture unless a future billing
feature incorrectly treats current-state fields as an approved event ledger or
historical contract.

## Existing architectural mitigation

The approved architecture prevents current misuse by:

- defining Subscription as current commercial state only;
- keeping payment settlement authoritative in the external provider;
- prohibiting Subscription from becoming invoice or payment history;
- reserving provider resource mapping for a reviewed IntegrationMapping or
  future billing-integration design;
- requiring server-side billing entitlement checks;
- requiring future provider processing to define identity, idempotency,
  configuration scope, and tenant ownership before release;
- requiring future historical reporting to use a dedicated billing-history
  model rather than mutable Plan state.

## Recommendation

**Rejected**

Reject M-04 as a current database architecture defect and Freeze blocker. No
schema change is required solely by this finding. Provider identity and
commercial history remain mandatory design gates for future provider-backed
billing, but implementing them before that workflow is approved would
prematurely couple Subscription to unknown infrastructure.

# M-06 — BackgroundJob logical references and chronology

## Restatement

BackgroundJob pairs logical entity references but does not enforce their format,
allows empty deduplication and lock-owner strings, and permits terminal
timestamps that precede `startedAt` while still following `createdAt`.

## Technical correctness

The finding is technically correct.

Current CHECK constraints enforce scope ownership, queue/job-type format,
reference pairing, attempts, lock pairing, lifecycle shape, error fields, and
timestamps no earlier than creation. They do not enforce lexical rules for
logical references, nonblank deduplication/lock-owner values, or ordering that
requires terminal timestamps to follow the start.

The finding does not show that PostgreSQL must own those remaining rules.
Logical reference vocabularies, deduplication keys, worker identity, and
execution timestamps are created by the future job service and workers. The
database already protects the structural properties needed for safe persistence
without executing or orchestrating work.

## Database responsibility

**Shared responsibility.**

PostgreSQL appropriately owns the existing status shape, attempt bounds, active
deduplication indexes, ownership, and lock pairing. Application job services and
workers naturally own normalization, semantic entity validation, worker
identity, clock use, claim/complete transactions, and execution order.

Additional lexical and chronology CHECKs are reasonable optional hardening, not
proof that the persistence model is incomplete.

## Arguments supporting the Medium Review

- Documentation describes `entityType` as normalized uppercase text.
- Empty deduplication keys can collide in active partial unique indexes.
- Empty lock owners make operational diagnosis harder.
- A terminal timestamp before `startedAt` is chronologically impossible for a
  completed execution.
- These are row-local conditions that CHECK constraints can express.

## Arguments against the Medium Review

- The approved Phase 6C database contract intentionally required entity pairing
  but did not define a closed entity vocabulary or identifier format.
- `entityId`, deduplication keys, and lock-owner formats may differ across job
  producers and worker infrastructure.
- Arbitrary length constraints would freeze infrastructure assumptions before
  the worker contract exists.
- An empty deduplication key causes rejection/collision behavior rather than
  silently executing duplicate work; the creation service can normalize it to
  null.
- The worker must set status, lock fields, attempt counts, and timestamps in a
  transaction regardless of extra CHECKs.
- Database chronology cannot prove that work actually executed in the stated
  order; it can only compare supplied timestamps.
- Expanding CHECKs does not simplify queue polling, locking, retries, or failure
  recovery.

## Complexity impact

The proposed constraints add another manual migration and duplicate DTO/worker
validation while the worker vocabulary and identifier bounds are still future
infrastructure. Every later format change would require both service and
database evolution.

Keeping semantic normalization in the job service preserves flexible logical
references. The existing database checks continue to protect structural state.
Optional terminal chronology hardening may be added later without moving worker
execution into PostgreSQL.

## Realistic production risk

Without new CHECKs, a defective producer could create a job with malformed
logical context or an empty deduplication key. A defective worker could claim a
job using an empty owner or write a terminal timestamp earlier than its start.
This could cause an unintended deduplication collision, poor lock diagnostics,
or misleading operational duration and history.

These are operational data-quality failures. They do not create a worker,
execute a job, cross a tenant boundary, or corrupt a domain aggregate by
themselves.

## Existing architectural mitigation

The approved future job architecture prevents these failures by requiring:

- one job-creation service with uppercase entity constants and trimmed,
  nonblank logical identifiers;
- normalization of absent deduplication keys to null;
- nonblank, non-sensitive worker-instance identifiers;
- transactional claim, start, completion, failure, cancellation, and retry
  operations;
- timestamps from one trusted clock source and validation that terminal events
  do not precede start;
- tests for malformed references, blank keys/owners, invalid chronology,
  attempt limits, lock consistency, and active deduplication;
- no generic job writes outside the reviewed job/worker infrastructure.

## Recommendation

**Accepted as Service Invariant**

M-06 identifies real job-service validation requirements, but no database
change is mandatory before Freeze. The creation and worker services must enforce
normalization and chronology and must be tested before BackgroundJob processing
is production-ready. Existing PostgreSQL constraints remain the structural
guardrail; additional lexical checks are optional future hardening.

# Final Decision Table

| Finding | Original Recommendation | Final Recommendation | Schema Change Required | Reason |
| --- | --- | --- | --- | --- |
| M-01 | Accepted | Accepted as Service Invariant | No | Complete lifecycle semantics belong to transactional services; extra row checks are optional hardening |
| M-03 | Accepted | Accepted as Service Invariant | No | Targeting is authorization and complete URL safety spans request validation and consumption |
| M-04 | Accepted | Rejected | No | Provider identity and commercial history belong to future billing infrastructure, not current Subscription freeze scope |
| M-06 | Accepted | Accepted as Service Invariant | No | Existing checks protect structure; job producers and workers own normalization and execution chronology |

After reviewing ONLY these blocking Medium findings, does any database schema
change remain mandatory before Database Architecture Freeze v1.0?

**NO**

The four findings identify useful hardening opportunities or future feature
gates, but none proves that the current database structure is incoherent without
another migration. M-01, M-03, and M-06 become mandatory service-validation and
test obligations. M-04 must be resolved when provider-backed billing and
historical commercial infrastructure are designed. This conclusion does not
approve Architecture Freeze: Low findings, Observations, documentation
synchronization, the Database Production Audit, and final approval remain
separate pending gates.
