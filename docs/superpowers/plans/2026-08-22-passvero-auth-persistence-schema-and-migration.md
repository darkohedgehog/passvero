# Passvero Authentication Persistence Schema and Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the reviewed Better Auth 1.7.1 provider schema and the minimum Passvero-owned identity, activation, session-selection, abuse-control, and authentication-audit persistence in one additive migration source without connecting to or deploying against any database.

**Architecture:** Better Auth exclusively owns its user, account, verification, recovery, and session rows through documented APIs. Passvero owns a provider-neutral `AuthIdentity`, controlled `AccountActivationIntent`, server-side `AuthSessionSelection`, progressive `AuthAbuseBucket`, and organization-neutral append-only `AuthAuditEvent`; cross-boundary consistency is idempotent and fail closed, never one shared transaction.

**Tech Stack:** Next.js 16.2.11, React 19.2.4, TypeScript 5.9, Prisma 7.8.0, PostgreSQL, Better Auth 1.7.1, `@better-auth/prisma-adapter` 1.7.1, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-19-passvero-auth-dashboard-design.md`

**Disposition:** `docs/superpowers/reviews/2026-08-22-better-auth-native-lifecycle-disposition.md`

**Approved architecture base:** `3657cd2e0493d9d0122b5c25b3fac252603efc99`

**Current authority:**

```text
STAGE_13B_DETAILED_PLAN=DOCUMENTATION_ONLY
STAGE_13B_EXECUTION_AUTHORIZED=NO
SCHEMA_CHANGES_AUTHORIZED=NO
MIGRATIONS_AUTHORIZED=NO
DEPENDENCY_CHANGES_AUTHORIZED=NO
IMPLEMENTATION_AUTHORIZED=NO
DATABASE_ACCESS_AUTHORIZED=NO
```

**Inherited architecture:**

```text
AUTH_FOUNDATION_ARCHITECTURE=BETTER_AUTH_NATIVE_LIFECYCLE_WITH_PASSVERO_FAIL_CLOSED_RECONCILIATION
CROSS_BOUNDARY_ACID_REQUIRED=NO
DIRECT_BETTER_AUTH_PROVIDER_TABLE_WRITES=NO
UNBOUND_BETTER_AUTH_IDENTITY_TENANT_ACCESS=DENIED
BETTER_AUTH_HOOKS_AUTHORITATIVE=NO
CUSTOM_BETTER_AUTH_SESSION_TABLE_MUTATION=NO
CUSTOM_ROLLING_SESSION_TOKEN_ROTATION=NO
SESSION_ORGANIZATION_STATE_IN_BETTER_AUTH_TABLES=NO
BETTER_AUTH_RECOVERY_TOKENS_REMAIN_PROVIDER_OWNED=YES
PASSVERO_RECOVERY_TOKEN_DUPLICATION=NO
```

## Global Constraints

- This plan is documentation only until the operator separately authorizes its execution.
- Execute only from a fresh isolated worktree based on the operator-approved plan commit. Never execute in `main` or the preserved Stage 13A worktree.
- Record the execution base before Task 1. If it does not contain this complete plan and disposition, stop.
- Better Auth owns provider user, account, verification, recovery, and session rows. Passvero runtime code must never write those tables directly.
- Passvero owns `AccountActivationIntent`, `AuthIdentity`, `AuthSessionSelection`, `AuthAbuseBucket`, and `AuthAuditEvent`.
- Cross-boundary ACID, adapter transaction injection, custom provider-session mutation, custom rolling token rotation, and provider-table organization state are forbidden.
- Do not add `AuthCredentialToken` or any other Passvero verification/reset token table.
- Do not add Better Auth Organization, Admin, OAuth, magic-link, 2FA, or passkey plugins.
- Public self-registration, automatic same-email linking, OAuth, magic links, MFA, passkeys, Redis, and session cookie cache remain excluded.
- Email may support controlled initial activation after verification but is never an `AuthIdentity` field or runtime lookup key.
- An unbound or revoked identity receives no tenant access. Provider subject resolution must reach an active canonical `User.id` before organization context or permissions.
- `AuthSessionSelection` stores only an opaque provider session identifier and selected organization. It contains no user, role, membership, permission, entitlement, billing, or platform-admin snapshot.
- The four Better Auth models must match a freshly generated 1.7.1 native-lifecycle schema. If generation differs from this plan's provider fields, stop before editing `prisma/schema.prisma` and refresh the plan.
- All Better Auth package versions are exact `1.7.1` pins. Do not add `@better-auth/core` directly unless a later reviewed runtime need proves it necessary.
- All changes are additive. Do not rename, drop, alter, backfill, or rewrite existing models, enums, columns, constraints, indexes, or migrations.
- Create exactly one migration directory: `prisma/migrations/20260822193000_add_auth_foundation/`.
- Stage 13B creates migration source only. Do not run `prisma migrate dev`, `prisma migrate deploy`, `prisma db push`, `prisma db execute`, SQL clients, Docker, or PostgreSQL.
- Never read, source, print, or use `.env*`, `DATABASE_URL`, or `TEST_DATABASE_URL`. Run Prisma validation, generation, and schema-to-schema diff with both URL variables explicitly unset.
- No dependency install or command may use `--force`. Audit remediation is not part of this plan.
- Never log or commit passwords, session tokens, activation tokens, verification/reset tokens, raw email/IP values, cookie values, secrets, connection URLs, or retained proof state.
- The Stage 13A proof, harness, candidate schema, migration contract, worktree, and retained proof state are historical evidence only. Do not execute, modify, reuse, clean, or copy from retained live-attempt state.
- Every task must leave its independently testable deliverable green before commit. Stop on unexplained worktree state, package drift, generator drift, validation failure, migration-scope drift, or security-contract conflict.
- Stage 13C deployment requires a separate operator decision after this entire Stage 13B branch and migration source are reviewed.

---

## Planned File Map

| Action | Path | Responsibility |
| --- | --- | --- |
| Modify | `package.json` | Exact Better Auth runtime and Prisma-adapter dependency pins only. |
| Modify | `package-lock.json` | Reproducible dependency graph produced by non-force npm installation. |
| Create | `docs/superpowers/specs/assets/2026-08-22-better-auth-native-schema/generated-prisma-schema.prisma` | Fresh unmodified 1.7.1 generator evidence with no Passvero session extensions. |
| Modify | `prisma/schema.prisma` | Four provider-owned models, four Passvero enums, five Passvero-owned models, and required inverse relations. |
| Create | `tests/auth-persistence-schema.test.mjs` | Exact dependency, generator, Prisma model, migration, exclusion, and prior-migration-integrity contract. |
| Modify | `tests/auth-foundation-review.test.mjs` | Pin Stage 13A no-implementation assertions to historical commit `aa2244de` instead of future repository HEAD. |
| Create | `prisma/migrations/20260822193000_add_auth_foundation/migration.sql` | One additive PostgreSQL migration source; no deployment. |

No runtime file under `src/`, route, provider configuration, email transport, application service, environment file, or generated Prisma client is committed by Stage 13B.

## Frozen Persistence Contract

### Provider-owned models

The fresh Better Auth generator must produce exactly these provider fields:

```text
AuthProviderUser:
  id, name, email, emailVerified, image, createdAt, updatedAt,
  authprovidersessions, authprovideraccounts

AuthProviderSession:
  id, expiresAt, token, createdAt, updatedAt, ipAddress, userAgent, userId,
  authprovideruser

AuthProviderAccount:
  id, issuer, accountId, providerId, userId, authprovideruser, accessToken,
  refreshToken, idToken, accessTokenExpiresAt, refreshTokenExpiresAt, scope,
  password, createdAt, updatedAt

AuthProviderVerification:
  id, identifier, value, expiresAt, createdAt, updatedAt
```

Forbidden provider additions include `authenticatedAt`, `lastRefreshAt`,
`selectedOrganizationId`, canonical `userId` UUID relations, organization/role
state, recovery-token duplicates, and Passvero audit or abuse relations.

### Passvero-owned model purpose

| Model | Purpose | Authority boundary |
| --- | --- | --- |
| `AuthIdentity` | Immutable provider-subject binding with explicit revocation | Passvero identity mapping |
| `AccountActivationIntent` | Durable controlled-activation capability and reconciliation state | Passvero enrollment authority |
| `AuthSessionSelection` | Ephemeral server-side selected-organization pointer | Passvero selector, never authorization evidence |
| `AuthAbuseBucket` | Progressive account/network/global endpoint counters | Passvero abuse decision |
| `AuthAuditEvent` | Organization-neutral append-only authentication lifecycle audit | Passvero security audit |

`AuthAuditEvent` is required because existing `AuditLog.organizationId` is mandatory;
activation and identity binding occur before an authoritative organization context
may exist. It must not replace organization-scoped business `AuditLog`.

---

### Task 1: Pin Better Auth and capture the native provider schema

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `docs/superpowers/specs/assets/2026-08-22-better-auth-native-schema/generated-prisma-schema.prisma`
- Create: `tests/auth-persistence-schema.test.mjs`
- Modify: `tests/auth-foundation-review.test.mjs:15,540-586`

**Interfaces:**
- Consumes: approved architecture base and Better Auth 1.7.1 public generator/configuration surface.
- Produces: exact package pins and immutable raw provider schema consumed by Task 2.

- [ ] **Step 1: Verify the isolated execution boundary**

Run:

```bash
git status --short --branch
git rev-parse HEAD
git diff --quiet
git diff --cached --quiet
```

Expected: the approved Stage 13B execution branch is clean and contains this plan.
Stop if `main`, `docs/stage-13a-auth-foundation-review`, or an unexplained dirty
worktree is active.

- [ ] **Step 2: Write the dependency and generator RED contract**

Create `tests/auth-persistence-schema.test.mjs` with:

```js
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const packagePath = new URL("../package.json", import.meta.url);
const lockPath = new URL("../package-lock.json", import.meta.url);
const schemaPath = new URL("../prisma/schema.prisma", import.meta.url);
const migrationsPath = new URL("../prisma/migrations/", import.meta.url);
const generatedPath = new URL(
  "../docs/superpowers/specs/assets/2026-08-22-better-auth-native-schema/generated-prisma-schema.prisma",
  import.meta.url,
);

function block(source, kind, name) {
  const match = source.match(new RegExp(`${kind} ${name} \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `Missing ${kind} ${name}`);
  return match[1];
}

function fieldNames(model) {
  return model
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("///") && !line.startsWith("@@"))
    .map((line) => line.split(/\s+/, 1)[0]);
}

async function readStageMigration() {
  const entries = await readdir(migrationsPath, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("_add_auth_foundation"))
    .map((entry) => entry.name);
  assert.deepEqual(directories, ["20260822193000_add_auth_foundation"]);
  return readFile(new URL(`${directories[0]}/migration.sql`, migrationsPath), "utf8");
}

test("Stage 13B pins the reviewed Better Auth dependencies exactly", async () => {
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  const lock = JSON.parse(await readFile(lockPath, "utf8"));

  assert.equal(packageJson.dependencies["better-auth"], "1.7.1");
  assert.equal(packageJson.dependencies["@better-auth/prisma-adapter"], "1.7.1");
  assert.equal(lock.packages[""].dependencies["better-auth"], "1.7.1");
  assert.equal(lock.packages[""].dependencies["@better-auth/prisma-adapter"], "1.7.1");
  assert.equal(packageJson.dependencies["@better-auth/core"], undefined);
});

test("fresh provider schema is native and contains no Passvero extensions", async () => {
  const generated = await readFile(generatedPath, "utf8");
  const expectedModels = [
    "AuthProviderUser",
    "AuthProviderSession",
    "AuthProviderAccount",
    "AuthProviderVerification",
  ];

  assert.deepEqual(
    [...generated.matchAll(/^model (\w+) \{/gm)].map((match) => match[1]),
    expectedModels,
  );
  assert.deepEqual(fieldNames(block(generated, "model", "AuthProviderSession")), [
    "id", "expiresAt", "token", "createdAt", "updatedAt", "ipAddress",
    "userAgent", "userId", "authprovideruser",
  ]);
  assert.doesNotMatch(
    generated,
    /authenticatedAt|lastRefreshAt|selectedOrganizationId|AuthCredentialToken|Organization|Membership/,
  );
});
```

- [ ] **Step 3: Run the focused test to verify RED**

Run:

```bash
node --test tests/auth-persistence-schema.test.mjs
```

Expected: FAIL because the two dependencies and fresh generator artifact are absent.

- [ ] **Step 4: Add only the exact runtime dependencies**

Run:

```bash
env -u DATABASE_URL -u TEST_DATABASE_URL npm install --save-exact better-auth@1.7.1 @better-auth/prisma-adapter@1.7.1
```

Expected: `package.json` and `package-lock.json` add only the two direct packages
and their required transitive graph. The existing postinstall may generate the
current Prisma client but must not connect to a database. Stop on an install script
that attempts database access or on unrelated package-version drift.

Run:

```bash
npm explain better-auth
npm explain @better-auth/prisma-adapter
npm ls better-auth @better-auth/prisma-adapter @better-auth/core --all
git diff -- package.json package-lock.json
```

Expected: direct packages resolve to 1.7.1, core is transitive only, and no
unrelated direct dependency changes appear.

- [ ] **Step 5: Demonstrate and remove the historical Stage 13A HEAD-coupling residue**

Run after the dependency installation:

```bash
node --test tests/auth-foundation-review.test.mjs
```

Expected: FAIL only in `review stage leaves implementation paths unchanged`
because that historical test incorrectly inspects the future repository HEAD.
If another test fails, stop and investigate it separately.

In `tests/auth-foundation-review.test.mjs`, add after `stage13aBase`:

```js
const stage13aFinal = "aa2244de926093fa77260c911b28ff810cca8a17";

function readStage13aFile(path) {
  return execFileSync("git", ["show", `${stage13aFinal}:${path}`], {
    encoding: "utf8",
  });
}
```

Rename the test to `historical review stage left implementation paths unchanged`
and replace its current repository reads with:

```js
  const packageJson = readStage13aFile("package.json");
  assert.doesNotMatch(packageJson, /"better-auth"/);
  const canonicalSchema = readStage13aFile("prisma/schema.prisma");
  assert.doesNotMatch(canonicalSchema, /model AuthProviderUser\s*\{/);
  assert.doesNotMatch(canonicalSchema, /model AuthIdentity\s*\{/);
```

Rename the next test to
`historical cumulative Stage 13A diff left forbidden implementation paths untouched`
and change only its `git diff` arguments to:

```js
    ["diff", "--name-only", stage13aBase, stage13aFinal, "--", ...forbiddenPaths],
```

Run:

```bash
node --test tests/auth-foundation-review.test.mjs
```

Expected: all historical Stage 13A tests pass while inspecting the immutable
reviewed commit, not future canonical files. Do not weaken any historical content,
hash, proof-result, or forbidden-path assertion.

- [ ] **Step 6: Create a disposable generator workspace**

Run:

```bash
STAGE13B_GENERATOR_ROOT="$(mktemp -d /private/tmp/passvero-stage13b-native-schema.XXXXXX)"
chmod 700 "$STAGE13B_GENERATOR_ROOT"
printf '%s\n' "$STAGE13B_GENERATOR_ROOT"
```

Expected: one new owner-only directory under `/private/tmp`. Record its exact path
in the execution report. Do not reuse or delete an existing directory.

Use `apply_patch` to create `$STAGE13B_GENERATOR_ROOT/package.json`:

```json
{
  "name": "passvero-stage13b-native-schema",
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

Use `apply_patch` to create `$STAGE13B_GENERATOR_ROOT/auth.ts`:

```ts
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";

const schemaOnlyPrisma = {} as never;

export const auth = betterAuth({
  appName: "Passvero Stage 13B schema review",
  database: prismaAdapter(schemaOnlyPrisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false,
    minPasswordLength: 15,
    maxPasswordLength: 128,
  },
  user: { modelName: "AuthProviderUser" },
  session: {
    modelName: "AuthProviderSession",
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: false },
  },
  account: { modelName: "AuthProviderAccount" },
  verification: { modelName: "AuthProviderVerification" },
});
```

This disposable configuration deliberately has no session `additionalFields`,
organization plugin, OAuth provider, route handler, secret, database URL, or
Passvero import. Omitting `disableSignUp` permits a later controlled server-side
signup call; public registration remains disabled by the future Passvero HTTP
boundary, which is outside Stage 13B.

- [ ] **Step 7: Generate without database access**

Run from the exact recorded generator directory:

```bash
env -u DATABASE_URL -u TEST_DATABASE_URL npm install --ignore-scripts
env -u DATABASE_URL -u TEST_DATABASE_URL npx auth@1.7.1 generate --config ./auth.ts --output ./generated.prisma --yes
```

Expected: `generated.prisma` exists without any database connection. Stop if the
CLI version is not 1.7.1, asks for a database, or emits a field set different from
the frozen provider contract.

Copy the generated file mechanically to
`docs/superpowers/specs/assets/2026-08-22-better-auth-native-schema/generated-prisma-schema.prisma`,
then use `apply_patch` to prepend exactly:

```prisma
// Unmodified Better Auth 1.7.1 native-lifecycle generator output.
// Stage 13B evidence only; never migrate this standalone file directly.
```

Do not copy `package.json`, lockfiles, installed packages, or any other temporary
artifact into the repository.

- [ ] **Step 8: Verify GREEN and commit Task 1**

Run:

```bash
node --test tests/auth-persistence-schema.test.mjs
git diff --check
git status --short
```

Expected: the 2 new tests and all historical Stage 13A review tests pass. Only
the five Task 1 paths are changed.

Commit:

```bash
git add package.json package-lock.json tests/auth-persistence-schema.test.mjs tests/auth-foundation-review.test.mjs docs/superpowers/specs/assets/2026-08-22-better-auth-native-schema/generated-prisma-schema.prisma
git commit -m "chore: pin native Better Auth schema baseline"
```

---

### Task 2: Add provider-owned models and provider-neutral identity

**Files:**
- Modify: `prisma/schema.prisma:15-181`
- Modify: `prisma/schema.prisma:761-808`
- Modify: `tests/auth-persistence-schema.test.mjs`

**Interfaces:**
- Consumes: Task 1 raw provider schema.
- Produces: four isolated provider models and revocable provider-neutral `AuthIdentity` for later activation and audit relations.

- [ ] **Step 1: Add provider and identity RED tests**

Append to `tests/auth-persistence-schema.test.mjs`:

```js
test("canonical schema isolates the exact four native provider models", async () => {
  const schema = await readFile(schemaPath, "utf8");

  assert.deepEqual(fieldNames(block(schema, "model", "AuthProviderUser")), [
    "id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt",
    "authprovidersessions", "authprovideraccounts",
  ]);
  assert.deepEqual(fieldNames(block(schema, "model", "AuthProviderSession")), [
    "id", "expiresAt", "token", "createdAt", "updatedAt", "ipAddress",
    "userAgent", "userId", "authprovideruser",
  ]);
  assert.deepEqual(fieldNames(block(schema, "model", "AuthProviderAccount")), [
    "id", "issuer", "accountId", "providerId", "userId", "authprovideruser",
    "accessToken", "refreshToken", "idToken", "accessTokenExpiresAt",
    "refreshTokenExpiresAt", "scope", "password", "createdAt", "updatedAt",
  ]);
  assert.deepEqual(fieldNames(block(schema, "model", "AuthProviderVerification")), [
    "id", "identifier", "value", "expiresAt", "createdAt", "updatedAt",
  ]);
  for (const modelName of [
    "AuthProviderUser", "AuthProviderSession", "AuthProviderAccount",
    "AuthProviderVerification",
  ]) {
    assert.match(block(schema, "model", modelName), new RegExp(`@@map\\("${modelName}"\\)`));
  }
  assert.doesNotMatch(
    block(schema, "model", "AuthProviderSession"),
    /authenticatedAt|lastRefreshAt|selectedOrganizationId|organization|role|permission/,
  );
});

test("AuthIdentity is provider-neutral, unique by subject, and explicitly revocable", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const identity = block(schema, "model", "AuthIdentity");
  const user = block(schema, "model", "User");

  assert.match(block(schema, "enum", "AuthIdentityProvider"), /^\s*BETTER_AUTH\s*$/);
  assert.deepEqual(fieldNames(identity).filter((field) => field !== "auditEvents"), [
    "id", "userId", "provider", "providerSubject", "createdAt", "revokedAt",
    "user",
  ]);
  assert.match(identity, /@@unique\(\[provider, providerSubject\]\)/);
  assert.match(identity, /@@index\(\[userId\]\)/);
  assert.match(
    identity,
    /user\s+User\s+@relation\("UserAuthIdentities", fields: \[userId\], references: \[id\], onDelete: Restrict, onUpdate: Cascade\)/,
  );
  assert.match(user, /authIdentities\s+AuthIdentity\[\]\s+@relation\("UserAuthIdentities"\)/);
  assert.doesNotMatch(identity, /email|organization|membership|role|permission|providerUser/);
  assert.doesNotMatch(identity, /updatedAt/);
});
```

- [ ] **Step 2: Run the focused test to verify RED**

Run:

```bash
node --test tests/auth-persistence-schema.test.mjs
```

Expected: the Task 1 tests pass and the two new tests fail because the canonical
models are absent.

- [ ] **Step 3: Add the provider allowlist and canonical inverse relation**

Add after `BackgroundJobStatus`:

```prisma
enum AuthIdentityProvider {
  BETTER_AUTH
}
```

Add to `User` relations:

```prisma
  authIdentities AuthIdentity[] @relation("UserAuthIdentities")
```

- [ ] **Step 4: Add the exact provider and identity models**

Append after `BackgroundJob`:

```prisma
model AuthProviderUser {
  id                   String                @id
  name                 String
  email                String
  emailVerified        Boolean               @default(false)
  image                String?
  createdAt            DateTime              @default(now())
  updatedAt            DateTime              @updatedAt
  authprovidersessions AuthProviderSession[]
  authprovideraccounts AuthProviderAccount[]

  @@unique([email])
  @@map("AuthProviderUser")
}

model AuthProviderSession {
  id               String           @id
  expiresAt        DateTime
  token            String
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt
  ipAddress        String?
  userAgent        String?
  userId           String
  authprovideruser AuthProviderUser @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([token])
  @@index([userId])
  @@map("AuthProviderSession")
}

model AuthProviderAccount {
  id                    String           @id
  issuer                String
  accountId             String
  providerId            String
  userId                String
  authprovideruser      AuthProviderUser @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime         @default(now())
  updatedAt             DateTime         @updatedAt

  @@unique([issuer, accountId], map: "AuthProviderAccount_issuer_accountId_uidx")
  @@index([userId])
  @@map("AuthProviderAccount")
}

model AuthProviderVerification {
  id         String   @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([identifier])
  @@map("AuthProviderVerification")
}

model AuthIdentity {
  id              String               @id @default(uuid()) @db.Uuid
  userId          String               @db.Uuid
  provider        AuthIdentityProvider
  providerSubject String
  createdAt       DateTime             @default(now())
  revokedAt       DateTime?

  user User @relation("UserAuthIdentities", fields: [userId], references: [id], onDelete: Restrict, onUpdate: Cascade)

  @@unique([provider, providerSubject])
  @@index([userId])
}
```

Do not add a foreign key from `AuthIdentity.providerSubject` to
`AuthProviderUser.id`; that would destroy provider neutrality and make provider
cleanup control canonical identity history.

- [ ] **Step 5: Validate GREEN and commit Task 2**

Run:

```bash
node --test tests/auth-persistence-schema.test.mjs
env -u DATABASE_URL -u TEST_DATABASE_URL npx prisma validate
env -u DATABASE_URL -u TEST_DATABASE_URL npm run prisma:generate
git diff --check
```

Expected: 4 tests pass; Prisma validation and generation exit 0 without database
access.

Commit:

```bash
git add prisma/schema.prisma tests/auth-persistence-schema.test.mjs
git commit -m "feat: add provider-neutral auth identity schema"
```

---

### Task 3: Add controlled activation and organization-neutral auth audit

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `tests/auth-persistence-schema.test.mjs`

**Interfaces:**
- Consumes: `AuthIdentityProvider`, `AuthIdentity`, canonical `User`.
- Produces: durable activation reconciliation and an append-only audit target usable before organization context exists.

- [ ] **Step 1: Add activation and audit RED tests**

Append:

```js
test("AccountActivationIntent stores only controlled activation and reconciliation state", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const activation = block(schema, "model", "AccountActivationIntent");
  const user = block(schema, "model", "User");

  assert.match(
    block(schema, "enum", "AccountActivationStatus"),
    /^\s*ISSUED\s+IN_PROGRESS\s+AUTH_ACCOUNT_CREATED\s+EMAIL_VERIFIED\s+BOUND\s+EXPIRED\s+REVOKED\s+CONFLICT\s*$/,
  );
  assert.deepEqual(fieldNames(activation), [
    "id", "userId", "provider", "status", "tokenDigest", "intendedEmailDigest",
    "providerSubject", "claimId", "claimedAt", "claimExpiresAt", "expiresAt",
    "authAccountCreatedAt", "emailVerifiedAt", "boundAt", "expiredAt",
    "revokedAt", "conflictAt", "createdAt", "updatedAt", "user",
  ]);
  assert.match(activation, /tokenDigest\s+String\s+@unique\s+@db\.VarChar\(43\)/);
  assert.match(activation, /intendedEmailDigest\s+String\s+@db\.VarChar\(43\)/);
  assert.match(activation, /@@unique\(\[provider, providerSubject\]\)/);
  assert.match(activation, /@@index\(\[userId\]\)/);
  assert.match(activation, /@@index\(\[status, expiresAt\]\)/);
  assert.match(activation, /@@index\(\[claimExpiresAt\]\)/);
  assert.match(user, /accountActivationIntents\s+AccountActivationIntent\[\]\s+@relation\("UserAccountActivationIntents"\)/);
  assert.doesNotMatch(activation, /password|verificationToken|resetToken|sessionToken|organizationId/);
});

test("AuthAuditEvent is minimal, append-only, and independent of organization context", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const event = block(schema, "model", "AuthAuditEvent");
  const user = block(schema, "model", "User");
  const identity = block(schema, "model", "AuthIdentity");

  assert.deepEqual(fieldNames(event), [
    "id", "userId", "authIdentityId", "action", "summary", "metadata",
    "correlationId", "occurredAt", "createdAt", "user", "authIdentity",
  ]);
  assert.match(user, /authAuditEvents\s+AuthAuditEvent\[\]\s+@relation\("UserAuthAuditEvents"\)/);
  assert.match(identity, /auditEvents\s+AuthAuditEvent\[\]\s+@relation\("AuthIdentityAuditEvents"\)/);
  assert.match(event, /@@index\(\[userId, occurredAt\]\)/);
  assert.match(event, /@@index\(\[authIdentityId, occurredAt\]\)/);
  assert.match(event, /@@index\(\[action, occurredAt\]\)/);
  assert.match(event, /@@index\(\[correlationId\]\)/);
  assert.match(event, /@@index\(\[occurredAt\]\)/);
  assert.doesNotMatch(event, /updatedAt|organizationId|providerSubject|email|token|password|ipAddress|userAgent/);
});
```

- [ ] **Step 2: Run focused RED**

Run:

```bash
node --test tests/auth-persistence-schema.test.mjs
```

Expected: 4 earlier tests pass and the two new tests fail.

- [ ] **Step 3: Add the activation enum and inverse relations**

Add after `AuthIdentityProvider`:

```prisma
enum AccountActivationStatus {
  ISSUED
  IN_PROGRESS
  AUTH_ACCOUNT_CREATED
  EMAIL_VERIFIED
  BOUND
  EXPIRED
  REVOKED
  CONFLICT
}
```

Add to `User`:

```prisma
  accountActivationIntents AccountActivationIntent[] @relation("UserAccountActivationIntents")
  authAuditEvents          AuthAuditEvent[]           @relation("UserAuthAuditEvents")
```

Add to `AuthIdentity` after its `user` relation:

```prisma
  auditEvents AuthAuditEvent[] @relation("AuthIdentityAuditEvents")
```

- [ ] **Step 4: Add the exact activation and audit models**

Append:

```prisma
model AccountActivationIntent {
  id                   String                  @id @default(uuid()) @db.Uuid
  userId               String                  @db.Uuid
  provider             AuthIdentityProvider    @default(BETTER_AUTH)
  status               AccountActivationStatus @default(ISSUED)
  tokenDigest          String                  @unique @db.VarChar(43)
  intendedEmailDigest  String                  @db.VarChar(43)
  providerSubject      String?
  claimId              String?                 @db.Uuid
  claimedAt            DateTime?
  claimExpiresAt       DateTime?
  expiresAt            DateTime
  authAccountCreatedAt DateTime?
  emailVerifiedAt      DateTime?
  boundAt              DateTime?
  expiredAt            DateTime?
  revokedAt            DateTime?
  conflictAt           DateTime?
  createdAt            DateTime                @default(now())
  updatedAt            DateTime                @updatedAt

  user User @relation("UserAccountActivationIntents", fields: [userId], references: [id], onDelete: Restrict, onUpdate: Cascade)

  @@unique([provider, providerSubject])
  @@index([userId])
  @@index([status, expiresAt])
  @@index([claimExpiresAt])
}

model AuthAuditEvent {
  id             String   @id @default(uuid()) @db.Uuid
  userId         String?  @db.Uuid
  authIdentityId String?  @db.Uuid
  action         String
  summary        String?
  metadata       Json?
  correlationId  String
  occurredAt     DateTime @default(now())
  createdAt      DateTime @default(now())

  user         User?         @relation("UserAuthAuditEvents", fields: [userId], references: [id], onDelete: SetNull, onUpdate: Cascade)
  authIdentity AuthIdentity? @relation("AuthIdentityAuditEvents", fields: [authIdentityId], references: [id], onDelete: SetNull, onUpdate: Cascade)

  @@index([userId, occurredAt])
  @@index([authIdentityId, occurredAt])
  @@index([action, occurredAt])
  @@index([correlationId])
  @@index([occurredAt])
}
```

`AuthAuditEvent.metadata` is restricted by future application allowlists. It must
never contain tokens, credentials, raw request data, provider subjects, complete
payloads, or stack traces.

- [ ] **Step 5: Validate GREEN and commit Task 3**

Run:

```bash
node --test tests/auth-persistence-schema.test.mjs
env -u DATABASE_URL -u TEST_DATABASE_URL npx prisma validate
env -u DATABASE_URL -u TEST_DATABASE_URL npm run prisma:generate
git diff --check
```

Expected: 6 tests pass and Prisma commands exit 0 without database access.

Commit:

```bash
git add prisma/schema.prisma tests/auth-persistence-schema.test.mjs
git commit -m "feat: add controlled activation persistence"
```

---

### Task 4: Add server-side organization selection and progressive abuse state

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `tests/auth-persistence-schema.test.mjs`

**Interfaces:**
- Consumes: `AuthIdentityProvider`, canonical `Organization`.
- Produces: provider-neutral session selector and all initial authentication abuse dimensions/endpoints.

- [ ] **Step 1: Add session-selection and abuse RED tests**

Append:

```js
test("AuthSessionSelection is provider-neutral selection only", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const selection = block(schema, "model", "AuthSessionSelection");
  const organization = block(schema, "model", "Organization");

  assert.deepEqual(fieldNames(selection), [
    "id", "provider", "providerSessionId", "selectedOrganizationId",
    "createdAt", "updatedAt", "selectedOrganization",
  ]);
  assert.match(selection, /@@unique\(\[provider, providerSessionId\]\)/);
  assert.match(selection, /@@index\(\[selectedOrganizationId\]\)/);
  assert.match(
    selection,
    /selectedOrganization\s+Organization\s+@relation\("OrganizationAuthSessionSelections", fields: \[selectedOrganizationId\], references: \[id\], onDelete: Cascade, onUpdate: Cascade\)/,
  );
  assert.match(organization, /authSessionSelections\s+AuthSessionSelection\[\]\s+@relation\("OrganizationAuthSessionSelections"\)/);
  assert.doesNotMatch(selection, /userId|membership|role|permission|status|entitlement|billing|token|expiresAt/);
});

test("AuthAbuseBucket stores only keyed progressive counters", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const bucket = block(schema, "model", "AuthAbuseBucket");

  assert.match(
    block(schema, "enum", "AuthAbuseDimension"),
    /^\s*TRUSTED_NETWORK\s+ACCOUNT_IDENTIFIER\s+ACCOUNT_AND_TRUSTED_NETWORK\s+GLOBAL_ENDPOINT\s*$/,
  );
  assert.match(
    block(schema, "enum", "AuthAbuseEndpoint"),
    /^\s*SIGN_IN\s+ACTIVATE_ACCOUNT\s+EMAIL_VERIFICATION_REQUEST\s+EMAIL_VERIFICATION_CONSUME\s+PASSWORD_RESET_REQUEST\s+PASSWORD_RESET_CONSUME\s+PASSWORD_CHANGE\s*$/,
  );
  assert.deepEqual(fieldNames(bucket), [
    "id", "dimension", "endpoint", "keyDigest", "attemptCount", "failureCount",
    "backoffLevel", "windowStartedAt", "lastAttemptAt", "lastFailureAt",
    "blockedUntil", "expiresAt", "createdAt", "updatedAt",
  ]);
  assert.match(bucket, /keyDigest\s+String\s+@db\.VarChar\(43\)/);
  assert.match(bucket, /@@unique\(\[dimension, endpoint, keyDigest\]\)/);
  assert.match(bucket, /@@index\(\[endpoint, dimension, blockedUntil\]\)/);
  assert.match(bucket, /@@index\(\[expiresAt\]\)/);
  assert.doesNotMatch(bucket, /email|ipAddress|network|userId|organizationId|providerSubject|token|password/);
});
```

- [ ] **Step 2: Run focused RED**

Run:

```bash
node --test tests/auth-persistence-schema.test.mjs
```

Expected: 6 earlier tests pass and the two new tests fail.

- [ ] **Step 3: Add abuse enums and organization inverse**

Add after `AccountActivationStatus`:

```prisma
enum AuthAbuseDimension {
  TRUSTED_NETWORK
  ACCOUNT_IDENTIFIER
  ACCOUNT_AND_TRUSTED_NETWORK
  GLOBAL_ENDPOINT
}

enum AuthAbuseEndpoint {
  SIGN_IN
  ACTIVATE_ACCOUNT
  EMAIL_VERIFICATION_REQUEST
  EMAIL_VERIFICATION_CONSUME
  PASSWORD_RESET_REQUEST
  PASSWORD_RESET_CONSUME
  PASSWORD_CHANGE
}
```

Add to `Organization` relations:

```prisma
  authSessionSelections AuthSessionSelection[] @relation("OrganizationAuthSessionSelections")
```

- [ ] **Step 4: Add the exact selection and abuse models**

Append:

```prisma
model AuthSessionSelection {
  id                     String               @id @default(uuid()) @db.Uuid
  provider               AuthIdentityProvider
  providerSessionId      String
  selectedOrganizationId String               @db.Uuid
  createdAt              DateTime             @default(now())
  updatedAt              DateTime             @updatedAt

  selectedOrganization Organization @relation("OrganizationAuthSessionSelections", fields: [selectedOrganizationId], references: [id], onDelete: Cascade, onUpdate: Cascade)

  @@unique([provider, providerSessionId])
  @@index([selectedOrganizationId])
}

model AuthAbuseBucket {
  id              String             @id @default(uuid()) @db.Uuid
  dimension       AuthAbuseDimension
  endpoint        AuthAbuseEndpoint
  keyDigest       String             @db.VarChar(43)
  attemptCount    Int                @default(0)
  failureCount    Int                @default(0)
  backoffLevel    Int                @default(0)
  windowStartedAt DateTime
  lastAttemptAt   DateTime
  lastFailureAt   DateTime?
  blockedUntil    DateTime?
  expiresAt       DateTime
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  @@unique([dimension, endpoint, keyDigest])
  @@index([endpoint, dimension, blockedUntil])
  @@index([expiresAt])
}
```

- [ ] **Step 5: Validate GREEN and commit Task 4**

Run:

```bash
node --test tests/auth-persistence-schema.test.mjs
env -u DATABASE_URL -u TEST_DATABASE_URL npx prisma validate
env -u DATABASE_URL -u TEST_DATABASE_URL npm run prisma:generate
git diff --check
```

Expected: 8 tests pass; no database is accessed.

Commit:

```bash
git add prisma/schema.prisma tests/auth-persistence-schema.test.mjs
git commit -m "feat: add auth selection and abuse schema"
```

---

### Task 5: Create the single additive migration contract

**Files:**
- Create: `prisma/migrations/20260822193000_add_auth_foundation/migration.sql`
- Modify: `tests/auth-persistence-schema.test.mjs`

**Interfaces:**
- Consumes: complete Tasks 1-4 Prisma schema and immutable architecture base schema.
- Produces: one reviewed additive PostgreSQL migration source for separate Stage 13C deployment.

- [ ] **Step 1: Add migration RED tests**

Append:

```js
test("auth migration creates exactly the approved additive objects", async () => {
  const sql = await readStageMigration();
  const expectedEnums = [
    "AccountActivationStatus", "AuthAbuseDimension", "AuthAbuseEndpoint",
    "AuthIdentityProvider",
  ].sort();
  const expectedTables = [
    "AccountActivationIntent", "AuthAbuseBucket", "AuthAuditEvent", "AuthIdentity",
    "AuthProviderAccount", "AuthProviderSession", "AuthProviderUser",
    "AuthProviderVerification", "AuthSessionSelection",
  ].sort();

  assert.deepEqual(
    [...sql.matchAll(/CREATE TYPE "(\w+)"/g)].map((match) => match[1]).sort(),
    expectedEnums,
  );
  assert.deepEqual(
    [...sql.matchAll(/CREATE TABLE "(\w+)"/g)].map((match) => match[1]).sort(),
    expectedTables,
  );
  assert.equal([...sql.matchAll(/FOREIGN KEY/g)].length, 7);
  assert.doesNotMatch(
    sql,
    /\b(DROP|TRUNCATE|INSERT INTO|UPDATE .+ SET|DELETE FROM|CREATE FUNCTION|CREATE TRIGGER|CREATE POLICY|CREATE VIEW|CREATE MATERIALIZED VIEW|PARTITION BY|GRANT|REVOKE)\b/,
  );
  assert.doesNotMatch(sql, /ALTER TABLE "(?:User|Organization|Membership|Invitation|Product|AuditLog)"/);
});

test("auth migration preserves provider ownership and separation", async () => {
  const sql = await readStageMigration();
  const providerSession = sql.match(/CREATE TABLE "AuthProviderSession" \(([\s\S]*?)\n\);/);
  const identity = sql.match(/CREATE TABLE "AuthIdentity" \(([\s\S]*?)\n\);/);

  assert.ok(providerSession);
  assert.ok(identity);
  assert.doesNotMatch(providerSession[1], /authenticatedAt|lastRefreshAt|selectedOrganizationId|organization|role|permission/);
  assert.doesNotMatch(identity[1], /email|organization|membership|role|permission|AuthProviderUser/);
  assert.doesNotMatch(sql, /AuthCredentialToken/);
  assert.doesNotMatch(
    sql,
    /FOREIGN KEY \("providerSubject"\) REFERENCES "AuthProviderUser"/,
  );
});

test("manual auth constraints enforce revocation, activation, abuse, and audit invariants", async () => {
  const sql = await readStageMigration();
  const requiredConstraints = [
    "ck_auth_identity_revocation_order",
    "ck_account_activation_intent_digests",
    "ck_account_activation_intent_expiry",
    "ck_account_activation_intent_claim",
    "ck_account_activation_intent_milestones",
    "ck_account_activation_intent_state",
    "ck_account_activation_intent_terminal_state",
    "ck_account_activation_intent_timestamp_order",
    "ck_auth_abuse_bucket_digest",
    "ck_auth_abuse_bucket_counts",
    "ck_auth_abuse_bucket_timestamp_order",
    "ck_auth_audit_event_action",
    "ck_auth_audit_event_summary",
    "ck_auth_audit_event_correlation",
  ];

  for (const name of requiredConstraints) {
    assert.match(sql, new RegExp(`CONSTRAINT "${name}"`));
  }
  assert.match(
    sql,
    /CREATE UNIQUE INDEX "ux_account_activation_intent_one_active_per_user"[\s\S]*?WHERE "status" IN \('ISSUED', 'IN_PROGRESS', 'AUTH_ACCOUNT_CREATED', 'EMAIL_VERIFIED'\)/,
  );
});

test("all pre-Stage 13B migration sources retain their reviewed hashes", async () => {
  const approvedMigrations = new Map([
    ["20260717191316_init_identity_domain", "347ada303ff4cc2495301b400955e0d89cf743fd1990dd27b9f6bb6889ecf0f6"],
    ["20260720170638_add_product_core_and_passport", "0395328af8ebd574ed7b8ad9d3b532233ea015c5f91dd02040e3ca877cd8442d"],
    ["20260720172426_add_product_translation", "05b0eba12925bba3d7b0ac7b6108a1e1c0057d305c233a7c90d75bcd4118e8fa"],
    ["20260720173610_add_product_identifier", "62be095ca5f0349105281a7ac72009c306a8c72da7cd5bfdb5832c6838dce288"],
    ["20260720175253_add_product_material", "41d4e2cc5857213ca6ccc65ce700b704fa590e375049d1dc317d6376f2b61737"],
    ["20260720182219_add_document_asset", "cb08e7305980f907343f464ba2519e22d2c3b7ba1ed833da88b58e20c6455e3f"],
    ["20260720184244_add_product_document", "777c2d4ccb60599235013e76868673a3b1298fe73b7a8147cb7c758af8288c74"],
    ["20260720190323_add_product_image", "617932a5b88328541ca656b3123e66789772513a0ee67b5ebff97e48735e4525"],
    ["20260721163104_add_qr_code", "2f1174adc82388e34225f29df56863e601c929c7a7ef2bb9749a63ae170c8dae"],
    ["20260721173458_add_scan_event", "89e069a2e5e53c517169da6f598480e511a7253f66b738236aa643cedc9154d0"],
    ["20260721180144_add_audit_log", "187195dc4f664e1e66f30978da4fd39a733b866c6602ba088b78863a992e4685"],
    ["20260721182339_add_plan", "402ebb2d4fd11bf08201b080ae72fe77bd1464c9a86a0aa2f514edfb40c56761"],
    ["20260721190547_add_subscription", "ee40fc679466c1fe484b1f208d07dac6c533ecd32b8a9d84638a066bbcaba440"],
    ["20260722171607_add_notification", "d71c44c01edbf56e905a88cddc223716454b10a396681ee0ce14ef85fc013f5b"],
    ["20260722180124_add_integration_mapping", "368783ae2a1895ca2aeb5f53af1dd6a2f21b29ac22127be001b30b0ea052e4ab"],
    ["20260722184010_add_background_job", "167d74bed2928834bf0dc0ec57923702e51acecd2836c3f1c35ad96b1a3ebeda"],
  ]);

  for (const [directory, expectedHash] of approvedMigrations) {
    const sql = await readFile(new URL(`${directory}/migration.sql`, migrationsPath), "utf8");
    assert.equal(
      createHash("sha256").update(sql).digest("hex"),
      expectedHash,
      `${directory} migration source changed`,
    );
  }
});
```

- [ ] **Step 2: Run focused RED**

Run:

```bash
node --test tests/auth-persistence-schema.test.mjs
```

Expected: 8 schema tests pass and four migration tests fail because the migration
directory is absent.

- [ ] **Step 3: Generate additive SQL from immutable base schema to current schema**

Run:

```bash
STAGE13B_BEFORE_SCHEMA="$(mktemp /private/tmp/passvero-stage13b-before-schema.XXXXXX.prisma)"
git show 3657cd2e0493d9d0122b5c25b3fac252603efc99:prisma/schema.prisma > "$STAGE13B_BEFORE_SCHEMA"
mkdir -p prisma/migrations/20260822193000_add_auth_foundation
env -u DATABASE_URL -u TEST_DATABASE_URL npx prisma migrate diff --from-schema "$STAGE13B_BEFORE_SCHEMA" --to-schema prisma/schema.prisma --script --output prisma/migrations/20260822193000_add_auth_foundation/migration.sql
```

Expected: Prisma writes one additive SQL file without loading a datasource or
connecting to PostgreSQL. Inspect the output before continuing. It must create
exactly the four enums and nine tables from this plan and must not alter existing
tables except by foreign keys declared on the new tables.

- [ ] **Step 4: Add exact manual PostgreSQL constraints and partial uniqueness**

Use `apply_patch` to append this exact SQL to the generated migration:

```sql
-- Manual constraints not expressible in Prisma schema syntax.
ALTER TABLE "AuthIdentity"
ADD CONSTRAINT "ck_auth_identity_revocation_order"
CHECK ("revokedAt" IS NULL OR "revokedAt" >= "createdAt");

ALTER TABLE "AccountActivationIntent"
ADD CONSTRAINT "ck_account_activation_intent_digests"
CHECK (
  char_length("tokenDigest") = 43
  AND "tokenDigest" ~ '^[A-Za-z0-9_-]{43}$'
  AND char_length("intendedEmailDigest") = 43
  AND "intendedEmailDigest" ~ '^[A-Za-z0-9_-]{43}$'
),
ADD CONSTRAINT "ck_account_activation_intent_expiry"
CHECK ("expiresAt" > "createdAt"),
ADD CONSTRAINT "ck_account_activation_intent_claim"
CHECK (
  (
    "status" = 'IN_PROGRESS'::"AccountActivationStatus"
    AND "claimId" IS NOT NULL
    AND "claimedAt" IS NOT NULL
    AND "claimExpiresAt" IS NOT NULL
    AND "claimExpiresAt" > "claimedAt"
  )
  OR (
    "status" <> 'IN_PROGRESS'::"AccountActivationStatus"
    AND "claimId" IS NULL
    AND "claimedAt" IS NULL
    AND "claimExpiresAt" IS NULL
  )
),
ADD CONSTRAINT "ck_account_activation_intent_milestones"
CHECK (
  (("providerSubject" IS NULL AND "authAccountCreatedAt" IS NULL)
    OR ("providerSubject" IS NOT NULL AND "authAccountCreatedAt" IS NOT NULL))
  AND ("emailVerifiedAt" IS NULL OR "authAccountCreatedAt" IS NOT NULL)
  AND ("boundAt" IS NULL OR "emailVerifiedAt" IS NOT NULL)
),
ADD CONSTRAINT "ck_account_activation_intent_state"
CHECK (
  (
    "status" IN ('ISSUED', 'IN_PROGRESS')
    AND "providerSubject" IS NULL
    AND "emailVerifiedAt" IS NULL
  )
  OR (
    "status" = 'AUTH_ACCOUNT_CREATED'
    AND "providerSubject" IS NOT NULL
    AND "authAccountCreatedAt" IS NOT NULL
    AND "emailVerifiedAt" IS NULL
  )
  OR (
    "status" IN ('EMAIL_VERIFIED', 'BOUND')
    AND "providerSubject" IS NOT NULL
    AND "authAccountCreatedAt" IS NOT NULL
    AND "emailVerifiedAt" IS NOT NULL
  )
  OR "status" IN ('EXPIRED', 'REVOKED', 'CONFLICT')
),
ADD CONSTRAINT "ck_account_activation_intent_terminal_state"
CHECK (
  (("status" = 'BOUND') = ("boundAt" IS NOT NULL))
  AND (("status" = 'EXPIRED') = ("expiredAt" IS NOT NULL))
  AND (("status" = 'REVOKED') = ("revokedAt" IS NOT NULL))
  AND (("status" = 'CONFLICT') = ("conflictAt" IS NOT NULL))
),
ADD CONSTRAINT "ck_account_activation_intent_timestamp_order"
CHECK (
  ("claimedAt" IS NULL OR "claimedAt" >= "createdAt")
  AND ("authAccountCreatedAt" IS NULL OR "authAccountCreatedAt" >= "createdAt")
  AND ("emailVerifiedAt" IS NULL OR "emailVerifiedAt" >= "authAccountCreatedAt")
  AND ("boundAt" IS NULL OR "boundAt" >= "emailVerifiedAt")
  AND ("expiredAt" IS NULL OR "expiredAt" >= "createdAt")
  AND ("revokedAt" IS NULL OR "revokedAt" >= "createdAt")
  AND ("conflictAt" IS NULL OR "conflictAt" >= "createdAt")
);

CREATE UNIQUE INDEX "ux_account_activation_intent_one_active_per_user"
ON "AccountActivationIntent" ("userId")
WHERE "status" IN ('ISSUED', 'IN_PROGRESS', 'AUTH_ACCOUNT_CREATED', 'EMAIL_VERIFIED');

ALTER TABLE "AuthAbuseBucket"
ADD CONSTRAINT "ck_auth_abuse_bucket_digest"
CHECK (char_length("keyDigest") = 43 AND "keyDigest" ~ '^[A-Za-z0-9_-]{43}$'),
ADD CONSTRAINT "ck_auth_abuse_bucket_counts"
CHECK (
  "attemptCount" >= 0
  AND "failureCount" >= 0
  AND "failureCount" <= "attemptCount"
  AND "backoffLevel" >= 0
),
ADD CONSTRAINT "ck_auth_abuse_bucket_timestamp_order"
CHECK (
  "lastAttemptAt" >= "windowStartedAt"
  AND ("lastFailureAt" IS NULL OR (
    "lastFailureAt" >= "windowStartedAt"
    AND "lastFailureAt" <= "lastAttemptAt"
  ))
  AND ("blockedUntil" IS NULL OR "blockedUntil" >= "lastAttemptAt")
  AND "expiresAt" > "lastAttemptAt"
);

ALTER TABLE "AuthAuditEvent"
ADD CONSTRAINT "ck_auth_audit_event_action"
CHECK ("action" = btrim("action") AND "action" ~ '^[A-Z][A-Z0-9_]*$'),
ADD CONSTRAINT "ck_auth_audit_event_summary"
CHECK (
  "summary" IS NULL
  OR ("summary" = btrim("summary") AND char_length("summary") BETWEEN 1 AND 500)
),
ADD CONSTRAINT "ck_auth_audit_event_correlation"
CHECK (
  "correlationId" = btrim("correlationId")
  AND char_length("correlationId") BETWEEN 1 AND 128
);
```

The `AccountActivationIntent` partial unique index requires reissue logic to
transition any previous active intent to `EXPIRED` or `REVOKED` in the same
Passvero transaction before inserting its replacement. It does not use `now()` in
the predicate, avoiding a volatile partial-index condition.

- [ ] **Step 5: Run migration and cumulative schema verification**

Run:

```bash
node --test tests/auth-persistence-schema.test.mjs
npm run test:schema
env -u DATABASE_URL -u TEST_DATABASE_URL npx prisma validate
env -u DATABASE_URL -u TEST_DATABASE_URL npm run prisma:generate
git diff --check
```

Expected: all new and existing schema tests pass; Prisma exits 0; no database is
accessed. If Prisma-generated SQL differs from test assumptions, inspect and
correct the plan/schema contract rather than weakening exclusions.

- [ ] **Step 6: Commit Task 5**

```bash
git add prisma/migrations/20260822193000_add_auth_foundation/migration.sql tests/auth-persistence-schema.test.mjs
git commit -m "feat: add auth foundation migration source"
```

---

### Task 6: Cumulative security, dependency, and scope review

**Files:**
- No new files expected.
- Modify only a Stage 13B file from the Planned File Map if fresh verification finds a concrete defect.

**Interfaces:**
- Consumes: all Stage 13B commits.
- Produces: review-ready branch and exact stop report for operator schema/migration approval.

- [ ] **Step 1: Verify forbidden architecture is absent**

`selectedOrganizationId` is forbidden specifically in provider tables; the
approved Passvero field is named `AuthSessionSelection.selectedOrganizationId`.
Run these exact scoped checks:

```bash
node -e 'const fs=require("fs");const s=fs.readFileSync("prisma/schema.prisma","utf8");const m=s.match(/model AuthProviderSession \{([\s\S]*?)\n\}/);if(!m)process.exit(1);if(/AuthCredentialToken|authenticatedAt|lastRefreshAt|selectedOrganizationId/.test(m[1]))process.exit(1);console.log("PROVIDER_SESSION_EXTENSION_EXCLUSION=PASS")'
if rg -n '^model AuthCredentialToken\b|^enum AuthCredentialToken' prisma/schema.prisma; then exit 1; fi
if rg -n 'better-auth|AuthProvider' src; then exit 1; fi
```

Expected: the provider-session script prints
`PROVIDER_SESSION_EXTENSION_EXCLUSION=PASS`; both `rg` commands produce no
matches because the Passvero-owned selection field is approved but provider
extensions and runtime imports are forbidden.

- [ ] **Step 2: Run the complete repository verification appropriate to Stage 13B**

Run:

```bash
npm run test:schema
npm run test:application
npm run test:infrastructure
npm run lint
npm run build
env -u DATABASE_URL -u TEST_DATABASE_URL npx prisma validate
env -u DATABASE_URL -u TEST_DATABASE_URL npm run prisma:generate
npm audit --omit=dev
git diff --check
```

Expected: every command exits 0. Do not run `test:integration`, because Stage 13B
has no database authority. Do not use `npm audit fix`, `--force`, or unrelated
dependency remediation if audit fails; record the exact result and stop for a
separate decision.

- [ ] **Step 3: Verify exact branch scope**

Run:

```bash
git diff --name-only 3657cd2e0493d9d0122b5c25b3fac252603efc99..HEAD
git status --short
git log --oneline --decorate 3657cd2e0493d9d0122b5c25b3fac252603efc99..HEAD
```

Expected changed paths are limited to:

```text
docs/superpowers/plans/2026-08-22-passvero-auth-persistence-schema-and-migration.md
docs/superpowers/specs/assets/2026-08-22-better-auth-native-schema/generated-prisma-schema.prisma
package.json
package-lock.json
prisma/schema.prisma
prisma/migrations/20260822193000_add_auth_foundation/migration.sql
tests/auth-persistence-schema.test.mjs
tests/auth-foundation-review.test.mjs
```

No `src/`, environment, generated-client, prior migration, Stage 13A evidence,
retained proof, deployment, or database change is permitted.

- [ ] **Step 4: Produce the operator stop report**

Report in chat:

- branch and exact final commit;
- execution base;
- raw generator SHA-256;
- exact direct dependency versions and resolved tree;
- the four enums and nine tables added;
- migration SHA-256;
- all verification commands and pass/fail counts;
- explicit confirmation that no database or environment URL was accessed;
- explicit confirmation that no provider-table runtime write, recovery-token
  duplicate, custom provider-session field, runtime source, or deployment was
  added;
- exact changed-file list;
- any residual warning or blocker.

Stop with:

```text
STAGE_13B_SCHEMA_AND_MIGRATION_SOURCE=AWAITING_OPERATOR_REVIEW
STAGE_13C_DEPLOYMENT_AUTHORIZED=NO
```

Do not merge, deploy, connect to PostgreSQL, or begin Stage 13C without a new
operator decision.
