# Better Auth Foundation Review

**Status:** Blocked pending architecture review after terminal Better Auth proof failure
**Execution base:** 331f8f1cd29203ee7d8d9364c7324313b75f822f
**Evidence date:** 2026-08-21

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
- Native Better Auth routes: EXCLUDED
- Better Auth catch-all handler: NOT EXPORTED
- Better Auth-backed transaction boundary: REQUIRED AND UNPROVEN
- Direct Passvero provider-table writes: REJECTED
- Disposable proof command/attempt invoked exactly once: YES
- Proof retry count: 0
- Passvero database connection performed: NO
- Disposable proof schema applied: NO
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
- `RAW_GENERATOR_BODY_SHA256=7034757e4505ccf015ca00b46c373dfdd3de2c40f0e5b20ce0608446c4b5909e`
- Database connection: not performed
- Canonical Prisma schema mutation: not performed
- Canonical migration mutation: not performed

The captured disposable harness omitted `disableSignUp: true`; that was a
runtime-exclusion omission, not a schema-output defect. The disposable harness
was corrected and regenerated with `emailAndPassword.disableSignUp: true` on
2026-08-20. Its 2,212-byte body and SHA-256 were byte-identical to the retained
raw body, so the immutable raw artifact did not change. Future configuration must
set `emailAndPassword.disableSignUp: true` even though no Better Auth HTTP handler
is mounted.

## Frozen runtime authority and transaction-proof gate

`AUTH_FOUNDATION_RUNTIME_OWNERSHIP=BETTER_AUTH_BACKED_TRANSACTION_PROOF_REQUIRED`

Better Auth is authoritative for authentication proof, credentials, recovery,
and session establishment. Passvero remains authoritative for canonical `User`,
`Membership`, `Organization`, permissions, and business authorization. Passvero
may own transport, orchestration, abuse controls, and canonical authorization
checks at the auth edge, but those responsibilities do not authorize Passvero to
replace Better Auth as the provider-table write authority.

The exact initial runtime exclusion is:

```text
NATIVE_AUTH_ROUTE_ALLOWLIST=[]
BETTER_AUTH_CATCH_ALL_HANDLER=NOT_EXPORTED
```

The empty native-route allowlist is a no-bypass constraint, not permission to
demote Better Auth. The exact Better Auth-backed transaction boundary for the
initial activation, sign-in, verification, reset, session, and password flows is
**REQUIRED AND UNPROVEN**. No replacement integration is selected or approved by
this review. The previously proposed direct provider-table write strategy is
superseded and rejected because it would make Better Auth only a schema/account
compatibility library and would violate the frozen authority split.

The proof must preserve provider-neutral interfaces for application and domain
code: those layers receive canonical identifiers and results and must not import
Better Auth, provider Prisma models, cookies, headers, or route types. Exact proof
acceptance criteria are recorded in the proposed migration contract. Producing
that proof required a separately authorized disposable PostgreSQL execution;
its terminal result is reconciled below.

### Terminal disposable-proof result

The separately authorized review-only proof invoked the reviewed
`run-proof.sh --all` command exactly once on 2026-08-21. It exited nonzero before
schema generation completed and before any H1-H7 live hypothesis executed. The
corrected post-execution redacted evidence therefore records every mandatory
hypothesis as `NOT_EXECUTED` with reason `STOP_PRE_EVIDENCE_FAILURE`; it is not
negative evidence about the individual Better Auth transaction mechanisms. The
proof invocation count is 1 and retry count is 0. The most exact safe public
phase is `PRE_HYPOTHESIS_SCHEMA_PREPARATION_INCOMPLETE`. No exact cause was
retained in committed public evidence, and protected retained-root contents were
not consulted to manufacture one.

Independent post-run checks confirmed that the loopback listener was absent,
`pg_isready` returned its no-response status, and no postmaster PID file or open
reference remained. The cleanup evidence records `serverStopped=true`,
`listenerGone=true`, `pidGone=true`, `rootGone=false`, and
`status=FAIL_RETAINED`. The exact
owner-validated, sentinel-bound disposable root is retained for operator review
and MUST NOT be deleted, modified, moved, or reused under this proof authority.
Future disposal requires separate explicit exact-target authorization and a
reviewed cleanup procedure; it must not rewrite the historical
`rootGone=false` or `FAIL_RETAINED` execution result.

This terminal run does not select `BETTER_AUTH_RUNTIME_BOUNDARY`, does not make
the candidate migration contract implementable, and cannot be retried. Any new
proof would require an architecture decision, a newly reviewed proof plan, and
fresh explicit operator authorization.

The committed evidence JSON and Markdown were corrected after execution to
remove synthetic runtime observations and add invocation, retry, cleanup, and
provenance fields. They explicitly identify themselves as post-execution
reconciliation artifacts and preserve the historical execution source commit
`d1f350627c3da72feaa18eb5416ff17e07db81a8`. That source had one
`prefer-const` error and 15 warnings. The proof was not rerun.

`TASK_10_LINT_GATE=PASS_POST_PROOF_SUCCESSOR_ONLY`: after separate operator
authorization, the post-proof successor changes only the native-transaction
proxy binding from a `let` declaration plus assignment to one `const`
initializer. Its file hash is
`e378998b921151c79594ba0ca0aa044b001a550173f56d9813f845cbe8143401`.
Fresh `npm run lint` exits 0 with 0 errors and the same 15 warnings. The
historical execution source remains `d1f3506`; the successor source was not
executed and does not alter any proof, hypothesis, cleanup, or persistence
fact.

`FINAL_REVIEW_STATIC_SUCCESSOR=UNEXECUTED`: a later final-review successor
hardens SQL capture/validation, verifies the committed lockfile and every
reviewed installed Better Auth/core/Prisma-adapter source before cluster
startup, protects `.proof-attempt-state/` with an anchored ignore rule, and
uses secret-safe session-state assertions. This successor was not executed.
It supplies no H1-H7 observation, does not change the terminal overall `FAIL`,
and grants no authority to retry the one-shot proof.

## Provider-model and canonical identity reconciliation

The proposed provider-compatible identity models are kept separate from
canonical `User` and `Membership`. The raw model names already avoid collisions,
so they are retained. The generated user relations receive explicit relation
names only; all Better Auth-required fields, unique constraints, indexes, table
maps, and cascade behavior are preserved. Task 4 adds one nullable
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
| `AuthProviderUser.id` (primary key) | `String` | `String @id` | `text` | No added length or check; provider-compatible opaque key | Preserve existing provider key shape; do not coerce to UUID without official 1.7.1 configuration and adapter-path proof. |
| `AuthProviderSession.id` (primary key) | `String` | `String @id` | `text` | No added length or check; provider-compatible opaque key | Same provider-key rule; its relation targets `AuthProviderUser.id`. |
| `AuthProviderAccount.id` (primary key) | `String` | `String @id` | `text` | No added length or check; provider-compatible opaque key | Same provider-key rule; its relation targets `AuthProviderUser.id`. |
| `AuthProviderVerification.id` (primary key) | `String` | `String @id` | `text` | No added length or check; provider-compatible opaque key | Same provider-key rule; no canonical foreign key. |
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

### Candidate provider-row conventions

The review observed these candidate compatibility values from pinned 1.7.1:
`providerId = "credential"`, `issuer = "local:credential"`,
`accountId = AuthProviderUser.id`, `userId = AuthProviderUser.id`, and a non-null
Passvero scrypt `password`; OAuth/token fields remain null. Credential lookup
matches all four identity fields. Provider-user lookup uses the unique normalized
`AuthProviderUser.email` and sign-in requires `emailVerified = true`.
`AuthIdentity.provider = "BETTER_AUTH"` with
`providerSubject = AuthProviderUser.id`; session lookup uses unique opaque
`AuthProviderSession.token` and all three lifetime timestamps. They are candidate
persistence inputs only. The exact provider-row and cookie conventions must be
supplied by Better Auth or a reviewed adapter during the required proof; this
review does not authorize Passvero to impose or write them directly.

The previously documented row order, `Serializable` isolation, bounded retry
rules, and post-commit cookie behavior remain acceptance inputs to the proof, not
an approved transaction implementation. The proof may validate them or provide
an evidence-backed equivalent that preserves the frozen authority and one
rollback domain.

## Session, activation, recovery, and abuse candidate persistence inputs

The exact table, column, type, index, foreign-key, CHECK, partial-index,
retention, atomicity, and deployment requirements are in
`docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/proposed-migration-contract.md`.
That asset is a blocked candidate contract, not SQL, migration authority, or an
implementable persistence contract.

### Organization-selection choice

**Candidate input: persist `selectedOrganizationId` on
`AuthProviderSession`, with a nullable UUID foreign key to canonical
`Organization`.** This is the retained candidate persistence shape. It is
compatible with the generated provider model's additional server-side session field, keeps
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

**Candidate requirement subject to Better Auth-backed proof:** `authenticatedAt`,
`lastRefreshAt`, and `selectedOrganizationId` are configured `input: false`; both timestamps are
required with server-clock create defaults, while selection is optional with no
default. Full-authentication creation captures one server timestamp for both
anchors. A proven Better Auth-backed transaction boundary must preserve them
during rotation or replacement without exposing a bypass. Selection is writable
only through the dedicated CSRF-protected server mutation that locks the session and revalidates active
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
which would reset a defaulted `authenticatedAt`. Those exact native behaviors do
not satisfy the candidate policy; the required proof must show a supported Better
Auth-backed path or evidence-backed equivalent without demoting Better Auth. A
provider-neutral Passvero session facade is mandatory. Configuration
sets `disableSessionRefresh: true`, and the native `/get-session` route is not
exposed by the application router, so it is unreachable as an alternate read or
refresh path. Password change
updates the hash, deletes other sessions, and rotates the current token while
preserving its original `authenticatedAt`, `lastRefreshAt`, and expiry; reset and
revoke-all delete every session row and expire the cookie. Native revoke-all
calls `deleteUserSessions`
(`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/session.mjs:411-441`),
and the required proof must establish cookie expiry and the complete policy
without a bypass. Expired/absolute-expired rows are deleted in bounded
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

**Required before Stage 13E:** reconcile the proposed Passvero-owned
`AuthCredentialToken` support persistence with the proven Better Auth-backed
boundary for email verification and password reset. The built-in stateless email-verification
flow and default reset storage are rejected. Merely enabling identifier hashing
would still leave email verification without atomic consumption and both flows
without the approved predecessor-invalidation transaction.

Every credential or activation capability is exactly 32 CSPRNG bytes encoded as
43-character canonical unpadded base64url. Only a 43-character HMAC-SHA-256
`tokenDigest` persists. Credential tokens additionally persist
`targetEmailDigest`, a dedicated purpose/domain-separated keyed digest of the
normalized locked current `AuthProviderUser.email`; no plaintext target email is
stored. Capability, target-email, activation, abuse, and Better Auth secret keys
are distinct. Initial version `v1` uses length-prefixed messages and key rotation
invalidates active rows before removing the only accepted v1 key.

Issuance locks the owning provider/canonical user, invalidates every active
predecessor, and inserts one replacement in the same transaction; a partial
unique index is the backstop. For credential tokens one trusted transaction
timestamp supplies explicit `createdAt` and exact purpose-dependent `expiresAt`.
The database CHECK fixes verification to 24 hours and reset to 30 minutes.
Consumption locks/revalidates the owner, recomputes the current target-email
digest, compares equal-length decoded digests with `crypto.timingSafeEqual`, and
invalidates/fails generically on mismatch. Only then may an atomic conditional
`UPDATE ... RETURNING` consume the row.

`EMAIL_VERIFICATION` changes `emailVerified = false` to `emailVerified = true` in
the same transaction as consumption. Password reset replaces the credential and
revokes every session in that transaction. Therefore only one concurrent caller
can cause the protected transition. Every provider-email mutation locks the
`AuthProviderUser`, invalidates active verification and reset tokens, writes the
new normalized email, and sets verified false before any replacement token is
issued. The activation transaction remains the separately described canonical
binding. Terminal/expired rows are retained no longer than 30 additional days.

Raw capabilities use only the fixed HTTPS origin. They travel in the link URL
fragment, then a no-third-party token page with `Referrer-Policy: no-referrer`
submits them in a same-origin POST body and removes the fragment with
`history.replaceState`. Raw/digest values are forbidden from access logs,
application logs, telemetry, analytics, traces, metrics, queues, errors,
referrers, and response bodies.

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
These candidate review conclusions were established without a database; the
later separately authorized terminal proof attempt is reconciled above.

## Final cumulative review matrix

`PASS` means the evidence establishes the narrow review item. `CANDIDATE INPUT`
means the proposed persistence shape is retained for reconciliation but is not
approved or implementable. `PROOF REQUIRED` means the item depends on the
unproven Better Auth-backed transaction boundary. `DEFERRED` means no current
migration/exit approval is being requested. `REJECT` means the named behavior
must not be implemented.

Transaction proof status is **TERMINAL FAILURE/ARCHITECTURE REVIEW REQUIRED**
outside the 13-row decision count. Runtime ownership remains selected, but the
failed proof established no approved transaction integration boundary.

| Review item | Outcome | Evidence and exact implication |
| --- | --- | --- |
| Next.js 16 and React 19 compatibility | **PASS** | The official [Better Auth Next.js integration](https://better-auth.com/docs/integrations/next) states that Better Auth is fully compatible with Next.js 16 and documents `proxy.ts`, Route Handlers, RSCs, and Server Actions. The pinned `better-auth@1.7.1` registry/package metadata accepts `next ^16`, `react ^19`, and `react-dom ^19` (`better-auth/package.json:510-525` in the disposable capture). Passvero pins Next.js 16.2.11, React 19.2.4, and React DOM 19.2.4. Cookie-only proxy checks remain optimistic only; the reviewed server boundary is authoritative. |
| Prisma 7 and PostgreSQL adapter compatibility | **PASS** | Registry evidence for `better-auth@1.7.1` accepts Prisma/client `^7` and `pg ^8`; `@better-auth/prisma-adapter@1.7.1` accepts Prisma/client `^7` (`@better-auth/prisma-adapter/package.json:37-41`). The official [Prisma adapter guide](https://better-auth.com/docs/adapters/prisma) explicitly covers Prisma 7, supports schema generation, and marks Prisma schema migration unsupported. The pinned disposable PostgreSQL configuration generated the captured four-model schema without database access. Passvero pins Prisma/client 7.8.0. Only manually reviewed Passvero schema/migration work may consume this proposal. |
| Provider-table isolation from canonical `User` | **CANDIDATE INPUT** | The four provider models remain isolated from canonical `User`; only `AuthIdentity.userId UUID` binds to canonical identity. Exact provider-row conventions and the Better Auth-backed write boundary remain subject to proof. |
| Stable provider-subject binding and multi-identity support | **CANDIDATE INPUT** | `AuthIdentity(provider, providerSubject, userId)` remains the provider-neutral candidate, with opaque subject and no email binding. Automatic linking stays rejected. |
| Database-authoritative session and lifetime policy | **PROOF REQUIRED** | The candidate database session stores opaque credentials and server-owned lifetime anchors. Proof must show Better Auth-backed establishment, reads, refresh/rotation, revocation, and no native-route bypass. |
| Rotation preserves `authenticatedAt` | **PROOF REQUIRED** | Preserving `authenticatedAt` across rotation and password change, plus fail-closed post-commit cookie semantics, is an acceptance criterion not yet demonstrated through Better Auth 1.7.1. |
| Organization selection without authorization snapshots | **CANDIDATE INPUT** | Nullable `selectedOrganizationId` remains selection only. Canonical membership and organization revalidation stay Passvero-authoritative; no authorization snapshot enters provider state or cookies. |
| Verification, reset, and activation token lifecycle | **PROOF REQUIRED** | The digest-only, single-use, superseding, target-email-bound token requirements remain intact, but their atomic integration with Better Auth-authoritative credentials and recovery is unproven. |
| Password hashing ownership | **PROOF REQUIRED** | The NFC policy and Passvero scrypt envelope remain candidate callback requirements. Proof must demonstrate that Better Auth 1.7.1 invokes the reviewed boundary for every credential path without an alternate or direct-write bypass. |
| Progressive PostgreSQL abuse control | **PROOF REQUIRED** | The exact keyed-digest buckets and schedules remain candidate inputs. Proof must place required abuse state and authentication state in one rollback domain or demonstrate an evidence-backed equivalent. |
| Excluded secondary/native capabilities | **PASS** | Redis, secondary session storage, cookie cache, Better Auth Organization/Admin/OAuth/magic-link/2FA/passkey plugins, public signup, and automatic linking remain excluded. `disableSignUp: true`, `NATIVE_AUTH_ROUTE_ALLOWLIST=[]`, and no catch-all remain mandatory no-bypass constraints. |
| Migration and exit cost | **DEFERRED** | Migration and exit approval is deferred until Better Auth-backed transaction proof reconciles the candidate schema and PostgreSQL inputs. No schema, migration, dependency, or implementation approval is presented now. |
| Rollback and forward compatibility | **CANDIDATE INPUT** | Retention, forward-only rollback, provider-neutral `AuthIdentity`, and renewed proof on Better Auth upgrade remain candidate constraints pending the transaction proof. |

## Exact candidate contracts retained for proof reconciliation

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

The candidate persistence inputs comprise:

- Better Auth-compatible `AuthProviderUser`, `AuthProviderSession`,
  `AuthProviderAccount`, and retained schema-compatibility
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
The candidate callback boundary supplies both
`emailAndPassword.password.hash` and `emailAndPassword.password.verify` from one
server-only Passvero authentication-adapter module. This module is provider-edge
code. It is not a domain service, is never imported by domain code, and is the
only module allowed to parse or produce credential hashes.

The exact Better Auth configuration interface is:

```ts
emailAndPassword: {
  enabled: true,
  disableSignUp: true,
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
reach them through an application route. Proof must show Better Auth invokes
these callbacks for every credential path and that no alternate or unwrapped
direct-write path can bypass them.

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
Passvero policy remains a required acceptance input, Better Auth remains the
credential authority, and native unwrapped password endpoints are not exposed.

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
acceptance criteria as a candidate input; Better Auth-backed transaction proof
remains required before persistence or migration approval.

These are indivisible acceptance criteria: a proof must not bypass Better Auth's
frozen authentication authority or accept only a subset of the constraints.

## Rejected native and alternative behaviors

| Behavior | Outcome | Reason |
| --- | --- | --- |
| Better Auth catch-all or any native HTTP route | **REJECT** | Initial native allowlist is empty and no catch-all handler is exported. A future allowlist change requires separate proof and approval. |
| Direct Passvero writes to Better Auth provider tables | **REJECT** | This unauthorized authority demotion would reduce Better Auth to schema/account compatibility and contradict the frozen Phase 12 authority split. |
| Unproven Better Auth native or adapter transaction path | **REJECT** | No specific path is approved until it satisfies every transaction-proof acceptance criterion; this does not authorize direct Passvero provider-table writes. |
| Native Better Auth `/get-session` as an application read/refresh path | **REJECT** | It can bypass the reviewed database read, lifetime, rotation, and cookie-delivery boundary. The route is not exposed. |
| Native Better Auth same-token session refresh | **REJECT** | It does not rotate the opaque token or enforce the Passvero absolute cap. |
| Native Better Auth authenticated password-change session replacement | **REJECT** | Delete-and-create resets a defaulted `authenticatedAt`; accepted proof must demonstrate a Better Auth-backed transaction path that preserves every lifetime anchor. |
| Built-in stateless email verification | **REJECT** | A signed JWT has no persisted atomic single-use state or predecessor invalidation. |
| Default Better Auth password-reset identifier storage | **REJECT** | Pinned 1.7.1 stores `reset-password:<raw token>` under the default `plain` mode; hashing alone still does not add complete supersession. |
| Better Auth default password hash/verify | **REJECT** | Pinned 1.7.1 applies NFKC, emits an unversioned hex envelope, and compares hex strings. It violates the approved NFC equivalence contract and MUST NOT be accepted as new or legacy credential input. |
| Generic session additional-field update | **REJECT** | It would make server-owned timestamps or organization selection client-writable; all three fields are `input: false`. |
| Better Auth Organization plugin and automatic linking | **REJECT** | Provider organization/role state and email-based linking would violate canonical identity and authorization boundaries. |
| Redis, cookie cache, and secondary session authority | **REJECT** | Initial authority is the PostgreSQL session row; duplicate authority and stale authorization state are excluded. |
| Separate `AuthSessionSelection` table | **REJECT** | It adds a table, join, write, uniqueness, cleanup, and exit path without strengthening authorization. |
| Better Auth CLI migration, Prisma `db push`, or direct SQL during review | **REJECT** | Schema generation is evidence only; migration authoring, deployment, rollback, and cleanup require later independent authorization. |

## Operator and proof gate

**Outcome:** TERMINAL PROOF FAILURE; ARCHITECTURE REVIEW REQUIRED

`AUTH_FOUNDATION_PERSISTENCE_CONTRACT=BLOCKED_PENDING_ARCHITECTURE_REVIEW`

The one authorized disposable proof attempt stopped before H1-H7 execution with
the generic retained code `STOP_PRE_EVIDENCE_FAILURE`; every hypothesis is
`NOT_EXECUTED`, and the exact cause is unavailable in committed public evidence.
There is no
persistence-contract approval question, positive runtime-boundary selection, or
approved marker. Migration and exit approval remain deferred. This review does
not modify the canonical Prisma schema, author or deploy a migration, connect to
a Passvero database, or authorize Stage 13B/13E.
