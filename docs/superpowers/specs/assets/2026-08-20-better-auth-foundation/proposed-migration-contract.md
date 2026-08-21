# Proposed Authentication Persistence Migration Contract

**Status:** `BLOCKED_PENDING_ARCHITECTURE_REVIEW`; candidate inputs only

**Schema proposal:** `proposed-prisma-fragment.prisma`

**Canonical schema and migration directories changed:** NO

`AUTH_FOUNDATION_PERSISTENCE_CONTRACT=BLOCKED_PENDING_ARCHITECTURE_REVIEW`

This contract retains candidate PostgreSQL inputs for a later reconciliation. It
is not approved, implementable, executable migration SQL, or migration authority.
Every `MUST`, required transition, table convention, and ordering statement below
is a proof acceptance input unless expressly marked as package evidence. The
rejected direct provider-table strategy is superseded throughout this document.
Prisma names below are quoted
PostgreSQL identifiers. `DateTime` maps to `TIMESTAMP(3)`, not `TIMESTAMPTZ`.
Prisma `uuid()` values are application-generated; the PostgreSQL UUID columns
have no database default. Prisma `@updatedAt` columns also have no database
default and every write must set them explicitly.

## Enums

- `AuthCredentialTokenPurpose`: `EMAIL_VERIFICATION`, `PASSWORD_RESET` only.
- `AuthAbuseDimension`: `TRUSTED_NETWORK`, `ACCOUNT_IDENTIFIER`,
  `ACCOUNT_AND_TRUSTED_NETWORK`, `GLOBAL_ENDPOINT` only. Adding a dimension is a
  future schema-and-migration review, not a runtime string extension.

## Frozen authority and Better Auth-backed transaction proof

Better Auth is authoritative for authentication proof, credentials, recovery,
and session establishment. Passvero is authoritative for canonical `User`,
`Membership`, `Organization`, permissions, and business authorization. Direct
Passvero writes to Better Auth provider tables are rejected as an unauthorized
authority demotion.

The exact Better Auth-backed transaction boundary is **REQUIRED AND UNPROVEN**.
No replacement integration is selected or approved. The following are proof
acceptance criteria only; this is not an implementation plan or execution:

- The proof is pinned to `better-auth@1.7.1` and the reviewed 1.7.1 adapter
  surface.
- Demonstrate that Better Auth-backed activation credential creation and the
  `AuthIdentity` binding are atomic.
- Place abuse, token, provider, and canonical state in one rollback domain, or
  demonstrate an evidence-backed equivalent that preserves frozen authority.
- Cover session establishment, rotation, revocation, and preservation of
  `authenticatedAt` across every accepted lifecycle transition.
- Cover all password and recovery paths, including reset and authenticated
  password change, without an alternate credential-write path.
- Preserve the native-route allowlist `NATIVE_AUTH_ROUTE_ALLOWLIST=[]`, no
  exported catch-all, and no bypass around the reviewed boundary.
- Demonstrate post-commit cookie semantics, including ambiguous commit and
  delivery failure behavior.
- Establish transaction isolation and retry behavior, including which failures
  are known rolled back and which must never be retried.
- Use exact provider-row and cookie conventions supplied by Better Auth or a
  reviewed adapter, rather than conventions imposed by Passvero.
- Use failure injection to demonstrate rollback of every required state and the
  absence of split-brain provider/canonical state.
- Preserve the provider-neutral application and domain boundary: those layers
  must not import Better Auth, provider Prisma models, cookies, headers, or route
  APIs.

The proof required a separately authorized disposable PostgreSQL environment.
Its terminal result is reconciled below. Until accepted proof exists, the
candidate schema and SQL below remain unapproved and must not be implemented or
migrated.

### Executed proof reconciliation

The operator separately authorized one disposable PostgreSQL proof attempt. The
reviewed `run-proof.sh --all` command was invoked exactly once on 2026-08-21 and
exited nonzero before disposable Prisma client/schema generation completed and
before H1-H7 live execution. Retry count is zero. The corrected post-execution
redacted evidence records all seven mandatory hypotheses as `NOT_EXECUTED` with
reason `STOP_PRE_EVIDENCE_FAILURE`; it contains no synthetic runtime row,
transaction, or cookie observations.

The most exact safe public phase is
`PRE_HYPOTHESIS_SCHEMA_PREPARATION_INCOMPLETE`. The exact cause was not retained
in committed public evidence and is explicitly unavailable. Protected retained
root contents are not a permitted source for reconstructing it.

The result does not disprove or approve any individual hypothesis. It proves
only that the required end-to-end foundation contract was not established.
Cleanup stopped the disposable server and independently confirmed the listener
and PID were gone, but retained the exact sentinel-bound proof root. The
historical cleanup status is `FAIL_RETAINED` with `rootGone=false`. The root
remains unchanged. Disposal requires separate explicit exact-target
authorization and a reviewed cleanup procedure, and any later disposal MUST NOT
rewrite that historical cleanup result. No cleanup authority is inferred from
this document.

No `BETTER_AUTH_RUNTIME_BOUNDARY` is selected. The candidate schema, ordering,
transaction, session, recovery, and route rules below remain non-implementable
inputs. The terminal proof MUST NOT be retried. A new attempt requires an
architecture decision, a newly reviewed proof plan, and fresh explicit operator
authorization.

The corrected evidence JSON and Markdown are explicitly post-execution
reconciliation artifacts pinned to the executed source commit; they were not
emitted by the historical publisher. The historical execution source
`d1f350627c3da72feaa18eb5416ff17e07db81a8` had one `prefer-const` error and
15 warnings. The proof was not rerun.

`TASK_10_LINT_GATE=PASS_POST_PROOF_SUCCESSOR_ONLY`: after separate operator
authorization, the post-proof successor changes only the native-transaction
proxy binding from a `let` declaration plus assignment to one `const`
initializer. Its file hash is
`e378998b921151c79594ba0ca0aa044b001a550173f56d9813f845cbe8143401`.
Fresh `npm run lint` exits 0 with 0 errors and the same 15 warnings. The
historical execution source remains `d1f3506`; the successor source was not
executed and does not alter any proof, hypothesis, cleanup, or persistence
fact.

## Exact candidate table inputs

### `AuthProviderUser`

| Column | PostgreSQL type | Null | Default |
| --- | --- | --- | --- |
| `id` | `TEXT` | no | none |
| `name` | `TEXT` | no | none |
| `email` | `TEXT` | no | none |
| `emailVerified` | `BOOLEAN` | no | `false` |
| `image` | `TEXT` | yes | none |
| `createdAt` | `TIMESTAMP(3)` | no | `CURRENT_TIMESTAMP` |
| `updatedAt` | `TIMESTAMP(3)` | no | none |

- Primary key: `AuthProviderUser_pkey` on (`id`).
- Unique indexes: `AuthProviderUser_email_key` on (`email`).
- Non-unique indexes, foreign keys, CHECK constraints, partial indexes: none.
- `AuthProviderUser.email` is the exact shared normalized account identifier and
  unique lookup value; the `emailVerified` state must be true for sign-in.
  Creation or email mutation must pass through the proven Better Auth-backed
  boundary while satisfying the owner-lock and credential-token invalidation
  acceptance inputs below.
- Forbidden additions: canonical `User.id`, canonical role, permission,
  organization, membership, or entitlement snapshots.

### `AuthProviderSession`

| Column | PostgreSQL type | Null | Default |
| --- | --- | --- | --- |
| `id` | `TEXT` | no | none |
| `expiresAt` | `TIMESTAMP(3)` | no | none |
| `token` | `TEXT` | no | none |
| `createdAt` | `TIMESTAMP(3)` | no | `CURRENT_TIMESTAMP` |
| `updatedAt` | `TIMESTAMP(3)` | no | none |
| `ipAddress` | `TEXT` | yes | none |
| `userAgent` | `TEXT` | yes | none |
| `userId` | `TEXT` | no | none |
| `authenticatedAt` | `TIMESTAMP(3)` | no | none |
| `lastRefreshAt` | `TIMESTAMP(3)` | no | none |
| `selectedOrganizationId` | `UUID` | yes | none |

- Primary key: `AuthProviderSession_pkey` on (`id`).
- Unique indexes: `AuthProviderSession_token_key` on (`token`).
- Non-unique indexes: `AuthProviderSession_userId_idx` on (`userId`),
  `AuthProviderSession_lastRefreshAt_idx` on (`lastRefreshAt`), and
  `AuthProviderSession_selectedOrganizationId_idx` on (`selectedOrganizationId`).
- Foreign keys: `AuthProviderSession_userId_fkey` references
  `AuthProviderUser(id)` with `ON DELETE CASCADE ON UPDATE CASCADE`;
  `AuthProviderSession_selectedOrganizationId_fkey` references
  `Organization(id)` with `ON DELETE SET NULL ON UPDATE CASCADE`.
- CHECK constraints:
  - `ck_auth_provider_session_absolute_expiry`: `expiresAt > authenticatedAt
    AND expiresAt <= authenticatedAt + INTERVAL '30 days'`.
  - `ck_auth_provider_session_inactivity_expiry`: `expiresAt > lastRefreshAt AND
    expiresAt <= lastRefreshAt + INTERVAL '7 days'`.
  - `ck_auth_provider_session_refresh_order`: `authenticatedAt <= lastRefreshAt
    AND lastRefreshAt <= updatedAt`.
  - `ck_auth_provider_session_authenticated_origin`: `authenticatedAt <=
    createdAt`.
- Partial indexes: none.
- `authenticatedAt` is set from the successful full-authentication instant and
  is preserved by every refresh, opaque-token rotation, and authenticated
  password-change path. `lastRefreshAt` starts at that same server-captured
  instant and advances only on a successful proven rolling refresh. General
  writes, including organization selection and authenticated password change,
  may advance `updatedAt` but never advance `lastRefreshAt`.
  `selectedOrganizationId` is cleared when the session expires or is revoked and
  whenever server-side eligibility revalidation fails.
- Session lookup uses the unique `token`, then requires the linked provider user
  and validates `authenticatedAt`, `lastRefreshAt`, and `expiresAt` before any
  `AuthIdentity` or organization resolution. Proof must show Better Auth-backed
  session creation places the opaque token and every server-owned timestamp in
  the same rollback domain as the successful sign-in state transition.
- Forbidden additions: role, permission, membership-status, organization-status,
  entitlement, billing, or platform-administration snapshots.

This is the retained candidate organization-selection shape. A nullable relation
on the authoritative database session is sufficient: the browser still receives
only the opaque session credential, while PostgreSQL type and foreign-key checks
reject nonexistent selections. A separate `AuthSessionSelection` table would
add another write, join, uniqueness constraint, lifecycle cleanup path, and exit
cost without creating a security boundary. The stored UUID remains only a
selection hint; every request and switch revalidates membership and organization
status and every business mutation revalidates authorization transactionally.

The future compatibility configuration MUST declare public signup disabled even
though no native handler is exported:

```ts
emailAndPassword: {
  enabled: true,
  disableSignUp: true,
  requireEmailVerification: true,
  minPasswordLength: 1,
  maxPasswordLength: 256,
  password: {
    hash: hashPreparedNfcPassword,
    verify: verifyPreparedNfcPassword,
  },
}
```

The reviewed session compatibility configuration MUST declare exactly:

```ts
session: {
  expiresIn: 60 * 60 * 24 * 7,
  updateAge: 60 * 60 * 24,
  disableSessionRefresh: true,
  cookieCache: { enabled: false },
  additionalFields: {
    authenticatedAt: {
      type: "date",
      required: true,
      input: false,
      defaultValue: () => new Date(),
    },
    lastRefreshAt: {
      type: "date",
      required: true,
      input: false,
      defaultValue: () => new Date(),
    },
    selectedOrganizationId: {
      type: "string",
      required: false,
      input: false,
    },
  },
}
```

`input` defaults to true and a function `defaultValue` is an application create
default, not a PostgreSQL default
(`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/@better-auth/core/dist/db/type.d.mts:31-53`).
The input parser rejects a supplied field only when `input: false`, otherwise it
copies it, and applies create defaults
(`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/db/schema.mjs:59-108`).
The generic `/update-session` endpoint passes parsed additional fields directly
to `internalAdapter.updateSession`
(`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/update-session.mjs:31-54`).
Therefore all three additional fields are `input: false`: clients cannot set
them through create input or `/update-session`. Full-authentication creation
captures one server timestamp and explicitly supplies it as both
`authenticatedAt` and `lastRefreshAt`; the defaults are fail-closed coverage for
an ordinary internal creation path, not permission to use different semantic
anchors. The proven Better Auth-backed boundary must supply and preserve both
stored values on every replacement path. For compatibility evidence only,
Better Auth's internal create path obtains additional-field defaults before
constructing the session record and includes them in the create payload; its
server-only `overrideAll` branch can explicitly replace a default
(`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/db/internal-adapter.mjs:248-320`).
No rotation implementation is selected. The proof must establish a Better
Auth-backed path that preserves the anchors, does not expose an override, and
does not rely on parsed client input.

Only a dedicated CSRF-protected organization-selection mutation may write
`selectedOrganizationId`. It accepts an untrusted UUID, loads the current
database session, resolves `AuthIdentity` to canonical `User`, locks/revalidates
`MembershipStatus.ACTIVE` plus `OrganizationStatus.ACTIVE`, and conditionally
updates by current session id and token in one transaction. Zero updated rows,
invalid membership, inactive organization, or stale session clears selection
and returns the safe no-access state. No generic provider update endpoint,
client session input, or cookie payload may select an organization. The
organization-selection mutation updates `updatedAt` to `now` as a general write
but MUST NOT advance `lastRefreshAt` or modify `expiresAt` or `authenticatedAt`;
repeated organization switches therefore cannot postpone refresh or expiry.

### Session enforcement and reviewed infrastructure boundary

Every authenticated request uses the database row and performs these checks
before identity or organization resolution:

1. Reject, delete the row, and expire the cookie when `now >= expiresAt` or
   `now >= authenticatedAt + 30 days`. This is the request-time 30-day absolute
   check and remains mandatory even with the database CHECK.
2. The 7-day inactivity expiry is `expiresAt`; it is never later than
   `min(lastRefreshAt + 7 days, authenticatedAt + 30 days)`.
3. A 24-hour refresh is due when `now >= lastRefreshAt + 24 hours`. Refresh uses
   `newExpiresAt = min(now + 7 days, authenticatedAt + 30 days)` and never
   modifies `authenticatedAt` or authorization state. A successful refresh sets
   `lastRefreshAt = now` and `updatedAt = now` to the same transaction timestamp.
4. Refresh performs atomic opaque-token rotation with one conditional database
   update: match session id, old token, and unexpired absolute/inactivity state;
   set a newly generated opaque token, `expiresAt`, `lastRefreshAt`, and
   `updatedAt`; preserve `authenticatedAt` and `selectedOrganizationId`;
   `RETURNING` supplies the only token eligible for `Set-Cookie`. The old token
   is invalid at commit. The response emits the cookie only after a successful
   commit with `Max-Age`
   capped to `newExpiresAt`; a commit/cookie-delivery interruption fails closed
   to reauthentication rather than restoring the old token. A zero-row race
   clears the presented cookie and requires reauthentication.

Better Auth 1.7.1 native refresh updates only `expiresAt`/`updatedAt` and retains
the same token
(`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/session.mjs:171-207`),
so it does not meet the absolute-cap or token-rotation policy. Native
authenticated password change with `revokeOtherSessions` deletes all sessions
and creates a fresh session
(`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/update-user.mjs:180-189`),
which would reset a defaulted `authenticatedAt`. Both native paths are rejected.
A provider-neutral Passvero session facade backed by the proven Better Auth
transaction boundary is REQUIRED before Stage 13E and must be the only session
create/read/refresh/rotate/revoke/password-change entry point. The concrete
Better Auth or reviewed-adapter mechanism remains unselected pending proof.

Better Auth 1.7.1 declares `disableSessionRefresh?: boolean`, default false, and
documents that true prevents refresh regardless of `updateAge`
(`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/@better-auth/core/dist/types/init-options.d.mts:905-918`).
Its get-session route incorporates that option into `needsRefresh` before the
same-token update
(`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/session.mjs:171-207`).
The required configuration sets `disableSessionRefresh: true` as defense in
depth. In addition, the native `/get-session` route is not exposed by the
application router and is unreachable from clients; request middleware and
application endpoints call only the reviewed provider-neutral session facade for
authoritative reads and refresh. Per-request `disableRefresh` query input is not
a security control, and no native route may be an alternate session-read path.

Authenticated password change verifies the current password, updates the hash,
deletes every other session row, and conditionally rotates the current row/token
in one transaction while preserving its `authenticatedAt`, `lastRefreshAt`, and
`expiresAt`; it does not call the native delete-and-create path and does not count
password change as rolling refresh. Password reset deletes every session row for
the provider user in the same transaction as token consumption and password
update, then expires the presented cookie and does not sign in. Revoke-all
likewise must delete every session row for the provider user and expire the
cookie. Better
Auth's native revoke-all endpoint does call `deleteUserSessions`, but does not
establish this service's cookie, absolute-age, or transaction rules
(`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/session.mjs:411-441`),
so proof must supply equivalent behavior through the Better Auth-backed boundary.
Single revoke deletes the exact token row.
There are no soft-revoked session rows.

An authorized cleanup job deletes rows where `expiresAt <= statement_timestamp()`
or `authenticatedAt + INTERVAL '30 days' <= statement_timestamp()` in bounded
batches at least hourly. Reads still enforce both deadlines independently of
cleanup. Cleanup never extends, rotates, or reconstructs a session.

### `AuthProviderAccount`

| Column | PostgreSQL type | Null | Default |
| --- | --- | --- | --- |
| `id` | `TEXT` | no | none |
| `issuer` | `TEXT` | no | none |
| `accountId` | `TEXT` | no | none |
| `providerId` | `TEXT` | no | none |
| `userId` | `TEXT` | no | none |
| `accessToken` | `TEXT` | yes | none |
| `refreshToken` | `TEXT` | yes | none |
| `idToken` | `TEXT` | yes | none |
| `accessTokenExpiresAt` | `TIMESTAMP(3)` | yes | none |
| `refreshTokenExpiresAt` | `TIMESTAMP(3)` | yes | none |
| `scope` | `TEXT` | yes | none |
| `password` | `TEXT` | yes | none |
| `createdAt` | `TIMESTAMP(3)` | no | `CURRENT_TIMESTAMP` |
| `updatedAt` | `TIMESTAMP(3)` | no | none |

- Primary key: `AuthProviderAccount_pkey` on (`id`).
- Unique indexes: `AuthProviderAccount_issuer_accountId_uidx` on (`issuer`,
  `accountId`).
- Non-unique indexes: `AuthProviderAccount_userId_idx` on (`userId`).
- Foreign key: `AuthProviderAccount_userId_fkey` references
  `AuthProviderUser(id)` with `ON DELETE CASCADE ON UPDATE CASCADE`.
- CHECK constraints and partial indexes: none.
- Candidate package evidence indicates a credential row with `providerId = "credential"`,
  `issuer = "local:credential"`, `accountId = userId`, and a non-null `password`.
  `accessToken`, `refreshToken`, `idToken`, their expiry fields, and `scope` are
  null. A credential lookup matches all four of `userId`, `providerId`, `issuer`,
  and `accountId`; a match by email, `providerId` alone, or `accountId` alone is
  forbidden. The composite unique (`issuer`, `accountId`) constraint is the
  database collision backstop.
- These conventions match pinned 1.7.1 evidence:
  `createLocalAccountIssuer("credential")` returns `local:credential`
  (`@better-auth/core/dist/db/schema/account.mjs:38-41`), native sign-in requires
  `providerId`, issuer, and `accountId = AuthProviderUser.id`
  (`better-auth/dist/api/routes/sign-in.mjs:318-319`), and the internal credential
  lookup uses the same four fields
  (`better-auth/dist/db/internal-adapter.mjs:625-675`). The evidence fixes
  candidate compatibility values, but the proof must obtain the exact convention
  from Better Auth or the reviewed adapter rather than reproduce it independently.
- Forbidden additions: canonical role, permission, organization, membership, or
  entitlement snapshots. Credential fields must never be logged.

### `AuthProviderVerification`

| Column | PostgreSQL type | Null | Default |
| --- | --- | --- | --- |
| `id` | `TEXT` | no | none |
| `identifier` | `TEXT` | no | none |
| `value` | `TEXT` | no | none |
| `expiresAt` | `TIMESTAMP(3)` | no | none |
| `createdAt` | `TIMESTAMP(3)` | no | `CURRENT_TIMESTAMP` |
| `updatedAt` | `TIMESTAMP(3)` | no | none |

- Primary key: `AuthProviderVerification_pkey` on (`id`).
- Unique indexes, foreign keys, CHECK constraints, partial indexes: none.
- Non-unique indexes: `AuthProviderVerification_identifier_idx` on
  (`identifier`).
- This generated table is retained as a candidate provider table. The proof must
  reconcile Better Auth-authoritative verification and recovery with the
  `AuthCredentialToken` single-use, superseding, digest-only requirements. A raw
  or encoded capability must not be persisted here; no storage-adapter or
  migration decision is approved by this candidate.

### `AuthIdentity`

| Column | PostgreSQL type | Null | Default |
| --- | --- | --- | --- |
| `id` | `UUID` | no | none; Prisma `uuid()` |
| `provider` | `TEXT` | no | none |
| `providerSubject` | `TEXT` | no | none |
| `userId` | `UUID` | no | none |
| `createdAt` | `TIMESTAMP(3)` | no | `CURRENT_TIMESTAMP` |
| `updatedAt` | `TIMESTAMP(3)` | no | none |

- Primary key: `AuthIdentity_pkey` on (`id`).
- Unique indexes: `AuthIdentity_provider_providerSubject_key` on (`provider`,
  `providerSubject`).
- Non-unique indexes: `AuthIdentity_userId_idx` on (`userId`).
- Foreign key: `AuthIdentity_userId_fkey` references `User(id)` with
  `ON DELETE RESTRICT ON UPDATE CASCADE`.
- CHECK constraints and partial indexes: none.
- The candidate binding requires `AuthIdentity.provider = "BETTER_AUTH"` and
  `providerSubject = AuthProviderUser.id`. Resolution matches the unique
  (`provider`, `providerSubject`) pair, then returns only canonical `User.id` to
  application/domain code.
- Forbidden columns: email and provider access, refresh, identity, session,
  verification, reset, or activation token material.

### `AuthCredentialToken`

| Column | PostgreSQL type | Null | Default |
| --- | --- | --- | --- |
| `id` | `UUID` | no | none; Prisma `uuid()` |
| `providerUserId` | `TEXT` | no | none |
| `purpose` | `AuthCredentialTokenPurpose` | no | none |
| `tokenDigest` | `VARCHAR(43)` | no | none |
| `targetEmailDigest` | `VARCHAR(43)` | no | none |
| `expiresAt` | `TIMESTAMP(3)` | no | none |
| `consumedAt` | `TIMESTAMP(3)` | yes | none |
| `invalidatedAt` | `TIMESTAMP(3)` | yes | none |
| `createdAt` | `TIMESTAMP(3)` | no | none |

- Primary key: `AuthCredentialToken_pkey` on (`id`).
- Unique indexes: `AuthCredentialToken_tokenDigest_key` on (`tokenDigest`).
- Non-unique indexes: `AuthCredentialToken_providerUserId_purpose_idx` on
  (`providerUserId`, `purpose`) and `AuthCredentialToken_expiresAt_idx` on
  (`expiresAt`).
- Foreign key: `AuthCredentialToken_providerUserId_fkey` references
  `AuthProviderUser(id)` with `ON DELETE CASCADE ON UPDATE CASCADE`.
- Partial unique index:
  `ux_auth_credential_token_one_active_per_provider_user_purpose` on
  (`providerUserId`, `purpose`) where `consumedAt IS NULL AND invalidatedAt IS NULL`.
- CHECK constraints:
  - `ck_auth_credential_token_digest`: `tokenDigest` matches
    `^[A-Za-z0-9_-]{43}$`.
  - `ck_auth_credential_token_target_email_digest`: `targetEmailDigest` matches
    `^[A-Za-z0-9_-]{43}$`.
  - `ck_auth_credential_token_fixed_lifetime` uses this exact predicate:

    ```sql
    "expiresAt" = "createdAt" + CASE "purpose"
      WHEN 'EMAIL_VERIFICATION'::"AuthCredentialTokenPurpose" THEN INTERVAL '24 hours'
      WHEN 'PASSWORD_RESET'::"AuthCredentialTokenPurpose" THEN INTERVAL '30 minutes'
    END
    ```

    The service reads one trusted transaction timestamp and derives both
    `createdAt` and `expiresAt` from it; neither field uses a caller timestamp or
    independent clock read. Both values are explicitly inserted. The CHECK makes
    24 hours for `EMAIL_VERIFICATION` and 30 minutes for `PASSWORD_RESET`
    purpose-dependent database invariants, not application-only policy.
  - `ck_auth_credential_token_terminal_state`: `consumedAt` and
    `invalidatedAt` are not both non-null.
  - `ck_auth_credential_token_consumed_time`: `consumedAt IS NULL OR
    (consumedAt >= createdAt AND consumedAt < expiresAt)`.
  - `ck_auth_credential_token_invalidated_time`: `invalidatedAt IS NULL OR
    invalidatedAt >= createdAt`.
- Forbidden columns: plaintext/encoded token, plaintext target email, password,
  IP address, network, user agent, session credential, role, or permission.

### `AccountActivation`

| Column | PostgreSQL type | Null | Default |
| --- | --- | --- | --- |
| `id` | `UUID` | no | none; Prisma `uuid()` |
| `userId` | `UUID` | no | none |
| `tokenDigest` | `VARCHAR(43)` | no | none |
| `intendedEmailDigest` | `VARCHAR(43)` | no | none |
| `expiresAt` | `TIMESTAMP(3)` | no | none |
| `consumedAt` | `TIMESTAMP(3)` | yes | none |
| `invalidatedAt` | `TIMESTAMP(3)` | yes | none |
| `createdAt` | `TIMESTAMP(3)` | no | `CURRENT_TIMESTAMP` |

- Primary key: `AccountActivation_pkey` on (`id`).
- Unique indexes: `AccountActivation_tokenDigest_key` on (`tokenDigest`).
- Non-unique indexes: `AccountActivation_userId_idx` on (`userId`) and
  `AccountActivation_expiresAt_idx` on (`expiresAt`).
- Foreign key: `AccountActivation_userId_fkey` references `User(id)` with
  `ON DELETE RESTRICT ON UPDATE CASCADE`.
- Partial unique index: `ux_account_activation_one_active_per_user` on
  (`userId`) where `consumedAt IS NULL AND invalidatedAt IS NULL`.
- CHECK constraints:
  - `ck_account_activation_digest`: `tokenDigest` matches
    `^[A-Za-z0-9_-]{43}$`.
  - `ck_account_activation_intended_email_digest`: `intendedEmailDigest`
    matches `^[A-Za-z0-9_-]{43}$`.
  - `ck_account_activation_expiry`: `expiresAt > createdAt`.
  - `ck_account_activation_terminal_state`: `consumedAt` and `invalidatedAt`
    are not both non-null.
  - `ck_account_activation_consumed_time`: `consumedAt IS NULL OR
    (consumedAt >= createdAt AND consumedAt < expiresAt)`.
  - `ck_account_activation_invalidated_time`: `invalidatedAt IS NULL OR
    invalidatedAt >= createdAt`.
- Forbidden columns: plaintext/encoded token, email, password, IP address,
  network, user agent, session credential, role, or permission.

### `AuthAbuseBucket`

| Column | PostgreSQL type | Null | Default |
| --- | --- | --- | --- |
| `id` | `UUID` | no | none; Prisma `uuid()` |
| `dimension` | `AuthAbuseDimension` | no | none |
| `keyDigest` | `VARCHAR(43)` | no | none |
| `attemptCount` | `INTEGER` | no | `0` |
| `failureCount` | `INTEGER` | no | `0` |
| `backoffLevel` | `INTEGER` | no | `0` |
| `windowStartedAt` | `TIMESTAMP(3)` | no | none |
| `lastFailureAt` | `TIMESTAMP(3)` | yes | none |
| `backoffUpdatedAt` | `TIMESTAMP(3)` | no | none |
| `blockedUntil` | `TIMESTAMP(3)` | yes | none |
| `expiresAt` | `TIMESTAMP(3)` | no | none |
| `updatedAt` | `TIMESTAMP(3)` | no | none |

- Primary key: `AuthAbuseBucket_pkey` on (`id`).
- Unique indexes: `AuthAbuseBucket_keyDigest_key` on (`keyDigest`).
- Non-unique indexes: `AuthAbuseBucket_dimension_blockedUntil_idx` on
  (`dimension`, `blockedUntil`) and `AuthAbuseBucket_expiresAt_idx` on
  (`expiresAt`).
- Foreign keys and partial indexes: none.
- CHECK constraints:
  - `ck_auth_abuse_bucket_digest`: `keyDigest` matches
    `^[A-Za-z0-9_-]{43}$`.
  - `ck_auth_abuse_bucket_attempt_count`: `attemptCount >= 0`.
  - `ck_auth_abuse_bucket_failure_count`: `failureCount >= 0`.
  - `ck_auth_abuse_bucket_backoff_level`: `backoffLevel BETWEEN 0 AND 12`.
  - `ck_auth_abuse_bucket_window`: `windowStartedAt <= updatedAt`.
  - `ck_auth_abuse_bucket_last_failure`: `lastFailureAt IS NULL OR
    lastFailureAt <= updatedAt`.
  - `ck_auth_abuse_bucket_backoff_time`: `backoffUpdatedAt <= updatedAt`.
  - `ck_auth_abuse_bucket_failure_decay_order`: `lastFailureAt IS NULL OR
    lastFailureAt <= backoffUpdatedAt`.
  - `ck_auth_abuse_bucket_block_window`: `blockedUntil IS NULL OR
    blockedUntil <= expiresAt`.
  - `ck_auth_abuse_bucket_retention`: `expiresAt > updatedAt AND expiresAt <=
    updatedAt + INTERVAL '30 days'`.
- Plaintext email, IP address, network, user agent, password, and token columns: FORBIDDEN.
- Other forbidden columns: raw digest input, forwarded headers, Turnstile
  capability, session credential, canonical user ID, provider user ID, role,
  permission, membership, organization, or entitlement.

## Digest and allowed-dimension contract

Every emailed capability is generated as exactly 32 CSPRNG bytes from
`crypto.randomBytes(32)` and encoded as a 43-character canonical unpadded
base64url string. Presentation strictly decodes the string to exactly 32 bytes
and re-encodes it to require byte-for-byte canonical form before computing a
digest. Padded, noncanonical, wrong-alphabet, wrong-length, or wrong-decoded-size
input receives the same generic invalid-token result before database lookup.

Every `tokenDigest`, `targetEmailDigest`, `intendedEmailDigest`, and `keyDigest`
is the 43-character canonical unpadded base64url encoding of HMAC-SHA-256 output.
Messages use an unambiguous length-prefixed binary encoding; concatenated or
delimiter-only encodings are forbidden. The exact initial namespaces are:

- `AuthCredentialToken.tokenDigest`: literal
  `passvero-auth-credential-capability`, version `v1`, token purpose, then the
  decoded 32 capability bytes.
- `AuthCredentialToken.targetEmailDigest`: literal
  `passvero-auth-credential-target-email`, version `v1`, token purpose, then the
  normalized current `AuthProviderUser.email` UTF-8 bytes.
- `AccountActivation.tokenDigest`: literal `passvero-auth-activation-capability`,
  version `v1`, then the decoded 32 capability bytes.
- `AccountActivation.intendedEmailDigest`: literal
  `passvero-auth-activation-target-email`, version `v1`, then the normalized
  canonical email UTF-8 bytes.
- `AuthAbuseBucket.keyDigest`: the abuse namespace and components below.

The credential capability key, credential target-email key, activation
capability key, activation target-email key, abuse key, and Better Auth secret
are all distinct server-side secrets. No key or key identifier persists in these
tables. Initial release accepts only key/message version `v1`. Key rotation must
first lock affected owners and invalidate all active credential tokens and
activations before the v1 key is removed; because the maximum lifetime is 24
hours, old terminal rows need no verification key. Silent multi-key fallback or
reinterpretation of an existing 43-character digest is forbidden. Plain
SHA-256 is forbidden for capabilities and enumerable email/network input.
Digest equality is the only database lookup; raw capabilities, normalized email,
and raw abuse-key input are never persisted or logged.

Raw capability delivery uses the configured fixed HTTPS origin only. The
capability is placed in a URL fragment, which is not sent in the landing-page
HTTP request; the token page sets `Referrer-Policy: no-referrer`, permits no
third-party resources, posts the capability only in the same-origin POST body,
and removes the fragment immediately with `history.replaceState`. The raw
capability and its digest MUST NOT appear in access/application logs, protected
telemetry, analytics, error messages, traces, metrics labels, queues, referrers,
or response bodies. Ingress and application logging tests must prove full URL,
query, fragment-derived body fields, authorization/cookie values, and known
digest fields are redacted before Stage 13E.

The abuse HMAC message is an unambiguous length-prefixed encoding of literal
namespace `passvero-auth-abuse`, version `v1`, enum dimension, allowlisted
endpoint code, and only these dimension-specific canonical components:

- `TRUSTED_NETWORK`: the normalized client network derived by the trusted-proxy
  algorithm below.
- `ACCOUNT_IDENTIFIER`: the normalized attempted account identifier, whether or
  not a provider/canonical account exists.
- `ACCOUNT_AND_TRUSTED_NETWORK`: both normalized values in account-then-network
  order.
- `GLOBAL_ENDPOINT`: the endpoint code only.

No other dimension or component is permitted. A digest-key version change is a
reviewed rotation that lets old buckets expire; it cannot silently reinterpret
an existing digest.

### Endpoint/dimension applicability matrix

`YES` means the bucket is required before the protected action. `POST-LOOKUP`
means a token-only request first applies network/global buckets, then applies the
account buckets only after a digest lookup yields a subject, still before token
consumption or protected state mutation.

| Endpoint code | `TRUSTED_NETWORK` | `ACCOUNT_IDENTIFIER` | `ACCOUNT_AND_TRUSTED_NETWORK` | `GLOBAL_ENDPOINT` |
| --- | --- | --- | --- | --- |
| `SIGN_IN_PASSWORD` | YES | YES | YES | YES |
| `SEND_EMAIL_VERIFICATION` | YES | YES | YES | YES |
| `CONSUME_EMAIL_VERIFICATION` | YES | POST-LOOKUP | POST-LOOKUP | YES |
| `REQUEST_PASSWORD_RESET` | YES | YES | YES | YES |
| `CONSUME_PASSWORD_RESET` | YES | POST-LOOKUP | POST-LOOKUP | YES |
| `ISSUE_ACCOUNT_ACTIVATION` | YES | YES | YES | YES |
| `CONSUME_ACCOUNT_ACTIVATION` | YES | POST-LOOKUP | POST-LOOKUP | YES |
| `CHANGE_PASSWORD` | YES | YES | YES | YES |

For an email/account request where no account exists, account and combined
buckets still use the normalized attempted identifier; database existence never
changes applicability or response shape. A token-only invalid or unknown token
has no account subject, so only `TRUSTED_NETWORK` and `GLOBAL_ENDPOINT` apply.
When a token digest resolves, email verification/reset derive the account value
from the normalized current `AuthProviderUser.email`. For
`CONSUME_ACCOUNT_ACTIVATION`, derive `ACCOUNT_IDENTIFIER` from the normalized
current canonical `User.email`, not `intendedEmailDigest`; the intended-email
digest proves capability binding but is not an abuse-key input and cannot
fragment evidence from sign-in, verification, reset, or activation transports.
The combined bucket uses that same normalized account value plus the normalized
network. Then the two `POST-LOOKUP` buckets are mandatory before the conditional
consume. Thus "all four" means all four applicable phases for a resolved
subject, not four fabricated buckets for an unknown token.

For identifier-carrying activation issuance, the account component is the same
normalized requested canonical account identifier used for lookup, even when no
canonical account exists; a missing account changes neither the two account
buckets nor the response shape. For an unknown activation token, there is no
owner/email source, so only the pre-lookup network/global phase is possible.

### Trusted-proxy selection and network normalization

Production must explicitly select exactly one reviewed mode:

- `DIRECT`: forwarded headers are ignored and the authenticated transport peer
  address is the client.
- `TRUSTED_PROXY_CHAIN`: a non-empty CIDR allowlist, positive maximum hop count,
  and exactly one header source are configured. The transport peer must match a
  trusted proxy CIDR. Parse the configured chain as IP literals only, append the
  transport peer, and walk right-to-left, skipping trusted proxy addresses; the
  first address outside the allowlist is the rightmost untrusted address and is
  the client. Values to its left are untrusted claims and ignored.

Missing mode, missing/invalid CIDRs, zero/negative or exceeded hop count,
untrusted transport peer in proxy mode, missing chain, zone identifier,
host/port syntax, empty element, non-IP element, or a chain containing only
trusted proxies fails closed before authentication with the generic response and
protected telemetry. `Forwarded`, `X-Forwarded-For`, `X-Real-IP`, and
provider-specific headers are never merged or silently substituted.

Normalize the selected address as follows:

1. Parse to 128-bit binary. Convert IPv4-mapped IPv6 (`::ffff:0:0/96`) to IPv4.
2. IPv4 buckets zero the low 8 bits and serialize canonical dotted decimal `/24`.
3. Native IPv6 buckets zero the low 72 bits and serialize RFC 5952 lowercase,
   compressed hexadecimal `/56`.

Required vectors:

| Input | Canonical network |
| --- | --- |
| `203.0.113.197` | `203.0.113.0/24` |
| `::ffff:203.0.113.197` (IPv4-mapped IPv6) | `203.0.113.0/24` |
| `2001:0db8:abcd:1234:5678:90ab:cdef:0123` | `2001:db8:abcd:1200::/56` |

### Account-identifier normalization

Strictly decode a string, reject NUL/control characters or more than 254 UTF-8
bytes, trim Unicode White_Space at both ends, normalize to NFC, and apply Unicode
default lowercase. Split only when there is exactly one `@`; for syntactically
valid input, convert the domain to its lowercase IDNA A-label form. This complete
canonical value is used for provider lookup, canonical-email
persistence/equality, activation binding, and abuse digests. Invalid-but-bounded
input that lacks exactly one `@` or has a domain that cannot be IDNA-converted is
not used for lookup or persistence, but its already trimmed/NFC/lowercased,
length-prefixed byte string is still the account component for abuse HMAC. It
receives the generic response and is never replaced by a shared sentinel that
attackers could use to evade per-input state.

Required vectors:

| Input | Canonical account identifier |
| --- | --- |
| ` User@Example.COM ` | `user@example.com` |
| `u\u0308ser@EXAMPLE.com` | `üser@example.com` |

## Atomic issue, consume, and abuse transitions

### Verification, reset, and activation

Issuance performs predecessor invalidation and insertion in one transaction:

1. Lock the owning `AuthProviderUser` row (`AuthCredentialToken`) or canonical
   `User` row (`AccountActivation`) with `SELECT ... FOR UPDATE`.
2. For a credential token, normalize the locked current
   `AuthProviderUser.email` using the exact account-identifier function and
   compute `targetEmailDigest` with the dedicated credential target-email key,
   v1 namespace, and token purpose. The message purpose prevents a verification
   digest from being reused as a reset digest. For activation, normalize the
   locked canonical `User.email` using the exact
   account-identifier normalization below and compute `intendedEmailDigest` with
   the dedicated activation-email HMAC key. The activation email is addressed
   from that same locked canonical value; operator-supplied email is not trusted.
3. Read one trusted transaction timestamp `issuedAt`. For
   `AuthCredentialToken`, explicitly set `createdAt = issuedAt` and derive
   `expiresAt = issuedAt + 24 hours` for `EMAIL_VERIFICATION` or `issuedAt + 30
   minutes` for `PASSWORD_RESET`. No request time, JavaScript clock, database
   default, or second timestamp read may supply either field.
4. Set `invalidatedAt = issuedAt` on every matching row for that
   owner and purpose whose `consumedAt` and `invalidatedAt` are null.
5. Insert exactly one fresh digest-only row. The partial unique index is the
   database backstop. No email is used as an ownership or lookup key.

Concurrent issuance serializes on the owner row. The later transaction
invalidates the earlier token before returning, so at most one issued token is
active. Expired rows are invalidated by the same issuance update because a
partial-index predicate cannot safely depend on wall-clock time.

After staged abuse admission, consumption locks the owner row first, revalidates
the non-consuming digest lookup, and performs one atomic conditional update,
never read-then-update for token state. For `AuthCredentialToken`, it locks the
current `AuthProviderUser`, normalizes its current email, recomputes the
purpose-bound `targetEmailDigest`, decodes both 43-character digests to equal
32-byte buffers, and compares only with `crypto.timingSafeEqual`. A target-email
mismatch atomically sets `invalidatedAt` on the still-active token and returns the
same generic invalid-token result; it never consumes or applies the protected
state transition.

```sql
UPDATE "<token table>"
SET "consumedAt" = statement_timestamp()
WHERE "tokenDigest" = $1
  AND "consumedAt" IS NULL
  AND "invalidatedAt" IS NULL
  AND "expiresAt" > statement_timestamp()
RETURNING "id", "userId or providerUserId", "purpose";
```

Exactly one concurrent caller can receive a row; all others receive zero rows
and fail with the same generic invalid-token result. The prior lookup never
authorizes consumption; only this update does. Email verification plus
the exact `EMAIL_VERIFICATION` transition from `emailVerified = false` to
`emailVerified = true`, password replacement plus all-session revocation, or
activation plus credential creation and `AuthIdentity` binding must occur in the
same transaction as this update. A verification token presented after another
transaction has already verified the owner is invalidated and fails generically;
it is not treated as a reusable idempotency token. Therefore one concurrent
caller can commit the protected transition and every loser observes zero rows or
the now-terminal owner state. A transaction failure rolls every change back.
Activation never creates a session; normal sign-in follows successful activation.

Activation consumption locks the canonical `User` owner first, revalidates the
looked-up `AccountActivation`, re-normalizes the current canonical email,
recomputes its keyed digest, and uses
constant-time equality against `intendedEmailDigest` before the conditional
consume. A mismatch atomically sets `invalidatedAt` and returns the generic
invalid-token result. Credential creation uses that locked canonical email, the
provider email must equal the same normalized value, and email ownership is
marked verified only as part of the successful activation transaction.

Every canonical email mutation first locks the canonical `User` row and
invalidates every active activation (`consumedAt IS NULL AND invalidatedAt IS
NULL`) in the same transaction before changing `User.email`. It also follows the
separately reviewed provider-email change/verification path; unmediated email
updates and case/normalization-only bypasses are forbidden. Consequently an
activation issued for an older canonical email cannot bind credentials after an
email change, including under concurrent issuance, consumption, or mutation.

Every provider-email mutation locks the owning `AuthProviderUser` row, invalidates
every active `EMAIL_VERIFICATION` and `PASSWORD_RESET` credential token for that
owner before the email mutation writes the newly normalized unique email, and sets
`emailVerified = false`. If the flow issues a replacement verification
capability, it derives its target digest from that newly stored locked email and
inserts it before commit. Unmediated provider-email updates, case/normalization-only
bypasses, and mutations that leave an old reset token active are forbidden.
Provider-email mutation, token issuance, token consumption, and password reset
all use this same owner-first order, so concurrent operations cannot authorize an
old address after commit.

The selected lifetimes are 24 hours for `EMAIL_VERIFICATION`, 30 minutes for
`PASSWORD_RESET`, and 24 hours for `AccountActivation`. These match the approved
verification/recovery windows and give the email-bound activation capability no
longer life than verification. Consumed, invalidated, and expired token rows are
deleted no later than 30 days after their terminal timestamp or expiry.

### Candidate atomicity, ordering, cookie, and retry inputs

Direct Passvero provider-table writes are rejected. The Better Auth-backed proof
must demonstrate these outcomes without changing the frozen authority split:

- Controlled activation revalidates the locked canonical intended-email digest,
  creates the Better Auth credential/provider identity and the `AuthIdentity`
  binding atomically, consumes the activation in the same rollback domain, and
  creates no session.
- Password sign-in requires the verified normalized provider identity and the
  exact credential-row convention supplied by Better Auth or the reviewed
  adapter. Successful Better Auth proof establishes the database session, then
  resolves `AuthIdentity`; downstream code receives only canonical identity.
- Verification and reset satisfy the `AuthCredentialToken` digest-only,
  supersession, target-email binding, single-use, and session-revocation inputs
  while Better Auth remains authoritative for recovery and credentials.

The previously proposed cross-table order—canonical `User` when present,
`AuthProviderUser`, `AuthProviderAccount`, credential token or
`AccountActivation`, `AuthIdentity`, then `AuthProviderSession`—is an acceptance
input, not an authorized implementation. The proof must demonstrate that order
or an evidence-backed equivalent which prevents deadlocks and places abuse,
token, provider, canonical, identity, and session state in one rollback domain.

Session creation, refresh, rotation, password change, and sign-out may compute a
cookie value inside the transaction, but post-commit `Set-Cookie` delivery is
required and is never emitted before commit. A rollback emits no new cookie. An
ambiguous commit or post-commit delivery failure clears the presented credential
where a response is possible and requires reauthentication; it must not
reconstruct or reuse an old token.

The candidate retry acceptance input permits a maximum three total transaction
attempts (the initial attempt plus at most two retries) only for PostgreSQL
`40001` or `40P01`
reported as a known rolled-back Prisma `P2034`. Every retry opens a fresh
`Serializable` transaction, repeats owner/bucket revalidation, and obtains a new
trusted transaction timestamp. Unique conflicts, conditional zero-row results,
authentication failures, unknown errors, and an ambiguous commit MUST NOT be
retried. Exhaustion returns one generic transient authentication response and
protected token-free telemetry; it never exposes the retry count, account
existence, or conflicting table.

### Progressive abuse state

The fixed thresholds and windows are:

| Dimension | Threshold | Window | Counted event |
| --- | ---: | --- | --- |
| `TRUSTED_NETWORK` | 30 | 15 minutes | failed protected action |
| `ACCOUNT_IDENTIFIER` | 5 | 15 minutes | failed protected action |
| `ACCOUNT_AND_TRUSTED_NETWORK` | 5 | 15 minutes | failed protected action |
| `GLOBAL_ENDPOINT` | 100 | 1 minute | every admitted request |

Backoff is capped at level 12 and maps exactly as follows:

| Level | Block duration |
| ---: | ---: |
| 0 | 0 minutes |
| 1 | 1 minute |
| 2 | 2 minutes |
| 3 | 4 minutes |
| 4 | 8 minutes |
| 5 | 15 minutes |
| 6 | 30 minutes |
| 7 | 60 minutes |
| 8 | 120 minutes |
| 9 | 240 minutes |
| 10 | 480 minutes |
| 11 | 720 minutes |
| 12 | 1,440 minutes |

Risk-triggered Turnstile validation completes and fails closed before opening
the database transaction. No other network call occurs while bucket locks are
held. The protected local credential/token operation and every applicable abuse
transition then run in one PostgreSQL SERIALIZABLE transaction:

1. Use one transaction timestamp `now`. Upsert a missing bucket with its exact
   enum, `attemptCount = 0`, `failureCount = 0`, `backoffLevel = 0`,
   `windowStartedAt = now`, `backoffUpdatedAt = now`, null
   `lastFailureAt`/`blockedUntil`, `expiresAt = now + 30 days`, and
   `updatedAt = now`. A stored enum mismatch for a digest fails closed.
2. **Stage A** derives, upserts, and locks `GLOBAL_ENDPOINT` first and
   `TRUSTED_NETWORK` second, then performs their rollover, decay, block check,
   and admission. This phase always runs before any account or token existence
   lookup. Increment admitted `attemptCount` values with checked arithmetic. If
   the global increment would exceed 100 in its one-minute window, set
   `backoffLevel = LEAST(12, backoffLevel + 1)`, set
   `backoffUpdatedAt = now`, set the mapped finite `blockedUntil`, commit the
   abuse transition, and reject without a protected operation.
3. Identifier-carrying endpoints already have the normalized attempted account
   component and proceed to Stage B. For a token-only endpoint, a non-consuming
   token digest lookup occurs after Stage A admission and before Stage B. If a
   row resolves, lock its provider/canonical owner in the existing owner-first
   token lifecycle order, revalidate the token-to-owner relation, and normalize
   the current owner email as specified above. Do not lock or consume the token
   row during this lookup. If the token is absent, stale, or loses its owner,
   apply the failed protected-action transition to the network bucket, preserve
   the admitted global attempt, commit network/global state, and return the
   generic invalid-token response. An unknown token therefore records and
   commits its network/global evidence; it cannot bypass or fabricate
   account/composite state.
4. **Stage B** derives, upserts, and locks `ACCOUNT_IDENTIFIER` first and
   `ACCOUNT_AND_TRUSTED_NETWORK` second, then performs their rollover, decay,
   block checks, and admitted-attempt increments. It is mandatory for every
   identifier request and every token lookup with a revalidated owner. A Stage B
   block commits the already admitted Stage A evidence and returns generically
   without the protected operation.
5. The lock hierarchy is fixed by dimension, never digest byte order:
   `GLOBAL_ENDPOINT`, `TRUSTED_NETWORK`, optional owner for a token lookup,
   `ACCOUNT_IDENTIFIER`, then `ACCOUNT_AND_TRUSTED_NETWORK`. All handlers for an
   endpoint use this hierarchy. Because endpoint code is part of every digest,
   different endpoints share no abuse row; within an endpoint the global row
   serializes requests before any later shared row. Token lifecycle writes retain
   their separately specified owner-first order after abuse admission, so the
   staged design introduces no reverse bucket or owner/token lock order.
6. For every locked bucket, window rollover resets `attemptCount = 0`,
   `failureCount = 0`, and `windowStartedAt = now` only when its fixed window has
   elapsed. Decay is exact and idempotent:
   `elapsedPeriods = floor((now - backoffUpdatedAt) / 24 hours)`,
   `decaySteps = min(backoffLevel, elapsedPeriods)`, then
   `backoffLevel = backoffLevel - decaySteps` and
   `backoffUpdatedAt = backoffUpdatedAt + decaySteps * 24 hours`. Never lower
   below zero, discard the unconsumed time remainder, or use `updatedAt` or
   `lastFailureAt` as the decay anchor. Clear an elapsed `blockedUntil`; never
   shorten a live block.
7. Execute the local protected operation only after all applicable stages admit
   it. On failure, increment `failureCount` for `TRUSTED_NETWORK` and any
   applicable account/composite buckets. Every protected-action failure sets
   `lastFailureAt = now` and `backoffUpdatedAt = now` on each, restarting the
   24-hour failure-free decay interval. When a new failure count reaches its
   dimension threshold, reset `failureCount = 0`, increment `backoffLevel` with
   `LEAST(12, backoffLevel + 1)`, and set the mapped finite block. Global volume
   uses its attempt threshold instead of failure count; whenever
   `GLOBAL_ENDPOINT` raises its level it also sets `backoffUpdatedAt = now`. On
   success, do not decrement, reset, delete, or shorten a bucket.
8. Set `updatedAt = now` and `expiresAt = now + 30 days` on every changed row,
   return only the safe result, and commit. A token conditional consume that
   loses a race is a protected-action failure under the already derived buckets.
   A serialization/deadlock failure follows the maximum-three-attempt runner
   above; retry exhaustion is a generic transient denial. No other failure is
   retried automatically.

The transaction is the atomic admission/check/update transition: concurrent
requests sharing any digest serialize before the protected action, and no
credential/token state commits without its abuse transition. The global row is
per allowlisted endpoint code, so one endpoint cannot spend another's window.
There is no permanent lockout: every block is finite, decay is one level per
complete 24 hours without a failure and is anchored by `backoffUpdatedAt`; level
12 is the hard maximum.

Every transition sets `expiresAt` no more than 30 days after `updatedAt`.
An authorized maintenance job deletes expired buckets within 24 hours; therefore
abuse rows are retained for at most 31 days after their last transition. The job
deletes only `WHERE expiresAt <= statement_timestamp()` in bounded batches and
must never truncate, reset counters, or target rows by plaintext identity data.

## Better Auth 1.7.1 token-storage finding and Stage 13E gate

The inspected package identifies itself as Better Auth 1.7.1 at
`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/package.json:2-3`.

- Email verification's helper signs a JWT containing lower-cased email and
  optional update/payload data
  (`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/email-verification.mjs:13-18`). Issuance calls
  that signed-JWT helper, places the returned capability in the URL/callback,
  and creates no verification row
  (`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/email-verification.mjs:23-35`). The route later
  reads the presented token, verifies that JWT, and parses its payload
  (`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/email-verification.mjs:173-186`). This is an
  encoded, signed, stateless capability, not a stored digest. It has no atomic
  consume operation and a new JWT cannot invalidate its predecessors.
- Password reset generates the raw token, embeds it in
  `reset-password:<raw token>`, and passes that identifier to verification
  storage (`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/password.mjs:74-87`). Better Auth's
  option declares identifier storage default as `plain`
  (`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/@better-auth/core/dist/types/init-options.d.mts:1173-1182`), and the
  implementation returns the identifier unchanged when the option is absent or
  `plain` (`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/db/verification-token-storage.mjs:4-12`). Token
  opacity therefore does not make the default database value a hash.
- The reset endpoint does use `consumeVerificationValue` before changing the
  password (`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/password.mjs:157-174`), and the
  internal adapter selects the latest identifier row inside its consume lock and
  transaction, then calls adapter `consumeOne` by unique id
  (`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/db/internal-adapter.mjs:818-845`). The Prisma adapter
  atomically deletes that unique id, returning null to a losing concurrent caller
  (`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/@better-auth/prisma-adapter/dist/index.mjs:319-332`). This covers
  concurrency-safe consumption of one identifier, but issuance creates a new
  identifier for each token and does not invalidate a user's predecessors.

**Stage 13E gate:** the Better Auth-backed proof MUST reconcile the
`AuthCredentialToken` store and provider-neutral auth-edge boundary before
enabling email verification or password reset. The built-in stateless
email-verification route and the default password-reset verification persistence are rejected for
Passvero's approved single-use, superseding, digest-only policy. A hashing option
alone is insufficient because it does not add email-verification consumption or
predecessor invalidation. No compliance claim may rely on token opacity,
base64url encoding, signing, or provider naming. No unproven handler or adapter
path and no direct Passvero provider-table write may be substituted for the
required accepted proof.

## Required future canonical inverse relations

Disposable validation must add only these inverse fields to the copied canonical
models; a future authorized schema change must add the same fields:

- `User.authIdentities AuthIdentity[]`
- `User.accountActivations AccountActivation[] @relation("UserAccountActivations")`
- `Organization.authProviderSessions AuthProviderSession[]
  @relation("AuthProviderSessionSelectedOrganization")`

## Deployment rules

- Better Auth CLI migration execution: FORBIDDEN
- Prisma db push: FORBIDDEN
- Direct SQL execution during review: FORBIDDEN
- Canonical migration directory mutation during review: FORBIDDEN
- Future migration requires schema tests before deployment: YES
- Future migration deployment requires separate operator authorization: YES
- Existing 16 migration sources must retain approved hashes: YES

Any future migration may be generated only after the Better Auth-backed proof and
separate persistence approval, from the then-approved canonical schema, then
manually amended for the named CHECK constraints and partial indexes Prisma
cannot express. Review must compare every generated column, index, foreign key,
and action against this file. Migration review, migration deployment, data
backfill, cleanup, and rollback are separate authorization gates. Rollback is
forward-only while credential rows exist: disable the new auth paths, preserve
evidence until retention permits deletion, then use a separately reviewed
migration; never use `db push`, Better Auth migration execution, or manual review
SQL as recovery.
