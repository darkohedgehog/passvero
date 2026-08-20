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

The proposed provider models are kept separate from canonical `User`,
`Organization`, and `Membership`. The raw model names already avoid collisions,
so they are retained. The two generated user relations receive explicit relation
names only; all Better Auth-required fields, unique constraints, indexes, table
maps, and cascade behavior are preserved.

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
`Membership`.

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
