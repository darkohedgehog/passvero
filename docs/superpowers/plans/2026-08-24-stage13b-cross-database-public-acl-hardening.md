# Stage 13B Cross-Database PUBLIC ACL Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to execute this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking. This instruction does not authorize
> execution; every production checkpoint below requires separate explicit
> operator authorization.

**Goal:** Remove only the audited cross-database privileges inherited through
PUBLIC while preserving every approved Passvero database owner, direct grant,
runtime target, test target, and recovery path.

**Architecture:** Use a fail-closed, single-transaction database-ACL
checkpoint. A fresh read-only preflight must reproduce the approved dependency,
recovery, ownership, direct-ACL, and effective-privilege baselines; one
separately authorized transaction then revokes the three exact PUBLIC-derived
capabilities; an independent read-only reconciliation proves the complete
posture without restarting services or probing unrelated systems.

**Tech Stack:** Ubuntu 24.04, PostgreSQL 16, `sudo -u postgres`, `psql`,
`pg_database`, `aclexplode`, `has_database_privilege`, `pg_stat_activity`,
`systemctl show`, and standard secret-safe shell inspection tools.

**Spec:** The approved operator design and authorization recorded in this
document, with prerequisite boundaries from
`docs/superpowers/plans/2026-08-24-stage13b-recovery-service-remediation.md`
and database-ACL conventions from
`docs/superpowers/plans/2026-08-13-production-postgresql-roles-grants.md`.

## Current Authorization

This file was created under exactly:

```text
AUTHORIZE_STAGE_13B_CROSS_DATABASE_PUBLIC_ACL_HARDENING_PLAN_DOCUMENT_ONLY=YES
DOCUMENT_PATH=docs/superpowers/plans/2026-08-24-stage13b-cross-database-public-acl-hardening.md
HARDENING_DESIGN=MINIMAL_PUBLIC_REVOKE

PRODUCTION_SQL_AUTHORIZED=NO
ACL_MUTATION_AUTHORIZED=NO
ROLE_MUTATION_AUTHORIZED=NO
HBA_MUTATION_AUTHORIZED=NO
DATABASE_CONFIGURATION_MUTATION_AUTHORIZED=NO
PASSVERO_AUTH_ROLE_CREATION_AUTHORIZED=NO
PM2_ACTIVITY_AUTHORIZED=NO
BACKUP_OR_RESTIC_ACTIVITY_AUTHORIZED=NO
MIGRATION_ACTIVITY_AUTHORIZED=NO
STAGE13C_ACTIVITY_AUTHORIZED=NO
```

Creating and reviewing this document is the entire authorized action. Nothing
in this plan is self-executing, and no checkbox authorizes production access or
mutation.

## File Map

- Create now:
  `docs/superpowers/plans/2026-08-24-stage13b-cross-database-public-acl-hardening.md`
  — the complete documentation-only operator contract.
- Modify now: none.
- Production files, PostgreSQL objects, roles, ACLs, HBA, configuration,
  credentials, services, PM2 state, backup state, and repository source: none.

## Evidence Baseline

The completed Stage 13B read-only audits and recovery remediation established:

- `CROSS_DATABASE_PUBLIC_ACL_DEPENDENCY_AUDIT=PASS`;
- `STAGE_13B_RECOVERY_OPERATIONAL_GATE=PASS`;
- runtime target: `passvero_app -> passvero -> LOOPBACK -> 5432`;
- migrator target: `passvero_migrator -> passvero -> LOOPBACK -> 5432`;
- backup target: `passvero_backup -> passvero -> LOOPBACK -> 5432`;
- retained test target: `passvero_test -> passvero_test`;
- no active or retained legitimate Passvero path requires `postgres` or
  `template1`;
- `passvero_auth` does not exist and is not authorized;
- no direct Passvero-role ACL on a prohibited database was found;
- the only audited unwanted effective capabilities came from PUBLIC.

The audited pre-hardening effective database posture was:

| Role | Database | CONNECT source | TEMPORARY source |
| --- | --- | --- | --- |
| `passvero_app` | `passvero` | explicit | none |
| `passvero_app` | `passvero_test` | none | PUBLIC |
| `passvero_app` | `postgres` | PUBLIC | PUBLIC |
| `passvero_app` | `template1` | PUBLIC | none |
| `passvero_backup` | `passvero` | explicit | none |
| `passvero_backup` | `passvero_test` | none | PUBLIC |
| `passvero_backup` | `postgres` | PUBLIC | PUBLIC |
| `passvero_backup` | `template1` | PUBLIC | none |
| `passvero_migrator` | `passvero` | owner | owner |
| `passvero_migrator` | `passvero_test` | none | PUBLIC |
| `passvero_migrator` | `postgres` | PUBLIC | PUBLIC |
| `passvero_migrator` | `template1` | PUBLIC | none |
| `passvero_test` | `passvero` | none | none |
| `passvero_test` | `passvero_test` | owner | owner |
| `passvero_test` | `postgres` | PUBLIC | PUBLIC |
| `passvero_test` | `template1` | PUBLIC | none |

These observations are evidence inputs, not permanent truth. A future execution
must reproduce them immediately before mutation and stop on drift.

## Exact Minimal Mutation Set

Only these three PUBLIC-derived capabilities are in scope:

```sql
REVOKE CONNECT, TEMPORARY ON DATABASE postgres FROM PUBLIC;
REVOKE CONNECT ON DATABASE template1 FROM PUBLIC;
REVOKE TEMPORARY ON DATABASE passvero_test FROM PUBLIC;
```

No statement targets `passvero`. No statement names a Passvero role as grantee.
Database ownership is not changed, so `postgres`, `passvero_migrator`, and
`passvero_test` retain owner capabilities on their respective databases.

## Global Constraints

- Current authorization is documentation only.
- A future preflight requires separate read-only production/database authority.
- The transaction requires the exact execution token defined in Task 2.
- Use local PostgreSQL peer administration as `postgres`; do not read, copy,
  print, rotate, or place credentials in commands.
- Never print raw environments, connection URLs, pgpass content, passwords,
  role password hashes, restic/B2 values, Telegram values, or business rows.
- Never change a database owner, role attribute, membership, password,
  connection limit, HBA rule, PostgreSQL setting, database property, schema
  ACL, relation ACL, type ACL, function ACL, sequence ACL, or default ACL.
- Never create/drop/rename a role or database, including `passvero_auth`.
- Never modify `template0`; only verify that it remains non-connectable.
- Never terminate sessions or reload/restart PostgreSQL, application services,
  backup/freshness services, or PM2.
- Never run a backup, restic, migration, Prisma command, application write, or
  Stage 13C activity.
- Never retry the mutation transaction automatically or manually after an
  error, disconnect, timeout, or ambiguous client result.
- Never perform automatic rollback or cleanup. Reconcile read-only and stop.
- Record only normalized database names, owners, booleans, counts, SQLSTATEs,
  exit statuses, and gate verdicts.
- Preserve the existing untracked recovery-remediation plan and all unrelated
  repository state.

## Nonblocking Documentation Disposition

The disaster-recovery runbook still describes the pre-Stage 13B seven-entry
default ACL baseline. The approved current baseline has six entries because
future-table SELECT for `passvero_app` was intentionally removed; future-table
SELECT for `passvero_backup` remains. This documentation mismatch is outside
this database-level PUBLIC hardening scope.

The future preflight must require the approved six-entry baseline and must not
restore the removed runtime default. This plan neither modifies the runbook nor
changes any default ACL.

---

### Task 1: Reproduce the Complete Read-Only Preflight

**Files:**

- Read only after separate authorization: PostgreSQL catalogs on the local
  production cluster.
- Read only after separate authorization:
  `/usr/local/sbin/passvero-postgres-backup` target constants.
- Read only after separate authorization: backup/freshness service and timer
  properties through `systemctl show`.
- Modify: none.

**Interfaces:**

- Consumes: the Evidence Baseline, Exact Minimal Mutation Set, and Global
  Constraints above.
- Produces: `CROSS_DATABASE_PUBLIC_ACL_HARDENING_PREFLIGHT=PASS|BLOCKED`, bound
  to a fresh normalized database/role/effective-privilege matrix.

Required future authorization token:

```text
AUTHORIZE_STAGE_13B_CROSS_DATABASE_PUBLIC_ACL_HARDENING_PREFLIGHT=READ_ONLY_ONLY
```

That token authorizes only Task 1. It does not authorize Task 2 or any mutation.

- [ ] **Step 1: Confirm cluster and database identities**

  Connect through peer authentication as OS/database role `postgres` to the
  local cluster. Before any catalog query, set the session default to read-only
  and prove:

  ```text
  SERVER_PORT=5432
  SERVER_ADDRESS=LOOPBACK_OR_LOCAL_SOCKET
  IN_RECOVERY=NO
  TRANSACTION_READ_ONLY=ON
  DEFAULT_TRANSACTION_READ_ONLY=ON
  ```

  Require these database facts:

  | Database | Owner | Allow connections |
  | --- | --- | --- |
  | `passvero` | `passvero_migrator` | true |
  | `passvero_test` | `passvero_test` | true |
  | `postgres` | `postgres` | true |
  | `template0` | `postgres` | false |
  | `template1` | `postgres` | true |

  Any identity, owner, allow-connection, port, server-address, or recovery-mode
  mismatch returns `BLOCKED`.

- [ ] **Step 2: Confirm exact role posture and zero memberships**

  Inspect only normalized attributes for `passvero_app`, `passvero_backup`,
  `passvero_migrator`, and `passvero_test`. Require all four to remain LOGIN,
  NOINHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, and
  NOBYPASSRLS, with their previously approved connection limits and settings.
  Require zero membership rows in either direction for every Passvero role.

  Do not inspect or print password hashes. Any membership or attribute drift is
  outside this plan and returns `BLOCKED`.

- [ ] **Step 3: Confirm exact database ACL sources**

  Use `pg_database.datacl` expanded through `aclexplode`, including effective
  defaults where required, to classify CONNECT, CREATE, and TEMPORARY by
  database and grantee. Require:

  ```text
  passvero      PUBLIC_ACL_ROW_COUNT=0
  postgres      PUBLIC_CONNECT=YES PUBLIC_TEMPORARY=YES PUBLIC_CREATE=NO
  template1     PUBLIC_CONNECT=YES PUBLIC_TEMPORARY=NO  PUBLIC_CREATE=NO
  passvero_test PUBLIC_CONNECT=NO  PUBLIC_TEMPORARY=YES PUBLIC_CREATE=NO
  ```

  Require no direct CONNECT, CREATE, or TEMPORARY row for a Passvero role on a
  prohibited database. Require the direct `passvero_app` and `passvero_backup`
  CONNECT grants on `passvero` to remain exact. Stop if any unexpected grantee,
  grant option, privilege source, or additional PUBLIC capability exists.

- [ ] **Step 4: Reproduce the effective four-by-four privilege matrix**

  For every combination of the four Passvero roles and `passvero`,
  `passvero_test`, `postgres`, and `template1`, evaluate CONNECT, CREATE, and
  TEMPORARY with `has_database_privilege`. Require the Evidence Baseline
  exactly, plus CREATE only through ownership for `passvero_migrator` on
  `passvero` and `passvero_test` on `passvero_test`.

  Emit one normalized row per role/database combination. Do not perform actual
  cross-database login attempts or place credentials in commands.

- [ ] **Step 5: Reconfirm zero production dependency**

  Reconfirm that no session owned by a Passvero role targets an unauthorized
  database. Reconfirm only sanitized target classifications:

  ```text
  RUNTIME_TARGET=passvero_app|passvero|LOOPBACK|5432
  MIGRATOR_TARGET=passvero_migrator|passvero|LOOPBACK|5432
  BACKUP_TARGET=passvero_backup|passvero|LOOPBACK|5432
  RETAINED_TEST_TARGET=passvero_test|passvero_test
  POSTGRES_DEPENDENCY=NO
  TEMPLATE1_DEPENDENCY=NO
  ```

  Do not read or print raw environments, URLs, pgpass passwords, or command
  lines. Any ambiguous/wildcard target or legitimate dependency returns
  `BLOCKED` and requires a new design.

- [ ] **Step 6: Reconfirm recovery health without executing recovery work**

  Require the corrected backup validator hash
  `5b6360633efb636f0aa9784b4e1a9d73aabe39a9c69f824cc99b9189407d7e75`,
  backup and freshness service results `success`, both timers enabled and
  active, canonical marker age no greater than `93600` seconds, and the newest
  `.offsite` metadata consistent with that marker.

  Do not start a service, run backup/restic, clear alerts, or modify a marker.
  Any stale/ambiguous recovery evidence returns `BLOCKED`.

- [ ] **Step 7: Confirm unrelated ACL invariants remain current**

  Require production database owner `passvero_migrator`, PUBLIC database ACL
  rows on `passvero` equal to zero, PUBLIC schema/relation/type/function ACL
  hardening intact, exact current runtime table ACLs, backup SELECT-only
  coverage, zero prohibited backup privileges, zero ownership mismatches, and
  the approved six-entry default ACL baseline.

  This step is diagnostic only. Any mismatch is not repaired here; return
  `BLOCKED`.

- [ ] **Step 8: Return the preflight verdict and stop**

  Only a complete, fresh, internally consistent result may return:

  ```text
  CROSS_DATABASE_PUBLIC_ACL_HARDENING_PREFLIGHT=PASS
  PUBLIC_REVOKE_TARGET_COUNT=3
  DIRECT_PASSVERO_ROLE_ACL_MUTATION_REQUIRED=NO
  ROLE_MUTATION_REQUIRED=NO
  HBA_OR_CONFIGURATION_MUTATION_REQUIRED=NO
  RECOVERY_OPERATIONAL_GATE=PASS
  SECRETS_EXPOSED=NO
  MUTATIONS=NONE
  ```

  Otherwise return `CROSS_DATABASE_PUBLIC_ACL_HARDENING_PREFLIGHT=BLOCKED` and
  stop without requesting execution.

### Task 2: Execute the Three PUBLIC Revokes in One Transaction

**Files:**

- Modify after separate authorization: database-level ACLs only on `postgres`,
  `template1`, and `passvero_test`.
- Modify: no file, role, owner, HBA, PostgreSQL configuration, service, PM2,
  backup/restic state, schema, relation, type, function, sequence, default ACL,
  migration, or application data.

**Interfaces:**

- Consumes: a fresh Task 1 `PASS` transcript with no intervening drift.
- Produces: one transaction result, with mutation count limited to the three
  reviewed PUBLIC revoke statements.

Required future authorization token:

```text
AUTHORIZE_STAGE_13B_CROSS_DATABASE_PUBLIC_ACL_HARDENING_EXECUTION=YES
```

This token authorizes Task 2 exactly once. It does not authorize retry,
rollback, Task 3 mutation, any role/owner/default-ACL action, `passvero_auth`,
PM2, backup/restic, migration, or Stage 13C activity.

- [ ] **Step 1: Recheck immutable execution bindings**

  Immediately before execution, recheck the production host, local cluster
  identity, Task 1 catalog snapshot hash or normalized facts, exact three
  PUBLIC capabilities, zero direct prohibited Passvero-role ACLs, and recovery
  health. Drift or an already-hardened state returns
  `HARDENING_EXECUTION_PRECHECK=BLOCKED`; execute no SQL.

- [ ] **Step 2: Execute one direct psql transaction**

  Use exactly one `psql` invocation through peer administration. Do not place
  the SQL in a persistent server file:

  ```bash
  sudo -u postgres psql \
    --no-psqlrc \
    -X \
    --dbname=postgres \
    --set ON_ERROR_STOP=on <<'SQL'
  BEGIN;
  SET LOCAL lock_timeout = '5s';
  SET LOCAL statement_timeout = '10s';

  REVOKE CONNECT, TEMPORARY ON DATABASE postgres FROM PUBLIC;
  REVOKE CONNECT ON DATABASE template1 FROM PUBLIC;
  REVOKE TEMPORARY ON DATABASE passvero_test FROM PUBLIC;

  COMMIT;
  SQL
  ```

  Invoke this block once only. Do not wrap it in a loop, timeout utility,
  retry helper, orchestration script, or follow-on SQL chain. Record only the
  `psql` exit status and three normalized command tags.

- [ ] **Step 3: Stop after the transaction result**

  If `psql` exits `0` with one `COMMIT`, proceed only to read-only Task 3. If it
  exits nonzero, disconnects, times out, or has an ambiguous result, do not
  repeat or invert any statement. Return:

  ```text
  CROSS_DATABASE_PUBLIC_ACL_HARDENING_EXECUTION=BLOCKED
  TRANSACTION_RESULT=FAILED_OR_AMBIGUOUS
  RETRY=NONE
  AUTOMATIC_ROLLBACK_OR_CLEANUP=NONE
  ```

  Then reconcile actual state read-only under a newly authorized diagnostic
  checkpoint.

### Task 3: Reconcile the Exact Post-Hardening State Read-Only

**Files:**

- Read only: the same PostgreSQL catalogs and recovery/service metadata used by
  Task 1.
- Modify: none.

**Interfaces:**

- Consumes: the one Task 2 transaction result.
- Produces:
  `CROSS_DATABASE_PUBLIC_ACL_HARDENING=PASS|BLOCKED|INCOMPLETE` with the exact
  post-hardening matrix and excluded-area evidence.

- [ ] **Step 1: Require zero PUBLIC database ACL rows on all four targets**

  Expand each `datacl` through `aclexplode` and require:

  ```text
  passvero      PUBLIC_ACL_ROW_COUNT=0
  passvero_test PUBLIC_ACL_ROW_COUNT=0
  postgres      PUBLIC_ACL_ROW_COUNT=0
  template1     PUBLIC_ACL_ROW_COUNT=0
  ```

  Also require `template0` unchanged, owned by `postgres`, and non-connectable.

- [ ] **Step 2: Require the final effective privilege matrix**

  Evaluate CONNECT, CREATE, and TEMPORARY for all sixteen role/database pairs.
  Require exactly:

  | Role | Database | CONNECT | CREATE | TEMPORARY |
  | --- | --- | --- | --- | --- |
  | `passvero_app` | `passvero` | true | false | false |
  | `passvero_app` | `passvero_test` | false | false | false |
  | `passvero_app` | `postgres` | false | false | false |
  | `passvero_app` | `template1` | false | false | false |
  | `passvero_backup` | `passvero` | true | false | false |
  | `passvero_backup` | `passvero_test` | false | false | false |
  | `passvero_backup` | `postgres` | false | false | false |
  | `passvero_backup` | `template1` | false | false | false |
  | `passvero_migrator` | `passvero` | true | true | true |
  | `passvero_migrator` | `passvero_test` | false | false | false |
  | `passvero_migrator` | `postgres` | false | false | false |
  | `passvero_migrator` | `template1` | false | false | false |
  | `passvero_test` | `passvero` | false | false | false |
  | `passvero_test` | `passvero_test` | true | true | true |
  | `passvero_test` | `postgres` | false | false | false |
  | `passvero_test` | `template1` | false | false | false |

  Owner-derived capabilities on the two legitimate owner databases are
  expected. No direct owner grant is added.

- [ ] **Step 3: Verify all preserved positive paths**

  Require `passvero_app` and `passvero_backup` direct CONNECT on `passvero`,
  `passvero_migrator` ownership of `passvero`, and `passvero_test` ownership of
  `passvero_test`. Require role attributes, connection limits, settings,
  memberships, database owners, allow-connection flags, HBA, and PostgreSQL
  configuration unchanged.

  Verify the backup identity through a read-only, forced-read-only connection
  only to `passvero`, emitting:

  ```text
  BACKUP_IDENTITY=passvero_backup|passvero|TRANSACTION_READ_ONLY
  BACKUP_SELECT_COVERAGE=COMPLETE
  BACKUP_PROHIBITED_PRIVILEGES=0
  ```

  Do not run the backup script or restic.

- [ ] **Step 4: Verify operational state without lifecycle activity**

  Require no Passvero-role session on `postgres` or `template1`, expected
  application/migrator/backup/test target classifications, corrected validator
  hash unchanged, latest backup and freshness results `success`, both timers
  enabled and active, marker age within `93600`, and no new failed unit result.

  Use `systemctl show` only. Do not use `start`, `stop`, `restart`, `reload`,
  `reset-failed`, or any PM2 command.

- [ ] **Step 5: Verify every excluded ACL area is unchanged**

  Re-run normalized hashes or catalog matrices for the `passvero` database ACL,
  public schema, all public relations/types/functions/sequences, runtime table
  ACLs, backup table ACLs, approved six-entry default ACL, ownership, role
  attributes/settings/memberships, and migration state. Require exact equality
  with Task 1.

- [ ] **Step 6: Return the hardening verdict and stop**

  Only a complete, consistent reconciliation may return:

  ```text
  CROSS_DATABASE_PUBLIC_ACL_HARDENING=PASS
  PUBLIC_REVOKE_STATEMENT_COUNT=3
  PUBLIC_DATABASE_ACL_ROW_COUNT=0
  DIRECT_PASSVERO_ROLE_ACL_MUTATIONS=NONE
  ROLE_MUTATIONS=NONE
  HBA_OR_CONFIGURATION_MUTATIONS=NONE
  DATABASE_OWNER_MUTATIONS=NONE
  PASSVERO_AUTH_ACTIVITY=NONE
  PM2_ACTIVITY=NONE
  BACKUP_OR_RESTIC_EXECUTION=NONE
  MIGRATION_ACTIVITY=NONE
  STAGE13C_ACTIVITY=NONE
  SECRETS_EXPOSED=NO
  RETRY=NONE
  ```

  Any missing or ambiguous fact returns `BLOCKED` or `INCOMPLETE`. Stop; do not
  repair, retry, roll back, or continue to another Stage 13B/13C gate.

### Task 4: Preserve Failure and Rollback Boundaries

**Files:**

- Modify: none under this plan after a failed or ambiguous checkpoint.

**Interfaces:**

- Consumes: any `BLOCKED` or `INCOMPLETE` result from Tasks 1 through 3.
- Produces: a retained normalized failure report and one new operator decision;
  it never performs an inverse mutation automatically.

- [ ] **Step 1: Classify failure without changing state**

  Report whether the blocker is pre-existing drift, dependency drift, recovery
  regression, transaction failure, ambiguous transaction result, or post-state
  mismatch. Include the exact database/role/privilege classification without
  credentials or raw ACL arrays.

- [ ] **Step 2: Reconcile transaction state before discussing rollback**

  If Task 2 was attempted, query the four target database ACLs and sixteen
  effective role/database rows from a fresh read-only session. Never infer
  rollback from the client exit status alone.

- [ ] **Step 3: Require a separate rollback plan and authorization**

  A rollback proposal may restore only the exact pre-state:

  ```sql
  GRANT CONNECT, TEMPORARY ON DATABASE postgres TO PUBLIC;
  GRANT CONNECT ON DATABASE template1 TO PUBLIC;
  GRANT TEMPORARY ON DATABASE passvero_test TO PUBLIC;
  ```

  These statements are documentation of the inverse only. They are not
  authorized by this plan and must never be executed automatically. Any partial
  or broader rollback requires a new audited plan.

## Documentation Verification

These commands are local documentation checks only:

```bash
test -f \
  docs/superpowers/plans/2026-08-24-stage13b-cross-database-public-acl-hardening.md

rg -n \
  'DOCUMENT_ONLY=YES|HARDENING_DESIGN=MINIMAL_PUBLIC_REVOKE|PRODUCTION_SQL_AUTHORIZED=NO|ACL_MUTATION_AUTHORIZED=NO|STAGE13C_ACTIVITY_AUTHORIZED=NO' \
  docs/superpowers/plans/2026-08-24-stage13b-cross-database-public-acl-hardening.md

rg -n \
  'REVOKE CONNECT, TEMPORARY ON DATABASE postgres FROM PUBLIC|REVOKE CONNECT ON DATABASE template1 FROM PUBLIC|REVOKE TEMPORARY ON DATABASE passvero_test FROM PUBLIC' \
  docs/superpowers/plans/2026-08-24-stage13b-cross-database-public-acl-hardening.md

git diff --check -- \
  docs/superpowers/plans/2026-08-24-stage13b-cross-database-public-acl-hardening.md
```

Expected: the file exists; all current no-mutation gates are preserved; the
exact three-statement design appears without any fourth target; and no
whitespace error exists.

## Completion Criteria for This Documentation-Only Authorization

- [ ] Exactly the authorized document path was created.
- [ ] No existing file was modified.
- [ ] No production SQL, ACL/role/HBA/configuration mutation, `passvero_auth`,
  PM2, backup/restic, migration, or Stage 13C activity occurred.
- [ ] The plan contains exactly three PUBLIC revoke statements in its execution
  transaction and no statement targeting `passvero`.
- [ ] Direct Passvero-role ACLs, owners, and legitimate targets are preserved.
- [ ] Future execution and rollback remain separately authorized.
- [ ] The approved six-entry default ACL baseline is preserved and the stale
  seven-entry runbook reference is not used as an execution gate.
