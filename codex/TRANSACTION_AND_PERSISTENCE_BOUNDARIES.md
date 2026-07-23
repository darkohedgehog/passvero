# Passvero Transaction and Persistence Boundaries

## 1. Purpose

This document is the persistence contract for future Passvero application
services.

It defines:

- ownership of business transactions;
- Prisma transaction usage;
- repository and persistence responsibilities;
- read and write boundaries;
- coordination with external dependencies;
- concurrency and idempotency boundaries;
- persistence error translation; and
- persistence testing obligations.

It applies to authenticated user, public, worker, and platform-administration
use cases. It preserves Database Architecture Freeze v1.0,
`SERVICE_INVARIANTS.md`, `APPLICATION_SERVICES_ARCHITECTURE.md`, the
authorization contracts, and the applied Prisma schema.

This document defines architecture, not concrete repository interfaces, Prisma
queries, service methods, or implementation code.

## 2. Principles

- The application service owns the complete business transaction.
- A repository never owns a business transaction.
- A repository never performs authorization.
- A repository never decides business rules, lifecycle policy, permissions, or
  workflow sequencing.
- Repositories expose narrow persistence operations that support one or more
  reviewed use cases.
- A multi-step use case uses one explicit transaction-scoped persistence
  capability.
- Tenant scope and expected state are explicit persistence inputs.
- Authorization and preliminary validation happen before mutation; volatile
  facts are revalidated inside the transaction.
- Database constraints are authoritative and complement service invariants.
- Slow network, provider, queue, and storage calls do not run inside a database
  transaction.
- AuditLog and any required durable database-side consequence commit atomically
  with the business mutation.
- Prisma records remain persistence data, not service, API, UI, or public DTOs.
- Known persistence outcomes are translated; raw Prisma and SQL details never
  cross the persistence boundary.
- Concurrency and retry strategy are selected per use case. There is no
  universal lock, retry, or optimistic-version mechanism.
- A failed operation must leave either the prior valid state or an explicit
  recoverable state.

## 3. Transaction Ownership

One top-level application service owns each business transaction. It defines:

- where the transaction starts and ends;
- which reads must be repeated inside it;
- which mutations form one atomic state transition;
- which AuditLog or other database records must commit with the mutation;
- the concurrency expectation;
- the idempotency behavior; and
- the result returned after commit.

The service opens the transaction only after external input has been parsed,
the trusted context has been resolved, and preliminary authorization has
succeeded. It then revalidates tenant ownership, permission-sensitive state,
lifecycle, expected values, and other volatile invariants inside the
transaction.

### Nested service calls

Stateful application services must not call one another in a way that creates
hidden, nested, or independent transactions. That pattern can:

- commit only part of a workflow;
- repeat authorization inconsistently;
- obscure audit ownership;
- use the root Prisma client while a transaction is active; and
- make retry behavior unsafe.

Cross-domain workflows have one top-level coordinator. The coordinator may use:

- pure domain and authorization policies;
- value normalizers;
- narrow transaction-scoped persistence operations; and
- collaborators that explicitly have no transaction ownership.

If reusable application logic must participate in an existing transaction, it
receives the current persistence scope and cannot commit, roll back, or replace
it. A helper that needs its own business transaction is a separate top-level
use case and is not invoked as a nested transactional step.

Transaction ownership must be visible in service documentation and tests. It
must not be inferred from repository internals.

## 4. Prisma Transaction Rules

Prisma is confined to server-only infrastructure persistence modules.
Application services coordinate it through an application-owned transaction
abstraction rather than importing a global Prisma client throughout the
application layer.

The conceptual transaction flow is:

1. the application service requests one transaction;
2. the transaction coordinator creates one Prisma transaction scope;
3. that scope is passed explicitly to every participating persistence
   operation;
4. all dependent reads, conditional writes, and required database-side events
   use the same scope;
5. the service returns only after all operations succeed; and
6. the coordinator commits or rolls back the whole unit.

The exact TypeScript type and wrapper API are intentionally deferred.

### Passing transaction scope

Persistence operations must make transaction participation explicit. A
repository used inside a transaction must not silently fall back to the root
Prisma client.

Acceptable future implementation patterns include:

- passing one transaction-scoped persistence session to operations; or
- constructing transaction-scoped repository instances for the duration of
  the service callback.

The project must choose one consistent pattern during implementation. Both
patterns must ensure that the Prisma transaction client:

- does not escape the transaction callback;
- is not stored globally;
- is not reused after commit or rollback;
- is not used by detached or unawaited work; and
- is the only database capability used by participating writes.

Read-only work does not require a transaction by default. It may use a short
transaction when a use case requires one consistent snapshot across multiple
dependent reads.

Transaction isolation, timeouts, and database locking are selected only when
the use case demonstrates a requirement. Do not increase transaction duration
globally to hide slow design or external calls.

Raw Prisma operations or parameterized SQL may be used only in reviewed
persistence infrastructure when the approved behavior cannot be expressed
safely otherwise, such as a justified locking or conditional operation. They
remain transaction-scoped and must not bypass tenant, schema, or service
contracts.

## 5. Repository Responsibilities

Repositories isolate persistence mechanics. Their responsibility is limited to:

- tenant-scoped and ownership-path-aware reads;
- narrow inserts, updates, and deletes requested by the application service;
- conditional mutations using explicit expected state;
- selecting only fields required by the caller;
- preserving the supplied transaction scope;
- exposing known database outcomes without leaking Prisma details;
- mapping persistence records to internal persistence DTOs where useful; and
- using indexes, constraints, and relation paths defined by the frozen schema.

Repositories may encode database facts, such as:

- which predicate targets one tenant-scoped row;
- which fields are needed for an invariant decision;
- how a conditional update is expressed;
- how an approved database lock is acquired; and
- which known constraint produced a semantic persistence conflict.

Repositories do not decide:

- whether an actor is authorized;
- whether a lifecycle transition is allowed;
- whether a use case should publish, archive, invite, retry, or notify;
- whether a cross-aggregate business invariant passes;
- whether an AuditLog or Notification is required;
- how external calls are sequenced; or
- which application error a presentation adapter returns.

A repository operation can be shared only when its persistence semantics are
the same for every caller. Similar-looking use cases with different invariant
or disclosure needs should not be forced through one broad method.

## 6. Repository Anti-Patterns

The following are prohibited:

- generic entity repositories exposing unrestricted `create`, `update`,
  `upsert`, `delete`, or `save`;
- accepting a Prisma mutation-input object from a service or API;
- loading a private row by ID alone and checking tenant ownership later;
- hiding a new transaction inside a repository;
- using the root Prisma client during a caller-owned transaction;
- performing permission, role, Membership, or public-visibility decisions in a
  repository;
- coordinating multi-step workflows in persistence code;
- calling storage, billing, queue, notification-delivery, or integration
  providers from a repository;
- converting every database error to not-found, success, or one generic
  conflict;
- treating a unique-constraint error as idempotent success without comparing
  command identity and stored state;
- returning full Prisma records when a narrow selection is sufficient;
- returning Prisma-generated types across public or presentation boundaries;
- embedding UI, HTTP, localization, or provider behavior in persistence code;
- silently retrying writes inside one repository operation;
- unbounded bulk writes that bypass per-use-case tenant and invariant checks;
- mutable singleton repositories that carry current Organization or
  transaction state; and
- raw SQL that bypasses reviewed schema, parameterization, ownership, or
  transaction rules.

## 7. Read Operations

Read operations use the narrowest scope and selection required by the use case.

### Private reads

Private reads receive tenant scope from trusted context. They query direct
ownership using resource identity plus Organization identity. Inherited
ownership follows the frozen parent path. Logical entity references are
resolved through their real owned resource.

A private repository must not reveal whether a row exists outside the
authorized scope. The service receives an absent-in-scope result and applies
the documented NOT_FOUND/FORBIDDEN disclosure policy.

Read operations select only facts needed for:

- permission and ownership evaluation;
- lifecycle and invariant validation;
- explicit service results; or
- a subsequent conditional mutation.

### Public reads

Dedicated public read services use persistence operations designed around
stable public identifiers and publication eligibility. They do not reuse broad
private queries and remove fields afterward.

Public persistence selects only the current published and eligible ownership
chain and the fields required to map an allowlisted public DTO. Storage
identity, draft content, private Documents, team data, billing data, audit
metadata, and operational payloads remain excluded.

### Consistency

A single read or independent list normally uses no explicit business
transaction. Multiple dependent reads use one short read transaction when a
consistent snapshot is necessary for the result.

Read-after-write data used for a service result should be produced within the
owned transaction or from the committed result identity afterward, according
to the consistency requirement. A service must not assume a stale cache
reflects committed state.

## 8. Write Operations

Write operations are purpose-specific and accept only the values the
application service has authorized and validated.

Every guarded mutation includes, where applicable:

- trusted Organization scope;
- resource identity;
- expected lifecycle or current state;
- expected concurrency value;
- normalized values;
- trusted actor attribution;
- trusted timestamps or clock output; and
- the transaction-scoped persistence capability.

Writes use conditional predicates when the state may change between validation
and mutation. A zero-row result is a concurrency or scope outcome, not automatic
success. The service may perform a safe scoped re-read to distinguish stale
state from absence when disclosure policy permits.

Bulk operations are allowed only when the use case defines:

- one tenant and authorization boundary;
- invariant handling for every affected row;
- all-or-nothing or partial-result semantics;
- bounded size;
- concurrency behavior; and
- audit requirements.

Append-only models expose insert and scoped read operations only in normal
application persistence. AuditLog and ScanEvent do not expose update, delete,
or generic save operations.

Deletes remain purpose-specific. A database cascade describes structural
effect; it does not authorize the service operation. Retention, publication,
storage, dependent-row, and audit rules are validated before deletion.

## 9. Transaction Boundaries

A transaction is mandatory when multiple database operations must move from one
valid business state to another atomically.

Mandatory boundaries include:

- Organization onboarding with initial Membership;
- Invitation acceptance and Membership creation/activation;
- last-OWNER-sensitive Membership transitions;
- Product create-then-point sequencing;
- draft creation or cloning with owned content;
- publication, current pointers, prior-version state, Passport/QRCode state,
  and AuditLog;
- Passport withdrawal or reactivation with related state;
- ProductDocument association and primary/context rules;
- ProductImage primary replacement;
- Subscription and entitlement transitions;
- Notification lifecycle changes that affect related state;
- IntegrationMapping lifecycle and identity conflicts;
- BackgroundJob claim, attempt, lock, and terminal transitions; and
- any mutation whose AuditLog event represents that mutation.

The transaction contains all database reads and writes needed to prove and
commit the state transition. It excludes:

- slow provider calls;
- file transfer;
- email, push, or notification delivery;
- queue publication;
- image processing;
- webhook acknowledgement beyond required persistence;
- remote billing or integration requests; and
- detached background work.

A database Notification record may commit in the same transaction when it is a
required application-side consequence. Delivery is external and occurs later.

A BackgroundJob record may commit with a mutation only when the approved use
case intentionally requests that asynchronous work. BackgroundJob is not a
generic event log or outbox.

## 10. External Dependencies

Database transactions and external systems cannot provide one atomic commit.
Passvero coordinates them through explicit recoverable states and idempotent
commands.

### External APIs and providers

The general pattern is:

1. validate trusted context, permission, input, and current state;
2. persist an intent or recoverable state in a short transaction when the
   frozen model supports it;
3. commit;
4. call the external dependency outside the transaction;
5. normalize the provider result;
6. finalize success or failure in another short, idempotent transaction; and
7. schedule reviewed recovery when the caller cannot safely complete the flow.

If the current schema has no durable state capable of representing the
workflow safely, the feature is not implemented by holding a transaction open.
It requires a separately reviewed infrastructure design.

### File uploads and storage

File bytes are never transferred inside a database transaction.

Upload coordination uses the implemented Document lifecycle:

- register validated, tenant-owned upload metadata in a short transaction;
- perform storage upload outside the transaction;
- verify trusted storage outcome, size, MIME policy, and checksum;
- finalize AVAILABLE or FAILED state in a short idempotent transaction; and
- recover or clean up orphaned storage/database state through a reviewed
  process.

ProductImage storage follows the same no-long-transaction rule while preserving
its ProductVersion ownership and published immutability.

Storage deletion also requires recoverable coordination. The service must not
delete a retained database record first and then silently lose the ability to
recover from storage failure.

### Background jobs

Creating a BackgroundJob persists requested work; it does not execute or
publish that work to a provider. Job enqueue/dispatch adapters operate after
commit and use the job identity and deduplication policy.

Workers claim and transition jobs through short database transactions. The
external work occurs outside the claim transaction. Completion or failure is a
new transaction that verifies job state, attempt, worker identity, and lock
ownership.

### Audit and notifications

AuditLog insertion occurs in the same transaction as the mutation it records.
It is not sent to an external logger inside that transaction.

Notification persistence may be atomic with a business mutation when required.
Email, push, SMS, webhook, or provider delivery remains outside the transaction
and behind a future adapter.

## 11. Concurrency

Concurrency control is chosen per use case from approved mechanisms:

- transaction revalidation;
- conditional updates with expected-state predicates;
- existing unique and partial unique constraints;
- short database locks where justified;
- idempotency or deduplication identity;
- trusted timestamps or `updatedAt` comparison where appropriate; and
- bounded retry of known transient transaction conflicts.

There is no universal optimistic-lock version field. Adding one requires a
separate reviewed schema change.

### Optimistic concurrency

Optimistic concurrency compares the state used to make the decision with the
state being changed. Depending on the use case, the expected predicate may
include:

- current lifecycle status;
- current pointer identity;
- Membership role/status;
- current primary selection;
- BackgroundJob status, attempt, worker, and lock;
- IntegrationMapping identity/status; or
- `updatedAt` when timestamp precision and semantics are suitable.

The mutation succeeds only when the expected predicate still matches. A
zero-row result becomes a safe conflict or invalid-state outcome.

### Conditional updates and locking

Conditional updates are preferred when they can express the race safely.
Locks are used only when an invariant spans rows or requires serialized
inspection, such as active OWNER protection or product-scoped publication
state.

Lock acquisition belongs to narrow reviewed persistence infrastructure. The
application service still decides why the lock is needed and what business
state may follow.

### Unique constraints

Database uniqueness is the final arbiter for races covered by approved
constraints and partial indexes. Preliminary existence checks improve error
clarity but never replace handling the commit-time conflict.

Known uniqueness conflicts are mapped to semantic persistence outcomes. They
are not automatically retried and do not automatically imply idempotent
success.

## 12. Idempotency

Idempotency is defined by the application service for commands that may be
retried without knowing the prior outcome.

The service specifies:

- the logical command identity;
- which input fields must match a prior command;
- the scope of that identity;
- the stored state that proves prior completion;
- the safe result for a compatible retry; and
- the conflict returned for incompatible reuse.

Existing mechanisms include:

- unique invitation token and single-use state;
- product-scoped version and active-draft uniqueness;
- stable current pointers and expected publication state;
- IntegrationMapping identities;
- BackgroundJob active deduplication keys; and
- conditional lifecycle transitions.

No universal idempotency table or field is introduced by this document. A use
case that requires durable idempotency without an approved storage mechanism
needs separate design and, if necessary, schema review.

An idempotent retry must not:

- bypass authorization;
- conceal different input under the same identity;
- convert an invalid cross-tenant request to success;
- repeat an external side effect blindly; or
- infer success only from a unique-constraint error.

External adapters use provider-supported idempotency where available, but the
application still owns command identity and final state reconciliation.

## 13. Error Translation

Persistence code translates known database outcomes into a small internal
persistence outcome vocabulary. The application service maps those outcomes to
the stable application error contract.

Known persistence outcomes include:

- absent within scope;
- conditional write conflict;
- semantic unique conflict;
- referential or retained-dependency conflict;
- known transient transaction conflict;
- database unavailable; and
- unexpected persistence failure.

The persistence boundary may inspect Prisma metadata internally to recognize a
reviewed constraint or transient condition. It must not expose:

- raw Prisma error objects or codes;
- SQL text;
- table, column, index, or constraint names;
- connection details;
- stack traces; or
- cross-tenant identifiers.

Expected mappings include:

- absent tenant-scoped rows to safe NOT_FOUND behavior;
- conditional conflicts to CONFLICT or INVALID_STATE;
- known validation/identity uniqueness to a stable semantic CONFLICT;
- retained dependency violations to a safe invalid-state/conflict outcome;
- external database availability to INTERNAL or the future infrastructure
  availability category; and
- unknown failures to INTERNAL with protected correlation diagnostics.

Authorization errors are not inferred from Prisma failures. Authorization is
resolved before persistence and preserved through tenant-scoped predicates.

### Database retry strategy

Retries are owned by the transaction coordinator or application service, never
hidden in one repository method.

A database transaction may be retried only when:

- the failure is a reviewed transient serialization, deadlock, or equivalent
  transaction conflict;
- the complete transaction callback can be rerun safely;
- no external side effect occurred inside it;
- the command remains authorized and idempotent;
- the attempt count is bounded; and
- retry telemetry is secret-free and correlated.

Use bounded backoff and jitter where the implementation design selects retry.
Do not retry deterministic unique, foreign-key, CHECK, authorization,
validation, lifecycle, or unknown failures. Do not retry indefinitely.

Each retry re-runs reads and invariant validation. It does not reuse stale
Prisma records from the prior attempt.

## 14. Persistence Mapping

Persistence types and service types are separate.

### Persistence inputs

Persistence inputs contain only values needed for one narrow operation,
including explicit tenant, resource, expected-state, normalized-data, actor,
and transaction context where applicable. They are not Prisma-generated
unrestricted mutation inputs.

### Persistence records and DTOs

Repositories select only fields required by the service. They may return:

- a narrow persistence record;
- a persistence DTO shaped around invariant facts;
- a conditional-write outcome; or
- a known semantic persistence conflict.

They do not return public DTOs or presentation responses.

### Service and public mapping

The application layer maps persistence output to explicit service result DTOs.
Dedicated public services map narrow eligible persistence data to strict public
DTOs.

Mapping must prevent leakage of:

- private or draft content;
- storage provider/bucket/key identity;
- User and Membership internals;
- billing/provider identifiers;
- AuditLog metadata;
- BackgroundJob payload/result;
- IntegrationMapping provider context; and
- fields added to Prisma models in the future.

Mapping is explicit and allowlisted. Type compatibility alone is not permission
to return a persistence record.

## 15. Future Outbox Guidance

No outbox is introduced or required by this document.

An outbox should be considered only when a future use case requires both:

- an atomic database state change; and
- guaranteed eventual publication or delivery to an external system.

Before introducing one, the project must review:

- event ownership and schema;
- transaction insertion semantics;
- publisher claim, retry, and lock behavior;
- consumer idempotency;
- ordering requirements;
- failure visibility and recovery;
- retention, replay, and privacy;
- monitoring and operational ownership;
- migration and deployment impact; and
- tests proving no lost or duplicate semantic effects.

AuditLog, Notification, IntegrationMapping, BackgroundJob, Subscription, and
provider metadata must not be repurposed as a generic outbox. Their frozen
responsibilities remain unchanged.

A future outbox requires a focused architecture review, documentation, an
approved migration where needed, and explicit deployment approval. Until then,
external workflows use only the recoverable states and reviewed job semantics
already approved for their actual domain purpose.

## 16. Testing Strategy

Persistence testing must prove database behavior rather than mock it away.

### Unit tests

Use pure unit tests for:

- mapping;
- semantic error classification without live secrets;
- retry-decision policy;
- idempotency comparison;
- expected-state construction; and
- transaction-independent normalization.

### Service tests

Use controlled persistence dependencies to test:

- orchestration order;
- explicit transaction ownership;
- authorization before mutation;
- external calls outside transaction scope;
- safe outcome/error mapping; and
- idempotency and retry decisions.

Test doubles must not silently allow nested transactions or root-client writes
inside an owned transaction.

### PostgreSQL/Prisma integration tests

Use real PostgreSQL and Prisma behavior for:

- commit and rollback;
- shared transaction scope across repositories;
- foreign-key, CHECK, unique, and partial unique constraints;
- conditional-update races;
- expected-state conflicts;
- transaction isolation and approved locks;
- last-OWNER concurrency;
- invitation double acceptance;
- publication races and rollback;
- primary replacement;
- ProductDocument tenant equality;
- IntegrationMapping conflicts;
- BackgroundJob claim/lock/attempt transitions;
- append-only repository boundaries; and
- safe handling of known Prisma errors.

### External coordination tests

Use adapter contract tests and failure injection to prove:

- database failure before an external call;
- external timeout or failure after intent persistence;
- process interruption before finalization;
- repeated callbacks or worker execution;
- compatible and incompatible idempotent retries;
- orphan detection/recovery; and
- no network or storage work while a database transaction is open.

Every applicable integration-test group in `SERVICE_INVARIANTS.md` remains a
release gate.

## 17. Definition of Done

A future service's transaction and persistence design is complete only when:

- one top-level transaction owner is identified;
- every participating database operation uses the same explicit transaction
  scope;
- no repository starts a hidden business transaction;
- tenant and expected-state inputs are explicit;
- authorization and business policy remain outside repositories;
- preliminary and in-transaction validation responsibilities are defined;
- read and write selections are narrow;
- concurrency strategy and zero-row behavior are defined;
- unique and referential conflict behavior is defined;
- idempotency identity, compatible retry, and mismatch behavior are defined
  where applicable;
- database retry eligibility and bound are defined;
- external calls are outside transactions;
- storage/provider failure leaves a defined recoverable state;
- AuditLog and required database consequences commit atomically;
- persistence records map to explicit service/public DTOs;
- raw Prisma errors cannot escape;
- no generic write bypass exists;
- required unit, service, integration, concurrency, and failure-path tests pass;
  and
- documentation is synchronized.

If any item is undefined, the persistence design is not ready for
implementation.

## 18. Non-Goals

This document does not define:

- concrete repository interfaces or method signatures;
- Product-specific repository methods;
- Prisma code, generated types, or exact transaction wrapper types;
- raw SQL statements;
- exact transaction isolation levels, timeout values, retry counts, or backoff
  constants;
- HTTP routes, handlers, status codes, or API payloads;
- authentication, session, or permission implementation;
- storage, billing, queue, notification, or integration provider selection;
- worker runtime or scheduler;
- an outbox, inbox, event bus, or event-sourcing architecture;
- new database models, fields, constraints, indexes, migrations, or RLS; or
- implementation of services, repositories, adapters, or tests.

Those decisions require subsequent focused design or implementation tasks.
