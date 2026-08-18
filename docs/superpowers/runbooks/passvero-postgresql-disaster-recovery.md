# Passvero PostgreSQL Disaster Recovery Runbook

## Status and scope

- Status: approved under the temporary single-operator governance exception; independent review has not occurred
- PostgreSQL major version: 16
- Recovery strategy for cluster-global state: documented deterministic bootstrap
- Approved maximum data loss: 24 hours
- Approved maximum service recovery time: 4 hours
- Recovery evidence retention: 12 months
- Database backup retention: 14 daily, 8 weekly, 6 monthly
- Governance: temporary single-operator exception documented in [the recovery governance amendment](../governance/2026-08-18-single-operator-recovery-exception.md)

This runbook rebuilds Passvero PostgreSQL after host or cluster loss. It is secret-free and requires a verified isolated restore and complete validation before any restore to a newly provisioned final production host. It does not authorize changes to a healthy production system.

The canonical sequence is: retrieve and validate one encrypted offsite snapshot, restore it into an isolated non-production cluster, complete every restored-state validation gate, and only then restore the same validated backup onto a proven-fresh final production host. A direct first-pass restore to `main:5432/passvero` is prohibited.

Application writes remain disabled until every recovery verification gate passes and an operator explicitly authorizes cutover.

## Proven recovery architecture

The production database is backed up daily at 02:00 UTC with up to 10 minutes of randomized delay and persistent timer semantics. The validated custom-format PostgreSQL dump, manifest, checksum, and table-of-contents file are stored in an encrypted Backblaze B2 restic repository. Freshness is measured only by the canonical valid-offsite marker and alerts when its age exceeds 93,600 seconds.

Checkpoint 10 restored real encrypted snapshot `0c65660c6e55641efa4a3fa40fd53afdbc2b24b51edf1d6f23f99cacece891bf`, backup set `20260818T020055Z`, into an isolated PostgreSQL 16 cluster. Schema, data, ownership representation, database-local ACLs, migrations, constraints, indexes, and exact manifest row counts passed. The measured retrieval-through-validation duration was 1,695.365 seconds.

## Recovery boundary

### Restored by the single-database dump

- schemas and database-local objects;
- tables and data;
- enums and other database-local types;
- indexes, named CHECK constraints, and foreign keys;
- migration history;
- object ownership when referenced roles already exist;
- schema, table, type, and default ACL entries contained in the archive.

### Not restored by the single-database dump

- cluster-global role definitions and attributes;
- role password verifiers;
- role memberships and role-level settings;
- `postgresql.conf`, `pg_hba.conf`, and other server configuration;
- provider, application, backup, and alerting credentials;
- database creation properties and database-level ACL state when restoring into a pre-created differently named database without `--create`.

These dependencies are reconstructed before and after `pg_restore` using the templates and verification gates below.

## Required independent recovery inputs

Do not begin recovery unless the following are available outside the failed VPS:

| Dependency | Purpose | Recovery source | Required installed metadata |
| --- | --- | --- | --- |
| Restic repository location | Identify the encrypted B2 repository | Approved configuration record or password manager | `/etc/passvero/backup/restic-repository`, `root:root`, `0600` |
| Restic repository password | Decrypt backup contents | Independent password-manager or escrow record | `/etc/passvero/backup/restic-password`, `root:root`, `0600` |
| B2 application credentials | Authenticate repository access | Password manager or provider console; rotate if uncertain | `/etc/passvero/backup/restic.env`, `root:root`, `0600` |
| Backup PostgreSQL password | Permit future backup connections | Regenerated securely, then entered into protected pgpass | `/etc/passvero/backup/pgpass`, `root:root`, `0600` |
| Telegram bot token | Deliver backup alerts | Password manager or BotFather rotation | `/etc/passvero/backup/telegram-bot-token`, `root:root`, `0600` |
| Telegram chat identifier | Route backup alerts | Approved record or rediscovery from a controlled bot conversation | `/etc/passvero/backup/telegram-chat-id`, `root:root`, `0600` |
| PostgreSQL login-role passwords | Runtime, migration, backup, and test authentication | Generate or retrieve through the approved secret process; enter interactively | PostgreSQL role state; never document values |
| Runtime environment | Application database identity after cutover | Approved secret manager or regenerated protected file | `/etc/passvero/passvero-runtime.env`, `root:root`, `0600` when provisioned |
| Migrator environment | Migration identity after cutover | Approved secret manager or regenerated protected file | `/etc/passvero/passvero-migrator.env`, `root:root`, `0600` when provisioned |

Never place a credential in this runbook, shell history, process arguments, journald, recovery evidence, or source control.

## Abort conditions

Stop without retrying or broadening permissions if any of the following occurs:

- the recovery target cannot be proven separate from an existing production or test database;
- the PostgreSQL port, cluster name, database name, or data directory differs from the approved target;
- the isolated target resolves to cluster `main`, port `5432`, database `passvero`, or database `passvero_test`;
- the final-host restore would begin before the isolated restore and full validation pass;
- the selected snapshot cannot be authenticated or read;
- repository locks exist unexpectedly;
- the retrieved checksum or `pg_restore --list` fails;
- the archive requires an unexpected owner or grantee;
- `pg_restore --exit-on-error` fails;
- ownership, ACL, catalog, migration, or manifest row counts mismatch;
- a credential would need to be exposed or supplied in a command argument;
- application writes cannot remain disabled through validation.

Preserve the isolated target and protected artifacts for diagnosis after a restore failure. Do not retry blindly.

## 1. Provision PostgreSQL 16

Provision a supported Ubuntu host and install PostgreSQL major version 16 plus the restic client used by the approved backup system. Record package versions in recovery evidence.

Create a fresh cluster. Before it contains Passvero data, establish and verify this non-secret production posture:

- cluster name: `16/main`;
- port: `5432` only on the final production host;
- `listen_addresses = 'localhost'`;
- SSL enabled;
- `max_connections = 100`;
- `shared_buffers = 128MB`;
- `TimeZone = 'Europe/Zagreb'`;
- `log_timezone = 'Europe/Zagreb'`;
- `wal_level = replica`;
- `archive_mode = off` unless a separately approved PITR design supersedes this runbook;
- `max_wal_senders = 10`;
- `password_encryption = 'scram-sha-256'`;
- Unix socket directory `/var/run/postgresql`.

Do not blindly copy an old full configuration file. Apply reviewed settings to the new host and inspect effective values through `pg_settings`. Do not print `archive_command` or any value that might contain a credential.

Verify the listener before continuing:

```sh
pg_lsclusters
sudo -u postgres psql --no-psqlrc -X --dbname=postgres --command="
  SELECT current_setting('server_version'),
         current_setting('port'),
         current_setting('listen_addresses'),
         current_setting('data_directory'),
         pg_is_in_recovery();
"
ss -H -ltn 'sport = :5432'
```

Required result: only loopback listeners (`127.0.0.1` and optionally `::1`), the expected data directory, and `pg_is_in_recovery = false`. No firewall change or public PostgreSQL listener is required.

## 2. Rebuild the authentication posture

The approved recovery model is:

```text
local   all          postgres                           peer
local   all          all                                peer
host    all          all          127.0.0.1/32          scram-sha-256
host    all          all          ::1/128               scram-sha-256
local   replication  all                                peer
host    replication  all          127.0.0.1/32          scram-sha-256
host    replication  all          ::1/128               scram-sha-256
```

Use `pg_hba_file_rules` to confirm zero parse errors and zero non-loopback host rules. Reload only after validating the recovery host's exact file. A material change to this posture triggers mandatory independent review under the governance exception.

## 3. Recreate cluster-global roles

Run the following only on the verified new recovery cluster. It intentionally contains no passwords and recreates the exact attributes inspected on 2026-08-18:

```sql
CREATE ROLE passvero_migrator
  LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS CONNECTION LIMIT -1 PASSWORD NULL;

CREATE ROLE passvero_app
  LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS CONNECTION LIMIT -1 PASSWORD NULL;

CREATE ROLE passvero_backup
  LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2 PASSWORD NULL;

CREATE ROLE passvero_test
  LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS CONNECTION LIMIT -1 PASSWORD NULL;

ALTER ROLE passvero_backup SET default_transaction_read_only = on;
```

The approved membership set is empty. Do not grant role memberships.

Set passwords interactively from the approved recovery process:

```text
\password passvero_migrator
\password passvero_app
\password passvero_backup
\password passvero_test
```

Use a controlled interactive `psql` session. Do not supply a password in SQL copied into shell history, command arguments, or this runbook.

Verify without displaying password hashes:

```sql
SELECT roles.rolname,
       roles.rolcanlogin,
       roles.rolinherit,
       roles.rolsuper,
       roles.rolcreatedb,
       roles.rolcreaterole,
       roles.rolreplication,
       roles.rolbypassrls,
       roles.rolconnlimit,
       authid.rolpassword IS NOT NULL AS password_configured
FROM pg_roles AS roles
JOIN pg_authid AS authid ON authid.oid = roles.oid
WHERE roles.rolname IN (
  'passvero_migrator', 'passvero_app', 'passvero_backup', 'passvero_test'
)
ORDER BY roles.rolname;
```

Also verify that `pg_db_role_setting` contains only `default_transaction_read_only=on` for `passvero_backup` across all databases, and that no membership row affects a Passvero role.

## 4. Create the production database and database-level ACLs

This section is a final-host template. Do not execute it until the mandatory isolated restore and validation in sections 6 through 9 pass. Create the final production database only after proving that the replacement host is fresh and confirming no database named `passvero` or `passvero_test` is an unintended pre-existing target:

```sql
CREATE DATABASE passvero
  WITH OWNER = passvero_migrator
       TEMPLATE = template0
       ENCODING = 'UTF8'
       LOCALE_PROVIDER = libc
       LC_COLLATE = 'C.UTF-8'
       LC_CTYPE = 'C.UTF-8'
       TABLESPACE = pg_default
       CONNECTION LIMIT = -1;
```

Recreate the production database ACL posture explicitly because it is outside the proven differently named, pre-created database restore path:

```sql
REVOKE ALL ON DATABASE passvero FROM PUBLIC;
REVOKE ALL ON DATABASE passvero FROM passvero_app;
REVOKE ALL ON DATABASE passvero FROM passvero_backup;
REVOKE ALL ON DATABASE passvero FROM passvero_test;

GRANT CONNECT ON DATABASE passvero TO passvero_app;
GRANT CONNECT ON DATABASE passvero TO passvero_backup;
```

The owner `passvero_migrator` retains owner rights. Expected effective posture:

- `passvero_migrator`: CONNECT, CREATE, TEMPORARY through ownership;
- `passvero_app`: CONNECT only;
- `passvero_backup`: CONNECT only;
- `passvero_test`: no CONNECT, CREATE, or TEMPORARY;
- PUBLIC: no production database privilege rows.

The `passvero_test` database is not part of production restore. Recreate it only under a separately approved test-environment procedure.

## 5. Select and retrieve an offsite snapshot

Load restic/B2 credentials from root-owned mode `0600` files without printing them. Select the newest fully validated snapshot with:

- host `passvero-production`;
- tag `passvero-postgresql`;
- a matching protected `.offsite` evidence record;
- exactly four logical files.

Record the full snapshot ID, timestamp, age, host, tags, logical file count and size, and backup-set timestamp. Require zero repository locks and a successful read-only repository check. Do not run `forget` or `prune` during recovery.

Restore into a newly created root-owned mode `0700` work directory. Require exactly these mode `0600` files and no credentials:

- `passvero-<timestamp>.dump`;
- `passvero-<timestamp>.manifest`;
- `passvero-<timestamp>.dump.sha256`;
- `passvero-<timestamp>.dump.toc`.

Validate the retrieved copy, not a local staging original:

```sh
sha256sum --check /protected/path/passvero-<timestamp>.dump.sha256
pg_restore --list /protected/path/passvero-<timestamp>.dump
```

Compare the generated archive list with the retrieved `.dump.toc`, verify manifest identity, and stop on any unexpected file or mismatch.

## 6. Mandatory isolated restore with hard anti-production gates

Create a new isolated PostgreSQL 16 recovery cluster and a new empty restore database. The isolated cluster must listen on loopback only and must not use the final production identity. Create temporary NOLOGIN role stubs for `passvero_migrator`, `passvero_app`, and `passvero_backup` so archive ownership and ACL entries can be represented without production passwords. Stop if the archive requires any unexpected non-built-in role.

Before `pg_restore`, programmatically assert all of the following:

- the target cluster is not `main`;
- the target port is not `5432`;
- the target database is neither `passvero` nor `passvero_test`;
- the target cluster, port, and database exactly match the approved isolated recovery target;
- the listener is loopback-only;
- the cluster data directory is the expected new directory;
- the target database is empty;
- the only required archive owner/grantee roles are `passvero_migrator`, `passvero_app`, `passvero_backup`, and built-in `pg_database_owner`;
- the selected dump checksum still passes.

Preserve owner and ACL semantics. Do not use `--no-owner`, `--no-acl`, `--create`, or `--clean` for this procedure. Because the retrieved dump is protected from the `postgres` operating-system user, root may open it and stream it through stdin without changing permissions:

```sh
sudo bash -c '
  set -euo pipefail
  exec 3<"/protected/path/passvero-<timestamp>.dump"
  sudo -u postgres pg_restore \
    --exit-on-error \
    --host=/var/run/postgresql \
    --port=<isolated-port> \
    --username=postgres \
    --dbname=<isolated-database> \
    <&3
'
```

Replace both placeholders only after the programmatic assertions pass. The isolated port must not be `5432`, and the isolated database must not be `passvero` or `passvero_test`. Never run this command against an existing production or test database. Do not use production application credentials.

## 7. Record the database-level ACL boundary

Do not apply the production database ACL block from section 4 to the differently named isolated database. Record that database creation properties and database-level ACLs are outside the proven single-database archive boundary. The isolated phase validates database-local ownership and ACL representation only.

After the later final-host restore, re-run the database-level ACL block from section 4 and verify owner and privileges through `pg_database`, `aclexplode(datacl)`, and `has_database_privilege`. Expected final production database owner: `passvero_migrator`. Expected PUBLIC database ACL rows: zero.

## 8. Verify database-local ownership and ACLs

The archive should restore the following state when roles exist before restore. Treat the archive as authoritative and use these templates only to diagnose or, under separate recovery approval, reconstruct a confirmed omission. Do not silently mask a restore defect.

### Ownership

Require every restored public table, including `_prisma_migrations`, to be owned by `passvero_migrator`. Require every restored public enum to be owned by `passvero_migrator`.

Expected:

- public table owner mismatch count: 0;
- public enum owner mismatch count: 0;
- public schema owner representation: `pg_database_owner`.

On the isolated target, the temporary NOLOGIN `passvero_migrator` stub represents the archive owner name only. It does not reproduce production login capability or passwords. Database-level ownership is verified separately because it is outside the differently named isolated-database restore boundary.

### Schema

- `public` owner representation: `pg_database_owner`;
- `passvero_app`: USAGE;
- `passvero_backup`: USAGE;
- `pg_database_owner`: USAGE and CREATE;
- PUBLIC: no schema ACL rows.

### Runtime table matrix

The application role has these direct table privileges:

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `AuditLog` | yes | yes | no | no |
| `Membership` | yes | no | no | no |
| `Organization` | yes | no | no | no |
| `Product` | yes | yes | yes | no |
| `ProductTranslation` | yes | yes | no | no |
| `ProductVersion` | yes | yes | no | no |
| `ScanEvent` | yes | yes | no | no |

For all other application tables and `_prisma_migrations`, `passvero_app` has no direct table privilege. Verify the complete 22-of-22 approved matrix, not only the rows above.

`passvero_backup` must have SELECT on all 22 public tables and no INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, or TRIGGER privilege.

PUBLIC must have no public-schema, public-relation, or enum/type ACL rows.

### Default ACL baseline

Require exactly these seven entries for objects created by `passvero_migrator`:

1. global types: `passvero_migrator` USAGE;
2. global functions: `passvero_migrator` EXECUTE;
3. public sequences: `passvero_app` USAGE;
4. public sequences: `passvero_backup` SELECT;
5. public types: `passvero_app` USAGE;
6. public tables: `passvero_app` SELECT;
7. public tables: `passvero_backup` SELECT.

## 9. Validate restored catalog and data

Complete this validation on the mandatory isolated target before any final-host restore. Compare the restore with the selected manifest. Never print business values.

The 2026-08-18 reference backup contained:

- 21 application tables;
- 1 `_prisma_migrations` table;
- 22 total public tables;
- 20 enums;
- 0 persistent sequences;
- migrations 16 total, 16 successful, 0 unfinished, 0 rolled back;
- 77 named CHECK constraints;
- 41 foreign keys;
- 6 partial unique indexes;
- 0 invalid indexes;
- 0 RLS-enabled and 0 RLS-forced tables;
- 0 large objects.

Future backups may contain different counts. The selected manifest is authoritative. Compare every application table and `_prisma_migrations`; require all table counts to match, zero missing tables, zero mismatches, and zero unexpected tables. Run representative read-only counts for migrations, Product, and Organization without exposing rows.

Require zero table and enum ownership mismatches. Confirm the runtime ACL matrix, backup SELECT-only coverage, seven-row default ACL baseline, and PUBLIC hardening.

Record an explicit isolated-restore PASS only when schema/catalog, migrations, exact manifest row counts, ownership, runtime ACLs, backup ACLs, default ACLs, and PUBLIC hardening all pass. Without that PASS, final-host restoration is prohibited.

### Isolated-cluster cleanup gate

Capture and protect the isolated restore evidence before cleanup. If restore or validation failed, preserve the isolated cluster and retrieved artifacts for diagnosis; do not delete the failed target without a separate diagnostic disposition.

Before deleting a successfully validated isolated target:

1. run `pg_lsclusters` and identify the exact isolated PostgreSQL 16 cluster;
2. confirm the cluster name is not `main`;
3. confirm its port is not `5432`;
4. confirm its exact data directory, configuration directory, and log path;
5. confirm the expected isolated loopback listener;
6. confirm any production `main` cluster is separately identified and outside the deletion target;
7. obtain explicit operator authorization naming the exact isolated cluster.

Delete only the confirmed cluster with PostgreSQL cluster tooling:

```sh
pg_dropcluster --stop 16 <exact-isolated-cluster-name>
```

Do not substitute broad filesystem deletion. After deletion, verify that the isolated cluster is absent, its port is closed, any production `main` cluster remains unchanged, and no isolated PostgreSQL process, session, or lock remains.

Retrieved-artifact cleanup is a separate exact-path operation performed only after evidence capture. It must not remove the selected restic snapshot, `.offsite` evidence, recovery evidence, or canonical valid-offsite marker.

## 10. Restore onto the final production host after isolated PASS

Proceed only after retaining evidence of the isolated restore and complete validation PASS. Prove that the final host is newly provisioned, that only the expected fresh PostgreSQL cluster exists, and that no existing production or test database can be affected.

On the final host:

1. apply and verify the PostgreSQL 16 localhost/SCRAM posture from sections 1 and 2;
2. create the exact production LOGIN roles from section 3 and provision their passwords through the approved secret process;
3. create `passvero` and its database-level ACL posture from section 4;
4. revalidate the selected snapshot identity, retrieved file set, and dump checksum;
5. assert cluster `main`, port `5432`, database `passvero`, the expected new data directory, and an empty target database;
6. prove that `passvero_test` is not a restore target and that no pre-existing database can be affected;
7. restore the same isolated-validated dump with `--exit-on-error`, preserving owner and ACL semantics and without `--clean`, `--create`, `--no-owner`, or `--no-acl`;
8. reapply and verify the database-level ACL block from section 4;
9. repeat every ownership, database-local ACL, catalog, migration, index, constraint, and exact manifest row-count validation from sections 8 and 9.

Keep the protected root-to-`postgres` stdin method from section 6. For this second restore only, the verified final target is `main:5432/passvero`. This is never a first-pass restore path and is valid only on the proven-fresh replacement host after isolated PASS.

Application writes remain disabled throughout final-host restoration and validation.

## 11. Reprovision operational secrets and automation

After database validation:

1. generate or retrieve each credential through its approved source;
2. install it only into the root-owned protected path listed in the dependency matrix;
3. create the backup pgpass entry without printing the password;
4. validate application and migrator connection identities while writes remain disabled;
5. validate restic authentication and require zero locks;
6. test the alert transport with safe metadata only;
7. install and enable backup/freshness services and timers only after their exact reviewed content is restored;
8. confirm the backup timer remains daily at 02:00 UTC with no more than 10 minutes randomized delay and `Persistent=true`;
9. confirm the freshness timer is hourly and alerts only when canonical marker age exceeds 93,600 seconds.

Rotate recovered credentials after a host-loss incident when compromise cannot be ruled out. Rotation must not precede restoration of access to the encrypted backup repository if the old credential is required for retrieval.

## 12. Cutover gate and rollback

Do not enable application writes until all of these are true:

- the mandatory isolated restore and complete validation PASS is retained in recovery evidence;
- the final-host restore used the same validated offsite backup and repeated the full validation successfully;
- PostgreSQL is localhost-only and the HBA posture passes;
- role attributes, settings, passwords-configured state, and zero memberships pass;
- database ownership and database-level ACLs pass;
- restored ownership, runtime ACL, backup ACL, default ACL, and PUBLIC hardening pass;
- migrations, catalog counts, indexes, constraints, and manifest row counts pass;
- application and backup identities connect only to their approved database;
- protected secrets and backup/alert automation pass;
- recovery evidence is written and reviewed;
- an operator explicitly authorizes cutover.

If isolated validation fails, do not begin final-host restoration. If final-host validation fails, keep writes disabled and retain the failed recovery target and evidence. Revert traffic to the last known-good host only when that is safe and explicitly authorized. Never repair a source production database merely to make a recovery test pass.

## 13. Evidence, RPO, and RTO

Record safe evidence separately for the isolated restore PASS and final-host restore: snapshot selection, retrieval, checksum, archive readability, target identities, role/bootstrap verification, database-level ACLs, restore options and results, durations, catalog and row-count summaries, cleanup, and the final verdict. Do not record credentials, password hashes, raw environments, or business values.

Recovery evidence is retained for 12 months. This is distinct from database backup retention of 14 daily, 8 weekly, and 6 monthly snapshots.

The approved RPO is a maximum of 24 hours of committed data loss. A daily backup can approach that maximum before the next successful run; a stricter target requires more frequent backups or a separately designed WAL/PITR architecture.

The approved maximum service recovery time is 4 hours. The measured database retrieval, restore, and validation evidence is 28 minutes 15.365 seconds. A real full-service recovery also includes VPS provisioning, package installation, secret recovery, deterministic global bootstrap, application verification, and traffic cutover. The measured database result supplies margin but is not itself a measurement of every host-loss activity.

## 14. Governance and self-review

Independent review has not occurred. During the approved single-operator exception, the owner/operator must complete the amendment's self-review checklist, retain recovery evidence, re-evaluate the exception every 3 months, and obtain independent review at the earliest approved trigger or by 2027-08-18.

The exception is not a permanent removal of review and does not authorize cutover by itself.
