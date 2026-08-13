# Production PostgreSQL Readiness Review

**Review date:** 2026-08-13  
**Scope:** Operational and architecture review only; no implementation, database connection, migration, role/grant change, backup configuration, deployment, or PM2 action was performed.

## 1. Executive Summary

Passvero's self-hosted PostgreSQL topology is directionally suitable for an MVP: PostgreSQL 16.14 is local-only, production and integration-test databases and roles are isolated, the committed 16-migration history has been proven against `passvero_test`, and the existing hosted database has no business data to move. This is a schema/runtime infrastructure cutover, not a business-data migration.

The production cutover is nevertheless **NO-GO today**. The required blockers are operational rather than schema-design problems: production ownership and grants have not been verified, the production runtime factory is not implemented, the production database migration state is not verified, backup automation and an off-VPS restore drill are not evidenced, and capacity, monitoring, and cutover smoke procedures remain unverified.

The recommended MVP model is:

- **REQUIRED BEFORE CUTOVER:** a dedicated `passvero_migrator` login owns database/schema objects and is used only for reviewed migration deployments;
- **REQUIRED BEFORE CUTOVER:** `passvero_app` owns no schema objects and receives only the DML privileges required by deployed services;
- **REQUIRED BEFORE CUTOVER:** `AuditLog` and `ScanEvent` are protected from direct runtime `UPDATE` and `DELETE`;
- **REQUIRED BEFORE CUTOVER:** automated daily custom-format logical backups, encrypted off-VPS retention, alerting, and one successful isolated restore drill;
- **REQUIRED BEFORE CUTOVER:** one bounded PrismaPg/node-postgres pool per PM2 process, initially capped at five connections;
- **NO CHANGE:** PostgreSQL remains bound to localhost, with remote administration and integration testing only through SSH tunnels.

Security findings from this review:

| ID | Severity | Finding | Required disposition |
| --- | --- | --- | --- |
| PG-OPS-001 | High | No repository evidence proves an automated, off-VPS, restorable production backup path. First writes without it could make data loss unrecoverable. | **REQUIRED BEFORE CUTOVER:** implement and prove the backup and restore gates in Sections 10–11. |
| PG-PRIV-001 | Medium | The migration history creates schema objects but contains no production ownership/grant/default-privilege policy. Runtime least privilege therefore depends on an unverified operational step. | **REQUIRED BEFORE CUTOVER:** establish and verify the role model in Sections 3–7. |
| PG-RUNTIME-001 | Medium | The repository has a PrismaPg integration path but no production Prisma runtime factory or runtime entry point. | **REQUIRED BEFORE CUTOVER:** implement and verify the production runtime boundary in a separate task before environment cutover. |

These are genuine readiness gaps, not evidence that the existing application code is unsafe. No raw credential, URL, API key, or database value was inspected for this review.

## 2. Confirmed Starting State

The following facts are operator-confirmed and are treated as current evidence:

| Fact | Classification | Readiness status |
| --- | --- | --- |
| The existing hosted Prisma database contains no production, user, or business records requiring migration. | **NO CHANGE** | PASS; business-data migration is closed. |
| PostgreSQL 16.14, cluster `16/main`, listens only on localhost port 5432 and has no public firewall exposure. | **NO CHANGE** | PASS. |
| `passvero` and `passvero_test` are separate databases with separate `passvero_app` and `passvero_test` roles. | **NO CHANGE** | PASS. |
| Each role can connect only to its intended database; cross-database connections are denied. | **NO CHANGE** | PASS. |
| `passvero_test` has all 16 committed migrations and passed all 14 CreateProduct PostgreSQL integration tests. | **NO CHANGE** | PASS for integration-test evidence. |
| The current production application does not perform database writes; CreateProduct is not wired to an API/runtime entry point. | **NO CHANGE** | PASS as a cutover-safety fact. |
| The repository is pinned to Prisma 7.8.0 and already contains the reviewed PrismaPg CreateProduct integration implementation. | **NO CHANGE** | PASS; no version change is proposed. |

Repository evidence also shows one PM2 Next.js process (`instances: 1`, fork mode), a localhost-only Next.js listener, no production runtime Prisma singleton/factory, no backup/restore automation, and no production migration-deployment runbook. The committed migration history contains 21 application tables, 20 enums, 77 named `CHECK` constraints, and six manually defined partial unique indexes. It defines no explicit sequences, stored functions, ownership statements, grants, revokes, or default privileges.

## 3. Production Ownership Model

Three viable models were considered:

| Model | Security and operations assessment | Decision |
| --- | --- | --- |
| A. `passvero_app` owns the database and all objects | Simple, but ownership implicitly permits DDL, object alteration/drop, and grant changes. It defeats strong runtime least privilege and weakens database enforcement of append-only tables. | Rejected for production. |
| B. A dedicated `passvero_migrator` owns database/schema objects; `passvero_app` receives runtime grants | Clean separation of DDL and DML, compatible with Prisma migration deployment, and operationally modest for one application. | **REQUIRED BEFORE CUTOVER:** recommended MVP model. |
| C. A `NOLOGIN` owner role owns objects and a deployment login assumes it | Strongest separation and easier deploy-credential rotation, but adds role-membership and `SET ROLE` procedures not yet needed for the MVP. | **OPTIONAL LATER:** consider as operations mature. |

Under Model B:

- **REQUIRED BEFORE CUTOVER:** `passvero_migrator` owns database `passvero`, schema `public`, every migration-created table and enum/type, and `_prisma_migrations`.
- **REQUIRED BEFORE CUTOVER:** migration-created indexes and `CHECK`/foreign-key constraints remain attached to and controlled through their owning tables. They do not need independent runtime grants.
- **REQUIRED BEFORE CUTOVER:** any future migration-created sequence or function is migrator-owned. The current history creates neither.
- **REQUIRED BEFORE CUTOVER:** `passvero_app` owns no database, schema, table, type, sequence, function, or migration-history object.
- **RECOMMENDED BEFORE CUTOVER:** retain the cluster administrator only for bootstrap, recovery, and break-glass operations, never routine application deployment.

Object ownership must be verified after migration deployment because running a migration under a different login changes the creator/owner context and can bypass the intended default privileges.

## 4. Migration Role Recommendation

**REQUIRED BEFORE CUTOVER:** create and use a dedicated deployment-only `passvero_migrator` login for production schema changes. It should:

- connect only to `passvero`;
- own `passvero` and its application schema/objects, or otherwise have the precise ownership required for Prisma migration DDL;
- be permitted to create, alter, and drop objects only within the production application database/schema;
- own and manage `_prisma_migrations`;
- have no `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION`, or `BYPASSRLS` attribute;
- not be available to the normal application process;
- use a separate protected credential invoked only by the controlled deployment workflow.

Prisma `migrate deploy` is compatible with this model because the migrator is the owner allowed to apply the committed DDL. Routine use of `postgres` is rejected: it grants unnecessary cluster-wide authority and makes object ownership/default privileges easier to get wrong. Using `passvero_app` is also rejected because it would give the always-on web process DDL authority.

**RECOMMENDED BEFORE CUTOVER:** document one authorized operator, one target-identity gate, and one immutable release commit for each migration deployment. Failed migrations must stop the release; operators must not edit an applied migration or run reset/push workflows against production.

## 5. Runtime Role and Grants

Prisma Client and PrismaPg need ordinary PostgreSQL connection, transaction, and DML privileges. They do not require database ownership, schema creation, role administration, or other special server privileges.

For the currently deployed CreateProduct persistence surface, grant `passvero_app` only:

- **REQUIRED BEFORE CUTOVER:** `CONNECT` on `passvero`;
- **REQUIRED BEFORE CUTOVER:** `USAGE` on schema `public` and on referenced enum/types;
- **REQUIRED BEFORE CUTOVER:** `SELECT` on `Membership`, `Organization`, `Product`, `ProductVersion`, `ProductTranslation`, and `AuditLog` as required for eligibility checks, conflict-safe reads, and returned rows;
- **REQUIRED BEFORE CUTOVER:** `INSERT` on `Product`, `ProductVersion`, `ProductTranslation`, and `AuditLog`;
- **REQUIRED BEFORE CUTOVER:** `UPDATE` on `Product` for the guarded draft pointer;
- **NO CHANGE:** no sequence grant is currently necessary because the schema uses application-generated identifiers and the migration history defines no sequences.

Future services should add only their reviewed operation-specific grants. Do not grant speculative broad mutation rights merely because a table exists.

Explicit denials/absence of authority for `passvero_app`:

- **REQUIRED BEFORE CUTOVER:** no schema or object ownership, DDL, schema `CREATE`, database creation, role creation, superuser, replication, or bypass-RLS rights;
- **REQUIRED BEFORE CUTOVER:** no access to `_prisma_migrations` during ordinary application runtime;
- **REQUIRED BEFORE CUTOVER:** no access to `passvero_test` or any future development database;
- **RECOMMENDED BEFORE CUTOVER:** revoke default `PUBLIC` schema/database privileges that would undermine this explicit model, after verifying required local behavior.

Foreign-key enforcement does not require the application to own or directly query every referenced table. PostgreSQL checks constraints as part of the authorized mutation.

## 6. Default Privileges Strategy

Default privileges are creator-specific and affect only future objects; they neither repair existing grants nor apply when an unexpected role creates an object.

- **REQUIRED BEFORE CUTOVER:** define defaults *for objects created by `passvero_migrator` in schema `public`* so `passvero_app` receives `SELECT` on future tables and `USAGE` on future types.
- **REQUIRED BEFORE CUTOVER:** grant write privileges explicitly in reviewed migrations or deployment grant steps according to each new service. Avoid default `INSERT/UPDATE/DELETE` on all future tables.
- **RECOMMENDED BEFORE CUTOVER:** define future sequence defaults (`USAGE` and, only if needed, `SELECT`) even though the current schema has no sequences.
- **RECOMMENDED BEFORE CUTOVER:** if a dedicated backup login is adopted, default `SELECT` on future tables should also be maintained for it.
- **REQUIRED BEFORE CUTOVER:** apply explicit grants to all already-created objects after the 16 migrations, then verify them separately from the defaults.

All production migrations must therefore run as the same migrator owner. A migration run by the cluster administrator would create objects outside this default-privilege policy and is a release failure until ownership and grants are corrected and verified.

## 7. Append-Only Enforcement Review

`SERVICE_INVARIANTS.md` defines `AuditLog` and `ScanEvent` as append-only operational records. PostgreSQL grants can reinforce that service contract without breaking Prisma:

- **REQUIRED BEFORE CUTOVER:** give `passvero_app` `INSERT` and necessary `SELECT`, but no direct `UPDATE` or `DELETE`, on `AuditLog` and `ScanEvent`.
- **REQUIRED BEFORE CUTOVER:** ensure generic future runtime grants never restore those two privileges.
- **RECOMMENDED BEFORE CUTOVER:** perform exceptional retention, legal, or repair operations through a separately authorized migrator/maintenance procedure, never the web-process credential.

This enforcement is compatible with current CreateProduct behavior, which inserts one audit row and never updates or deletes it. The broader integration-test role must retain fixture-cleanup authority; production append-only grants must not be mirrored blindly to `passvero_test`.

Database grants cannot by themselves prove every higher-level invariant or prevent misuse by the object owner. Application tests and service boundaries remain required, while the runtime denial limits damage from compromised or defective runtime code.

## 8. Production Database Initialization Procedure

The later, separately approved initialization procedure should be:

1. **REQUIRED BEFORE CUTOVER:** identify the target using database name, current login, server version, host class, and loopback endpoint without printing credentials. Abort unless it is the intended self-hosted `passvero` database.
2. **REQUIRED BEFORE CUTOVER:** verify the target is empty/uninitialized as defined in Section 9 and contains no unexpected user schemas or objects.
3. **REQUIRED BEFORE CUTOVER:** verify the database/schema ownership, migrator attributes, runtime isolation, and absence of unsafe `PUBLIC` privileges.
4. **REQUIRED BEFORE CUTOVER:** pin the release commit and verify that its migration directory contains exactly the reviewed 16 migrations with no working-tree changes.
5. **REQUIRED BEFORE CUTOVER:** point the Prisma CLI explicitly at `passvero` using the protected migrator credential; fail closed if the identity differs. Never substitute the test or hosted datasource.
6. **REQUIRED BEFORE CUTOVER:** run only Prisma's production migration-deployment command against the committed history.
7. **REQUIRED BEFORE CUTOVER:** verify migration status and exactly 16 successful, non-rolled-back migration records.
8. **REQUIRED BEFORE CUTOVER:** verify the expected 21 tables, 20 enums, 77 named checks, six manual partial unique indexes, foreign keys/indexes, owners, grants, and absence of unexpected sequences/functions/schemas.
9. **REQUIRED BEFORE CUTOVER:** apply and verify existing-object grants and creator-specific default privileges for runtime and backup roles.
10. **REQUIRED BEFORE CUTOVER:** verify every application table is empty; insert no seed or business data.
11. **REQUIRED BEFORE CUTOVER:** take a baseline backup, copy it off-VPS, and complete the restore drill before the application may write.

Additional preflight checks should confirm disk capacity, PostgreSQL service health, available connection headroom, compatible major versions for dump/restore tooling, server time synchronization, and a preserved pre-cutover application/hosted-database rollback path.

## 9. Empty-Database Verification

The self-hosted target must be verified rather than assumed empty.

Before initialization:

- **REQUIRED BEFORE CUTOVER:** `_prisma_migrations` is absent;
- **REQUIRED BEFORE CUTOVER:** `public` contains no Passvero application relations or enum types;
- **REQUIRED BEFORE CUTOVER:** there are no unexpected non-system schemas, functions, extensions, or owner-created objects;
- **REQUIRED BEFORE CUTOVER:** the target identity and owner match the approved production record.

After initialization:

- **REQUIRED BEFORE CUTOVER:** `_prisma_migrations` contains exactly 16 successful, non-rolled-back entries and migration status is current;
- **REQUIRED BEFORE CUTOVER:** the expected schema inventory matches the committed migration history;
- **REQUIRED BEFORE CUTOVER:** all 21 application-table row counts are zero and no seed/business rows exist;
- **REQUIRED BEFORE CUTOVER:** ownership and effective privileges match Sections 3–7.

The operator-confirmed hosted database emptiness is a separate fact and conclusively removes business-data export/import from this cutover. It does not replace the self-hosted target-empty verification.

## 10. Backup Architecture

The minimum MVP backup design is:

- **REQUIRED BEFORE CUTOVER:** one daily full logical backup of `passvero` using PostgreSQL custom format, scheduled during a quiet window such as 02:00 UTC;
- **REQUIRED BEFORE CUTOVER:** 14 daily, eight weekly, and six monthly recovery points;
- **REQUIRED BEFORE CUTOVER:** immediate encrypted transfer to an independent off-VPS destination, with transport encryption and encryption at rest;
- **REQUIRED BEFORE CUTOVER:** a dedicated read-only backup credential with only database connection, schema usage, and table read access; it must have no DML or DDL;
- **REQUIRED BEFORE CUTOVER:** a restrictive staging directory (directory mode 0700, files 0600), deletion of local temporary artifacts after verified offsite transfer, and no more than 24 hours of local backup accumulation;
- **REQUIRED BEFORE CUTOVER:** verify command success, non-empty/sane artifact size, cryptographic checksum, readable archive inventory, successful offsite upload, and retrieval metadata;
- **REQUIRED BEFORE CUTOVER:** alert on each failed step and when no valid offsite backup has completed within 26 hours;
- **RECOMMENDED BEFORE CUTOVER:** preserve role/grant/ownership definitions in a protected operations record because a database-only logical dump does not capture cluster-global roles or their secrets.

Backup filenames and logs must contain no connection strings, passwords, API keys, or business identifiers. The off-VPS credential must be distinct from database and application credentials. A baseline post-migration, pre-write backup is mandatory.

## 11. Restore Drill Requirements

**REQUIRED BEFORE CUTOVER:** complete one real restore from the off-VPS artifact into a newly created, isolated throwaway database and role. Never restore over `passvero` or `passvero_test`.

The drill must:

1. retrieve and checksum-verify the selected offsite artifact;
2. restore it through the actual documented restore procedure;
3. verify the expected 21 tables, 20 enums, 77 checks, six manual partial unique indexes, relationships, and ownership/grant expectations;
4. verify all 16 migration records and schema-current status;
5. compare recorded per-table row counts with the source backup manifest (zero for the initial baseline);
6. run a safe Prisma read/connectivity smoke check using a non-production credential;
7. record duration and demonstrate that the accepted recovery-time objective is achievable;
8. clean up only the isolated drill database after evidence is approved.

Evidence required to close the prior Database Production Audit gate includes: timestamp, artifact identifier and checksum, proof of offsite retrieval, redacted command outcomes, isolated target identity, schema/migration/count results, restore duration, named operator/reviewer sign-off, and cleanup confirmation. Merely listing an archive is not a restore test.

## 12. PITR Decision

**NOT REQUIRED FOR MVP** (implementation classification: **OPTIONAL LATER**) provided the operator explicitly accepts a recovery-point objective of up to 24 hours and daily logical backups plus the restore drill are complete.

PITR/WAL archiving materially reduces possible data loss between logical backups, but it also adds continuous archive monitoring, base backups, retention coordination, and tested recovery procedures. It should become **RECOMMENDED LATER** when write volume or business value grows, a sub-24-hour RPO is required, or regulatory/customer commitments demand it. This decision must be revisited after real production usage is known.

## 13. Connection Pool Recommendation

For the current single PM2 process:

- **REQUIRED BEFORE CUTOVER:** create one process-wide Prisma Client/PrismaPg/node-postgres pool, not a pool per request;
- **REQUIRED BEFORE CUTOVER:** set an explicit initial maximum of five database connections, minimum zero, 10-second idle timeout, and five-second connection-acquisition timeout;
- **REQUIRED BEFORE CUTOVER:** handle acquisition/database failures safely and log only redacted operational context;
- **NO CHANGE:** no external pooler is needed for the single-process MVP;
- **OPTIONAL LATER:** consider a pooler only after measured concurrency or deployment topology warrants it.

The capacity equation is approximately `PM2 instances × pool maximum`, plus separate headroom for migration, backup, monitoring, and emergency administration. Before increasing PM2 instances, re-budget the total and compare it with PostgreSQL `max_connections`, memory, and observed active connections. The migration process must use its separate credential/connection rather than the application pool.

## 14. PostgreSQL Capacity Assessment

The architecture is reasonable for an early-stage, single-process MVP, but the repository and confirmed context do not provide current VPS RAM, free disk, storage growth, or `max_connections`. Capacity is therefore **NOT VERIFIED**.

- **REQUIRED BEFORE CUTOVER:** confirm the VPS can run Next.js and PostgreSQL without OOM/sustained swapping under the five-connection budget.
- **REQUIRED BEFORE CUTOVER:** retain at least the greater of 10 GiB or three times the expected near-term database plus temporary-backup footprint, and at least 30% free disk at cutover.
- **REQUIRED BEFORE CUTOVER:** confirm SSD-backed storage health and enough connection headroom for the app pool plus at least migration, backup, monitoring, and emergency access.
- **RECOMMENDED BEFORE CUTOVER:** record baseline CPU, memory, disk, database size, connection use, and query latency after cutover.
- **OPTIONAL LATER:** tune PostgreSQL memory/checkpoint/autovacuum settings only from measured workload. No tuning change is justified by current evidence.

## 15. Network Security

- **NO CHANGE:** PostgreSQL should continue listening only on localhost; no public or private-interface listener is needed.
- **NO CHANGE:** do not add a UFW rule for port 5432.
- **NO CHANGE:** remote administration and integration-test access remain SSH-tunnel-only.
- **REQUIRED BEFORE CUTOVER:** verify host-based authentication rules restrict each login/database pairing and use an appropriate password authentication mechanism; preserve the already confirmed production/test cross-connect denials.
- **RECOMMENDED BEFORE CUTOVER:** restrict SSH access, use key authentication, and audit tunnel-capable operator accounts independently of PostgreSQL.

Localhost-only transport does not require public TLS termination for the application-to-database hop. It also does not remove the need for credential authentication and file/host hardening. There is no identified reason to expose PostgreSQL publicly.

## 16. Secret Management

- **REQUIRED BEFORE CUTOVER:** store each production database credential in a protected, untracked VPS environment file owned by the service operator/account, with mode 0600 and a restricted parent directory.
- **REQUIRED BEFORE CUTOVER:** keep application, migrator, backup, test, and any development credentials distinct and outside Git.
- **REQUIRED BEFORE CUTOVER:** the runtime receives only the application credential; migration and backup credentials are loaded only by their controlled jobs.
- **REQUIRED BEFORE CUTOVER:** never place secrets in `ecosystem.config.cjs`, command arguments, shell history, filenames, build output, logs, error responses, or client-visible environment variables.
- **RECOMMENDED BEFORE CUTOVER:** ensure PM2 environment inspection, support bundles, process listings, and backup-job logs do not disclose credential values.
- **RECOMMENDED BEFORE CUTOVER:** maintain a documented rotation process and rotate immediately after suspected exposure.
- **RECOMMENDED BEFORE CUTOVER:** retain the current hosted credential only through verified cutover and its observation window; retire/rotate it afterward.

Database backups contain business data even when they do not contain the environment credential itself, so their encryption and access control must be treated as secret-management controls.

## 17. Production/Development/Test Separation

Recommended low-complexity topology:

| Environment | Database/role model | Classification |
| --- | --- | --- |
| Production | VPS-local `passvero` with `passvero_app`; migration and backup credentials separate | **REQUIRED BEFORE CUTOVER** |
| Development | A separate `passvero_dev` database and `passvero_dev` role, preferably developer-local PostgreSQL; an isolated hosted development database is an acceptable temporary alternative | **RECOMMENDED BEFORE CUTOVER** |
| Integration test | Existing SSH tunnel to VPS-local `passvero_test` using only `passvero_test` | **NO CHANGE** |

Normal development must never target production through an SSH tunnel. Development migrations should be applied independently to the development database. No development or test credential should connect to production, and the production runtime should not connect to either non-production database.

## 18. Test Database Preservation

The existing integration architecture remains:

`Mac/Codex -> SSH tunnel -> VPS localhost PostgreSQL -> passvero_test`

- **NO CHANGE:** keep the Task 8 safety gate, `TEST_DATABASE_URL` separation, unique fixtures, scoped cleanup, and fail-closed database identity checks.
- **NO CHANGE:** do not modify production runtime work merely to alter the proven test connection path.
- **REQUIRED BEFORE CUTOVER:** future *schema* migrations must be proven against the integration database before production deployment, but production ownership/grant operations must be reviewed independently.
- **NO CHANGE:** do not mirror production append-only restrictions to the test role when that would prevent the approved FK-safe fixture cleanup.

Production and test may share schema history, but their operational roles and grants serve different purposes and should not be coupled automatically.

## 19. Production Cutover Sequence

The future cutover should occur in this order:

1. **REQUIRED BEFORE CUTOVER:** approve backup retention, off-VPS destination, alerting, restore runbook, RPO/RTO, monitoring, and named operators.
2. **REQUIRED BEFORE CUTOVER:** establish and verify the migrator, runtime, and backup ownership/grant/default-privilege model.
3. **REQUIRED BEFORE CUTOVER:** implement the production PrismaPg runtime factory in a separate reviewed task; validate it against a non-production direct PostgreSQL database while keeping application/domain layers unchanged.
4. **REQUIRED BEFORE CUTOVER:** verify `passvero` identity, emptiness, ownership, capacity, network isolation, and service health.
5. **REQUIRED BEFORE CUTOVER:** deploy exactly the committed 16 migrations as `passvero_migrator`.
6. **REQUIRED BEFORE CUTOVER:** verify current migration status, schema inventory, owners/grants/defaults, and zero application rows.
7. **REQUIRED BEFORE CUTOVER:** create and verify an encrypted off-VPS baseline backup, then complete and sign off the isolated restore drill.
8. **REQUIRED BEFORE CUTOVER:** generate Prisma Client as part of the controlled build if required by the final build workflow; build and verify the immutable application artifact.
9. **REQUIRED BEFORE CUTOVER:** switch the protected production environment to the `passvero_app` connection without exposing its value.
10. **REQUIRED BEFORE CUTOVER:** perform a controlled PM2 restart/reload and verify the expected single-process pool budget.
11. **REQUIRED BEFORE CUTOVER:** run the read-only server-side smoke checks from Section 21 and verify application health, logs, connections, disk, and backup monitoring.
12. **REQUIRED BEFORE CUTOVER:** only with explicit approval, perform the first controlled CreateProduct write using a valid, designated tenant/actor context.
13. **REQUIRED BEFORE CUTOVER:** verify the Product, initial version, source translation, draft pointer, null published pointer, and audit row atomically, without logging sensitive fields.
14. **RECOMMENDED BEFORE CUTOVER:** observe stable runtime/backup/monitoring behavior before retiring the old hosted credential and infrastructure path.

No later step may start if an earlier required verification fails.

## 20. Rollback Strategy

### A. Pre-write rollback

Before any successful production write on self-hosted PostgreSQL:

- **REQUIRED BEFORE CUTOVER:** preserve the previous application artifact, runtime initialization, hosted database, and credential;
- revert the protected environment/runtime artifact, restart/reload PM2, and repeat the old-path health check;
- because both paths contain no business data, this rollback creates no data divergence.

### B. Post-write rollback

After the first successful self-hosted production write, a simple connection rollback is unsafe:

- **REQUIRED BEFORE CUTOVER:** stop or disable all production writes immediately when rollback is considered;
- inventory and reconcile every write since cutover;
- explicitly choose the authoritative database and use a separately approved data recovery/transfer procedure before resuming writes;
- never let both databases accept production writes.

**Single-writer cutover rule — REQUIRED BEFORE CUTOVER:** the hosted path ceases to be writable before the self-hosted path receives its first real write. Once that first write succeeds, self-hosted `passvero` is the system of record unless an explicit reconciliation procedure proves otherwise. Retaining the old credential is a rollback option, not permission for dual writes.

## 21. Smoke-Test Design

Use an operational, server-side smoke command or release script; do not add a debug route.

1. **REQUIRED BEFORE CUTOVER:** instantiate the same production Prisma runtime factory with `passvero_app` and prove a minimal safe connectivity query.
2. **REQUIRED BEFORE CUTOVER:** perform a Prisma model read such as a row count or identifier-only selection to prove schema/type/read grants without exposing data.
3. **REQUIRED BEFORE CUTOVER:** close or reuse the client according to the process lifecycle and confirm the connection count remains within the pool budget.
4. **REQUIRED BEFORE CUTOVER:** verify application/HTTP health and normal static routes independently of database details.
5. **REQUIRED BEFORE CUTOVER:** emit only a redacted PASS/FAIL result; never print a URL, credential, record payload, public code, Prisma metadata, or raw SQL error.
6. **RECOMMENDED BEFORE CUTOVER:** perform a controlled CreateProduct write only after the read-only checks pass and only with explicit operator approval and a valid real/designed tenant/actor. Do not create disposable synthetic production data casually.

The subsequent database verification should be performed by an authorized operational read path, not by expanding the application API.

## 22. Monitoring Requirements

Minimum monitoring before first write:

- **REQUIRED BEFORE CUTOVER:** PostgreSQL service health/readiness and restart state;
- **REQUIRED BEFORE CUTOVER:** filesystem utilization, with warning below 20% free and urgent action below 10 GiB or the accepted backup/database headroom;
- **REQUIRED BEFORE CUTOVER:** current/active connections versus both the application pool budget and server maximum; alert on sustained use above 70% of the operational budget or acquisition failures;
- **REQUIRED BEFORE CUTOVER:** backup exit status, checksum, offsite-copy success, artifact age, and alert when no verified artifact exists within 26 hours;
- **REQUIRED BEFORE CUTOVER:** daily database-size trend;
- **REQUIRED BEFORE CUTOVER:** PostgreSQL log alerts for `FATAL`, `PANIC`, corruption/I/O errors, out-of-memory, too-many-connections, and repeated checkpoint/storage failures;
- **REQUIRED BEFORE CUTOVER:** sanitized application database error rate and latency, without query arguments or credentials.

Simple systemd/cron/log/disk checks and a documented operator notification route are sufficient for MVP. A full observability platform is **OPTIONAL LATER**. Operational growth monitoring for append-only tables and background models is **RECOMMENDED BEFORE CUTOVER**, with thresholds refined after real usage.

## 23. Disaster Scenarios

| Scenario | Required response and rollback boundary |
| --- | --- |
| PostgreSQL service stopped | Application fails closed with a generic unavailable response; inspect service/log/disk state, restore service, then run read-only smoke checks. Do not substitute another database automatically. **REQUIRED BEFORE CUTOVER:** document escalation and safe maintenance behavior. |
| Disk full | Stop application writes; do not delete PostgreSQL data/WAL files. Expand storage or remove verified non-database temporary files, then validate database integrity and backups before resuming. **REQUIRED BEFORE CUTOVER:** disk alerts and a response runbook. |
| Corrupted backup | Quarantine it, use the last verified offsite artifact, perform an isolated restore, and investigate the backup chain. Never overwrite production to test it. **REQUIRED BEFORE CUTOVER:** more than one retained recovery point. |
| Failed migration | Stop the release before runtime/environment switch. Inspect the migration and database state; never edit applied history or reset production. Because the target is pre-write and intentionally empty, destructive reinitialization is possible only under separate explicit approval; otherwise use forward repair/restore. |
| Connection exhaustion | Fail safely, inspect leaks/process count/pool metrics, and stop the offending deployment if necessary. Do not blindly raise `max_connections`; preserve administrative headroom. |
| Deploy succeeds but DB connection fails | Before first write, revert artifact/environment and restart the old path. After first write, stop writes and follow the post-write reconciliation rule; do not redirect blindly. |

All six scenarios need named ownership, notification paths, and redacted evidence in the production runbook. This is **REQUIRED BEFORE CUTOVER**.

## 24. Go/No-Go Checklist

Only `PASS`, `FAIL`, or `NOT VERIFIED` may be recorded. Production cutover is prohibited while any required item is `FAIL` or `NOT VERIFIED`.

| Required gate | Current status | Evidence/action needed |
| --- | --- | --- |
| Hosted Prisma database contains no business data needing migration | PASS | Operator-confirmed; no export/import required. |
| PostgreSQL 16.14 is localhost-only with no public 5432 exposure | PASS | Operator-confirmed. |
| Production/test roles and databases deny cross-connections | PASS | Operator-confirmed. |
| Integration database has all 16 migrations and CreateProduct 14/14 passes | PASS | Operator-confirmed. |
| Committed migration history is the complete schema source of truth | PASS | Repository review and operator confirmation. |
| Current production runtime performs no database writes | PASS | Repository/runtime context confirmation. |
| Self-hosted `passvero` target identity and emptiness | NOT VERIFIED | Perform Section 9 read-only preflight during approved cutover preparation. |
| Production database/schema/object ownership matches Model B | NOT VERIFIED | Establish and inspect owners. |
| Migrator attributes and database restriction are correct | NOT VERIFIED | Inspect role attributes/effective connectivity. |
| Runtime grants, no DDL, no migration-table access | NOT VERIFIED | Apply and test effective privileges. |
| `AuditLog`/`ScanEvent` deny runtime update/delete | NOT VERIFIED | Test effective privileges under `passvero_app`. |
| Default privileges are creator-specific and verified | NOT VERIFIED | Verify existing and future-object policy. |
| Production PrismaPg runtime factory is implemented and reviewed | FAIL | Separate runtime implementation task is required. |
| Direct PostgreSQL runtime dependencies are available in production install | FAIL | Final runtime task must place/verify adapter and driver as production dependencies. |
| Prisma generation/build/deploy workflow is explicit and reproducible | FAIL | Define and rehearse the release workflow. |
| Production migration status is exactly 16/current | NOT VERIFIED | Deploy and verify only after preflight and approval. |
| Baseline custom-format backup is encrypted and stored off-VPS | NOT VERIFIED | Implement and prove backup job. |
| Restore drill from off-VPS artifact succeeded | NOT VERIFIED | Complete Section 11 with evidence. |
| RPO/RTO are explicitly accepted | NOT VERIFIED | Operator decision/sign-off required. |
| VPS memory, disk, SSD health, and connection capacity pass | NOT VERIFIED | Record Section 14 preflight evidence. |
| Monitoring and failure alert delivery are operational | NOT VERIFIED | Trigger and acknowledge test alerts. |
| Cutover/rollback/disaster runbook has named operators | NOT VERIFIED | Complete operational sign-off. |
| Read-only smoke procedure passed in staging-equivalent environment | NOT VERIFIED | Rehearse Section 21 without production mutation. |
| Previous artifact/hosted path retained for pre-write rollback | NOT VERIFIED | Record rollback artifact and credential retention window. |

**Current decision: NO-GO.** The absence of business data is not a blocker. The `FAIL` and `NOT VERIFIED` operational/runtime gates above are blockers.

## 25. Remaining Open Questions

The following require explicit operator evidence or decisions:

1. **REQUIRED BEFORE CUTOVER:** What are the actual VPS RAM, free/total SSD space, filesystem layout, PostgreSQL `max_connections`, and available headroom?
2. **REQUIRED BEFORE CUTOVER:** Is `passvero` currently completely uninitialized, and who presently owns the database and `public` schema?
3. **REQUIRED BEFORE CUTOVER:** What encrypted off-VPS destination, backup credential, notification channel, and named operator will be used?
4. **REQUIRED BEFORE CUTOVER:** What are the accepted MVP RPO and RTO? The proposed non-PITR design assumes an accepted RPO of up to 24 hours.
5. **REQUIRED BEFORE CUTOVER:** Who holds the migration credential and approves each immutable migration deployment?
6. **REQUIRED BEFORE CUTOVER:** What exact protected VPS environment/PM2 loading mechanism prevents secret disclosure while supporting controlled rollback?
7. **RECOMMENDED BEFORE CUTOVER:** How long is the post-cutover observation window before the hosted credential is retired?
8. **RECOMMENDED BEFORE CUTOVER:** Should the separate development database run locally on developer machines or on another isolated host?

No question remains about business-data migration: the existing hosted database is confirmed to contain no business data requiring transfer.

## 26. Final Recommendation

The proposed self-hosted PostgreSQL 16 architecture is a sound MVP destination and preserves Passvero's existing application/service/Prisma boundaries. No domain or application-service change is required solely because the physical database moves. The target stack remains Next.js, application services, narrow Prisma infrastructure adapters, Prisma Client/ORM, PrismaPg, node-postgres, and PostgreSQL 16.

Proceed only through separate, reviewed phases:

- **REQUIRED BEFORE CUTOVER:** close ownership/grant/default-privilege design and verify target capacity/identity;
- **REQUIRED BEFORE CUTOVER:** implement and validate the production PrismaPg runtime factory without changing the application/domain contracts;
- **REQUIRED BEFORE CUTOVER:** deploy the 16 migrations with the migrator and verify the empty initialized schema;
- **REQUIRED BEFORE CUTOVER:** make backup, off-VPS retention, alerting, and a successful restore drill operational;
- **REQUIRED BEFORE CUTOVER:** rehearse build, smoke, monitoring, cutover, and pre-/post-write rollback procedures;
- **OPTIONAL LATER:** add PITR, a `NOLOGIN` owner role, external pooling, or PostgreSQL tuning only when measured requirements justify them.

Until every required Go/No-Go item is `PASS`, the production decision remains **NO-GO**. Once they are all `PASS`, the cutover is operationally appropriate, with the first successful self-hosted write marking the irreversible single-writer authority boundary.
