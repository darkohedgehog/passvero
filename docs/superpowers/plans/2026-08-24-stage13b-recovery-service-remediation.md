# Stage 13B Recovery Service Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to execute this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking. This instruction does not authorize
> execution; every production checkpoint below requires its own explicit
> operator authorization.

**Goal:** Restore the production PostgreSQL backup and freshness path to a
freshly evidenced healthy state through the smallest cause-bound remediation,
without weakening recovery controls or combining it with cross-database ACL
hardening.

**Architecture:** Use a fail-closed sequence of separately authorized gates:
first identify the exact failed backup preflight predicate with read-only,
secret-safe evidence; then freeze and apply only the smallest cause-bound
change; execute the backup service once; and observe the normal freshness path.
Every ambiguous or failed result stops without retry, cleanup, marker repair,
or progression to another Stage 13B gate.

**Tech Stack:** Ubuntu 24.04, PostgreSQL 16 client tools, systemd,
`passvero-postgres-backup.service`, `passvero-backup-freshness.service`, the
existing Passvero backup scripts, protected pgpass/restic configuration, and
standard read-only inspection tools.

**Spec:**
`docs/superpowers/runbooks/passvero-postgresql-disaster-recovery.md`

## Current Authorization

This file was created under exactly:

```text
AUTHORIZE_STAGE_13B_RECOVERY_SERVICE_REMEDIATION_PLAN_DOCUMENT_ONLY=YES
DOCUMENT_PATH=docs/superpowers/plans/2026-08-24-stage13b-recovery-service-remediation.md

PRODUCTION_ACTIVITY_AUTHORIZED=NO
DATABASE_ACTIVITY_AUTHORIZED=NO
SYSTEMD_OR_PM2_ACTIVITY_AUTHORIZED=NO
BACKUP_OR_RESTIC_ACTIVITY_AUTHORIZED=NO
ACL_OR_ROLE_ACTIVITY_AUTHORIZED=NO
CREDENTIAL_ACTIVITY_AUTHORIZED=NO
STAGE13C_ACTIVITY_AUTHORIZED=NO
```

Creating and reviewing this document is the entire authorized action. The
checkboxes are future gates, not authorization to execute them.

## File Map

- Create now:
  `docs/superpowers/plans/2026-08-24-stage13b-recovery-service-remediation.md`
  — the complete documentation-only recovery-service remediation contract.
- Modify now: none.
- Production files: none under this authorization.
- Repository source, schema, migration, configuration, environment, test, and
  credential files: none.

## Evidence Baseline

The operator-supplied, read-only evidence observed on 2026-08-24 established:

- `CROSS_DATABASE_PUBLIC_ACL_DEPENDENCY_AUDIT=PASS`;
- `STAGE_13B_RECOVERY_OPERATIONAL_GATE=BLOCKED` independently of that audit;
- `passvero-postgres-backup.service` failed at
  `2026-08-24T04:08:26+02:00` with
  `BACKUP_FAILURE category=PREFLIGHT_FAILURE`
  `detail=backup_database_identity_or_acl_mismatch` and exit code `1`;
- `passvero-backup-freshness.service` reported at
  `2026-08-24T12:00:00+02:00`
  `status=ALERT category=BACKUP_STALE marker=canonical`
  `age_seconds=201188`, then exited `1`;
- the last observed canonical marker was
  `/var/lib/passvero-backup/state/last-valid-offsite.epoch`, owned by
  `root:root`, mode `0600`, last advanced with the protected
  `passvero-20260822T020636Z.offsite` evidence;
- the backup target was consistently classified as
  `passvero_backup -> passvero -> 127.0.0.1:5432` by both the installed backup
  script constants and the protected pgpass first four fields;
- the backup and freshness timers were enabled and active, but timer scheduling
  did not make either failed operational path healthy;
- no active or retained legitimate production path required `postgres` or
  `template1`.

These observations are the incident baseline only. They must be refreshed at
the future checkpoints and must not be treated as current proof after time has
passed.

## Global Constraints

- Preserve the only approved backup database target:
  `passvero_backup -> passvero -> LOOPBACK -> 5432`.
- Preserve the snapshot host classification `passvero-production`.
- Never print or copy passwords, pgpass password fields, restic credentials,
  repository URLs, Telegram credentials, raw process environments, or database
  connection URLs into evidence.
- Do not edit `/etc/passvero/backup/pgpass`, any credential file, or any
  environment file under this plan without a new dedicated credential plan and
  authorization.
- Do not manually create, touch, rewrite, backdate, or delete the canonical
  valid-offsite marker or any `.offsite` evidence.
- Do not use direct restic mutation, `forget`, `prune`, `unlock`, repository
  repair, or snapshot deletion.
- Do not weaken or bypass the backup preflight merely to make the service run.
- Do not grant superuser, ownership, role membership, `BYPASSRLS`, write
  privileges, cross-database access, or any privilege broader than a freshly
  proven backup requirement.
- Do not run `systemctl start`, `restart`, `reset-failed`, daemon reload, or any
  PM2 operation unless the exact future checkpoint separately authorizes it.
- Do not automatically retry, roll back, clean up, repair, or continue after a
  failed or ambiguous checkpoint.
- Keep cross-database PUBLIC ACL hardening blocked until the independent
  recovery operational gate is `PASS`.
- Do not combine this plan with `passvero_auth`, schema/migration deployment,
  Stage 13C, application writes, or unrelated production maintenance.
- Each production transcript records only normalized evidence and the exact
  gate verdict. Raw protected artifacts remain on the server.

---

### Task 1: Freeze the Read-Only Root-Cause Checkpoint

**Files:**

- Read only after separate authorization:
  `/usr/local/sbin/passvero-postgres-backup`
- Read only after separate authorization:
  `/usr/local/sbin/passvero-backup-freshness`
- Read only after separate authorization: the installed backup/freshness unit
  and timer definitions reported by systemd.
- Read only after separate authorization:
  `/etc/passvero/backup/pgpass`, with output restricted to fields 1 through 4.
- Modify: none.

**Interfaces:**

- Consumes: the Evidence Baseline and Global Constraints in this document.
- Produces: one exact root-cause classification and the minimal set of failed
  preflight predicates, without changing server or database state.

Required future authorization token:

```text
AUTHORIZE_STAGE_13B_RECOVERY_SERVICE_ROOT_CAUSE_READ_ONLY=YES
```

That token authorizes only the bounded production and database read-only audit
defined by this task. It does not authorize service execution, backup, restic,
ACL/role/configuration/credential changes, or later tasks.

- [ ] **Step 1: Reconfirm host and installed artifact identity read-only**

  Require the expected production host before collecting only path, owner,
  group, mode, size, modification time, and SHA-256 for the three installed
  scripts and four systemd units/timers. Reject symlinks, unexpected owners,
  group/other writability, missing paths, and multiple applicable unit files.
  Do not emit script content in the normalized transcript.

- [ ] **Step 2: Reconfirm the fixed target without exposing credentials**

  Read only the installed script assignments for `database_host`,
  `database_port`, `database_name`, `backup_role`, and `snapshot_host`. Read
  only pgpass fields 1 through 4 and require exactly one matching entry. Emit
  only:

  ```text
  BACKUP_TARGET=passvero_backup|passvero|LOOPBACK|5432
  SNAPSHOT_HOST=passvero-production
  PGPASS_TARGET_MATCH=YES
  SECRETS_EXPOSED=NO
  ```

  Any wildcard, second entry, non-loopback host, unexpected role/database, or
  parsing ambiguity returns `ROOT_CAUSE_AUDIT=BLOCKED` and stops.

- [ ] **Step 3: Enumerate the exact preflight predicates statically**

  Inspect, as root and without executing the script, the complete function or
  branch that can emit
  `backup_database_identity_or_acl_mismatch`. Record a numbered list of every
  Boolean predicate feeding that single failure detail and classify each as:

  ```text
  CONNECTION_IDENTITY
  DATABASE_LEVEL_PRIVILEGE
  SCHEMA_OR_OBJECT_PRIVILEGE
  ROLE_ATTRIBUTE_OR_MEMBERSHIP
  DEFAULT_PRIVILEGE_ASSUMPTION
  STATIC_SCRIPT_ASSUMPTION
  ```

  Hash the inspected script and bind the list to that hash. If all predicates
  cannot be traced from installed source, return
  `ROOT_CAUSE_AUDIT=INCOMPLETE` and stop. Do not run the backup script to infer
  the missing predicate.

- [ ] **Step 4: Evaluate only those predicates in a forced read-only session**

  Use the protected pgpass through its fixed path without copying its content.
  Connect only as `passvero_backup` to `passvero` on loopback port `5432`.
  Require the session to prove its actual role/database/server/port and both
  `transaction_read_only=on` and `default_transaction_read_only=on` before
  evaluating the statically enumerated predicates.

  Use catalog and privilege-introspection queries only. Do not select
  application rows, take locks beyond ordinary catalog reads, create temporary
  objects, change session role, use `SET ROLE`, or query another database.
  Normalize every predicate to `PASS` or `FAIL`; do not emit raw ACL arrays,
  password material, connection strings, or application data.

- [ ] **Step 5: Reconcile service and freshness state without starting them**

  Capture unit/timer enabled state, active/sub state, last and next trigger,
  last result, and bounded journal lines for the current failure categories.
  Record canonical marker metadata and age, plus only the basename and metadata
  of the newest matching protected `.offsite` evidence. Do not read protected
  artifact bodies or invoke restic.

- [ ] **Step 6: Return one fail-closed root-cause verdict and stop**

  The only allowed result shapes are:

  ```text
  ROOT_CAUSE_AUDIT=PASS
  FAILED_PREDICATE_COUNT=<positive integer>
  ROOT_CAUSE_CLASS=CONNECTION_IDENTITY|DATABASE_LEVEL_PRIVILEGE|SCHEMA_OR_OBJECT_PRIVILEGE|ROLE_ATTRIBUTE_OR_MEMBERSHIP|DEFAULT_PRIVILEGE_ASSUMPTION|STATIC_SCRIPT_ASSUMPTION
  MINIMAL_REMEDIATION_CLASS=CREDENTIAL_OR_TARGET|NARROW_PRODUCTION_BACKUP_ACL|ROLE_POSTURE|STATIC_PREFLIGHT_CORRECTION
  MUTATIONS=NONE
  SECRETS_EXPOSED=NO
  ```

  or:

  ```text
  ROOT_CAUSE_AUDIT=INCOMPLETE|BLOCKED
  MINIMAL_REMEDIATION_CLASS=UNDETERMINED
  MUTATIONS=NONE
  SECRETS_EXPOSED=NO
  ```

  Multiple independent failed classes, an unproven predicate, unexpected
  database identity, or ambiguous evidence is `INCOMPLETE` or `BLOCKED`.
  Stop and request a narrower diagnostic plan; do not select a remediation by
  likelihood.

### Task 2: Freeze the Smallest Cause-Bound Remediation

**Files:**

- Create or modify in production: exactly the path or ACL/role fact proven by
  Task 1; no path is approved in advance by this documentation-only plan.
- Modify in this repository: none unless a separately authorized documentation
  revision is required to preserve canonical source.

**Interfaces:**

- Consumes: `ROOT_CAUSE_AUDIT=PASS`, exactly one root-cause class, the installed
  artifact hashes, and the predicate-level Task 1 evidence.
- Produces: a reviewed, exact one-change remediation procedure with pre-state,
  expected post-state, and a stop condition. It does not execute that change.

- [ ] **Step 1: Select exactly one permitted remediation branch**

  | Proven minimal class | Permitted proposal | Mandatory exclusions |
  | --- | --- | --- |
  | `CREDENTIAL_OR_TARGET` | Stop for a dedicated credential/target plan | No credential readout, replacement, or connection fallback |
  | `NARROW_PRODUCTION_BACKUP_ACL` | Exact missing read-only privilege on the proven `passvero` object only | No database-level PUBLIC change, cross-database change, ownership, membership, or write privilege |
  | `ROLE_POSTURE` | Exact restoration of the previously approved `passvero_backup` attribute only | No superuser, ownership, membership, extra database, or broader connection limit |
  | `STATIC_PREFLIGHT_CORRECTION` | Minimal source change to an objectively stale predicate while retaining all valid safety checks | No bypass flag, unconditional success, relaxed identity, or ignored command failure |

  If the required action does not fit exactly one row, stop for a new plan.

- [ ] **Step 2: Produce the exact remediation packet without executing it**

  The packet must contain the fixed host, exact target, affected path or
  database object identity, current hash or normalized ACL/role fact, exact
  single mutation, expected post-hash or normalized fact, rollback proposal,
  and failure stop. It must explain why every broader grant, script edit,
  credential change, marker change, service operation, and cross-database
  change is excluded.

- [ ] **Step 3: Obtain branch-specific authorization and stop**

  Use exactly one token matching the proven class:

  ```text
  AUTHORIZE_STAGE_13B_RECOVERY_SERVICE_STATIC_PREFLIGHT_REMEDIATION=YES
  AUTHORIZE_STAGE_13B_RECOVERY_SERVICE_NARROW_BACKUP_ACL_REMEDIATION=YES
  AUTHORIZE_STAGE_13B_RECOVERY_SERVICE_ROLE_POSTURE_REMEDIATION=YES
  ```

  A credential/target result has no generic execution token in this plan and
  requires a new dedicated plan. No token authorizes Task 3 automatically.

### Task 3: Apply One Authorized Remediation and Reconcile It

**Files:**

- Modify: only the exact production artifact or PostgreSQL fact named in the
  separately approved Task 2 packet.
- Modify: no freshness script, marker, `.offsite` evidence, timer, PM2,
  application, schema, migration, or unrelated ACL/role fact.

**Interfaces:**

- Consumes: the Task 2 packet and its matching explicit authorization token.
- Produces: `RECOVERY_SERVICE_REMEDIATION=PASS|BLOCKED` with one mutation at
  most and fresh read-only reconciliation.

- [ ] **Step 1: Re-run all Task 2 preconditions immediately before mutation**

  Require exact equality with the reviewed host, artifact hash, target, failed
  predicate, and normalized ACL/role pre-state. Drift, an already-correct
  state, or a new failure returns `REMEDIATION_PRECHECK=BLOCKED`; perform no
  mutation.

- [ ] **Step 2: Perform the one exact approved mutation once**

  Do not chain the mutation with verification, use loops, retry, broaden the
  target, or add opportunistic cleanup. Record only exit status and normalized
  affected-object identity. If the command exits nonzero or its completion is
  ambiguous, stop without rollback or retry.

- [ ] **Step 3: Reconcile the exact changed fact read-only**

  Recheck the post-hash or normalized ACL/role fact, the approved backup target,
  and the formerly failed predicate. Do not start either service. Return:

  ```text
  RECOVERY_SERVICE_REMEDIATION=PASS|BLOCKED
  AUTHORIZED_MUTATION_COUNT=0|1
  BACKUP_EXECUTION=NONE
  RESTIC_ACTIVITY=NONE
  MARKER_ACTIVITY=NONE
  SYSTEMD_ACTIVITY=NONE
  SECRETS_EXPOSED=NO
  ```

  Only `PASS` permits requesting Task 4 authorization.

### Task 4: Execute the Backup Service Exactly Once

**Files:**

- Execute after separate authorization:
  `passvero-postgres-backup.service`
- Read only: resulting unit state, bounded journal evidence, protected backup
  evidence metadata, and canonical marker metadata.
- Modify directly: none. The reviewed backup service performs its normal
  protected backup/restic/marker workflow internally.

**Interfaces:**

- Consumes: `RECOVERY_SERVICE_REMEDIATION=PASS` and unchanged target/artifact
  evidence.
- Produces: one backup attempt result and normalized proof of a newly validated
  offsite backup.

Required future authorization token:

```text
AUTHORIZE_STAGE_13B_RECOVERY_SERVICE_SINGLE_BACKUP_EXECUTION=YES
```

The token authorizes one direct start of the existing backup unit. It does not
authorize restart, reset-failed, retry, direct script execution, direct restic,
manual marker activity, Task 5, ACL hardening, or Stage 13C.

- [ ] **Step 1: Run a final non-mutating backup preflight**

  Reconfirm the Task 3 post-state, exact installed hashes, fixed backup target,
  timer identity, absence of an active backup invocation, and absence of a
  conflicting backup lock holder. Record the pre-attempt canonical marker and
  newest `.offsite` metadata. Stop on drift or ambiguity.

- [ ] **Step 2: Start the existing backup unit once**

  Invoke exactly one direct start of `passvero-postgres-backup.service`. Do not
  use `restart`, `reset-failed`, `--no-block`, a timeout wrapper, shell chaining,
  a loop, or direct invocation of `/usr/local/sbin/passvero-postgres-backup`.
  Never retry, including after interruption or an ambiguous client result.

- [ ] **Step 3: Reconcile the single attempt read-only and stop**

  Require all of the following from the same attempt:

  - the backup unit result is success;
  - the bounded journal reports successful preflight, validated dump, completed
    encrypted offsite snapshot, protected evidence, and successful exit;
  - exactly one new protected `.offsite` evidence basename is attributable to
    the attempt;
  - the canonical marker is a root-owned mode `0600` regular file and advanced
    consistently with that new valid-offsite evidence;
  - no credential or raw protected artifact content entered the transcript.

  Return exactly:

  ```text
  SINGLE_BACKUP_EXECUTION=PASS|BLOCKED
  BACKUP_ATTEMPT_COUNT=1
  NEW_VALID_OFFSITE_EVIDENCE=YES|NO|AMBIGUOUS
  CANONICAL_MARKER_ADVANCED=YES|NO|AMBIGUOUS
  DIRECT_RESTIC_ACTIVITY=NONE
  MANUAL_MARKER_ACTIVITY=NONE
  RETRY=NONE
  SECRETS_EXPOSED=NO
  ```

  Any missing, failed, duplicated, or ambiguous fact is `BLOCKED`. Stop without
  cleanup, retry, reset-failed, or Task 5.

### Task 5: Observe Normal Freshness Recovery

**Files:**

- Execute directly: none.
- Read only after separate authorization: freshness timer/service state,
  bounded journal, canonical marker metadata/age, and the new `.offsite`
  evidence metadata established by Task 4.

**Interfaces:**

- Consumes: `SINGLE_BACKUP_EXECUTION=PASS` and its exact new evidence/marker
  identity.
- Produces: `BACKUP_FRESHNESS_RECOVERY=PASS|BLOCKED` from the next normal timer
  invocation, without starting the service manually.

Required future authorization token:

```text
AUTHORIZE_STAGE_13B_RECOVERY_SERVICE_FRESHNESS_OBSERVATION_READ_ONLY=YES
```

- [ ] **Step 1: Wait for the existing hourly timer path**

  Do not start, restart, or reset the freshness unit. Confirm the timer remains
  enabled and active, record its next trigger, and observe the first scheduled
  freshness invocation after the Task 4 marker advancement.

- [ ] **Step 2: Reconcile the scheduled result read-only**

  Require the same canonical marker identity from Task 4, age not greater than
  `93600` seconds, `status=FRESH`, no stale alert emission, a successful unit
  result, and the expected next hourly timer trigger. Do not clear alert state
  manually; any normal alert-state reconciliation must occur through the
  reviewed freshness service itself.

- [ ] **Step 3: Return the freshness verdict and stop**

  ```text
  BACKUP_FRESHNESS_RECOVERY=PASS|BLOCKED
  FRESHNESS_INVOCATION=SCHEDULED
  MARKER=canonical
  AGE_WITHIN_93600_SECONDS=YES|NO|AMBIGUOUS
  MANUAL_SYSTEMD_ACTIVITY=NONE
  MANUAL_ALERT_STATE_ACTIVITY=NONE
  SECRETS_EXPOSED=NO
  ```

  A timer that did not invoke, a non-successful unit, stale/ambiguous marker, or
  unexpected alert keeps the result `BLOCKED`. A separate plan is required if
  a direct freshness invocation becomes necessary.

### Task 6: Reconcile the Recovery Operational Gate

**Files:**

- Modify: none.
- Read only after separate authorization: evidence already bound to Tasks 1
  through 5 plus current timer/service summaries.

**Interfaces:**

- Consumes: successful results and immutable evidence bindings from every
  applicable preceding task.
- Produces: the independent Stage 13B recovery operational verdict.

- [ ] **Step 1: Require the complete success chain**

  Require all of the following:

  ```text
  ROOT_CAUSE_AUDIT=PASS
  RECOVERY_SERVICE_REMEDIATION=PASS
  SINGLE_BACKUP_EXECUTION=PASS
  BACKUP_FRESHNESS_RECOVERY=PASS
  BACKUP_TIMER=ENABLED_AND_ACTIVE
  FRESHNESS_TIMER=ENABLED_AND_ACTIVE
  SECRETS_EXPOSED=NO
  UNAUTHORIZED_MUTATIONS=NONE
  RETRIES=NONE
  ```

- [ ] **Step 2: Return exactly one independent recovery verdict**

  Return:

  ```text
  STAGE_13B_RECOVERY_OPERATIONAL_GATE=PASS
  ```

  only when the complete chain is fresh, internally consistent, and
  unambiguous. Otherwise return:

  ```text
  STAGE_13B_RECOVERY_OPERATIONAL_GATE=BLOCKED
  ```

  Do not infer health merely because timers are scheduled, a backup unit was
  manually started, or an old offsite snapshot exists.

- [ ] **Step 3: Preserve separation from the next gate**

  Recovery `PASS` authorizes no ACL or role change. It only permits asking:

  ```text
  AUTHORIZE_STAGE_13B_CROSS_DATABASE_PUBLIC_ACL_HARDENING_PLAN=DOCUMENTATION_ONLY?
  ```

  Do not request ACL execution, combine the recovery transcript with a mutation
  checkpoint, or begin Stage 13C.

## Failure and Stop Rules

- A failed or ambiguous step stops its entire task and every later task.
- Never repeat Task 3 or Task 4 automatically.
- Never repair evidence or the canonical marker to manufacture freshness.
- Never treat alert suppression as backup health.
- Never replace missing fresh evidence with inherited evidence from an earlier
  date.
- Never widen a narrow backup remediation into cross-database PUBLIC ACL
  hardening.
- Preserve failed-state evidence for review; cleanup requires its own exact
  scope and authorization.

## Documentation Verification

These commands are local documentation checks only:

```bash
test -f docs/superpowers/plans/2026-08-24-stage13b-recovery-service-remediation.md

rg -n \
  'DOCUMENT_ONLY=YES|ROOT_CAUSE_READ_ONLY|SINGLE_BACKUP_EXECUTION|FRESHNESS_OBSERVATION_READ_ONLY|STAGE_13B_RECOVERY_OPERATIONAL_GATE' \
  docs/superpowers/plans/2026-08-24-stage13b-recovery-service-remediation.md

rg -n \
  'PRODUCTION_ACTIVITY_AUTHORIZED=NO|DATABASE_ACTIVITY_AUTHORIZED=NO|ACL_OR_ROLE_ACTIVITY_AUTHORIZED=NO|STAGE13C_ACTIVITY_AUTHORIZED=NO' \
  docs/superpowers/plans/2026-08-24-stage13b-recovery-service-remediation.md

git diff --check -- \
  docs/superpowers/plans/2026-08-24-stage13b-recovery-service-remediation.md
```

Expected: the file exists; every future authorization and stop gate is
explicit; the current no-activity boundaries are retained verbatim; and the
diff has no whitespace errors.

## Completion Criteria for This Documentation-Only Authorization

- [ ] Exactly the authorized document path was created.
- [ ] No existing file was modified.
- [ ] No production, database, systemd, PM2, backup, restic, ACL, role,
  credential, or Stage 13C activity occurred.
- [ ] The plan does not guess the root cause or authorize a generic fix.
- [ ] Every future mutation remains bound to fresh evidence and a separate
  explicit token.
- [ ] Cross-database PUBLIC ACL hardening remains blocked until recovery health
  is freshly proven `PASS`.
