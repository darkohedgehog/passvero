# Production PrismaPg Runtime Prerequisite Design

**Status:** Approved for implementation planning

**Date:** 2026-08-14

**Scope:** Prerequisite implementation only; this is not Phase 9 execution

## Purpose

Define the production-only infrastructure boundary that will allow Passvero to construct and reuse a direct PostgreSQL Prisma runtime as `passvero_app` against the `passvero` database.

This prerequisite stops at reusable configuration, client lifecycle, and dependency composition. It does not connect an application entry point, invoke a service, change a deployed environment, or perform a production database operation.

## Authorized Scope

The implementation may:

- validate production runtime database configuration in a pure, infrastructure-only module;
- construct one process-wide `pg.Pool`, `PrismaPg`, and `PrismaClient` through a server-only production wrapper;
- expose infrastructure composition that reuses the existing `PrismaTransactionRunner` and `PrismaCreateProductPersistence` constructors;
- provide explicit shutdown/disconnect behavior;
- add focused unit and source-boundary tests;
- move `@prisma/adapter-pg` and `pg` to production dependencies without changing their versions;
- add `server-only` as a production dependency;
- establish deterministic Prisma Client generation that needs neither a database connection nor a production secret;
- update `package-lock.json` as required by those dependency and script changes.

## Explicit Non-Goals

This prerequisite must not:

- execute Phase 9 or any later phase;
- add an API route, Server Action, UI, background worker, CLI entry point, or other runtime invocation;
- execute `CreateProduct` or perform any production business write;
- provision, replace, print, or validate a real production secret;
- change `DATABASE_URL`, `TEST_DATABASE_URL`, environment files, PM2 configuration, or deployment configuration;
- deploy, restart or reload PM2, touch the VPS checkout, or retire Prisma Accelerate credentials;
- run a migration, create migration 17, or modify `prisma/schema.prisma` or migration sources;
- change PostgreSQL roles, grants, ownership, schema objects, or test database state;
- import Prisma, `pg`, or the production runtime factory into application or domain layers;
- modify the test-only database helper to share production behavior.

## Architecture

The dependency direction remains:

```text
application service
       ^
       | injected ports
       |
infrastructure composition
       |
       +-- PrismaTransactionRunner
       +-- PrismaCreateProductPersistence
       |
server-only production Prisma runtime
       |
       +-- one PrismaClient
       +-- one PrismaPg adapter
       +-- one pg Pool
       |
direct localhost PostgreSQL as passvero_app -> passvero
```

Migration execution remains a separate operator/deployment path using `passvero_migrator`. Integration tests remain a separate test-only path using `TEST_DATABASE_URL` and `passvero_test`.

### Module boundaries

The implementation will use three infrastructure concerns:

1. **Pure runtime configuration validator**
   - Accepts an explicit candidate value as input.
   - Does not access `process.env`.
   - Does not import `server-only`, Prisma, `pg`, application code, or test helpers.
   - Returns a validated direct PostgreSQL URL or throws a stable, secret-free configuration error.

2. **Runtime construction/lifecycle core**
   - Accepts validated configuration and injectable Pool, adapter, and client constructors.
   - Applies the exact pool policy.
   - Owns singleton reuse and explicit disconnect semantics.
   - Remains infrastructure-only and is independently unit-testable without opening a database connection.

3. **Production server-only wrapper and composition**
   - Begins with `import "server-only";`.
   - Is the only production module that reads `process.env.DATABASE_URL`.
   - Delegates all interpretation to the pure validator.
   - Instantiates and reuses the process-wide runtime.
   - Builds the existing persistence adapter and transaction runner without changing their constructors if the current signatures remain compatible.

The exact filenames may follow existing infrastructure naming conventions, but these responsibilities must not be merged in a way that makes validation impure or makes the pure test seam import the `server-only` marker.

## Production Runtime Configuration Contract

Production runtime code reads only `DATABASE_URL`. It must never read, reference, or fall back to `TEST_DATABASE_URL`.

The validator accepts a value only when all of the following are true:

- it is a non-empty string;
- it has no leading or trailing whitespace;
- it is a syntactically valid URL;
- its scheme is exactly `postgres:` or `postgresql:`;
- its decoded username is exactly `passvero_app`;
- its pathname identifies exactly the database `passvero`;
- it is not a Prisma Accelerate URL;
- it does not identify `passvero_migrator`, `passvero_test`, or another role/database.

Missing credentials may be rejected without exposing which secret component was absent. Validation must not log, interpolate, return, or attach the raw URL, password, hostname, query string, or parsed URL to an error. Errors use stable categories/messages suitable for assertions and operator diagnosis, such as missing configuration, malformed configuration, unsupported scheme, wrong database, or wrong runtime role.

The validator establishes identity intent from configuration. It does not replace later authenticated identity verification against PostgreSQL, which remains outside this prerequisite.

## Pool, Adapter, and Client Construction

The production runtime creates an explicit `pg.Pool` with:

```ts
{
  connectionString: validatedDatabaseUrl,
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
}
```

The pool is passed to the installed Prisma PostgreSQL adapter. Repository inspection confirmed that the installed `@prisma/adapter-pg` 7.8.0 type surface supports an external `pg.Pool` and the `disposeExternalPool` option. The implementation therefore uses:

```ts
new PrismaPg(pool, { disposeExternalPool: true })
```

The resulting adapter is passed to one `PrismaClient`. The implementation must not create a hidden second pool or construct a client at request/service call sites.

## Singleton and Lifecycle

One logical Pool/adapter/client tuple is reused per Node.js or PM2 process. The production wrapper stores that tuple in a typed `globalThis` slot so development hot reload does not create additional pools. Production behavior is still process-local; it does not attempt cross-process sharing.

The public infrastructure API provides:

- a getter that returns the same initialized Prisma client/runtime on repeated calls;
- production dependency composition that reuses the same runtime;
- an explicit asynchronous disconnect operation for controlled shutdown.

Disconnect delegates to Prisma's disconnect lifecycle. Because the adapter owns disposal of the supplied external pool through `disposeExternalPool: true`, application code must not also call `pool.end()` during the same lifecycle and risk double disposal. After successful disconnect, the singleton reference is cleared so a later explicit initialization can create a fresh tuple. Concurrent initialization/disconnection must not create multiple active tuples or return a partially disposed client.

Tests may use a test-only reset seam in the lifecycle core. Production source must not import test helpers, and test reset behavior must not read environment variables or open connections.

## Dependency Composition

The composition layer will instantiate the existing:

- `PrismaTransactionRunner`; and
- `PrismaCreateProductPersistence`.

Their constructors and persistence behavior remain unchanged if compatible with the singleton Prisma client. The result is reusable infrastructure dependency composition only. No application service is called and no transport/runtime entry point consumes the composition in this prerequisite.

Application and domain modules remain Prisma-independent. Prisma-generated types, `PrismaClient`, `PrismaPg`, and `pg` must remain confined to infrastructure and test-only integration support.

## Dependency Classification

`package.json` and `package-lock.json` will be updated so runtime-required packages are production dependencies:

- `@prisma/adapter-pg` retains its existing `^7.8.0` declaration;
- `pg` retains its existing `^8.23.0` declaration;
- `server-only` is added as a production dependency at the current compatible published version selected by npm;
- `@types/pg` remains a development dependency because it is compile-time only.

No Prisma, Prisma Client, `pg`, Next.js, or other existing package version is upgraded as part of this work.

## Prisma Client Generation Lifecycle

Generated Prisma Client sources remain ignored and uncommitted, matching the current repository policy.

The intended deterministic lifecycle is:

- add an explicit `prisma:generate` script that runs `prisma generate`;
- add `postinstall` invoking that script so a clean `npm ci` produces the ignored client required by typecheck and build;
- keep generation independent of a reachable database and production credentials.

Before adding `postinstall`, implementation must prove from a clean environment that Prisma generation succeeds with `DATABASE_URL` absent and without loading a repository or operator production secret. It must not start a database connection.

If the current `prisma.config.ts` causes `prisma generate` to require `DATABASE_URL`, implementation stops at that finding and redesigns the generation lifecycle in a revised specification. It must not add a placeholder production URL, install-time secret, `TEST_DATABASE_URL` fallback, schema/config workaround, or silently make `npm ci` environment-dependent.

## Server and Source Boundaries

The `server-only` package marker is the primary bundler/runtime boundary for the production wrapper. Architecture tests remain a second line of defense and must verify source-level rules, including:

- the production wrapper imports exactly the `server-only` marker;
- client-side code cannot import the production wrapper under the repository's Next.js boundary/build checks;
- application and domain sources do not import Prisma, generated Prisma code, `PrismaPg`, or `pg`;
- production runtime sources do not import test helpers;
- production runtime sources do not reference `TEST_DATABASE_URL`;
- no Accelerate extension, `prisma+postgres:` fallback, migrator URL, or migrator environment file is introduced;
- existing allowed infrastructure Prisma imports are extended only for the new production infrastructure modules.

Unit tests should import pure modules rather than the production wrapper when ordinary Node test execution cannot satisfy the framework's `server-only` package semantics. The wrapper itself remains covered by source-boundary assertions, TypeScript, lint, and the Next.js production build.

## Test-Driven Implementation

Implementation follows RED then GREEN with focused commits or recorded command evidence.

### Configuration tests

Tests cover:

- missing and empty input;
- leading or trailing whitespace;
- malformed URLs;
- non-PostgreSQL schemes;
- Prisma Accelerate URLs;
- wrong database, including `passvero_test`;
- wrong user, including `passvero_migrator` and `passvero_test`;
- accepted `postgres:` and `postgresql:` URLs for `passvero_app`/`passvero`;
- percent-encoded user/database handling;
- secret-free errors that do not contain the candidate URL or its sensitive components;
- proof that the validator accepts explicit input and cannot fall back to `TEST_DATABASE_URL`.

### Factory/lifecycle tests

Using injected fakes without network access, tests cover:

- exact Pool configuration: maximum 5, idle timeout 10 seconds, connection timeout 5 seconds;
- the existing external pool is passed to `PrismaPg`;
- `disposeExternalPool: true` is passed to the adapter;
- the adapter is passed to `PrismaClient`;
- repeated access returns one process-wide tuple/client;
- repeated dependency composition reuses that client;
- disconnect is explicit and leaves no active singleton;
- lifecycle behavior does not double-dispose the pool;
- initialization failures do not cache a partial runtime.

### Composition and architecture tests

Tests cover:

- reuse of existing `PrismaTransactionRunner` and `PrismaCreateProductPersistence` constructors;
- no service invocation or persistence operation occurs during composition;
- the production wrapper contains `import "server-only";`;
- the production path reads `DATABASE_URL` only;
- `TEST_DATABASE_URL` remains confined to test-only helpers/tests;
- Prisma remains outside application/domain layers;
- client-side import attempts are rejected by the server boundary or caught by the boundary suite.

## Verification

Implementation completion requires fresh successful evidence for:

```text
npm ci
npm ls @prisma/client prisma @prisma/adapter-pg pg server-only
npm run prisma:generate
npx prisma validate
<focused Phase 9 prerequisite tests>
npm run test:application
npm run test:schema
npm run test:integration   # only with the existing safe TEST_DATABASE_URL path
npx tsc --noEmit
npm run lint
npm run build
```

The clean `npm ci` proof must run without `DATABASE_URL`, `TEST_DATABASE_URL`, a database connection, or a production secret. Integration tests may run only against the guarded `passvero_test` configuration. If that safe test configuration is unavailable, the result is reported as unavailable; production is never substituted.

Verification also includes:

- a source scan for `DATABASE_URL`, `TEST_DATABASE_URL`, Prisma/adapter construction, Accelerate references, and server/client boundaries;
- dependency-tree and lockfile inspection confirming runtime packages are production dependencies and versions were not broadened unexpectedly;
- a secret scan of the diff;
- confirmation generated client files remain ignored and uncommitted;
- confirmation no schema or migration source changed;
- confirmation the main checkout was not edited.

## Review Gates

Before completion, perform:

1. scoped code review for correctness and minimality;
2. security review of URL validation, error redaction, and secret boundaries;
3. pool lifecycle review for singleton reuse and disposal;
4. dependency-boundary review confirming application/domain isolation;
5. cumulative regression review against the existing CreateProduct implementation and PostgreSQL Phases 1-8.

Critical or Important findings within this prerequisite scope must be fixed and reverified. Findings requiring deployment, production credentials, database mutation, schema change, or Phase 9 execution remain explicit blockers and are not repaired by widening scope.

## Stop Conditions

Stop without broadening the design if:

- Prisma generation requires a database URL or secret during `npm ci`;
- the installed adapter behavior contradicts the inspected `disposeExternalPool` contract;
- safe singleton/disconnect behavior would require changing application/domain layers;
- the production path would need `TEST_DATABASE_URL`, migrator credentials, or Accelerate;
- a test attempts to connect to production;
- implementation would require schema/migration, environment, deployment, PM2, or production database changes.

## Completion Criteria

The prerequisite is complete only when:

- the pure validator enforces the exact runtime identity contract without secret disclosure;
- the server-only production wrapper reads only `DATABASE_URL`;
- one process-wide Pool/adapter/client is reused with the exact pool limits;
- explicit disconnect behavior is verified;
- existing CreateProduct infrastructure constructors are reused without invoking the service;
- runtime dependencies and lockfile are correct;
- clean secret-free `npm ci` deterministically generates the ignored Prisma Client;
- focused, boundary, authorized full test, typecheck, lint, build, generation, and validation checks pass or any unavailable safe integration test is transparently reported;
- review finds no unresolved Critical or Important issue within scope;
- no Phase 9, deployment, production database, secret, schema, migration, PM2, UI/API, or test-database mutation occurred.

The implementation verdict is then:

`PREREQUISITE COMPLETE — READY TO RE-RUN PHASE 9`

Otherwise:

`PREREQUISITE INCOMPLETE — PHASE 9 STILL BLOCKED`
