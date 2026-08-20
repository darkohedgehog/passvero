# Stage 13A Runtime-Ownership Reconciliation Report

## Scope and result

- Worktree: `/private/tmp/passvero-stage13a-auth-foundation-review`.
- Cumulative Stage 13A base: `331f8f1cd29203ee7d8d9364c7324313b75f822f`.
- Reconciliation starting HEAD: `b435d7a01d6b5e67f875b3fcdad680cf0d361064`.
- Operator decision:
  `AUTH_FOUNDATION_RUNTIME_OWNERSHIP=BETTER_AUTH_BACKED_TRANSACTION_PROOF_REQUIRED`.
- Result: the direct Passvero provider-table write strategy is rejected and
  superseded. Better Auth remains authoritative for authentication proof,
  credentials, recovery, and session establishment. Passvero remains
  authoritative for canonical identity, tenancy, permissions, and business
  authorization.
- Persistence status:
  `AUTH_FOUNDATION_PERSISTENCE_CONTRACT=BLOCKED_PENDING_BETTER_AUTH_TRANSACTION_PROOF`.
- Package, runtime source, canonical Prisma schema, migration, environment,
  generated-client, database, secret, and transaction-spike changes: NONE.

## Semantic reconciliation

- Replaced the final-fix direct-write ownership strategy with a frozen authority
  statement and an explicit `REJECT` alternative.
- Removed the operation-owner table and normative claims that Passvero directly
  writes Better Auth provider tables or that Better Auth is only a schema/account
  compatibility dependency.
- Defined acceptance criteria only for a future Better Auth-backed transaction
  proof. No native, adapter, or replacement integration mechanism is selected.
- Kept the exact proposed table, column, constraint, token, lifetime, abuse,
  cookie, isolation, retry, and ordering detail as candidate persistence inputs.
  They are neither approved nor implementable until proof reconciles them.
- Preserved the credential-token digest, current-email binding, invalidation,
  fixed lifetime, atomic single-use, activation intended-email binding, NFC
  password, no-organization-plugin, no-Redis, no-cookie-cache, and no-auto-linking
  decisions.
- Updated the 13-row cumulative matrix to distinguish `PASS`, `CANDIDATE INPUT`,
  `PROOF REQUIRED`, and `DEFERRED`. Transaction proof is tracked outside that
  count as `PROOF REQUIRED/PENDING`; migration and exit approval is deferred.

## Proof acceptance criteria recorded

The blocked contract requires proof against pinned `better-auth@1.7.1` covering:

- atomic Better Auth-backed activation credential creation and `AuthIdentity`
  binding;
- abuse, token, provider, canonical, identity, and session state in one rollback
  domain, or an evidence-backed equivalent preserving frozen authority;
- session establishment, rotation, revocation, and `authenticatedAt`;
- password and recovery paths;
- empty native-route allowlist, no catch-all, and no bypass;
- post-commit cookie semantics;
- isolation and retry behavior;
- exact Better Auth or reviewed-adapter provider-row and cookie conventions;
- failure injection and complete rollback; and
- provider-neutral application/domain interfaces.

The proof likely requires a disposable PostgreSQL environment and separate
operator authorization. Neither is authorized or performed here.

## RED to GREEN

- RED: `node --test tests/auth-foundation-review.test.mjs` returned exit 1 with
  15 passing and 4 failing tests. The failures were the newly added Better Auth
  authority, pending-proof, direct-write rejection, and cumulative-matrix
  invariants.
- During GREEN, three remaining failures were assertion/prose alignment issues
  involving wrapped whitespace and the new matrix status sentence; they did not
  change runtime or persistence scope.
- GREEN: `node --test tests/auth-foundation-review.test.mjs` returned exit 0 with
  19 passing and 0 failing tests.

## Fresh verification

- `node --test tests/auth-foundation-review.test.mjs`: 19 passed, 0 failed.
- `node --test tests/*.test.mjs`: 175 passed, 0 failed.
- `npm run test:application`: 54 passed, 0 failed.
- `npm run test:infrastructure`: 11 passed, 0 failed.
- `npm run lint`: exit 0 with no findings.
- `git diff --check`: exit 0.
- The cumulative forbidden-path test from `331f8f1` passed.
- The temporary `src/generated` symlink pointed only to the primary checkout's
  existing generated client for the typed suites and was removed afterward.

The first sandboxed application-suite attempt was blocked before test execution
because `tsx` could not create its local IPC socket (`listen EPERM`). The same
command was rerun with the required local-socket permission and passed. The
infrastructure suite ran with the same permission and passed.

## Remaining concern and gate

The exact Better Auth-backed transaction boundary remains required and unproven.
No persistence, schema, migration, or Stage 13B/13E approval follows from this
reconciliation. The next admissible evidence is separately authorized proof,
not implementation against these candidate inputs.
