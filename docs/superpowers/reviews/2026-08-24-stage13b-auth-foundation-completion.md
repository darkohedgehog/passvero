# Stage 13B Auth Foundation Completion Record

**Date:** 2026-08-24

**Canonical branch:** `main`

**Canonical HEAD:** `f940aff8778b347bf5d4b4dcba131fda28d41b0f`

## Completion scope

Stage 13B completed the reviewed authentication persistence foundation,
production migration, recovery validation, PM2 resurrection reconciliation,
cross-database PUBLIC ACL hardening, and dedicated database-role isolation. It
did not activate the authentication runtime or begin Stage 13C.

## Source and migration

- The Stage 13B persistence implementation and schema/migration review passed.
- Better Auth remains pinned at `1.7.1`; Prisma remains at `7.8.0`.
- The production-dependency npm audit reports zero vulnerabilities after the
  approved narrow transitive overrides.
- The approved auth-foundation migration was applied exactly once. Production
  reports 17/17 successful migrations, nine added auth tables, and four added
  auth enums.
- All auth tables were initially empty, and existing business rows were
  preserved.

## Default and cross-database ACL hardening

- Future-table SELECT for `passvero_app` was removed from the
  `passvero_migrator` default ACL. The approved default-ACL baseline is six
  entries, with existing business-table ACLs preserved.
- The cross-database dependency audit passed. PUBLIC CONNECT and TEMPORARY on
  `postgres`, PUBLIC CONNECT on `template1`, and PUBLIC TEMPORARY on
  `passvero_test` were removed.
- PUBLIC database ACL rows are zero across `passvero`, `postgres`, `template1`,
  and `passvero_test`. Legitimate role/database targets remain preserved.

## Recovery and PM2 reconciliation

- Stage 13B backup-validator drift was identified and corrected only for the
  approved catalog baselines. A controlled backup passed, created new valid
  offsite evidence, advanced the canonical marker, and restored the freshness
  service. The recovery operational gate passed.
- Deep PM2 proof engineering was retired in favor of the simplified operator
  procedure. One PM2-native save checkpoint passed; primary and fallback dump
  states were canonical and byte-identical after the save, while the live
  runtime remained unchanged.
- Active and resurrection dependencies on `postgres` or `template1` are absent.
  Superseded deep-proof harnesses remain rejected.

## Dedicated `passvero_auth` role

The dedicated role was created with this exact posture:

- `LOGIN`, `NOINHERIT`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`,
  `NOREPLICATION`, and `NOBYPASSRLS`;
- connection limit 10;
- zero memberships and zero owned objects;
- CONNECT only to `passvero`, USAGE but not CREATE on schema `public`, and no
  TEMPORARY privilege;
- CONNECT denied on `postgres`, `template1`, and `passvero_test`.

A SCRAM-authenticated localhost login was verified in a read-only transaction.

### Provider-table privileges for `passvero_auth`

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | ---: | ---: | ---: | ---: |
| `AuthProviderUser` | yes | yes | yes | no |
| `AuthProviderSession` | yes | yes | yes | yes |
| `AuthProviderAccount` | yes | yes | yes | no |
| `AuthProviderVerification` | yes | yes | yes | yes |

TRUNCATE, REFERENCES, and TRIGGER are denied on all four provider tables.
`passvero_auth` has no access to Passvero-owned auth tables, business tables, or
`_prisma_migrations`.

### Passvero-owned auth-table privileges for `passvero_app`

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | ---: | ---: | ---: | ---: |
| `AuthIdentity` | yes | yes | yes | no |
| `AccountActivationIntent` | yes | yes | yes | no |
| `AuthAuditEvent` | yes | yes | no | no |
| `AuthSessionSelection` | yes | yes | yes | yes |
| `AuthAbuseBucket` | yes | yes | yes | no |

TRUNCATE, REFERENCES, and TRIGGER are denied on all five tables.
`passvero_app` has no provider-table access, and its existing business ACL
matrix is unchanged. `passvero_backup` retains SELECT-only coverage on all 31
public tables, and PUBLIC has zero auth-table privileges.

## Credential and runtime boundary

- The dedicated protected configuration is
  `/etc/passvero/passvero-auth.env`, owned by `root:darko` with mode `0640`.
- The credential was not exposed. The configuration has zero runtime
  references and remains intentionally inactive.
- The existing PM2 wrapper and runtime have not been connected to
  `passvero_auth`.

## Governance boundary

Stage 13B proves persistence, migration, recovery, database-role isolation, and
least-privilege ACL readiness. It does not prove or authorize Better Auth
runtime configuration, authentication routes, sign-in, account activation,
email verification, password reset, session establishment, runtime
`AuthIdentity` binding, authenticated organization-context resolution, login
abuse controls, Turnstile, dashboard authentication, or Stage 13C deployment.
Those remain future Stage 13C-or-later work.

STAGE_13B_AUTH_FOUNDATION=COMPLETE

STAGE_13B_PRODUCTION_MIGRATION=PASS
STAGE_13B_RECOVERY_OPERATIONAL_GATE=PASS
STAGE_13B_PM2_RECONCILIATION=PASS
STAGE_13B_CROSS_DATABASE_PUBLIC_ACL_HARDENING=PASS
STAGE_13B_PASSVERO_AUTH_ROLE_AND_ACL=PASS

PASSVERO_AUTH_RUNTIME_ACTIVE=NO
STAGE_13C=NOT_STARTED
STAGE_13C_DEPLOYMENT_AUTHORIZED=NO
