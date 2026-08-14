# Production PrismaPg Runtime Prerequisite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify the reusable, server-only production PrismaPg runtime configuration, singleton lifecycle, and CreateProduct persistence composition required before Phase 9.

**Architecture:** A pure infrastructure validator accepts an explicit `DATABASE_URL` candidate and enforces the `passvero_app`/`passvero` direct-PostgreSQL contract without reading environment state. A generic lifecycle core constructs and manages one Pool/adapter/client tuple, while a `server-only` production wrapper reads `DATABASE_URL`, binds the real `pg`, `PrismaPg`, and `PrismaClient` constructors, stores the lifecycle on `globalThis`, and exposes existing CreateProduct persistence dependencies without invoking the service.

**Tech Stack:** TypeScript 5, Node test runner through `tsx`, Next.js 16.2.10, Prisma/Prisma Client/PrismaPg 7.8.0, `pg` 8.23.0, `server-only` 0.0.1, npm lockfile v3.

## Global Constraints

- Work only in `/private/tmp/passvero-production-prismapg-runtime` on `feat/production-prismapg-runtime`; keep the primary `main` checkout clean.
- This is the Phase 9 prerequisite only. Do not execute Phase 9 or any later phase.
- Do not connect to production PostgreSQL or modify production/test databases, roles, grants, data, schema, or migrations.
- Do not modify `prisma/schema.prisma`, any of the 16 migration sources, environment files, `prisma.config.ts`, `ecosystem.config.cjs`, PM2, VPS state, `/etc/passvero`, or deployment state.
- Do not provision, print, log, commit, or request secrets. Do not change or retire Prisma Accelerate credentials.
- Production runtime code reads only `DATABASE_URL`; it must never read or fall back to `TEST_DATABASE_URL`.
- Accept only `postgres:` and `postgresql:` URLs whose decoded user is exactly `passvero_app` and decoded database is exactly `passvero`.
- Keep validation pure and infrastructure-only; keep Prisma, `PrismaPg`, and `pg` out of application/domain sources.
- Start each behavior task with a failing focused test, observe the expected failure, add the minimum implementation, rerun it, review, and commit.
- Use one process-wide `pg.Pool` + `PrismaPg` + `PrismaClient` tuple with `max: 5`, `idleTimeoutMillis: 10_000`, and `connectionTimeoutMillis: 5_000`.
- Construct the adapter with `new PrismaPg(pool, { disposeExternalPool: true })`; stop if the installed 7.8.0 adapter no longer supports that contract.
- Reuse `PrismaTransactionRunner` and `PrismaCreateProductPersistence` without changing their constructors unless compilation proves the approved design impossible; any such conflict is a stop condition.
- Move `@prisma/adapter-pg` and `pg` from development to production dependencies without changing their declared versions; add `server-only` as a production dependency and keep `@types/pg` development-only.
- Keep generated Prisma Client sources ignored and uncommitted.
- A clean `npm ci` must generate Prisma Client without `DATABASE_URL`, `TEST_DATABASE_URL`, a database connection, or a production secret.
- Stop on unrelated package-lock version/resolution/integrity drift, secret-dependent Prisma generation, a client/application/domain import of the production runtime, or any other architecture-boundary violation.

## File Map

**Create:**

- `src/infrastructure/persistence/prisma/production-prisma-config.ts` — pure, secret-safe runtime URL validation.
- `src/infrastructure/persistence/prisma/production-prisma-runtime-core.ts` — generic Pool/adapter/client construction and singleton lifecycle state machine with no environment access.
- `src/infrastructure/persistence/prisma/prisma-create-product-composition.ts` — constructs the existing transaction runner and persistence adapter from an injected Prisma client.
- `src/infrastructure/persistence/prisma/production-prisma-runtime.ts` — `server-only` production wrapper, real constructors, `globalThis` singleton, explicit disconnect, and production persistence composition getter.
- `tests/infrastructure/production-prisma-config.test.ts` — validator RED/GREEN coverage.
- `tests/infrastructure/production-prisma-runtime-core.test.ts` — pool configuration and lifecycle RED/GREEN coverage with fakes.
- `tests/infrastructure/prisma-create-product-composition.test.ts` — constructor reuse without database/service invocation.
- `tests/production-prisma-runtime-boundaries.test.mjs` — dependency, generation, server-only, environment, layer, and client-import guards.

**Modify:**

- `package.json` — production dependency placement, `prisma:generate`, `postinstall`, and focused infrastructure test script.
- `package-lock.json` — matching root dependency classification plus the `server-only` package record; no unrelated package upgrades.
- `tests/create-product-boundaries.test.mjs` — expand the exact allowed generated-client importer list for the new infrastructure-only modules while keeping application/domain exclusion.

**Must remain unchanged:**

- `src/application/**`
- `src/domain/**`
- `src/infrastructure/persistence/prisma/prisma-create-product.ts`
- `src/infrastructure/persistence/prisma/prisma-create-product-errors.ts`
- `tests/helpers/test-database.ts`
- `tests/integration/create-product-prisma.test.ts`
- `prisma.config.ts`
- `prisma/schema.prisma`
- `prisma/migrations/**`
- `.env*`, `ecosystem.config.cjs`, and deployment files

---

### Task 1: Prove Secret-Free Generation and Correct Runtime Dependency Placement

**Files:**

- Create: `tests/production-prisma-runtime-boundaries.test.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**

- Consumes: current Prisma generator in `prisma/schema.prisma`, current `prisma.config.ts`, npm lockfile v3.
- Produces: `npm run prisma:generate`, `npm run test:infrastructure`, install-time Prisma generation, and production-installed `@prisma/adapter-pg`, `pg`, and `server-only`.

- [ ] **Step 1: Record the repository and lockfile baseline**

Run:

```bash
git status --short --branch
git rev-parse HEAD
git diff -- package.json package-lock.json
shasum -a 256 package-lock.json
test ! -e src/generated/prisma
```

Expected: branch is `feat/production-prismapg-runtime`, only the already committed design and implementation-plan documents exist in branch history, the tracked tree is clean, package files have no diff, and the isolated worktree has no generated client yet. If generated output is already present, first run `git check-ignore src/generated/prisma`, then remove only that ignored output with `rm -rf src/generated/prisma`, and rerun the final check.

- [ ] **Step 2: Install current locked dependencies without lifecycle scripts**

Run:

```bash
env -u DATABASE_URL -u TEST_DATABASE_URL DOTENV_CONFIG_PATH=/dev/null npm ci --ignore-scripts
```

Expected: clean install succeeds without a database URL. If npm changes a tracked file, stop and report the unexpected clean-install drift.

- [ ] **Step 3: Prove current Prisma generation is secret-free before adding `postinstall`**

Run:

```bash
env -u DATABASE_URL -u TEST_DATABASE_URL DOTENV_CONFIG_PATH=/dev/null npm exec -- prisma generate
test -f src/generated/prisma/client.ts
git check-ignore src/generated/prisma/client.ts
git status --short
```

Expected: Prisma generates without a database connection or either database variable; the generated client exists, is ignored, and the tracked tree stays clean.

**STOP:** If generation fails because `DATABASE_URL` is absent, do not add `postinstall`, do not change `prisma.config.ts`, and do not introduce a placeholder URL or test/production secret. Report that the approved generation lifecycle needs a revised specification.

- [ ] **Step 4: Write the failing package-boundary test**

Create `tests/production-prisma-runtime-boundaries.test.mjs` with:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const packageJson = JSON.parse(read("package.json"));

test("installs production Prisma runtime dependencies and generates deterministically", () => {
  assert.equal(packageJson.dependencies["@prisma/adapter-pg"], "^7.8.0");
  assert.equal(packageJson.dependencies.pg, "^8.23.0");
  assert.equal(packageJson.dependencies["server-only"], "0.0.1");
  assert.equal(packageJson.devDependencies["@prisma/adapter-pg"], undefined);
  assert.equal(packageJson.devDependencies.pg, undefined);
  assert.equal(packageJson.devDependencies["@types/pg"], "^8.21.0");
  assert.equal(packageJson.scripts["prisma:generate"], "prisma generate");
  assert.equal(packageJson.scripts.postinstall, "npm run prisma:generate");
  assert.equal(
    packageJson.scripts["test:infrastructure"],
    "tsx --test tests/infrastructure/*.test.ts",
  );
});
```

- [ ] **Step 5: Run the test to verify RED**

Run:

```bash
node --test tests/production-prisma-runtime-boundaries.test.mjs
```

Expected: FAIL because `@prisma/adapter-pg` and `pg` are still development dependencies and `server-only`/scripts are absent.

- [ ] **Step 6: Update `package.json` minimally**

First verify the package selected by the approved design:

```bash
npm view server-only version
```

Expected: `0.0.1`. Stop for review if the registry reports a different current package version; do not substitute a similarly named package.

Make these exact changes:

```json
{
  "scripts": {
    "prisma:generate": "prisma generate",
    "postinstall": "npm run prisma:generate",
    "test:infrastructure": "tsx --test tests/infrastructure/*.test.ts"
  },
  "dependencies": {
    "@prisma/adapter-pg": "^7.8.0",
    "pg": "^8.23.0",
    "server-only": "0.0.1"
  }
}
```

Preserve every existing script/dependency entry. Remove only the duplicate `@prisma/adapter-pg` and `pg` entries from `devDependencies`; keep `@types/pg` there.

- [ ] **Step 7: Regenerate only the lockfile metadata**

Run:

```bash
env -u DATABASE_URL -u TEST_DATABASE_URL DOTENV_CONFIG_PATH=/dev/null npm install --package-lock-only --ignore-scripts
git diff -- package.json package-lock.json
```

Expected: the root lockfile package moves `@prisma/adapter-pg` and `pg` to `dependencies`, adds `server-only` 0.0.1, and adjusts only production-reachability metadata such as `dev` flags. Existing package versions, `resolved` URLs, and integrity values remain unchanged.

**STOP:** If any pre-existing package version, resolution, or integrity changes, revert only the uncommitted package changes and report package-lock drift. Do not accept the drift or run an upgrade/audit fix.

- [ ] **Step 8: Run the package-boundary test to verify GREEN**

Run:

```bash
node --test tests/production-prisma-runtime-boundaries.test.mjs
```

Expected: the package-boundary test passes against the updated manifest.

- [ ] **Step 9: Prove clean install invokes generation without secrets**

First confirm the generated directory is ignored, then remove only generated output:

```bash
git check-ignore src/generated/prisma/client.ts
rm -rf src/generated/prisma
env -u DATABASE_URL -u TEST_DATABASE_URL DOTENV_CONFIG_PATH=/dev/null npm ci
test -f src/generated/prisma/client.ts
git check-ignore src/generated/prisma/client.ts
npm ls @prisma/client prisma @prisma/adapter-pg pg server-only
git status --short
```

Expected: `npm ci` runs `postinstall`, generates the client, uses no database variable or database connection, and changes only the intended tracked package/test files. Prisma and Prisma Client resolve to 7.8.0, adapter resolves to 7.8.0, `pg` resolves compatibly from 8.23.0, and `server-only` resolves to 0.0.1.

- [ ] **Step 10: Commit the dependency and generation lifecycle checkpoint**

```bash
git add package.json package-lock.json tests/production-prisma-runtime-boundaries.test.mjs
git diff --cached --check
git commit -m "build: prepare production Prisma runtime dependencies"
```

---

### Task 2: Implement the Pure Production Runtime Configuration Validator

**Files:**

- Create: `src/infrastructure/persistence/prisma/production-prisma-config.ts`
- Create: `tests/infrastructure/production-prisma-config.test.ts`

**Interfaces:**

- Consumes: an explicit `unknown` candidate; no environment or framework state.
- Produces: `validateProductionDatabaseUrl(value: unknown): ProductionDatabaseConfig`, `ProductionDatabaseConfigError`, and stable error codes.

- [ ] **Step 1: Write the failing validator tests**

Create `tests/infrastructure/production-prisma-config.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  ProductionDatabaseConfigError,
  validateProductionDatabaseUrl,
} from "../../src/infrastructure/persistence/prisma/production-prisma-config";

const validUrl = "postgresql://passvero_app:not-a-real-secret@localhost:5432/passvero";

function expectCode(value: unknown, code: string): void {
  assert.throws(
    () => validateProductionDatabaseUrl(value),
    (error: unknown) =>
      error instanceof ProductionDatabaseConfigError && error.code === code,
  );
}

test("accepts only the production runtime role and database over direct PostgreSQL", () => {
  assert.deepEqual(validateProductionDatabaseUrl(validUrl), {
    connectionString: validUrl,
  });
  assert.equal(
    validateProductionDatabaseUrl(
      "postgres://passvero_app:not-a-real-secret@localhost/passvero",
    ).connectionString,
    "postgres://passvero_app:not-a-real-secret@localhost/passvero",
  );
  assert.equal(
    validateProductionDatabaseUrl(
      "postgresql://passvero%5Fapp:not-a-real-secret@localhost/passvero",
    ).connectionString,
    "postgresql://passvero%5Fapp:not-a-real-secret@localhost/passvero",
  );
});

test("rejects missing, padded, malformed, hosted, test, and migrator configurations", () => {
  expectCode(undefined, "MISSING");
  expectCode("", "MISSING");
  expectCode(` ${validUrl}`, "PADDED");
  expectCode(`${validUrl} `, "PADDED");
  expectCode("not a url", "MALFORMED");
  expectCode("https://passvero_app:not-a-real-secret@localhost/passvero", "SCHEME");
  expectCode("prisma+postgres://accelerate.prisma-data.net/?api_key=redacted", "SCHEME");
  expectCode("postgresql://passvero_migrator:not-a-real-secret@localhost/passvero", "ROLE");
  expectCode("postgresql://passvero_test:not-a-real-secret@localhost/passvero", "ROLE");
  expectCode("postgresql://passvero_app:not-a-real-secret@localhost/passvero_test", "DATABASE");
  expectCode("postgresql://passvero_app:not-a-real-secret@localhost/other", "DATABASE");
  expectCode("postgresql://passvero%ZZ:not-a-real-secret@localhost/passvero", "MALFORMED");
});

test("never exposes candidate secrets through validation errors", () => {
  const secret = "phase-prerequisite-secret-value";
  const candidate = `postgresql://passvero_migrator:${secret}@remote.example/passvero_test?token=${secret}`;

  assert.throws(() => validateProductionDatabaseUrl(candidate), (error: unknown) => {
    assert.ok(error instanceof ProductionDatabaseConfigError);
    assert.doesNotMatch(error.message, new RegExp(secret));
    assert.doesNotMatch(error.message, /remote\.example|passvero_test|token=/);
    assert.equal("cause" in error, false);
    return true;
  });
});

test("is pure and cannot fall back to TEST_DATABASE_URL", () => {
  const previous = process.env.TEST_DATABASE_URL;
  process.env.TEST_DATABASE_URL = validUrl;
  try {
    expectCode(undefined, "MISSING");
  } finally {
    if (previous === undefined) delete process.env.TEST_DATABASE_URL;
    else process.env.TEST_DATABASE_URL = previous;
  }
});
```

- [ ] **Step 2: Run the validator tests to verify RED**

Run:

```bash
npx tsx --test tests/infrastructure/production-prisma-config.test.ts
```

Expected: FAIL with module-not-found for `production-prisma-config`.

- [ ] **Step 3: Implement the pure validator**

Create `src/infrastructure/persistence/prisma/production-prisma-config.ts`:

```ts
export type ProductionDatabaseConfigErrorCode =
  | "MISSING"
  | "PADDED"
  | "MALFORMED"
  | "SCHEME"
  | "ROLE"
  | "DATABASE";

const messages: Record<ProductionDatabaseConfigErrorCode, string> = {
  MISSING: "Production database configuration is required.",
  PADDED: "Production database configuration must not contain surrounding whitespace.",
  MALFORMED: "Production database configuration is invalid.",
  SCHEME: "Production database configuration must use direct PostgreSQL.",
  ROLE: "Production database configuration must use the runtime role.",
  DATABASE: "Production database configuration must target the production database.",
};

export class ProductionDatabaseConfigError extends Error {
  constructor(readonly code: ProductionDatabaseConfigErrorCode) {
    super(messages[code]);
    this.name = "ProductionDatabaseConfigError";
  }
}

export interface ProductionDatabaseConfig {
  readonly connectionString: string;
}

export function validateProductionDatabaseUrl(
  value: unknown,
): ProductionDatabaseConfig {
  if (typeof value !== "string" || value.length === 0) {
    throw new ProductionDatabaseConfigError("MISSING");
  }
  if (value !== value.trim()) {
    throw new ProductionDatabaseConfigError("PADDED");
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ProductionDatabaseConfigError("MALFORMED");
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new ProductionDatabaseConfigError("SCHEME");
  }

  let user: string;
  let database: string;
  try {
    user = decodeURIComponent(parsed.username);
    database = decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    throw new ProductionDatabaseConfigError("MALFORMED");
  }

  if (user !== "passvero_app") {
    throw new ProductionDatabaseConfigError("ROLE");
  }
  if (database !== "passvero") {
    throw new ProductionDatabaseConfigError("DATABASE");
  }

  return { connectionString: value };
}
```

Do not add `process.env`, logging, URL-returning error metadata, test imports, or Prisma imports.

- [ ] **Step 4: Run validator and source checks to verify GREEN**

Run:

```bash
npx tsx --test tests/infrastructure/production-prisma-config.test.ts
rg -n "process\.env|TEST_DATABASE_URL|Prisma|@prisma|from ['\"]pg['\"]|server-only" src/infrastructure/persistence/prisma/production-prisma-config.ts
```

Expected: validator tests pass and `rg` returns no matches (exit 1 is expected for the source scan).

- [ ] **Step 5: Commit the pure configuration checkpoint**

```bash
git add src/infrastructure/persistence/prisma/production-prisma-config.ts tests/infrastructure/production-prisma-config.test.ts
git diff --cached --check
git commit -m "feat: validate production Prisma runtime configuration"
```

---

### Task 3: Implement Pool Construction and the Process-Wide Lifecycle Core

**Files:**

- Create: `src/infrastructure/persistence/prisma/production-prisma-runtime-core.ts`
- Create: `tests/infrastructure/production-prisma-runtime-core.test.ts`

**Interfaces:**

- Consumes: a validated connection string and injected `ProductionPrismaRuntimeFactories<Pool, Adapter, Client>`.
- Produces: `createProductionPrismaRuntime(...)`, `createProductionPrismaRuntimeLifecycle(...)`, `PRODUCTION_POOL_POLICY`, and lifecycle methods `getRuntime()`/`disconnect()`.

- [ ] **Step 1: Write failing construction and lifecycle tests**

Create `tests/infrastructure/production-prisma-runtime-core.test.ts` with fakes that record constructor calls and never open a socket:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  createProductionPrismaRuntime,
  createProductionPrismaRuntimeLifecycle,
} from "../../src/infrastructure/persistence/prisma/production-prisma-runtime-core";

interface FakePool { readonly kind: "pool" }
interface FakeAdapter { readonly kind: "adapter" }
interface FakeClient {
  readonly kind: "client";
  disconnectCalls: number;
  $disconnect(): Promise<void>;
}

function createHarness() {
  const pool: FakePool = { kind: "pool" };
  const adapter: FakeAdapter = { kind: "adapter" };
  const client: FakeClient = {
    kind: "client",
    disconnectCalls: 0,
    async $disconnect() { this.disconnectCalls += 1; },
  };
  const calls: unknown[] = [];
  const factories = {
    createPool(config: unknown) { calls.push(["pool", config]); return pool; },
    createAdapter(value: FakePool, options: unknown) {
      calls.push(["adapter", value, options]);
      return adapter;
    },
    createClient(value: FakeAdapter) {
      calls.push(["client", value]);
      return client;
    },
  };
  return { pool, adapter, client, calls, factories };
}

test("constructs exactly one tuple with the approved pool and adapter options", () => {
  const harness = createHarness();
  const runtime = createProductionPrismaRuntime(
    "postgresql://passvero_app:redacted@localhost/passvero",
    harness.factories,
  );

  assert.deepEqual(runtime, {
    pool: harness.pool,
    adapter: harness.adapter,
    client: harness.client,
  });
  assert.deepEqual(harness.calls, [
    ["pool", {
      connectionString: "postgresql://passvero_app:redacted@localhost/passvero",
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    }],
    ["adapter", harness.pool, { disposeExternalPool: true }],
    ["client", harness.adapter],
  ]);
});

test("reuses one runtime and permits a fresh runtime only after disconnect", async () => {
  const first = createHarness();
  const second = createHarness();
  let creations = 0;
  const lifecycle = createProductionPrismaRuntimeLifecycle(() => {
    creations += 1;
    return creations === 1
      ? { pool: first.pool, adapter: first.adapter, client: first.client }
      : { pool: second.pool, adapter: second.adapter, client: second.client };
  });

  assert.equal(lifecycle.getRuntime().client, first.client);
  assert.equal(lifecycle.getRuntime().client, first.client);
  assert.equal(creations, 1);
  await lifecycle.disconnect();
  assert.equal(first.client.disconnectCalls, 1);
  assert.equal(lifecycle.getRuntime().client, second.client);
  assert.equal(creations, 2);
});

test("coalesces concurrent disconnects and blocks access while disconnecting", async () => {
  let release: (() => void) | undefined;
  const client = {
    $disconnect: () => new Promise<void>((resolve) => { release = resolve; }),
  };
  const lifecycle = createProductionPrismaRuntimeLifecycle(() => ({
    pool: {}, adapter: {}, client,
  }));
  lifecycle.getRuntime();

  const first = lifecycle.disconnect();
  const second = lifecycle.disconnect();
  assert.equal(first, second);
  assert.throws(() => lifecycle.getRuntime(), /disconnect is in progress/i);
  assert.ok(release !== undefined);
  release();
  await first;
});

test("does not cache failed initialization or return a runtime after failed disconnect", async () => {
  let attempts = 0;
  const lifecycle = createProductionPrismaRuntimeLifecycle(() => {
    attempts += 1;
    if (attempts === 1) throw new Error("construction failed");
    return {
      pool: {},
      adapter: {},
      client: { $disconnect: async () => { throw new Error("disconnect failed"); } },
    };
  });

  assert.throws(() => lifecycle.getRuntime(), /construction failed/);
  lifecycle.getRuntime();
  assert.equal(attempts, 2);
  await assert.rejects(lifecycle.disconnect(), /disconnect failed/);
  assert.throws(() => lifecycle.getRuntime(), /disconnect previously failed/i);
});
```

- [ ] **Step 2: Run the runtime-core tests to verify RED**

Run:

```bash
npx tsx --test tests/infrastructure/production-prisma-runtime-core.test.ts
```

Expected: FAIL with module-not-found for `production-prisma-runtime-core`.

- [ ] **Step 3: Implement the generic construction and lifecycle core**

Create `src/infrastructure/persistence/prisma/production-prisma-runtime-core.ts`:

```ts
export const PRODUCTION_POOL_POLICY = Object.freeze({
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
});

export interface DisconnectablePrismaClient {
  $disconnect(): Promise<void>;
}

export interface ProductionPrismaRuntimeFactories<Pool, Adapter, Client> {
  createPool(config: {
    readonly connectionString: string;
    readonly max: number;
    readonly idleTimeoutMillis: number;
    readonly connectionTimeoutMillis: number;
  }): Pool;
  createAdapter(pool: Pool, options: { readonly disposeExternalPool: true }): Adapter;
  createClient(adapter: Adapter): Client;
}

export interface ProductionPrismaRuntime<Pool, Adapter, Client> {
  readonly pool: Pool;
  readonly adapter: Adapter;
  readonly client: Client;
}

export function createProductionPrismaRuntime<Pool, Adapter, Client>(
  connectionString: string,
  factories: ProductionPrismaRuntimeFactories<Pool, Adapter, Client>,
): ProductionPrismaRuntime<Pool, Adapter, Client> {
  const pool = factories.createPool({ connectionString, ...PRODUCTION_POOL_POLICY });
  const adapter = factories.createAdapter(pool, { disposeExternalPool: true });
  const client = factories.createClient(adapter);
  return { pool, adapter, client };
}

export interface ProductionPrismaRuntimeLifecycle<Pool, Adapter, Client> {
  getRuntime(): ProductionPrismaRuntime<Pool, Adapter, Client>;
  disconnect(): Promise<void>;
}

export function createProductionPrismaRuntimeLifecycle<
  Pool,
  Adapter,
  Client extends DisconnectablePrismaClient,
>(
  createRuntime: () => ProductionPrismaRuntime<Pool, Adapter, Client>,
): ProductionPrismaRuntimeLifecycle<Pool, Adapter, Client> {
  let runtime: ProductionPrismaRuntime<Pool, Adapter, Client> | undefined;
  let disconnecting: Promise<void> | undefined;
  let disconnectFailed = false;

  return {
    getRuntime() {
      if (disconnecting !== undefined) {
        throw new Error("Production Prisma disconnect is in progress.");
      }
      if (disconnectFailed) {
        throw new Error("Production Prisma disconnect previously failed.");
      }
      runtime ??= createRuntime();
      return runtime;
    },
    disconnect() {
      if (disconnecting !== undefined) return disconnecting;
      if (runtime === undefined) return Promise.resolve();

      const current = runtime;
      disconnecting = current.client.$disconnect()
        .then(() => {
          if (runtime === current) runtime = undefined;
          disconnectFailed = false;
        })
        .catch((error: unknown) => {
          disconnectFailed = true;
          throw error;
        })
        .finally(() => { disconnecting = undefined; });
      return disconnecting;
    },
  };
}
```

This core must not import `server-only`, `process.env`, Prisma, `PrismaPg`, `pg`, or test helpers.

- [ ] **Step 4: Run runtime-core and type checks to verify GREEN**

Run:

```bash
npx tsx --test tests/infrastructure/production-prisma-runtime-core.test.ts
npx tsc --noEmit
```

Expected: runtime-core tests and TypeScript pass.

- [ ] **Step 5: Review lifecycle invariants**

Confirm from tests and source:

- construction is synchronous and cached only after all three constructors return;
- two `getRuntime()` calls cannot create two tuples;
- two concurrent `disconnect()` calls share one promise;
- `getRuntime()` cannot return a disconnecting or failed-disconnect client;
- only Prisma `$disconnect()` is called; the code never directly calls `pool.end()` and therefore does not double-dispose the external pool.

- [ ] **Step 6: Commit the runtime core checkpoint**

```bash
git add src/infrastructure/persistence/prisma/production-prisma-runtime-core.ts tests/infrastructure/production-prisma-runtime-core.test.ts
git diff --cached --check
git commit -m "feat: add production Prisma runtime lifecycle"
```

---

### Task 4: Compose Existing Persistence Dependencies Without Invocation

**Files:**

- Create: `src/infrastructure/persistence/prisma/prisma-create-product-composition.ts`
- Create: `tests/infrastructure/prisma-create-product-composition.test.ts`

**Interfaces:**

- Consumes: an injected generated `PrismaClient`.
- Produces: `createPrismaCreateProductDependencies(prisma)` returning existing `PrismaTransactionRunner` and `PrismaCreateProductPersistence` instances.

- [ ] **Step 1: Write the failing composition test**

Create `tests/infrastructure/prisma-create-product-composition.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import type { PrismaClient } from "../../src/generated/prisma/client";
import {
  PrismaCreateProductPersistence,
  PrismaTransactionRunner,
} from "../../src/infrastructure/persistence/prisma/prisma-create-product";
import { createPrismaCreateProductDependencies } from "../../src/infrastructure/persistence/prisma/prisma-create-product-composition";

test("reuses existing persistence constructors without invoking Prisma", () => {
  let transactionCalls = 0;
  const prisma = {
    $transaction: () => {
      transactionCalls += 1;
      throw new Error("must not execute during composition");
    },
  } as unknown as PrismaClient;

  const dependencies = createPrismaCreateProductDependencies(prisma);

  assert.ok(dependencies.transactionRunner instanceof PrismaTransactionRunner);
  assert.ok(dependencies.persistence instanceof PrismaCreateProductPersistence);
  assert.equal(transactionCalls, 0);
});
```

- [ ] **Step 2: Run the composition test to verify RED**

Run:

```bash
npx tsx --test tests/infrastructure/prisma-create-product-composition.test.ts
```

Expected: FAIL with module-not-found for `prisma-create-product-composition`.

- [ ] **Step 3: Implement minimal constructor composition**

Create `src/infrastructure/persistence/prisma/prisma-create-product-composition.ts`:

```ts
import type { PrismaClient } from "@/src/generated/prisma/client";
import {
  PrismaCreateProductPersistence,
  PrismaTransactionRunner,
} from "@/src/infrastructure/persistence/prisma/prisma-create-product";

export function createPrismaCreateProductDependencies(prisma: PrismaClient) {
  return {
    transactionRunner: new PrismaTransactionRunner(prisma),
    persistence: new PrismaCreateProductPersistence(),
  };
}
```

Do not modify either existing constructor and do not import or instantiate the application service.

- [ ] **Step 4: Run composition and application tests to verify GREEN**

Run:

```bash
npx tsx --test tests/infrastructure/prisma-create-product-composition.test.ts
npm run test:application
```

Expected: composition test and the full application suite pass with zero database connection.

- [ ] **Step 5: Commit the composition checkpoint**

```bash
git add src/infrastructure/persistence/prisma/prisma-create-product-composition.ts tests/infrastructure/prisma-create-product-composition.test.ts
git diff --cached --check
git commit -m "feat: compose Prisma CreateProduct dependencies"
```

---

### Task 5: Add the Explicit Server-Only Production Wrapper and Boundary Guards

**Files:**

- Create: `src/infrastructure/persistence/prisma/production-prisma-runtime.ts`
- Modify: `tests/production-prisma-runtime-boundaries.test.mjs`
- Modify: `tests/create-product-boundaries.test.mjs`

**Interfaces:**

- Consumes: `process.env.DATABASE_URL`, `validateProductionDatabaseUrl`, generic runtime/lifecycle core, real `Pool`/`PrismaPg`/`PrismaClient`, and pure persistence composition.
- Produces: `getProductionPrismaClient()`, `getProductionCreateProductDependencies()`, and `disconnectProductionPrisma()`; no caller is added in this prerequisite.

- [ ] **Step 1: Extend boundary tests before creating the wrapper**

Change the existing Node filesystem import to:

```js
import { readdirSync, readFileSync } from "node:fs";
```

Then append repository source discovery and these tests to `tests/production-prisma-runtime-boundaries.test.mjs`:

```js
const listTypeScriptFiles = (directory) => readdirSync(
  new URL(`../${directory}`, import.meta.url),
  { recursive: true },
).filter((path) => /\.(ts|tsx)$/.test(path)).map((path) => `${directory}/${path}`);

const runtimePath =
  "src/infrastructure/persistence/prisma/production-prisma-runtime.ts";
const configPath =
  "src/infrastructure/persistence/prisma/production-prisma-config.ts";
const corePath =
  "src/infrastructure/persistence/prisma/production-prisma-runtime-core.ts";

function assertClientSourceDoesNotImportRuntime(source, label) {
  if (/^\s*["']use client["'];/m.test(source)) {
    assert.doesNotMatch(
      source,
      /production-prisma-runtime|production-prisma-config|production-prisma-runtime-core|prisma-create-product-composition/,
      `${label} imports the production database boundary from a client module`,
    );
  }
}

test("marks the production wrapper server-only and isolates environment access", () => {
  const runtimeSource = read(runtimePath);
  const configSource = read(configPath);
  const coreSource = read(corePath);

  assert.match(runtimeSource, /^import "server-only";/);
  assert.match(runtimeSource, /process\.env\.DATABASE_URL/);
  assert.doesNotMatch(runtimeSource, /TEST_DATABASE_URL/);
  assert.doesNotMatch(`${configSource}\n${coreSource}`, /process\.env|TEST_DATABASE_URL|server-only/);
  assert.match(runtimeSource, /new PrismaPg\(pool, \{ disposeExternalPool: true \}\)/);
});

test("guards client modules against production database imports", () => {
  assert.throws(
    () => assertClientSourceDoesNotImportRuntime(
      '"use client";\nimport "@/src/infrastructure/persistence/prisma/production-prisma-runtime";',
      "synthetic-client.tsx",
    ),
    /imports the production database boundary/,
  );

  for (const path of listTypeScriptFiles("src")) {
    assertClientSourceDoesNotImportRuntime(read(path), path);
  }
});

test("keeps production database infrastructure out of application and domain layers", () => {
  const protectedSource = [
    ...listTypeScriptFiles("src/application"),
    ...listTypeScriptFiles("src/domain"),
  ].map(read).join("\n");
  const productionInfrastructure = [
    runtimePath,
    configPath,
    corePath,
    "src/infrastructure/persistence/prisma/prisma-create-product-composition.ts",
  ].map(read).join("\n");

  assert.doesNotMatch(
    protectedSource,
    /@prisma|generated\/prisma|PrismaClient|PrismaPg|from ["']pg["']|production-prisma/,
  );
  assert.doesNotMatch(productionInfrastructure, /tests\/helpers|TEST_DATABASE_URL|withAccelerate|accelerateUrl|\.env\.migrator/);
  assert.doesNotMatch(productionInfrastructure, /CreateProductService|new CreateProduct\b|\.execute\(/);
});
```

Also append `.sort()` to the `generatedClientImporters` filter expression and change its exact expectation in `tests/create-product-boundaries.test.mjs` to:

```js
assert.deepEqual(generatedClientImporters, [
  "src/infrastructure/persistence/prisma/prisma-create-product-composition.ts",
  "src/infrastructure/persistence/prisma/prisma-create-product.ts",
  "src/infrastructure/persistence/prisma/production-prisma-runtime.ts",
]);
```

- [ ] **Step 2: Run boundary tests to verify RED**

Run:

```bash
node --test tests/production-prisma-runtime-boundaries.test.mjs tests/create-product-boundaries.test.mjs
```

Expected: FAIL because the production wrapper does not exist and the expected importer list is not yet satisfied.

- [ ] **Step 3: Implement the `server-only` production wrapper**

Create `src/infrastructure/persistence/prisma/production-prisma-runtime.ts`:

```ts
import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "@/src/generated/prisma/client";
import { createPrismaCreateProductDependencies } from "@/src/infrastructure/persistence/prisma/prisma-create-product-composition";
import { validateProductionDatabaseUrl } from "@/src/infrastructure/persistence/prisma/production-prisma-config";
import {
  createProductionPrismaRuntime,
  createProductionPrismaRuntimeLifecycle,
  type ProductionPrismaRuntimeLifecycle,
} from "@/src/infrastructure/persistence/prisma/production-prisma-runtime-core";

type ProductionLifecycle = ProductionPrismaRuntimeLifecycle<Pool, PrismaPg, PrismaClient>;

const runtimeGlobal = globalThis as typeof globalThis & {
  __passveroProductionPrismaLifecycle?: ProductionLifecycle;
};

function createLifecycle(): ProductionLifecycle {
  const config = validateProductionDatabaseUrl(process.env.DATABASE_URL);
  return createProductionPrismaRuntimeLifecycle(() =>
    createProductionPrismaRuntime(config.connectionString, {
      createPool: (poolConfig) => new Pool(poolConfig),
      createAdapter: (pool, options) => new PrismaPg(pool, options),
      createClient: (adapter) => new PrismaClient({ adapter }),
    }),
  );
}

function getLifecycle(): ProductionLifecycle {
  runtimeGlobal.__passveroProductionPrismaLifecycle ??= createLifecycle();
  return runtimeGlobal.__passveroProductionPrismaLifecycle;
}

export function getProductionPrismaClient(): PrismaClient {
  return getLifecycle().getRuntime().client;
}

export function getProductionCreateProductDependencies() {
  return createPrismaCreateProductDependencies(getProductionPrismaClient());
}

export async function disconnectProductionPrisma(): Promise<void> {
  await runtimeGlobal.__passveroProductionPrismaLifecycle?.disconnect();
}
```

If TypeScript reports that the installed adapter type does not accept the external Pool plus `{ disposeExternalPool: true }`, stop. Do not cast around the incompatibility or silently switch to adapter-owned Pool construction.

- [ ] **Step 4: Run focused tests and compile to verify GREEN**

Run:

```bash
node --test tests/production-prisma-runtime-boundaries.test.mjs tests/create-product-boundaries.test.mjs
npm run test:infrastructure
npx tsc --noEmit
npm run lint
```

Expected: all boundary/infrastructure tests, TypeScript, and lint pass. No test imports the `server-only` production wrapper into the ordinary Node runtime; the source test and Next build own that boundary verification.

- [ ] **Step 5: Inspect runtime construction and forbidden references**

Run:

```bash
rg -n "new (Pool|PrismaPg|PrismaClient)" src tests --glob '!src/generated/**'
rg -n "TEST_DATABASE_URL|DATABASE_URL|prisma\+postgres|withAccelerate|accelerateUrl|directUrl" src tests prisma.config.ts ecosystem.config.cjs
rg -n "production-prisma-runtime" src --glob '*.ts' --glob '*.tsx'
```

Expected:

- real production Pool/adapter/client construction appears only in `production-prisma-runtime.ts`;
- existing test construction remains only in `tests/helpers/test-database.ts`;
- production code reads only `DATABASE_URL` in the server-only wrapper;
- `TEST_DATABASE_URL` remains test-only;
- no application/domain or client module imports the production runtime;
- no production runtime caller, service execution, Accelerate extension, migrator secret path, or fallback appears.

**STOP:** If any application/domain/client boundary is violated, fix the dependency direction before proceeding. Do not weaken the boundary test to allow the import.

- [ ] **Step 6: Commit the server-only boundary checkpoint**

```bash
git add src/infrastructure/persistence/prisma/production-prisma-runtime.ts tests/production-prisma-runtime-boundaries.test.mjs tests/create-product-boundaries.test.mjs
git diff --cached --check
git commit -m "feat: add server-only production Prisma runtime"
```

---

### Task 6: Clean-Install Verification, Full Authorized Suites, and Scope Review

**Files:**

- Verify all task files and repository boundaries.
- Modify only prerequisite files listed in the File Map if an in-scope Critical/Important issue is discovered.

**Interfaces:**

- Consumes: completed prerequisite commits.
- Produces: fresh clean-install/build/test evidence and a reviewed prerequisite branch ready to re-run Phase 9.

- [ ] **Step 1: Verify commit scope and protected paths before final execution**

Run:

```bash
git status --short --branch
git diff --name-status d21f5c38080cf60777473f1812722f7f14701a07...HEAD
git diff --exit-code d21f5c38080cf60777473f1812722f7f14701a07...HEAD -- prisma/schema.prisma prisma/migrations prisma.config.ts ecosystem.config.cjs tests/helpers/test-database.ts tests/integration/create-product-prisma.test.ts src/application src/domain
git -C /Users/darkozivic/Desktop/Programiranje/passvero status --short --branch
```

Expected: only the approved spec, plan, prerequisite source/tests, `package.json`, and `package-lock.json` differ; all protected paths are unchanged; primary `main` remains clean and matches `origin/main`.

- [ ] **Step 2: Re-run the package-lock drift gate**

Run:

```bash
git diff d21f5c38080cf60777473f1812722f7f14701a07...HEAD -- package.json package-lock.json
npm ls @prisma/client prisma @prisma/adapter-pg pg server-only --all
```

Expected: dependency placement matches Task 1, existing versions/resolutions/integrities have not changed unexpectedly, and the tree resolves without invalid/extraneous packages.

**STOP:** Do not proceed to completion if unrelated lockfile drift exists. Revert or isolate the drift; do not normalize it opportunistically.

- [ ] **Step 3: Perform a final secret-free clean install and generation proof**

Run:

```bash
git check-ignore src/generated/prisma/client.ts
rm -rf src/generated/prisma
env -u DATABASE_URL -u TEST_DATABASE_URL DOTENV_CONFIG_PATH=/dev/null npm ci
test -f src/generated/prisma/client.ts
env -u DATABASE_URL -u TEST_DATABASE_URL DOTENV_CONFIG_PATH=/dev/null npm run prisma:generate
git check-ignore src/generated/prisma/client.ts
```

Expected: both `postinstall` and explicit generation succeed without database variables, a secret, or a database connection; generated files remain ignored.

**STOP:** Any database URL/secret requirement invalidates the approved lifecycle. Do not supply a URL to make the commands pass.

- [ ] **Step 4: Run focused and full offline verification**

Run:

```bash
node --test tests/production-prisma-runtime-boundaries.test.mjs tests/create-product-boundaries.test.mjs
npm run test:infrastructure
npm run test:application
npm run test:schema
npx tsc --noEmit
npm run lint
env -u DATABASE_URL -u TEST_DATABASE_URL DOTENV_CONFIG_PATH=/dev/null npm run build
env -u DATABASE_URL -u TEST_DATABASE_URL DOTENV_CONFIG_PATH=/dev/null npx prisma validate
```

Expected: every command passes without a production/test database URL. Build and Prisma validation must not connect to PostgreSQL.

- [ ] **Step 5: Run integration tests only through the existing guarded test path**

Use only the existing ignored `.env.test.local` mechanism documented by the runtime audit. Do not inspect or print its contents. Run:

```bash
if test -f .env.test.local; then
  set -a
  source .env.test.local
  set +a
  env -u DATABASE_URL npm run test:integration
else
  echo "Integration verification unavailable: .env.test.local is absent."
fi
```

Expected: integration tests connect only as the guarded test configuration to `passvero_test` and pass. If no safe existing test configuration is available, do not set or synthesize one and do not use `DATABASE_URL`; record integration verification as unavailable rather than failed.

- [ ] **Step 6: Run security and architecture source reviews**

Run:

```bash
rg -n "TEST_DATABASE_URL|DATABASE_URL|passvero_migrator|prisma\+postgres|withAccelerate|accelerateUrl|\.env\.migrator|/etc/passvero" src package.json tests/production-prisma-runtime-boundaries.test.mjs tests/create-product-boundaries.test.mjs
rg -n "@prisma|generated/prisma|PrismaClient|PrismaPg|from ['\"]pg['\"]|production-prisma" src/application src/domain
git grep -nE "(postgres(ql)?|prisma\+postgres)://[^[:space:]'\"]+:[^[:space:]'\"]+@" -- ':!package-lock.json' ':!docs/superpowers/specs/2026-08-14-production-prismapg-runtime-design.md' ':!docs/superpowers/plans/2026-08-14-production-prismapg-runtime-prerequisite.md'
```

Expected:

- only the production wrapper reads `DATABASE_URL` under `src`;
- `TEST_DATABASE_URL` remains absent from production source;
- no application/domain match appears for database infrastructure;
- no real credential-shaped URL appears in the diff/repository scan;
- synthetic redacted/test URLs occur only in tests and are unmistakably non-secret.

- [ ] **Step 7: Review pool lifecycle and cumulative CreateProduct regression**

Inspect the final diff and confirm:

- exactly one real Pool, adapter, and client can exist per process-global lifecycle;
- Pool options equal `5`, `10_000`, and `5_000` exactly;
- adapter external-pool disposal is enabled and no direct `pool.end()` duplicates it;
- initialization failures are not cached;
- disconnecting/failed-disconnect clients are not returned;
- `PrismaTransactionRunner` and `PrismaCreateProductPersistence` constructors are unchanged;
- no `CreateProduct` service, API/UI entry point, or production write is introduced;
- application/domain dependency directions and all Phase 1-8 database boundaries remain untouched.

- [ ] **Step 8: Fix only in-scope review findings and rerun affected verification**

For each Critical/Important finding confined to files in the File Map:

```bash
git add package.json package-lock.json \
  src/infrastructure/persistence/prisma/production-prisma-config.ts \
  src/infrastructure/persistence/prisma/production-prisma-runtime-core.ts \
  src/infrastructure/persistence/prisma/prisma-create-product-composition.ts \
  src/infrastructure/persistence/prisma/production-prisma-runtime.ts \
  tests/infrastructure/production-prisma-config.test.ts \
  tests/infrastructure/production-prisma-runtime-core.test.ts \
  tests/infrastructure/prisma-create-product-composition.test.ts \
  tests/production-prisma-runtime-boundaries.test.mjs \
  tests/create-product-boundaries.test.mjs
git diff --cached --check
git commit -m "fix: address production Prisma runtime review"
```

Before committing, use `git diff --cached --name-only` and unstage any listed file that was not changed for the finding. Then rerun the affected focused tests plus Steps 3-7. If a finding requires a protected file or excluded operational action, stop and report it instead of widening scope.

- [ ] **Step 9: Verify the final worktree and commit history**

Run:

```bash
git status --short --branch
git log --oneline --decorate d21f5c38080cf60777473f1812722f7f14701a07..HEAD
git diff --check d21f5c38080cf60777473f1812722f7f14701a07...HEAD
git ls-files src/generated/prisma
git -C /Users/darkozivic/Desktop/Programiranje/passvero status --short --branch
```

Expected: feature worktree is clean, commits are prerequisite-scoped, cumulative diff has no whitespace errors, generated client has no tracked files, and primary `main` is clean.

## Final Stop/Completion Gate

Declare `PREREQUISITE COMPLETE — READY TO RE-RUN PHASE 9` only if all required offline checks pass, package-lock drift is fully explained and limited to dependency classification/server-only reachability, generation is secret-free during clean `npm ci`, no architecture boundary is weakened, and any unavailable integration suite is transparently reported.

Declare `PREREQUISITE INCOMPLETE — PHASE 9 STILL BLOCKED` if any required check fails or a stop condition is reached. Do not execute Phase 9, connect to production PostgreSQL, provision secrets, deploy, alter PM2, invoke production CreateProduct, change schema/migrations, or retire Accelerate credentials as part of resolving this prerequisite.
