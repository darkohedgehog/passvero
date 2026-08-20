# Proposed Authentication Persistence Migration Contract

**Status:** Review-only candidate; not executable migration SQL

**Schema proposal:** `proposed-prisma-fragment.prisma`

**Canonical schema and migration directories changed:** NO

This contract is the exact PostgreSQL target for a later, separately authorized
Prisma schema and hand-reviewed migration. Prisma names below are quoted
PostgreSQL identifiers. `DateTime` maps to `TIMESTAMP(3)`, not `TIMESTAMPTZ`.
Prisma `uuid()` values are application-generated; the PostgreSQL UUID columns
have no database default. Prisma `@updatedAt` columns also have no database
default and every write must set them explicitly.

## Enums

- `AuthCredentialTokenPurpose`: `EMAIL_VERIFICATION`, `PASSWORD_RESET` only.
- `AuthAbuseDimension`: `TRUSTED_NETWORK`, `ACCOUNT_IDENTIFIER`,
  `ACCOUNT_AND_TRUSTED_NETWORK`, `GLOBAL_ENDPOINT` only. Adding a dimension is a
  future schema-and-migration review, not a runtime string extension.

## Exact table contracts

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
| `selectedOrganizationId` | `UUID` | yes | none |

- Primary key: `AuthProviderSession_pkey` on (`id`).
- Unique indexes: `AuthProviderSession_token_key` on (`token`).
- Non-unique indexes: `AuthProviderSession_userId_idx` on (`userId`) and
  `AuthProviderSession_selectedOrganizationId_idx` on
  (`selectedOrganizationId`).
- Foreign keys: `AuthProviderSession_userId_fkey` references
  `AuthProviderUser(id)` with `ON DELETE CASCADE ON UPDATE CASCADE`;
  `AuthProviderSession_selectedOrganizationId_fkey` references
  `Organization(id)` with `ON DELETE SET NULL ON UPDATE CASCADE`.
- CHECK constraints:
  - `ck_auth_provider_session_absolute_expiry`: `expiresAt > authenticatedAt
    AND expiresAt <= authenticatedAt + INTERVAL '30 days'`.
  - `ck_auth_provider_session_authenticated_origin`: `authenticatedAt <=
    createdAt`.
- Partial indexes: none.
- `authenticatedAt` is set from the successful full-authentication instant and
  is preserved by every refresh, opaque-token rotation, and authenticated
  password-change path. `selectedOrganizationId` is cleared when the session
  expires or is revoked and whenever server-side eligibility revalidation fails.
- Forbidden additions: role, permission, membership-status, organization-status,
  entitlement, billing, or platform-administration snapshots.

This is the sole organization-selection persistence choice. A nullable relation
on the authoritative database session is sufficient: the browser still receives
only the opaque session credential, while PostgreSQL type and foreign-key checks
reject nonexistent selections. A separate `AuthSessionSelection` table would
add another write, join, uniqueness constraint, lifecycle cleanup path, and exit
cost without creating a security boundary. The stored UUID remains only a
selection hint; every request and switch revalidates membership and organization
status and every business mutation revalidates authorization transactionally.

The reviewed Better Auth configuration MUST declare exactly:

```ts
session: {
  expiresIn: 60 * 60 * 24 * 7,
  updateAge: 60 * 60 * 24,
  cookieCache: {enabled: false},
  additionalFields: {
    authenticatedAt: {
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
Therefore both fields are `input: false`: clients cannot set either through
create input or `/update-session`. `authenticatedAt` receives the server clock
default on ordinary full-authentication session creation; the Passvero wrapper
must pass the already stored value explicitly on every replacement path. Better
Auth's internal create path obtains additional-field defaults before constructing
the session record and includes them in the create payload; its server-only
`overrideAll` branch can explicitly replace a default
(`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/db/internal-adapter.mjs:248-320`).
Passvero rotation updates the existing row rather than creating a replacement.
Any future replacement path must invoke that server-only branch through the
reviewed service with the original `authenticatedAt`; it must never expose the
override or rely on parsed client input.

Only a dedicated CSRF-protected organization-selection mutation may write
`selectedOrganizationId`. It accepts an untrusted UUID, loads the current
database session, resolves `AuthIdentity` to canonical `User`, locks/revalidates
`MembershipStatus.ACTIVE` plus `OrganizationStatus.ACTIVE`, and conditionally
updates by current session id and token in one transaction. Zero updated rows,
invalid membership, inactive organization, or stale session clears selection
and returns the safe no-access state. No generic provider update endpoint,
client session input, or cookie payload may select an organization.

### Session enforcement and reviewed adapter boundary

Every authenticated request uses the database row and performs these checks
before identity or organization resolution:

1. Reject, delete the row, and expire the cookie when `now >= expiresAt` or
   `now >= authenticatedAt + 30 days`. This is the request-time 30-day absolute
   check and remains mandatory even with the database CHECK.
2. The 7-day inactivity expiry is `expiresAt`; it is never later than
   `min(last successful refresh + 7 days, authenticatedAt + 30 days)`.
3. A 24-hour refresh is due when `now >= updatedAt + 24 hours`. Refresh uses
   `newExpiresAt = min(now + 7 days, authenticatedAt + 30 days)` and never
   modifies `authenticatedAt` or authorization state.
4. Refresh performs atomic opaque-token rotation with one conditional database
   update: match session id, old token, and unexpired absolute/inactivity state;
   set a newly generated opaque token, `expiresAt`, and `updatedAt`; preserve
   `authenticatedAt` and `selectedOrganizationId`; `RETURNING` supplies the only
   token eligible for `Set-Cookie`. The old token is invalid at commit. The
   response emits the cookie only after a successful commit with `Max-Age`
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
A reviewed Passvero session service/adapter boundary is REQUIRED before Stage
13E and is the only session create/read/refresh/rotate/revoke/password-change
entry point.

Authenticated password change verifies the current password, updates the hash,
deletes every other session row, and conditionally rotates the current row/token
in one transaction while preserving its `authenticatedAt`; it does not call the
native delete-and-create path. Password reset deletes every session row for the
provider user in the same transaction as token consumption and password update,
then expires the presented cookie and does not sign in. Revoke-all likewise must
delete every session row for the provider user and expire the cookie. Better
Auth's native revoke-all endpoint does call `deleteUserSessions`, but does not
establish this service's cookie, absolute-age, or transaction rules
(`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/session.mjs:411-441`),
so callers use the Passvero boundary. Single revoke deletes the exact token row.
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
- This provider-required table is retained for adapter compatibility, but the
  initial Passvero email-verification and password-reset flows MUST NOT persist
  their capabilities here. Those flows use `AuthCredentialToken`; enabling a
  Better Auth feature that writes a raw/encoded capability to this table
  requires a new reviewed storage adapter and migration decision.

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
- Forbidden columns: email and provider access, refresh, identity, session,
  verification, reset, or activation token material.

### `AuthCredentialToken`

| Column | PostgreSQL type | Null | Default |
| --- | --- | --- | --- |
| `id` | `UUID` | no | none; Prisma `uuid()` |
| `providerUserId` | `TEXT` | no | none |
| `purpose` | `AuthCredentialTokenPurpose` | no | none |
| `tokenDigest` | `VARCHAR(43)` | no | none |
| `expiresAt` | `TIMESTAMP(3)` | no | none |
| `consumedAt` | `TIMESTAMP(3)` | yes | none |
| `invalidatedAt` | `TIMESTAMP(3)` | yes | none |
| `createdAt` | `TIMESTAMP(3)` | no | `CURRENT_TIMESTAMP` |

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
  - `ck_auth_credential_token_expiry`: `expiresAt > createdAt`.
  - `ck_auth_credential_token_terminal_state`: `consumedAt` and
    `invalidatedAt` are not both non-null.
  - `ck_auth_credential_token_consumed_time`: `consumedAt IS NULL OR
    (consumedAt >= createdAt AND consumedAt < expiresAt)`.
  - `ck_auth_credential_token_invalidated_time`: `invalidatedAt IS NULL OR
    invalidatedAt >= createdAt`.
- Forbidden columns: plaintext/encoded token, email, password, IP address,
  network, user agent, session credential, role, or permission.

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
  - `ck_auth_abuse_bucket_block_window`: `blockedUntil IS NULL OR
    blockedUntil <= expiresAt`.
  - `ck_auth_abuse_bucket_retention`: `expiresAt > updatedAt AND expiresAt <=
    updatedAt + INTERVAL '30 days'`.
- Plaintext email, IP address, network, user agent, password, and token columns: FORBIDDEN.
- Other forbidden columns: raw digest input, forwarded headers, Turnstile
  capability, session credential, canonical user ID, provider user ID, role,
  permission, membership, organization, or entitlement.

## Digest and allowed-dimension contract

Every `tokenDigest`, `intendedEmailDigest`, and `keyDigest` is the 43-character,
unpadded base64url encoding of HMAC-SHA-256 output under a distinct, versioned
server-side key for that purpose. Keys are neither stored in these tables nor
reused as the Better Auth secret. Plain SHA-256 is forbidden for enumerable
email/network input. Digest equality is the only database lookup; raw
capabilities and raw abuse-key input are never persisted or logged.

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
from the locked provider user and activation uses its stored
`intendedEmailDigest`; then the two `POST-LOOKUP` buckets are mandatory before
the conditional consume. Thus "all four" means all four applicable phases for a
resolved subject, not four fabricated buckets for an unknown token.

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
2. For activation, normalize the locked canonical `User.email` using the exact
   account-identifier normalization below and compute `intendedEmailDigest` with
   the dedicated activation-email HMAC key. The activation email is addressed
   from that same locked canonical value; operator-supplied email is not trusted.
3. Set `invalidatedAt = statement_timestamp()` on every matching row for that
   owner and purpose whose `consumedAt` and `invalidatedAt` are null.
4. Insert exactly one fresh digest-only row. The partial unique index is the
   database backstop. No email is used as an ownership or lookup key.

Concurrent issuance serializes on the owner row. The later transaction
invalidates the earlier token before returning, so at most one issued token is
active. Expired rows are invalidated by the same issuance update because a
partial-index predicate cannot safely depend on wall-clock time.

Consumption is one atomic conditional update, never read-then-update:

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
and fail with the same generic invalid-token result. Email verification plus
`emailVerified`, password replacement plus all-session revocation, or activation
plus credential creation and `AuthIdentity` binding must occur in the same
transaction as this update. A transaction failure rolls every change back.
Activation never creates a session; normal sign-in follows successful activation.

Activation consumption locks the `AccountActivation` and canonical `User` rows,
re-normalizes the current canonical email, recomputes its keyed digest, and uses
constant-time equality against `intendedEmailDigest` before the conditional
consume. A mismatch atomically sets `invalidatedAt` and returns the generic
invalid-token result. Credential creation uses that locked canonical email, the
provider email must equal the same normalized value, and email ownership is
marked verified only as part of the successful activation transaction.

Every canonical email mutation first locks the canonical `User` row and
invalidates every active activation (`consumedAt IS NULL AND invalidatedAt IS
NULL`) in the same transaction before changing `User.email`. It also follows the
separately reviewed provider-email change/verification path; direct Prisma email
updates and case/normalization-only bypasses are forbidden. Consequently an
activation issued for an older canonical email cannot bind credentials after an
email change, including under concurrent issuance, consumption, or mutation.

The selected lifetimes are 24 hours for `EMAIL_VERIFICATION`, 30 minutes for
`PASSWORD_RESET`, and 24 hours for `AccountActivation`. These match the approved
verification/recovery windows and give the email-bound activation capability no
longer life than verification. Consumed, invalidated, and expired token rows are
deleted no later than 30 days after their terminal timestamp or expiry.

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

1. Derive the applicable digests from the matrix. For token-only endpoints,
   perform a non-consuming digest lookup to obtain the subject when present,
   derive the post-lookup digests, and rely on the later conditional consume to
   detect a concurrent token change.
2. Upsert missing rows with the exact enum, `attemptCount = 0`,
   `failureCount = 0`, `backoffLevel = 0`, `windowStartedAt = now`, null
   `lastFailureAt`/`blockedUntil`, `expiresAt = now + 30 days`, and
   `updatedAt = now`. Lock every applicable row in ascending `keyDigest` order.
   A stored enum mismatch for a digest fails closed.
3. Before admission, apply window rollover: when the dimension's fixed window
   has elapsed, set `attemptCount = 0`, `failureCount = 0`, and
   `windowStartedAt = now`. Apply backoff decay by lowering `backoffLevel` one
   level per complete 24 hours since `lastFailureAt`; never below zero. Clear an
   elapsed `blockedUntil`; never shorten a live block.
4. Reject generically without the protected operation if any applicable
   `blockedUntil > now`. Otherwise increment `attemptCount` with checked
   arithmetic. If a `GLOBAL_ENDPOINT` increment would exceed 100 in its one-minute
   window, raise its level, set the mapped finite block, commit that transition,
   and reject the protected operation.
5. Execute the local protected operation. On failure, increment `failureCount`
   and set `lastFailureAt = now` for every applicable bucket. When the new
   failure count reaches that dimension's threshold, reset `failureCount = 0`,
   increment `backoffLevel` with `LEAST(12, backoffLevel + 1)`, and set
   `blockedUntil = now + mapped duration`. On success, do not decrement, reset,
   delete, or shorten any bucket; only the time-based rollover/decay above may
   reduce state.
6. Set `updatedAt = now` and `expiresAt = now + 30 days` on every changed row,
   return the safe result, and commit. A serialization failure is a generic
   transient denial; the authentication operation is not retried automatically.

The transaction is the atomic admission/check/update transition: concurrent
requests sharing any digest serialize before the protected action, and no
credential/token state commits without its abuse transition. The global row is
per allowlisted endpoint code, so one endpoint cannot spend another's window.
There is no permanent lockout: every block is finite, decay is one level per
complete 24 hours without a failure, and level 12 is the hard maximum.

Every transition sets `expiresAt` no more than 30 days after `updatedAt`.
An authorized maintenance job deletes expired buckets within 24 hours; therefore
abuse rows are retained for at most 31 days after their last transition. The job
deletes only `WHERE expiresAt <= statement_timestamp()` in bounded batches and
must never truncate, reset counters, or target rows by plaintext identity data.

## Better Auth 1.7.1 token-storage finding and Stage 13E gate

The inspected package identifies itself as Better Auth 1.7.1 at
`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/package.json:2-3`.

- Email verification issuance calls the signed-JWT token creator, places the
  returned capability in the URL/callback, and creates no verification row
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
  Prisma adapter atomically deletes by unique `id`, returning null to a losing
  concurrent caller
  (`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/@better-auth/prisma-adapter/dist/index.mjs:319-332`). This covers
  concurrency-safe consumption of one identifier, but issuance creates a new
  identifier for each token and does not invalidate a user's predecessors.

**Stage 13E gate:** Passvero MUST implement and review the `AuthCredentialToken`
store and its adapter/endpoint boundary before enabling email verification or
password reset. The built-in stateless email-verification route and the default
password-reset verification persistence are rejected for Passvero's approved
single-use, superseding, digest-only policy. A hashing option alone is
insufficient because it does not add email-verification consumption or
predecessor invalidation. No compliance claim may rely on token opacity,
base64url encoding, signing, or provider naming.

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

The future migration must be generated from the approved canonical schema, then
manually amended for the named CHECK constraints and partial indexes Prisma
cannot express. Review must compare every generated column, index, foreign key,
and action against this file. Migration review, migration deployment, data
backfill, cleanup, and rollback are separate authorization gates. Rollback is
forward-only while credential rows exist: disable the new auth paths, preserve
evidence until retention permits deletion, then use a separately reviewed
migration; never use `db push`, Better Auth migration execution, or manual review
SQL as recovery.
