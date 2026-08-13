# Production PostgreSQL Phase 1 Preflight

**Review date:** 2026-08-13

**Scope:** Corrected Phase 1 read-only preflight only

**Canonical repository:** local `main` synchronized with live `origin/main` at `3233c4df5ec9cadfe06fd5af9154bf6629891aa3`

**Evidence basis:** local read-only repository inspection, earlier read-only VPS host inspection, and operator-verified read-only PostgreSQL catalog/network evidence supplied on 2026-08-13

## 1. Executive Summary

The corrected Phase 1 preflight passes. Repository source truth and deployed
VPS state were evaluated separately:

- the canonical local `main` matches live `origin/main`, contains
  `prisma/schema.prisma`, the roles/grants plan, and exactly the 16 approved
  migration directories;
- the VPS deployment checkout differs from canonical `main` and did not expose
  `prisma/migrations`, but this is deployment checkout drift rather than a
  PostgreSQL integrity or Phase 1 readiness failure; and
- operator-verified PostgreSQL evidence confirms the production database is
  empty and uninitialized, role attributes and cross-database isolation match
  expectations, `passvero_test` remains isolated, and PostgreSQL is exposed
  only on loopback with no UFW rule for port 5432.

`passvero_app` currently owns `passvero`. Through database ownership and the
`pg_database_owner`-owned `public` schema, it consequently has database
`CREATE`/`TEMPORARY` and schema `CREATE`. This is the expected pre-Phase-2
state and the exact authority the approved ownership-transfer and ACL-hardening
phases are designed to remove. It is not treated as an unexpected privilege
path or Phase 1 blocker.

No Phase 2 operation was executed.

## 2. Canonical Repository State

| Check | Result |
| --- | --- |
| Branch | `main` |
| Canonical commit | `3233c4df5ec9cadfe06fd5af9154bf6629891aa3` |
| Live `origin/main` | Same commit |
| Ahead/behind | 0/0 |
| Tracked working tree | Clean |
| Existing untracked planning artifacts | Roles/grants plan and this Phase 1 report |
| `prisma/schema.prisma` | Present |
| Roles/grants implementation plan | Present |
| Canonical migration directories | Exactly 16 |

Canonical migration inventory:

1. `20260717191316_init_identity_domain`
2. `20260720170638_add_product_core_and_passport`
3. `20260720172426_add_product_translation`
4. `20260720173610_add_product_identifier`
5. `20260720175253_add_product_material`
6. `20260720182219_add_document_asset`
7. `20260720184244_add_product_document`
8. `20260720190323_add_product_image`
9. `20260721163104_add_qr_code`
10. `20260721173458_add_scan_event`
11. `20260721180144_add_audit_log`
12. `20260721182339_add_plan`
13. `20260721190547_add_subscription`
14. `20260722171607_add_notification`
15. `20260722180124_add_integration_mapping`
16. `20260722184010_add_background_job`

This local repository is the authoritative migration source for subsequent
reviewed phases.

## 3. PostgreSQL Instance

| Check | Verified state |
| --- | --- |
| PostgreSQL version | PostgreSQL 16.14 |
| Cluster | `16/main` |
| Port | 5432 |
| `listen_addresses` | `localhost` |
| IPv4 listener | `127.0.0.1:5432` |
| IPv6 listener | `::1:5432` |
| Public listener | None |

The earlier host inspection also observed cluster `16/main` online and the
corresponding service active. No service restart or reload occurred.

## 4. Database Inventory

| Database | Owner | Encoding | Locale |
| --- | --- | --- | --- |
| `passvero` | `passvero_app` | UTF8 | `C.UTF-8` |
| `passvero_test` | `passvero_test` | UTF8 | `C.UTF-8` |

The supplied effective privilege evidence confirms each application/test role
can connect only to its intended database. Raw credential values and connection
strings were neither used nor recorded.

## 5. Role Inventory

| Attribute | `passvero_app` | `passvero_test` |
| --- | --- | --- |
| LOGIN | true | true |
| SUPERUSER | false | false |
| CREATEDB | false | false |
| CREATEROLE | false | false |
| INHERIT | false | false |
| REPLICATION | false | false |
| BYPASSRLS | false | false |
| Connection limit | unlimited/default | unlimited/default |
| Role memberships | none | none |

Neither role has an unexpected administrative attribute or privilege-bearing
membership. `passvero_migrator` is not asserted to exist in this pre-Phase-2
state; creating it belongs exclusively to Phase 2.

## 6. Cross-Database Isolation

Operator-verified `has_database_privilege(..., 'CONNECT')` results:

| Role | `passvero` | `passvero_test` |
| --- | --- | --- |
| `passvero_app` | true | false |
| `passvero_test` | false | true |

The matrix exactly matches the approved isolation boundary. Because PostgreSQL
privileges are additive, the false cross-database results also prove PUBLIC or
membership-derived `CONNECT` does not defeat that boundary for these roles.

## 7. Production Database Ownership

The current owner of `passvero` is `passvero_app`.

This is the expected pre-Phase-2 state. Database ownership confers inherent
owner authority even when an ACL does not list the same privilege explicitly.
Later approved phases must transfer ownership before the runtime role can be
considered least-privilege; no transfer occurred in this task.

## 8. Public Schema Ownership and ACL

The production `public` schema has this verified state:

| Principal | Effective/schema ACL |
| --- | --- |
| Owner | `pg_database_owner` |
| `pg_database_owner` | USAGE + CREATE |
| PUBLIC | USAGE |
| `passvero_app` effective USAGE | true |
| `passvero_app` effective CREATE | true |

Because `passvero_app` owns `passvero`, it participates in the implicit
database-owner role represented by `pg_database_owner` for that database.
Its schema `CREATE` authority is therefore ownership-derived. PUBLIC does not
have schema `CREATE` in the supplied ACL.

## 9. Production Database Emptiness

The production database is confirmed empty and uninitialized through
operator-executed read-only metadata/catalog inspection:

| Inventory check | Result |
| --- | ---: |
| `_prisma_migrations` exists | false |
| Public base tables | 0 |
| Public enum types | 0 |
| Public tables/partitioned tables/views/materialized views/sequences/foreign tables | 0 rows |
| Public user-created functions | 0 rows |

No Passvero application schema object, migration history, sequence, function,
view, materialized view, foreign table, or enum was found. No unexpected
non-system schema was reported by the operator verification.

Application row inventory: not applicable because the schema is not
initialized and no application table exists.

## 10. Existing Object Inventory

There are no production application objects to inventory or re-own before the
approved ownership bootstrap. In particular:

- no table or partitioned table exists;
- no view or materialized view exists;
- no sequence exists;
- no foreign table exists;
- no application enum exists;
- no user-created function exists; and
- no `_prisma_migrations` table exists.

With no application relations or functions present, there can be no
application-owned trigger attached to an application relation. No ownership or
catalog change was performed.

## 11. PUBLIC Privilege Review

Confirmed privilege state relevant to the Phase 1 gate:

- cross-database `CONNECT` isolation is exact; PUBLIC does not yield effective
  cross-connect access to either scoped role;
- PUBLIC has `USAGE`, but not `CREATE`, on production schema `public`;
- `passvero_app` effectively has database `CONNECT`, `CREATE`, and
  `TEMPORARY`; and
- `passvero_app` effectively has schema `USAGE` and `CREATE`.

The operator evidence supplied effective database privileges for
`passvero_app`, not a standalone three-boolean PUBLIC database row. No
unsupported PUBLIC database `CREATE`/`TEMPORARY` value is inferred. This is not
a readiness blocker: database ownership fully explains the runtime role's
current effective authority, cross-database CONNECT isolation passes, and the
approved Phase 4 explicitly normalizes all production database and schema ACLs
after ownership transfer.

## 12. Runtime Effective Privilege Review

`passvero_app` currently can:

- connect to `passvero`;
- create schemas or other database-level objects allowed by database-owner
  authority;
- create temporary objects; and
- create objects in `public` through `pg_database_owner` schema ownership.

It cannot gain cluster administration from those rights: the role remains
non-superuser, cannot create databases or roles, cannot replicate, cannot
bypass RLS, has `NOINHERIT`, and has no memberships.

The effective DDL authority is expected only while `passvero_app` owns the
empty database. It must not survive the later ownership/grant hardening, but it
does not conflict with the approved pre-Phase-2 baseline.

No mutation-based permission probe was performed.

## 13. Test Database Preservation

The operator verification confirms:

- `passvero_test` still exists;
- its owner remains `passvero_test`;
- production/test CONNECT isolation remains exact; and
- no test data or schema was inspected or mutated for this corrected report.

The test database's migrations, fixtures, tables, and application rows were
not queried. Its established SSH-tunnel workflow remains outside production
ownership work.

## 14. Network Exposure Review

PostgreSQL is configured with `listen_addresses = localhost` and has only
loopback socket listeners at `127.0.0.1:5432` and `::1:5432`.

Operator-verified UFW state exposes only ports 22, 80, and 443. There is no
PostgreSQL or port 5432 allow rule. PostgreSQL is not publicly exposed, and no
firewall or server configuration was changed.

## 15. Deployment Checkout Drift

`DEPLOYMENT CHECKOUT DRIFT — later deployment reconciliation required`

The VPS application checkout was observed on `main` at
`c38df8498e4c4e10bc2c45e429d84f2c57041e26`, differing from canonical local and
live `origin/main` at `3233c4df5ec9cadfe06fd5af9154bf6629891aa3`. During the
inspection, `/var/www/passvero/prisma/migrations` was absent.

This is a later deployment/release reconciliation concern. The VPS application
checkout is not the authoritative migration-source checkout for Phase 1, so
the drift is not evidence of PostgreSQL corruption, unexpected schema state,
or failure of the corrected preflight.

No Git pull, checkout change, file synchronization, build, deployment, or PM2
action was performed on the VPS.

## 16. Deviations from Expected State

No material PostgreSQL deviation was identified:

- production is empty and uninitialized;
- `_prisma_migrations` is absent;
- owners match the expected pre-Phase-2 state;
- roles have no administrative attributes or memberships;
- CONNECT isolation is correct;
- test ownership is preserved; and
- PostgreSQL is loopback-only with no UFW exposure.

The runtime role's current database/schema CREATE authority is expected because
it still owns `passvero`; it is planned hardening work, not a Phase 1 anomaly.
Deployment checkout drift is separately recorded in Section 15 and does not
block Phase 2 database-role bootstrap.

## 17. Phase 2 Readiness and Stop Conditions

All corrected Phase 1 material stop conditions are clear:

| Stop condition | Result |
| --- | --- |
| Canonical local `main` differs from live `origin/main` | Not triggered |
| Canonical migration count differs from 16 | Not triggered |
| Unexpected production application/schema objects | Not triggered |
| Unexpected `_prisma_migrations` | Not triggered |
| CONNECT isolation mismatch | Not triggered |
| `passvero_test` owner mismatch | Not triggered |
| Unexpected runtime administrative membership/attribute | Not triggered |
| Public PostgreSQL listener | Not triggered |
| Verification requires mutation | Not triggered; operator evidence was read-only |

Phase 2 may be considered only under its own explicit authorization and
prerequisites. This report does not authorize or execute it.

## 18. Final Verdict

`READY FOR PHASE 2`

This corrected report used supplied operator-verified read-only PostgreSQL
evidence. During its preparation, no SQL command or PostgreSQL connection was
run by the report author. No database, schema, role, password, ownership,
grant, default privilege, PostgreSQL/UFW configuration, service, Prisma
migration, application code, environment file, deployment checkout,
production data, or test data was created, altered, or removed.
