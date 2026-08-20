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

### Session-input and lifecycle reconciliation

The captured disposable configuration is not implementation-safe as written:
Better Auth's field type declares `input` default true and documents a function
`defaultValue` as an application create default, not a database default
(`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/@better-auth/core/dist/db/type.d.mts:31-53`).
The session parser copies supplied additional fields unless `input: false`, and
applies defaults on create
(`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/db/schema.mjs:59-108`).
The generic update endpoint parses session additional fields and writes them
(`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/update-session.mjs:31-54`).
The internal create path evaluates additional-field defaults before building the
record and provides a server-only `overrideAll` merge after those defaults
(`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/db/internal-adapter.mjs:248-320`).

**Required correction before Stage 13E:** both `authenticatedAt` and
`selectedOrganizationId` are configured `input: false`; `authenticatedAt` is
required with `defaultValue: () => new Date()`, while selection is optional with
no default. Full-authentication creation receives server time. Only the reviewed
Passvero session wrapper may explicitly preserve `authenticatedAt` during a
replacement. Selection is writable only through the dedicated CSRF-protected
server mutation that locks the session and revalidates active membership and
active organization before its conditional update. The generic provider update
route, client input, and cookies cannot write either field.

The database CHECK is `expiresAt > authenticatedAt AND expiresAt <=
authenticatedAt + INTERVAL '30 days'`. Every request independently rejects and
deletes a session at either the 7-day inactivity deadline or 30-day absolute
deadline. At the 24-hour refresh boundary, one conditional update atomically
rotates the opaque token, caps the new 7-day expiry at the absolute deadline,
preserves `authenticatedAt` and selection, and returns the sole value eligible
for the post-commit cookie. Delivery failure is fail-closed reauthentication.

Better Auth's native refresh instead extends expiry on the same token
(`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/session.mjs:171-207`).
Native authenticated password change deletes sessions and creates a new one
(`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/update-user.mjs:180-189`),
which would reset a defaulted `authenticatedAt`. Those paths are rejected. A
reviewed Passvero session service/adapter boundary is mandatory: password change
updates the hash, deletes other sessions, and rotates the current token while
preserving its original `authenticatedAt`; reset and revoke-all delete every
session row and expire the cookie. Native revoke-all calls `deleteUserSessions`
(`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/session.mjs:411-441`),
but it remains behind the Passvero boundary so cookie expiry and the complete
policy cannot be bypassed. Expired/absolute-expired rows are deleted in bounded
batches at least hourly, while request-time checks remain authoritative.

### Token-storage reconciliation

The installed/disposable package evidence is Better Auth 1.7.1
(`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/package.json:2-3`).
Its relevant behavior is:

- Built-in email verification issuance creates the signed-JWT capability and
  passes it to the email callback/URL without a verification-row write
  (`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/email-verification.mjs:23-35`),
  then reads, verifies, and parses that JWT on use
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
  reaches Prisma adapter `consumeOne`, whose unique-id branch atomically deletes
  and returns null to a losing concurrent caller
  (`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/@better-auth/prisma-adapter/dist/index.mjs:319-332`). That makes a
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

`AccountActivation` additionally stores `intendedEmailDigest`, a separate-key,
43-character base64url HMAC-SHA-256 digest of the normalized canonical email at
issuance. Issuance locks canonical `User`, derives the digest from its current
email, invalidates predecessors, and inserts the replacement atomically.
Consumption locks activation and user, recomputes the current canonical-email
digest, uses constant-time equality, and only then conditionally consumes and
creates the provider credential/identity in the same transaction. Any canonical
email mutation locks the user and invalidates all active activations before the
email change. A mismatch is invalidated and receives the generic token failure;
no plaintext intended email is added to activation persistence.

### Progressive PostgreSQL abuse state

`AuthAbuseBucket` permits exactly four enum dimensions:
`TRUSTED_NETWORK`, `ACCOUNT_IDENTIFIER`,
`ACCOUNT_AND_TRUSTED_NETWORK`, and `GLOBAL_ENDPOINT`. Its unique `keyDigest` is
a versioned, keyed HMAC-SHA-256 base64url digest over the enum, an allowlisted
endpoint code, and only the dimension's normalized components. Plain SHA-256
and plaintext email, IP/network, user-agent, password, token, forwarded-header,
canonical/provider user, session, tenant, role, or permission columns are
forbidden.

The exact endpoint matrix distinguishes identifier endpoints from token-only
consumption. Sign-in, send-verification, reset request, activation issuance, and
authenticated password change use all four dimensions. Token consumption uses
network/global before lookup, then account/combined only when a digest row yields
a subject; an invalid unknown token never fabricates account state. A nonexistent
email still uses the normalized attempted identifier, so account existence
cannot change buckets or response shape.

Trusted network selection is explicit `DIRECT` or configured
`TRUSTED_PROXY_CHAIN`. Proxy mode validates the transport peer/CIDR allowlist and
walks a single configured chain right-to-left to the rightmost untrusted address;
missing/invalid configuration, malformed or excessive chains, and IPv4/IPv6
parse failures deny generically. IPv4-mapped IPv6 is unmapped, IPv4 is canonical
`/24`, and native IPv6 is RFC 5952 `/56`. Account input is trimmed, NFC-normalized,
Unicode-lowercased, and domain-IDNA-normalized by the same function used for
lookup and persistence. The migration contract records executable vectors.

After any required Turnstile call, all applicable rows plus the local protected
operation run in one PostgreSQL `SERIALIZABLE` transaction and deterministic
digest-lock order. Thresholds are network 30 failures/15 minutes, account 5/15,
combined 5/15, and global 100 attempts/1 minute. Backoff levels 1–12 map from 1
minute through 1,440 minutes; a level decays only once per complete 24 hours
without failure. Success never erases evidence. CHECK constraints cover attempt
and failure counts, window/failure timestamps, finite blocks, digest shape, and
30-day expiry. Expired rows are pruned within 24 hours, yielding a hard 31-day
maximum after the last transition. No database action or connection was used to
reach these review conclusions.
