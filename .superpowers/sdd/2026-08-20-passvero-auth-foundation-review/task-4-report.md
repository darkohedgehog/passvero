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
- `git diff --check`: exit 0 before the contract commit.
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
- No integration tests, migration generation/deployment, `db push`, Better Auth
  migration execution, database cleanup, or database reads were run because the
  stage is review-only and has no database authority.
- Stage 13E remains blocked until the persistence contract is approved and the
  Passvero-owned credential-token adapter/endpoint boundary receives its own
  implementation and security review.
