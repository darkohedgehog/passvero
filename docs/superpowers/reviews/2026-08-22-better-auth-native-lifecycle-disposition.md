# Better Auth Native Lifecycle Architecture Disposition

**Status:** Approved by operator on 2026-08-22
**Disposition base:** `aa2244de926093fa77260c911b28ff810cca8a17`
**Scope:** Documentation revision only; no schema, migration, dependency, implementation, database, proof, or deployment authority

## 1. Decision

```text
AUTH_FOUNDATION_ARCHITECTURE=BETTER_AUTH_NATIVE_LIFECYCLE_WITH_PASSVERO_FAIL_CLOSED_RECONCILIATION
KEEP_BETTER_AUTH=YES
CROSS_BOUNDARY_ACID_REQUIRED=NO
DIRECT_BETTER_AUTH_PROVIDER_TABLE_WRITES=NO
BETTER_AUTH_OWNS_CREDENTIALS_VERIFICATION_RECOVERY_SESSIONS=YES
PASSVERO_OWNS_ACTIVATION_INTENT_AUTHIDENTITY_AND_TENANT_AUTHORIZATION=YES
UNBOUND_BETTER_AUTH_IDENTITY_TENANT_ACCESS=DENIED
AUTHIDENTITY_BINDING_IDEMPOTENT=YES
CROSS_BOUNDARY_RECONCILIATION=REQUIRED
BETTER_AUTH_HOOKS_AUTHORITATIVE=NO
AUTHIDENTITY_PROVIDER_SUBJECT_UNIQUE=YES
EMAIL_AS_RUNTIME_IDENTITY_KEY=NO
AUTOMATIC_SAME_EMAIL_LINKING=DISABLED
CUSTOM_BETTER_AUTH_SESSION_TABLE_MUTATION=NO
CUSTOM_ROLLING_SESSION_TOKEN_ROTATION=NO
SESSION_ORGANIZATION_STATE_IN_BETTER_AUTH_TABLES=NO
BETTER_AUTH_RECOVERY_TOKENS_REMAIN_PROVIDER_OWNED=YES
PASSVERO_RECOVERY_TOKEN_DUPLICATION=NO
PHASE_13_DOCUMENTATION_REVISION_ONLY=YES
SCHEMA_CHANGES_AUTHORIZED=NO
MIGRATIONS_AUTHORIZED=NO
DEPENDENCY_CHANGES_AUTHORIZED=NO
IMPLEMENTATION_AUTHORIZED=NO
```

Better Auth remains the authentication foundation. Better Auth owns its native
user/account records, credentials, email verification, password recovery, and
database-backed opaque sessions. Passvero owns controlled activation intent,
provider-neutral `AuthIdentity`, canonical `User`, organization selection,
membership and organization resolution, permissions, tenant isolation, billing
authorization, and every business authorization decision.

Application and domain modules remain Better Auth-neutral. They receive only
canonical Passvero identifiers and contexts after the authentication adapter has
resolved the provider subject.

## 2. Stage 13A disposition

The Stage 13A proof remains terminal `FAIL`:

- its single authorized invocation was consumed;
- H1-H7 were `NOT_EXECUTED`;
- it selected no runtime or persistence boundary;
- its candidate migration contract is non-implementable;
- it supplied no positive runtime evidence;
- its retained state and evidence remain preserved and are not authorized for
  reuse, mutation, cleanup, or retry.

The proof failure rejected the proposed cross-boundary transaction architecture.
It did not establish that Better Auth's documented native lifecycle is unsuitable.
The historical review, proof plan, harness, and proposed migration contract remain
research evidence only. Where they conflict with this disposition, this document
and the revised Phase 12 specification are authoritative.

## 3. Authority and consistency boundaries

| Boundary | Required consistency |
| --- | --- |
| Better Auth-owned credentials, verification, recovery, and sessions | Better Auth's documented internal guarantees |
| Passvero activation transitions, `AuthIdentity` binding or revocation, and corresponding audit event | One Passvero transaction |
| Passvero membership, organization, permission, entitlement, and business mutations | Existing canonical transaction and authorization rules |
| Better Auth identity to Passvero `AuthIdentity` | Idempotent, fail-closed reconciliation |
| Notifications, orphan visibility, and supported cleanup | Retryable eventual consistency |
| Authentication abuse control | Passvero-owned PostgreSQL decisions; no shared transaction with Better Auth |

Physical co-location in PostgreSQL does not merge ownership boundaries. Passvero
must not inject its transaction into Better Auth, write Better Auth tables through
Prisma, or roll back a successful provider operation by mutating provider state.

The invariant is:

```text
NO VALID ACTIVE AUTHIDENTITY BINDING
-> NO PASSVERO TENANT ACCESS
```

An orphaned or transiently authenticated Better Auth identity is therefore a
recoverable operational state, not authorization evidence.

## 4. Provider-neutral identity binding

The future conceptual `AuthIdentity` model contains:

- a Passvero-owned stable identifier;
- a required canonical `User.id` foreign key;
- an allowlisted provider identifier;
- an opaque immutable provider subject;
- creation and explicit revocation lifecycle metadata justified during schema
  review.

Required constraints and behavior:

- unique `(provider, providerSubject)`;
- multiple future identities may belong to one canonical user;
- email is not stored or queried as the runtime binding;
- automatic same-email linking is disabled;
- revoked provider subjects cannot be silently rebound;
- linking conflicts fail closed and require reviewed operator resolution;
- canonical-user hard deletion must not leave an access-granting identity;
- no provider organization, role, membership, permission, or entitlement state
  enters this model.

Exact field names, deletion behavior, revocation representation, indexes, and
foreign-key actions remain a separate Stage 13B schema-review decision.

## 5. Controlled activation lifecycle

Passvero owns an opaque, single-use, expiring activation capability bound to a
pre-provisioned canonical `User.id`. Better Auth owns credential creation and
email verification.

The conceptual lifecycle is:

```text
ISSUED
-> IN_PROGRESS
-> AUTH_ACCOUNT_CREATED
-> EMAIL_VERIFIED
-> BOUND
```

Terminal states are `EXPIRED`, `REVOKED`, and `CONFLICT`. A reconciliation-needed
condition should be derived from durable provider and Passvero state unless schema
review demonstrates that a separate persisted state is necessary.

Activation orchestration must:

1. validate and atomically claim the Passvero activation intent;
2. call a documented Better Auth server API outside the Passvero transaction;
3. retain the opaque provider subject when a conclusive result is available;
4. require provider-confirmed verified email for controlled initial linking;
5. transactionally create `AuthIdentity`, complete the intent, and append the
   binding audit event;
6. reconcile an ambiguous response, crash, duplicate, or callback loss from
   durable state;
7. deny tenant access until the binding transaction commits.

Email may prove ownership during this controlled initial flow. It never becomes
the permanent provider-to-user lookup key. Public self-registration remains
disabled at the Passvero HTTP boundary even if Better Auth's server-side signup
capability must remain configured for controlled activation.

Better Auth callbacks or hooks may trigger an idempotent reconciliation attempt.
They are not authoritative, are not assumed to be transactional or durably
delivered, and cannot grant access by themselves.

## 6. Failure and recovery matrix

| Failure | Safe state and recovery |
| --- | --- |
| Better Auth user commits and Passvero binding fails | Identity remains unbound and receives no tenant access; retry binding from the activation intent or send a conflict to manual review. |
| Activation intent commits and Better Auth creation fails | Intent remains retryable or its bounded in-progress claim expires; no provider identity is treated as bound. |
| Process crashes between operations | Reconciliation reads durable provider and intent state; absence of binding denies access. |
| Duplicate activation | Stable intent and uniqueness constraints make the result idempotent and outwardly generic. |
| Concurrent activation | Versioning or conditional state transition permits one winner; every loser reloads the durable state. |
| Verification or reset token replay | Better Auth owns rejection/consumption; replay creates no binding or session-based tenant access. |
| Session refresh race | Better Auth owns the session result; Passvero performs no provider-row repair and rejects expired or over-age sessions. |
| Reset succeeds and Passvero notification/audit follow-up fails | Credential change and provider revocation stand; retry non-authoritative follow-up without rolling back the credential. |
| Email changes after binding | Provider subject remains the binding; email change is deferred until a separate verified synchronization design is approved. |
| Canonical user is disabled, deleted, or unavailable | Identity resolution fails closed; hard deletion and revocation semantics are finalized at schema review. |
| Membership is removed or organization is suspended | Provider session may remain authenticated, but request-time canonical revalidation clears selection and denies tenant access. |
| Provider commits and the response is lost | Retry reconciles provider state and never blindly creates a second binding. |
| Passvero commits and a callback is lost | Committed binding and transactional audit remain authoritative; callback side effects retry idempotently. |

## 7. Session model

Better Auth owns database-backed opaque sessions. Initial configuration remains:

- seven-day inactivity timeout;
- 24-hour rolling refresh threshold;
- cookie cache disabled;
- Redis disabled;
- `Secure`, `HttpOnly`, `SameSite=Lax`, host-only cookie;
- no organization, role, permission, or entitlement state in cookies.

Passvero enforces the 30-day absolute reauthentication boundary at its
authentication-context adapter using the documented provider session creation
time. A session at or beyond the boundary is denied before organization context
is derived, revoked through a documented Better Auth API where possible, and
requires full sign-in. A revocation failure cannot restore access because every
protected request repeats the absolute-age check.

No custom Better Auth session fields, direct provider-session mutation, or custom
rolling token rotation are required. Password reset uses provider-supported
session revocation. Authenticated password change requires the current password,
revokes other sessions, then revokes the current session and requires normal
sign-in instead of mutating its token.

Server-side organization selection belongs to Passvero-owned persistence keyed
to the provider session identity. It is a selector only and is revalidated against
canonical membership and organization state on every use. Its exact persistence
shape remains a Stage 13B schema decision.

## 8. Credential and recovery ownership

Better Auth owns credential hashing, email verification records, password-reset
records, token consumption, password replacement, and reset-triggered session
revocation through documented public configuration and APIs.

Passvero must not create a parallel email-verification or password-reset token
store. Passvero-owned tokens are limited to Passvero concepts such as controlled
activation.

The approved password input policy remains 15-128 Unicode code points, NFC
normalization, spaces preserved, no trimming or silent truncation, and required
compromised/common/contextual blocklists. Any password hashing callback must use
Better Auth's documented extension surface and receive separate security review;
the Stage 13A experimental envelope is not normative.

Verification remains 24 hours and reset remains 30 minutes. Both must be opaque,
single-use under the pinned provider contract, generic to unauthenticated callers,
fixed-origin, absent from logs/referrers, and covered by replay tests. Strict
predecessor invalidation is not authorization to duplicate provider tokens; if it
cannot be achieved through a documented Better Auth contract, implementation must
stop for explicit security disposition.

## 9. HTTP exposure

The initial application should expose explicit Passvero route handlers or server
actions for approved workflows and invoke documented Better Auth server APIs.
Credential creation is reachable only through controlled activation. OAuth,
magic-link, organization, admin, MFA, and passkey endpoints remain absent.

The unrestricted Better Auth catch-all handler is not required initially. If a
documented flow later requires it, a Passvero wrapper must allowlist the exact
methods and paths before delegating to the public handler and must return safe
not-found for all other routes. Neither `proxy.ts` nor cookie presence is a
security boundary.

## 10. Public API and upgrade policy

Production code may rely on documented Better Auth server APIs, documented
configuration, documented database adapter behavior, and reviewed public types.
It must not depend on internal adapter contexts, generated private helpers,
undocumented router internals, or source-archeology-only behavior.

Authoritative public references:

- [Better Auth Next.js integration](https://better-auth.com/docs/integrations/next)
- [Better Auth Prisma adapter](https://better-auth.com/docs/adapters/prisma)
- [Better Auth email and password](https://better-auth.com/docs/authentication/email-password)
- [Better Auth session management](https://better-auth.com/docs/concepts/session-management)
- [Better Auth database integration and hooks](https://better-auth.com/docs/concepts/database)
- [Better Auth options](https://better-auth.com/docs/reference/options)
- [Better Auth security](https://better-auth.com/docs/reference/security)

Every Better Auth upgrade requires:

- exact version pinning;
- changelog and security-advisory review;
- disposable generated-schema comparison;
- manually reviewed Prisma and migration diff;
- public API/type contract review;
- critical-path tests for activation, verification, reset, session age and
  revocation, password normalization, identity binding, and route exposure;
- a new disposable integration proof only for a material supported lifecycle,
  schema, or public API change and only under fresh explicit authority.

## 11. Stage 13B gate

This disposition does not approve schema or migration source. A future Stage 13B
plan must propose and review only the persistence required by this architecture:

- the generated Better Auth provider-owned models without Passvero direct writes;
- provider-neutral `AuthIdentity`;
- Passvero controlled-activation intent;
- Passvero server-side organization-session selection;
- Passvero PostgreSQL abuse-control state;
- only reconciliation metadata proven necessary by concrete lifecycle cases.

It must exclude:

- Passvero email-verification or password-reset token duplication;
- custom Better Auth session timestamps or organization fields;
- custom rolling session-token rotation;
- cross-boundary transaction machinery;
- direct Passvero writes to Better Auth provider tables.

Separate operator authority is required for the Stage 13B detailed plan, schema
changes, migration creation, dependency changes, implementation, database access,
and deployment.
