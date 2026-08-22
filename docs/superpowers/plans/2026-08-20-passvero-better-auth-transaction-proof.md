# Passvero Better Auth Transaction Proof Implementation Plan

> **Historical consumed plan — do not execute or retry.** The one authorized
> invocation ended terminal `FAIL` before H1-H7 executed. The proof architecture
> is superseded by
> `docs/superpowers/reviews/2026-08-22-better-auth-native-lifecycle-disposition.md`.
> Retained proof state remains outside this document's authority.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a fail-closed, review-only PostgreSQL proof that determines whether Better Auth 1.7.1 can remain authoritative for credentials and sessions while its provider writes and Passvero-owned identity, activation, token, and abuse writes share one atomic transaction boundary.

**Architecture:** Pin and hash the reviewed Better Auth source before any database work, then copy deterministic harness sources into a unique protected run root and execute them against one fresh loopback-only PostgreSQL 16 cluster on port `55432`. Test native Better Auth behavior, an outer Prisma interactive transaction combined with `runWithTransaction` and direct `auth.api` dispatch, the incompatible `auth.handler` path, controlled activation, sessions/cookies, recovery, and routing as explicit hypotheses; emit only redacted evidence and stop on every drift, isolation, rollback, route, cookie, or cleanup failure.

**Tech Stack:** Better Auth 1.7.1, `@better-auth/prisma-adapter` 1.7.1, Prisma 7.8.0, `@prisma/adapter-pg` 7.8.0, PostgreSQL 16.10, Node.js 24.10.0, TypeScript, `node:test`.

**Spec:** `docs/superpowers/specs/2026-08-19-passvero-auth-dashboard-design.md`

## Global Constraints

- This is a review-only proof. Do not modify repository runtime source, `package.json`, `package-lock.json`, `prisma/schema.prisma`, `prisma/migrations`, `.env*`, or `src/generated`.
- Execute from the existing isolated worktree `/private/tmp/passvero-stage13a-auth-foundation-review`. Its ownership-reconciled pre-plan HEAD is `329ffa40f6a0508063034e8f3e3fa87ec6ed839e`; record the plan commit as the proof execution base before Task 1 and stop on unrelated tracked changes.
- Use only a fresh directory created by `mktemp -d /private/tmp/passvero-stage13a-pg.XXXXXX`; reject a pre-existing path, symlink, non-owner directory, or permissions other than `0700`.
- Use PostgreSQL binaries only from `/opt/homebrew/opt/postgresql@16/bin`; Docker is unavailable and must not be attempted.
- Use the single explicit port `55432`. If any TCP listener or PostgreSQL server already uses it, stop. Do not retry on another port.
- Never read, source, print, or pass the repository's `DATABASE_URL`, `TEST_DATABASE_URL`, or any `.env*` value. The disposable harness must not import `dotenv`.
- Generate a fresh database role name, database name, and password inside the protected run root. The password file is mode `0600`; its value and every constructed connection URL are forbidden from stdout, stderr, Git, JSON, Markdown, and test names.
- Invoke all harness and Prisma commands through `env -i` with only explicit `PATH`, `TMPDIR`, `PASSVERO_PROOF_RUN_ROOT`, `NODE_OPTIONS=--no-warnings`, and task-scoped npm cache/config variables under the validated disposable root. Do not set or repurpose `HOME`, `CODEX_HOME`, or any repository environment variable; repository Prisma configuration must never load.
- Do not run any Prisma command from the repository root, including `prisma --version`: an earlier repository-root `prisma --version` unexpectedly loaded `prisma.config.ts`. Version evidence must come from package metadata or from the isolated harness after its config-access guard passes.
- Pin installed `better-auth` and `@better-auth/prisma-adapter` to `1.7.1`, retain the reviewed `auth` CLI evidence at `1.7.1`, pin Prisma packages to `7.8.0`, and verify the installed source contents by hash before execution. Any source/API/hash mismatch is `STOP_SOURCE_DRIFT`.
- Better Auth Organization, Admin, OAuth, magic-link, 2FA, and passkey plugins remain excluded. Public self-registration, automatic same-email linking, Redis, cookie cache, and the Better Auth catch-all handler remain excluded.
- Do not accept Better Auth hooks as the transaction bridge: hook types expose no raw Prisma transaction, and a root-client hook write is outside the active transaction. Commit/rollback coupling must use the explicit outer transaction adapter.
- No plaintext activation, verification, reset, or session token; email; password; IP address; credential; cookie value; database URL; or raw system identifier may appear in evidence or logs.
- Any existing path/port, identity mismatch, unexpected environment/config access, partial rollback on an accepted path, cookie-before-commit, route bypass, uncontrolled sign-up, unexpected native behavior, or cleanup mismatch produces a terminal proof failure. The isolated H1 `transaction:false` split-write negative control is expected evidence, never an accepted path, and is the only permitted partial-write observation. Do not adjust the architecture or weaken an assertion during execution.
- Tasks 1–9 perform source, static, type, and reviewer gates only. They must not start PostgreSQL or execute a live hypothesis. Task 10 invokes `run-proof.sh --all` exactly once; a failed all-proof invocation is preserved and never retried.
- A passing proof can make the persistence contract `APPROVAL_READY`; it does not approve the canonical schema, migration, dependency, or implementation automatically.
- Every task is implemented by a fresh task agent and reviewed by a fresh task reviewer before the next task. A task with an open finding remains incomplete.

---

## Authoritative source contract

This plan consumes the reconciled status in
`docs/superpowers/reviews/2026-08-20-better-auth-foundation-review.md`, the
candidate acceptance inputs in
`docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/proposed-migration-contract.md`,
and the Stage 13A ownership reconciliation report. Their common starting state
is `AUTH_FOUNDATION_PERSISTENCE_CONTRACT=BLOCKED_PENDING_BETTER_AUTH_TRANSACTION_PROOF`,
Better Auth authority is frozen, and direct Passvero provider-table writes are
rejected.

The no-database source gate must preserve these reviewed 1.7.1 facts and hashes:

| Source | SHA-256 | Required observation |
| --- | --- | --- |
| `@better-auth/prisma-adapter/dist/index.mjs` | `166a05554f2e9fef2bf632a9aced0f328b0ffeb15e0ef2bbc8eeecc80e2ff145` | CRUD delegates use the supplied client at lines 170–202; adapter `transaction` defaults false and, when true, uses `$transaction` plus an adapter over `tx` at lines 415–433. |
| `@better-auth/core/src/context/transaction.ts` | `911e287b36b08b5ee4ca3fa2d30e926c6418f3c2ebf902bded85a577d0729117` | `getCurrentAdapter`, `runWithAdapter`, `runWithTransaction`, nested transaction reuse, after-commit queues, and fallback behavior are lines 36–190. |
| `@better-auth/core/package.json` | `2e154d4f7ba0ca6b6acf6714c8dccf529aaace552833f114d615ce01b3db610e` | `@better-auth/core/context` is a public export at lines 31–57. |
| `better-auth/dist/auth/base.mjs` | `64fd12c2e1857b57e9e872f6e5fbc424a909624750b9fbaf4b3d57e3869ba93a` | `auth.handler` wraps dispatch in `runWithAdapter(handlerCtx.adapter, ...)` at lines 17–40 and can overwrite an active adapter context. |
| `better-auth/dist/api/to-auth-endpoints.mjs` | `bdd6ee0fee9dd3c0467c26c86612f74750d1618bbec1f1421c575efb7e468ea6` | Direct `auth.api.*` dispatch does not call `runWithAdapter` at lines 34–55. |
| `better-auth/dist/db/with-hooks.mjs` | `e5f739e10ef22701814e7fd61b92118e3a757c8aa8f28783a691f5ff9d4084a8` | Provider CRUD resolves `getCurrentAdapter`; after hooks queue only after commit at lines 4–77. |
| `better-auth/dist/api/index.mjs` | `4913065fe270292704f4e2874a207c2396845e4b15dadd1623aae9d734e4e0ef` | Endpoint enumeration and router construction are lines 84–166; `disabledPaths` is enforced only by HTTP routing at lines 164–166. |
| `better-auth/dist/cookies/index.mjs` | `945bbb0bd0d77240bc74315c58f5ca74a62165ef605e30dfb336b34c0120665a` | Direct API cookie writes require response/header context at lines 167–180 and must be captured, not forwarded during a transaction. |
| `better-auth/dist/api/dispatch.mjs` | `18567f3d00a505d912edf655d881695302aefce4ab641648a5ef67452c04c1b0` | Direct-call response/header propagation must be exercised through Better Call dispatch rather than inferred. |
| `better-auth/dist/api/routes/sign-up.mjs` | `2b0415e806b5306bf7de9974b1fe31ebdb09401d7042a18a995b9f952edd0fc3` | Native sign-up transaction and user/account/session chain are lines 143–269. |
| `better-auth/dist/api/routes/sign-in.mjs` | `948cc7b1abc1f239378d934f9386a4b539c5cfdde60a326148e93dd40e39feef` | Credential lookup, verification, session creation, and cookie write are lines 307–368. |
| `better-auth/dist/api/routes/password.mjs` | `a2c44c376d1aba333161d3b9cc688e1cab6522b14d895f61382f1a8e31620286` | Reset issuance and consumption/password/session chain are lines 21–175. |
| `better-auth/dist/api/routes/session.mjs` | `831a00b6e144c1560c21406de1db586a67089630ad58fb2f3c7dcd3c5c963d57` | Native refresh/revoke behavior is evidence only and must not silently replace Passvero policy. |
| `better-auth/dist/api/routes/update-user.mjs` | `c4993821a1895ee5260f87ee50f8bb8762b450923e7a133edeb3f91d5ba15744` | Native password-change session replacement is evidence only and must preserve frozen session anchors in any accepted wrapper. |
| `@better-auth/core/src/api/index.ts` | `3eab3ac214b7d20b5e2c46d94b3c766c46408cf1348af4871ed4ec55cccf5c2e` | `createAuthEndpoint.serverOnly` sets `SERVER_ONLY`, has no path, remains callable through `auth.api`, and is excluded from the HTTP router at lines 169–215. |
| `better-auth/dist/plugins/anonymous/index.mjs` | `dd66d20b7b65d3fd18ccd6734dddd3ae5d79c30644fb952b651809604d0a9ac4` | An official Better Auth plugin uses `ctx.context.internalAdapter.createUser` and `createSession`; this proves the pinned plugin-authority pattern, not adoption of the anonymous plugin. |

## Planned file map

| Action | Path | Responsibility |
| --- | --- | --- |
| Create | `tests/auth-foundation-transaction-proof-source.test.mjs` | No-database source hashes, exports, routes, and source-contract drift gate. |
| Create | `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/package.json` | Exact disposable-only dependencies and scripts. |
| Create | `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/package-lock.json` | Deterministic dependency resolution generated only in the disposable copy and copied back after redaction review. |
| Create | `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/prisma/schema.prisma` | Exact provider models plus minimal disposable canonical/support models; never a canonical schema proposal. |
| Create | `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/prisma.config.ts` | No-dotenv config that constructs a URL from protected run-root identity files. |
| Create | `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/src/run-root.ts` | Fail-closed root, identity, environment, sentinel, and redaction validation. |
| Create | `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/src/auth.ts` | Pinned Better Auth configurations and adapter factories for native, direct-API, and handler hypotheses. |
| Create | `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/src/proof-boundary.ts` | Outer Prisma transaction, Better Auth adapter context, deferred-cookie result, and failure injection interface. |
| Create | `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/src/evidence.ts` | Redacted hypothesis records and deterministic JSON/Markdown rendering. |
| Create | `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/test/*.test.ts` | PostgreSQL hypotheses for native rollback, wrapper, handler, activation, session, recovery, and routes. |
| Create | `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/run-proof.sh` | Protected cluster bootstrap, one-shot proof, evidence capture, validated cleanup, and emergency stop. |
| Create | `tests/auth-foundation-transaction-proof-artifacts.test.mjs` | Repository-side redaction, deterministic-asset, and prohibited-mutation tests. |
| Create | `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/evidence.json` | Redacted machine-readable proof result. |
| Create | `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/evidence.md` | Redacted operator-readable evidence and cleanup result. |
| Modify | `docs/superpowers/reviews/2026-08-20-better-auth-foundation-review.md` | Proof conclusion and exact remaining approval state. |
| Modify | `docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/proposed-migration-contract.md` | Reconcile only evidence-backed runtime boundary statements; no SQL or schema approval. |

## Harness interfaces

```ts
export type HypothesisId =
  | "H1_NATIVE_TRANSACTION"
  | "H2_DIRECT_API_OUTER_TRANSACTION"
  | "H3_HANDLER_CONTEXT_REPLACEMENT"
  | "H4_CONTROLLED_ACTIVATION"
  | "H5_SESSION_COOKIE_AFTER_COMMIT"
  | "H6_RECOVERY_AND_REVOCATION"
  | "H7_ROUTE_EXPOSURE";

export type HypothesisStatus = "PASS" | "FAIL";
export type FailurePoint =
  | "NONE"
  | "AFTER_PROVIDER_WRITE"
  | "AFTER_CANONICAL_WRITE"
  | "AFTER_SESSION_WRITE"
  | "BEFORE_COMMIT"
  | "AFTER_COMMIT_CALLBACK";

export interface RowCounts {
  readonly providerUser: number;
  readonly providerAccount: number;
  readonly providerSession: number;
  readonly providerVerification: number;
  readonly canonicalUser: number;
  readonly authIdentity: number;
  readonly activation: number;
  readonly credentialToken: number;
  readonly abuseBucket: number;
}

export interface DeferredCookie {
  readonly present: boolean;
  readonly nameHash: string | null;
  readonly secure: boolean;
  readonly httpOnly: boolean;
  readonly sameSite: "lax" | null;
  readonly hostOnly: boolean;
  readonly maxAgeSeconds: number | null;
}

export interface HypothesisEvidence {
  readonly id: HypothesisId;
  readonly status: HypothesisStatus;
  readonly transactionIds: readonly string[];
  readonly before: RowCounts;
  readonly after: RowCounts;
  readonly cookie: DeferredCookie;
  readonly assertions: readonly string[];
  readonly failureCode: string | null;
}

export interface BoundaryResult<T> {
  readonly value: T;
  readonly cookie: DeferredCookie;
  readonly committed: true;
}

export async function runBetterAuthBoundary<T>(input: {
  readonly rootPrisma: PrismaClient;
  readonly invoke: (auth: ReturnType<typeof betterAuth>, tx: TransactionClient) => Promise<T>;
  readonly failurePoint: FailurePoint;
}): Promise<BoundaryResult<T>>;
```

`runBetterAuthBoundary` must open one Prisma interactive transaction, construct the Prisma adapter over that exact `tx`, call `runWithTransaction(txAdapter, () => direct auth.api invocation)`, perform Passvero-owned writes using the same `tx`, capture response headers in memory, and return cookie metadata only after Prisma resolves the commit. It must never invoke `auth.handler`, enqueue a root-Prisma hook write, expose the transaction client outside the function, or return a raw cookie value.

---

### Task 1: Freeze the no-database source and API contract

**Files:**
- Create: `tests/auth-foundation-transaction-proof-source.test.mjs`
- Modify: none

**Interfaces:**
- Consumes: the authoritative source table above and `/private/tmp/passvero-better-auth-review-1-7-1`.
- Produces: a zero-database `SOURCE_CONTRACT=PASS` gate required before the harness is created or run.

- [ ] **Step 1: Write the failing source-contract test**

Create a `node:test` suite that reads only the sixteen listed package files, computes SHA-256, asserts every exact digest, and asserts these literal source patterns: `transaction: config.transaction ?? false`, `prisma.$transaction`, `getCurrentAdapter`, `runWithTransaction`, `store?.isTransactionActive`, `runWithAdapter(handlerCtx.adapter`, `dispatchAuthEndpoint`, `disabledPaths.includes`, `disableSignUp`, `createSession`, `setSessionCookie`, `consumeVerificationValue`, `deleteUserSessions`, `createAuthEndpoint.serverOnly`, `SERVER_ONLY`, and `internalAdapter.createUser`. Also resolve `@better-auth/core/context` through `createRequire` and assert the public functions `getCurrentAdapter` and `runWithTransaction` exist.

```js
const REVIEW_ROOT = "/private/tmp/passvero-better-auth-review-1-7-1";
const EXPECTED = new Map([
  ["node_modules/@better-auth/prisma-adapter/dist/index.mjs", "166a05554f2e9fef2bf632a9aced0f328b0ffeb15e0ef2bbc8eeecc80e2ff145"],
  ["node_modules/@better-auth/core/src/context/transaction.ts", "911e287b36b08b5ee4ca3fa2d30e926c6418f3c2ebf902bded85a577d0729117"],
  ["node_modules/@better-auth/core/package.json", "2e154d4f7ba0ca6b6acf6714c8dccf529aaace552833f114d615ce01b3db610e"],
  ["node_modules/better-auth/dist/auth/base.mjs", "64fd12c2e1857b57e9e872f6e5fbc424a909624750b9fbaf4b3d57e3869ba93a"],
  ["node_modules/better-auth/dist/api/to-auth-endpoints.mjs", "bdd6ee0fee9dd3c0467c26c86612f74750d1618bbec1f1421c575efb7e468ea6"],
  ["node_modules/better-auth/dist/db/with-hooks.mjs", "e5f739e10ef22701814e7fd61b92118e3a757c8aa8f28783a691f5ff9d4084a8"],
  ["node_modules/better-auth/dist/api/index.mjs", "4913065fe270292704f4e2874a207c2396845e4b15dadd1623aae9d734e4e0ef"],
  ["node_modules/better-auth/dist/cookies/index.mjs", "945bbb0bd0d77240bc74315c58f5ca74a62165ef605e30dfb336b34c0120665a"],
  ["node_modules/better-auth/dist/api/dispatch.mjs", "18567f3d00a505d912edf655d881695302aefce4ab641648a5ef67452c04c1b0"],
  ["node_modules/better-auth/dist/api/routes/sign-up.mjs", "2b0415e806b5306bf7de9974b1fe31ebdb09401d7042a18a995b9f952edd0fc3"],
  ["node_modules/better-auth/dist/api/routes/sign-in.mjs", "948cc7b1abc1f239378d934f9386a4b539c5cfdde60a326148e93dd40e39feef"],
  ["node_modules/better-auth/dist/api/routes/password.mjs", "a2c44c376d1aba333161d3b9cc688e1cab6522b14d895f61382f1a8e31620286"],
  ["node_modules/better-auth/dist/api/routes/session.mjs", "831a00b6e144c1560c21406de1db586a67089630ad58fb2f3c7dcd3c5c963d57"],
  ["node_modules/better-auth/dist/api/routes/update-user.mjs", "c4993821a1895ee5260f87ee50f8bb8762b450923e7a133edeb3f91d5ba15744"],
  ["node_modules/@better-auth/core/src/api/index.ts", "3eab3ac214b7d20b5e2c46d94b3c766c46408cf1348af4871ed4ec55cccf5c2e"],
  ["node_modules/better-auth/dist/plugins/anonymous/index.mjs", "dd66d20b7b65d3fd18ccd6734dddd3ae5d79c30644fb952b651809604d0a9ac4"],
]);
```

- [ ] **Step 2: Run the test and observe RED**

Run from the repository worktree:

```bash
node --test tests/auth-foundation-transaction-proof-source.test.mjs
```

Expected: FAIL because the source-contract test has not yet implemented every assertion. No database process exists and no PostgreSQL command runs.

- [ ] **Step 3: Implement the exact hash, line-range, export, and API assertions**

Use `readFile`, `createHash("sha256")`, `assert.match`, and `createRequire(`${REVIEW_ROOT}/package.json`)`. The test must additionally assert installed `better-auth`, `@better-auth/prisma-adapter`, and `@better-auth/core` package versions are exactly `1.7.1`, and `@prisma/client` plus `prisma` are exactly `7.8.0`. The CLI package `auth` is not installed in the source-review root; assert the reconciled review artifact records `CLI: auth 1.7.1` from the already captured registry/generator evidence instead of importing or installing it. Fail with a message beginning `STOP_SOURCE_DRIFT:` on any mismatch.

- [ ] **Step 4: Run the zero-database gate and observe GREEN**

```bash
env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="/private/tmp" NODE_OPTIONS="--no-warnings" /opt/homebrew/bin/node --test tests/auth-foundation-transaction-proof-source.test.mjs
```

Expected: PASS with `SOURCE_CONTRACT=PASS`; `pgrep -f 'passvero-stage13a-pg'` returns no process. If the test fails, stop the plan before Task 2.

- [ ] **Step 5: Commit and request a fresh task review**

```bash
git add tests/auth-foundation-transaction-proof-source.test.mjs
git commit -m "test: freeze Better Auth transaction source contract"
```

Reviewer gate: confirm the test performs no imports that initialize Better Auth, Prisma, dotenv, or PostgreSQL and that all hashes and cited line contracts match the table above.

### Task 2: Build the deterministic disposable proof harness

**Files:**
- Create: `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/package.json`
- Create: `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/package-lock.json`
- Create: `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/prisma/schema.prisma`
- Create: `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/prisma.config.ts`
- Create: `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/src/run-root.ts`
- Create: `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/src/auth.ts`
- Create: `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/src/proof-boundary.ts`
- Create: `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/src/evidence.ts`
- Create: `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/test/harness-contract.test.ts`
- Create: `tests/auth-foundation-transaction-proof-artifacts.test.mjs`

**Interfaces:**
- Consumes: `SOURCE_CONTRACT=PASS` and the interfaces in this plan.
- Produces: deterministic harness assets that are copied to `$PASSVERO_PROOF_RUN_ROOT/harness`; repository imports never execute them.

- [ ] **Step 1: Write failing repository artifact tests**

Assert that every file in the map exists, `package.json` is private and pins exact versions, `prisma.config.ts` contains no `dotenv`, `process.env.DATABASE_URL`, `process.env.TEST_DATABASE_URL`, or repository import, and every executable harness source rejects a missing/invalid `PASSVERO_PROOF_RUN_ROOT`. Assert forbidden text patterns across all future committed proof assets: `postgresql://`, `postgres://`, `DATABASE_URL=`, `TEST_DATABASE_URL=`, `Set-Cookie:`, `token=`, `password=`, and `/Users/`.

- [ ] **Step 2: Run the artifact tests and observe RED**

```bash
node --test tests/auth-foundation-transaction-proof-artifacts.test.mjs
```

Expected: FAIL because the harness assets do not exist.

- [ ] **Step 3: Create the pinned private harness manifest**

Use this dependency surface, with an npm-generated lockfile whose root versions match exactly:

```json
{
  "name": "passvero-better-auth-transaction-proof",
  "private": true,
  "type": "module",
  "scripts": {
    "generate": "prisma generate --config ./prisma.config.ts",
    "schema:sql": "prisma migrate diff --from-empty --to-schema ./prisma/schema.prisma --script --config ./prisma.config.ts",
    "test": "node --import tsx --test --test-concurrency=1 test/*.test.ts"
  },
  "dependencies": {
    "@better-auth/core": "1.7.1",
    "@better-auth/prisma-adapter": "1.7.1",
    "@prisma/adapter-pg": "7.8.0",
    "@prisma/client": "7.8.0",
    "better-auth": "1.7.1",
    "pg": "8.16.3"
  },
  "devDependencies": {
    "prisma": "7.8.0",
    "tsx": "4.20.6",
    "typescript": "5.9.2"
  }
}
```

Generate `package-lock.json` only in a disposable copy using `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`, inspect it for exact root versions and prohibited URLs/credentials, then copy only the reviewed lockfile back with `apply_patch`. Do not run npm in the repository.

- [ ] **Step 4: Create the minimal disposable Prisma schema**

Copy the exact generated provider models `AuthProviderUser`, `AuthProviderSession`, `AuthProviderAccount`, and `AuthProviderVerification` from the retained generated artifact. Add only: minimal canonical `User(id UUID, email, createdAt, updatedAt)`, `AuthIdentity(provider, providerSubject, userId)`, `AccountActivation(userId, tokenDigest, intendedEmailDigest, expiresAt, consumedAt, invalidatedAt)`, `AuthCredentialToken(purpose, providerUserId, tokenDigest, targetEmailDigest, expiresAt, consumedAt, invalidatedAt)`, `AuthAbuseBucket(dimension, keyDigest, endpoint, failureCount, blockedUntil, updatedAt)`, and a `ProofMarker(label unique, transactionId, createdAt)` table. Add provider-session fields `authenticatedAt`, `lastRefreshAt`, and nullable `selectedOrganizationId` without importing the canonical Organization model; this proof stores selection as nullable UUID only.

The disposable schema must map the provider tables exactly, add unique `(provider, providerSubject)`, unique token digests, provider/canonical foreign keys, active-token partial uniqueness through generated SQL in the next task, and generate to `./generated/client`. It must contain a comment: `DISPOSABLE_PROOF_ONLY_NOT_CANONICAL_SCHEMA`. Use this complete minimal support shape around the exact four provider models copied from `generated-prisma-schema.prisma` (the provider session additionally receives required `lastRefreshAt`):

```prisma
// DISPOSABLE_PROOF_ONLY_NOT_CANONICAL_SCHEMA
generator client {
  provider = "prisma-client"
  output   = "../generated/client"
}

datasource db {
  provider = "postgresql"
}

enum AuthCredentialTokenPurpose {
  EMAIL_VERIFICATION
  PASSWORD_RESET
}

enum AuthAbuseDimension {
  TRUSTED_NETWORK
  ACCOUNT_IDENTIFIER
  ACCOUNT_AND_TRUSTED_NETWORK
  GLOBAL_ENDPOINT
}

model User {
  id                 String              @id @default(uuid()) @db.Uuid
  email              String              @unique
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt
  authIdentities     AuthIdentity[]
  accountActivations AccountActivation[] @relation("UserAccountActivations")

  @@map("ProofCanonicalUser")
}

model AuthIdentity {
  id              String   @id @default(uuid()) @db.Uuid
  provider        String
  providerSubject String
  userId          String   @db.Uuid
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  user            User     @relation(fields: [userId], references: [id], onDelete: Restrict, onUpdate: Cascade)

  @@unique([provider, providerSubject])
  @@index([userId])
}

model AccountActivation {
  id                  String    @id @default(uuid()) @db.Uuid
  userId              String    @db.Uuid
  tokenDigest         String    @unique @db.VarChar(43)
  intendedEmailDigest String    @db.VarChar(43)
  expiresAt           DateTime
  consumedAt          DateTime?
  invalidatedAt       DateTime?
  createdAt           DateTime  @default(now())
  user                User      @relation("UserAccountActivations", fields: [userId], references: [id], onDelete: Restrict, onUpdate: Cascade)

  @@index([userId])
  @@index([expiresAt])
}

model AuthCredentialToken {
  id                String                     @id @default(uuid()) @db.Uuid
  providerUserId    String
  purpose           AuthCredentialTokenPurpose
  tokenDigest       String                     @unique @db.VarChar(43)
  targetEmailDigest String                     @db.VarChar(43)
  expiresAt         DateTime
  consumedAt        DateTime?
  invalidatedAt     DateTime?
  createdAt         DateTime                   @default(now())
  providerUser      AuthProviderUser           @relation("AuthProviderUserCredentialTokens", fields: [providerUserId], references: [id], onDelete: Cascade, onUpdate: Cascade)

  @@index([providerUserId, purpose])
  @@index([expiresAt])
}

model AuthAbuseBucket {
  id               String             @id @default(uuid()) @db.Uuid
  dimension        AuthAbuseDimension
  keyDigest        String             @unique @db.VarChar(43)
  attemptCount     Int                @default(0)
  failureCount     Int                @default(0)
  backoffLevel     Int                @default(0)
  windowStartedAt  DateTime
  lastFailureAt    DateTime?
  backoffUpdatedAt DateTime
  blockedUntil     DateTime?
  expiresAt        DateTime
  updatedAt        DateTime           @updatedAt

  @@index([dimension, blockedUntil])
  @@index([expiresAt])
}

model ProofMarker {
  id            String   @id @default(uuid()) @db.Uuid
  label         String   @unique
  transactionId String
  createdAt     DateTime @default(now())
}
```

Add `credentialTokens AuthCredentialToken[] @relation("AuthProviderUserCredentialTokens")` to `AuthProviderUser`; add `lastRefreshAt DateTime` plus `@@index([lastRefreshAt])` to `AuthProviderSession`. `selectedOrganizationId` remains the generated nullable `String?` in this disposable proof because the canonical `Organization` model is deliberately absent; tests accept only UUID-formatted values and the future canonical schema contract still requires the reviewed UUID foreign key.

- [ ] **Step 5: Implement protected run-root configuration**

`readRunIdentity()` must require an absolute real path matching `/private/tmp/passvero-stage13a-pg.[A-Za-z0-9]+`, reject symlinks, require owner UID equals `process.getuid()`, mode `0700`, and read exactly `identity/superuser-role`, `identity/superuser-password`, `identity/application-role`, `identity/application-password`, `identity/database`, `identity/port`, and `identity/socket-dir`. It validates the independently generated names against `^pvproof_admin_[a-f0-9]{12}$`, `^pvproof_app_[a-f0-9]{12}$`, and `^pvproof_test_[a-f0-9]{12}$`; port equals `55432`; each password is exactly 48 canonical base64url characters; and the socket path is inside the real run root. `buildConnectionString()` uses only the application role/password and returns the URL only to Prisma config/runtime; neither role's password is exportable to evidence.

`prisma.config.ts` imports only `defineConfig`, `readRunIdentity`, and `buildConnectionString`; it must not import dotenv or use a database environment variable:

```ts
const identity = readRunIdentity();
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: buildConnectionString(identity) },
});
```

- [ ] **Step 6: Implement the Better Auth and transaction-boundary factories**

Create `createProofAuth({ prisma, adapterTransaction, disableSignUp })` with `baseURL: "https://auth-proof.invalid/internal-auth"`, `basePath: "/internal-auth"`, `secret` read only from `$RUN_ROOT/identity/auth-secret`, `emailAndPassword.enabled: true`, `disableSignUp`, `requireEmailVerification: true`, `autoSignIn: false`, `revokeSessionsOnPasswordReset: true`, `session.disableSessionRefresh: true`, cookie cache disabled, Secure/HttpOnly/SameSite=Lax cookies, and the three server-owned session fields. Configure `disabledPaths` to every enumerated built-in path for handler tests.

Implement `runBetterAuthBoundary` exactly as the plan interface. The minimal transaction body is:

```ts
const pending = await input.rootPrisma.$transaction(
  async (tx) => {
    const auth = createProofAuth({
      prisma: tx,
      adapterTransaction: false,
      disableSignUp: true,
    });
    const adapter = (await auth.$context).adapter;
    return runWithTransaction(adapter, async () => {
      const value = await input.invoke(auth, tx);
      injectFailure(input.failurePoint, "BEFORE_COMMIT");
      return { value, capturedHeaders: takeCapturedHeaders() };
    });
  },
  { isolationLevel: "Serializable" },
);
return finalizeAfterCommit(pending);
```

The exact adapter/context types must be inferred from the 1.7.1 public APIs rather than cast to `any`; if the public API cannot supply the required `DBAdapter`, record `H2_DIRECT_API_OUTER_TRANSACTION=FAIL` and stop rather than importing an unexported module.

Capture direct-call headers in a local response object. Convert a cookie to `DeferredCookie` only after the outer `$transaction` promise fulfills. Raw header strings and tokens may exist only in memory and must be overwritten/dropped before evidence rendering.

- [ ] **Step 7: Implement deterministic redacted evidence rendering**

Evidence JSON contains only package hashes, opaque cluster ID hash, hashed PostgreSQL version/system identifier, hypothesis ID/status, row-count deltas, transaction ID hashes, cookie presence/attribute booleans, failure codes, cleanup booleans, and assertions. The renderer recursively rejects keys matching `/token|password|secret|email|ipAddress|url|cookieValue/i` and string values matching database URL, JWT, email, or `Set-Cookie` patterns.

- [ ] **Step 8: Run no-database harness contract tests**

Copy the harness to a fresh directory created by `mktemp -d /private/tmp/passvero-stage13a-harness.XXXXXX`, validate that exact root with the same owner/mode/no-symlink rules, and run `npm ci --ignore-scripts --no-audit --no-fund`, TypeScript typecheck, and `harness-contract.test.ts` under `env -i`. Supply `TMPDIR`, `npm_config_cache`, and `npm_config_userconfig` only inside that root; do not set `HOME`. The test uses a synthetic protected run-root structure but never constructs Prisma or connects. Validate and remove only this static root after the checks.

Expected: manifest, type, environment, redaction, and path tests PASS; PostgreSQL process count remains zero.

- [ ] **Step 9: Commit and request a fresh task review**

```bash
git add tests/auth-foundation-transaction-proof-artifacts.test.mjs docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness
git commit -m "test: add disposable Better Auth proof harness"
```

Reviewer gate: reject any environment fallback, repository config import, unpinned dependency, secret-bearing diagnostic, canonical-schema resemblance beyond the enumerated minimal models, `any` cast around the adapter boundary, or direct provider write.

### Task 3: Implement and review the disposable PostgreSQL lifecycle

**Files:**
- Create: `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/run-proof.sh`
- Create: `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/test/cluster-identity.test.ts`
- Modify: `tests/auth-foundation-transaction-proof-artifacts.test.mjs`

**Interfaces:**
- Consumes: protected run-root functions from Task 2.
- Produces: one-shot cluster lifecycle with `CLUSTER_IDENTITY=PASS` before SQL and `CLEANUP=PASS` after evidence capture.

- [ ] **Step 1: Add failing static lifecycle tests**

Assert `run-proof.sh` accepts only `--static` and `--all`, contains `set -euo pipefail`, `umask 077`, exact port `55432`, exact PostgreSQL 16 binary prefix, `mktemp -d /private/tmp/passvero-stage13a-pg.XXXXXX`, a sentinel constant, preflight listener check, cleanup validator, and trap. Assert `--static` cannot call `initdb`, `pg_ctl`, `createdb`, `psql`, or any generated Prisma client. Assert the script does not contain `docker`, `source .env`, `DATABASE_URL`, `TEST_DATABASE_URL`, `rm -rf /`, a globbed delete, or port increment/retry logic.

- [ ] **Step 2: Run static tests and observe RED**

```bash
node --test tests/auth-foundation-transaction-proof-artifacts.test.mjs
```

Expected: FAIL because the lifecycle script is absent.

- [ ] **Step 3: Implement fail-closed bootstrap**

The script first validates its sole argument. `--static` performs only the validated static-root copy/install/type/source checks and exits; Tasks 1–9 may call it repeatedly. `--all` may be invoked exactly once in Task 10. Before the `--all` run creates any root, it executes Task 1 and checks TCP port `55432` with both `/usr/sbin/lsof -nP -iTCP:55432 -sTCP:LISTEN` and `pg_isready -h 127.0.0.1 -p 55432`; either indication aborts before `mktemp`. Set `umask 077`, create the run root once, write `.passvero-stage13a-proof-root` containing constant `PASSVERO_STAGE13A_PG_V1` plus a generated opaque run ID, and call a reviewed `run-root.ts bootstrap` command that uses `randomBytes` plus `writeFile(..., { mode: 0o600, flag: "wx" })` to create independently generated superuser/application roles, database name, 48-character canonical base64url passwords, and 48-character Better Auth secret without stdout. Shell redirection must not create secrets.

Initialize with:

```bash
/opt/homebrew/opt/postgresql@16/bin/initdb -D "$RUN_ROOT/data" --encoding=UTF8 --locale=C --username="$(<"$RUN_ROOT/identity/superuser-role")" --auth-local=scram-sha-256 --auth-host=scram-sha-256 --pwfile="$RUN_ROOT/identity/superuser-password"
/opt/homebrew/opt/postgresql@16/bin/pg_ctl -D "$RUN_ROOT/data" -l "$RUN_ROOT/log/postgres.log" -o "-h 127.0.0.1 -p 55432 -k $RUN_ROOT/socket -c listen_addresses=127.0.0.1 -c unix_socket_permissions=0700" start
```

Connect as the generated cluster superuser over loopback using only protected files, create exactly the generated application role and database, set the role password without placing it in command arguments or output, and make the application role the database owner. Revoke public database/schema privileges. Reconnect over TCP as the application role, then write the sentinel database table/row containing the opaque run ID hash. No SQL command may interpolate an unvalidated identifier; use `psql` variables after regex validation and identifier quoting.

- [ ] **Step 4: Implement the identity gate before schema application**

Query, without printing credentials: `current_database()`, `current_user`, `inet_server_port()`, `current_setting('data_directory')`, `current_setting('unix_socket_directories')`, `pg_control_system().system_identifier`, and the sentinel row. `cluster-identity.test.ts` compares all values to protected expected files, realpaths `data_directory`, requires server port `55432`, and hashes system identifier before retaining it. Any mismatch stops before Prisma generation or schema SQL.

- [ ] **Step 5: Generate and apply disposable SQL only**

Copy committed harness assets into `$RUN_ROOT/harness`, run `npm ci`, `prisma generate`, and `prisma migrate diff --from-empty ... --script` only from that copy in the scrubbed environment. Save SQL under `$RUN_ROOT/sql/schema.sql`, inspect that every table is in the disposable allowlist, append the exact partial active-token indexes/check constraints needed by the proof, and apply with `psql -X -v ON_ERROR_STOP=1`. Never use `prisma migrate`, `db push`, or repository Prisma config.

- [ ] **Step 6: Implement emergency stop and validated cleanup**

The trap may stop/delete only when: the resolved root matches `/private/tmp/passvero-stage13a-pg.[A-Za-z0-9]+`; it is not `/private/tmp`, `/`, `$HOME`, or the repository; it is owner-only, not a symlink; sentinel file content and sentinel DB row match; the recorded postmaster PID belongs to the same data directory; and system identifier matches the recorded hash. On validation failure, stop the known PID with `pg_ctl` if identity is still proven, retain the directory, print only `CLEANUP=FAIL_RETAINED:<opaque-root-basename>`, and require operator review.

Before cleanup, render and validate a redacted draft at the repository asset
path `evidence.pending.json`; this draft may contain no cleanup verdict and is
not staged or committed. Then run `pg_ctl ... stop -m fast`, require
`pg_isready` failure, require no listener at `55432`, require recorded PID
absent, execute exactly `rm -rf -- "$RUN_ROOT_REAL"` only after every preceding validation succeeds, and require path absence. `RUN_ROOT_REAL` must be a literal validated scalar, never a glob, substitution result used without comparison, `/private/tmp`, `/`, a home directory, or the repository.
Record four booleans: `serverStopped`, `listenerGone`, `pidGone`, `rootGone`.
Only after all four checks complete may the script merge them into final
`evidence.json`/`evidence.md` and delete the explicit pending file. On cleanup
failure, finalize a FAIL artifact before returning nonzero; never report PASS
without all four booleans.

- [ ] **Step 7: Run static tests only and commit**

Do not start PostgreSQL in this task. Run the source and artifact suites plus `run-proof.sh --static`; expected PASS. A process/listener check before and after must prove that no PostgreSQL cluster was started.

```bash
git add docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/run-proof.sh docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/test/cluster-identity.test.ts tests/auth-foundation-transaction-proof-artifacts.test.mjs
git commit -m "test: guard disposable PostgreSQL proof lifecycle"
```

Reviewer gate: manually trace every cleanup branch and confirm no unvalidated recursive deletion, broad target, port fallback, secret output, or existing-database path exists.

### Task 4: Prove native adapter transaction behavior

**Files:**
- Create: `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/test/native-transaction.test.ts`
- Modify: `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/src/evidence.ts`

**Interfaces:**
- Consumes: fresh verified disposable cluster and `createProofAuth`.
- Produces: `H1_NATIVE_TRANSACTION` evidence for `transaction:false`, `transaction:true`, and nested behavior.

- [ ] **Step 1: Write failing H1 tests**

Create unique opaque fixture IDs. Inject failure specifically when `AuthProviderAccount.create` executes after provider user creation. With adapter transaction false, call direct `auth.api.signUpEmail` using a proof-only configuration with `disableSignUp:false`; assert user delta `+1`, account delta `0` as the expected split-write baseline, then clean the fixture inside the disposable database. With transaction true, repeat and assert both deltas `0`. Record `txid_current()` hashes around every write.

- [ ] **Step 2: Run the no-database H1 source/manifest gate and observe RED**

Run the repository artifact test and `run-proof.sh --static`. Expected: FAIL because the H1 scenario manifest and typed assertions are incomplete. PostgreSQL must not start. Runtime H1 remains `NOT_EXECUTED` until Task 10's single `--all` run.

- [ ] **Step 3: Implement adapter instrumentation without provider writes**

Wrap Prisma delegates only to observe model/action and inject an exception; all successful provider writes must still originate from Better Auth. Add nested calls proving `transaction:true` creates one Prisma transaction for native sign-up and `runWithTransaction` reuses the active adapter rather than opening a second transaction. Also run a `transaction:false` adapter inside an already active tx-bound adapter and assert it delegates to the supplied tx.

- [ ] **Step 4: Run H1 static/type checks to GREEN and commit**

Expected before live proof: the typed H1 test encodes the expected negative-control split, accepted rollback, nested transaction-ID, no-session/cookie, and fixture-cleanup assertions; source/artifact/static checks PASS and no PostgreSQL process exists. Task 10 alone determines the runtime H1 verdict.

```bash
git add docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/test/native-transaction.test.ts docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/src/evidence.ts
git commit -m "test: prove Better Auth native transaction behavior"
```

Reviewer gate: distinguish the intentionally expected split-write baseline from accepted architecture; `transaction:false` outside the explicit outer boundary must remain rejected.

### Task 5: Prove the direct API boundary and reject handler replacement

**Files:**
- Create: `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/test/direct-boundary.test.ts`
- Create: `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/test/handler-boundary.test.ts`
- Modify: `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/src/proof-boundary.ts`

**Interfaces:**
- Consumes: `runBetterAuthBoundary` and source evidence that direct API does not overwrite current adapter.
- Produces: H2 commit/rollback proof and H3 handler incompatibility evidence.

- [ ] **Step 1: Write failing H2/H3 matrix tests**

For direct `auth.api` dispatch, create provider credential through Better Auth plus canonical `AuthIdentity`, abuse update, and token consumption using the same `tx`. Test success and injected failures `AFTER_PROVIDER_WRITE`, `AFTER_CANONICAL_WRITE`, and `BEFORE_COMMIT`; every failure must leave every row delta zero. Reverse the logical order in a second case so failure after canonical/support writes also rolls back provider writes. Assert all write transaction-ID hashes are equal within a case.

Add deterministic serialization/deadlock cases. An orchestration wrapper may retry only PostgreSQL `40001`/`40P01` or Prisma `P2034`, only after the attempt is proven rolled back, at most three total attempts, with no cookie emitted and no externally visible callback from a failed attempt. Constraint, validation, credential, unknown, connection, commit-ambiguity, and after-commit failures are never retried. Record attempt count and final row deltas without recording error text that could contain data.

For `auth.handler`, place an outer tx adapter in `runWithTransaction`, invoke an HTTP Request at the configured base path, inject failure after the handler returns, and assert observed provider writes do not share the outer tx. H3 passes only by proving the handler is unsafe/rejected for this boundary.

- [ ] **Step 2: Run the no-database H2/H3 source/manifest gate and observe RED**

Run the repository artifact test and `run-proof.sh --static`. Expected: FAIL because the outer-adapter, retry, handler-replacement, and deferred-failure scenario manifests are incomplete. PostgreSQL must not start; H2/H3 remain `NOT_EXECUTED` until Task 10.

- [ ] **Step 3: Implement the exact direct boundary**

Construct the Better Auth instance inside the outer Prisma callback over `tx`; resolve its configured adapter and pass it to public `runWithTransaction`; invoke only `auth.api.*`. Assert `getCurrentAdapter` returns the tx-bound adapter before, during, and after nested Better Auth calls. Explicitly test adapter `transaction:true` and false in the outer boundary; accept only the mode that creates no nested Prisma transaction error and retains one rollback domain. Freeze that exact mode in evidence.

Run the retry classifier against injected `40001`, `40P01`, `P2034`, unique-constraint, generic, and simulated ambiguous-commit errors. Require attempt counts `3,3,3,1,1,1` respectively and require no retry after any commit marker or captured post-commit cookie becomes eligible.

- [ ] **Step 4: Demonstrate handler context replacement**

Do not repair the handler path. Record whether provider state committed separately or otherwise escaped the injected outer rollback, plus the source mechanism at `base.mjs:17-40`. Assert `auth.handler` and the catch-all route are prohibited by the accepted boundary even if a specific test happens to roll back due to unrelated adapter configuration.

- [ ] **Step 5: Run H2/H3 static/type checks to GREEN and commit**

Expected before live proof: the typed tests encode one-transaction/zero-row rollback requirements and handler rejection, all static/type checks PASS, and no PostgreSQL process exists. Task 10 alone assigns H2/H3 PASS or FAIL.

```bash
git add docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/src/proof-boundary.ts docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/test/direct-boundary.test.ts docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/test/handler-boundary.test.ts
git commit -m "test: prove direct Better Auth transaction boundary"
```

Reviewer gate: confirm Passvero never writes provider tables, root Prisma never appears in hooks, all external writes use `tx`, and handler rejection cannot be interpreted as optional.

### Task 6: Prove controlled activation without public self-registration

**Files:**
- Create: `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/test/controlled-activation.test.ts`
- Modify: `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/src/auth.ts`

**Interfaces:**
- Consumes: H2 direct transaction boundary and preprovisioned disposable canonical User/AccountActivation.
- Produces: H4 verdict on a Better Auth-authoritative server-only activation mechanism.

- [ ] **Step 1: Write the failing activation matrix**

Preprovision canonical user plus a 32-byte activation digest and intended-email digest. Test valid single use, expired token, superseded token, wrong canonical-email digest, existing provider email, existing provider subject, existing AuthIdentity, two concurrent consumers, and failures after provider credential creation and after AuthIdentity creation. Success must atomically consume activation, create provider user/account through Better Auth, bind `AuthIdentity`, update abuse state, create no session, and leave email verification false until the separately controlled verification step.

- [ ] **Step 2: Prove public unreachability before activation success**

With production-shaped config `disableSignUp:true`, require direct `auth.api.signUpEmail` and HTTP `/sign-up/email` both reject. Enumerate handler endpoints and require every sign-up route disabled. The controlled mechanism may use a server-only Better Auth endpoint/plugin whose implementation calls Better Auth internal adapter under the H2 context; it must not toggle a shared auth instance to `disableSignUp:false`, expose a Request handler, or write provider tables directly.

- [ ] **Step 3: Implement the minimal proof-only server plugin**

Create a proof plugin with one endpoint named `activatePreprovisionedCredential` declared exactly through public `createAuthEndpoint.serverOnly({ method: "POST", body: activationSchema }, handler)`. In pinned 1.7.1 this sets `metadata.SERVER_ONLY`, has no path, remains callable through `auth.api`, and is excluded from the HTTP router. Its handler accepts already-validated opaque internal inputs and calls `ctx.context.internalAdapter.createUser` plus `linkAccount`, the same pinned internal-adapter pattern used by official Better Auth plugins and native sign-up. The endpoint is called only through direct `auth.api.activatePreprovisionedCredential` inside `runBetterAuthBoundary`; production-shaped built-in signup remains disabled.

If Better Auth 1.7.1 cannot expose the required provider-authoritative operation through this public server-only endpoint surface and the typed `AuthContext.internalAdapter`, set H4 to FAIL with `NO_SUPPORTED_SERVER_ONLY_ACTIVATION_PATH`, stop all later hypotheses, and do not import unexported modules or invent direct provider writes. Acceptance is pinned-version-specific and requires a renewed source/proof review on upgrade.

- [ ] **Step 4: Run H4 static/type checks and commit**

The typed test must require exactly one winning concurrent consumer, one provider user/account, one AuthIdentity, consumed activation, zero sessions/cookies, one transaction ID, and zero deltas for every injected failure. Run artifact tests and `run-proof.sh --static`; no database starts. Task 10 assigns H4 PASS/FAIL. Any reachable public signup during that one live run is terminal FAIL.

```bash
git add docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/src/auth.ts docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/test/controlled-activation.test.ts
git commit -m "test: prove controlled Better Auth activation boundary"
```

Reviewer gate: independently trace the endpoint registry and HTTP router; do not accept “not linked from UI” as route unreachability.

### Task 7: Prove sign-in, session anchors, and post-commit cookies

**Files:**
- Create: `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/test/session-boundary.test.ts`
- Modify: `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/src/proof-boundary.ts`

**Interfaces:**
- Consumes: verified activated credential and H2 boundary.
- Produces: H5 verdict for session creation, `authenticatedAt`/`lastRefreshAt`, rotation feasibility, and cookie deferral.

- [ ] **Step 1: Write failing session tests**

Exercise invalid email, invalid password, unverified email, valid verified sign-in, injected session-create failure, failure after session write, failure before commit, after-commit callback failure, 24-hour refresh rotation, 7-day inactivity, 30-day absolute limit, revoke-all, and authenticated password change. Record only row deltas and cookie attributes/presence.

- [ ] **Step 2: Establish native gaps explicitly**

Assert native sign-in creates a session and calls `setSessionCookie` at `sign-in.mjs:353-361`; native refresh retains token at `session.mjs:171-207`; native password change deletes and recreates session at `update-user.mjs:180-189`. Native refresh and native password-change replacement therefore remain rejected for Passvero policy even if native sign-in creation is reusable.

- [ ] **Step 3: Implement deferred cookie capture**

Direct API dispatch runs with response/header capture inside the transaction, but no external response object receives headers before commit. On commit, return only a fresh response constructed from the captured header and validated attributes. On any pre-commit failure, assert session delta zero and cookie `present:false`. On after-commit callback/delivery failure, session may exist but no cookie is returned; classify as fail-closed reauthentication and never retry the sign-in transaction automatically.

- [ ] **Step 4: Prove server-owned session fields and wrapper feasibility**

Both timestamps are `input:false`; create them from one server instant. Test client-supplied values cannot override them. Prove the dedicated tx-bound rotation conditionally updates token/expires/lastRefreshAt while preserving authenticatedAt and selectedOrganizationId, and that password change verifies through Better Auth then uses its authoritative account update inside the same tx while deleting other sessions and rotating the current session without resetting anchors. If any step requires direct provider-table writes, H5 FAILS.

- [ ] **Step 5: Run H5 static/type checks and commit**

The typed test must require no cookie before commit, no session/cookie on rollback, correct attributes (`Secure`, `HttpOnly`, `SameSite=Lax`, host-only), absolute/inactivity caps, rotation, revoke-all, and preserved anchors. Run artifact tests and `run-proof.sh --static`; Task 10 assigns the runtime verdict.

```bash
git add docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/src/proof-boundary.ts docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/test/session-boundary.test.ts
git commit -m "test: prove Better Auth session and cookie boundary"
```

Reviewer gate: distinguish committed-row/cookie-delivery ambiguity from rollback; ensure no retry can duplicate a committed authentication operation.

### Task 8: Prove recovery, password mutation, revocation, and token concurrency

**Files:**
- Create: `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/test/recovery-boundary.test.ts`
- Modify: `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/src/auth.ts`

**Interfaces:**
- Consumes: H2 boundary and digest-only disposable support tables.
- Produces: H6 verdict for 24-hour verification, 30-minute reset, password update, all-session revocation, and single-use concurrency.

- [ ] **Step 1: Write failing token lifecycle tests**

For email verification and password reset, generate exactly 32 random bytes, retain raw capability only in test-local memory, store keyed digest only, bind target-email digest, expire at exactly 24 hours or 30 minutes, invalidate predecessors transactionally, and run two concurrent consumers. Assert one success and one generic failure, one consumed row, no plaintext in database/log capture/evidence, and no raw capability in assertion names.

- [ ] **Step 2: Test password reset atomicity**

Use the accepted server-only Better Auth mechanism to update the credential, consume reset token, delete every user session, and advance abuse state in one outer transaction. Inject failures after consume, after credential update, after partial session deletion, and in configured callback. Every pre-commit failure restores old credential, active token, and all sessions; success invalidates token, updates credential, deletes every session, returns no session/cookie, and requires normal sign-in.

- [ ] **Step 3: Test authenticated password change**

Verify current password through Better Auth, update credential authoritatively, delete other sessions, and rotate current session within one transaction while preserving authenticatedAt, lastRefreshAt, and expiry. Concurrent current-password changes allow at most one committed update; failed callback or injected failure restores credential and session set. Any native alternate path that resets anchors remains disabled.

- [ ] **Step 4: Prove callback semantics**

Classify Better Auth after-commit hooks using `transaction.ts:139-150` and `with-hooks.mjs:31-39,67-75`: failure after commit cannot roll back and must produce a redacted operational failure, not a false rollback claim. Security-critical token/session state may not be delegated exclusively to after hooks. Test this distinction separately from a callback executed inside the outer transaction.

- [ ] **Step 5: Run H6 static/type checks and commit**

The typed test must require atomic credential/token/session state, single-use concurrency, callback classification, no automatic sign-in, and zero secret leaks. Run artifact tests and `run-proof.sh --static`; Task 10 assigns the runtime verdict.

```bash
git add docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/src/auth.ts docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/test/recovery-boundary.test.ts
git commit -m "test: prove Better Auth recovery transaction boundary"
```

Reviewer gate: inspect database values and captured output through digest-pattern checks; no reviewer should need access to a raw capability.

### Task 9: Prove route, base-path, and direct-API exposure boundaries

**Files:**
- Create: `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/test/route-boundary.test.ts`
- Modify: `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/src/auth.ts`

**Interfaces:**
- Consumes: production-shaped `disabledPaths`, `disableSignUp:true`, base URL/path, and accepted server-only endpoints.
- Produces: H7 reachability matrix and no-bypass verdict.

- [ ] **Step 1: Write the route matrix**

Enumerate every `auth.api` endpoint name/path/method. For both `/internal-auth` and `/internal-auth/`, test the handler against sign-up, sign-in, session, verification, reset, password change, update-session, and the proof-only activation endpoint. Also test wrong base path, encoded trailing slash, duplicate slash, query string, and direct API calls.

- [ ] **Step 2: Assert distinct HTTP and direct-call semantics**

HTTP calls to all native routes return 404 because `disabledPaths` is enforced in `api/index.mjs:164-166`; no catch-all is exported. Direct API remains reachable despite `disabledPaths`, as predicted by `to-auth-endpoints.mjs:34-55`, but only reviewed server orchestration may call the allowlisted direct methods. `disableSignUp:true` must still reject direct sign-up. Proof-only activation must be direct-server-only and unreachable through handler routing.

- [ ] **Step 3: Assert base/trailing-path normalization has no bypass**

Normalize exactly as Better Auth's router does and require every alternate spelling to stay denied. A 2xx/3xx response from any native auth HTTP route, or a direct sign-up success, is `STOP_ROUTE_BYPASS`.

- [ ] **Step 4: Run H7 static/type checks and commit**

Expected before live proof: the exhaustive route matrix is typed and statically enumerated, no public sign-up/native-handler allowance is present, the direct server allowlist is exact, and no PostgreSQL process exists. Task 10 assigns H7 PASS/FAIL.

```bash
git add docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/src/auth.ts docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness/test/route-boundary.test.ts
git commit -m "test: prove Better Auth route boundary"
```

Reviewer gate: compare enumerated runtime endpoints to the pinned source endpoint registry; reject a manually curated partial route list.

### Task 10: Execute once, redact evidence, clean up, and reconcile the gate

**Files:**
- Create: `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/evidence.json`
- Create: `docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/evidence.md`
- Modify: `docs/superpowers/reviews/2026-08-20-better-auth-foundation-review.md`
- Modify: `docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/proposed-migration-contract.md`
- Modify: `tests/auth-foundation-transaction-proof-artifacts.test.mjs`

**Interfaces:**
- Consumes: all reviewed harness tasks and operator authorization `DISPOSABLE_POSTGRESQL_REVIEW_ONLY`.
- Produces: terminal `APPROVAL_READY` or blocked verdict, redacted proof artifacts, and verified cleanup; never canonical persistence approval.

- [ ] **Step 1: Record clean preflight and run the source gate**

```bash
git status --short --branch
git diff --quiet
git diff --cached --quiet
node --test tests/auth-foundation-transaction-proof-source.test.mjs tests/auth-foundation-transaction-proof-artifacts.test.mjs
```

Expected: clean tracked worktree and both no-database suites PASS. Stop on unexplained state.

- [ ] **Step 2: Execute the proof once**

```bash
bash docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/run-proof.sh --all
```

Expected: one fresh run root, port 55432 used once, identity gate before schema,
H1–H7 terminal results, a redacted pending evidence capture before cleanup,
final evidence only after cleanup booleans are known, and cleanup trap completes.
Do not retry a failed hypothesis or rerun the all-proof command; preserve its
redacted failure evidence. The script must refuse `--all` if final or pending
evidence already records an execution attempt.

- [ ] **Step 3: Verify cleanup independently**

Run explicit checks for no listener at 55432, `pg_isready` failure, recorded PID absence, and no directory matching the exact `/private/tmp/passvero-stage13a-pg.*` proof prefix. Compare them to evidence booleans. Any mismatch sets overall status FAIL even when H1–H7 passed. This is read-only enumeration; never delete a prefix match outside the validated script cleanup.

- [ ] **Step 4: Run the redaction and determinism tests**

The artifact suite parses JSON/Markdown, asserts allowed keys only, rescans every committed proof asset for secrets/URLs/emails/tokens/raw IDs/user paths, verifies package/source hashes, row-count arithmetic, transaction-ID equality for atomic cases, cookie booleans/attributes, and cleanup booleans. It rejects an overall PASS if any mandatory hypothesis is missing or FAIL.

- [ ] **Step 5: Reconcile the authoritative review and migration contract**

If and only if H1–H7 and cleanup all pass, set:

```text
AUTH_FOUNDATION_PERSISTENCE_CONTRACT=APPROVAL_READY
BETTER_AUTH_RUNTIME_BOUNDARY=DIRECT_SERVER_API_OUTER_PRISMA_TRANSACTION
BETTER_AUTH_HTTP_HANDLER=REJECTED_FOR_TRANSACTIONAL_FLOWS
```

Record the exact accepted adapter transaction mode, server-only activation endpoint, direct API allowlist, cookie deferral rule, callback classification, and renewed-proof-on-upgrade requirement. State prominently that operator approval is still required before Stage 13B and before canonical schema/migration work.

If any mandatory hypothesis or cleanup fails, retain:

```text
AUTH_FOUNDATION_PERSISTENCE_CONTRACT=BLOCKED_PENDING_ARCHITECTURE_REVIEW
```

List the exact failed hypothesis/failure code, make no positive boundary selection, and ask for architecture review. Do not amend the candidate migration contract into an implementable contract.

- [ ] **Step 6: Run full non-database repository verification**

Run the existing source, application, infrastructure, Prisma validation, lint,
and all auth-foundation review tests. Temporarily restore only the existing
ignored generated-client linkage required by the typed suites, verify its
resolved target ends in `/passvero/src/generated`, and remove the link
afterward:

```bash
node --test tests/*.test.mjs
PASSVERO_PRIMARY_WORKTREE="$(git worktree list --porcelain | awk '/^worktree / && $2 !~ /^\/private\/tmp\/passvero-stage13a-/ { print substr($0, 10); exit }')"
test -d "$PASSVERO_PRIMARY_WORKTREE/src/generated"
test ! -e src/generated
ln -s "$PASSVERO_PRIMARY_WORKTREE/src/generated" src/generated
npm run test:application
npm run test:infrastructure
unlink src/generated
npm run lint
git diff --check
test ! -e src/generated
```

Do not run the repository integration suite, load Passvero Prisma config through
a CLI version command, or connect to any Passvero database. If a typed suite
fails before `unlink`, unlink the validated symlink before reporting the failure.

Expected baseline before this plan: 175 source tests, 54 application tests, and
11 infrastructure tests. The source total after this plan must equal 175 plus
the exact new repository `node:test` cases committed by Tasks 1–3; all source,
application, infrastructure, disposable-harness Prisma validation, lint,
artifact, and diff checks PASS with zero failures, and the exact final counts
are recorded. Never invoke Prisma against the repository schema during this
proof.

- [ ] **Step 7: Commit evidence and request fresh final reviews**

```bash
git add docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/evidence.json docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/evidence.md docs/superpowers/reviews/2026-08-20-better-auth-foundation-review.md docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/proposed-migration-contract.md tests/auth-foundation-transaction-proof-artifacts.test.mjs
git commit -m "docs: record Better Auth transaction proof"
```

First reviewer gate: source/spec compliance, transaction semantics, and fail-closed conclusion. Second independent reviewer gate: secret/redaction safety, cluster cleanup evidence, and proof reproducibility. A clean final review may ask only `AUTH_FOUNDATION_PERSISTENCE_CONTRACT=APPROVED?` when the state is `APPROVAL_READY`; otherwise it asks for architecture review with the exact failed hypothesis.

---

## Execution stop matrix

| Condition | Required terminal action |
| --- | --- |
| Source hash, cited lines, package version, public export, or API surface differs | `STOP_SOURCE_DRIFT`; no cluster initialization. |
| Port 55432 occupied or run-root path/permissions/symlink invalid | `STOP_ENVIRONMENT_COLLISION`; no retry or alternate port. |
| Any repository env/config access or Passvero database indicator | `STOP_FORBIDDEN_CONFIG_ACCESS`; terminate before SQL. |
| Cluster identity/sentinel/database/user/port/data-dir/system-ID mismatch | `STOP_CLUSTER_IDENTITY`; do not apply schema. |
| Provider and canonical/support writes use different transaction IDs or partially persist | Hypothesis FAIL; retain blocked contract. |
| Cookie becomes externally observable before commit or exists after rollback | H5 FAIL; retain blocked contract. |
| Public signup, native handler, base-path variant, or unreviewed direct API bypass succeeds | H4/H7 FAIL; retain blocked contract. |
| Better Auth-authoritative server-only activation/recovery/session mechanism is unavailable | Exact hypothesis FAIL; do not write provider tables directly. |
| After-commit callback is mistaken for rollback-capable security state | H6 FAIL; retain blocked contract. |
| Cleanup identity cannot be revalidated | Stop known proven process if safe, retain run root, record `CLEANUP=FAIL_RETAINED`, and require operator review. |
| Listener, PID, or validated root remains after cleanup | Overall FAIL even if every transaction hypothesis passed. |

## Plan self-review

- Spec coverage: Better Auth authority, provider-neutral binding, controlled activation, mandatory verification/reset, database sessions, cookie security, no public signup, PostgreSQL abuse controls, route exclusions, and future migration approval are each exercised by Tasks 4–10.
- Safety coverage: Task 1 stops on upstream drift; Tasks 2–3 prevent repository configuration and existing-database access; Task 10 verifies redaction and cleanup independently.
- Type consistency: `HypothesisId`, `FailurePoint`, `RowCounts`, `DeferredCookie`, `HypothesisEvidence`, `BoundaryResult`, and `runBetterAuthBoundary` are defined once and consumed by named later tasks.
- Scope coverage: only harness/evidence/tests/review assets are committed; no package, runtime source, canonical Prisma schema, migration, environment, generated-client, secret, or existing database mutation is authorized.
