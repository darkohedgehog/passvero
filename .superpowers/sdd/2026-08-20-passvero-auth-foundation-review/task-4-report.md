# Task 4 Report: Authentication Persistence Contract

## Scope

- Stage 13A Task 4 only; review artifacts only.
- Authorized worktree: `/private/tmp/passvero-stage13a-auth-foundation-review`.
- Task 4 base: `096f43992a95a8e175e65f121506aea1870b9d97`.
- No package, application source, canonical Prisma schema, canonical migration,
  environment, generated client, secret, or database mutation was authorized.
- No database connection or database command was performed.

## Owned changes

- Extended
  `docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/proposed-prisma-fragment.prisma`
  with the selected server-side organization relation, digest-only credential
  and activation tokens, and progressive abuse state.
- Created
  `docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/proposed-migration-contract.md`
  with exact PostgreSQL columns, types, defaults, constraints, indexes, foreign
  keys/actions, partial indexes, atomicity, retention, forbidden columns, and
  deployment gates.
- Extended `tests/auth-foundation-review.test.mjs` with Task 4 proposal and
  migration-contract assertions.
- Extended
  `docs/superpowers/reviews/2026-08-20-better-auth-foundation-review.md` with the
  evidence-backed persistence decision and Better Auth storage reconciliation.
- Created this report as explicitly requested by the Task 4 assignment.

## RED to GREEN evidence

- RED: `node --test tests/auth-foundation-review.test.mjs` produced 3 passing
  and 2 failing tests. The proposal test failed on the missing
  `selectedOrganizationId String? @db.Uuid`; the migration-contract test failed
  with `ENOENT` because `proposed-migration-contract.md` did not exist.
- GREEN: after the minimum contract/proposal changes, the focused command passed
  5 of 5 tests with zero failures.
- Fresh pre-commit GREEN: the same command passed 5 of 5 in 51.978792 ms.

## Decisions

### Organization selection

Exactly one persistence choice was made: nullable
`AuthProviderSession.selectedOrganizationId` with PostgreSQL UUID type and a
foreign key to canonical `Organization`, `ON DELETE SET NULL ON UPDATE CASCADE`.
It is stored only in the authoritative database session; the cookie remains the
opaque session credential and contains no organization, role, permission,
membership, entitlement, billing, or platform-admin state. A separate
one-to-one selection table was rejected because it adds a join, write,
uniqueness/lifecycle path, and migration/exit cost without adding authority.
Selection remains untrusted until server-side membership and organization-state
revalidation; business mutations preserve transactional authorization checks.

### Token persistence and concurrency

Passvero-owned `AuthCredentialToken` persistence was selected for email
verification and password reset rather than relying only on Better Auth's
identifier-hashing option. `AuthCredentialToken` and `AccountActivation` store
only 43-character base64url HMAC-SHA-256 digests. Issuance locks the owner row,
invalidates active predecessors, and inserts one replacement in one transaction;
named partial unique indexes are database backstops. Consumption is an atomic
conditional `UPDATE ... RETURNING` gated on digest, terminal state, and expiry.
The protected verification/reset/activation state transition occurs in that
same transaction, so only one concurrent caller succeeds.

The contract fixes 24-hour email-verification, 30-minute reset, and 24-hour
activation lifetimes. Terminal/expired token rows are pruned within 30 days.

### Progressive abuse persistence

The allowlist is exactly `TRUSTED_NETWORK`, `ACCOUNT_IDENTIFIER`,
`ACCOUNT_AND_TRUSTED_NETWORK`, and `GLOBAL_ENDPOINT`. Each bucket key is a
versioned HMAC-SHA-256 digest over an allowlisted endpoint code and only the
dimension's normalized components. Atomic upsert/increment semantics, bounded
backoff 0 through 12, non-negative counters, finite block windows, maximum
30-day expiry plus 24-hour pruning, and no global-evidence erasure on success
are specified. Plaintext email, IP/network, user agent, password, token, raw
digest input, identity, session, organization, role, and permission columns are
forbidden.

## Better Auth 1.7.1 installed-source evidence

- Package identity:
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/package.json:2-3`
  reports `better-auth` 1.7.1.
- Email verification token creation:
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/email-verification.mjs:13-18`
  signs a JWT containing the lower-cased email; lines 173-186 verify and parse
  that JWT. It is signed/encoded and stateless, not a stored digest, and has no
  persisted predecessor-invalidation or atomic-consumption state.
- Reset issuance:
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/password.mjs:74-87`
  creates a token and stores `reset-password:<raw token>` as the verification
  identifier.
- Storage default:
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/@better-auth/core/dist/types/init-options.d.mts:1173-1182`
  declares `storeIdentifier` default `plain`, while
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/db/verification-token-storage.mjs:4-12`
  passes absent/`plain` identifiers through unchanged and hashes only when
  configured.
- Reset consumption:
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/password.mjs:157-174`
  consumes before password change, and
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/db/internal-adapter.mjs:818-860`
  implements transactional consume-one behavior. This is concurrency-safe for
  one identifier but issuance does not supersede all tokens for the user.

Therefore the built-in stateless verification flow and default reset storage
are rejected for the approved Passvero policy. The reviewed
`AuthCredentialToken` adapter/endpoint boundary is a hard gate before Stage 13E;
token opacity, encoding, signing, or identifier hashing alone is insufficient.

## Commands and exact results

- `node --test tests/auth-foundation-review.test.mjs`: final pre-commit result
  5 tests, 5 passed, 0 failed.
- `npx prisma format --schema
  /private/tmp/passvero-better-auth-review-1-7-1/proposed-review-schema.prisma`:
  passed; formatted the disposable combined schema only.
- `npx prisma validate --schema
  /private/tmp/passvero-better-auth-review-1-7-1/proposed-review-schema.prisma`:
  passed; Prisma reported the disposable schema is valid. No database was used.
- `git diff --exit-code 096f439 -- package.json package-lock.json
  prisma/schema.prisma prisma/migrations prisma.config.ts .env .env.local
  src/generated`: exit 0; all forbidden repository paths are unchanged from the
  Task 4 base.
- `git diff --check`: the pre-commit tracked diff exited 0, but the final
  `096f439..HEAD` range check correctly exposed two Markdown hard-break trailing
  spaces that had been untracked at the earlier check. They were removed, the
  report was corrected, and the complete range check was rerun successfully.
- Required sensitive-value `rg` scan: matches were manually classified as the
  captured provider `password` field, policy/source-code descriptions, forbidden
  field names, exact local source paths, and the literal non-value placeholder
  `reset-password:<raw token>`. There were no credential values, connection
  strings, `DATABASE_URL`, `postgresql://`, or `prisma+postgres://` matches.
- `git status --short` immediately before commit showed only the three owned
  modified review artifacts/tests and the new owned migration contract.

## Commits

- Persistence-contract commit:
  `a6a94b01678f9b44ff945e0eb921856653e570e3`
  (`docs: define authentication persistence contract`).
- This evidence report is intentionally a follow-up commit so it can cite the
  immutable persistence-contract SHA, matching the earlier staged reports.

## Deviations and concerns

- The Task 4 brief listed four contract artifacts, while the assignment also
  explicitly required `task-4-report.md`; this report is the only additional
  repository file.
- A Passvero-owned verification/reset table was added because exact 1.7.1 source
  inspection showed that hashing configuration alone cannot give stateless
  email JWTs atomic single use or make either issuance flow supersede all
  predecessors.
- The existing disposable Task 3 combined schema was extended with only the
  proposed fragment and required `User`/`Organization` inverse relations. It is
  outside the repository and is not a canonical or migration source.
- The first post-commit `git diff --check 096f439..HEAD` failed on two Markdown
  hard-break trailing spaces in the new contract. No semantic content changed;
  the spaces were removed and the complete check was rerun before completion.
- No integration tests, migration generation/deployment, `db push`, Better Auth
  migration execution, database cleanup, or database reads were run because the
  stage is review-only and has no database authority.
- Stage 13E remains blocked until the persistence contract is approved and the
  Passvero-owned credential-token adapter/endpoint boundary receives its own
  implementation and security review.

## Fix Round 1

### Reviewer findings resolved

- Session fields are now explicitly server-owned. The contract requires
  `authenticatedAt` and `selectedOrganizationId` to use `input: false`, gives
  `authenticatedAt` a server-clock create default, and permits organization
  selection only through a dedicated CSRF-protected mutation that locks the
  session and revalidates active membership and organization status. The one
  organization-persistence choice remains the nullable database-session UUID;
  no role, permission, membership state, or organization state is placed in a
  session credential or cookie.
- Session enforcement now fixes a request-time 30-day absolute deadline, 7-day
  rolling inactivity expiry capped by that deadline, a 24-hour refresh boundary,
  conditional opaque-token rotation with fail-closed post-commit cookie delivery,
  `authenticatedAt` preservation, password-change/reset/revocation behavior,
  and hourly bounded cleanup. The proposed migration requires
  `ck_auth_provider_session_absolute_expiry` so `expiresAt` is no later than
  `authenticatedAt + INTERVAL '30 days'`. Native Better Auth paths that do not
  preserve these rules are rejected behind a reviewed Passvero service/adapter
  boundary before Stage 13E.
- Activation now binds a capability to the locked canonical email through
  `intendedEmailDigest VARCHAR(43)`, using a distinct keyed HMAC over the exact
  normalized email. Issuance, consumption, mismatch invalidation, canonical
  email mutation, and protected credential/identity creation have explicit lock
  ordering and transaction rules. No plaintext intended-email column is allowed.
- Abuse persistence now has exact attempt-window state, endpoint/dimension
  applicability (including unknown token and nonexistent-account cases), trusted
  proxy selection/fail-closed rules, IPv4-mapped IPv6 and prefix normalization,
  account-normalization vectors, fixed thresholds/windows, the complete level
  0-12 backoff schedule, 24-hour decay, deterministic locks, and one
  `SERIALIZABLE` admission/check/update transaction.
- Focused tests now scope exact proposal and contract assertions for server-only
  session input, foreign-key actions, CHECKs, digest lengths, partial-index
  predicates, lifetimes, activation binding, every abuse-matrix row, every
  threshold/backoff row, normalization vectors, and Better Auth hard gates.

### Changed lines

- Review: Round 1 commit hunks at current lines 122-167, 175-178, 192-194,
  217-227, and 239-265.
- Migration contract: Round 1 commit hunks beginning at current lines 67, 74,
  89, 310, 327, 346, 349, 364, 367, 381, 404, 496, 502, 529, 553, 633, and 650.
- Prisma proposal: comments at current lines 30 and 32; activation and abuse
  additions beginning at current lines 112 and 135.
- Focused tests: helpers at current line 12 and Round 1 assertions beginning at
  current lines 58, 72, 78, 88, and 97.

### RED to GREEN evidence

- The first two new-test invocations exposed JavaScript syntax errors caused by
  embedded Markdown backticks in dynamic regular-expression literals. The test
  construction was corrected before treating the run as policy evidence.
- Meaningful RED: `node --test tests/auth-foundation-review.test.mjs` ran 9
  tests with 4 passing and 5 failing on the absent session lifetime/input
  contract, activation email binding, abuse state/matrix, and source citations.
- GREEN after the contract changes: 10 tests passed and 0 failed.
- Fresh final GREEN after strengthening the exact matrix and schedule checks:
  10 tests passed, 0 failed, total duration 66.988209 ms.

### Better Auth 1.7.1 source evidence

- Additional-field `input` defaults and application-level create defaults:
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/@better-auth/core/dist/db/type.d.mts:31-53`.
- Additional-field input rejection/copy and create-default parsing:
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/db/schema.mjs:59-108`.
- Generic update-session parsing and persistence:
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/update-session.mjs:31-54`.
- Server create-session default and override ordering:
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/db/internal-adapter.mjs:248-320`.
- Native same-token refresh and native password-change replacement behavior:
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/session.mjs:171-207`
  and
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/update-user.mjs:180-189`.
- Native revoke-all deletion behavior:
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/session.mjs:411-441`.
- Email-verification issuance/use:
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/email-verification.mjs:23-35`
  and `:173-186`.
- Prisma adapter concurrency-safe `consumeOne` deletion:
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/@better-auth/prisma-adapter/dist/index.mjs:319-332`.

### Verification and safety results

- `node --test tests/auth-foundation-review.test.mjs`: 10 passed, 0 failed.
- `npx prisma format --schema
  /private/tmp/passvero-better-auth-review-1-7-1/proposed-review-schema.prisma`:
  passed and formatted only the disposable combined schema.
- `npx prisma validate --schema
  /private/tmp/passvero-better-auth-review-1-7-1/proposed-review-schema.prisma`:
  passed; Prisma reported the disposable combined schema valid without a
  database connection.
- `git diff --exit-code 096f439 -- package.json package-lock.json
  prisma/schema.prisma prisma/migrations prisma.config.ts .env .env.local
  src/generated`: exit 0. No forbidden repository path changed from the Task 4
  base.
- Sensitive-value `rg` scan: every match was manually classified as a generated
  schema field name, policy prose, an exact local source path, or the literal
  non-value placeholder `reset-password:<raw token>`. The connection markers
  appear only in this report's negative scan record; there was no secret,
  credential value, or connection string.
- `git diff --check`: exit 0 before the fix commit.
- Fix commit: `e5d6c15e51f69aca221b136eeca7f000a79d59aa`
  (`docs: address auth persistence review findings`).

### Deviations and remaining concerns

- The initial test-syntax mistakes and the later singular `1 minute` assertion
  mismatch were test-harness corrections; neither required a contract-policy
  change. The meaningful RED failures and final GREEN results are recorded
  separately above.
- No package, source, canonical schema, migration, environment, generated client,
  secret, or database was modified or accessed. The only non-repository write was
  formatting the explicitly disposable combined Prisma schema.
- Stage 13E remains blocked until both reviewed Passvero boundaries are
  implemented and reviewed: the session lifecycle service/adapter and the
  digest-only verification/reset token store. Built-in stateless email
  verification, default reset persistence, native same-token refresh, and native
  password-change session replacement do not satisfy this contract.

## Fix Round 2

### Reviewer findings resolved

- Added required server-owned `AuthProviderSession.lastRefreshAt` persistence,
  configured as `input: false` with a server-clock create default. The migration
  contract adds its exact `TIMESTAMP(3)` column, index, ordering/inactivity
  CHECKs, and preservation rules. Organization selection advances general
  `updatedAt` but cannot advance `lastRefreshAt` or expiry, so repeated switches
  do not defer rolling refresh.
- Confirmed Better Auth 1.7.1 supports `disableSessionRefresh: true` and made it
  mandatory. The native `/get-session` route is also excluded from the exposed
  application router; middleware and endpoints must use the reviewed Passvero
  boundary as the sole authoritative session read/refresh path.
- Replaced the unrealizable all-digest lock claim with one staged
  `SERIALIZABLE` transaction. Stage A locks/admit global then network before
  lookup; token-only requests then perform a non-consuming lookup and owner
  revalidation; Stage B locks/admit account then combined before the protected
  operation. Unknown tokens commit network/global evidence without fabricating
  account buckets, and the fixed dimension hierarchy prevents reverse bucket
  locking.
- Activation consumption now derives `ACCOUNT_IDENTIFIER` from the normalized
  current canonical `User.email`, the same account source used across transports.
  `intendedEmailDigest` remains only the capability-binding proof and is never an
  abuse-key input. Identifier requests without an account still use the
  normalized attempted value; unknown activation tokens have only Stage A state.
- Added required `AuthAbuseBucket.backoffUpdatedAt` persistence and exact CHECKs.
  Every protected-action failure and every global-volume level increase resets
  the anchor. Decay consumes complete 24-hour periods, advances the anchor by
  exactly the consumed periods, and preserves the remainder, making repeated
  evaluation idempotent.
- Tests now assert refresh-anchor non-advancement, native refresh disablement and
  route unreachability, staged lookup/admission order, the common activation
  account source, exact decay formulas/anchors, and the complete Better Auth
  source chain.

### Changed lines

- Review commit hunks begin at current lines 137, 159, 165, 170, 184, 204, 262,
  and 278.
- Migration-contract commit hunks begin at current lines 56, 61, 71, 80, 104,
  113, 137, 150, 160, 174, 177, 181, 202, 217, 390, 410, 470, 564, 579, 586,
  643, 647, 713, 727, and 747.
- Prisma-proposal additions begin at current lines 32, 40, and 138.
- Focused-test additions begin at current lines 71, 75, 95, 105, 109, 112,
  116, 118, 120, 142, 164, 169, 206, 240, 253, 258, and 260.

### RED to GREEN evidence

- Initial meaningful RED: `node --test tests/auth-foundation-review.test.mjs`
  ran 10 tests with 6 passing and 4 failing on the missing refresh anchor,
  session controls, abuse decay/staging state, and source citations.
- After the main contract reached GREEN, a second test-first invariant required
  `lastFailureAt <= backoffUpdatedAt`; RED was 9 passing and 1 failing until the
  named CHECK was added.
- Fresh final GREEN before commit: 10 tests passed, 0 failed, total duration
  70.57975 ms.

### Better Auth 1.7.1 source evidence

- `disableSessionRefresh` type, meaning, and default:
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/@better-auth/core/dist/types/init-options.d.mts:905-918`.
- Native get-session refresh calculation, option check, same-token update, and
  cookie write:
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/session.mjs:171-207`.
- Email signed-JWT helper:
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/email-verification.mjs:13-18`.
- Email issuance and verification/use:
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/email-verification.mjs:23-35`
  and `:173-186`.
- Reset consume branch from latest-row selection through adapter call:
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/db/internal-adapter.mjs:818-845`.
- Prisma atomic unique-id `consumeOne` deletion:
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/@better-auth/prisma-adapter/dist/index.mjs:319-332`.

### Verification and safety results

- `node --test tests/auth-foundation-review.test.mjs`: 10 passed, 0 failed.
- Disposable combined `npx prisma format` and `npx prisma validate`: both passed;
  Prisma reported the schema valid without a database connection.
- Forbidden-path diff from `096f439` across packages, canonical schema and
  migrations, Prisma config, environment files, and generated client: exit 0.
- Sensitive-value scan was manually classified. Matches were provider schema
  field names, policy prose, exact local source paths, negative scan markers in
  this report, or the literal non-value `reset-password:<raw token>` placeholder.
  No credential, secret value, or connection string was present.
- `git diff --check`: exit 0 before the fix commit.
- Fix commit: `040ea316e4806d4dff03183074757eb03e6264e1`
  (`docs: refine auth persistence lifecycle contract`).

### Deviations and remaining concerns

- No package, application source, canonical Prisma schema, canonical migration,
  environment, generated client, secret, or database was modified or accessed.
  The only non-repository write was formatting the explicitly disposable
  combined Prisma schema.
- The native route exclusion is an implementation hard gate, not a claim about
  Better Auth configuration alone: `disableSessionRefresh` prevents the native
  write but does not turn the native read into the Passvero policy boundary.
- Stage 13E remains blocked until the reviewed session boundary enforces native
  route exclusion plus refresh rotation, and the Passvero-owned digest-only
  verification/reset store implements the specified staged abuse and token
  lifecycle ordering.

## Fix Round 3

### Test-evidence findings resolved

- Added one scoped reset-evidence validator that requires the six Better Auth
  1.7.1 citations in behavioral chain order and pins the associated issuance,
  plaintext-storage, endpoint-consumption, internal-adapter, and Prisma
  concurrency behavior. The final test validates the real review and removes
  each citation independently to prove that every omission is detected.
- Added exact migration-contract assertions that the reviewed Passvero session
  boundary is the only create/read/refresh/rotate/revoke/password-change entry
  point, application middleware and endpoints call only that boundary for
  authoritative reads and refresh, and no native route can provide an alternate
  session-read path. These assertions are additional to the existing
  `disableSessionRefresh: true` and native `/get-session` exclusion checks.
- No review correction was required: every requested citation and behavior was
  already present and exact.

### Changed lines and source chain

- `tests/auth-foundation-review.test.mjs:22-52` defines the ordered citation and
  behavior assertions; lines 152 and 157-158 pin the sole-session-boundary
  invariant; lines 302-313 validate the review and mutation guards.
- Reset issuance:
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/password.mjs:74-87`.
- `storeIdentifier` default:
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/@better-auth/core/dist/types/init-options.d.mts:1173-1182`.
- Plaintext/absent-option pass-through:
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/db/verification-token-storage.mjs:4-12`.
- Reset endpoint consumption before password mutation:
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/password.mjs:157-174`.
- Internal-adapter latest-row consume branch:
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/db/internal-adapter.mjs:818-845`.
- Prisma atomic unique-id `consumeOne` deletion:
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/@better-auth/prisma-adapter/dist/index.mjs:319-332`.

### RED to GREEN and verification evidence

- Intentional RED: `node --test tests/auth-foundation-review.test.mjs` returned
  exit 1 with 10 passing and 1 failing. Removing
  `internal-adapter.mjs:818-845` produced the exact failure
  `missing or out-of-order reset evidence citation`.
- A mutation-harness draft initially appended a marker while retaining the
  original citation substring and therefore produced `Missing expected
  exception`; replacing the citation entirely corrected the probe without any
  review or contract change.
- GREEN: `node --test tests/auth-foundation-review.test.mjs` returned exit 0
  with 11 passing and 0 failing, total duration 51.618167 ms.
- Fresh pre-report rerun of the same focused command returned exit 0 with 11
  passing and 0 failing, total duration 61.498834 ms.
- `git diff --exit-code 096f439 -- package.json package-lock.json
  prisma/schema.prisma prisma/migrations prisma.config.ts .env .env.local
  src/generated`: exit 0; no forbidden path changed from the Task 4 base.
- `git diff --check`: exit 0 before the test commit.
- Test commit: `757d238` (`test: pin authentication reset evidence chain`).

### Scope and remaining concerns

- This round changed only the owned focused test and this Task 4 report. It did
  not modify packages, source, canonical schema, migrations, environment,
  generated clients, review prose, or migration-contract prose; it did not
  access a database or secrets.
- Stage 13E remains gated on implementation and review of the sole Passvero
  session boundary and Passvero-owned digest-only verification/reset store.
