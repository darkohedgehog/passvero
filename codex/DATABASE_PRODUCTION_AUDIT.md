# Executive Summary

The implemented Passvero database structure is production-capable, internally coherent, and operationally mature for its current stage. The schema uses consistent UUID primary keys, explicit foreign-key actions, targeted indexes, narrowly scoped JSON, and extensive named constraints. All 16 migrations are linear, additive, applied, and recognized by Prisma as up to date.

The database architecture is not being reopened by this audit. Approved aggregate boundaries, ownership rules, service invariants, and delete strategies remain authoritative.

Production readiness is limited by two operational controls that are not evidenced in the reviewed repository: a tested backup/restore procedure with recovery objectives, and explicit capacity/retention monitoring for the four expected high-growth tables. Neither requires a schema change. Four indexes are also plausible redundancy candidates, but they should remain until production statistics demonstrate that removal is safe.

- **Production score:** 86/100
- **Operational maturity:** Strong schema and migration discipline; moderate external operations evidence
- **Confidence:** High for schema, migrations, constraints, and structural query support; medium for backup, restore, workload, and capacity conclusions because live cardinalities, query plans, production metrics, and infrastructure configuration were outside the available evidence
- **Production findings:** 3
- **Immediate production blockers:** 2 operational readiness gates; 0 database-architecture blockers

# Migration Review

The migration history contains 16 timestamped migrations in a single chronological sequence. It creates 20 PostgreSQL enum types and 21 tables. The reviewed history is additive: no migration contains data mutation, destructive table alteration, object removal, trigger, stored function, policy, partition, view, or materialized view creation.

Migration safety is supported by:

- small, phase-oriented migrations;
- explicit primary keys, foreign keys, indexes, and named constraints;
- focused migration tests that pin hashes of earlier migrations;
- separation between migration generation and deployment;
- a current successful `prisma migrate status` result showing all 16 migrations applied.

The migrations have no automatic down path. That is acceptable for an append-oriented production history, but rollback therefore means restoring a verified backup or applying a separately reviewed forward corrective migration. Operational runbooks must reflect that reality.

The migration graph and foreign-key creation order are restore-friendly for a full logical or physical restore. Cyclic Product/ProductVersion publication pointers require normal foreign-key-aware restore ordering or deferred population, but this is an intentional approved design rather than a migration defect.

# Index Review

The schema has broad structural support for its intended access paths. Every foreign-key column is covered either by a direct index or by the leftmost prefix of a composite or unique B-tree index. No realistic missing production index can be established without workload evidence.

Index assessment by model:

| Model | Indexed access paths | Production assessment |
| --- | --- | --- |
| User | normalized email uniqueness, creation time | Appropriate for identity lookup and operational ordering. |
| Organization | slug uniqueness, status, creation time | Appropriate for lookup and administrative listing. |
| Membership | organization/user uniqueness, user, inviter, organization/status | Supports tenant membership and lifecycle queries. |
| Invitation | token uniqueness, email, expiry, organization/status, creator, accepter, partial pending-email uniqueness | Correctly supports acceptance, expiry, and active duplicate prevention. |
| Product | public code, organization/SKU uniqueness, organization/lifecycle, organization/update time, actor references | Supports tenant catalogs, SKU lookup, public lookup, and provenance. |
| ProductVersion | product/version uniqueness, product/status, organization/status, organization/update time, publication and provenance references, partial active-version uniqueness | Supports version navigation and active draft/ready enforcement. |
| ProductTranslation | version/locale uniqueness and version lookup | Functionally complete; the standalone version index is a redundancy candidate. |
| ProductIdentifier | version/type/value uniqueness and version lookup | Functionally complete; the standalone version index is a redundancy candidate. |
| ProductMaterial | version lookup | Appropriate. |
| Document | storage identity uniqueness, organization/status and time orderings, checksum, actor references | Supports tenant document management and storage integrity. |
| ProductDocument | version, document, category, locale, and public ordering | Supports association traversal and document presentation; standalone version lookup is covered by several composites and is a redundancy candidate. |
| ProductImage | storage identity uniqueness, version/public ordering, primary selection, checksum | Supports image presentation and integrity; standalone version lookup is a redundancy candidate. |
| Passport | product uniqueness, public code uniqueness, organization/status, publication times, withdrawal actor | Supports product and public passport lookup. |
| QRCode | passport and target uniqueness, status and lifecycle times | Supports direct QR resolution and lifecycle administration. |
| ScanEvent | QR/time, global time, bot, country, device, and referrer dimensions | Deliberate analytics coverage; write cost must be monitored as volume grows. |
| AuditLog | organization/time, entity, action, actor, correlation, global time | Suitable for tenant audit browsing and trace correlation. |
| Plan | code uniqueness, status/public ordering, creation and archive times | Appropriate for a small commercial catalog. |
| Subscription | organization uniqueness, provider/customer/subscription identities, status, plan/status, provider, period end | Supports tenant billing and provider reconciliation. |
| Notification | organization and user inbox ordering, event, entity, expiry, creation time | Supports organization-wide and user-targeted inboxes. |
| IntegrationMapping | external and internal uniqueness with NULL-account handling, tenant/provider/status, entity, resource type, sync/error/archive times | Supports bidirectional integration lookup and operations. |
| BackgroundJob | scheduling, queue scheduling, tenant/status, entity, lock, creation time, active partial deduplication | Supports polling, locking inspection, and active deduplication without implementing a queue. |

Four indexes may be redundant because another B-tree index has the same leading column:

- `ProductTranslation_productVersionId_idx`;
- `ProductIdentifier_productVersionId_idx`;
- `ProductDocument_productVersionId_idx`;
- `ProductImage_productVersionId_idx`.

This is a LOW operational finding, not a pre-production change request. Composite indexes can satisfy parent-key lookup, but actual index-only behavior, size, cache locality, and workload frequency are unknown. Retain them until `pg_stat_user_indexes`, index sizes, and representative `EXPLAIN (ANALYZE, BUFFERS)` evidence justify a separately reviewed removal.

The six manual partial unique indexes correctly encode conditional uniqueness:

- pending Invitation uniqueness is scoped to organization and normalized email;
- active ProductVersion uniqueness applies only to DRAFT and READY;
- two IntegrationMapping indexes correctly split NULL and non-NULL `externalAccountId`, avoiding PostgreSQL's ordinary NULL-distinct uniqueness behavior;
- two BackgroundJob indexes separately enforce PLATFORM and ORGANIZATION active deduplication for QUEUED and RUNNING jobs.

Terminal or archived records remain intentionally available where required. The predicates are maintainable, but any future enum or lifecycle change must explicitly review them.

# Constraint Review

The migration history contains 77 named `ck_` CHECK constraints. They provide substantial operational value for format, range, pair-presence, scope, lifecycle, and timestamp-order consistency while leaving accepted cross-aggregate and service-controlled invariants outside the database.

Strengths include:

- deterministic constraint names for diagnostics;
- no trigger-based hidden state transitions;
- constraints localized to the table whose row they validate;
- explicit lifecycle timestamp consistency for invitation, document, passport, subscription, notification, integration, and background-job records;
- bounded and normalized identifiers where external or polymorphic references are used.

The main maintenance burden is dual-source evolution: Prisma does not express these manual checks, so enum or lifecycle changes must update migration SQL, schema comments where relevant, and focused tests together. This is a normal and manageable cost of using PostgreSQL checks with Prisma, not a production blocker.

No additional business-rule constraints are recommended. Previously accepted service invariants remain service responsibilities.

# JSON Review

JSON is limited to six fields:

- `AuditLog.metadata`;
- `Plan.features`;
- `Notification.metadata`;
- `IntegrationMapping.metadata`;
- `BackgroundJob.payload`;
- `BackgroundJob.result`.

These fields represent bounded extensibility, presentation context, plan capabilities, or normalized job input/output. Core identifiers, ownership, lifecycle, relations, and query keys remain relational. `Plan.features` is constrained to a JSON object, and documentation requires allowlisting and excludes credentials, secrets, raw payloads, large content, and stack traces from flexible JSON fields.

There are no JSON defaults and no GIN indexes. That is appropriate because no approved primary query path depends on arbitrary JSON containment. There is no evidence of unnecessary JSON or a missing JSON field.

# Large Table Readiness

## ScanEvent

`ScanEvent` is the most likely high-volume table. Its indexes directly support QR/time queries and approved analytics dimensions. Six secondary indexes plus the primary key create meaningful write amplification, but each secondary index maps to a stated analytics access path. Retention, aggregation cadence, index growth, autovacuum, and insert latency should be monitored before changing this design.

## AuditLog

`AuditLog` is retained history with organization/time and diagnostic access paths. Its append-oriented workload is structurally sound. Long-term size, access latency, and retention obligations need an operational policy; immediate partitioning is not justified without measured growth.

## BackgroundJob

`BackgroundJob` carries six ordinary indexes, two partial unique indexes, and a primary key. This is appropriate for eligibility polling, queue selection, tenant inspection, and deduplication. Terminal job retention will determine long-term size. Workers should use bounded, indexed polling and operational monitoring, but worker design is outside this audit.

## Notification

`Notification` supports organization and user inbox queries, event/entity lookup, expiry filtering, and chronological access. `expiresAt` is a visibility signal, not deletion. Retained expired or archived notifications therefore need explicit capacity and retention monitoring.

No reviewed table currently demonstrates a need for partitioning. That decision should be driven by measured cardinality, write rate, maintenance duration, retention needs, and query plans.

# Query Readiness

The database structurally supports the approved production workloads:

- tenant queries use required `organizationId` ownership and tenant-leading indexes across core records;
- Product browsing uses organization/lifecycle and organization/update-time indexes;
- Passport lookup uses product and public-code uniqueness plus organization/status indexes;
- QR lookup uses unique code/target fields and QR-to-scan time indexes;
- analytics use ScanEvent time and dimension composites;
- notification inboxes use organization/user, status, and creation-time composites;
- integrations use stable external/internal uniqueness and tenant/provider/entity indexes;
- background jobs use status/schedule, queue/status/schedule, lock, and partial active-deduplication indexes.

No production workload traces or query plans were supplied, so this conclusion is about structural readiness rather than measured latency. There is no evidence-based missing index.

# RLS Readiness

The ownership model is compatible with a future RLS phase. Organization-owned records expose direct tenant identifiers on principal query paths, and inherited ownership paths are explicit where aggregate children are intentionally scoped through parents. PLATFORM BackgroundJob rows are clearly distinguished from ORGANIZATION rows by a checked scope/ownership rule.

RLS is currently untouched, as required. Future policy work will need deliberate treatment for platform-scoped jobs and inherited aggregate paths, but no present schema change or RLS enablement is recommended by this audit.

# Backup and Restore

UUID primary keys avoid sequence-reconciliation issues during logical restore. Explicit referential actions make deletion effects predictable, while Restrict actions protect retained organization, billing, audit, notification, integration, and job history. Aggregate-owned cascade chains are bounded and documented.

The repository indicates deployment awareness but does not provide auditable evidence of:

- automated backup coverage and retention;
- point-in-time recovery configuration;
- documented recovery point and recovery time objectives;
- a successful restore drill;
- a rollback/run-forward procedure for an applied migration.

This is a real MEDIUM operational risk and a before-production gate. The remedy is operational verification and documentation, not a schema or migration change.

# Scalability Review

| Approximate table size | Readiness assessment |
| --- | --- |
| 100k rows | All models should operate comfortably with the current keys and indexes under ordinary SaaS workloads. |
| 1M rows | Structure remains suitable. Monitor ScanEvent and AuditLog write amplification, index size, vacuum behavior, and common query latency. |
| 10M rows | High-growth tables require enforced retention/capacity policy, aggregation strategy where applicable, and evidence-based review of index bloat, BRIN suitability, or partitioning. No automatic schema change follows from row count alone. |
| 100M rows | ScanEvent will likely need deliberate aggregation, archival/retention, and potentially partitioning based on measured access patterns. AuditLog, BackgroundJob, and Notification require the same evaluation only if their actual growth approaches this tier. |

At every tier, database size, sustained insert rate, peak concurrency, cache hit rate, autovacuum lag, replication lag, query percentiles, and restore duration matter more than row count in isolation.

# Prisma Review

The project resolves Prisma 7.8.0 and `@prisma/client` 7.8.0. The schema validates successfully with the current Prisma configuration. Relations are explicit where ambiguity exists, referential actions are stated, native UUID types are consistent, and migration status recognizes the database as current.

Manual CHECK constraints and partial indexes are intentionally represented in migration SQL rather than the Prisma schema. Focused tests compensate for that visibility gap and protect migration contents and prior hashes.

All UUID defaults are Prisma `uuid()` defaults rather than PostgreSQL column defaults. Prisma Client creates valid IDs consistently; direct SQL import tooling must supply UUIDs explicitly. This is an operational characteristic, not a defect.

Generated-client compatibility was not mutated or regenerated during this read-only audit. Relation complexity is understandable and within Prisma's supported model.

# Maintainability Review

Another engineer can understand the schema from its domain grouping, canonical field names, comments on sensitive flexible fields, explicit relation names, explicit referential actions, and focused composite indexes. Migration phases correspond to recognizable model boundaries.

Maintainability is strengthened by:

- consistent UUID and timestamp conventions;
- named manual constraints;
- explicit tenant ownership;
- separation of logical entity references from foreign keys;
- focused migration tests and earlier-migration hash checks;
- absence of hidden database execution logic such as triggers or stored procedures.

The principal ongoing discipline is to review manual SQL predicates and checks whenever associated enums or lifecycle semantics evolve.

# Production Strengths

- Linear, fully applied, additive migration history.
- Consistent UUID primary keys across all models.
- Explicit and operationally appropriate foreign-key actions.
- Complete foreign-key index coverage.
- Strong query-path coverage without speculative JSON indexing.
- Correct partial uniqueness for nullable integration account context and active job scopes.
- Named checks enforce local structural integrity without taking over accepted service invariants.
- High-growth tables have purposeful chronological and dimensional indexes.
- Retained history is protected through Restrict or SetNull where required.
- No database triggers, automatic retries, schedulers, provider credentials, or hidden lifecycle automation.
- Prisma 7.8.0 validation and migration-status compatibility are confirmed.

# Production Risks

## P-01 — Recovery readiness is not evidenced

- **Severity:** MEDIUM
- **Impact:** A valid schema and migration history do not establish recoverability. Unverified backups or restore duration can turn an infrastructure or deployment incident into unacceptable data loss or downtime.
- **Evidence boundary:** No concrete PITR configuration, recovery objectives, restore-drill result, or migration recovery runbook was found in the reviewed repository material.
- **Required response:** Verify and record backup retention, RPO/RTO, restore testing, and forward-recovery procedures before production.
- **Schema change:** No.

## P-02 — High-growth retention and capacity controls are not evidenced

- **Severity:** MEDIUM
- **Impact:** ScanEvent, AuditLog, BackgroundJob, and Notification are intentionally retained or append-oriented. Without capacity thresholds and retention decisions, index/storage growth can eventually degrade maintenance, restore time, and query latency.
- **Required response:** Define ownership for retention decisions and alerts for row growth, storage, index size, autovacuum health, and representative query latency before sustained production load.
- **Schema change:** No. Partitioning is not justified now.

## P-03 — Four child-prefix indexes may be redundant

- **Severity:** LOW
- **Impact:** If unused, they add storage and write amplification. Removing them without workload evidence could instead regress simple parent lookups or operational behavior.
- **Required response:** Retain them initially; evaluate production usage statistics and query plans after a representative observation period.
- **Schema change:** None before production; any later removal requires separate review.

# Recommendations

## Before Production

1. Prove recoverability: confirm automated backups and retention, define RPO/RTO, complete a restore drill, and document forward recovery for failed deployments.
2. Establish capacity and retention ownership for ScanEvent, AuditLog, BackgroundJob, and Notification, with alerts for storage growth, index growth, autovacuum health, and latency.

These are operational readiness improvements. They do not alter the frozen architecture.

## After Production

1. Collect `pg_stat_user_indexes`, relation/index sizes, slow-query evidence, and representative query plans.
2. Reassess the four possible child-prefix index redundancies only after a representative observation period.
3. Monitor the maintenance cost and selectivity of ScanEvent analytics indexes under actual ingest patterns.
4. Periodically rehearse restore and forward-recovery procedures.

## Future Scaling

1. At sustained multi-million-row growth, evaluate retention, aggregation, BRIN, archival, or partitioning using measured workloads and maintenance windows.
2. Prioritize ScanEvent for the first scaling review; evaluate AuditLog, BackgroundJob, and Notification according to their actual growth rather than assuming identical behavior.
3. Revisit partial-index predicates and manual lifecycle checks only when their corresponding approved enum or lifecycle definitions change.

# Final Verdict

**PRODUCTION READY AFTER MINOR IMPROVEMENTS**

The implemented database architecture has no identified structural blocker to production or Architecture Freeze. Its migrations, constraints, indexes, relations, and Prisma representation are strong. Production launch should nevertheless be gated on two modest but essential operational controls: demonstrated backup/restore readiness and explicit growth/retention monitoring for append-oriented tables. These improvements require no schema redesign, migration, or change to an approved architecture decision.
