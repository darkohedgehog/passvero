# Passvero Authentication Foundation Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce an exact, reviewable Better Auth dependency and Prisma persistence contract for Passvero without changing the canonical schema, creating a migration, connecting to a database, or implementing authentication.

**Architecture:** Use a disposable schema-generation harness outside the repository to capture Better Auth 1.7.1's Prisma output, then reconcile it with Passvero's canonical `User`, tenancy, session, token, and abuse-control requirements. Commit only evidence and the proposed contract; operator approval is required before a later plan may change dependencies, source, Prisma schema, or migrations.

**Tech Stack:** Better Auth 1.7.1 candidate, `@better-auth/prisma-adapter` 1.7.1 candidate, Prisma 7.8.0, PostgreSQL, TypeScript 5.9, Node.js, npm.

**Spec:** `docs/superpowers/specs/2026-08-19-passvero-auth-dashboard-design.md`

## Global Constraints

- Execute in a new isolated worktree from approved commit `1ac745cf65965ddcb58ed41edb16cf218624c49c`. If the base must change, refresh and reapprove this plan first.
- Record the actual execution base before any other action.
- This plan is review-only; repository source, `package.json`, `package-lock.json`, `prisma/schema.prisma`, `prisma/migrations`, environment files, and generated Prisma client remain unchanged.
- Do not run `auth migrate`, `prisma migrate dev`, `prisma migrate deploy`, `prisma db push`, SQL clients, or any command that connects to PostgreSQL.
- Do not generate or print a Better Auth secret.
- Do not read, source, print, or modify `.env*` files.
- Better Auth Organization, Admin, OAuth, magic-link, 2FA, and passkey plugins are excluded from the candidate configuration.
- Cookie cache, secondary storage, Redis, public sign-up, and automatic account linking are excluded.
- Better Auth's native user remains separate from canonical Passvero `User`.
- Proposed names must avoid collision with the existing `User`, `Organization`, `Membership`, `Invitation`, `Plan`, and `Subscription` models.
- Provider subject plus provider is unique and maps by required foreign key to canonical `User.id`.
- Email is not a runtime or permanent identity key.
- The proposed session persists server-owned `authenticatedAt`, preserves it across rotation, supports a server-side selected organization, and stores no permission/role/entitlement snapshot.
- Every token type is opaque, single-use, expiring, superseding, and forbidden from logs.
- Progressive abuse control uses PostgreSQL and keyed digests; it stores neither plaintext normalized email nor blindly trusted proxy headers.
- Review artifacts contain no credentials, URLs, tokens, raw IP addresses, account emails, or production values.

## Authoritative upstream references

- `https://better-auth.com/docs/concepts/cli`
- `https://better-auth.com/docs/concepts/database`
- `https://better-auth.com/docs/adapters/prisma`
- `https://better-auth.com/docs/reference/options`
- `https://better-auth.com/docs/integrations/next`

---

## Planned File Map

| Action | Path | Responsibility |
| --- | --- | --- |
| Create | `docs/superpowers/reviews/2026-08-20-better-auth-foundation-review.md` | Version evidence, generated-schema reconciliation, exact proposed model/constraint contract, risk analysis, and operator decision block. |
| Create | `docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/generated-prisma-schema.prisma` | Better Auth CLI output whose generated body is preserved exactly beneath a two-line provenance header. |
| Create | `docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/proposed-prisma-fragment.prisma` | Review-only proposed Prisma fragment; not an executable canonical schema. |
| Create | `docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/proposed-migration-contract.md` | Exact tables, columns, indexes, foreign keys, checks, partial indexes, and deployment exclusions for later migration authoring. |
| Create | `tests/auth-foundation-review.test.mjs` | Source-level tests that validate the review artifacts and ensure canonical schema/migrations/packages remain unchanged in this review stage. |

Disposable files are created only below `/private/tmp/passvero-better-auth-review-1-7-1`. They are never added to Git.

## Interfaces produced by this plan

The review must approve, reject, or replace these candidate names as one atomic contract:

```ts
export const AUTH_PROVIDER = "BETTER_AUTH" as const;

export interface AuthIdentityBinding {
  readonly provider: typeof AUTH_PROVIDER;
  readonly providerSubject: string;
  readonly userId: string;
}

export interface AuthSessionExtension {
  readonly authenticatedAt: Date;
  readonly selectedOrganizationId: string | null;
}
```

Candidate provider table names are `AuthProviderUser`, `AuthProviderSession`, `AuthProviderAccount`, and `AuthProviderVerification`. Candidate Passvero-owned support names are `AuthIdentity`, `AccountActivation`, and `AuthAbuseBucket`. The review must select final names before implementation planning continues.

### Task 1: Freeze execution evidence and upstream versions

**Files:**
- Create: `docs/superpowers/reviews/2026-08-20-better-auth-foundation-review.md`
- Test: `tests/auth-foundation-review.test.mjs`

**Interfaces:**
- Consumes: approved Phase 12 specification and repository base.
- Produces: immutable version/evidence header consumed by schema reconciliation.

- [ ] **Step 1: Record the clean isolated base**

Run:

```bash
git status --short --branch
git rev-parse HEAD
git diff --quiet
git diff --cached --quiet
```

Expected: the designated branch is clean and `HEAD` equals the operator-designated base. Stop if any tracked or untracked file is unexplained.

- [ ] **Step 2: Verify the candidate packages have not drifted**

Run:

```bash
npm view better-auth version
npm view @better-auth/prisma-adapter version
npm view auth version
npm view @better-auth/prisma-adapter peerDependencies --json
```

Expected: all three Better Auth release-train packages are exactly `1.7.1`; peer dependencies accept Prisma 7. If any version differs or the CLI package cannot be verified, stop and refresh this plan against current official documentation. Do not substitute a newer package automatically.

- [ ] **Step 3: Write the failing evidence test**

Create `tests/auth-foundation-review.test.mjs` with:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const reviewPath =
  "docs/superpowers/reviews/2026-08-20-better-auth-foundation-review.md";

test("authentication review records the exact candidate versions and exclusions", async () => {
  const review = await readFile(reviewPath, "utf8");
  assert.match(review, /better-auth: 1\.7\.1/);
  assert.match(review, /@better-auth\/prisma-adapter: 1\.7\.1/);
  assert.match(review, /Prisma: 7\.8\.0/);
  assert.match(review, /Organization plugin: EXCLUDED/);
  assert.match(review, /Redis: EXCLUDED/);
  assert.match(review, /Database connection performed: NO/);
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run:

```bash
node --test tests/auth-foundation-review.test.mjs
```

Expected: FAIL because the review artifact does not exist.

- [ ] **Step 5: Create the review header**

Create the review document with this exact opening:

```markdown
# Better Auth Foundation Review

**Status:** Awaiting operator schema decision
**Execution base:** 1ac745cf65965ddcb58ed41edb16cf218624c49c
**Evidence date:** 2026-08-20

## Candidate dependency baseline

- better-auth: 1.7.1
- @better-auth/prisma-adapter: 1.7.1
- Prisma: 7.8.0
- Next.js: 16.2.11
- React: 19.2.4
- Organization plugin: EXCLUDED
- Redis: EXCLUDED
- Cookie cache: EXCLUDED
- Database connection performed: NO
- Schema or migration modified: NO
```

The commit and date must match the execution evidence. If they do not, stop and refresh the approved plan. Never include a repository path containing a username.

- [ ] **Step 6: Run the focused test**

Run:

```bash
node --test tests/auth-foundation-review.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit the evidence skeleton**

```bash
git add tests/auth-foundation-review.test.mjs docs/superpowers/reviews/2026-08-20-better-auth-foundation-review.md
git commit -m "docs: start Better Auth foundation review"
```

### Task 2: Generate the untouched Better Auth Prisma candidate outside the repository

**Files:**
- Create: `docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/generated-prisma-schema.prisma`
- Modify: `tests/auth-foundation-review.test.mjs`
- Modify: `docs/superpowers/reviews/2026-08-20-better-auth-foundation-review.md`

**Interfaces:**
- Consumes: exact Better Auth 1.7.1 candidate package.
- Produces: immutable raw generator output for field-by-field comparison.

- [ ] **Step 1: Create a disposable review directory**

Run:

```bash
mkdir -p /private/tmp/passvero-better-auth-review-1-7-1
```

Expected: an empty task-specific directory. If it already contains files, stop and use a newly numbered explicit directory rather than deleting unknown data.

- [ ] **Step 2: Create a disposable package manifest and auth config**

Use `apply_patch` to create `/private/tmp/passvero-better-auth-review-1-7-1/package.json`:

```json
{
  "name": "passvero-better-auth-schema-review",
  "private": true,
  "type": "module",
  "dependencies": {
    "@better-auth/prisma-adapter": "1.7.1",
    "@prisma/client": "7.8.0",
    "better-auth": "1.7.1",
    "prisma": "7.8.0"
  }
}
```

Use `apply_patch` to create `/private/tmp/passvero-better-auth-review-1-7-1/auth.ts`:

```ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

const schemaOnlyPrisma = {} as never;

export const auth = betterAuth({
  appName: "Passvero schema review",
  database: prismaAdapter(schemaOnlyPrisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 15,
    maxPasswordLength: 128,
  },
  user: { modelName: "AuthProviderUser" },
  session: {
    modelName: "AuthProviderSession",
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: false },
    additionalFields: {
      authenticatedAt: { type: "date", required: true },
      selectedOrganizationId: { type: "string", required: false },
    },
  },
  account: { modelName: "AuthProviderAccount" },
  verification: { modelName: "AuthProviderVerification" },
});
```

If Better Auth rejects `additionalFields` or model-name placement, capture the exact official 1.7.1 type error in the review and correct only the disposable config according to the 1.7 official options reference. Do not improvise a repository schema.

- [ ] **Step 3: Install only inside the disposable directory**

Run:

```bash
npm install --ignore-scripts
```

Working directory: `/private/tmp/passvero-better-auth-review-1-7-1`.

Expected: dependencies install only in the disposable directory. The Passvero `package.json` and lockfile remain byte-identical.

- [ ] **Step 4: Generate the candidate without database access**

Run:

```bash
npx auth@1.7.1 generate --config ./auth.ts --output ./generated.prisma --yes
```

Working directory: `/private/tmp/passvero-better-auth-review-1-7-1`.

Expected: `generated.prisma` is created; no database URL is requested and no connection occurs. Do not run the `migrate` command.

- [ ] **Step 5: Copy the raw output body byte-for-byte into the review assets**

Use `apply_patch` to add the exact contents of `generated.prisma` at:

`docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/generated-prisma-schema.prisma`

Add a comment before the generated content stating only:

```prisma
// Unmodified Better Auth 1.7.1 generator output captured for review.
// This is not the canonical Passvero schema and must never be migrated directly.
```

Append this exact evidence section to the review:

```markdown
## Raw generator capture

- CLI: auth 1.7.1
- Configuration: disposable review-only Better Auth configuration
- Output: `docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/generated-prisma-schema.prisma`
- Database connection: not performed
- Canonical Prisma schema mutation: not performed
- Canonical migration mutation: not performed
```

- [ ] **Step 6: Extend the review test**

Add:

```js
test("raw candidate contains the four isolated provider models", async () => {
  const schema = await readFile(
    "docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/generated-prisma-schema.prisma",
    "utf8",
  );
  for (const model of [
    "AuthProviderUser",
    "AuthProviderSession",
    "AuthProviderAccount",
    "AuthProviderVerification",
  ]) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
  }
  assert.doesNotMatch(schema, /model Organization\s*\{/);
  assert.doesNotMatch(schema, /model Membership\s*\{/);
});
```

- [ ] **Step 7: Verify repository isolation and focused tests**

Run:

```bash
git diff --exit-code -- package.json package-lock.json prisma/schema.prisma prisma/migrations
node --test tests/auth-foundation-review.test.mjs
```

Expected: no diff in forbidden paths and all review tests pass.

- [ ] **Step 8: Commit the raw candidate**

```bash
git add tests/auth-foundation-review.test.mjs docs/superpowers/reviews/2026-08-20-better-auth-foundation-review.md docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/generated-prisma-schema.prisma
git commit -m "docs: capture Better Auth Prisma candidate"
```

### Task 3: Reconcile provider models with canonical Passvero identity

**Files:**
- Create: `docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/proposed-prisma-fragment.prisma`
- Modify: `docs/superpowers/reviews/2026-08-20-better-auth-foundation-review.md`
- Modify: `tests/auth-foundation-review.test.mjs`

**Interfaces:**
- Consumes: raw generator output and canonical `User`, `Organization`, `Membership` models.
- Produces: exact review-only provider model and `AuthIdentity` proposal.

- [ ] **Step 1: Add failing identity-contract assertions**

Add:

```js
test("proposal keeps provider identity separate and binds by stable subject", async () => {
  const schema = await readFile(
    "docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/proposed-prisma-fragment.prisma",
    "utf8",
  );
  const identity = schema.match(/model AuthIdentity\s*\{[\s\S]*?^\}/m)?.[0];
  assert.ok(identity);
  assert.match(identity, /provider\s+String/);
  assert.match(identity, /providerSubject\s+String/);
  assert.match(identity, /userId\s+String\s+@db\.Uuid/);
  assert.match(identity, /@@unique\(\[provider, providerSubject\]\)/);
  assert.match(identity, /user\s+User\s+@relation/);
  assert.doesNotMatch(identity, /email/);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run `node --test tests/auth-foundation-review.test.mjs`.

Expected: FAIL because the proposal does not exist.

- [ ] **Step 3: Build the review-only proposal from the raw output**

Copy the four generated provider models into `proposed-prisma-fragment.prisma`, preserving all Better Auth-required fields and indexes. Rename only as required to avoid collisions and add explicit Prisma relations between those four provider models.

Append this exact Passvero-owned binding shape:

```prisma
model AuthIdentity {
  id              String   @id @default(uuid()) @db.Uuid
  provider        String
  providerSubject String
  userId          String   @db.Uuid
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Restrict, onUpdate: Cascade)

  @@unique([provider, providerSubject])
  @@index([userId])
}
```

The canonical proposal must also add `authIdentities AuthIdentity[]` to `User`; record that inverse as a required canonical-schema edit in the review, not in `prisma/schema.prisma`.

- [ ] **Step 4: Review identifier types explicitly**

Add a table to the review with one row for every provider model primary key, foreign key, token identifier, and `AuthIdentity.providerSubject`. For each row record generated type, proposed Prisma type, PostgreSQL type, length/check requirement, and migration/exit implication.

Decision rule: do not coerce Better Auth identifiers to UUID unless official 1.7.1 configuration proves generation and all adapter paths use UUID consistently. `AuthIdentity.providerSubject` remains opaque `String` even if the current provider emits UUID-shaped values.

- [ ] **Step 5: Run focused tests and validate a disposable combined schema**

Before running Prisma, create `/private/tmp/passvero-better-auth-review-1-7-1/proposed-review-schema.prisma` by copying the canonical Passvero schema and applying the review fragment plus the required `User.authIdentities` inverse only in that disposable copy.

Run:

```bash
node --test tests/auth-foundation-review.test.mjs
npx prisma format --schema /private/tmp/passvero-better-auth-review-1-7-1/proposed-review-schema.prisma
npx prisma validate --schema /private/tmp/passvero-better-auth-review-1-7-1/proposed-review-schema.prisma
```

Expected: tests pass and the disposable combined schema formats and validates. Remove neither provider-required fields nor canonical binding constraints to satisfy validation.

- [ ] **Step 6: Commit the identity proposal**

```bash
git add tests/auth-foundation-review.test.mjs docs/superpowers/reviews/2026-08-20-better-auth-foundation-review.md docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/proposed-prisma-fragment.prisma
git commit -m "docs: propose provider-neutral auth identity schema"
```

### Task 4: Specify session, activation, token, and abuse persistence

**Files:**
- Modify: `docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/proposed-prisma-fragment.prisma`
- Create: `docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/proposed-migration-contract.md`
- Modify: `tests/auth-foundation-review.test.mjs`
- Modify: `docs/superpowers/reviews/2026-08-20-better-auth-foundation-review.md`

**Interfaces:**
- Consumes: approved session/recovery/abuse policies.
- Produces: exact persistence constraints for later schema and SQL migration authoring.

- [ ] **Step 1: Add failing policy-contract tests**

Add tests that require the proposal and migration contract to contain:

```js
test("proposal covers server session, activation, and progressive abuse state", async () => {
  const schema = await readFile(
    "docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/proposed-prisma-fragment.prisma",
    "utf8",
  );
  assert.match(schema, /authenticatedAt\s+DateTime/);
  assert.match(schema, /selectedOrganizationId\s+String\?\s+@db\.Uuid/);
  assert.match(schema, /model AccountActivation\s*\{/);
  assert.match(schema, /tokenDigest\s+String\s+@unique/);
  const abuse = schema.match(/model AuthAbuseBucket\s*\{[\s\S]*?^\}/m)?.[0];
  assert.ok(abuse);
  assert.match(abuse, /keyDigest\s+String\s+@unique/);
  assert.doesNotMatch(abuse, /email\s+String/);
  assert.doesNotMatch(abuse, /ipAddress\s+String/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run `node --test tests/auth-foundation-review.test.mjs`.

Expected: FAIL until every required field is present.

- [ ] **Step 3: Add exact review candidates**

Add `authenticatedAt DateTime` and `selectedOrganizationId String? @db.Uuid` to the proposed provider session model. Add a nullable Organization relation only if the generated provider model can express it without exposing organization state in cookies; otherwise propose a separate one-to-one `AuthSessionSelection` and document why. Never add role or permissions to the session model.

Add `AccountActivation` with UUID primary key, required canonical `userId`, unique `tokenDigest`, `expiresAt`, nullable `consumedAt`, nullable `invalidatedAt`, and `createdAt`. Require a PostgreSQL partial unique index allowing only one unconsumed, non-invalidated activation per canonical user.

Add `AuthAbuseBucket` with UUID primary key, unique keyed `keyDigest`, allowlisted dimension enum, non-negative `failureCount`, non-negative `backoffLevel`, nullable `blockedUntil`, required `expiresAt`, and `updatedAt`. The migration contract must require atomic upsert/increment semantics, expiry indexing, bounded retention, and CHECK constraints. Plaintext email, IP, network, user agent, password, and token columns are forbidden.

- [ ] **Step 4: Reconcile Better Auth verification storage**

Document whether Better Auth 1.7.1 stores verification/reset token material plaintext, hashed, or encoded, citing exact official source or installed package source lines. If plaintext token material is persisted, the proposal must introduce a reviewed hashing adapter or Passvero-owned verification/reset persistence before Stage 13E; do not claim compliance based on token opacity alone.

Record how a newly issued verification, reset, or activation token invalidates its predecessors and how single-use consumption is made atomic under concurrent requests.

- [ ] **Step 5: Write the migration contract**

For every proposed table, list exact columns, PostgreSQL types, nullability, defaults, primary keys, unique indexes, non-unique indexes, foreign keys and actions, CHECK constraints, partial indexes, and forbidden columns. Include these explicit deployment rules:

```markdown
- Better Auth CLI migration execution: FORBIDDEN
- Prisma db push: FORBIDDEN
- Direct SQL execution during review: FORBIDDEN
- Canonical migration directory mutation during review: FORBIDDEN
- Future migration requires schema tests before deployment: YES
- Future migration deployment requires separate operator authorization: YES
- Existing 16 migration sources must retain approved hashes: YES
```

- [ ] **Step 6: Run focused review verification**

Run:

```bash
node --test tests/auth-foundation-review.test.mjs
git diff --exit-code -- package.json package-lock.json prisma/schema.prisma prisma/migrations
rg -n "password|secret|token =|DATABASE_URL|postgresql://|prisma\+postgres://" docs/superpowers/reviews/2026-08-20-better-auth-foundation-review.md docs/superpowers/specs/assets/2026-08-20-better-auth-foundation
```

Expected: tests pass, forbidden repository paths are unchanged, and the scan contains only policy prose/field names—not values or connection strings.

- [ ] **Step 7: Commit the persistence contract**

```bash
git add tests/auth-foundation-review.test.mjs docs/superpowers/reviews/2026-08-20-better-auth-foundation-review.md docs/superpowers/specs/assets/2026-08-20-better-auth-foundation
git commit -m "docs: define authentication persistence contract"
```

### Task 5: Perform cumulative review and stop at the operator gate

**Files:**
- Modify: `docs/superpowers/reviews/2026-08-20-better-auth-foundation-review.md`
- Test: `tests/auth-foundation-review.test.mjs`

**Interfaces:**
- Consumes: every Stage 13A artifact.
- Produces: one self-contained operator decision packet; no runtime interface is approved until the operator decides.

- [ ] **Step 1: Complete the review matrix**

The review must answer each item with `PASS`, `REJECT`, or `OPERATOR DECISION REQUIRED`, plus evidence:

- Next.js 16 and React 19 compatibility;
- Prisma 7/PostgreSQL adapter compatibility;
- provider-table isolation from canonical `User`;
- provider-subject uniqueness and multiple identities per canonical user;
- session database authority, 7-day inactivity, 24-hour refresh, and 30-day absolute lifetime;
- rotation preserving `authenticatedAt`;
- organization selection without authorization snapshots;
- verification/reset/activation token hashing, single use, expiry, and predecessor invalidation;
- password hashing ownership;
- progressive PostgreSQL abuse-control atomicity and retention;
- no Redis/cookie cache/Organization plugin/automatic linking;
- migration and exit cost;
- rollback and forward-compatibility implications.

- [ ] **Step 2: Add final source-level assertions**

Add:

```js
test("review stage leaves implementation paths unchanged", async () => {
  const packageJson = await readFile("package.json", "utf8");
  assert.doesNotMatch(packageJson, /"better-auth"/);
  const canonicalSchema = await readFile("prisma/schema.prisma", "utf8");
  assert.doesNotMatch(canonicalSchema, /model AuthProviderUser\s*\{/);
  assert.doesNotMatch(canonicalSchema, /model AuthIdentity\s*\{/);
});
```

- [ ] **Step 3: Run complete non-database verification**

Run:

```bash
node --test tests/*.test.mjs
npm run test:application
npm run test:infrastructure
npm run lint
git diff --check
```

Do not run `npm run test:integration`; this review has no database authority.

Expected: all invoked suites pass with zero failures.

- [ ] **Step 4: Verify the exact diff boundary**

Run:

```bash
git diff --name-only 1ac745cf65965ddcb58ed41edb16cf218624c49c..HEAD
git status --short --branch
```

Expected: changes are limited to the one review, two review assets plus raw generated candidate, and one review test. No package, source, canonical schema, migration, environment, or generated-client path appears.

- [ ] **Step 5: Commit the completed decision packet**

```bash
git add tests/auth-foundation-review.test.mjs docs/superpowers/reviews/2026-08-20-better-auth-foundation-review.md docs/superpowers/specs/assets/2026-08-20-better-auth-foundation
git commit -m "docs: complete Better Auth foundation review"
```

- [ ] **Step 6: Stop for operator review**

Present the commit range, exact dependency evidence, proposed schema fragment, migration contract, test results, rejected alternatives, and unresolved operator decisions. Ask only:

`AUTH_FOUNDATION_PERSISTENCE_CONTRACT=APPROVED?`

Do not install Better Auth in Passvero, modify the canonical Prisma schema, create a migration, connect to PostgreSQL, generate secrets, or prepare Stage 13B implementation until that approval is explicit.
