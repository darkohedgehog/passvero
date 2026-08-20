# Stage 13A Final-Fix Report

## Scope and result

- Worktree: `/private/tmp/passvero-stage13a-auth-foundation-review`.
- Cumulative Stage 13A base: `331f8f1cd29203ee7d8d9364c7324313b75f822f`.
- Final-fix starting HEAD: `b55300877c3729ae0f519663ed4848e64039c4b1`.
- Semantic fix commit: `572aa7112563705778eb9babdd3a1e808b097695`.
- Result: both final-review Important findings and the requested test/scope
  findings are resolved in review artifacts only.
- Database or integration access: NOT PERFORMED.
- Package, runtime source, canonical Prisma schema, canonical migration,
  configuration, environment, generated-client, and secret changes: NONE.

## Frozen-architecture reconciliation

The exact initial-release ownership strategy does not conflict with frozen
Phase 12. Phase 12 requires Better Auth isolation at the transport and
infrastructure edge, stable provider-subject binding, and provider-neutral
application/domain interfaces; it does not require a Better Auth catch-all,
native handler, or Prisma-adapter write path to own the initial flows.

The corrected contract therefore fixes the native route allowlist as empty and
forbids exporting a Better Auth catch-all. Every public activation, sign-in,
verification, reset, session, password, and organization-selection operation is
Passvero auth-edge owned and shares the reviewed abuse boundary. Passvero
infrastructure directly transacts against the reviewed Better Auth-compatible
provider tables and Passvero tables. Application and domain layers see only
provider-neutral interfaces. Better Auth remains the pinned schema/account
compatibility foundation and future provider-adapter candidate; native and
Prisma-adapter write paths require a separate equivalence review before use.
This is a required future implementation contract, not a claim that runtime
implementation exists.

## Corrected contract

- Added `AuthCredentialToken.targetEmailDigest String @db.VarChar(43)` and
  removed the `createdAt` default so both timestamps must be explicitly supplied.
- Bound email-verification and password-reset capabilities to the normalized
  current email of the locked `AuthProviderUser` with a dedicated,
  purpose/domain-separated HMAC-SHA-256 digest. Provider-email mutation now
  locks the owner, invalidates both active credential-token purposes, writes the
  normalized email, and resets verification state.
- Fixed consumption to lock/revalidate the owner, recompute the target-email
  digest, compare decoded 32-byte HMAC outputs with
  `crypto.timingSafeEqual`, invalidate and fail generically on mismatch, and
  permit only one concurrent protected transition. Email verification is the
  exact `false` to `true` transition in the consuming transaction.
- Added the exact database CHECK that fixes verification lifetime at 24 hours
  and reset lifetime at 30 minutes. One trusted transaction timestamp supplies
  explicit `createdAt` and derived `expiresAt`.
- Fixed capability generation and presentation to exactly 32 CSPRNG bytes,
  canonical unpadded base64url of length 43, strict decode/re-encode validation,
  and persisted 43-character HMAC digests only. The contract now fixes distinct
  keys, namespaces, version `v1`, rotation behavior, and delivery/log/referrer
  protections.
- Fixed direct provider-row conventions, unique lookups, verified-state checks,
  session fields/token handling, `AuthIdentity` binding, cross-table lock order,
  post-commit cookie delivery, and bounded generic retry behavior.
- Locked future Better Auth configuration to
  `emailAndPassword.disableSignUp: true`; the empty native allowlist and absent
  catch-all make direct/native paths unreachable in the initial release.
- Added exact focused correspondence checks for every corrected token field,
  foreign key, index, CHECK, lifecycle rule, route owner, direct-transaction
  convention, retry/cookie rule, raw-generator hash, and cumulative forbidden
  path.

## RED to GREEN

- Meaningful RED: `node --test tests/auth-foundation-review.test.mjs` ran 18
  tests with 13 passing and 5 failing. The failures corresponded to the missing
  raw-hash/runtime-exclusion evidence, credential target/lifetime contract,
  capability/email binding, initial route ownership, and direct provider-write
  contract.
- GREEN: the same focused command passed 18 of 18 after the review, fragment,
  migration contract, and tests were corrected.
- A syntax error in the first draft of the new source assertion was corrected
  before the meaningful RED run; it did not mask a contract result.

## Raw generator and disposable schema evidence

- The retained raw generator body is the content after its two-line provenance
  preamble. Its pinned SHA-256 is
  `7034757e4505ccf015ca00b46c373dfdd3de2c40f0e5b20ce0608446c4b5909e`.
- The retained disposable `generated.prisma` and a fresh
  `generated-disable-signup.prisma` generated after adding
  `emailAndPassword.disableSignUp: true` are each 2,212 bytes and have the same
  SHA-256. `cmp` passed between both files and between the retained repository
  body and the corrected regeneration. The immutable raw artifact did not
  change.
- `npx prisma format --schema
  /private/tmp/passvero-better-auth-review-1-7-1/proposed-review-schema.prisma`:
  PASS.
- A fresh sequential `npx prisma validate --schema
  /private/tmp/passvero-better-auth-review-1-7-1/proposed-review-schema.prisma`:
  PASS; Prisma reported the disposable combined schema valid without database
  access.

## Fresh verification

- `node --test tests/auth-foundation-review.test.mjs`: 18 passed, 0 failed.
- `node --test tests/*.test.mjs`: 174 passed, 0 failed.
- `npm run test:application`: 54 passed, 0 failed.
- `npm run test:infrastructure`: 11 passed, 0 failed.
- `npm run lint`: PASS.
- Cumulative forbidden-path `git diff --name-only` from `331f8f1` covering
  package files/directories, `src`, canonical schema/migrations, configuration,
  environment paths, and generated clients: empty.
- Temporary `src/generated` symlink used only for the typed application and
  infrastructure suites: removed; final check reports it absent.
- Sensitive-value scan over the four semantic artifacts: no connection URL,
  environment variable, private-key marker, API-key pattern, or assigned raw
  token match.
- `git diff --check`: PASS.

## Deviations and remaining concerns

- The first sandboxed application-suite invocation failed before tests because
  `tsx` could not create its local IPC socket (`listen EPERM`). The unchanged
  command was rerun with the required local-socket permission and passed 54 of
  54. Infrastructure was run with the same permission and passed 11 of 11.
- The disposable Better Auth regeneration emitted only its existing missing-base
  URL warning; generation succeeded and the schema body remained byte-identical.
- No live Better Auth caller-transaction, adapter, integration, migration, or
  database claim was made or tested. Those activities remain later-stage gates.
- The review status remains `AWAITING OPERATOR DECISION` for the already recorded
  migration/exit cost; this final fix introduces no new unresolved architecture
  choice.
