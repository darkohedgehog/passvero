# Better Auth Foundation Review

**Status:** Awaiting operator schema decision
**Execution base:** 331f8f1cd29203ee7d8d9364c7324313b75f822f
**Evidence date:** 2026-08-20

## Candidate dependency baseline

- better-auth: 1.7.1
- @better-auth/prisma-adapter: 1.7.1
- Prisma: 7.8.0
- Next.js: 16.2.11
- React: 19.2.4
- Organization plugin: EXCLUDED
- Admin plugin: EXCLUDED
- OAuth plugin: EXCLUDED
- Magic-link plugin: EXCLUDED
- 2FA plugin: EXCLUDED
- Passkey plugin: EXCLUDED
- Redis: EXCLUDED
- Cookie cache: EXCLUDED
- Public signup: EXCLUDED
- Automatic linking: EXCLUDED
- Database connection performed: NO
- Schema or migration modified: NO

## Evidence sources

- npm registry metadata queried on 2026-08-20 with `npm view better-auth version`,
  `npm view @better-auth/prisma-adapter version`, and `npm view auth version`:
  each returned 1.7.1.
- `npm view @better-auth/prisma-adapter peerDependencies --json` accepts Prisma
  major version 7.
- Repository `package.json` and lockfile record Prisma 7.8.0, Next.js 16.2.11,
  and React 19.2.4.

## Raw generator capture

- CLI: auth 1.7.1
- Configuration: disposable review-only Better Auth configuration
- Output: `docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/generated-prisma-schema.prisma`
- Database connection: not performed
- Canonical Prisma schema mutation: not performed
- Canonical migration mutation: not performed

## Provider-model and canonical identity reconciliation

The proposed provider identity models are kept separate from canonical `User`
and `Membership`. The raw model names already avoid collisions, so they are
retained. The generated user relations receive explicit relation names only;
all Better Auth-required fields, unique constraints, indexes, table maps, and
cascade behavior are preserved. Task 4 adds one nullable
`AuthProviderSession.selectedOrganizationId` relation to canonical
`Organization` solely as server-side selection, never identity or authorization.

`AuthIdentity` is the only proposed binding to canonical `User`. It supports
multiple provider identities per canonical user, uses `(provider,
providerSubject)` as the unique stable binding, and restricts canonical-user
deletion. `providerSubject` remains an opaque `String`: UUID-shaped values from
a current provider do not prove that Better Auth 1.7.1 generation and every
adapter path consistently use UUID values.

The canonical proposal also requires `authIdentities AuthIdentity[]` on `User`.
That inverse is a required future canonical-schema edit and appears only in the
disposable validation copy; it is intentionally absent from `prisma/schema.prisma`
in this review-only task. No provider model relates to `Organization` or
`Membership`, except the Task 4 nullable session-selection relation to
`Organization`; no provider model contains organization or membership authority.

| Identifier or relation field | Generated type | Proposed Prisma type | PostgreSQL type | Length or check requirement | Migration or exit implication |
| --- | --- | --- | --- | --- | --- |
| `AuthProviderUser.id` (primary key) | `String` | `String @id` | `text` | No added length or check; provider-owned opaque key | Preserve existing provider key shape; do not coerce to UUID without official 1.7.1 configuration and adapter-path proof. |
| `AuthProviderSession.id` (primary key) | `String` | `String @id` | `text` | No added length or check; provider-owned opaque key | Same provider-key rule; its relation targets `AuthProviderUser.id`. |
| `AuthProviderAccount.id` (primary key) | `String` | `String @id` | `text` | No added length or check; provider-owned opaque key | Same provider-key rule; its relation targets `AuthProviderUser.id`. |
| `AuthProviderVerification.id` (primary key) | `String` | `String @id` | `text` | No added length or check; provider-owned opaque key | Same provider-key rule; no canonical foreign key. |
| `AuthProviderSession.userId` (foreign key) | `String` | `String` | `text` | Must match the provider user key type; no UUID check | Cascades only when the provider user is deleted; it must never point to canonical `User`. |
| `AuthProviderAccount.userId` (foreign key) | `String` | `String` | `text` | Must match the provider user key type; no UUID check | Cascades only when the provider user is deleted; it must never point to canonical `User`. |
| `AuthProviderSession.token` (unique session credential) | `String` | `String` | `text` | No schema length/check; opaque provider token | Preserve unique constraint; application logging and cookie handling remain separately reviewed. |
| `AuthProviderAccount.issuer + accountId` (unique external-account identifier) | `String + String` | `String + String` | `text + text` | No added length/check; provider-defined opaque pair | Preserve the generated composite unique constraint and name; do not bind canonical identity by email. |
| `AuthProviderAccount.accessToken`, `refreshToken`, and `idToken` (credential tokens) | `String?` each | `String?` each | `text` each | No schema length/check; opaque secrets | Preserve nullable storage fields; their values are not canonical identity keys and must not be logged. |
| `AuthProviderVerification.identifier` (indexed token subject) | `String` | `String` | `text` | No added length/check; opaque provider identifier | Preserve index; provider verification lifecycle remains isolated from canonical identity. |
| `AuthProviderVerification.value` (verification token value) | `String` | `String` | `text` | No schema length/check; opaque provider token | Preserve field; future security review must cover single use, expiry, supersession, and redaction. |
| `AuthIdentity.id` (primary key) | Passvero-owned | `String @id @default(uuid()) @db.Uuid` | `uuid` | UUID generated by canonical Prisma/database path | New future canonical migration; this is an internal key, not a provider identifier. |
| `AuthIdentity.userId` (canonical foreign key) | Passvero-owned | `String @db.Uuid` | `uuid` | Must reference canonical `User.id`; required | New future canonical migration with `Restrict` delete and `Cascade` update behavior. |
| `AuthIdentity.providerSubject` (stable provider subject) | Passvero-owned | `String` | `text` | No UUID, length, or format check; opaque stable subject | New future canonical migration with unique `(provider, providerSubject)`; no email-based or automatic linking. |

### Deferred canonical edit and migration gate

Before any implementation, a separately approved canonical-schema change must
add `authIdentities AuthIdentity[]` to `User` alongside this proposal and a
manually reviewed migration. The migration must not change provider identifiers
to UUID based on their current appearance. It must preserve the provider-model
relations and constraints shown here, create the canonical `AuthIdentity`
foreign key and indexes, and keep application services dependent only on
canonical `User` after identity resolution.

## Session, activation, recovery, and abuse persistence decision

The exact table, column, type, index, foreign-key, CHECK, partial-index,
retention, atomicity, and deployment requirements are in
`docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/proposed-migration-contract.md`.
That asset is a review contract, not SQL and not migration authority.

### Organization-selection choice

**Decision: persist `selectedOrganizationId` directly on
`AuthProviderSession`, with a nullable UUID foreign key to canonical
`Organization`.** This is the one selected persistence design. It is compatible
with the generated provider model's additional server-side session field, keeps
the database session authoritative, and does not expose organization state in
the cookie: the browser still receives only the opaque session credential.
`ON DELETE SET NULL` clears a physically deleted organization, while every
request and switch must still revalidate active membership and active
organization status. The value is selection only, never authorization evidence.

A separate one-to-one `AuthSessionSelection` is rejected. It would add a table,
join, uniqueness rule, lifecycle cleanup path, and migration/exit cost without
creating a stronger authority boundary. Neither the selected session design nor
the cookie contains role, permission, membership status, organization status,
entitlement, billing, or platform-administration state.

`authenticatedAt` remains a required server-owned session timestamp. Rotation
must preserve it so rolling expiration cannot bypass the 30-day absolute limit.
Expired and revoked sessions are deleted/invalidated by the provider lifecycle
and cannot retain selection.

### Token-storage reconciliation

The installed/disposable package evidence is Better Auth 1.7.1
(`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/package.json:2-3`).
Its relevant behavior is:

- Built-in email verification creates a signed JWT containing lower-cased email
  and optional update data
  (`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/email-verification.mjs:13-18`),
  then verifies and parses that JWT on use
  (`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/email-verification.mjs:173-186`). It does not
  persist a token digest, atomically consume a token, or let a new token
  invalidate predecessors. Signed/encoded opacity is not single use.
- Password reset generates a token and persists
  `reset-password:<raw token>` as the verification identifier
  (`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/password.mjs:74-87`). The 1.7.1 option
  explicitly defaults verification identifier storage to `plain`
  (`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/@better-auth/core/dist/types/init-options.d.mts:1173-1182`), and the
  storage implementation passes an absent/`plain` identifier through unchanged
  (`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/db/verification-token-storage.mjs:4-12`). Token opacity
  is therefore not evidence of hashing.
- Reset consumption calls `consumeVerificationValue` before password mutation
  (`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/password.mjs:157-174`). Its database path
  transactionally consumes the latest row and returns null to losing concurrent
  callers (`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/db/internal-adapter.mjs:818-860`). That makes a
  single identifier concurrency-safe, but reset issuance creates independent
  identifiers and does not supersede every predecessor for the user.

**Required before Stage 13E:** use the proposed Passvero-owned
`AuthCredentialToken` persistence and reviewed adapter/endpoint boundary for
email verification and password reset. The built-in stateless email-verification
flow and default reset storage are rejected. Merely enabling identifier hashing
would still leave email verification without atomic consumption and both flows
without the approved predecessor-invalidation transaction.

`AuthCredentialToken` and `AccountActivation` store only HMAC-SHA-256 digests,
never raw or encoded capabilities. Issuance locks the owning provider/canonical
user, invalidates every active predecessor, and inserts one replacement in the
same transaction; a partial unique index is the backstop. Consumption is an
atomic conditional `UPDATE ... RETURNING` gated on digest, unconsumed,
non-invalidated, and unexpired state. Email verification, password replacement
plus all-session revocation, and activation plus credential/identity creation
must commit in that same transaction, so only one concurrent request can cause
the protected state change. The fixed lifetimes are 24 hours for verification,
30 minutes for reset, and 24 hours for activation; terminal/expired rows are
retained no longer than 30 additional days.

### Progressive PostgreSQL abuse state

`AuthAbuseBucket` permits exactly four enum dimensions:
`TRUSTED_NETWORK`, `ACCOUNT_IDENTIFIER`,
`ACCOUNT_AND_TRUSTED_NETWORK`, and `GLOBAL_ENDPOINT`. Its unique `keyDigest` is
a versioned, keyed HMAC-SHA-256 base64url digest over the enum, an allowlisted
endpoint code, and only the dimension's normalized components. Plain SHA-256
and plaintext email, IP/network, user-agent, password, token, forwarded-header,
canonical/provider user, session, tenant, role, or permission columns are
forbidden.

Each attempt updates all applicable buckets in one transaction through atomic
upsert/increment statements. CHECK constraints require non-negative failures,
backoff level 0 through 12, finite blocks within expiry, valid digest shape, and
expiry no more than 30 days after the last transition. Success cannot delete or
erase trusted-network, combined, or global attack evidence. Expired rows are
pruned in bounded batches within 24 hours, yielding a hard 31-day maximum after
the last transition. No database action or connection was used to reach these
review conclusions.
