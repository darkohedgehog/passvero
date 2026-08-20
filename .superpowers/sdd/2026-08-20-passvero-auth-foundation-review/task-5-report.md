# Task 5 Report: Cumulative Authentication Foundation Review

## Scope and authority

- Stage 13A Task 5 only; final review/test/report evidence only.
- Authorized worktree:
  `/private/tmp/passvero-stage13a-auth-foundation-review`.
- Cumulative execution base:
  `331f8f1cd29203ee7d8d9364c7324313b75f822f`, per the progress-ledger ruling.
- Decision-packet commit: `c33cd56` (`docs: complete Better Auth foundation review`).
- No package, application source, canonical Prisma schema, canonical migration,
  Prisma configuration, environment, generated client, secret, or database
  access/change was authorized or performed.

## Owned changes

- Extended
  `docs/superpowers/reviews/2026-08-20-better-auth-foundation-review.md`
  with the final 13-row matrix, exact submitted interfaces/persistence set,
  rejected native/alternative behaviors, migration/exit/rollback implications,
  and the sole unresolved operator gate.
- Added the final source-level boundary/matrix test to
  `tests/auth-foundation-review.test.mjs`.
- Added this required SDD execution-evidence report.

No earlier review asset, proposal, migration contract, or task report was
modified by Task 5.

## RED to GREEN evidence

- RED: after adding only the final test,
  `node --test tests/auth-foundation-review.test.mjs` returned exit 1 with
  11 passing and 1 failing test. The failure was the intended assertion:
  `missing final matrix row: | Next.js 16 and React 19 compatibility | **PASS** |`.
  Existing artifact and boundary assertions remained green.
- GREEN: after adding the final cumulative matrix and contract summary, the same
  command returned exit 0 with 12 passing and 0 failing tests.
- The final test also reads real `package.json` and `prisma/schema.prisma` and
  asserts that neither Better Auth dependency nor proposed provider/identity
  models entered implementation paths.

## Dependency and official-source evidence

- Fresh registry queries on 2026-08-20 returned `better-auth@1.7.1`,
  `@better-auth/prisma-adapter@1.7.1`, and `auth@1.7.1`.
- `better-auth@1.7.1` registry metadata accepts `next ^16`, `react ^19`,
  `react-dom ^19`, Prisma/client `^7`, and `pg ^8`.
- `@better-auth/prisma-adapter@1.7.1` registry metadata accepts Prisma/client
  `^7`; the disposable installed metadata confirms the same at
  `@better-auth/prisma-adapter/package.json:37-41`.
- The official Better Auth Next.js integration page states Next.js 16
  compatibility and documents `proxy.ts`, Route Handlers, RSCs, Server Actions,
  and authoritative server validation:
  `https://better-auth.com/docs/integrations/next`.
- The official Prisma adapter page covers Prisma 7, supports schema generation,
  and marks Prisma schema migration unsupported:
  `https://better-auth.com/docs/adapters/prisma`.
- Pinned Better Auth 1.7.1 selects its default hash/verify implementation when
  no override exists (`better-auth/dist/context/create-context.mjs:181-188`),
  and permits custom callbacks. Fix Round 1 rejects the default because its
  concrete Node implementation applies NFKC rather than the approved NFC; the
  selected Passvero auth-layer callback boundary is recorded below.

## Final matrix and rejected behavior summary

- Matrix results: 12 `PASS`, 0 `REJECT`, and 1
  `OPERATOR DECISION REQUIRED` across the 13 required review concerns.
- The separate alternative-behavior table records 11 explicit `REJECT`
  decisions: native `/get-session`, native same-token refresh, native
  delete/create password-change sessions, stateless email verification, default
  plaintext reset identifiers, the default NFKC password hash/verify, generic
  session-field updates, Organization plugin/automatic linking, Redis/cookie
  cache/secondary authority, a separate session-selection table, and
  provider/`db push`/review-SQL migration paths.
- The selected exact runtime contract adds `lastRefreshAt` to the planned
  `AuthSessionExtension` so the 24-hour refresh anchor is persisted separately
  from general `updatedAt` writes.
- The selected persistence contract remains exactly two enums, eight proposed
  tables, three future canonical inverse relations, the existing Prisma
  proposal, and the exact PostgreSQL migration contract. It is indivisible.

## Complete non-database verification

- `node --test tests/*.test.mjs`: exit 0; 168 tests passed, 0 failed.
- `npm run test:application`: the first sandboxed invocation was blocked before
  tests by `tsx` IPC `listen EPERM`; the identical prescribed command was rerun
  with permission and returned exit 0; 54 tests passed, 0 failed.
- `npm run test:infrastructure`: exit 0; 11 tests passed, 0 failed.
- `npm run lint`: exit 0 with no ESLint findings.
- `git diff --check`: exit 0.
- `npm run test:integration` was not run; Stage 13A has no database authority.

Application/infrastructure compilation required the authorized temporary
symlink `src/generated` to the primary checkout's existing `src/generated`
client. No client was generated or copied. The exact symlink target was checked,
then the link was unlinked before lint, diff, commit, and status verification.

## Cumulative boundary from `331f8f1`

Product decision artifacts are limited to:

- `docs/superpowers/reviews/2026-08-20-better-auth-foundation-review.md`;
- raw generated candidate
  `docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/generated-prisma-schema.prisma`;
- review-only proposal
  `docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/proposed-prisma-fragment.prisma`;
- migration contract
  `docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/proposed-migration-contract.md`;
- `tests/auth-foundation-review.test.mjs`.

The only additional cumulative paths are committed
`.superpowers/sdd/2026-08-20-passvero-auth-foundation-review/task-{2,3,4,5}-report.md`
files. They are required SDD execution evidence under the progress-ledger ruling,
not product/runtime artifacts. No other unexpected path exists.

The forbidden-path check found no `package.json`, `package-lock.json`, `src/`,
`prisma/schema.prisma`, `prisma/migrations/`, `prisma.config.ts`, `.env*`, or
generated-client diff. A name scan matched only the expected raw generated
review asset; it is evidence, not `src/generated`. The sensitive-value scan
matched only Task 4's negative record of forbidden connection markers. No value,
URL, credential, token, account email, raw IP address, or production datum was
present.

## Sole unresolved decision and stop condition

`Migration and exit cost` is `OPERATOR DECISION REQUIRED`: acceptance means
accepting the complete persistence contract, all three mandatory Passvero-owned
boundaries, the later manually amended migration/review cost, forward-only
rollback while retained evidence exists, and fresh review on Better Auth
upgrade.

Approval would authorize only use of this packet as input to a later separately
authorized implementation plan. It would not authorize dependency installation,
canonical schema or migration changes, migration deployment, PostgreSQL access,
client/secret generation, Stage 13B, or Stage 13E. Task 5 stops at this gate.

## Fix Round 1

### Reviewer P1 resolved

The original password matrix row incorrectly accepted Better Auth 1.7.1's
default scrypt wrapper while requiring
`PASSWORD_UNICODE_NORMALIZATION=NFC`. Exact pinned source shows the default calls
`password.normalize("NFKC")`. NFKC collapses compatibility distinctions that NFC
preserves, so distinct policy-valid NFC inputs can become the same KDF input.
That equivalence expansion made the original acceptance unsafe even though the
underlying scrypt work factors were otherwise suitable.

The default is now explicitly `REJECT`. The selected mandatory replacement is a
server-only Passvero authentication-adapter/provider-edge boundary configured
through Better Auth's supported custom
`emailAndPassword.password.hash/verify` callbacks. It is not domain code and is
a hard gate before Stage 13E. Every password-bearing route uses the same sole
auth entry point; native routes that bypass it are not exposed.

### Exact selected password contract

- Normalize the raw JavaScript string to NFC exactly once, then use that same
  prepared value for Unicode-code-point length, common, contextual,
  compromised-password, credential hash, and comparison checks. Preserve spaces;
  never trim, truncate, or normalize again.
- Encode the prepared value as UTF-8 only after all policy checks. Never persist,
  log, queue, return, or externally transmit raw/prepared plaintext. Review tests
  store no password fixture.
- Hash with a fresh cryptographically random 16-byte salt and asynchronous Node
  scrypt using exactly `N=16384`, `r=16`, `p=1`, `dkLen=64`, and
  `maxmem=67,108,864` (`128*N*r*2`) bytes.
- Persist only
  `$passvero$scrypt$v=1$N=16384$r=16$p=1$dkLen=64$<22-char-salt>$<86-char-key>`
  with canonical unpadded base64url values.
- Verify through a strict full-string, fixed-length parser accepting only exact
  v1 labels/order/parameters, 16 decoded salt bytes, and 64 decoded derived-key
  bytes. Reject missing, duplicate, reordered, unknown, padded, noncanonical,
  overlong, out-of-range, and trailing input before KDF allocation. Compare only
  equal-length buffers with `crypto.timingSafeEqual`; every failure is generic.
- Accept no Better Auth `<hex-salt>:<hex-key>` default, NFKC-derived format, or
  other legacy/unknown envelope. There are no existing Passvero authentication
  credentials to migrate: the canonical schema contains no auth/provider account
  table, the repository still has no Better Auth dependency/source, and review
  performed no database access. Any later-discovered out-of-band store reopens
  the security/operator gate rather than gaining a fallback.
- Algorithm upgrades add a separately reviewed version and explicit accepted
  allowlist. After successful authentication, an accepted older Passvero version
  is rehashed from the already prepared NFC value with a fresh salt and replaced
  in the same credential transaction. Failed authentication never rehashes.
  Provider exit carries only the self-describing envelope and identity binding;
  a replacement implements the exact verifier or requires digest-only reset.

Exact source evidence:

- Default NFKC, fixed parameters, unversioned hex format, and string comparison:
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/@better-auth/utils/dist/password.node.mjs:3-41`.
- Supported custom asynchronous callback interface:
  `/private/tmp/passvero-better-auth-review-1-7-1/node_modules/@better-auth/core/dist/types/init-options.d.mts:720-733`.

### RED to GREEN evidence

- RED: `node --test tests/auth-foundation-review.test.mjs` returned exit 1 with
  12 passing and 1 failing test because the mandatory NFC password section was
  absent. No test password was stored.
- After adding the contract, two assertion-only line-wrap mismatches were
  corrected from literal spaces to whitespace-aware expressions; they did not
  change policy or implementation content.
- GREEN: the focused command returned exit 0 with 13 passing and 0 failing tests.
  The test pins exact source lines, equivalence risk, NFC-once ordering, callback
  ownership, scrypt parameters/memory, salt and envelope sizes, strict parsing,
  timing-safe comparison, generic failure, no default-hash acceptance, legacy
  state, rehash/exit behavior, and the explicit `REJECT` row.

### Verification and boundary evidence

- `node --test tests/*.test.mjs`: exit 0; 169 passed, 0 failed.
- `npm run test:application`: exit 0; 54 passed, 0 failed.
- `npm run test:infrastructure`: exit 0; 11 passed, 0 failed.
- `npm run lint`: exit 0 with no findings.
- `git diff --check`: exit 0.
- The authorized temporary `src/generated` symlink was used for the two
  TypeScript suites and removed before diff/status checks; no client was
  generated or copied.
- Forbidden-path diff from `331f8f1` remains empty for packages, `src/`,
  canonical schema/migrations, Prisma config, `.env*`, and generated clients.
- Fix packet commit: `b2f6121` (`docs: fix auth password normalization contract`).
- Fix Round 1 changes only the Task 5 review, focused test, and this required SDD
  report. No database/integration command, secret, environment read, or
  application/schema/migration change occurred.

Password hashing ownership remains `PASS` because the custom boundary is exact
and mandatory. Migration and exit cost remains the sole
`OPERATOR DECISION REQUIRED`; no new operator choice was introduced.
