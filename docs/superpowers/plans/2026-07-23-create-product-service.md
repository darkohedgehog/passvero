# CreateProduct Application Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the first production-grade Passvero application service,
which atomically creates a Product, its initial DRAFT ProductVersion, one
source-locale ProductTranslation, the current draft pointer, and a PRODUCT_CREATED
AuditLog entry.

**Architecture:** The use case is implemented as a transport-independent
application service. It accepts a validated command and trusted authenticated
context, authorizes PRODUCT_CREATE, owns the Prisma business transaction, uses
narrow persistence operations, maps Prisma failures to safe application errors,
and returns an explicit minimal result DTO.

**Tech Stack:** TypeScript, Next.js 16, Prisma ORM 7.8.0, PostgreSQL, Node.js
built-in test runner, existing repository validation and testing conventions.

## Global Constraints

- Database Architecture Freeze v1.0 must not be changed.
- No Prisma schema or migration change.
- Use strict TypeScript; never introduce `any`.
- No generic CRUD repository.
- No HTTP, route-handler, Server Action, React, cookie, or session dependency in
  the application service.
- Organization and actor identity come only from trusted context.
- Required permission is exactly `PRODUCT_CREATE`.
- Product starts with exact status `ACTIVE`.
- ProductVersion starts `DRAFT` with `versionNumber = null`.
- One source-locale ProductTranslation is created.
- `initialProductName` is trimmed, required, case-preserving, and 1–200 Unicode
  code points after trimming.
- `organizationSku` is optional, trimmed, case-preserving, blank-to-null, and
  1–128 Unicode code points when non-null.
- Product `publicCode` is generated from 16 cryptographically secure random
  bytes as exactly 22 unpadded RFC 4648 base64url characters.
- `publicCode` is server-generated, opaque, immutable, and globally unique.
- Exactly three total public-code candidates are allowed per service call.
- A confirmed `Product_publicCode_key` conflict retries the complete business
  transaction with a fresh candidate.
- Organization-SKU conflicts, unknown uniqueness errors, and unknown database
  failures never trigger public-code retry.
- MVP CreateProduct has no command idempotency key.
- Product, ProductVersion, ProductTranslation, guarded current-draft assignment,
  and AuditLog insertion are atomic.
- No Passport, QRCode, Document, ProductImage, Notification,
  IntegrationMapping, BackgroundJob, Subscription, or billing row is created.
- No external network, storage, provider, queue, or notification operation runs
  inside the transaction.
- Prisma records and raw Prisma/SQL errors never cross the application boundary.
- PostgreSQL integration tests use only `TEST_DATABASE_URL`; no fallback to
  `DATABASE_URL` is permitted.
- All applicable `SERVICE_INVARIANTS.md` tests are release gates.

---

## Repository Findings

- The repository has no existing application, domain, server persistence,
  transaction, authorization, error, or test-database modules to reuse.
- Source imports use the `@/*` alias; new modules follow that convention.
- Prisma Client is generated at `src/generated/prisma/client.ts`; application
  code must not import generated model types.
- The configured development URL uses Prisma Postgres/Accelerate, while guarded
  integration tests require a separate direct `postgresql:` or `postgres:`
  `TEST_DATABASE_URL`.
- Existing tests use `node:test` in `.mjs` files. Add `tsx` as a development-only
  loader so TypeScript tests still run on Node's built-in test runner.
- Prisma 7.8.0 direct PostgreSQL integration tests require
  `@prisma/adapter-pg`, `pg`, and `@types/pg`; keep them development-only.
- There is no `TEST_DATABASE_URL`, fixture helper, or safe cleanup convention in
  the current checkout. This plan creates guarded test-only infrastructure.
- No clock abstraction is needed for persisted timestamps because Prisma and
  PostgreSQL own them. The service receives only a deterministic monotonic
  millisecond function for duration telemetry.
- The relevant implemented identities are `Product_publicCode_key`,
  `Product_organizationId_normalizedSku_key`, and
  `ux_product_version_one_active_draft`.

## Planned File Map

| Action | Path | Responsibility |
| --- | --- | --- |
| Modify | `package.json` | Add Node-test scripts and development-only TypeScript/PostgreSQL test tooling. |
| Modify | `package-lock.json` | Lock the approved test tooling dependency graph. |
| Create | `src/application/errors/application-error.ts` | Stable safe application error categories and codes. |
| Create | `src/application/context/authenticated-user-context.ts` | Trusted user/Organization/Membership context contract. |
| Create | `src/application/permissions/product-permissions.ts` | Centralized `PRODUCT_CREATE` policy. |
| Create | `src/domain/values/passvero-locale.ts` | Approved six-locale value and type guard without next-intl. |
| Modify | `src/i18n/routing.ts` | Consume the shared locale tuple instead of duplicating locale values. |
| Create | `src/application/products/create-product/contracts.ts` | Exact command, normalized command, and minimal result DTOs. |
| Create | `src/application/products/create-product/normalize-command.ts` | Pure trimming, Unicode code-point length, locale, and SKU validation. |
| Create | `src/application/products/create-product/public-code.ts` | Generator port and defensive 22-character format assertion. |
| Create | `src/infrastructure/crypto/node-product-public-code-generator.ts` | Production cryptographic 16-byte base64url generator. |
| Create | `src/application/products/create-product/ports.ts` | Narrow transaction and persistence contracts plus semantic persistence errors. |
| Create | `src/application/products/create-product/create-product.ts` | Top-level authorization, transaction, collision retry, mapping, and error coordinator. |
| Create | `src/infrastructure/persistence/prisma/prisma-create-product-errors.ts` | Exact Prisma error-to-semantic persistence translation. |
| Create | `src/infrastructure/persistence/prisma/prisma-create-product.ts` | Prisma transaction runner and purpose-specific persistence operations. |
| Create | `tests/application/application-contracts.test.ts` | Context, permission, error, command, and result contract tests. |
| Create | `tests/application/create-product-normalization.test.ts` | Exact locale/name/SKU normalization boundary tests. |
| Create | `tests/application/product-public-code.test.ts` | Generator format, entropy-source, independence, and malformed-output tests. |
| Create | `tests/application/create-product-service.test.ts` | Service orchestration, authorization, safe errors, and three-candidate behavior with ports. |
| Create | `tests/application/prisma-create-product-errors.test.ts` | Exact Prisma metadata-to-semantic-error translation tests. |
| Create | `tests/helpers/test-database.ts` | Fail-closed URL validation, Prisma test client, fixtures, and scoped cleanup. |
| Create | `tests/application/test-database-safety.test.ts` | Pure tests proving unsafe database configurations are rejected. |
| Create | `tests/integration/create-product-prisma.test.ts` | Serial real PostgreSQL success, constraint, collision, rollback, and tenant tests. |
| Create | `tests/create-product-boundaries.test.mjs` | Source-level guard against generic writes, transport coupling, and forbidden aggregate creation. |

## Locked Shared Interfaces

The following signatures are fixed across all tasks:

```ts
export type ApplicationErrorCategory =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_STATE"
  | "LIMIT_EXCEEDED"
  | "RATE_LIMITED"
  | "EXTERNAL_DEPENDENCY"
  | "INTERNAL";

export class ApplicationError extends Error {
  constructor(
    readonly category: ApplicationErrorCategory,
    readonly code: string,
    message: string,
    readonly retryable: boolean,
    readonly correlationId?: string,
  );
}

export type MembershipRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
export type MembershipStatus = "ACTIVE" | "SUSPENDED" | "REMOVED";
export type ProductPermission = "PRODUCT_CREATE";

export interface AuthenticatedUserContext {
  readonly userId: string;
  readonly organizationId: string;
  readonly membershipId: string;
  readonly membershipRole: MembershipRole;
  readonly membershipStatus: MembershipStatus;
  readonly permissions: readonly ProductPermission[];
  readonly correlationId: string;
}

export interface CreateProductCommand {
  readonly initialLocale: string;
  readonly initialProductName: string;
  readonly organizationSku?: string | null;
}

export interface NormalizedCreateProductCommand {
  readonly sourceLocale: PassveroLocale;
  readonly productName: string;
  readonly internalName: string;
  readonly sku: string | null;
  readonly normalizedSku: string | null;
}

export interface CreateProductResult {
  readonly productId: string;
  readonly initialProductVersionId: string;
  readonly publicCode: string;
  readonly productStatus: "ACTIVE";
  readonly draftStatus: "DRAFT";
  readonly organizationSku: string | null;
  readonly createdAt: Date;
}

export interface ProductPublicCodeGenerator {
  generate(): string;
}

export interface TransactionRunner<Transaction> {
  run<Result>(work: (transaction: Transaction) => Promise<Result>): Promise<Result>;
}

export type CreateProductPersistenceErrorKind =
  | "PUBLIC_CODE_CONFLICT"
  | "ORGANIZATION_SKU_CONFLICT"
  | "ACTIVE_DRAFT_CONFLICT"
  | "POINTER_CONFLICT"
  | "NOT_FOUND"
  | "UNKNOWN";

export class CreateProductPersistenceError extends Error {
  constructor(readonly kind: CreateProductPersistenceErrorKind);
}

export interface ProductCreationEligibility {
  readonly organizationStatus: "ACTIVE" | "SUSPENDED" | "DEACTIVATED" | "PENDING_DELETION";
  readonly membershipStatus: MembershipStatus;
  readonly membershipRole: MembershipRole;
}

export interface CreatedProductIdentity {
  readonly productId: string;
  readonly createdAt: Date;
}

export interface CreateProductPersistence<Transaction> {
  readEligibility(
    transaction: Transaction,
    input: { readonly organizationId: string; readonly userId: string; readonly membershipId: string },
  ): Promise<ProductCreationEligibility | null>;
  createProductIdentity(
    transaction: Transaction,
    input: {
      readonly organizationId: string;
      readonly internalName: string;
      readonly sku: string | null;
      readonly normalizedSku: string | null;
      readonly publicCode: string;
      readonly actorId: string;
    },
  ): Promise<CreatedProductIdentity>;
  createInitialProductVersion(
    transaction: Transaction,
    input: {
      readonly productId: string;
      readonly organizationId: string;
      readonly sourceLocale: PassveroLocale;
      readonly actorId: string;
    },
  ): Promise<{ readonly productVersionId: string }>;
  createInitialProductTranslation(
    transaction: Transaction,
    input: {
      readonly productVersionId: string;
      readonly locale: PassveroLocale;
      readonly productName: string;
    },
  ): Promise<{ readonly productTranslationId: string }>;
  assignCurrentDraftVersionIfUnset(
    transaction: Transaction,
    input: {
      readonly productId: string;
      readonly organizationId: string;
      readonly productVersionId: string;
    },
  ): Promise<boolean>;
  insertProductCreatedAuditEvent(
    transaction: Transaction,
    input: {
      readonly organizationId: string;
      readonly actorId: string;
      readonly productId: string;
      readonly initialProductVersionId: string;
      readonly skuSupplied: boolean;
      readonly correlationId: string;
    },
  ): Promise<{ readonly auditLogId: string }>;
}

export interface CreateProductDependencies<Transaction> {
  readonly transactionRunner: TransactionRunner<Transaction>;
  readonly persistence: CreateProductPersistence<Transaction>;
  readonly publicCodeGenerator: ProductPublicCodeGenerator;
  readonly monotonicNow: () => number;
  readonly telemetry: CreateProductTelemetry;
}

export interface CreateProductTelemetry {
  recordSuccess(input: { readonly durationMs: number }): void;
  recordFailure(input: {
    readonly category: ApplicationErrorCategory;
    readonly durationMs: number;
  }): void;
  recordPublicCodeCollision(input: { readonly attempt: 1 | 2 | 3 }): void;
  recordPublicCodeExhaustion(): void;
}

export type CreateProduct = (
  command: CreateProductCommand,
  context: AuthenticatedUserContext | null,
) => Promise<CreateProductResult>;

export function createCreateProductService<Transaction>(
  dependencies: CreateProductDependencies<Transaction>,
): CreateProduct;
```

## Test Database Contract

The test helper exports:

```ts
export interface SafeTestDatabaseConfig {
  readonly url: string;
  readonly databaseName: string;
}

export interface CreateProductFixtureIds {
  readonly userId: string;
  readonly organizationId: string;
  readonly membershipId: string;
  readonly productIds: readonly string[];
}

export function requireSafeTestDatabaseConfig(
  environment: NodeJS.ProcessEnv,
): SafeTestDatabaseConfig;

export function createTestPrismaClient(
  config: SafeTestDatabaseConfig,
): PrismaClient;

export async function cleanupCreateProductFixture(
  prisma: PrismaClient,
  fixture: CreateProductFixtureIds,
): Promise<void>;
```

`requireSafeTestDatabaseConfig` reads only `TEST_DATABASE_URL`. It accepts only
`postgresql:` or `postgres:` URLs, rejects missing credentials/host/database,
rejects byte-for-byte equality with `DATABASE_URL`, and requires the decoded
database pathname to contain `test` case-insensitively. Errors name the failed
rule but never include a URL or credential.

`cleanupCreateProductFixture` requires nonblank fixture IDs and at least one
explicit Product ID when Product cleanup is requested. In a transaction it:

1. deletes AuditLog rows with matching Organization, entity type `PRODUCT`, and
   explicit Product IDs;
2. clears current draft/published pointers only on those Product IDs and the
   explicit Organization;
3. reads ProductVersion IDs only for those Product IDs and Organization;
4. deletes ProductTranslation rows only for those explicit version IDs;
5. deletes ProductVersion rows only for those explicit version IDs and
   Organization;
6. deletes Product rows only for the explicit Product IDs and Organization;
7. deletes the explicit Membership ID scoped to User and Organization;
8. deletes the explicit Organization ID; and
9. deletes the explicit User ID.

It never calls unrestricted `deleteMany`, global `TRUNCATE`, reset, or broad
timestamp/status cleanup. Each integration test creates unique UUIDs and values,
runs serially, and calls cleanup from `afterEach`/`finally`.

One-time preparation is separate from test execution:

```bash
DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
```

This command is allowed only after the operator independently confirms the
dedicated database passes the same safety rules. It deploys committed migrations
only; it does not generate or edit migration history.

## Task 1: Test Tooling and Core Application Contracts

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/application/errors/application-error.ts`
- Create: `src/application/context/authenticated-user-context.ts`
- Create: `src/application/permissions/product-permissions.ts`
- Create: `src/application/products/create-product/contracts.ts`
- Create: `tests/application/application-contracts.test.ts`

**Interfaces:**
- `Consumes:` no application-layer symbols.
- `Produces:` `ApplicationError`, `AuthenticatedUserContext`,
  `PRODUCT_CREATE`, `hasProductPermission`, `roleHasProductPermission`,
  `CreateProductCommand`, and `CreateProductResult` with the locked signatures.

- [ ] **Step 1: Write the failing contract test.**

```ts
test("PRODUCT_CREATE is centralized and excludes VIEWER", () => {
  assert.equal(roleHasProductPermission("EDITOR", PRODUCT_CREATE), true);
  assert.equal(roleHasProductPermission("ADMIN", PRODUCT_CREATE), true);
  assert.equal(roleHasProductPermission("OWNER", PRODUCT_CREATE), true);
  assert.equal(roleHasProductPermission("VIEWER", PRODUCT_CREATE), false);
});

test("ApplicationError exposes only stable safe fields", () => {
  const error = new ApplicationError(
    "FORBIDDEN",
    "CREATE_PRODUCT_FORBIDDEN",
    "Product creation is not permitted.",
    false,
    "corr-test-0001",
  );
  assert.equal(error.category, "FORBIDDEN");
  assert.equal(error.code, "CREATE_PRODUCT_FORBIDDEN");
  assert.equal(error.correlationId, "corr-test-0001");
});
```

- [ ] **Step 2: Run the test before implementation.**

Run: `node --test tests/application/application-contracts.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for the first application contract.

- [ ] **Step 3: Install only the required development test tooling.**

Run: `npm install --save-dev tsx @prisma/adapter-pg@7.8.0 pg @types/pg`

Expected: `package.json` and `package-lock.json` change; Prisma remains 7.8.0.
Add these exact scripts:

```json
"test:schema": "node --test tests/*.test.mjs",
"test:application": "tsx --test tests/application/*.test.ts",
"test:integration": "tsx --test --test-concurrency=1 tests/integration/*.test.ts"
```

Do not add a runtime dependency.

- [ ] **Step 4: Implement the locked contracts and centralized permission policy.**

Use `permissions.includes(PRODUCT_CREATE)` for preliminary context permission
and the exact role matrix `{VIEWER: [], EDITOR: [PRODUCT_CREATE], ADMIN:
[PRODUCT_CREATE], OWNER: [PRODUCT_CREATE]}` for transactional revalidation.
The error class must not carry causes, Prisma metadata, SQL, or arbitrary data.

- [ ] **Step 5: Run focused and broader tests.**

Run:
`npx --no-install tsx --test tests/application/application-contracts.test.ts`

Expected: PASS with 0 failures.

Run: `npm run test:schema`

Expected: all existing `.mjs` tests pass.

- [ ] **Step 6: Commit the contract slice.**

```bash
git add package.json package-lock.json src/application tests/application/application-contracts.test.ts
git commit -m "feat(application): add create product contracts"
```

## Task 2: Locale and Command Normalization

**Files:**
- Create: `src/domain/values/passvero-locale.ts`
- Modify: `src/i18n/routing.ts`
- Create: `src/application/products/create-product/normalize-command.ts`
- Create: `tests/application/create-product-normalization.test.ts`

**Interfaces:**
- `Consumes:` `ApplicationError`, `CreateProductCommand`.
- `Produces:` `PASSVERO_LOCALES`, `PassveroLocale`, `isPassveroLocale`,
  `NormalizedCreateProductCommand`,
  `normalizeCreateProductCommand(command, correlationId)`.

- [ ] **Step 1: Write the exact boundary tests.**

```ts
test("accepts Product-name boundaries and preserves case", () => {
  assert.equal(normalize({initialProductName: " A ", organizationSku: undefined}).productName, "A");
  assert.equal(normalize({initialProductName: "X".repeat(200)}).productName.length, 200);
  assert.equal(normalize({initialProductName: "PassVero"}).productName, "PassVero");
});

test("rejects invalid Product-name lengths", () => {
  for (const value of ["", "   ", "X".repeat(201)]) {
    assert.throws(() => normalize({initialProductName: value}), isValidationError);
  }
});

test("normalizes optional SKU at exact boundaries", () => {
  assert.equal(normalize({organizationSku: undefined}).sku, null);
  assert.equal(normalize({organizationSku: "   "}).sku, null);
  assert.equal(normalize({organizationSku: " A "}).sku, "A");
  assert.equal(normalize({organizationSku: "X".repeat(128)}).sku?.length, 128);
  assert.throws(() => normalize({organizationSku: "X".repeat(129)}), isValidationError);
});
```

Use `Array.from(value).length` for Unicode code-point length. Include explicit
tests for 1/200/201-character names, 1/128/129-character SKUs, trimming,
case preservation, all six locales, and unsupported locale.

- [ ] **Step 2: Run the focused test.**

Run:
`npx --no-install tsx --test tests/application/create-product-normalization.test.ts`

Expected: FAIL because `normalize-command.ts` and the shared locale value do not
exist.

- [ ] **Step 3: Implement pure normalization.**

`normalizeCreateProductCommand` trims first, validates
`initialLocale` against `["hr","sr","en","de","sl","pl"]`, derives
`internalName = productName`, and returns identical case-preserving `sku` and
`normalizedSku`. It throws `ApplicationError("VALIDATION", ...)` with stable
codes `CREATE_PRODUCT_NAME_INVALID`, `CREATE_PRODUCT_LOCALE_INVALID`, or
`CREATE_PRODUCT_SKU_INVALID`.

- [ ] **Step 4: Run focused, type, and existing localization checks.**

Run:
`npx --no-install tsx --test tests/application/create-product-normalization.test.ts`

Expected: PASS.

Run: `npx tsc --noEmit && npm run lint`

Expected: both commands exit 0.

- [ ] **Step 5: Commit normalization.**

```bash
git add src/domain src/i18n/routing.ts src/application/products/create-product tests/application/create-product-normalization.test.ts
git commit -m "feat(products): add create product normalization"
```

## Task 3: Stable Product Public-Code Generator

**Files:**
- Create: `src/application/products/create-product/public-code.ts`
- Create: `src/infrastructure/crypto/node-product-public-code-generator.ts`
- Create: `tests/application/product-public-code.test.ts`

**Interfaces:**
- `Consumes:` `ApplicationError`.
- `Produces:` `ProductPublicCodeGenerator`,
  `assertValidProductPublicCode(value, correlationId): string`, and
  `NodeProductPublicCodeGenerator.generate(): string`.

- [ ] **Step 1: Write generator tests with an injectable 16-byte source.**

```ts
test("encodes 16 bytes as 22 unpadded base64url characters", () => {
  const generator = new NodeProductPublicCodeGenerator(() => Buffer.alloc(16, 255));
  const value = generator.generate();
  assert.equal(value.length, 22);
  assert.match(value, /^[A-Za-z0-9_-]{22}$/);
  assert.doesNotMatch(value, /=/);
});

test("rejects malformed generator output", () => {
  assert.throws(
    () => assertValidProductPublicCode("not valid", "corr-test-0001"),
    (error) => isInternal(error, "CREATE_PRODUCT_PUBLIC_CODE_INVALID"),
  );
});
```

Also test independent outputs with a deterministic byte-source sequence and
prove Product/Organization inputs are absent from the generator signature.

- [ ] **Step 2: Run the focused test.**

Run:
`npx --no-install tsx --test tests/application/product-public-code.test.ts`

Expected: FAIL because the generator modules do not exist.

- [ ] **Step 3: Implement the generator.**

The production default byte source is `randomBytes(16)` from `node:crypto`.
Encode with `buffer.toString("base64url")`; never slice, pad, prefix, hash, or
include domain data. The defensive assertion accepts only
`/^[A-Za-z0-9_-]{22}$/`.

- [ ] **Step 4: Run focused and application tests.**

Run:
`npx --no-install tsx --test tests/application/product-public-code.test.ts`

Expected: PASS.

Run: `npm run test:application`

Expected: all application tests pass.

- [ ] **Step 5: Commit the generator.**

```bash
git add src/application/products/create-product/public-code.ts src/infrastructure/crypto tests/application/product-public-code.test.ts
git commit -m "feat(products): add stable product code generator"
```

## Task 4: Narrow Persistence Contracts and Prisma Error Translation

**Files:**
- Create: `src/application/products/create-product/ports.ts`
- Create: `src/infrastructure/persistence/prisma/prisma-create-product-errors.ts`
- Create: `tests/application/prisma-create-product-errors.test.ts`

**Interfaces:**
- `Consumes:` all locked context, locale, command-result, transaction, and
  persistence signatures.
- `Produces:` `CreateProductPersistenceError`,
  `CreateProductTelemetry`,
  and `translatePrismaCreateProductError(error, operation)`.

- [ ] **Step 1: Write table-driven error-translation tests.**

```ts
test("maps only the exact Product uniqueness identities", () => {
  assert.equal(translate(unique(["publicCode"]), "createProductIdentity").kind, "PUBLIC_CODE_CONFLICT");
  assert.equal(
    translate(unique(["organizationId", "normalizedSku"]), "createProductIdentity").kind,
    "ORGANIZATION_SKU_CONFLICT",
  );
  assert.equal(translate(unique(["currentDraftVersionId"]), "assignCurrentDraft").kind, "POINTER_CONFLICT");
  assert.equal(translate(unique(["other"]), "createProductIdentity").kind, "UNKNOWN");
});
```

Cover Prisma `P2002` metadata expressed as a field array and as the inspected
constraint names `Product_publicCode_key`,
`Product_organizationId_normalizedSku_key`, and
`ux_product_version_one_active_draft`. Cover non-`P2002` and malformed metadata
as `UNKNOWN`; assert translated errors contain no raw message or metadata.

- [ ] **Step 2: Run the focused test.**

Run:
`npx --no-install tsx --test tests/application/prisma-create-product-errors.test.ts`

Expected: FAIL because the ports and Prisma adapter do not exist.

- [ ] **Step 3: Implement the ports and exact Prisma error translator.**

The translator accepts `unknown` plus the exact operation discriminator
`"createProductIdentity" | "createInitialProductVersion" |
"assignCurrentDraft" | "insertAudit"`. Recognize only inspected `P2002`
field targets or constraint identities. Return semantic persistence errors
without retaining the raw error, metadata, message, or stack.

- [ ] **Step 4: Run focused tests, typecheck, and lint.**

Run:
`npx --no-install tsx --test tests/application/prisma-create-product-errors.test.ts`

Expected: PASS.

Run: `npx tsc --noEmit && npm run lint`

Expected: both commands exit 0.

- [ ] **Step 5: Commit persistence infrastructure.**

```bash
git add src/application/products/create-product/ports.ts src/infrastructure/persistence/prisma/prisma-create-product-errors.ts tests/application/prisma-create-product-errors.test.ts
git commit -m "feat(products): add create product persistence contracts"
```

## Task 5: Successful CreateProduct Orchestration

**Files:**
- Create: `src/application/products/create-product/create-product.ts`
- Create: `tests/application/create-product-service.test.ts`

**Interfaces:**
- `Consumes:` `CreateProductDependencies<Transaction>`,
  `normalizeCreateProductCommand`, `assertValidProductPublicCode`,
  `hasProductPermission`, and `roleHasProductPermission`.
- `Produces:` `createCreateProductService<Transaction>(dependencies):
  CreateProduct`.

- [ ] **Step 1: Write the happy-path service test with recording ports.**

```ts
test("creates and returns one complete initial Product aggregate", async () => {
  const result = await service(
    {initialLocale: "hr", initialProductName: " Proizvod ", organizationSku: " SKU-1 "},
    activeEditorContext,
  );
  assert.deepEqual(result, {
    productId: PRODUCT_ID,
    initialProductVersionId: VERSION_ID,
    publicCode: PUBLIC_CODE,
    productStatus: "ACTIVE",
    draftStatus: "DRAFT",
    organizationSku: "SKU-1",
    createdAt: CREATED_AT,
  });
  assert.deepEqual(recordedSteps, [
    "transaction:start", "eligibility", "product", "version", "translation",
    "pointer", "audit", "transaction:commit",
  ]);
});
```

Assert Organization and actor derive only from context, version number and
publication fields are never persistence inputs, translation locale equals
source locale, audit is inside the same transaction token, and success telemetry
contains only deterministic duration.

- [ ] **Step 2: Run the focused test.**

Run:
`npx --no-install tsx --test tests/application/create-product-service.test.ts`

Expected: FAIL because `create-product.ts` does not exist.

- [ ] **Step 3: Implement the successful single-candidate flow.**

Preliminary validation and context permission occur before
`transactionRunner.run`. Inside the transaction, re-read eligibility, require
ACTIVE Organization/Membership and a role granting `PRODUCT_CREATE`, execute
the five writes in order, require guarded pointer result `true`, and map only
the seven result fields.

- [ ] **Step 4: Run focused and application tests.**

Run:
`npx --no-install tsx --test tests/application/create-product-service.test.ts`

Expected: PASS for the successful-flow tests.

Run: `npm run test:application`

Expected: all application tests pass.

- [ ] **Step 5: Commit service happy path.**

```bash
git add src/application/products/create-product/create-product.ts tests/application/create-product-service.test.ts
git commit -m "feat(products): implement create product service"
```

## Task 6: Authorization, Validation, and Safe Application Errors

**Files:**
- Modify: `src/application/products/create-product/create-product.ts`
- Modify: `tests/application/create-product-service.test.ts`

**Interfaces:**
- `Consumes:` locked `ApplicationError` categories and persistence error kinds.
- `Produces:` stable CreateProduct codes:
  `CREATE_PRODUCT_UNAUTHENTICATED`, `CREATE_PRODUCT_FORBIDDEN`,
  `CREATE_PRODUCT_CONTEXT_NOT_FOUND`, `CREATE_PRODUCT_ORGANIZATION_INELIGIBLE`,
  `CREATE_PRODUCT_SKU_CONFLICT`, `CREATE_PRODUCT_POINTER_CONFLICT`,
  `CREATE_PRODUCT_PUBLIC_CODE_EXHAUSTED`, and
  `CREATE_PRODUCT_INTERNAL`.

- [ ] **Step 1: Write failure-order and safe-error tests.**

Cover null context, SUSPENDED/REMOVED context Membership, missing permission,
transactionally missing Membership/Organization, non-ACTIVE Organization,
transactionally ineligible Membership/role, malformed command, pointer false,
SKU conflict, and UNKNOWN persistence error. Assert persistence is untouched
for preliminary failures and no returned error includes Prisma code,
constraint, SQL, candidate code, actor ID, or tenant ID.
Assert failure telemetry contains only category and deterministic duration.

- [ ] **Step 2: Run the focused tests.**

Run:
`npx --no-install tsx --test tests/application/create-product-service.test.ts`

Expected: FAIL on the first unmapped failure category.

- [ ] **Step 3: Implement explicit error mapping.**

Map null context to `UNAUTHENTICATED`; preliminary and revalidated permission
failure to `FORBIDDEN`; missing transactional eligibility to safe `NOT_FOUND`;
ineligible Organization to `INVALID_STATE`; exact SKU conflict to `CONFLICT`;
pointer/active-draft conflict to `INVALID_STATE`; and unknown persistence to
non-retryable `INTERNAL`. Preserve only the correlation ID.

- [ ] **Step 4: Run focused and broader verification.**

Run: `npm run test:application && npx tsc --noEmit && npm run lint`

Expected: all commands exit 0.

- [ ] **Step 5: Commit safe failure behavior.**

```bash
git add src/application/products/create-product/create-product.ts tests/application/create-product-service.test.ts
git commit -m "feat(products): enforce create product authorization"
```

## Task 7: Three-Candidate Public-Code Transaction Orchestration

**Files:**
- Modify: `src/application/products/create-product/create-product.ts`
- Modify: `tests/application/create-product-service.test.ts`

**Interfaces:**
- `Consumes:` `PUBLIC_CODE_CONFLICT`, transaction runner, generator, and
  `CREATE_PRODUCT_PUBLIC_CODE_EXHAUSTED`.
- `Produces:` exactly three outer transaction executions/candidates with no
  nested generic retry loop.

- [ ] **Step 1: Write retry-bound tests.**

Write deterministic cases for collision-then-success, two-collisions-then-
success, third-collision failure, SKU conflict, active-draft conflict, pointer
conflict, and UNKNOWN error. Assert candidate and transaction counts are
respectively 2, 3, 3, 1, 1, 1, and 1. Assert each collision uses a new
transaction token and fresh code. Assert collision telemetry records attempts
without candidate values and exhaustion records exactly once.

- [ ] **Step 2: Run the focused tests.**

Run:
`npx --no-install tsx --test tests/application/create-product-service.test.ts`

Expected: FAIL because only one candidate is attempted.

- [ ] **Step 3: Implement the bounded outer loop.**

Use a fixed loop of three iterations. Generate and validate one code
immediately before each transaction. Continue only for
`PUBLIC_CODE_CONFLICT`; after the third conflict throw safe non-retryable
`INTERNAL/CREATE_PRODUCT_PUBLIC_CODE_EXHAUSTED`. Every other error exits
immediately. Do not add a generic transaction-retry loop.

- [ ] **Step 4: Run focused and complete application tests.**

Run: `npm run test:application -- tests/application/create-product-service.test.ts`

Expected: PASS with exact attempt assertions.

Run: `npm run test:application`

Expected: all application tests pass.

- [ ] **Step 5: Commit bounded collision behavior.**

```bash
git add src/application/products/create-product/create-product.ts tests/application/create-product-service.test.ts
git commit -m "feat(products): bound product code collision retries"
```

## Task 8: Guarded PostgreSQL Test Infrastructure

**Files:**
- Create: `tests/helpers/test-database.ts`
- Create: `tests/application/test-database-safety.test.ts`

**Interfaces:**
- `Consumes:` generated `PrismaClient`, `PrismaPg`, `TEST_DATABASE_URL`, and
  optional `DATABASE_URL` comparison only.
- `Produces:` the exact `SafeTestDatabaseConfig`,
  `CreateProductFixtureIds`, `requireSafeTestDatabaseConfig`,
  `createTestPrismaClient`, and `cleanupCreateProductFixture` signatures.

- [ ] **Step 1: Write fail-closed safety tests.**

```ts
test("never falls back to DATABASE_URL", () => {
  assert.throws(
    () => requireSafeTestDatabaseConfig({DATABASE_URL: "postgresql://u:p@db/passvero_test"}),
    /TEST_DATABASE_URL is required/,
  );
});

test("rejects unsafe database identities without echoing URLs", () => {
  for (const environment of unsafeEnvironments) {
    assert.throws(() => requireSafeTestDatabaseConfig(environment), (error) => {
      assert.doesNotMatch(String(error), /password|postgresql:\/\//);
      return true;
    });
  }
});
```

Cover missing URL, malformed URL, wrong protocol, equality with
`DATABASE_URL`, blank database name, and names without case-insensitive `test`;
accept `passvero_test` and `passvero_integration_test` on non-local hosts.

- [ ] **Step 2: Run the safety tests.**

Run:
`npx --no-install tsx --test tests/application/test-database-safety.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement guarded connection and scoped cleanup.**

Construct `PrismaPg({connectionString: config.url})` only after validation.
Implement the exact reverse-dependency cleanup contract above. Reject blank IDs
before issuing any query. Use explicit `in: fixture.productIds` predicates plus
Organization ID; never use empty filters.

- [ ] **Step 4: Run pure safety tests without a database.**

Run:
`npx --no-install tsx --test tests/application/test-database-safety.test.ts`

Expected: PASS without reading or connecting to `DATABASE_URL`.

Run: `npx tsc --noEmit && npm run lint`

Expected: both commands exit 0.

- [ ] **Step 5: Commit test infrastructure.**

```bash
git add tests/helpers/test-database.ts tests/application/test-database-safety.test.ts
git commit -m "test(products): add guarded test database helpers"
```

## Task 9: Real PostgreSQL CreateProduct Integration Tests

**Files:**
- Create: `src/infrastructure/persistence/prisma/prisma-create-product.ts`
- Create: `tests/integration/create-product-prisma.test.ts`

**Interfaces:**
- `Consumes:` `createTestPrismaClient`, `cleanupCreateProductFixture`,
  `translatePrismaCreateProductError`,
  `NodeProductPublicCodeGenerator`, and `createCreateProductService`.
- `Produces:` release-gate evidence for real PostgreSQL transaction and
  constraint behavior plus `PrismaTransactionRunner` and
  `PrismaCreateProductPersistence`.

- [ ] **Step 1: Write serial integration tests and per-test fixture cleanup.**

Use `randomUUID()` for User, Organization, Membership, correlation, SKU, name,
and deterministic collision identities. Register each successful Product ID.
In `afterEach`, call `cleanupCreateProductFixture` with the explicit fixture
IDs; in suite teardown disconnect Prisma.

Test successful state with direct narrow reads asserting Product `ACTIVE`,
ProductVersion `DRAFT`, null `versionNumber`, equal Organization IDs,
translation locale/name, current draft pointer, null current published pointer,
actor attribution, and atomic `PRODUCT_CREATED` AuditLog. Assert zero Passport,
QRCode, Document, ProductImage, Notification, IntegrationMapping,
BackgroundJob, and Subscription rows for the fixture Organization/Product.

Test rollback by injecting failures after Product insert, version insert,
translation insert, pointer assignment, and AuditLog insertion through a
test-only decorating persistence port that throws after delegating. Assert no
Product aggregate or AuditLog commits.

Test concurrent same-SKU calls with `Promise.allSettled`: one fulfills and one
returns safe `CONFLICT`. Test a preinserted public-code collision with
deterministic codes: first create a complete collision-holder aggregate through
the same service, register its Product ID for cleanup, then verify the target
call's first transaction rolls back and its next candidate creates exactly one
aggregate. Test two collision holders then success and three collision holders
then safe `INTERNAL`.

- [ ] **Step 2: Run the focused test before the Prisma adapter exists.**

Run:
`TEST_DATABASE_URL="$TEST_DATABASE_URL" DATABASE_URL="$DATABASE_URL" npx --no-install tsx --test --test-concurrency=1 tests/integration/create-product-prisma.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for
`src/infrastructure/persistence/prisma/prisma-create-product.ts`.

- [ ] **Step 3: Prepare a dedicated schema-current test database once.**

Run:
`DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy`

Expected: committed migrations apply to the dedicated database and Prisma
reports no pending migration. Never run this command until the database name
has independently passed the `test` marker and URL inequality checks.

- [ ] **Step 4: Implement the exact Prisma transaction and persistence adapter.**

`PrismaTransactionRunner.run` calls one interactive `$transaction` and never
nests transactions. `PrismaCreateProductPersistence` accepts
`Prisma.TransactionClient` per method. Use narrow `select` projections, exact
`ACTIVE`/`DRAFT`/null values, `updateMany` guarded by Product ID,
Organization ID, and null draft pointer, and Audit values:
`PRODUCT_CREATED`, `PRODUCT`, created Product ID, trusted actor and correlation
ID, summary `Product created.`, metadata
`{initialProductVersionId, skuSupplied}`.

Each operation calls `translatePrismaCreateProductError` for its own failure
context and throws `CreateProductPersistenceError`; it never authorizes, opens
an independent transaction, or returns a generated Prisma model.

- [ ] **Step 5: Run the focused integration suite serially.**

Run:
`TEST_DATABASE_URL="$TEST_DATABASE_URL" DATABASE_URL="$DATABASE_URL" npx --no-install tsx --test --test-concurrency=1 tests/integration/create-product-prisma.test.ts`

Expected: PASS with concurrency 1, no fallback, no partial rows, and per-test
cleanup completed.

- [ ] **Step 6: Run unit, schema, and integration suites.**

Run: `npm run test:schema`

Expected: all existing schema/source tests pass.

Run: `npm run test:application`

Expected: all pure and service tests pass.

Run:
`TEST_DATABASE_URL="$TEST_DATABASE_URL" DATABASE_URL="$DATABASE_URL" npm run test:integration`

Expected: all PostgreSQL integration tests pass serially.

- [ ] **Step 7: Commit persistence and integration coverage.**

```bash
git add src/infrastructure/persistence/prisma/prisma-create-product.ts tests/integration/create-product-prisma.test.ts
git commit -m "feat(products): implement create product transactions"
```

## Task 10: Boundary Guards and Final Verification

**Files:**
- Create: `tests/create-product-boundaries.test.mjs`
- Verify: all files in the Planned File Map

**Interfaces:**
- `Consumes:` complete CreateProduct source tree and approved architecture.
- `Produces:` source-level bypass guards and final verification evidence.

- [ ] **Step 1: Write the failing boundary test.**

The test reads the planned source files and asserts:

```js
assert.doesNotMatch(applicationSource, /next\/|next-intl|cookies\(|headers\(|PrismaClient/);
assert.doesNotMatch(persistenceSource, /\b(upsert|deleteMany\\(\\{\\}|update\\([^]*data:\\s*command)/);
assert.doesNotMatch(allCreateProductSource, /\b(passport|qrCode|document|productImage|notification|integrationMapping|backgroundJob|subscription)\\.(create|update|upsert)/i);
assert.match(serviceSource, /PRODUCT_CREATE/);
assert.match(persistenceSource, /PRODUCT_CREATED/);
```

Also assert only the Prisma adapter imports
`src/generated/prisma/client`, application results are explicit, and the
public-code loop bound is the constant `3`.

- [ ] **Step 2: Run the boundary test before completing guards.**

Run: `node --test tests/create-product-boundaries.test.mjs`

Expected: FAIL on the first missing or violated boundary assertion.

- [ ] **Step 3: Make the smallest source correction needed for every guard.**

Do not broaden interfaces or reformat unrelated files. If a guard reveals a
design conflict, stop implementation and report it rather than weakening the
guard.

- [ ] **Step 4: Run complete verification.**

Run: `node --test tests/create-product-boundaries.test.mjs`

Expected: PASS.

Run: `npm run test:schema && npm run test:application`

Expected: all non-database tests pass.

Run:
`TEST_DATABASE_URL="$TEST_DATABASE_URL" DATABASE_URL="$DATABASE_URL" npm run test:integration`

Expected: all integration tests pass serially.

Run: `npx tsc --noEmit`

Expected: exit 0 with no TypeScript errors.

Run: `npm run lint`

Expected: exit 0 with no ESLint errors.

Run: `npm run build`

Expected: production build succeeds.

Run: `npx prisma validate`

Expected: Prisma schema validates without regeneration or schema edits.

Run: `npx prisma migrate status`

Expected: the configured non-test database reports schema status read-only; do
not deploy, resolve, reset, push, or pull.

Run: `git diff --check && git status --short`

Expected: no whitespace errors; status contains only intentional implementation
files and preserves unrelated pre-existing user changes.

- [ ] **Step 5: Commit the boundary guard and any focused corrections.**

```bash
git add tests/create-product-boundaries.test.mjs src/application src/domain src/infrastructure src/i18n/routing.ts package.json package-lock.json tests/application tests/helpers tests/integration
git commit -m "test(products): enforce create product boundaries"
```

## Commit and Execution Strategy

- Execute in an isolated worktree created with
  `superpowers:using-git-worktrees`.
- Recommended mode: `superpowers:subagent-driven-development`, with a fresh
  implementer and review checkpoint for each task.
- Accepted inline alternative: `superpowers:executing-plans`.
- Keep the ten proposed commits separate unless a reviewer asks to squash
  mechanically inseparable corrections.
- Run specification and code-quality review after every task.
- Use `superpowers:verification-before-completion` before any completion claim.
- Use `superpowers:requesting-code-review` before integration.
- Do not create the worktree, install packages, connect to a database, run
  migrations, or execute this plan during the planning task.
