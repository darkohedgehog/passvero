# Task 3 Report: Provider Models and Canonical Identity Reconciliation

## Scope

- Task 3 only; review artifacts only.
- Authorized worktree: `/private/tmp/passvero-stage13a-auth-foundation-review`.
- Task 3 base: `e3b33f3cac35a468727b14375c814656388e8b5a`.
- Disposable schema validation directory: `/private/tmp/passvero-better-auth-review-1-7-1`.

## Owned changes

- Created `docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/proposed-prisma-fragment.prisma`.
- Extended `docs/superpowers/reviews/2026-08-20-better-auth-foundation-review.md` with provider/canonical reconciliation, identifier types, PostgreSQL mapping, constraints, and future migration implications.
- Extended `tests/auth-foundation-review.test.mjs` with the provider-neutral stable-subject contract.
- Created this report.

## Evidence

- RED: `node --test tests/auth-foundation-review.test.mjs` produced 2 passing and 1 failing test. The new contract failed with `ENOENT` because `proposed-prisma-fragment.prisma` did not yet exist.
- GREEN: the same focused command passed 3 of 3 tests after the proposal was added.
- A disposable combined schema was created by copying the canonical schema and adding only the review fragment plus `User.authIdentities AuthIdentity[]`; canonical `prisma/schema.prisma` was not edited.
- `npx prisma format --schema /private/tmp/passvero-better-auth-review-1-7-1/proposed-review-schema.prisma`: passed.
- `npx prisma validate --schema /private/tmp/passvero-better-auth-review-1-7-1/proposed-review-schema.prisma`: passed.
- `git diff --exit-code e3b33f3 -- package.json package-lock.json prisma/schema.prisma prisma/migrations prisma.config.ts .env .env.local`: passed with no forbidden-path diff.
- `git diff --check`: passed before committing the proposal.

## Decision record

- The four Better Auth 1.7.1 models remain `AuthProviderUser`, `AuthProviderSession`, `AuthProviderAccount`, and `AuthProviderVerification`; their generated string primary keys, foreign keys, token fields, unique constraints, indexes, maps, and cascade semantics are preserved.
- The provider-user relations have explicit Prisma relation names. No provider model is related to canonical `Organization` or `Membership`.
- `AuthIdentity` is Passvero-owned and binds a canonical UUID `userId` to opaque `provider` and `providerSubject` strings with a unique `(provider, providerSubject)` constraint. It deliberately contains no email field.
- `authIdentities AuthIdentity[]` is recorded as a future canonical `User` edit and was present only in the disposable validation schema.

## Commit

- Identity-proposal commit: `6efa395aa55374d112ee50f0c03e3f9e8bd89ef8` (`docs: propose provider-neutral auth identity schema`).

## Deviations

- The Task 2 generator directory already existed and did not contain the target disposable schema, so it was reused as explicitly permitted. No existing file there was deleted or changed except the new disposable validation schema.
- The macOS `find` variant did not support the attempted `-printf` listing option. This did not affect the target-absence check or any task evidence.
- The first sandboxed `git add`/commit attempt was blocked from creating the shared worktree index lock; the unchanged Git command was rerun with the required minimal permission and succeeded.

## Concerns and exit conditions

- Do not coerce provider identifiers or `AuthIdentity.providerSubject` to UUID based on UUID-shaped current values. A later implementation needs official Better Auth 1.7.1 configuration evidence and proof that every adapter path generates and accepts UUIDs consistently.
- A separately approved canonical-schema change and manually reviewed migration are still required. They must add the recorded `User` inverse, preserve all provider constraints, and retain email-free, explicit, fail-closed identity binding.
- No source, package, canonical schema, migration, environment, generated-client, or database changes were made; no database connection was attempted.
