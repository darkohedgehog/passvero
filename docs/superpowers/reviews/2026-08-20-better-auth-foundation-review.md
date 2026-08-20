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

**Required correction before Stage 13E:** `authenticatedAt`, `lastRefreshAt`, and
`selectedOrganizationId` are configured `input: false`; both timestamps are
required with server-clock create defaults, while selection is optional with no
default. Full-authentication creation captures one server timestamp for both
anchors. Only the reviewed Passvero session wrapper may explicitly preserve
them during a replacement. Selection is writable only through the dedicated
CSRF-protected server mutation that locks the session and revalidates active
membership and active organization before its conditional update. That write
advances general `updatedAt` but never `lastRefreshAt` or expiry. The generic
provider update route, client input, and cookies cannot write these fields.

Database CHECKs cap expiry at both `lastRefreshAt + INTERVAL '7 days'` and
`authenticatedAt + INTERVAL '30 days'`, and require `authenticatedAt <=
lastRefreshAt <= updatedAt`. Every request independently rejects and deletes a
session at either deadline. At `lastRefreshAt + 24 hours`, one conditional
update atomically rotates the opaque token, sets `lastRefreshAt`/`updatedAt` to
the transaction timestamp, caps expiry at the absolute deadline, preserves
`authenticatedAt` and selection, and returns the sole value eligible for the
post-commit cookie. Delivery failure is fail-closed reauthentication.

Better Auth's native refresh instead extends expiry on the same token
(`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/session.mjs:171-207`).
Its option type confirms `disableSessionRefresh: true` prevents refresh
regardless of `updateAge`
(`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/@better-auth/core/dist/types/init-options.d.mts:905-918`).
Native authenticated password change deletes sessions and creates a new one
(`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/update-user.mjs:180-189`),
which would reset a defaulted `authenticatedAt`. Those paths are rejected. A
reviewed Passvero session service/adapter boundary is mandatory. Configuration
sets `disableSessionRefresh: true`, and the native `/get-session` route is not
exposed by the application router, so it is unreachable as an alternate read or
refresh path. Password change
updates the hash, deletes other sessions, and rotates the current token while
preserving its original `authenticatedAt`, `lastRefreshAt`, and expiry; reset and
revoke-all delete every session row and expire the cookie. Native revoke-all
calls `deleteUserSessions`
(`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/session.mjs:411-441`),
but it remains behind the Passvero boundary so cookie expiry and the complete
policy cannot be bypassed. Expired/absolute-expired rows are deleted in bounded
batches at least hourly, while request-time checks remain authoritative.

### Token-storage reconciliation

The installed/disposable package evidence is Better Auth 1.7.1
(`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/package.json:2-3`).
Its relevant behavior is:

- Built-in email verification uses a helper that signs lower-cased email and
  optional update/payload data into the JWT
  (`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/email-verification.mjs:13-18`). Issuance creates
  that signed-JWT capability and passes it to the email callback/URL without a
  verification-row write
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
  selects the latest identifier row inside the internal consume lock/transaction
  and invokes `consumeOne` by unique id
  (`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/db/internal-adapter.mjs:818-845`), then reaches the Prisma
  adapter unique-id branch, which atomically deletes and returns null to a losing
  concurrent caller
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

Resolved verification/reset tokens use normalized current provider email for
the account component. Resolved activation uses normalized current canonical
`User.email`, exactly like the other transports; `intendedEmailDigest` proves
activation binding but is never the abuse-key source. Unknown tokens commit only
network/global evidence, while an identifier request with no account still uses
the normalized attempted identifier.

Trusted network selection is explicit `DIRECT` or configured
`TRUSTED_PROXY_CHAIN`. Proxy mode validates the transport peer/CIDR allowlist and
walks a single configured chain right-to-left to the rightmost untrusted address;
missing/invalid configuration, malformed or excessive chains, and IPv4/IPv6
parse failures deny generically. IPv4-mapped IPv6 is unmapped, IPv4 is canonical
`/24`, and native IPv6 is RFC 5952 `/56`. Account input is trimmed, NFC-normalized,
Unicode-lowercased, and domain-IDNA-normalized by the same function used for
lookup and persistence. The migration contract records executable vectors.

After any required Turnstile call, one PostgreSQL `SERIALIZABLE` transaction
uses a realizable fixed hierarchy. Stage A locks and admits global then network
before any token lookup. A token lookup then either commits unknown-token
network/global evidence or locks/revalidates its owner and derives the common
account value.
Stage B locks/admit account then combined before any protected operation. The
endpoint code in every digest prevents cross-endpoint row sharing, while the
per-endpoint global row serializes later same-endpoint locks.

Thresholds are network 30 failures/15 minutes, account 5/15, combined 5/15, and
global 100 attempts/1 minute. `backoffUpdatedAt` is the explicit decay anchor:
each failure and each global-volume level increase resets it; decay consumes
only complete 24-hour periods and advances the anchor by exactly the consumed
periods, preserving the remainder and making repeated evaluation idempotent.
Backoff levels 1–12 map from 1 minute through 1,440 minutes. Success never erases
evidence. CHECK constraints cover attempt/failure counts, window/failure/decay
timestamps, finite blocks, digest shape, and 30-day expiry. Expired rows are
pruned within 24 hours, yielding a hard 31-day maximum after the last transition.
No database action or connection was used to reach these review conclusions.

## Final cumulative review matrix

`PASS` means the review-only proposal satisfies the approved Phase 12
architecture when every recorded implementation gate is enforced. `REJECT`
means the named native or alternative behavior must not be exposed by Passvero.
`OPERATOR DECISION REQUIRED` is the one remaining approval gate; it is not an
implementation approval.

| Review item | Outcome | Evidence and exact implication |
| --- | --- | --- |
| Next.js 16 and React 19 compatibility | **PASS** | The official [Better Auth Next.js integration](https://better-auth.com/docs/integrations/next) states that Better Auth is fully compatible with Next.js 16 and documents `proxy.ts`, Route Handlers, RSCs, and Server Actions. The pinned `better-auth@1.7.1` registry/package metadata accepts `next ^16`, `react ^19`, and `react-dom ^19` (`better-auth/package.json:510-525` in the disposable capture). Passvero pins Next.js 16.2.11, React 19.2.4, and React DOM 19.2.4. Cookie-only proxy checks remain optimistic only; the reviewed server boundary is authoritative. |
| Prisma 7 and PostgreSQL adapter compatibility | **PASS** | Registry evidence for `better-auth@1.7.1` accepts Prisma/client `^7` and `pg ^8`; `@better-auth/prisma-adapter@1.7.1` accepts Prisma/client `^7` (`@better-auth/prisma-adapter/package.json:37-41`). The official [Prisma adapter guide](https://better-auth.com/docs/adapters/prisma) explicitly covers Prisma 7, supports schema generation, and marks Prisma schema migration unsupported. The pinned disposable PostgreSQL configuration generated the captured four-model schema without database access. Passvero pins Prisma/client 7.8.0. Only manually reviewed Passvero schema/migration work may consume this proposal. |
| Provider-table isolation from canonical `User` | **PASS** | `AuthProviderUser`, `AuthProviderSession`, `AuthProviderAccount`, and `AuthProviderVerification` retain provider-owned string identifiers and relations. Only Passvero-owned `AuthIdentity.userId UUID` references canonical `User.id`; email, organization, membership, role, permission, and entitlement are not identity bindings. The only provider-to-domain relation is nullable session selection to `Organization`, expressly not authority. |
| Stable provider-subject binding and multi-identity support | **PASS** | The selected binding is required `AuthIdentity(provider, providerSubject, userId)` with unique `(provider, providerSubject)`, non-unique `userId` index, `ON DELETE RESTRICT ON UPDATE CASCADE`, and no email. Multiple rows may reference one canonical user. `providerSubject` remains opaque `TEXT`; UUID-shaped current values are not coerced. Automatic same-email linking is rejected and conflicts fail closed. |
| Database-authoritative session and lifetime policy | **PASS** | The browser receives only an opaque credential. The database row owns `authenticatedAt`, `lastRefreshAt`, `expiresAt`, and nullable `selectedOrganizationId`; all three extensions are `input: false`. Request-time enforcement applies 7-day inactivity, refresh due at 24 hours, and a 30-day absolute deadline. Named CHECKs cap expiry at both anchors, while bounded hourly cleanup is non-authoritative. `disableSessionRefresh: true` and application-router exclusion prevent native refresh/read paths from bypassing the sole reviewed Passvero session service/adapter. |
| Rotation preserves `authenticatedAt` | **PASS** | Refresh conditionally replaces the opaque token in one transaction, advances `lastRefreshAt` and `updatedAt`, caps `expiresAt`, and preserves `authenticatedAt` plus selection. Authenticated password change preserves all lifetime anchors while deleting other sessions and rotating the current token. Zero-row races and post-commit cookie-delivery failure require reauthentication. Better Auth 1.7.1 native same-token refresh and delete-then-create password-change behavior are rejected. |
| Organization selection without authorization snapshots | **PASS** | The selected design is nullable `AuthProviderSession.selectedOrganizationId UUID` with `ON DELETE SET NULL ON UPDATE CASCADE`, written only by the dedicated CSRF-protected mutation after canonical identity, active membership, and active organization revalidation. The session and cookie store no roles, permissions, membership/organization status, entitlement, billing, or platform-admin state. Every request and business mutation revalidates authority. A separate one-to-one selection table is rejected as added join/write/lifecycle cost without a stronger boundary. |
| Verification, reset, and activation token lifecycle | **PASS** | `AuthCredentialToken` and `AccountActivation` store only distinct-key HMAC-SHA-256 digests as 43-character base64url values. Owner-lock issuance invalidates active predecessors and inserts one replacement; partial unique indexes backstop that rule. Atomic conditional consumption gates digest, single-use state, invalidation, and expiry and commits the protected state change in the same transaction. Lifetimes are verification 24 hours, reset 30 minutes, activation 24 hours; terminal/expired rows remain no longer than 30 additional days. Activation also binds the locked current canonical email by separate-key `intendedEmailDigest`. Native stateless email verification and default plaintext reset identifiers are rejected. |
| Password hashing ownership | **PASS** | The mandatory Passvero auth-layer/provider-edge password boundary owns normalization, policy checks, and the exact configured `emailAndPassword.password.hash/verify` callbacks; domain code never handles provider hashes. Pinned Better Auth 1.7.1 permits custom callbacks, while its default is rejected because it applies NFKC and compares hex text. The selected boundary applies NFC exactly once, enforces every approved check before credential scrypt/comparison, and stores only the versioned self-describing Passvero scrypt envelope in nullable `AuthProviderAccount.password`. Native password-bearing routes that bypass this boundary are not exposed. This boundary is a hard gate before Stage 13E. |
| Progressive PostgreSQL abuse control | **PASS** | Exactly four keyed-digest dimensions are allowed. The endpoint matrix applies global/network admission before lookup and account/combined admission after a resolved owner. One `SERIALIZABLE` transaction uses the fixed lock hierarchy, atomic upsert/counters, finite level 0-12 backoff, exact thresholds/windows, and no automatic retry on serialization failure. Success never erases evidence. Rows expire no later than 30 days after their last transition and are pruned within 24 hours, for a hard 31-day maximum. Plaintext identifiers, network data, tokens, credentials, proxy headers, and authorization snapshots are forbidden. |
| Excluded secondary/native capabilities | **PASS** | Redis, secondary session storage, cookie cache, Better Auth Organization/Admin/OAuth/magic-link/2FA/passkey plugins, public signup, and automatic linking remain excluded. The initial route/config surface exposes neither provider organizations nor generic session update/read paths. No excluded package, schema, source, route, migration, or environment change exists in this review stage. |
| Migration and exit cost | **OPERATOR DECISION REQUIRED** | Approval accepts two enums, eight proposed tables, three future canonical inverse relations, provider-owned opaque identifiers, named CHECKs/partial indexes, a required Passvero session boundary, a required digest-only credential-token boundary, and the mandatory NFC custom password boundary. Prisma cannot express every database invariant, so a later generated migration requires manual amendment and independent schema-test/migration review. Exit remains bounded because domain services consume canonical `User`, not provider types, and the password envelope is provider-independent, but provider/session/token evidence and retention windows prevent an immediate destructive drop. This material cost is the sole unresolved operator decision. |
| Rollback and forward compatibility | **PASS** | Rollback is forward-only while credential, token, session, or abuse evidence exists: disable new auth paths, preserve rows through required retention, and use a separately reviewed migration. Never use Better Auth migration execution, `prisma db push`, direct review SQL, or destructive cleanup as recovery. A Better Auth upgrade requires a fresh generated-schema diff, installed-source review of every rejected native path, disposable Prisma validation, and renewed operator approval. Provider-neutral `AuthIdentity` and opaque subjects preserve replacement-provider portability. |

## Exact proposed contracts submitted for decision

The atomic runtime-facing identity/session contract is:

```ts
export const AUTH_PROVIDER = "BETTER_AUTH" as const;

export interface AuthIdentityBinding {
  readonly provider: typeof AUTH_PROVIDER;
  readonly providerSubject: string;
  readonly userId: string;
}

export interface AuthSessionExtension {
  readonly authenticatedAt: Date;
  readonly lastRefreshAt: Date;
  readonly selectedOrganizationId: string | null;
}
```

The atomic persistence contract comprises exactly:

- provider-owned `AuthProviderUser`, `AuthProviderSession`,
  `AuthProviderAccount`, and retained adapter-compatibility
  `AuthProviderVerification`;
- Passvero-owned `AuthIdentity`, `AuthCredentialToken`, `AccountActivation`, and
  `AuthAbuseBucket`;
- enums `AuthCredentialTokenPurpose` with only `EMAIL_VERIFICATION` and
  `PASSWORD_RESET`, and `AuthAbuseDimension` with only the four reviewed
  dimensions;
- future canonical inverses `User.authIdentities`,
  `User.accountActivations`, and `Organization.authProviderSessions`;
- the exact Prisma proposal in
  `docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/proposed-prisma-fragment.prisma`;
- the exact PostgreSQL columns, types, defaults, indexes, foreign-key actions,
  CHECKs, partial indexes, atomic transitions, retention, forbidden columns,
  and deployment exclusions in
  `docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/proposed-migration-contract.md`.

`AuthProviderAccount.password` persists only the selected versioned Passvero
password-hash envelope below. It never persists a raw, merely normalized, or
unversioned Better Auth default value. This adds no table, column, enum, index,
or migration shape beyond the already proposed nullable provider password
column.

### Mandatory NFC password boundary

The pinned default is not compatible with the approved
`PASSWORD_UNICODE_NORMALIZATION=NFC` policy. Better Auth 1.7.1 delegates its
default to `@better-auth/utils/password`; the exact Node implementation fixes
`N = 16384`, `r = 16`, `p = 1`, and `dkLen = 64`, but calls
`password.normalize("NFKC")`, emits an unversioned `<hex-salt>:<hex-key>` value,
and compares hex strings
(`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/@better-auth/utils/dist/password.node.mjs:3-41`).
NFKC creates a broader equivalence class than NFC by collapsing compatibility
characters that the approved policy keeps distinct. Two distinct NFC password
inputs can therefore reach the same default KDF input; a stored default hash
cannot later recover that distinction. This is the reviewer's equivalence risk,
not an algorithm-strength objection.

Better Auth explicitly supports custom asynchronous `hash(password)` and
`verify({ hash, password })` callbacks at
`emailAndPassword.password`
(`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/@better-auth/core/dist/types/init-options.d.mts:720-733`).
The selected mandatory design supplies both
`emailAndPassword.password.hash` and `emailAndPassword.password.verify` from one
server-only Passvero authentication-adapter module. This module is provider-edge
code. It is not a domain service, is never imported by domain code, and is the
only module allowed to parse or produce credential hashes.

The exact Better Auth configuration interface is:

```ts
emailAndPassword: {
  minPasswordLength: 1,
  maxPasswordLength: 256,
  password: {
    hash: hashPreparedNfcPassword,
    verify: verifyPreparedNfcPassword,
  },
}

declare function hashPreparedNfcPassword(password: string): Promise<string>;
declare function verifyPreparedNfcPassword(input: {
  hash: string;
  password: string;
}): Promise<boolean>;
```

The callback `string` types match Better Auth's required interface; their module
is private to the sole auth-layer entry point, so a raw/unprepared string cannot
reach them through an application route.

Every password-bearing Passvero flow—activation, sign-in, reset, authenticated
change, and future rehash—must use one reviewed auth-layer entry point. That
entry point converts the raw JavaScript string to NFC exactly once before every
length, common, contextual, compromised, hash, and comparison operation. It
then counts 15-128 Unicode code points, preserves spaces, and permits no
trimming, truncation, or second normalization. Common, contextual, and
compromised-password checks consume that same prepared NFC value and complete
before credential hashing or comparison. A compromised-password service may
receive only an approved k-anonymity digest prefix, never the plaintext value.
The prepared value is encoded once as UTF-8 bytes for the KDF; malformed string
input fails generically. Better Auth's own non-authoritative transport bounds
are configured `minPasswordLength: 1` and `maxPasswordLength: 256` only so its
UTF-16 checks cannot reject an already approved 15-128-code-point value. The
Passvero check remains authoritative, and native unwrapped password endpoints
are not exposed.

The v1 hash operation is exact:

1. Obtain a cryptographically random 16-byte salt from Node
   `crypto.randomBytes(16)` for every hash or rehash.
2. Encode the prepared NFC password as UTF-8 bytes with no intermediary string
   transformation.
3. Invoke asynchronous Node `crypto.scrypt` with `N = 16384`, `r = 16`,
   `p = 1`, `dkLen = 64`, and
   `maxmem = 128 * N * r * 2 = 67,108,864 bytes`.
4. Encode salt and derived key as canonical unpadded base64url and return the
   versioned self-describing format
   `$passvero$scrypt$v=1$N=16384$r=16$p=1$dkLen=64$<salt>$<derived-key>`, where
   `<salt>` is exactly a 22-character unpadded base64url salt and
   `<derived-key>` is exactly an 86-character unpadded base64url derived key.

Verification uses a strict full-string parser with a fixed maximum input
length. For v1 it accepts only the literal algorithm/version labels, exact field
order, exact parameter names and values above, one 22-character canonical
unpadded base64url salt decoding to 16 bytes, and one 86-character canonical
unpadded base64url key decoding to 64 bytes. Missing, duplicate, reordered,
unknown, out-of-range, padded, noncanonical, overlong, or trailing data is
rejected before KDF allocation. It derives exactly 64 bytes using the parsed and
bounded v1 parameters and compares equal-length byte buffers only with Node
`crypto.timingSafeEqual`; string equality is forbidden. Parse, policy, KDF,
comparison, and resource failures produce the same generic authentication
failure and safe protected telemetry. Temporary byte buffers are cleared in a
`finally` path where Node ownership permits.

No plaintext logging/transmission is allowed: the raw or prepared password is
never persisted, logged, placed in telemetry/errors/queues, returned, or sent to
an external service. It exists only in the HTTPS request and the in-process
server auth boundary for the duration of the operation. Tests use structural
contract and generated random/property inputs at implementation time; review
artifacts and fixtures must not store test passwords.

The Better Auth default `<hex-salt>:<hex-key>` format and every other unversioned,
NFKC-derived, unknown-algorithm, or unknown-parameter format MUST NOT be accepted
as legacy input. The only initial accepted format is Passvero scrypt v1. No
existing Passvero authentication credentials require legacy migration: this
review branch has no Better Auth dependency or auth source, the canonical schema
has no provider-account/auth tables, and no database was accessed. If any
out-of-band credential store is discovered before Stage 13E, implementation
must stop and reopen the operator/security gate rather than add a default-hash
fallback.

An algorithm/parameter upgrade requires a new reviewed envelope version with
fixed bounds and explicit accepted-version allowlist. New credentials always
use the one current version. An older Passvero version remains verifiable only
when explicitly retained by that review; after successful authentication the
auth-layer credential service must rehash the already prepared NFC value with a
fresh salt and replace the provider hash in the same transaction as the
credential-authentication state transition. Failed authentication never
rehashes. An old verifier may be removed only after protected inventory proves
zero remaining hashes and the rollback window closes. Provider exit exports or
imports only the self-describing hash envelope and identity binding, never
plaintext; a replacement provider must implement the exact accepted verifier or
force the digest-only password-reset flow. It must never reinterpret the
normalization policy.

Configuration, route isolation, NFC-once property tests, Unicode code-point
boundaries, canonical envelope parsing, resource bounds, timing-safe comparison,
generic failures, no-default-format acceptance, and upgrade/exit behavior are a
hard gate before Stage 13E. This selected mandatory boundary resolves password
ownership as `PASS`; migration and exit cost remains the sole operator gate.

This is an indivisible decision: implementation must not substitute native
provider behavior for any of the three mandatory Passvero-owned boundaries or
accept only a subset of the constraints.

## Rejected native and alternative behaviors

| Behavior | Outcome | Reason |
| --- | --- | --- |
| Native Better Auth `/get-session` as an application read/refresh path | **REJECT** | It can bypass the reviewed database read, lifetime, rotation, and cookie-delivery boundary. The route is not exposed. |
| Native Better Auth same-token session refresh | **REJECT** | It does not rotate the opaque token or enforce the Passvero absolute cap. |
| Native Better Auth authenticated password-change session replacement | **REJECT** | Delete-and-create resets a defaulted `authenticatedAt`; the Passvero transaction preserves all lifetime anchors. |
| Built-in stateless email verification | **REJECT** | A signed JWT has no persisted atomic single-use state or predecessor invalidation. |
| Default Better Auth password-reset identifier storage | **REJECT** | Pinned 1.7.1 stores `reset-password:<raw token>` under the default `plain` mode; hashing alone still does not add complete supersession. |
| Better Auth default password hash/verify | **REJECT** | Pinned 1.7.1 applies NFKC, emits an unversioned hex envelope, and compares hex strings. It violates the approved NFC equivalence contract and MUST NOT be accepted as new or legacy credential input. |
| Generic session additional-field update | **REJECT** | It would make server-owned timestamps or organization selection client-writable; all three fields are `input: false`. |
| Better Auth Organization plugin and automatic linking | **REJECT** | Provider organization/role state and email-based linking would violate canonical identity and authorization boundaries. |
| Redis, cookie cache, and secondary session authority | **REJECT** | Initial authority is the PostgreSQL session row; duplicate authority and stale authorization state are excluded. |
| Separate `AuthSessionSelection` table | **REJECT** | It adds a table, join, write, uniqueness, cleanup, and exit path without strengthening authorization. |
| Better Auth CLI migration, Prisma `db push`, or direct SQL during review | **REJECT** | Schema generation is evidence only; migration authoring, deployment, rollback, and cleanup require later independent authorization. |

## Operator decision gate

**Outcome:** OPERATOR DECISION REQUIRED

The only unresolved decision is whether to accept the complete
`AUTH_FOUNDATION_PERSISTENCE_CONTRACT` above as the input to a later, separately
authorized implementation plan. Approval would not install dependencies,
modify the canonical Prisma schema, author or deploy a migration, connect to
PostgreSQL, generate a client or secret, or authorize Stage 13B/13E work.
