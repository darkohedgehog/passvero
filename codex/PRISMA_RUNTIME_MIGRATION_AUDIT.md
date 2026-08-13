# Prisma Runtime Migration Audit

**Project:** Passvero

**Audit date:** 2026-08-13

**Repository baseline:** `main` at `880cecc`

**Mode:** Read-only repository and design audit; no database connection, migration, runtime implementation, package change, or deployment was performed.

## 1. Executive Summary

Passvero can use the intended self-hosted PostgreSQL 16 runtime without changing its frozen schema, committed migrations, application-service contracts, or narrow persistence adapters. The physical database move does not require application or domain-layer changes.

The most important current-state finding is that there is no production Prisma runtime to migrate yet:

- `DATABASE_URL` is read by `prisma.config.ts` for Prisma CLI datasource operations.
- No application route, Server Action, page, worker, or other production entry point instantiates `PrismaClient`.
- No production code uses an Accelerate extension, `withAccelerate`, an `accelerateUrl` client option, `PrismaPg`, `pg.Pool`, or a global Prisma singleton.
- The CreateProduct Prisma adapter exists, but only the integration test suite composes it with a real `PrismaClient`.

The generated Prisma 7.8.0 client supports either a driver adapter or an Accelerate URL at construction time; it is not hard-wired to either transport. For direct PostgreSQL, a server-only runtime composition root must construct `PrismaPg` and pass it to `PrismaClient`. The existing CreateProduct transaction runner and persistence adapter can then be reused unchanged.

Schema deployment to the new `passvero` database is structurally straightforward: apply the 16 committed migrations with `prisma migrate deploy`, then verify status and database objects. It is not authorized by this audit and must remain a separately approved operation.

Production cutover is **NO-GO today** until all of these gates are satisfied:

1. the existing hosted database is explicitly checked for business data;
2. a data-migration or clean-deployment decision is approved from that evidence;
3. self-hosted backup, off-VPS retention, and restore testing are operational;
4. migration ownership and least-privilege runtime grants are verified;
5. a production Prisma runtime factory, generation step, deployment procedure, smoke check, and rollback rehearsal exist; and
6. the initial connection budget is checked against PostgreSQL capacity.

These are runtime and operational gates, not reasons to reopen Database Architecture Freeze v1.0.

## 2. Current Runtime Architecture

The deployed application definition is a single PM2 fork running `npm start` from `/var/www/passvero`, with Next.js bound to loopback on port 3000. `ecosystem.config.cjs` defines one instance and production mode. The repository contains no container, systemd service, automated deployment script, database health endpoint, or documented command-by-command VPS release runbook.

The application routes are currently marketing and legal pages plus sitemap and robots metadata. There are no Route Handlers, Server Actions, API routes, authenticated dashboard routes, or workers. Their import graph does not reach `src/application/products/create-product`, `src/infrastructure/persistence/prisma`, the generated Prisma client, or database environment variables.

The implemented CreateProduct vertical slice is therefore library code plus tests:

```text
integration test only
  -> createTestPrismaClient
  -> PrismaPg
  -> generated PrismaClient
  -> PrismaTransactionRunner
  -> PrismaCreateProductPersistence
  -> CreateProduct application service
```

There is no equivalent production composition root.

Classification:

| Item | Classification | Finding |
| --- | --- | --- |
| Frozen application-service and persistence boundaries | NO CHANGE | They already isolate Prisma from the application layer. |
| Production Prisma composition root | REQUIRED FOR CUTOVER | It does not exist. A database URL change alone will not make the application use PostgreSQL. |
| CreateProduct HTTP/UI/runtime wiring | OPTIONAL LATER | It is a separate feature-delivery concern, not required merely to change the physical database. |
| PM2 process model | NO CHANGE | One fork is compatible with one Prisma/node-postgres pool initially. |

## 3. Current Prisma/Accelerate Usage Inventory

| Surface | Evidence | Current use |
| --- | --- | --- |
| Prisma CLI datasource | `prisma.config.ts` | Reads `DATABASE_URL`; this is the only application-owned source read of that variable. |
| Generated Prisma Client | `src/generated/prisma/` | Generated locally and ignored by Git. It declares PostgreSQL and requires either `adapter` or `accelerateUrl` at construction. |
| Production Prisma client | Repository-wide import/call-path search | None. No production `new PrismaClient(...)` exists. |
| Bare Prisma client | Repository-wide construction search | None. The only concrete client construction passes a validated `PrismaPg` adapter and is test-only. |
| Accelerate client option | Generated client types only | Supported as generated capability, but not used by application-owned code. |
| Accelerate extension | Repository and lockfile search | No `withAccelerate`, no Prisma Accelerate extension import, and no Accelerate-specific package. |
| Direct PostgreSQL adapter | `tests/helpers/test-database.ts` | Test-only `PrismaPg` construction after fail-closed URL validation. |
| CreateProduct transaction runner | `src/infrastructure/persistence/prisma/prisma-create-product.ts` | Receives a client; opens one interactive `$transaction` per application-service attempt. |
| CreateProduct persistence adapter | Same file | Uses only the supplied transaction client and narrow use-case operations. It does not create a client, adapter, or pool. |
| Pool construction | Installed `@prisma/adapter-pg` implementation | The adapter creates a node-postgres pool when given a connection string or pool config. Application-owned code does not call `new Pool`. |
| Global singleton | Repository-wide search | None. |
| Prisma extensions | Repository-wide search | None. |

The existing operator-described Accelerate credential is configuration data, not evidence of a running Accelerate-backed application call path. In the current repository, it can be consumed by Prisma CLI commands through `prisma.config.ts`, but the Next.js runtime does not read it or instantiate a client with it.

Generated files are not application-owned initialization. Their documentation example mentions `PrismaPg`, and their option types support both transports; neither creates a live client by itself.

## 4. Current Environment Variable Inventory

Only variable names were inspected; values were not printed or copied.

| File/surface | Variable | Purpose | Classification |
| --- | --- | --- | --- |
| Ignored `.env` | `DATABASE_URL` | Prisma CLI datasource today; candidate production runtime datasource later. | REQUIRED FOR CUTOVER: replace the deployed secret with a direct localhost PostgreSQL URL only during the approved cutover. |
| Ignored `.env.test.local` | `TEST_DATABASE_URL` | Dedicated integration-test connection through the SSH tunnel. | NO CHANGE |
| `prisma.config.ts` | `DATABASE_URL` | Schema and migrations datasource for Prisma CLI. | NO CHANGE to code; the deployed value changes. |
| `tests/helpers/test-database.ts` | `TEST_DATABASE_URL`; optional comparison with `DATABASE_URL` | Fail-closed test-database safety gate. It never falls back to production. | NO CHANGE |

All `.env*` files are ignored. Neither database variable is client-public. There is no typed production environment module or startup validation for a future runtime client.

Proposed changes:

- **REQUIRED FOR CUTOVER:** validate the production runtime variable at server startup before constructing an adapter; require a direct PostgreSQL protocol, loopback host, intended database, and nonblank credentials without logging the value.
- **REQUIRED FOR CUTOVER:** inject the production secret outside Git and ensure the PM2/Next.js process actually receives it.
- **RECOMMENDED BEFORE CUTOVER:** document variable names, ownership, rotation, and deployment injection without documenting credentials.
- **NO CHANGE:** retain the test variable and its independent safety rules.

## 5. Prisma 7 Runtime Configuration

Resolved versions from the committed lockfile are:

| Component | Version | Current manifest location |
| --- | --- | --- |
| Prisma CLI | 7.8.0 | `dependencies` |
| `@prisma/client` | 7.8.0 | `dependencies` |
| `@prisma/adapter-pg` | 7.8.0 | `devDependencies` |
| `pg` | 8.23.0 | `devDependencies` |
| `@types/pg` | 8.21.0 | `devDependencies` |

`prisma.config.ts` imports `dotenv/config`, points to `prisma/schema.prisma` and `prisma/migrations`, and resolves its datasource from `DATABASE_URL`. It contains no hard-coded URL and no test fallback.

`prisma/schema.prisma` uses:

- generator provider `prisma-client`;
- output `../src/generated/prisma`; and
- datasource provider `postgresql`.

The generated client records PostgreSQL as the active provider. Its constructor type requires exactly one of a SQL driver adapter or an Accelerate URL. It does not assume one transport at generation time.

Classifications:

- **NO CHANGE:** generator provider, output path, datasource provider, schema, and migrations.
- **NO CHANGE:** Prisma 7.8.0 versions; upgrading is outside this audit.
- **REQUIRED FOR CUTOVER:** instantiate the production client with `PrismaPg`; a bare `new PrismaClient()` is not the approved direct-PostgreSQL setup for this generated client.
- **REQUIRED FOR CUTOVER:** add an explicit deployment/build `prisma generate` step. Generated client files are ignored and no current package lifecycle script guarantees generation on a fresh server checkout.
- **OPTIONAL LATER:** declare `dotenv` directly rather than relying on Prisma's transitive dependency. The current lockfile is reproducible, so this is dependency hygiene rather than a cutover blocker.

## 6. Existing PrismaPg / Task 9 Reuse Analysis

`PrismaCreateProductPersistence` is CreateProduct-specific. Its narrow eligibility read, Product/ProductVersion/translation writes, guarded draft-pointer update, audit insertion, and exact conflict translation should remain use-case infrastructure. It is not a generic repository and should not become one.

`PrismaTransactionRunner` is technically reusable for another service that adopts the same explicit transaction-client callback contract. Today its type and location are CreateProduct-oriented. Moving it solely for aesthetic reuse would be premature.

The reusable production primitive that does not yet exist is client construction and lifecycle management:

```text
server-only runtime factory
  -> reads validated production configuration
  -> creates one PrismaPg-backed PrismaClient per Node.js process
  -> supplies that client to transaction runners and narrow adapters
```

The test helper must not be extracted wholesale for production. It deliberately accepts only the test variable, requires a test-named database, compares against the production variable, and owns fixture cleanup concerns.

Classification:

| Candidate | Classification | Decision |
| --- | --- | --- |
| `PrismaCreateProductPersistence` | NO CHANGE | Reuse it by injection; do not generalize it. |
| `PrismaTransactionRunner` | NO CHANGE initially | Reuse it for CreateProduct. Extract only when a second implemented service proves identical semantics. |
| Test client factory | NO CHANGE | Keep test-only and fail-closed. |
| Production client factory/lifecycle | REQUIRED FOR CUTOVER | Add separately in the future runtime task. |
| Generic repository or generic unit of work | NO CHANGE | Do not introduce one. |

Extraction beyond the client lifecycle factory is not necessary now and would violate YAGNI.

## 7. Proposed Self-Hosted Runtime Architecture

The verified architectural target is:

```text
Next.js server runtime
  -> presentation adapter or trusted server entry point
  -> application services
  -> narrow Prisma infrastructure adapters
  -> Prisma ORM / generated Prisma Client 7.8.0
  -> PrismaPg
  -> node-postgres pool
  -> PostgreSQL 16 on VPS loopback
  -> production database passvero
```

This preserves Prisma ORM. It does not replace Prisma with raw SQL or node-postgres repositories. `pg` is the transport beneath Prisma, not an application-layer data-access API.

No application/domain changes are required solely because the physical database moves. CreateProduct continues to own each full business transaction, and persistence methods continue to receive the transaction-scoped client. No hidden nested transaction, HTTP coupling, or generic CRUD boundary is needed.

## 8. Required Runtime Changes

| Change | Classification | Scope |
| --- | --- | --- |
| Change deployed `DATABASE_URL` from the hosted path to a direct loopback PostgreSQL secret for the production role/database | REQUIRED FOR CUTOVER | Environment only, outside Git |
| Add fail-closed server-side runtime configuration validation | REQUIRED FOR CUTOVER | Future runtime infrastructure |
| Add one long-lived `PrismaPg`-backed `PrismaClient` per Node.js process | REQUIRED FOR CUTOVER | Future server-only composition root |
| Inject that client into `PrismaTransactionRunner` and narrow persistence adapters | REQUIRED FOR CUTOVER when a production DB use case is wired | Future composition root |
| Ensure adapter and `pg` packages are installed in production | REQUIRED FOR CUTOVER | Move runtime packages from development-only classification if production prunes development dependencies |
| Guarantee Prisma client generation on clean deployment | REQUIRED FOR CUTOVER | Build/release procedure or focused package script |
| Verify process shutdown/reload disposes the client/pool without connection leakage | RECOMMENDED BEFORE CUTOVER | Runtime lifecycle and PM2 smoke test |
| Add a server-only import guard to runtime database modules | RECOMMENDED BEFORE CUTOVER | Defense in depth against client bundling |
| Add a safe database connectivity/health smoke mechanism | RECOMMENDED BEFORE CUTOVER | Deployment verification; no secrets or raw errors |
| Remove Accelerate-specific application imports/extensions | NO CHANGE | None exist |
| Change generated-client provider or schema datasource provider | NO CHANGE | PostgreSQL is already correct |
| Refactor application services or domain code | NO CHANGE | Physical transport remains infrastructure-only |

There is no meaningful “Accelerate code removal” today. The actual removal surface is the deployed secret and, after verified cutover, retirement of the old credential. A production client initialization does not currently exist to convert.

## 9. No-Change Areas

- **NO CHANGE:** `prisma/schema.prisma`.
- **NO CHANGE:** all 16 committed migrations and their hashes.
- **NO CHANGE:** `prisma.config.ts` structure; it already accepts a direct PostgreSQL datasource value.
- **NO CHANGE:** Prisma generator configuration.
- **NO CHANGE:** CreateProduct application service and ports.
- **NO CHANGE:** CreateProduct transaction ownership and three-attempt collision behavior.
- **NO CHANGE:** narrow Prisma persistence methods and error translation.
- **NO CHANGE:** Product, ProductVersion, ProductTranslation, pointer, AuditLog, authorization, and tenant invariants.
- **NO CHANGE:** integration-test SSH-tunnel architecture and test safety helper.
- **NO CHANGE:** PM2's current one-process fork model for the initial deployment.
- **NO CHANGE:** Next.js presentation code merely because the database host changes.

## 10. Package Impact

| Package | Role | Cutover classification |
| --- | --- | --- |
| `@prisma/client` | Prisma ORM runtime and generated-client runtime | NO CHANGE; required |
| `prisma` | CLI for generate, validate, and migrations | NO CHANGE; required by current deployment workflow |
| `@prisma/adapter-pg` | Direct PostgreSQL Prisma driver adapter | REQUIRED FOR CUTOVER as a production runtime dependency |
| `pg` | node-postgres driver/pool | REQUIRED FOR CUTOVER as a production runtime dependency |
| `@types/pg` | Type declarations | NO CHANGE; development-only |
| Prisma Accelerate extension package | Not present | NO CHANGE; nothing to remove |
| `dotenv` | Loaded directly by Prisma config but currently supplied transitively | OPTIONAL LATER direct declaration |

No package is genuinely removable merely because Accelerate is retired: the repository contains no Accelerate-specific dependency. Do not remove Prisma ORM packages. This package analysis is separate from vulnerability auditing.

## 11. Schema Migration Readiness

Repository evidence shows a linear history of 16 committed migrations creating 21 tables and 20 enums, including the manual checks and partial indexes that Prisma schema syntax cannot express. No seed command or production seed data is configured.

The future initialization process is:

1. **REQUIRED FOR CUTOVER:** independently verify the target server, current database name, current role, loopback endpoint, and absence of any production-hosted or test target confusion.
2. **REQUIRED FOR CUTOVER:** verify that the migration principal can access only the approved production target and has the DDL ownership/privileges required by the committed history.
3. **REQUIRED FOR CUTOVER:** determine whether the new database is empty or whether any pre-existing objects require review.
4. **REQUIRED FOR CUTOVER:** apply exactly the committed migration history with `prisma migrate deploy`, using the direct production target only in a separately approved deployment window.
5. **REQUIRED FOR CUTOVER:** run read-only migration status and require all 16 migrations to be successful and current.
6. **REQUIRED FOR CUTOVER:** verify expected tables, enums, foreign keys, named checks, ordinary indexes, and manual partial unique indexes.
7. **NO CHANGE:** insert no seed or business data unless a separate approved data task requires it.

The first migration creates the `public` schema if absent. The migration role therefore needs appropriate database/schema DDL authority. The repository contains no grants, ownership changes, or default-privilege SQL; those are deployment responsibilities.

Schema migration is straightforward in design, but it remains **NO-GO to execute** until role ownership, backup, target identity, and business-data gates are closed.

## 12. Business-Data Migration Assessment

Schema migration and business-data migration are distinct:

- **Schema migration:** replay the 16 committed migrations into the new production database.
- **Business-data migration:** preserve rows already stored in the hosted database, including identifiers, relations, timestamps, publication state, and audit history.

The repository proves that the current Next.js runtime does not perform database operations and contains no production seeder. That makes a schema-only cutover plausible, but it does not prove that the hosted database is empty. Earlier CLI operations, manual administration, prototypes, or other clients could have written data.

Therefore:

- **REQUIRED FOR CUTOVER:** an operator must use a separately approved, safe read-only mechanism to inventory tables and business-row counts in the existing hosted database.
- **REQUIRED FOR CUTOVER:** if any business data exists, stop the clean-schema path and approve a dedicated export/import, validation, write-freeze, and cutover design.
- **NO CHANGE:** do not infer emptiness from the absence of application runtime wiring.

Business-data migration remains an explicit operator verification gate. This audit did not connect to either production database and cannot resolve it.

## 13. Development/Test/Production Database Separation

Recommended target model:

| Environment | Recommendation | Classification |
| --- | --- | --- |
| Production | Self-hosted `passvero`, reachable only from the VPS application over loopback with the production application role | REQUIRED FOR CUTOVER |
| Integration test | Existing Mac/Codex -> SSH tunnel -> VPS loopback -> `passvero_test` with the test role | NO CHANGE |
| Development | A separate development database and role, never `passvero` or `passvero_test` | RECOMMENDED BEFORE CUTOVER |

Option assessment:

- Keeping the Prisma-hosted database as a temporary development database is acceptable only if it is explicitly relabeled, contains no production data, uses a development credential, and cannot be confused with production. **OPTIONAL LATER bridge.**
- Creating a dedicated development database is the safest steady state. **RECOMMENDED BEFORE CUTOVER.**
- Routine development against the VPS production database through SSH is rejected. It weakens isolation and makes local mistakes production incidents. **NO CHANGE to the prohibition.**

The Task 8/9 test infrastructure requires no runtime-migration changes. It must continue to read only the test variable, reject equality with production, require a test-named database, use serial integration tests, and clean explicit fixtures.

## 14. Production Connection and Pooling Considerations

A standard direct PostgreSQL URL targeting the loopback endpoint, production application role, and `passvero` database is compatible with the current PostgreSQL datasource and `PrismaPg` 7.8.0.

`PrismaPg` accepts a connection string, a pool configuration, or an existing `pg.Pool`. When given a connection string/config it creates and owns a node-postgres pool. The installed pool defaults to a maximum of 10 connections and a 10-second idle timeout.

Initial recommendation:

- **REQUIRED FOR CUTOVER:** create one client/adapter pool per PM2 process, not one per request.
- **RECOMMENDED BEFORE CUTOVER:** with the current single PM2 instance, retain simple adapter-owned pooling and verify that the default maximum plus administrative/migration headroom fits PostgreSQL capacity.
- **RECOMMENDED BEFORE CUTOVER:** if PM2 instances increase, explicitly budget pool maximum per process so total possible connections remain below the server limit with operational headroom.
- **OPTIONAL LATER:** introduce an external pooler only after measured concurrency or connection churn justifies it.
- **NO CHANGE:** do not add connection-pooling infrastructure preemptively.

Because traffic from the application to PostgreSQL remains on the same host over loopback, SSL may be omitted or explicitly disabled unless local TLS is deliberately configured. TLS is not a substitute for keeping PostgreSQL loopback-only. Remote development or test traffic must continue through SSH rather than exposing port 5432.

## 15. Deployment Cutover Sequence

This is a high-level release ordering, not an executable implementation plan.

1. **REQUIRED FOR CUTOVER:** close the business-data decision and define a write-freeze if data transfer is necessary.
2. **REQUIRED FOR CUTOVER:** establish and test backups for the new database; retain a recoverable snapshot/export of the old hosted database where authorized.
3. **REQUIRED FOR CUTOVER:** verify production target identity, migration role, runtime role, schema ownership, grants, and network isolation.
4. **REQUIRED FOR CUTOVER:** initialize the self-hosted schema from the 16 committed migrations and verify it without seed/business writes.
5. **REQUIRED FOR CUTOVER:** deploy reviewed runtime-factory/package changes and explicitly generate Prisma Client on the release artifact.
6. **REQUIRED FOR CUTOVER:** build the application using the established production process.
7. **REQUIRED FOR CUTOVER:** inject the direct production secret outside Git and restart/reload the single PM2 process in a controlled window.
8. **REQUIRED FOR CUTOVER:** run application, database-connectivity, transaction, and tenant-safe smoke checks; inspect sanitized logs and pool/database health.
9. **RECOMMENDED BEFORE CUTOVER:** monitor connection count, errors, latency, locks, disk, and backup status through an agreed observation window.
10. **OPTIONAL LATER:** retire the hosted service and rotate/revoke its credential only after cutover and rollback criteria are satisfied.

The repository does not currently specify `npm ci`, Prisma generation, migration deployment, health checks, or PM2 reload in one auditable runbook. That gap must be closed before execution.

## 16. Rollback Strategy

Before cutover:

- retain the existing hosted database and credential;
- retain the prior release artifact/commit and prior environment configuration;
- capture a verified backup of the new self-hosted database;
- define who can stop writes and invoke rollback; and
- rehearse restoration of the previous code/environment followed by rebuild and PM2 restart/reload.

Before the first write to the new database, rollback can be a connection/runtime rollback to the hosted system if the old database remains authoritative and unchanged.

After the first production write to the new database, a blind URL rollback is prohibited. It can split authoritative state across two databases. The cutover rule is:

> Only one database may accept production writes at a time. If rollback is required after new-database writes begin, stop application writes first, identify and reconcile every post-cutover write, select one authoritative data set, and only then restore service.

This audit does not design replication. If near-zero-downtime bidirectional safety is required, that is a separate architecture task.

Classifications:

- **REQUIRED FOR CUTOVER:** retained old service/credential and a tested pre-write rollback.
- **REQUIRED FOR CUTOVER:** explicit single-writer rule and post-write reconciliation gate.
- **RECOMMENDED BEFORE CUTOVER:** time-bounded rollback decision point and named operator ownership.
- **OPTIONAL LATER:** revoke the Accelerate credential after the rollback window and data-authority decision close.

## 17. Backup and Restore Prerequisites

The earlier Database Production Audit already identified recovery readiness as a before-production operational gate. Self-hosting makes that gate mandatory before the first production write.

Minimum prerequisites:

- **REQUIRED FOR CUTOVER:** an initial logical backup of the production database after schema/data initialization and before writes;
- **REQUIRED FOR CUTOVER:** an automated recurring backup schedule appropriate to the accepted recovery point objective;
- **REQUIRED FOR CUTOVER:** encrypted off-VPS copies so VPS loss does not destroy the database and backups together;
- **REQUIRED FOR CUTOVER:** at least one restore drill into an isolated non-production target, with documented recovery time and integrity checks;
- **REQUIRED FOR CUTOVER:** defined retention, expiry, monitoring, and failure alerting;
- **REQUIRED FOR CUTOVER:** protected backup credentials, least-privilege access, and no secrets in logs or Git; and
- **RECOMMENDED BEFORE CUTOVER:** documented ownership for recovery decisions and periodic restore rehearsal.

A backup job that has never produced a verified restore is not sufficient. The new production runtime remains NO-GO until this evidence exists.

## 18. Security Review

The operator-described topology is sound: PostgreSQL 16 listens only on VPS loopback, port 5432 is not publicly exposed, production and test use distinct databases and roles, and each role is restricted from connecting to the other database.

Repository-aligned requirements:

- **REQUIRED FOR CUTOVER:** preserve loopback-only PostgreSQL listening and no firewall exposure for 5432.
- **REQUIRED FOR CUTOVER:** production runtime uses only `passvero_app` against `passvero`; integration tests use only `passvero_test` against `passvero_test`.
- **REQUIRED FOR CUTOVER:** secrets remain outside Git and are never logged, included in client bundles, returned in errors, or stored in AuditLog metadata.
- **REQUIRED FOR CUTOVER:** verify `pg_hba.conf`, CONNECT privileges, schema `USAGE`, table DML grants, and object ownership from an approved administrative path.
- **RECOMMENDED BEFORE CUTOVER:** use a separate migration/deployment principal for DDL. If the application role performs migration initially, reduce it to runtime privileges afterward.
- **RECOMMENDED BEFORE CUTOVER:** make default privileges explicit so future migrations do not create objects inaccessible to the runtime role or overprivileged by accident.
- **RECOMMENDED BEFORE CUTOVER:** reinforce append-only contracts by denying ordinary runtime UPDATE/DELETE on `AuditLog` and `ScanEvent` where operationally practical.
- **RECOMMENDED BEFORE CUTOVER:** place the client factory and Prisma persistence modules behind an explicit server-only boundary.
- **NO CHANGE:** application-service authorization, tenant predicates, guarded mutations, DTO allowlists, and error translation remain mandatory; database role isolation does not replace them.

The committed migrations contain no GRANT, REVOKE, ownership, or default-privilege statements. Consequently, CONNECT restrictions alone do not prove that migrations can run or that the runtime role has the correct least privilege. This is an operator verification gate, not a schema change request.

No hard-coded credential, raw database URL, API key, or production secret was found in tracked application/config files reviewed for this audit.

Security finding summary:

| Rule ID | Severity | Location/evidence | Impact | Required response | False-positive boundary |
| --- | --- | --- | --- | --- | --- |
| DB-RUNTIME-001 | Medium before production writes | The migration history has no grants/default privileges, and the repository has no production role runbook. | A migration may fail, or the application role may be unable to use objects or may retain unnecessary DDL/data privileges. | **REQUIRED FOR CUTOVER:** verify ownership and grants; **RECOMMENDED BEFORE CUTOVER:** separate migration and runtime principals. | Controls may already exist on the VPS, but they were intentionally not queried in this audit. |
| DB-RUNTIME-002 | Medium at future runtime wiring | No server-only production client factory or startup database-target validation exists. | A future entry point could construct clients repeatedly, receive the wrong target, or leak infrastructure detail if implemented ad hoc. | **REQUIRED FOR CUTOVER:** one validated per-process factory with safe error handling; **RECOMMENDED BEFORE CUTOVER:** explicit server-only guard. | There is no current production DB call path, so this is a cutover gate rather than a presently reachable vulnerability. |
| DB-RECOVERY-001 | High once self-hosted writes begin | `DATABASE_PRODUCTION_AUDIT.md` and current repository inspection provide no backup schedule, off-VPS copy, retention evidence, or restore-drill result. | VPS loss or operator error could cause unrecoverable production data loss. | **REQUIRED FOR CUTOVER:** satisfy every prerequisite in Section 17 before the first write. | External operations may exist, but repository evidence cannot establish them; operator proof closes the finding. |

## 19. Risks and Open Questions

| Risk or question | Classification | Required resolution |
| --- | --- | --- |
| Does the existing hosted database contain business rows? | REQUIRED FOR CUTOVER | Operator-approved read-only inventory; repository cannot prove emptiness. |
| Who owns the new database and `public` schema, and which role runs migrations? | REQUIRED FOR CUTOVER | Verify ownership and choose a least-privilege migration/runtime split. |
| Are runtime grants and future default privileges correct? | REQUIRED FOR CUTOVER | Administrative verification after migrations, before application writes. |
| Are backups automated, off-VPS, retained, monitored, and restore-tested? | REQUIRED FOR CUTOVER | Produce operational evidence. |
| How is Prisma generation guaranteed on a clean deploy? | REQUIRED FOR CUTOVER | Add it to the reviewed release process. |
| How are production secrets injected into PM2/Next.js? | REQUIRED FOR CUTOVER | Document a secret-safe mechanism; current ecosystem file only sets production mode. |
| What smoke check proves database connectivity without leaking details or mutating business data? | RECOMMENDED BEFORE CUTOVER | Define a safe operational check. |
| Does the default pool budget fit PostgreSQL with administrative headroom? | RECOMMENDED BEFORE CUTOVER | Verify server limit and one-process budget. |
| What is the accepted rollback window and write-freeze procedure? | REQUIRED FOR CUTOVER | Approve before runtime switch. |
| Should the hosted database become temporary development infrastructure? | OPTIONAL LATER | Only after proving it has no production data and rotating to development-only credentials. |

There are no identified schema or application-architecture blockers.

## 20. Recommended Implementation Phases

These phases describe gates and deliverables only; they are not an implementation plan.

### Phase A — Runtime adapter/config design

- **REQUIRED FOR CUTOVER:** design the server-only Prisma client factory, fail-closed environment validation, client lifecycle, dependency classification, generation step, and injection into existing narrow adapters.
- **RECOMMENDED BEFORE CUTOVER:** define safe pool-error handling and sanitized health/smoke behavior.

### Phase B — Self-hosted production DB initialization

- **REQUIRED FOR CUTOVER:** close data inventory, backup, target identity, migration ownership, deploy all 16 migrations, verify database objects, and apply least-privilege runtime grants.
- **NO CHANGE:** no seed data, schema redesign, migration 17, or test-database modification.

### Phase C — Local/staging verification

- **REQUIRED FOR CUTOVER:** verify the runtime factory and full application/integration behavior against an isolated non-production direct PostgreSQL target with the same adapter path.
- **RECOMMENDED BEFORE CUTOVER:** rehearse clean build/generation, process reload, pool shutdown, smoke checks, and rollback.

### Phase D — Production cutover

- **REQUIRED FOR CUTOVER:** enforce the single-writer rule, initialize or transfer approved data, inject the new secret, deploy/build/restart, smoke-test, and observe.
- **REQUIRED FOR CUTOVER:** invoke rollback only under the data-authority rules in Section 16.

### Phase E — Post-cutover cleanup/credential rotation

- **OPTIONAL LATER:** after the observation and rollback windows close, archive or retire hosted infrastructure and rotate/revoke the old credential.
- **RECOMMENDED BEFORE CUTOVER:** continue backup validation, capacity monitoring, and restore drills as ongoing operations.

## 21. Go / No-Go Criteria

### GO only when

- the old database's business-data state is verified and an approved schema-only or data-transfer path is selected;
- the new target and roles are independently identified;
- all 16 committed migrations apply and status is current;
- expected manual checks and partial indexes are verified;
- production and test roles cannot cross-connect;
- runtime DML and schema privileges are least-privilege and documented;
- backups, off-VPS retention, monitoring, and a restore drill pass;
- a PrismaPg-backed production client factory, Prisma generation, dependency placement, and PM2 lifecycle are verified;
- direct-runtime application and integration checks pass on a non-production target;
- pool capacity and operational headroom are accepted;
- secret injection, smoke verification, observability, and rollback are rehearsed; and
- one authoritative writer is enforced throughout cutover.

### NO-GO if

- hosted business-data state is unknown;
- production target identity or role ownership is ambiguous;
- any migration is pending, failed, altered, or unexpected;
- backup or restore evidence is absent;
- production needs development-only packages that deployment omits;
- generated Prisma Client is missing from the release artifact;
- the application can connect to the test database or the test role to production;
- PostgreSQL is reachable publicly;
- credentials appear in Git, logs, errors, or client bundles;
- rollback would switch databases after writes without reconciliation; or
- runtime verification depends on mutating production as its first proof.

Current decision: **NO-GO for production cutover; GO for a separately approved Phase A design/implementation task after the operator resolves the business-data and ownership questions.**

## 22. Final Recommendation

Keep Prisma ORM and the frozen application architecture. Implement a small server-only runtime composition root that validates the direct production configuration, creates one `PrismaPg`-backed Prisma Client per PM2 process, and injects it into the existing transaction runner and narrow persistence adapters. Do not generalize the CreateProduct adapter and do not change the schema, migrations, service, test safety boundary, or generator.

Treat the self-hosted production database as a new environment with explicit identity, migration ownership, grants, backups, restore proof, and a single-writer cutover. Do not assume the hosted database is empty. If operator verification finds business data, stop and commission a separate data-migration design before production initialization or cutover.

The proposed stack is technically compatible and architecturally preferred, but the runtime move should proceed only through the five gated phases above. The immediate next activity should be a separately approved runtime adapter/config design task—not migration execution, deployment, or database mutation.
