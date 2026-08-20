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
- CHECK constraints and partial indexes: none.
- `authenticatedAt` is set from the successful full-authentication instant and
  is preserved by rotation. `selectedOrganizationId` is cleared when the
  session expires or is revoked and whenever server-side eligibility
  revalidation fails.
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
| `failureCount` | `INTEGER` | no | `0` |
| `backoffLevel` | `INTEGER` | no | `0` |
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
  - `ck_auth_abuse_bucket_failure_count`: `failureCount >= 0`.
  - `ck_auth_abuse_bucket_backoff_level`: `backoffLevel BETWEEN 0 AND 12`.
  - `ck_auth_abuse_bucket_block_window`: `blockedUntil IS NULL OR
    blockedUntil <= expiresAt`.
  - `ck_auth_abuse_bucket_retention`: `expiresAt > updatedAt AND expiresAt <=
    updatedAt + INTERVAL '30 days'`.
- Plaintext email, IP address, network, user agent, password, and token columns: FORBIDDEN.
- Other forbidden columns: raw digest input, forwarded headers, Turnstile
  capability, session credential, canonical user ID, provider user ID, role,
  permission, membership, organization, or entitlement.

## Digest and allowed-dimension contract

Every `tokenDigest` and `keyDigest` is the 43-character, unpadded base64url
encoding of HMAC-SHA-256 output under a dedicated versioned server-side key.
That key is neither stored in these tables nor reused as an authentication
provider secret. Plain SHA-256 is forbidden for enumerable email/network input.
Digest equality is the only database lookup; raw capabilities and raw abuse-key
input are never persisted or logged.

The structured abuse input is version, enum dimension, allowlisted endpoint
code, and only the following dimension-specific canonical components:

- `TRUSTED_NETWORK`: the IPv4/IPv6-aware normalized client network derived only
  after explicit trusted-proxy validation.
- `ACCOUNT_IDENTIFIER`: the normalized account identifier.
- `ACCOUNT_AND_TRUSTED_NETWORK`: both normalized values with length-prefixed,
  unambiguous encoding.
- `GLOBAL_ENDPOINT`: the allowlisted endpoint code only.

No other dimension or component is permitted. A digest-key version change is a
reviewed rotation that lets old buckets expire; it cannot silently reinterpret
an existing digest.

## Atomic issue, consume, and abuse transitions

### Verification, reset, and activation

Issuance performs predecessor invalidation and insertion in one transaction:

1. Lock the owning `AuthProviderUser` row (`AuthCredentialToken`) or canonical
   `User` row (`AccountActivation`) with `SELECT ... FOR UPDATE`.
2. Set `invalidatedAt = statement_timestamp()` on every matching row for that
   owner and purpose whose `consumedAt` and `invalidatedAt` are null.
3. Insert exactly one fresh digest-only row. The partial unique index is the
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

The selected lifetimes are 24 hours for `EMAIL_VERIFICATION`, 30 minutes for
`PASSWORD_RESET`, and 24 hours for `AccountActivation`. These match the approved
verification/recovery windows and give the email-bound activation capability no
longer life than verification. Consumed, invalidated, and expired token rows are
deleted no later than 30 days after their terminal timestamp or expiry.

### Progressive abuse state

Each protected attempt derives all four required digests and performs each
bucket transition with one `INSERT ... ON CONFLICT (keyDigest) DO UPDATE ...
RETURNING` statement inside one transaction. The conflict branch increments
`failureCount`, raises `backoffLevel` only according to the reviewed bounded
schedule (never above 12), advances `blockedUntil`, extends `expiresAt`, and sets
`updatedAt = statement_timestamp()`. It updates only when the stored enum equals
the derived enum; zero returned rows fail closed as a digest/dimension collision.
Arithmetic must use `LEAST`/checked bounds so integer overflow cannot wrap.

A successful authentication may reduce the applicable account-specific backoff
in an atomic update, but it must not delete rows and must not reset or shorten
`TRUSTED_NETWORK`, `ACCOUNT_AND_TRUSTED_NETWORK`, or `GLOBAL_ENDPOINT` evidence.
There is no permanent lockout: `blockedUntil` is finite and never later than
`expiresAt`.

Every transition sets `expiresAt` no more than 30 days after `updatedAt`.
An authorized maintenance job deletes expired buckets within 24 hours; therefore
abuse rows are retained for at most 31 days after their last transition. The job
deletes only `WHERE expiresAt <= statement_timestamp()` in bounded batches and
must never truncate, reset counters, or target rows by plaintext identity data.

## Better Auth 1.7.1 token-storage finding and Stage 13E gate

The inspected package identifies itself as Better Auth 1.7.1 at
`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/package.json:2-3`.

- Email verification signs a JWT containing the lower-cased email and returns it
  directly; no verification row is created
  (`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/api/routes/email-verification.mjs:13-18`). The route later
  verifies that JWT and reads its payload
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
  database implementation transactionally consumes one row and removes stale
  rows (`/private/tmp/passvero-better-auth-review-1-7-1/node_modules/better-auth/dist/db/internal-adapter.mjs:818-860`). This covers
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
