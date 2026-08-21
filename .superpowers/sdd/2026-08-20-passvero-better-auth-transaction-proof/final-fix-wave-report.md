# Stage 13A final-review fix-wave report

## Scope and immutable execution outcome

- Fix-wave base: `3de5b07eb471a1e73971d2990aca5fc6f6e05757`.
- This is one static-only, unexecuted successor fix wave.
- Historical executed source remains
  `d1f350627c3da72feaa18eb5416ff17e07db81a8`.
- `run-proof.sh --all` invocation count remains 1; retry count remains 0; the
  command was not invoked and MUST NOT be retried.
- Historical outcome remains overall `FAIL`, H1-H7 `NOT_EXECUTED` with
  `STOP_PRE_EVIDENCE_FAILURE`, cleanup `FAIL_RETAINED` with `rootGone=false`,
  blocked persistence, no selected runtime boundary, and a non-implementable
  candidate migration contract.
- No PostgreSQL command or connection, server start, Prisma database command,
  package install, network operation, environment/secret/credential access,
  application runtime/config change, canonical schema/migration change, or
  generated-client change was performed.

## Findings resolved

### SQL capture and validation

- The successor runner no longer captures `npm run schema:sql` output. It calls
  the installed Prisma CLI entry point directly, writes only that command's
  stdout to the protected SQL file, and routes stderr to the already protected
  orchestration log.
- `validateGeneratedSql` now rejects any non-allowlisted preamble or statement,
  including npm banners, trailing queries, block/inline comment tricks,
  unexpected enum/index/foreign-key declarations, duplicate declarations,
  qualified/unquoted tables, and unsupported statement forms.
- Regression tests observed RED when the previous validator accepted an npm
  banner and unrelated statements, then GREEN after the stricter statement
  gate.

### Installed-source integrity

- The committed harness lockfile SHA-256 is pinned as
  `afc199a95a6c0de4fc98a61d14f04093436dc10f1d86b2c371afef5a2815fd27`.
- The installed disposable harness verifier hashes all 19 reviewed Better
  Auth/core/Prisma-adapter source files and the lockfile after `npm ci` and
  before cluster startup is reachable.
- The verifier rejects path, symlink, owner/mode, missing-file, lockfile-hash,
  and installed-source-hash drift with `STOP_SOURCE_DRIFT`. Synthetic tests
  exercise clean, lock drift, content drift, and missing-source cases.
- This is archival/future-proof hardening only. It grants no retry authority
  and was not executed against a live proof attempt.

### Git protection

- The proof asset directory now contains exactly the anchored local ignore rule
  `/.proof-attempt-state/`.
- A synthetic nonexistent child path is verified with `git check-ignore`; no
  retained-state file or directory contents were enumerated, read, modified,
  moved, staged, or deleted.

### Secret-safe failure reporting

- Session and rotation assertions no longer deep-serialize complete session
  rows, raw session tokens, or guard/call objects containing protected values.
- Protected comparison shapes hash strings, retain only booleans/counts and
  timestamps, and throw generic stop codes on mismatch.
- Contract coverage proves a forced mismatch reports only
  `STOP_H5_SESSION_STATE_DRIFT` and excludes both protected capability values;
  the live H5 source scan forbids the cited `sessionByToken` deep assertions.
- H1-H7 were not executed historically; this fix does not claim a historical
  leak or add runtime evidence.

### Historical report banner and successor provenance

- The older auth-foundation `final-fix-report.md` body is unchanged and now has
  a prominent `HISTORICAL AND SUPERSEDED` banner linking to the ownership
  reconciliation and terminal foundation-review/proof outcome.
- Evidence companion, foundation review, and candidate migration contract now
  explicitly label this final-review successor `UNEXECUTED` and preserve the
  terminal blocked outcome.
- Artifact tests retain the historical executed hashes separately from the
  current successor hashes so the two cannot be conflated.

## RED to GREEN evidence

- Repository artifact RED: 6/12 failed for the intended missing/drifting
  contracts (ignore rule, installed verifier, runner hardening, safe session
  reporting, historical banner, and coupled hashes).
- SQL-validator RED: the focused test failed because the previous validator
  accepted the npm-banner preamble.
- Missing-source RED: the installed-source test exposed a raw `ENOENT`; the
  verifier was tightened so all absence/drift paths become
  `STOP_SOURCE_DRIFT`.
- Focused GREEN before final verification: authentication review, source gate,
  and artifact suites passed 33/33 with `SOURCE_CONTRACT=PASS`.

## Final static verification

- `node --test tests/*.test.mjs`: 189/189 PASS,
  `SOURCE_CONTRACT=PASS`.
- `npm run lint`: exit 0, 0 errors, 15 pre-existing warnings.
- Focused SQL-validator contract: PASS.
- `bash -n` for both proof scripts: PASS.
- `node --check` for source-integrity and publication modules: PASS.
- `static-shell-simulations.sh`: `STATIC_SHELL_SIMULATION=PASS`.
- `git diff --check`: PASS.
- Canonical `run-proof.sh --static` was intentionally not invoked because it
  performs a package install/network-capable gate, which this fix wave forbids.
- The standalone session test could not be loaded from the repository checkout
  because its disposable dependencies are intentionally absent; no install was
  authorized. Its successor syntax/lint and source contracts are covered by
  lint plus the repository artifact suite. No live test was substituted.

## Files and exclusions

Changed only the proof runner/harness static contracts and tests, the proof
evidence/review/candidate-contract provenance text, the historical banner, the
local ignore rule, and this report. `package.json`, both committed lockfiles,
application/runtime source, Prisma configuration, canonical Prisma schema,
migrations, environment files, generated clients, evidence JSON, and retained
proof-state contents remain unchanged.

Fix-wave commit: this report is committed with the cohesive successor change;
the exact commit is returned in the final handoff.
