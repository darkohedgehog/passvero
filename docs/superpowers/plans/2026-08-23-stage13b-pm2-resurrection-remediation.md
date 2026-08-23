# Stage 13B PM2 Minimal Operator Procedure Plan

Steps use checkbox (`- [ ]`) syntax for future operator gates. This document
does not authorize their execution.

**Goal:** Reconcile PM2 resurrection state through fresh canonical runtime and
database-target attestation followed by at most two separately authorized
PM2-native save checkpoints, without deep proof engineering or direct dump
manipulation.

**Architecture:** Each mutation checkpoint is the smallest reviewed
operator-run procedure using standard system tools and direct observations. It
performs a fresh secret-safe preflight, invokes `pm2 save` exactly once,
immediately reconciles primary, fallback, and unchanged live state, then stops.
Checkpoint B is conditional on a reconciled Checkpoint A result of
`INCOMPLETE`; it is never automatic. No custom checkpoint parser, synthetic
orchestration framework, or bespoke process lifecycle harness exists.

**Tech Stack:** Ubuntu 24.04, installed PM2, `jq`, `ps`, `readlink`, `ss`,
`systemctl`, `stat`, `sha256sum`, `curl`, and the platform standard URL parser
used only for bounded secret-safe database-target classification.

**Spec:**
`docs/superpowers/specs/2026-08-23-stage13b-pm2-resurrection-remediation-design.md`

## Global Constraints

- Current authorization is documentation revision only.
- Production invocation, production mutation, PM2/service activity, database
  access, `passvero_auth` creation, role/ACL changes, and Stage 13C are not
  authorized.
- Every future production checkpoint requires a reviewed documented operator
  procedure, fresh preflight, and separate operator authorization.
- A production checkpoint may invoke PM2-native `save` exactly once and no
  other PM2 mutation.
- Never use `--force`, `FORCE`, restart, reload, resurrect, delete, startup, or
  reboot as part of this remediation.
- Never directly edit, copy, replace, rename, remove, or construct `dump.pm2`
  or `dump.pm2.bak`.
- Never automatically retry, repair, roll back, clean up, perform a second
  save, or continue after an ambiguous result.
- Never emit raw dump JSON, environment, URL, credential, PATH, command-line,
  `/proc`, or PM2 output into the operator transcript.
- Do not build or fix the rejected Checkpoint A shell artifact.
- Do not introduce a custom parser, synthetic orchestration framework, generic
  timeout/child-reaping machinery, or PM2 source-semantics proof.
- Do not rerun or repair the superseded deep-proof diagnostic artifacts.
- Preserve unrelated repository and `.superpowers/` state.

---

## Task 1: Freeze the Simplified Security Contract

**Files:**

- Modify only when documentation revision is authorized:
  `docs/superpowers/specs/2026-08-23-stage13b-pm2-resurrection-remediation-design.md`
- Modify only when documentation revision is authorized:
  `docs/superpowers/plans/2026-08-23-stage13b-pm2-resurrection-remediation.md`

- [ ] Verify the design contains the exact simplified acceptance model.
- [ ] Verify the old PM2 source-closure, full PATH equality, custom systemd
  parser, dump schema equality, and helper-proof gates are explicitly retired.
- [ ] Verify primary and fallback require security equivalence rather than byte
  or schema equality.
- [ ] Verify every future production action remains separately authorized and
  exactly once.
- [ ] Mark prior deep-proof artifacts as historical evidence that must not be
  rerun or used as mandatory predecessors.

Documentation verification:

```bash
rg -n \
  'PM2_DEEP_PROOF_ENGINEERING=STOP|EXACT_FULL_PATH_EQUALITY_REQUIRED=NO|CUSTOM_SYSTEMD_PARSER_REQUIRED=NO|PM2_SOURCE_CODE_SEMANTIC_PROOF_REQUIRED=NO|FALLBACK_POLICY=SECURITY_EQUIVALENT' \
  docs/superpowers/specs/2026-08-23-stage13b-pm2-resurrection-remediation-design.md

rg -n \
  'documentation revision only|Do not rerun|exactly once|INCOMPLETE' \
  docs/superpowers/plans/2026-08-23-stage13b-pm2-resurrection-remediation.md
```

Expected: every simplified disposition and authorization boundary is present.

## Task 2: Freeze the Minimal Checkpoint A Operator Procedure

**Produces:** the documentation-only operator contract in the authoritative
design and this plan. No executable artifact is produced.

- [ ] Fix the expected host, PM2 service identity, application name, PM2_HOME,
  installed PM2 executable, wrapper/executable, interpreter, cwd, fixed dump
  paths, listener, and local/public health targets in the future operator
  checkpoint presented for approval.
- [ ] Use `pm2 jlist` filtered directly through `jq` to require exactly one
  online `passvero` process and capture only PID, restart count, user, cwd,
  wrapper/executable, interpreter, and allowlisted argument classifications.
- [ ] Use `ps` and `readlink` for bounded live identity observations. Do not
  parse `/proc/<pid>/stat` or prove every PATH property.
- [ ] Classify the active process environment only to
  `passvero_app | passvero | LOOPBACK | 5432`, plus
  `NODE_OPTIONS_OVERRIDE=NO`; emit no raw environment, URL, credential, or
  query value.
- [ ] Use `ss` to require the expected listener to belong directly to the
  attested live PID. Stop rather than infer an arbitrary process tree.
- [ ] Use `systemctl is-active` and status-only local/public `curl` checks for
  service and health observations.
- [ ] Before save, reject dump symlinks and require expected-owner regular,
  single-link files, mode `0600`, bounded size, and location inside fixed
  PM2_HOME; record `stat` facts and SHA-256 only.
- [ ] Do not parse or require semantic canonicality of pre-save dumps.
- [ ] Define exactly one separately authorized, direct PM2-native `save`
  command. Forbid scripts, loops, retry, timeout wrappers, chaining, `--force`,
  `FORCE`, and every other PM2 lifecycle operation.
- [ ] Immediately recheck dump metadata and hashes, then use `jq` to compare
  only app name/multiplicity, user, cwd, wrapper/executable, interpreter,
  arguments, relevant PM2_HOME identity, sanitized database target, and
  unexpected override classification.
- [ ] Immediately recheck PID and standard start observations, restart count,
  executable, service state, listener ownership, local/public health, and
  sanitized active database target.
- [ ] Define `CHECKPOINT_A=PASS` only for two canonical security-equivalent
  dumps and unchanged live state.
- [ ] Define `CHECKPOINT_A=INCOMPLETE` only when primary is canonical, fallback
  remains noncanonical but its post-save hash equals protected pre-save primary,
  dump metadata is safe, and live state is unchanged; then stop for separate
  Checkpoint B authorization.
- [ ] Every mismatch or ambiguous command outcome emits only `STOP=<reason>`.
  Never retry or infer success.

## Task 3: Authorize and Execute Checkpoint A Exactly Once

**Execution model:** direct operator-run commands from the separately reviewed
Checkpoint A procedure; no generated shell artifact.

- [ ] Present the exact standard command sequence, fixed values, normalized
  output contract, stop rules, and no-unrelated-side-effect statement.
- [ ] Request a separate authorization for exactly one direct `pm2 save`.
- [ ] After authorization, perform every fresh Task 2 read-only precondition.
- [ ] Obtain explicit operator confirmation that the save has not yet been
  invoked.
- [ ] Invoke the fixed `pm2 save` command once. Never rerun it.
- [ ] Preserve the operator transcript containing only normalized evidence and
  the terminal outcome.
- [ ] On `PASS`, proceed only to Task 6.
- [ ] On `INCOMPLETE`, stop and proceed only to separately authorized Task 4.
- [ ] On `STOP`, including an interrupted or ambiguous command outcome, perform
  no retry, repair, cleanup, rollback,
  restart, reload, resurrect, or dump manipulation; stop for operator review.

Required Checkpoint A evidence:

```text
PM2_SAVE_INVOCATIONS=1
CURRENT_PM2_RUNTIME_CANONICAL=YES
PM2_RUNTIME_DATABASE_TARGET_CANONICAL=YES
PRIMARY_RESURRECTION_PROFILE=CANONICAL
LIVE_PROCESS_UNCHANGED_BY_SAVE=YES
CHECKPOINT_A_OUTCOME=PASS|INCOMPLETE
DATABASE_ACTIVITY=NONE
ROLE_ACL_ACTIVITY=NONE
STAGE13C_ACTIVITY=NONE
```

## Task 4: Conditionally Review Checkpoint B

This task exists only for a protected, independently reconciled Checkpoint A
outcome of `INCOMPLETE`.

**Produces:** a separately reviewed operator checkpoint derived from the same
minimal standard-tool procedure. No executable artifact is produced.

- [ ] Bind Checkpoint B to the exact Checkpoint A transcript, pre/post dump
  hashes, canonical primary security profile, and protected fallback state.
- [ ] Repeat every live runtime, database target, dump metadata, recovery, and
  competing-activity precondition from Task 2 using fresh observations.
- [ ] Require the canonical primary produced by Checkpoint A and unchanged live
  process identity before permitting mutation.
- [ ] Require explicit operator confirmation that Checkpoint B has not yet been
  invoked.
- [ ] After separate authorization, invoke PM2-native save exactly once and
  perform the same immediate standard-tool post-save checks as Checkpoint A.
- [ ] Require independently canonical, security-equivalent primary and fallback
  plus unchanged live runtime.
- [ ] Any other result is `STOP`; no third save or direct repair path exists.

## Task 5: Authorize and Execute Checkpoint B Exactly Once

**Execution model:** direct operator-run commands from the separately reviewed
Checkpoint B procedure.

- [ ] Present the exact procedure and Checkpoint A evidence bindings.
- [ ] Request a new, separate authorization for exactly one production
  invocation.
- [ ] After authorization, run the complete fresh preflight and invoke once.
- [ ] Never rerun Checkpoint A or B.
- [ ] Require this terminal evidence:

```text
CHECKPOINT_B_PM2_SAVE_INVOCATIONS=1
CURRENT_PM2_RUNTIME_CANONICAL=YES
PM2_RUNTIME_DATABASE_TARGET_CANONICAL=YES
PRIMARY_RESURRECTION_PROFILE=CANONICAL
FALLBACK_RESURRECTION_PROFILE=CANONICAL
PRIMARY_AND_FALLBACK_SECURITY_EQUIVALENT=YES
LIVE_PROCESS_UNCHANGED_BY_SAVE=YES
CHECKPOINT_B_OUTCOME=PASS
DATABASE_ACTIVITY=NONE
ROLE_ACL_ACTIVITY=NONE
STAGE13C_ACTIVITY=NONE
```

- [ ] Any mismatch stops the architecture. Do not retry, clean up, manipulate
  dumps, or continue the cross-database audit from an ambiguous state.

## Task 6: Complete the PM2 Cross-Database Sub-Checkpoint

**Future file — creation requires separate documentation/static authorization:**

- Create: `/private/tmp/passvero-stage13b-pm2-cross-database-reconciliation.md`

- [ ] Reconcile final protected evidence from Checkpoint A `PASS` or Checkpoint
  B `PASS`.
- [ ] Confirm active and both resurrection profiles independently classify to
  `passvero_app | passvero | LOOPBACK | 5432`.
- [ ] Confirm no active or saved dependency on `postgres`, `template1`, another
  database, non-loopback PostgreSQL, wildcard target, or unexpected credential
  source.
- [ ] Record:

```text
PM2_ACTIVE_AND_RESURRECTION_POSTGRES_TEMPLATE1_DEPENDENCY=NO
PM2_CROSS_DATABASE_SUBCHECK=PASS
CROSS_DATABASE_PUBLIC_ACL_DEPENDENCY_AUDIT_COMPLETE=NO
DATABASE_MUTATIONS=NONE
PASSVERO_AUTH_ROLE_CREATED=NO
STAGE13C_ACTIVITY=NONE
```

- [ ] Continue only to separately authorized read-only audit coverage for
  non-PM2 runtime sources, migrator, backup, test, scheduled jobs, and
  maintenance paths.
- [ ] Do not create `passvero_auth` or change ACLs in this task.

## Task 7: Return to the Stage 13B Auth Role and ACL Gate

- [ ] Require the full cross-database PUBLIC ACL dependency audit to pass after
  all remaining non-PM2 subchecks.
- [ ] Re-attest the applied auth-foundation migration and current auth table ACL
  posture read-only.
- [ ] Present a separate operator checkpoint for creating `passvero_auth` and
  granting only the approved explicit per-table privileges.
- [ ] Do not combine PM2 reconciliation, cross-database audit completion, role
  creation, ACL mutation, credential provisioning, runtime activation, or
  Stage 13C into one authorization.

## Final Documentation Review Checklist

- [ ] Design and plan state `PM2_DEEP_PROOF_ENGINEERING=STOP`.
- [ ] Full PATH equality, custom systemd parsing, PM2 source closure, and exact
  dump schema proof are retired.
- [ ] Custom checkpoint parsers, synthetic orchestration frameworks, and
  bespoke process lifecycle harnesses are retired.
- [ ] Actual executable, wrapper, and interpreter identities remain required;
  exhaustive PATH provenance does not.
- [ ] Active runtime and database target are freshly attested before each save.
- [ ] Both dump files require canonical security-equivalent profiles.
- [ ] Checkpoint A and B are distinct, separately authorized, exactly-once
  production invocations.
- [ ] Checkpoint B is possible only after Checkpoint A `INCOMPLETE`.
- [ ] No automatic retry, third save, repair, cleanup, rollback, restart,
  reload, resurrect, reboot, or direct dump manipulation exists.
- [ ] PM2 reconciliation completes only the PM2 cross-database sub-checkpoint.
- [ ] Full cross-database audit remains incomplete until every non-PM2 scope
  passes.
- [ ] `passvero_auth`, ACL changes, runtime activation, and Stage 13C remain
  separate future operator gates.
- [ ] Current authorization caused documentation changes only.
