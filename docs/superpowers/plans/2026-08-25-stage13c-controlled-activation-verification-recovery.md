# Stage 13C.4 Controlled Activation, Verification, and Recovery Plan

> Execute in `/private/tmp/passvero-stage13c-controlled-activation` on branch
> `feat/stage13c-controlled-activation`, based on
> `22beb92b67e752ecfcd3c06b8f8f102db459768a`. Do not commit, merge, access a
> database, connect to SMTP, or modify environment files.

**Goal:** Add the smallest internal/server-only lifecycle foundation for
controlled activation, email verification, password recovery, authenticated
password change, and SMTP-backed security email.

**Architecture:** Application services depend only on provider-neutral ports.
Better Auth owns provider credentials, verification/reset capabilities, and
sessions. Business Prisma owns activation claims, canonical identity binding,
and auth audit events. A lazy Nodemailer adapter implements the email port.
Cross-boundary completion is idempotent and fail closed; no shared transaction
or direct provider-table write is introduced.

## Task 1: Email port, templates, and lazy SMTP adapter

**Files:**

- Create `src/application/auth/auth-email.ts`
- Create `src/infrastructure/auth/auth-email-templates.ts`
- Create `src/infrastructure/auth/smtp-config.ts`
- Create `src/infrastructure/auth/nodemailer-auth-email-sender.ts`
- Test in `tests/application/auth-email.test.ts`
- Test in `tests/infrastructure/auth-email-templates.test.ts`
- Test in `tests/infrastructure/smtp-config.test.ts`
- Test in `tests/infrastructure/nodemailer-auth-email-sender.test.ts`

Write failing behavior tests for bounded message data, fixed-origin templates,
explicit secure parsing, secret-free failures, sanitized transport options, and
provider-neutral transport failures. Implement only enough to pass. Inject the
transport factory so tests never create a real network transport.

## Task 2: Better Auth lifecycle configuration and API adapter

**Files:**

- Modify `src/infrastructure/auth/better-auth-server-config.ts`
- Modify `src/infrastructure/auth/better-auth-server.ts`
- Create `src/infrastructure/auth/better-auth-lifecycle-adapter.ts`
- Modify `tests/infrastructure/better-auth-server-config.test.ts`
- Create `tests/infrastructure/better-auth-lifecycle-adapter.test.ts`

Add callback configuration for 24-hour verification, 30-minute reset,
no verification auto-login, reset session revocation, fixed-origin mail
delivery, and Stage 13C.3 password callbacks. Keep the normal server's public
signup disabled. Provide a private controlled-activation server composition
whose documented `signUpEmail` API is callable only through the internal
adapter, with auto-login disabled and no HTTP handler export. Adapt documented
Better Auth APIs without exposing provider payloads or tokens.

## Task 3: Controlled activation application orchestration

**Files:**

- Create `src/application/auth/controlled-activation.ts`
- Create `tests/application/controlled-activation.test.ts`

Define ports for canonical activation state, capability/email digesting, and
provider credential lifecycle. Test invalid, expired, revoked, conflict,
missing-user, claim, replay, subject-conflict, no-premature-binding, and
secret-free result behavior. Implement bounded claims and idempotent provider
subject capture without requiring cross-database ACID.

## Task 4: Verified identity binding

**Files:**

- Create `src/application/auth/complete-verified-activation.ts`
- Create `tests/application/complete-verified-activation.test.ts`

Test provider-confirmed email ownership, intended-email digest equality,
subject uniqueness, revoked/nonmatching identity denial, and one Passvero
transaction seam that creates the identity, marks the activation `BOUND`, and
writes an allowlisted audit event. Implement no email-based auto-linking.

## Task 5: Password recovery and authenticated password change

**Files:**

- Create `src/application/auth/password-recovery.ts`
- Create `src/application/auth/change-password.ts`
- Create `tests/application/password-recovery.test.ts`
- Create `tests/application/change-password.test.ts`

Test provider API delegation, fixed-origin reset request, Stage 13C.3 policy
before credential operations, all-session revocation, current-session ending,
secret-free results, and non-rollback notification failure. Implement only the
provider-neutral orchestration ports and explicit reconciliation result.

## Task 6: Business Prisma persistence and server-only composition

**Files:**

- Create `src/infrastructure/auth/prisma-controlled-activation.ts`
- Create `src/infrastructure/auth/stage13c4-auth-lifecycle.ts`
- Create `tests/infrastructure/prisma-controlled-activation.test.ts`
- Create `tests/infrastructure/stage13c4-boundaries.test.mjs`

Implement claim/capture and verified binding with conditional Prisma operations
and a single business `$transaction` seam. Keep the raw auth Prisma client
private, instantiate no runtime at import, and add no HTTP route. Tests use
structural fakes and source-boundary assertions only.

## Task 7: Verification

Run focused Stage 13C.4 application/infrastructure tests, cumulative schema,
application, and infrastructure tests, TypeScript, ESLint, `git diff --check`,
`npm audit --omit=dev`, and a production build with database/auth/email
variables unset. Confirm no schema, migration, env, route, production database,
or SMTP network activity occurred.
