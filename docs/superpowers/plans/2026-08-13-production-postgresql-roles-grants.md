# Production PostgreSQL Roles and Grants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish and prove the production PostgreSQL ownership boundary in
which `passvero_migrator` owns and migrates `passvero`, while `passvero_app`
owns no schema objects and has only the runtime privileges required by the
approved Passvero services.

**Architecture:** A local PostgreSQL administrator creates one dedicated
deployment login and transfers the currently empty production database and
`public` schema to it before any migration is applied. Prisma deploys the 16
committed migrations as that owner. Existing-object grants and creator-specific
default privileges are then reconciled explicitly, with `AuditLog`,
`ScanEvent`, and `_prisma_migrations` receiving stricter exceptions. Catalog
queries and transactionally safe negative probes prove effective privileges
before Prisma runtime smoke verification.

**Tech Stack:** PostgreSQL 16.14 on Ubuntu 24.04.4 LTS, Prisma ORM/CLI 7.8.0,
PrismaPg, node-postgres, local peer-authenticated PostgreSQL administration,
PM2/Next.js production runtime.

## Global Constraints

- This plan is executed only in a separately approved VPS operations task.
- PostgreSQL remains bound to localhost:5432; never add a public UFW rule.
- Target production database is exactly `passvero`.
- Current production database owner is expected to be exactly `passvero_app`.
- Target migration owner is exactly `passvero_migrator`.
- Runtime role is exactly `passvero_app`.
- `passvero_test` remains owned by `passvero_test` and is never migrated,
  re-owned, or re-granted by this plan.
- The existing hosted database contains no business data; no data export or
  import belongs in this plan.
- Production `passvero` must be empty and uninitialized before Phase 2.
- Apply exactly the 16 committed migrations; do not create migration 17.
- Never run `prisma migrate dev`, `prisma migrate reset`, `prisma db push`,
  `prisma db pull`, `prisma migrate resolve`, or seed commands.
- Never edit an applied migration.
- Prisma remains pinned to 7.8.0; no package upgrade belongs in this plan.
- Do not change `prisma.config.ts`: it already resolves the migration datasource
  from `DATABASE_URL` and accepts a deployment-scoped migrator connection.
- Never put a password or connection URL in Git, shell history, a command-line
  argument, evidence output, PM2 configuration, or logs.
- Do not use the runtime credential for Prisma CLI migrations.
- The application process never runs as the PostgreSQL `postgres` role or the
  operating-system root user; administrator access is limited to named
  checkpoint operations and recovery.
- Do not give `passvero_app` schema ownership, `CREATE`, `TEMPORARY`, DDL,
  administration, or `_prisma_migrations` access.
- Do not use `REASSIGN OWNED`, `DROP OWNED`, triggers, RLS, or a generic grant
  such as full DML on every table.
- Every phase has a stop gate. Do not continue merely because a later rollback
  appears possible.
- No first production business write is authorized by this plan.

---

## Authoritative Inputs and Syntax Basis

Repository authority, in order:

1. `prisma/schema.prisma`
2. the 16 committed `prisma/migrations/*/migration.sql` files
3. `codex/DATABASE_ARCHITECTURE_FREEZE_v1.0.md`
4. `codex/SERVICE_INVARIANTS.md`
5. `codex/TRANSACTION_AND_PERSISTENCE_BOUNDARIES.md`
6. `codex/PRODUCTION_POSTGRESQL_READINESS_REVIEW.md`
7. `codex/PRISMA_RUNTIME_MIGRATION_AUDIT.md`

The SQL syntax and privilege semantics in this plan were checked against the
official PostgreSQL 16 documentation for
[`CREATE ROLE`](https://www.postgresql.org/docs/16/sql-createrole.html),
[`ALTER DEFAULT PRIVILEGES`](https://www.postgresql.org/docs/16/sql-alterdefaultprivileges.html),
[schemas](https://www.postgresql.org/docs/16/ddl-schemas.html), and
[privileges](https://www.postgresql.org/docs/16/ddl-priv.html).

PostgreSQL-specific decisions that execution must preserve:

- `ALTER DEFAULT PRIVILEGES` affects only future objects created by the named
  current role. Role-membership defaults are not inherited at object creation.
- Per-schema default privileges can add grants, but cannot undo a global PUBLIC
  default. Therefore PUBLIC `EXECUTE` on future functions and PUBLIC `USAGE` on
  future types are revoked with global, database-local default ACL statements
  that omit `IN SCHEMA`.
- PostgreSQL 15+ clusters normally revoke PUBLIC `CREATE` on `public`, but an
  upgraded, restored, or manually created database can differ. The actual ACL
  is verified and then hardened explicitly; the Ubuntu package default is not
  assumed.
- Database ownership inherently carries owner authority. Transferring
  `passvero` away from `passvero_app` is mandatory; an ACL revoke alone cannot
  make the database owner least-privilege.

## Migration Object Inventory

Static inspection of all 16 committed migrations produced this exact
inventory:

```text
20260717191316_init_identity_domain
20260720170638_add_product_core_and_passport
20260720172426_add_product_translation
20260720173610_add_product_identifier
20260720175253_add_product_material
20260720182219_add_document_asset
20260720184244_add_product_document
20260720190323_add_product_image
20260721163104_add_qr_code
20260721173458_add_scan_event
20260721180144_add_audit_log
20260721182339_add_plan
20260721190547_add_subscription
20260722171607_add_notification
20260722180124_add_integration_mapping
20260722184010_add_background_job
```

| Object class | Count | Inventory/notes |
| --- | ---: | --- |
| Application tables | 21 | `User`, `Organization`, `Membership`, `Invitation`, `Product`, `ProductVersion`, `Passport`, `ProductTranslation`, `ProductIdentifier`, `ProductMaterial`, `Document`, `ProductDocument`, `ProductImage`, `QRCode`, `ScanEvent`, `AuditLog`, `Plan`, `Subscription`, `Notification`, `IntegrationMapping`, `BackgroundJob` |
| Enum types | 20 | `OrganizationStatus`, `MembershipRole`, `MembershipStatus`, `InvitationStatus`, `ProductLifecycleStatus`, `ProductVersionStatus`, `ProductIdentifierType`, `DocumentStatus`, `PassportStatus`, `QRCodeStatus`, `ScanDeviceType`, `ScanReferrerType`, `PlanStatus`, `SubscriptionStatus`, `BillingProvider`, `NotificationType`, `NotificationStatus`, `IntegrationMappingStatus`, `BackgroundJobScope`, `BackgroundJobStatus` |
| Explicit non-unique indexes | 88 | Created by committed migration SQL. |
| Explicit unique indexes | 27 | Includes Prisma-declared unique constraints and six manual partial unique indexes. |
| Manual partial unique indexes | 6 | `ux_invitation_one_pending_per_organization_email`, `ux_product_version_one_active_draft`, both null-account `IntegrationMapping` indexes, and both active `BackgroundJob` deduplication indexes. |
| Named CHECK constraints | 77 | All `ck_*` constraints in committed SQL. |
| Foreign keys | 41 | Explicit `RESTRICT`, `SET NULL`, or `CASCADE`; every update action is `CASCADE`. |
| Primary keys | 21 application primary keys | Prisma additionally creates/manages `_prisma_migrations` and its key during deployment. |
| Sequences | 0 | UUID values are application-generated; there is no serial/identity sequence. |
| Functions/procedures | 0 | No stored routine is created. |
| Triggers | 0 | Append-only behavior deliberately uses services and roles, not triggers. |
| Views/materialized views | 0 | None. |
| Extensions | 0 | None created by Passvero migrations. |
| Grants/ownership/default ACL | 0 | These are operational responsibilities implemented by this plan. |

Indexes and constraints do not receive independent runtime grants. Their
ownership follows the migration-created table/object owner. `_prisma_migrations`
is not declared by application migration SQL; Prisma Migrate creates and uses
it under the migration connection identity. Prisma Client runtime does not
query it.

## Final Role and Privilege Matrix

### Role attributes

| Role | LOGIN | INHERIT | SUPERUSER | CREATEDB | CREATEROLE | REPLICATION | BYPASSRLS | Purpose |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `passvero_migrator` | yes | no | no | no | no | no | no | Reviewed migration deployment and object ownership only. |
| `passvero_app` | yes | no | no | no | no | no | no | Normal Prisma runtime only. |
| `passvero_test` | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged | Existing isolated integration-test role. |

`passvero_migrator` is a `LOGIN` role because Prisma CLI must authenticate
directly as the object creator. A NOLOGIN owner plus separate deploy login is
an optional later hardening model and is not introduced here. `NOINHERIT` is
chosen because neither production login needs group-role privileges; any
unexpected membership is a stop condition.

The migrator needs no explicit `TEMPORARY` grant for Prisma Migrate. As database
owner it has inherent owner authority, including the ability needed to create
schema objects. PUBLIC and runtime `TEMPORARY` are revoked so the runtime cannot
create temporary tables.

### Initial runtime table-level ACL

| Table | SELECT | INSERT | UPDATE | DELETE | Reason |
| --- | --- | --- | --- | --- | --- |
| `Membership` | yes | no | no | no | Transactional eligibility revalidation. |
| `Organization` | yes | no | no | no | Membership relation selects Organization status. |
| `Product` | yes | yes | yes | no | Identity insert, tenant-scoped read, guarded draft-pointer update. |
| `ProductVersion` | yes | yes | no | no | Initial DRAFT insert and guarded relation predicate. |
| `ProductTranslation` | yes | yes | no | no | Initial source-locale insert and returned identifier. |
| `AuditLog` | yes | yes | no | no | Append-only creation and authorized reads. |
| `ScanEvent` | yes | yes | no | no | Approved append-only ingestion/aggregation boundary. |
| Remaining 14 application tables | no | no | no | no | No implemented production use case currently needs them. |
| `_prisma_migrations` | no | no | no | no | Prisma CLI/migrator only. |

Table-level grants are the correct MVP granularity. Per-column ACLs would be
brittle with Prisma-generated queries; broad DML on all tables would violate
least privilege. `Product` receives table-level `UPDATE` because the reviewed
adapter performs a guarded update. Repository/service predicates remain the
tenant and lifecycle enforcement boundary.

### DELETE policy

No initial runtime table receives `DELETE`.

Future reviewed services may legitimately need purpose-specific deletion of
editable aggregate children such as `ProductTranslation`,
`ProductIdentifier`, `ProductMaterial`, `ProductDocument`, or `ProductImage`,
and an explicitly reviewed `IntegrationMapping` removal workflow may later
need deletion. A future grant must accompany the service, repository boundary,
published-version immutability tests, impact preview, audit, and recovery
review. Because PostgreSQL table ACLs cannot distinguish editable from
published parent state without RLS/triggers, any later table-level `DELETE`
continues to rely on narrow service enforcement.

Normal runtime deletion remains prohibited for retained roots, lifecycle
history, `AuditLog`, `ScanEvent`, `_prisma_migrations`, and future
administrative retention work. Cascading foreign keys describe structural
effects; they do not authorize parent deletion.

---

## Phase 1 — Read-Only Preflight

**Target:** cluster `16/main`; databases `postgres`, `passvero`, and
`passvero_test`; roles `postgres`, `passvero_app`, `passvero_test`; committed
migration directory.

**Prerequisites:** local VPS shell access; peer-authenticated PostgreSQL
administrator; repository checkout at the approved release commit; application
still has no production write path; no secret value is displayed.

**Allowed mutations:** none.

- [ ] **Step 1: Record source and host identity without reading environment values**

Run later on the VPS:

```bash
cd /var/www/passvero
git status --short --branch
git rev-parse HEAD
find prisma/migrations -mindepth 1 -maxdepth 1 -type d | sort
```

Expected: clean approved checkout and exactly the 16 directories inventoried
above. Stop on a dirty tree, a different release commit, or migration 17.

- [ ] **Step 2: Verify cluster/database identity and owners**

Run later as the local PostgreSQL administrator:

```bash
sudo -u postgres psql --no-psqlrc -X --set=ON_ERROR_STOP=1 --dbname=postgres
```

Then run:

```sql
SELECT current_database(), current_user, version();
SHOW port;
SHOW listen_addresses;
SHOW password_encryption;

SELECT
  datname,
  pg_get_userbyid(datdba) AS owner,
  datallowconn,
  datconnlimit,
  datacl
FROM pg_database
WHERE datname IN ('passvero', 'passvero_test')
ORDER BY datname;
```

Expected: PostgreSQL 16.14; port 5432; localhost-only listening;
`password_encryption = 'scram-sha-256'`; `passvero` owner `passvero_app`;
`passvero_test` owner `passvero_test`. Stop on any mismatch. Do not change server
configuration from this plan.

- [ ] **Step 3: Verify existing role attributes and memberships**

```sql
SELECT
  rolname,
  rolcanlogin,
  rolsuper,
  rolcreatedb,
  rolcreaterole,
  rolinherit,
  rolreplication,
  rolbypassrls,
  rolconnlimit
FROM pg_roles
WHERE rolname IN ('passvero_app', 'passvero_test', 'passvero_migrator')
ORDER BY rolname;

SELECT
  member_role.rolname AS member_role,
  parent_role.rolname AS granted_role,
  membership.admin_option,
  membership.inherit_option,
  membership.set_option
FROM pg_auth_members AS membership
JOIN pg_roles AS member_role ON member_role.oid = membership.member
JOIN pg_roles AS parent_role ON parent_role.oid = membership.roleid
WHERE member_role.rolname IN ('passvero_app', 'passvero_test', 'passvero_migrator')
   OR parent_role.rolname IN ('passvero_app', 'passvero_test', 'passvero_migrator')
ORDER BY member_role.rolname, parent_role.rolname;
```

Expected: `passvero_migrator` does not yet exist; application and test logins
have no privileged attributes and no privilege-bearing memberships. Stop if a
role is superuser, can create databases/roles, replicates, bypasses RLS, or
inherits another role. Do not normalize unknown memberships automatically.

- [ ] **Step 4: Verify effective database isolation before creating a cluster-wide role**

```sql
SELECT
  role_name,
  has_database_privilege(role_name, 'passvero', 'CONNECT') AS can_connect_production,
  has_database_privilege(role_name, 'passvero_test', 'CONNECT') AS can_connect_test
FROM (VALUES ('passvero_app'), ('passvero_test')) AS roles(role_name)
ORDER BY role_name;
```

Expected matrix:

| Role | `passvero` | `passvero_test` |
| --- | --- | --- |
| `passvero_app` | true | false |
| `passvero_test` | false | true |

Stop if the matrix differs. PostgreSQL ACLs are additive: a role-specific
`REVOKE` cannot override a privilege inherited from PUBLIC or another role.

- [ ] **Step 5: Verify production emptiness, schema owner/ACL, and absence of sessions**

Reconnect explicitly to production as administrator:

```bash
sudo -u postgres psql --no-psqlrc -X --set=ON_ERROR_STOP=1 --dbname=passvero
```

Run:

```sql
SELECT current_database(), current_user;

SELECT
  nspname,
  pg_get_userbyid(nspowner) AS owner,
  nspacl
FROM pg_namespace
WHERE nspname = 'public';

SELECT
  n.nspname AS schema_name,
  c.relname AS object_name,
  c.relkind,
  pg_get_userbyid(c.relowner) AS owner
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname !~ '^pg_toast'
ORDER BY n.nspname, c.relkind, c.relname;

SELECT
  n.nspname AS schema_name,
  t.typname AS type_name,
  t.typtype,
  pg_get_userbyid(t.typowner) AS owner
FROM pg_type AS t
JOIN pg_namespace AS n ON n.oid = t.typnamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname !~ '^pg_toast'
  AND t.typtype IN ('e', 'd')
ORDER BY n.nspname, t.typname;

SELECT extname, n.nspname AS schema_name
FROM pg_extension AS e
JOIN pg_namespace AS n ON n.oid = e.extnamespace
WHERE n.nspname = 'public'
ORDER BY extname;

SELECT pid, usename, application_name, state
FROM pg_stat_activity
WHERE datname = 'passvero'
  AND pid <> pg_backend_pid()
ORDER BY pid;
```

Expected: `public` exists; no application relation, enum/domain, public-schema
extension, `_prisma_migrations`, or other session exists. The current `public`
owner/ACL is recorded, not assumed. Stop if any object or another session is
present. The empty/uninitialized gate is what makes explicit ownership transfer
safe before migration history exists.

**Verification gate:** all five steps match exactly; store the redacted output
in the protected operator evidence location. Record current database/schema
owners and ACLs for rollback.

**Stop conditions:** any unexpected object/data/session, non-SCRAM password
encryption, wrong owner/version/network setting, unsafe role attribute,
cross-database access, dirty repository, or unknown migration.

**Rollback:** none; this phase is read-only.

---

## Phase 2 — Create the Migrator Role

**Target:** cluster role `passvero_migrator` only.

**Prerequisites:** Phase 1 PASS; `passvero_migrator` absent; one named operator
has custody of the protected migrator secret; SCRAM password encryption
confirmed.

**Allowed mutations:** create and password the one role; no database/schema
change.

- [ ] **Step 1: Create the minimum-attribute role with a null password first**

In the peer-authenticated administrator session connected to `postgres`:

```sql
CREATE ROLE passvero_migrator WITH
  LOGIN
  NOINHERIT
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOBYPASSRLS
  PASSWORD NULL;
```

Do not add it to another role. Do not grant `postgres`, `passvero_app`, or
`passvero_test` membership.

- [ ] **Step 2: Set the password interactively**

In the same interactive `psql` session, use:

```text
\password passvero_migrator
```

Enter the generated value only at the two hidden prompts. Do not paste an
`ALTER ROLE ... PASSWORD` statement into shell/SQL history. Do not capture the
prompt in a screen recording or transcript.

- [ ] **Step 3: Verify exact attributes, membership, and current isolation**

Run the role and membership queries from Phase 1. Expected migrator row:

```text
rolcanlogin=true
rolsuper=false
rolcreatedb=false
rolcreaterole=false
rolinherit=false
rolreplication=false
rolbypassrls=false
```

Then run:

```sql
SELECT
  has_database_privilege('passvero_migrator', 'passvero', 'CONNECT') AS production_connect_before_transfer,
  has_database_privilege('passvero_migrator', 'passvero_test', 'CONNECT') AS test_connect;
```

Expected: test access is false. Production access may be true through PUBLIC at
this pre-transfer point; Phase 4 normalizes it. Enumerate any other
connectable non-template database before proceeding. If the migrator can
connect to an unrelated application database through PUBLIC, stop for an
explicit cluster-wide database ACL decision; do not silently revoke PUBLIC on
unrelated databases.

**Verification gate:** exact attributes, no role memberships, test connection
false, password set without disclosure.

**Stop conditions:** role already existed, any attribute/membership differs,
password handling was exposed, or effective test/unrelated database access is
unexpected.

**Rollback:** before any ownership transfer, disable rather than drop the role:

```sql
ALTER ROLE passvero_migrator NOLOGIN PASSWORD NULL;
```

Do not drop it during an incident. A later reviewed cleanup may drop it only
after catalog queries prove it owns nothing and no default ACL depends on it.

---

## Phase 3 — Transfer Database and Schema Ownership

**Target:** database `passvero`; schema `passvero.public`.

**Prerequisites:** Phases 1–2 PASS; database still empty; no other production
session; redacted pre-change owner/ACL evidence captured.

**Allowed mutations:** explicit ownership changes only.

- [ ] **Step 1: Reconfirm emptiness immediately before transfer**

Repeat Phase 1 Step 5. Stop if any object or another connection appeared.

- [ ] **Step 2: Transfer the database from runtime to migrator**

As `postgres`, connected to database `postgres`:

```sql
ALTER DATABASE passvero OWNER TO passvero_migrator;
```

Verify immediately:

```sql
SELECT datname, pg_get_userbyid(datdba) AS owner
FROM pg_database
WHERE datname = 'passvero';
```

Expected owner: `passvero_migrator`.

- [ ] **Step 3: Transfer the existing public schema explicitly**

As `postgres`, connected to `passvero`:

```sql
ALTER SCHEMA public OWNER TO passvero_migrator;
```

Verify:

```sql
SELECT nspname, pg_get_userbyid(nspowner) AS owner
FROM pg_namespace
WHERE nspname = 'public';
```

Expected owner: `passvero_migrator`. Do this even if the preflight reported
`pg_database_owner`; the approved final state names the migrator explicitly.

`REASSIGN OWNED` is not appropriate. The database is required to have no
application objects, and the two known owned objects are transferred
explicitly. A broad reassignment could move an unexpected object or shared
ownership and would conceal a failed emptiness gate.

**Verification gate:** database and schema owners both exactly
`passvero_migrator`; database remains empty.

**Stop conditions:** ownership mismatch, unexpected dependency/object, session
appears, or either ALTER statement fails. Do not start migrations.

**Rollback:** only while the database is still empty and before Phase 5:

```sql
-- Connected to passvero as postgres:
ALTER SCHEMA public OWNER TO passvero_app;

-- Reconnect to postgres as postgres:
ALTER DATABASE passvero OWNER TO passvero_app;
```

Verify both original owners from the Phase 1 record. After migration objects
exist, do not restore runtime ownership; keep migrator ownership and repair the
specific failed step.

---

## Phase 4 — Harden Database and Public-Schema Privileges

**Target:** ACLs on database `passvero` and schema `public`; attributes of
`passvero_app`.

**Prerequisites:** Phase 3 PASS; empty database; no application session.

**Allowed mutations:** database/schema ACL normalization and safe runtime role
attribute normalization. No tables/types exist yet.

- [ ] **Step 1: Normalize runtime role attributes after confirming no memberships**

As `postgres`, connected to `postgres`:

```sql
ALTER ROLE passvero_app WITH
  LOGIN
  NOINHERIT
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOBYPASSRLS;
```

If Phase 1 found any membership, do not run this statement; resolve the
membership explicitly first.

- [ ] **Step 2: Remove implicit/public database powers and grant runtime CONNECT only**

```sql
REVOKE ALL PRIVILEGES ON DATABASE passvero FROM PUBLIC;
REVOKE ALL PRIVILEGES ON DATABASE passvero FROM passvero_app;
GRANT CONNECT ON DATABASE passvero TO passvero_app;
```

The migrator is database owner and needs no redundant explicit owner grant.
The runtime receives neither database `CREATE` nor `TEMPORARY`.

- [ ] **Step 3: Harden `public` explicitly**

Reconnect to `passvero` as `postgres`, then run:

```sql
REVOKE ALL PRIVILEGES ON SCHEMA public FROM PUBLIC;
REVOKE ALL PRIVILEGES ON SCHEMA public FROM passvero_app;
GRANT USAGE ON SCHEMA public TO passvero_app;
```

This includes the required `REVOKE CREATE ON SCHEMA public FROM PUBLIC` effect
and also removes PUBLIC `USAGE`, replacing it with an explicit runtime grant.
The schema owner retains owner authority. Do not grant runtime `CREATE`.

- [ ] **Step 4: Verify effective database/schema privileges**

```sql
SELECT
  role_name,
  has_database_privilege(role_name, 'passvero', 'CONNECT') AS can_connect,
  has_database_privilege(role_name, 'passvero', 'CREATE') AS can_create_schema,
  has_database_privilege(role_name, 'passvero', 'TEMPORARY') AS can_create_temp,
  has_schema_privilege(role_name, 'public', 'USAGE') AS schema_usage,
  has_schema_privilege(role_name, 'public', 'CREATE') AS schema_create
FROM (VALUES ('passvero_migrator'), ('passvero_app')) AS roles(role_name)
ORDER BY role_name;
```

Expected:

| Role | CONNECT | DB CREATE | TEMPORARY | schema USAGE | schema CREATE |
| --- | --- | --- | --- | --- | --- |
| `passvero_migrator` | true | true (owner) | true (owner) | true | true |
| `passvero_app` | true | false | false | true | false |

Re-run the Phase 1 production/test connection matrix; it must remain unchanged.

**Verification gate:** exact matrix above; PUBLIC has neither database nor
schema privilege; production/test isolation unchanged.

**Stop conditions:** runtime retains CREATE/TEMPORARY/schema CREATE; PUBLIC
retains rights; test isolation changes; owner differs.

**Rollback:** before Phase 5, restore only the exact database/schema ACL entries
captured in Phase 1, then use the Phase 3 empty-database ownership rollback.
Never use `GRANT ALL` as a shortcut and never alter `passvero_test` ACLs.

---

## Phase 5 — Apply the 16 Migrations as Migrator

**Target:** `passvero`; exactly the committed migrations under
`prisma/migrations`.

**Prerequisites:** Phases 1–4 PASS; approved deployment window; protected
migrator secret file; repository release commit recorded; backup/restore and
production cutover remain separate gates.

**Allowed mutations:** Prisma Migrate may create `_prisma_migrations` and the
exact committed schema objects. No seed/business data.

- [ ] **Step 1: Store the migrator secret without shell-history exposure**

Create a protected directory/file using the already approved deployment OS
account resolved during the execution task:

```bash
sudo install -d -m 0750 -o root -g <PASSVERO_DEPLOY_OS_GROUP> /etc/passvero
sudo install -m 0640 -o root -g <PASSVERO_DEPLOY_OS_GROUP> /dev/null /etc/passvero/passvero-migrator.env
sudoedit /etc/passvero/passvero-migrator.env
```

Enter one `DATABASE_URL` assignment in the editor. Do not print it. The value
must identify `passvero_migrator`, loopback port 5432, and database `passvero`.
`<PASSVERO_DEPLOY_OS_GROUP>` is the only unresolved machine-specific
placeholder; Phase 1 must replace it with the group of the existing named VPS
deployment account before execution.

- [ ] **Step 2: Confirm target identity through the migrator connection without displaying it**

Use an interactive password prompt, never a URL argument:

```bash
psql --no-psqlrc -X -W \
  -h 127.0.0.1 -p 5432 \
  -U passvero_migrator -d passvero \
  --tuples-only --no-align \
  --command='SELECT current_database(), current_user;'
```

The operator enters the migrator password only at the hidden prompt and records
only this identity pair:

```text
passvero|passvero_migrator
```

Stop on any other result. Do not store the prompt response in shell history or
captured output.

- [ ] **Step 3: Apply only the committed migration history**

Run from `/var/www/passvero` as the deployment OS account:

```bash
set +x
(
  set -a
  . /etc/passvero/passvero-migrator.env
  set +a
  npx prisma migrate deploy
)
```

`prisma.config.ts` already reads `DATABASE_URL`; no repository/config change is
required. Expected: all 16 migrations applied successfully. Ignore upgrade
notices; do not change Prisma 7.8.0.

- [ ] **Step 4: Verify migration status with the same protected identity**

```bash
set +x
(
  set -a
  . /etc/passvero/passvero-migrator.env
  set +a
  npx prisma migrate status
)
```

Expected: 16 migrations found and schema current.

- [ ] **Step 5: Verify object inventory and ownership as administrator**

Connected to `passvero` as `postgres`:

```sql
SELECT COUNT(*) AS application_tables
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND c.relname <> '_prisma_migrations';

SELECT COUNT(*) AS enum_types
FROM pg_type AS t
JOIN pg_namespace AS n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
  AND t.typtype = 'e';

SELECT
  c.relkind,
  c.relname,
  pg_get_userbyid(c.relowner) AS owner
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
ORDER BY c.relkind, c.relname;

SELECT
  t.typname,
  pg_get_userbyid(t.typowner) AS owner
FROM pg_type AS t
JOIN pg_namespace AS n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
  AND t.typtype = 'e'
ORDER BY t.typname;

SELECT migration_name, finished_at, rolled_back_at
FROM public._prisma_migrations
ORDER BY started_at;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'ux_invitation_one_pending_per_organization_email',
    'ux_product_version_one_active_draft',
    'ux_integration_mapping_external_resource_without_account',
    'ux_integration_mapping_internal_entity_without_account',
    'ux_background_job_platform_deduplication',
    'ux_background_job_organization_deduplication'
  )
ORDER BY indexname;
```

Expected: 21 application tables; 20 enums; `_prisma_migrations` present; every
public table/index/sequence-like relation and enum owned by
`passvero_migrator`; exactly 16 finished, non-rolled-back migration records;
all six partial indexes present with their reviewed predicates. Also run the
repository's existing schema inventory queries to prove 77 named CHECKs and 41
foreign keys.

**Verification gate:** deploy and status succeed; exact inventory/ownership;
zero seed/business rows; no unexpected object class.

**Stop conditions:** any failed/pending/rolled-back migration, wrong owner,
unexpected object, missing check/index/FK, or any business row. Do not use
`resolve`, reset, or edit migration SQL.

**Rollback/recovery:** stop with the application still disconnected. Preserve
the failed state and logs for review. Repair forward when safe. Because the
database is pre-write and required to be empty, dropping/recreating its schema
is a possible last resort only under a separate explicit destructive approval;
it is never the normal correction path. Do not transfer migrated objects to
`passvero_app` and never use `DROP OWNED`.

---

## Phase 6 — Apply Existing-Object and Default Privileges

**Target:** existing objects in `passvero.public`; creator-specific defaults for
future objects created by `passvero_migrator`.

**Prerequisites:** Phase 5 PASS; exact object ownership; runtime not connected.

**Allowed mutations:** ACL/default-ACL changes only. No schema/data mutation.

- [ ] **Step 1: Remove broad/public existing-object access**

Connected to `passvero` as `postgres`, execute as one transaction:

```sql
BEGIN;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM passvero_app;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM passvero_app;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM passvero_app;

REVOKE USAGE ON TYPE
  public."OrganizationStatus",
  public."MembershipRole",
  public."MembershipStatus",
  public."InvitationStatus",
  public."ProductLifecycleStatus",
  public."ProductVersionStatus",
  public."ProductIdentifierType",
  public."DocumentStatus",
  public."PassportStatus",
  public."QRCodeStatus",
  public."ScanDeviceType",
  public."ScanReferrerType",
  public."PlanStatus",
  public."SubscriptionStatus",
  public."BillingProvider",
  public."NotificationType",
  public."NotificationStatus",
  public."IntegrationMappingStatus",
  public."BackgroundJobScope",
  public."BackgroundJobStatus"
FROM PUBLIC;

COMMIT;
```

There is no supported `ON ALL TYPES IN SCHEMA` form for existing types, so the
20 reviewed enum names are intentionally explicit.

- [ ] **Step 2: Grant the exact initial runtime table ACL**

```sql
BEGIN;

GRANT SELECT ON TABLE
  public."Membership",
  public."Organization",
  public."Product",
  public."ProductVersion",
  public."ProductTranslation",
  public."AuditLog",
  public."ScanEvent"
TO passvero_app;

GRANT INSERT ON TABLE
  public."Product",
  public."ProductVersion",
  public."ProductTranslation",
  public."AuditLog",
  public."ScanEvent"
TO passvero_app;

GRANT UPDATE ON TABLE public."Product" TO passvero_app;

GRANT USAGE ON TYPE
  public."OrganizationStatus",
  public."MembershipRole",
  public."MembershipStatus",
  public."InvitationStatus",
  public."ProductLifecycleStatus",
  public."ProductVersionStatus",
  public."ProductIdentifierType",
  public."DocumentStatus",
  public."PassportStatus",
  public."QRCodeStatus",
  public."ScanDeviceType",
  public."ScanReferrerType",
  public."PlanStatus",
  public."SubscriptionStatus",
  public."BillingProvider",
  public."NotificationType",
  public."NotificationStatus",
  public."IntegrationMappingStatus",
  public."BackgroundJobScope",
  public."BackgroundJobStatus"
TO passvero_app;

COMMIT;
```

Type `USAGE` mainly controls creating dependent schema objects rather than all
enum value reads. Runtime receives it as the approved explicit contract after
PUBLIC type access is removed; schema/database `CREATE` remain denied, so this
does not add DDL authority.

- [ ] **Step 3: Establish future-object defaults under the actual creator**

```sql
BEGIN;

-- Global within passvero: these undo PostgreSQL's default PUBLIC grants.
ALTER DEFAULT PRIVILEGES FOR ROLE passvero_migrator
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE passvero_migrator
  REVOKE USAGE ON TYPES FROM PUBLIC;

-- Schema-specific runtime baseline for future objects.
ALTER DEFAULT PRIVILEGES FOR ROLE passvero_migrator IN SCHEMA public
  GRANT SELECT ON TABLES TO passvero_app;
ALTER DEFAULT PRIVILEGES FOR ROLE passvero_migrator IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO passvero_app;
ALTER DEFAULT PRIVILEGES FOR ROLE passvero_migrator IN SCHEMA public
  GRANT USAGE ON TYPES TO passvero_app;

COMMIT;
```

No current sequence exists, so no existing sequence grant is needed. Future
sequence `USAGE` permits `nextval`/`currval`; do not grant sequence `UPDATE` or
table write defaults. There is no default runtime `INSERT`, `UPDATE`, or
`DELETE`. Each future service adds reviewed table-level writes in the grant
reconciliation step after its migration.

Do not use `IN SCHEMA public` on the two PUBLIC revokes: PostgreSQL per-schema
defaults cannot undo global PUBLIC defaults for functions/types.

- [ ] **Step 4: Inspect default ACL entries**

```sql
SELECT
  pg_get_userbyid(d.defaclrole) AS creator,
  COALESCE(n.nspname, '<all schemas>') AS schema_scope,
  d.defaclobjtype,
  d.defaclacl
FROM pg_default_acl AS d
LEFT JOIN pg_namespace AS n ON n.oid = d.defaclnamespace
WHERE pg_get_userbyid(d.defaclrole) = 'passvero_migrator'
ORDER BY schema_scope, d.defaclobjtype;
```

Expected effective policy: PUBLIC lacks future function EXECUTE and type
USAGE; in `public`, runtime receives future table SELECT, sequence USAGE, and
type USAGE only.

**Verification gate:** current grants match the matrix; default ACL entries are
owned by `passvero_migrator`; no default write grant; no object owner changes.

**Stop conditions:** unsupported statement, unexpected prior default ACL,
grant to PUBLIC, write default, wrong creator, or runtime access to an
unlisted existing table.

**Rollback:** rollback the active SQL transaction on any error. After commit,
use inverse statements against only the recorded ACL entries; do not grant all
or transfer ownership. Keep the application disconnected until Phase 8 proves
the corrected state.

### Future migration reconciliation rule

After every later reviewed `prisma migrate deploy`:

1. verify migration status and object ownership;
2. grant only the new service's reviewed existing-object write privileges;
3. revoke runtime rights on any new restricted/administrative table;
4. reassert the Phase 7 exceptions;
5. verify the Phase 8 effective matrix, extended with the new objects;
6. transactionally probe default ACL behavior; and
7. stop deployment before runtime restart on any mismatch.

Default ACLs supply a safe read/type/sequence baseline, not complete service
authorization. A reviewed idempotent grant-reconciliation SQL artifact should
be introduced with the first future migration that adds a runtime object. It
must list explicit exceptions and be executed after deploy; it must not be
placed in an already applied migration.

A future backup role remains compatible: it can later receive database
`CONNECT`, schema `USAGE`, explicit `SELECT` on existing tables, and a
creator-specific future-table SELECT default. This plan does not create or
grant that role.

---

## Phase 7 — Reassert Append-Only and Migration-History Restrictions

**Target:** `public."AuditLog"`, `public."ScanEvent"`, and
`public._prisma_migrations`.

**Prerequisites:** Phase 6 PASS; objects owned by `passvero_migrator`.

**Allowed mutations:** ACL changes only.

- [ ] **Step 1: Make append-only ACLs exact**

```sql
BEGIN;

REVOKE ALL PRIVILEGES ON TABLE
  public."AuditLog",
  public."ScanEvent"
FROM passvero_app;

GRANT SELECT, INSERT ON TABLE
  public."AuditLog",
  public."ScanEvent"
TO passvero_app;

COMMIT;
```

This denies `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, and `TRIGGER` while
retaining approved append/read behavior. Because `passvero_app` is not owner,
it cannot bypass those ACLs. Do not add a trigger: the no-trigger architecture
remains frozen.

- [ ] **Step 2: Deny all runtime access to Prisma migration history**

```sql
BEGIN;

REVOKE ALL PRIVILEGES ON TABLE public._prisma_migrations FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public._prisma_migrations FROM passvero_app;

COMMIT;
```

Prisma Client runtime does not query `_prisma_migrations`. The migrator owns it
and retains owner access for Prisma CLI.

- [ ] **Step 3: Record privileged maintenance boundary**

Normal runtime never modifies/deletes append-only rows. An exceptional legal,
privacy, or retention operation must use a separately reviewed maintenance
procedure under the migrator or a future dedicated maintenance role, with
authorization, affected-row preview, backup/recovery evidence, audit, and a
closed maintenance window. It must never make `passvero_app` owner and must not
introduce a generic runtime delete grant.

**Verification gate:** effective ACL is exactly SELECT+INSERT for the two
append-only tables and no privilege for `_prisma_migrations`.

**Stop conditions:** runtime owns any target table, retains update/delete/
truncate, or can read migration history.

**Rollback:** rollback the transaction on error. After commit, restore only the
specific prior ACL recorded in Phase 6 if the application cannot perform an
approved operation; never restore UPDATE/DELETE to bypass an application bug.

---

## Phase 8 — Effective Privilege Verification

**Target:** effective (not merely displayed) privileges for all production and
test identities.

**Prerequisites:** Phases 1–7 PASS; application still disconnected; redacted
evidence location ready.

**Allowed mutations:** none persistent. Catalog reads and rollback-only probe
transactions are allowed.

- [ ] **Step 1: Verify final database/schema ownership and role attributes**

Repeat Phase 1 role/membership and Phase 4 database/schema privilege queries.
Require the exact final matrices. Also run:

```sql
SELECT
  pg_get_userbyid((SELECT datdba FROM pg_database WHERE datname = 'passvero')) AS database_owner,
  pg_get_userbyid((SELECT nspowner FROM pg_namespace WHERE nspname = 'public')) AS schema_owner;
```

Expected twice: `passvero_migrator`.

- [ ] **Step 2: Verify all table/index/type owners**

```sql
SELECT c.relkind, c.relname, pg_get_userbyid(c.relowner) AS owner
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p', 'i', 'I', 'S')
  AND pg_get_userbyid(c.relowner) <> 'passvero_migrator'
ORDER BY c.relkind, c.relname;

SELECT t.typname, pg_get_userbyid(t.typowner) AS owner
FROM pg_type AS t
JOIN pg_namespace AS n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
  AND t.typtype = 'e'
  AND pg_get_userbyid(t.typowner) <> 'passvero_migrator'
ORDER BY t.typname;
```

Expected: both queries return zero rows. Constraints follow their owning
tables; verify all 77 `ck_*`, 41 FKs, and all primary/unique constraints attach
only to migrator-owned tables.

- [ ] **Step 3: Verify exact effective DML matrix**

```sql
WITH expected(table_name, can_select, can_insert, can_update, can_delete) AS (
  VALUES
    ('AuditLog', true, true, false, false),
    ('BackgroundJob', false, false, false, false),
    ('Document', false, false, false, false),
    ('IntegrationMapping', false, false, false, false),
    ('Invitation', false, false, false, false),
    ('Membership', true, false, false, false),
    ('Notification', false, false, false, false),
    ('Organization', true, false, false, false),
    ('Passport', false, false, false, false),
    ('Plan', false, false, false, false),
    ('Product', true, true, true, false),
    ('ProductDocument', false, false, false, false),
    ('ProductIdentifier', false, false, false, false),
    ('ProductImage', false, false, false, false),
    ('ProductMaterial', false, false, false, false),
    ('ProductTranslation', true, true, false, false),
    ('ProductVersion', true, true, false, false),
    ('QRCode', false, false, false, false),
    ('ScanEvent', true, true, false, false),
    ('Subscription', false, false, false, false),
    ('User', false, false, false, false),
    ('_prisma_migrations', false, false, false, false)
), actual AS (
  SELECT
    c.relname AS table_name,
    has_table_privilege('passvero_app', c.oid, 'SELECT') AS can_select,
    has_table_privilege('passvero_app', c.oid, 'INSERT') AS can_insert,
    has_table_privilege('passvero_app', c.oid, 'UPDATE') AS can_update,
    has_table_privilege('passvero_app', c.oid, 'DELETE') AS can_delete
  FROM pg_class AS c
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
)
SELECT
  expected.*,
  actual.can_select AS actual_select,
  actual.can_insert AS actual_insert,
  actual.can_update AS actual_update,
  actual.can_delete AS actual_delete,
  ROW(expected.can_select, expected.can_insert, expected.can_update, expected.can_delete)
    = ROW(actual.can_select, actual.can_insert, actual.can_update, actual.can_delete)
    AS matches
FROM expected
LEFT JOIN actual USING (table_name)
ORDER BY table_name;
```

Expected: 22 rows and every `matches` value true. Separately require false for
`TRUNCATE`, `REFERENCES`, and `TRIGGER` on every runtime table with this exact
query:

```sql
SELECT
  c.relname AS table_name,
  has_table_privilege('passvero_app', c.oid, 'TRUNCATE') AS can_truncate,
  has_table_privilege('passvero_app', c.oid, 'REFERENCES') AS can_reference,
  has_table_privilege('passvero_app', c.oid, 'TRIGGER') AS can_trigger
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
ORDER BY c.relname;
```

Expected: 22 rows with all three booleans false, especially for `AuditLog` and
`ScanEvent`.

- [ ] **Step 4: Verify enum/default ACL policy**

Verify all 20 enums and the absence of effective PUBLIC `USAGE`:

```sql
SELECT
  t.typname,
  has_type_privilege('passvero_app', t.oid, 'USAGE') AS runtime_usage,
  EXISTS (
    SELECT 1
    FROM aclexplode(COALESCE(t.typacl, acldefault('T', t.typowner))) AS acl
    WHERE acl.grantee = 0
      AND acl.privilege_type = 'USAGE'
  ) AS public_usage
FROM pg_type AS t
JOIN pg_namespace AS n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
  AND t.typtype = 'e'
ORDER BY t.typname;
```

Expected: exactly 20 rows, every `runtime_usage` true, every `public_usage`
false. Re-run the `pg_default_acl` query from Phase 6.

Then prove future defaults with rollback-only probe objects. Connected as
`postgres` to `passvero`:

```sql
BEGIN;
SET LOCAL ROLE passvero_migrator;
CREATE TABLE public.__passvero_acl_probe (id integer);
CREATE TYPE public.__passvero_acl_probe_type AS ENUM ('VALUE');
CREATE SEQUENCE public.__passvero_acl_probe_sequence;
RESET ROLE;

SELECT
  has_table_privilege('passvero_app', 'public.__passvero_acl_probe', 'SELECT') AS table_select,
  has_table_privilege('passvero_app', 'public.__passvero_acl_probe', 'INSERT') AS table_insert,
  has_type_privilege('passvero_app', 'public.__passvero_acl_probe_type', 'USAGE') AS type_usage,
  has_sequence_privilege('passvero_app', 'public.__passvero_acl_probe_sequence', 'USAGE') AS sequence_usage,
  has_sequence_privilege('passvero_app', 'public.__passvero_acl_probe_sequence', 'UPDATE') AS sequence_update;

ROLLBACK;
```

Expected: true, false, true, true, false. Verify afterward that no
`__passvero_acl_probe*` object exists.

- [ ] **Step 5: Run transactionally safe negative permission probes**

Run each as a separate administrator `psql --command` invocation. Every command
starts a transaction, assumes the runtime identity, touches zero rows or creates
only a rollback-scoped probe, and must exit nonzero with SQLSTATE `42501`
(`insufficient_privilege`). A successful exit is a failed security test.

```sql
BEGIN; SET LOCAL ROLE passvero_app; UPDATE public."AuditLog" SET "summary" = "summary" WHERE false; ROLLBACK;
BEGIN; SET LOCAL ROLE passvero_app; DELETE FROM public."AuditLog" WHERE false; ROLLBACK;
BEGIN; SET LOCAL ROLE passvero_app; UPDATE public."ScanEvent" SET "isBot" = "isBot" WHERE false; ROLLBACK;
BEGIN; SET LOCAL ROLE passvero_app; DELETE FROM public."ScanEvent" WHERE false; ROLLBACK;
BEGIN; SET LOCAL ROLE passvero_app; SELECT 1 FROM public._prisma_migrations LIMIT 0; ROLLBACK;
BEGIN; SET LOCAL ROLE passvero_app; CREATE TABLE public.__passvero_runtime_create_probe (id integer); ROLLBACK;
```

If a denial aborts before explicit `ROLLBACK`, connection close rolls the
transaction back. If a command unexpectedly succeeds, its explicit rollback
still prevents a persistent object/data mutation; stop immediately and repair
the ACL.

- [ ] **Step 6: Run positive read-only runtime probes**

Under `SET LOCAL ROLE passvero_app`, run this exact transaction:

```sql
BEGIN;
SET LOCAL ROLE passvero_app;
SELECT 1 FROM public."Membership" LIMIT 0;
SELECT 1 FROM public."Organization" LIMIT 0;
SELECT 1 FROM public."Product" LIMIT 0;
SELECT 1 FROM public."ProductVersion" LIMIT 0;
SELECT 1 FROM public."ProductTranslation" LIMIT 0;
SELECT 1 FROM public."AuditLog" LIMIT 0;
SELECT 1 FROM public."ScanEvent" LIMIT 0;
ROLLBACK;
```

All seven reads must succeed. No column or row containing business data is
selected.

- [ ] **Step 7: Verify actual cross-database connection failures without credentials in commands**

Catalog checks remain primary. Then, using interactive password prompts only:

```bash
psql --no-psqlrc -X -W -h 127.0.0.1 -p 5432 -U passvero_app -d passvero_test --command='SELECT current_database(), current_user;'
psql --no-psqlrc -X -W -h 127.0.0.1 -p 5432 -U passvero_test -d passvero --command='SELECT current_database(), current_user;'
```

Both must fail connection authorization. Never place passwords in
`PGPASSWORD`, the command, or captured output. Also verify
`passvero_migrator -> passvero_test` is false with
`has_database_privilege`; an actual prompt-based attempt may confirm it.

**Verification gate:** exact owner/role/schema/database/DML/type/default ACL
matrices; all negative probes fail only with expected permission denial; all
positive read-only probes pass; cross-database attempts fail.

**Stop conditions:** any mismatch, unexpected SQLSTATE, persistent probe
object, raw secret in output, or privilege inherited through another role.

**Rollback:** rollback every probe transaction. If a prior ACL is wrong, keep
runtime disconnected and apply the narrow inverse GRANT/REVOKE in a new
reviewed transaction, then repeat all of Phase 8.

---

## Phase 9 — Prisma Runtime Smoke Verification

**Target:** PrismaPg as `passvero_app`; Prisma CLI as
`passvero_migrator`; a separate production-equivalent verification database
for actual CreateProduct DML.

**Prerequisites:** Phase 8 PASS; the separately approved production PrismaPg
runtime factory/dependency task is complete; generated Prisma Client exists;
an isolated throwaway production-equivalent verification database is approved.

**Allowed mutations:** read-only Prisma smoke against `passvero`; actual DML
only in the isolated verification database with complete cleanup. No production
business write.

- [ ] **Step 1: Prove PrismaPg production connectivity and SELECT as runtime**

Load the protected runtime environment in a no-xtrace subshell. Until the
separately approved production composition root provides its permanent smoke
entry point, run this exact one-shot PrismaPg check from `/var/www/passvero`:

```bash
set +x
(
  set -a
  . /etc/passvero/passvero-runtime.env
  set +a
  npx tsx --eval '
    import { PrismaPg } from "@prisma/adapter-pg";
    import { PrismaClient } from "./src/generated/prisma/client";
    async function main() {
      const url = process.env.DATABASE_URL;
      if (typeof url !== "string" || url.length === 0) {
        process.stderr.write("PRISMA_RUNTIME_READ_SMOKE=FAIL\n");
        process.exitCode = 1;
        return;
      }
      const prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString: url }),
      });
      try {
        await prisma.membership.count();
        process.stdout.write("PRISMA_RUNTIME_READ_SMOKE=PASS\n");
      } catch {
        process.stderr.write("PRISMA_RUNTIME_READ_SMOKE=FAIL\n");
        process.exitCode = 1;
      } finally {
        await prisma.$disconnect().catch(() => undefined);
      }
    }
    void main();
  '
)
```

The permanent runtime factory must later replace this one-shot composition
without changing the credential or query semantics. The command prints no URL,
query, Prisma error metadata, or row content.

Expected: PASS; pool remains within the approved connection budget. This is
read-only and does not wire CreateProduct to an API.

- [ ] **Step 2: Prove CreateProduct-required DML under production-equivalent ACLs**

Do not use `passvero` or redesign `passvero_test`. In an explicitly approved,
throwaway database:

1. make `passvero_migrator` owner;
2. apply the same 16 migrations as migrator;
3. apply Phases 4, 6, and 7 ACLs to the runtime role;
4. create unique User/Organization/Membership fixtures as migrator;
5. invoke the existing CreateProduct service with PrismaPg authenticated as
   `passvero_app` and a deterministic public-code generator;
6. verify Product, ProductVersion, ProductTranslation, pointer, and AuditLog;
7. verify rollback and known uniqueness paths;
8. clean fixtures as migrator in FK-safe reverse order; and
9. drop only the throwaway database under separate explicit cleanup approval.

Expected: the exact CreateProduct transaction succeeds and no unapproved table
mutation is required. A permission error identifies a missing reviewed grant;
do not broaden grants generically.

- [ ] **Step 3: Prove Prisma migration separation**

Against the same throwaway verification database:

- run `npx prisma migrate status`/`deploy` with the protected migrator
  environment and require success/current status;
- run migration status as `passvero_app` and require failure because runtime
  cannot read `_prisma_migrations` or create schema objects;
- never run the expected-failure migration command against production.

Phase 5 already proves production deployment works as migrator. Phase 8's DDL
and migration-table denials prove the production runtime cannot migrate.

- [ ] **Step 4: Preserve environment separation**

Confirm the existing test path remains unchanged:

```text
Mac/Codex -> SSH tunnel -> VPS localhost PostgreSQL -> passvero_test
```

`passvero_test` stays owned by `passvero_test`; its broad fixture-cleanup
permissions are not made identical to production. `TEST_DATABASE_URL` remains
fail-closed and never falls back to production. A future `passvero_dev` and
`passvero_dev` role remain separate; never share the migrator credential with
local development.

**Verification gate:** production read-only Prisma smoke passes; real
CreateProduct DML and rollback pass under a production-equivalent ACL outside
production; migrator CLI succeeds; runtime migration attempt fails; test
architecture unchanged.

**Stop conditions:** production mutation, secret/raw error output, runtime
migration success, missing DML privilege, unexpected table access, leaked pool,
or any `passvero_test` ownership/grant change.

**Rollback:** production smoke is read-only. Roll back/clean the isolated
verification fixtures, revoke its temporary CONNECT grants, and drop only the
explicit throwaway database after evidence is captured. Production ACL fixes
return to Phase 6 or 7 and must repeat Phases 8–9.

---

## Recovery and Ownership Rollback Boundaries

1. **Before Phase 3:** disable the new login with `NOLOGIN PASSWORD NULL`; do
   not drop it during incident response.
2. **After Phase 3 but before Phase 5:** if setup cannot proceed and the
   database remains empty, explicitly restore `public` and database ownership
   to `passvero_app`, then verify the Phase 1 snapshot.
3. **After Phase 5 but before any production write:** retain
   `passvero_migrator` ownership. Repair narrow ACL/default-ACL mistakes with
   inverse statements. Do not make runtime owner merely to make a test pass.
4. **Failed migration:** stop. Preserve evidence. Never edit applied history,
   use resolve/reset, or use `DROP OWNED`. Schema reinitialization is an
   explicit last-resort destructive operation because the database is
   pre-write; it requires separate approval and a new identity/emptiness gate.
5. **After first production write:** this roles plan no longer authorizes
   ownership rollback or schema reinitialization. Backup/restore, write-stop,
   and single-authority procedures govern recovery.
6. Never drop `passvero_app`, `passvero_test`, or `passvero_migrator` as part of
   rollback. PostgreSQL administrator access remains the break-glass recovery
   path.

## Secret Handling Runbook

- Generate application and migrator secrets independently with an approved
  secret generator; do not record generator output in task logs.
- Set the PostgreSQL password with interactive `\password`; do not interpolate
  a password into a shell/SQL command.
- Store the migrator connection only in
  `/etc/passvero/passvero-migrator.env`, mode 0640, root-owned, readable only by
  the named deploy group.
- Store the runtime connection in its separate protected PM2/server environment
  file; the migrator variable must never be available to routine PM2 runtime.
- Use `set +x` and a subshell when sourcing either file. Do not run `env`,
  `printenv`, `set`, shell tracing, or debug logging in that shell.
- Never pass a connection URL as a command argument. Prefer protected files,
  process environment, or interactive password prompts.
- Redact error output to phase, role name, database name, exit code, and safe
  SQLSTATE. Never preserve a URL, password, query parameters, or driver payload.
- Keep all environment/credential files outside Git; verify their permissions
  before and after use.
- Rotate the migrator password after suspected disclosure and according to the
  approved operations schedule; disable login outside migration windows only
  if the deployment workflow explicitly supports that lifecycle.

## Final Execution Evidence Checklist

Every item must be marked PASS before the roles/grants gate closes:

- [ ] Exactly 16 committed migrations were the only schema input.
- [ ] `passvero` was proven empty before ownership transfer.
- [ ] Database and `public` schema owner are `passvero_migrator`.
- [ ] Every application table, index, enum, and `_prisma_migrations` is owned by
  `passvero_migrator`.
- [ ] Migrator and runtime attributes match the final role matrix and have no
  memberships.
- [ ] Runtime has database CONNECT and schema USAGE, but no CREATE or TEMPORARY.
- [ ] PUBLIC has no production database/schema/object authority.
- [ ] Runtime DML matches the 22-row effective matrix exactly.
- [ ] `AuditLog` and `ScanEvent` allow only runtime SELECT/INSERT.
- [ ] Runtime has no `_prisma_migrations` privilege.
- [ ] All 20 enum types are migrator-owned and explicitly usable only by the
  intended roles.
- [ ] Default ACL probe proves future SELECT/type/sequence baseline and no
  future table write default.
- [ ] Runtime CREATE/append-only/migration-history negative probes fail with
  `42501` and leave no object/data.
- [ ] Production/test/migrator cross-database isolation passes.
- [ ] Prisma production read-only runtime smoke passes.
- [ ] CreateProduct DML/rollback passes under production-equivalent ACLs outside
  production.
- [ ] Prisma migration succeeds as migrator and fails as runtime in the
  throwaway verification environment.
- [ ] `passvero_test` ownership, grants, tunnel workflow, and test guard are
  unchanged.
- [ ] No password, URL, API key, or environment value appears in evidence or
  Git.
- [ ] No production business row was inserted.

## Remaining Execution-Time Decisions

Only these machine/operator facts remain to be filled before execution; they do
not reopen the approved database architecture:

1. Name of the existing VPS deployment OS account/group that will receive
   read-only access to `/etc/passvero/passvero-migrator.env`.
2. Named operator and reviewer for the migration window and privilege evidence.
3. Protected evidence directory and retention period for redacted outputs.
4. Name/lifecycle approval for the throwaway production-equivalent privilege
   verification database.
5. Resolution of any unexpected migrator CONNECT inherited from PUBLIC on an
   unrelated cluster database; no cluster-wide PUBLIC revoke is pre-authorized
   here.

If any item is unresolved, stop before Phase 2. Backup/restore readiness,
production Prisma runtime implementation, PM2 cutover, and first production
write remain separate approved tasks and gates.
