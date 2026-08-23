# Stage 13B PM2 Resurrection-State Remediation Design

**Status:** Approved minimal operator procedure; documentation revision only.

**Date:** 2026-08-23

## Decision

Stage 13B stops the PM2 deep-proof-engineering chain. Production safety is
established from the state that is running and the resurrection state that PM2
actually writes, not from a formal model of every PM2, PATH, systemd, or dump
serialization implementation detail.

The normative disposition is:

```text
PM2_DEEP_PROOF_ENGINEERING=STOP
PM2_ACCEPTANCE_MODEL=CANONICAL_LIVE_RUNTIME_AND_DATABASE_TARGET_PLUS_PM2_NATIVE_SAVE_CONVERGENCE_WITH_SECURITY_EQUIVALENT_PRIMARY_AND_FALLBACK_AND_POST_SAVE_LIVE_STABILITY_RECONCILIATION
PM2_NATIVE_REGENERATION_REQUIRED=YES
CROSS_DATABASE_AUDIT_CAN_CONTINUE_AFTER_SIMPLIFIED_PM2_RECONCILIATION=YES

EXACT_FULL_PATH_EQUALITY_REQUIRED=NO
CUSTOM_SYSTEMD_PARSER_REQUIRED=NO
PM2_SOURCE_CODE_SEMANTIC_PROOF_REQUIRED=NO
PRIMARY_FALLBACK_BYTE_EQUALITY_REQUIRED=NO
PRIMARY_FALLBACK_SCHEMA_EQUALITY_REQUIRED=NO
CUSTOM_CHECKPOINT_PARSER_REQUIRED=NO
SYNTHETIC_ORCHESTRATION_FRAMEWORK_REQUIRED=NO
BESPOKE_PROCESS_LIFECYCLE_HARNESS_REQUIRED=NO

FALLBACK_POLICY=SECURITY_EQUIVALENT_AND_CANONICAL_FOR_SAME_APP
DIRECT_PM2_DUMP_HAND_EDIT=NO
DIRECT_PM2_DUMP_COPY_REPLACEMENT=NO
EACH_PRODUCTION_CHECKPOINT_REQUIRES_SEPARATE_AUTHORIZATION=YES
CHECKPOINT_A_EXECUTION_MODEL=SMALLEST_OPERATOR_RUN_STANDARD_SYSTEM_TOOL_PROCEDURE
```

This revision authorizes documentation changes only. It does not authorize a
production invocation, PM2 or service activity, database access, role or ACL
changes, creation of `passvero_auth`, an existing diagnostic rerun, or Stage
13C.

## Original Security Objective

The PM2 checkpoint must reasonably prevent Passvero from rebooting or
resurrecting into a stale or unsafe runtime configuration. In particular, the
active and persisted runtime must not intentionally select:

- PostgreSQL database `postgres` or `template1`;
- another database;
- a non-loopback PostgreSQL endpoint;
- a wildcard database target;
- an unexpected credential or environment source;
- an alternate Passvero application launch path.

The checkpoint does not need to formally model every possible PM2 dump,
systemd source construct, PATH permutation, helper lifecycle, or undocumented
PM2 implementation path.

## Current Known State

The existing evidence establishes:

- one healthy production Passvero PM2 process;
- previously verified wrapper, cwd, runtime posture, PM2_HOME, and listener;
- stable PM2 restart count during the earlier observation window;
- `dump.pm2` and `dump.pm2.bak` protected with mode `0600`;
- no PM2 restart, reload, resurrect, or Stage 13C activity during Stage 13B;
- divergent or stale primary and fallback resurrection structures;
- no evidence that this saved-state divergence compromised the currently
  running process.

The evidence is not permanently fresh. Every future save checkpoint must
re-establish the required live facts immediately before mutation.

## Trust Boundaries

1. Passvero's protected wrapper, runtime environment, and application
   configuration remain the canonical launch inputs.
2. The running PM2 daemon and Passvero process may be serialized only after a
   fresh secret-safe runtime and database-target attestation.
3. `dump.pm2` and `dump.pm2.bak` are derived recovery artifacts. Neither is
   identity, authorization, credential, or database-binding authority.
4. PM2-native save is the only approved regeneration mechanism.
5. Root may gate, attest, and protect evidence but must not construct or repair
   PM2 JSON.
6. A successful PM2 command exit is not sufficient. Saved state and unchanged
   live state must both pass post-save reconciliation.

## Security-Critical Acceptance Criteria

The PM2 remediation is complete only when all of the following are true:

```text
CURRENT_PM2_RUNTIME_CANONICAL=YES
PM2_RUNTIME_DATABASE_TARGET_CANONICAL=YES
PM2_DUMP_PERMISSIONS_SECURE=YES
PM2_RESURRECTION_STATE_REGENERATED_FROM_CURRENT_RUNTIME=YES
PM2_SAVED_RUNTIME_RECONCILIATION=YES
PM2_RESURRECTION_DATABASE_TARGET_SAFE=YES
LIVE_PROCESS_UNCHANGED_BY_SAVE=YES
PRIMARY_AND_FALLBACK_SECURITY_EQUIVALENT=YES
```

### Canonical live runtime

A fresh pre-save check must establish:

- exactly one expected `passvero` PM2 application;
- expected PM2 and application OS identities;
- expected wrapper or executable target;
- expected cwd and PM2_HOME;
- expected Node executable and any interpreter actually used by the launch
  chain;
- no unexpected application arguments or alternate launch target;
- expected local listener and healthy local/public application checks;
- stable process identity and restart count during the preflight.

Literal equality, provenance, or exhaustive safety analysis of every PATH
component is not required. The operator verifies only the actual executable,
wrapper, interpreter, cwd, user, and launch-argument identities observed for
the live process. Any unexpected active identity stops the checkpoint.

### Canonical runtime database target

The effective active runtime binding must classify, without emitting secrets,
as:

```text
ROLE=passvero_app
DATABASE=passvero
HOST_CLASS=LOOPBACK
PORT=5432
POSTGRES_TEMPLATE1_DEPENDENCY=NO
WILDCARD_TARGET=NO
UNEXPECTED_CREDENTIAL_SOURCE=NO
NODE_OPTIONS_OVERRIDE=NO
```

The active process environment is authoritative for this checkpoint. A small
bounded classifier may use the platform's standard URL parser, but it emits
only the normalized fields above. It must not print the raw environment, URL,
credentials, query values, or an environment-derived secret hash. Persisted
environment files alone do not prove the active binding.

### Secure dump files

Both resurrection sources must be regular, single-link, non-symlink files
owned by the expected account, mode `0600`, inside the expected protected
PM2_HOME. Neither may be group/world writable.

### Security-equivalent saved runtime

Primary and fallback need not be byte-identical or schema-identical. Each must
independently describe exactly one canonical Passvero application with the
same security-relevant profile:

- process name and multiplicity;
- application user identity where persisted;
- wrapper, executable, and interpreter identities;
- cwd and PM2_HOME relationship;
- allowlisted command-argument shape;
- canonical database target classification;
- no unexpected credential source;
- no stale alternate application launch path.

Volatile PM2 metadata, counters, timestamps, ordering, and unrelated optional
fields do not participate in the security verdict.

## Retired Proof Requirements

The following are no longer Stage 13B acceptance gates:

- literal full PATH tuple equality;
- byte equality of PATH across all cgroup processes;
- a fixed complete PATH tuple, beyond safe actual tool resolution;
- npm interpreter content hashing or full content reconciliation;
- complete PM2 package source hash closure;
- `package.json` bin-map proof;
- exact PM2 dump schema-shape proof;
- primary/fallback schema or byte equality;
- explicit presence of systemd `WorkingDirectory` when effective and active cwd
  are known;
- custom parsing of all legal systemd continuation forms;
- helper-reap proof as an independent acceptance gate;
- generic subprocess timeout, signal, or child-reaping machinery;
- PM2 save-rotation implementation-source proof;
- custom checkpoint or systemd parsers;
- synthetic orchestration frameworks or production-backend fidelity proofs;
- bespoke synthetic parser corpora and repeated one-shot diagnostic chains.

Existing deep-proof diagnostic artifacts are historical evidence only. They
must not be rerun, repaired, or treated as required predecessors of the
simplified checkpoint.

## Direct Operational Verification Model

Future checkpoints are operator-run procedures using direct, bounded,
read-only inspection through standard system tools:

- `pm2 jlist` filtered directly through `jq`, without emitting raw PM2 JSON;
- `ps` and `readlink` for live PID, user, start observation, cwd, executable,
  wrapper, and interpreter identity;
- a bounded standard-library URL classification of the active process database
  binding, with normalized output only;
- `ss` for listener ownership by the expected live PID;
- `systemctl is-active` where service state is relevant;
- `stat` and `sha256sum` for primary and fallback metadata and identity;
- `curl` with discarded bodies and fixed status-only output for local/public
  health;
- actual PM2/app process identity, cwd, executable, environment classification,
  listener, and health;
- primary and fallback through `jq` using an explicit allowlist of
  security-relevant fields.

No custom checkpoint parser, systemd parser, synthetic orchestration framework,
bespoke process lifecycle harness, or PM2 transitive source-semantics proof is
required. Installed PM2 version, absolute executable identity, ownership,
mode, and PM2_HOME remain useful preflight facts, but actual post-save state is
authoritative.

Raw PM2, dump, environment, URL, credential, command-line, or `/proc` values
must not enter the operator transcript. Standard tools must be filtered at the
source so the transcript contains only fixed fields, counts, hashes of the dump
files themselves, health codes, and normalized security classifications.

## Minimal Operator Procedure

### 1. Fresh live-state observation

The operator uses `pm2 jlist | jq` to require exactly one `passvero`
application that is online and has the expected user, cwd, wrapper/executable,
interpreter, and allowlisted command arguments. The operator records the PM2
PID and restart count. `ps` supplies the PID, user, start-time observation,
elapsed time, and command identity; `readlink` confirms the actual executable.
Raw PM2 JSON and raw command lines are not printed or retained.

### 2. Active database-target observation

The operator classifies only the active process binding and the presence of an
unexpected active `NODE_OPTIONS`. The accepted normalized result is
`passvero_app | passvero | LOOPBACK | 5432 | NODE_OPTIONS_OVERRIDE=NO`.
`postgres`, `template1`, another database, a wildcard or non-loopback target,
an unexpected credential source, ambiguous binding, or an active
`NODE_OPTIONS` override stops before mutation.

### 3. Listener and health observation

`ss` must show exactly one expected local listener and associate it with the
attested live PID. If the deployed topology does not permit that direct
association, the checkpoint stops for a separately reviewed procedure change;
it does not infer an arbitrary process tree. `systemctl is-active` must report
the expected service active. Local and public `curl` checks discard response
bodies and record status only.

### 4. Dump pre-save observation

For both fixed dump paths, the operator rejects symlinks and requires an
expected-owner regular file, one link, mode `0600`, bounded size, and location
inside the expected PM2_HOME. The operator records `stat` facts and SHA-256 for
each file. No pre-save semantic-canonicality parser is run.

### 5. Exactly one native save

After a distinct production authorization, the operator invokes exactly one
fixed PM2-native command as the existing PM2 service identity:

```text
sudo -u darko env -i HOME=/home/darko PM2_HOME=/home/darko/.pm2 PATH=/usr/bin:/bin /usr/lib/node_modules/pm2/bin/pm2 save
```

The operator does not use `--force` or `FORCE`, a retry loop, a timeout wrapper,
command chaining, or another PM2 lifecycle command. A nonzero, interrupted, or
ambiguous outcome stops the procedure and is never rerun automatically.

### 6. Immediate saved-state observation

The operator repeats dump metadata and hashes, then uses `jq` to inspect each
file independently. Only app name and multiplicity, user, cwd,
wrapper/executable, interpreter, command arguments, relevant PM2_HOME identity,
sanitized database-target classification, and unexpected active override
classification participate. Volatile PM2 fields are ignored.

### 7. Immediate live-state recheck

The operator repeats PM2 PID and restart count, `ps` start and elapsed
observations, executable identity, service state, listener ownership, local and
public health, and sanitized active database target. Where an exact start
identity is not exposed reliably by a standard tool, the combined unchanged
PM2 PID, restart count, executable, cwd, listener PID, service state, and health
observations are sufficient. Custom `/proc/<pid>/stat` parsing is forbidden.

### 8. Outcome

The operator records `CHECKPOINT_A=PASS` only when primary and fallback are
both independently canonical and security-equivalent and the live runtime is
unchanged.

The operator records:

```text
CHECKPOINT_A=INCOMPLETE
STOP=SEPARATE_CHECKPOINT_B_AUTHORIZATION_REQUIRED
```

only when primary is canonical, fallback is not yet canonical, fallback's
post-save hash equals the protected pre-save primary hash, all dump metadata
remains safe, and the live runtime is unchanged. Every other condition records
only `STOP=<reason>` and no successful checkpoint result.

## Disposition of the Rejected Custom Artifact Findings

| Finding | Disposition under this procedure |
| --- | --- |
| I1 pre-save canonical parser rejects stale state | Eliminated: no pre-save semantic parser is used. |
| I2 unreliable custom `/proc` stat splitting | Retained objective: use standard `ps` observations; custom parsing is forbidden. |
| I3 listener not associated with the attested PID | Retained: direct `ss` PID association is required. |
| I4 incomplete custom child timeout/reaping | Eliminated: no subprocess lifecycle harness or timeout wrapper exists. |
| I5 synthetic tests bypass production behavior | Eliminated: direct production observations are authoritative; no synthetic orchestration claim exists. |
| S1 unreviewed execution environment omitted | Retained narrowly: database target and unexpected active `NODE_OPTIONS` are classified. |
| S2 full safe PATH resolution absent | Retained narrowly: actual executable, wrapper, and interpreter identities are checked; exhaustive PATH proof is retired. |

## Two-Checkpoint PM2-Native Convergence

Official PM2 documentation defines `pm2 save` as the supported operation for
persisting the current process list for later resurrection. The installed
version's observed save model can move the previous primary into fallback
before writing the current list to primary. Convergence is therefore handled
operationally rather than proven through a source closure.

### Checkpoint A

After a fresh successful preflight, the separately authorized operator
procedure may invoke exactly one PM2-native save as the existing PM2 service
identity. It must not use `--force` or `FORCE` and must not restart, reload,
resurrect, delete, or otherwise change the active application.

The same production checkpoint immediately reconciles both dump files and the
unchanged live runtime. Its outcome is:

- `PASS` only if both files are already security-equivalent and canonical;
- `INCOMPLETE` if primary is canonical and fallback is still the protected
  pre-save primary;
- no checkpoint success result, plus `STOP=<reason>`, for any other result,
  ambiguity, unexpected file transition, or live-process change.

`INCOMPLETE` never authorizes another save automatically.

### Checkpoint B

Checkpoint B exists only after an independently reconciled Checkpoint A result
of `INCOMPLETE` and a new operator authorization. It performs a fresh complete
preflight and exactly one additional PM2-native save. Post-save reconciliation
must establish canonical security-equivalent primary and fallback files plus
an unchanged healthy live process.

There is no automatic retry, repair, cleanup, rollback, or third save. Failure
to converge after Checkpoint B stops this architecture. The next alternative
would be a separately designed deterministic boot model from canonical
application configuration, never direct dump manipulation.

## Required Pre-Save Checks

Every checkpoint freshly establishes:

1. canonical live PM2/application identity and health;
2. canonical active runtime database binding;
3. canonical PM2_HOME and actual executable/interpreter resolution;
4. secure primary and fallback metadata;
5. pre-save `stat` facts and hashes for primary and fallback;
6. fresh backup/recovery posture where required by the production runbook;
7. no deployment, migration, backup/restore, competing PM2 checkpoint, or
   Stage 13C activity;
8. explicit operator confirmation that the separately authorized save has not
   yet been invoked.

## Required Post-Save Checks

Every checkpoint immediately establishes:

1. exactly one authorized save invocation and its exit or ambiguity state;
2. primary and fallback file identities, ownership, mode, link count, bounded
   size, and parseability;
3. independent security-profile classification of each file;
4. unchanged PM2/app PID and start identity where stable, restart count,
   listener, service state, and local/public health;
5. no restart, reload, resurrect, deployment, migration, or Stage 13C activity;
6. `CHECKPOINT_A=PASS`, or `CHECKPOINT_A=INCOMPLETE` followed by the mandatory
   Checkpoint B stop gate; failures emit only `STOP=<reason>`.

Command success never overrides a failed postcondition.

## Cross-Database Audit Integration

Successful simplified reconciliation may establish only:

```text
PM2_ACTIVE_AND_RESURRECTION_POSTGRES_TEMPLATE1_DEPENDENCY=NO
```

It completes the PM2 sub-checkpoint, not the full cross-database PUBLIC ACL
dependency audit. The audit must still cover runtime sources not owned by PM2,
migrator, backup, test, scheduled jobs, and maintenance paths.

Only after those remaining read-only subchecks pass may Stage 13B continue to
the separately authorized `passvero_auth` role and ACL checkpoint. PM2
reconciliation never creates the role or grants privileges.

## Residual Risk

The simplified procedure does not perform an actual reboot or resurrection
test. Residual risk includes a latent PM2 defect, interruption during a
non-atomic save, or configuration drift after reconciliation. The risk is
acceptable for continuation of Stage 13B only when both saved profiles are
canonical and protected and the live runtime remains unchanged.

A real reboot or resurrection test remains a distinct high-risk maintenance
checkpoint with its own availability and rollback plan. It is not required by
this remediation and is not authorized here.

## Failure and Recovery

Any nonzero exit, interruption, ambiguous command outcome or target, unsafe metadata,
unparseable dump, unexpected credential source, database mismatch, live-process
change, or competing activity stops the checkpoint.

There is no automatic retry, second save, repair, rollback, cleanup, dump
editing, restart, reload, resurrect, reboot, role/ACL change, or Stage 13C
action. Every subsequent action requires a new operator decision based on the
protected pre/post evidence.

## Completion Criteria

The PM2 sub-checkpoint is complete only when:

1. canonical live runtime and database target pass a fresh attestation;
2. PM2-native save checkpoint(s) were each separately authorized and invoked
   exactly once;
3. primary and fallback are independently security-equivalent and canonical;
4. the running process remained stable and healthy across every save;
5. final normalized evidence is reconciled;
6. no production database, role/ACL, application deployment, or Stage 13C
   action occurred;
7. the overall cross-database audit remains explicitly incomplete until its
   remaining non-PM2 scopes pass.
