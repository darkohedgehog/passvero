import assert from "node:assert/strict";
import test from "node:test";

import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { ApplicationError, type ApplicationErrorCategory } from "../../src/application/errors/application-error";
import { PRODUCT_CREATE } from "../../src/application/permissions/product-permissions";
import { createCreateProductService } from "../../src/application/products/create-product/create-product";
import {
  CreateProductPersistenceError,
  type ProductCreationEligibility,
} from "../../src/application/products/create-product/ports";
import type { CreateProductCommand } from "../../src/application/products/create-product/contracts";

const PRODUCT_ID = "product-0001";
const VERSION_ID = "product-version-0001";
const PUBLIC_CODE = "AbCdEfGhIjKlMnOpQrStUv";
const CREATED_AT = new Date("2026-08-12T12:00:00.000Z");

const activeEditorContext: AuthenticatedUserContext = {
  userId: "user-0001",
  organizationId: "organization-0001",
  membershipId: "membership-0001",
  membershipRole: "EDITOR",
  membershipStatus: "ACTIVE",
  permissions: [PRODUCT_CREATE],
  correlationId: "correlation-0001",
};

test("creates and returns one complete initial Product aggregate", async () => {
  const recordedSteps: string[] = [];
  const successTelemetryCalls: Array<{ readonly durationMs: number }> = [];
  const failureTelemetryCalls: unknown[] = [];
  const transactionToken = { name: "transaction-0001" };
  const service = createCreateProductService({
    transactionRunner: {
      async run(work) {
        recordedSteps.push("transaction:start");
        const result = await work(transactionToken);
        recordedSteps.push("transaction:commit");
        return result;
      },
    },
    persistence: {
      async readEligibility(transaction, input) {
        assert.strictEqual(transaction, transactionToken);
        assert.deepEqual(input, {
          organizationId: "organization-0001",
          userId: "user-0001",
          membershipId: "membership-0001",
        });
        recordedSteps.push("eligibility");
        return {
          organizationStatus: "ACTIVE",
          membershipStatus: "ACTIVE",
          membershipRole: "EDITOR",
        };
      },
      async createProductIdentity(transaction, input) {
        assert.strictEqual(transaction, transactionToken);
        assert.deepEqual(input, {
          organizationId: "organization-0001",
          internalName: "Proizvod",
          sku: "SKU-1",
          normalizedSku: "SKU-1",
          publicCode: PUBLIC_CODE,
          actorId: "user-0001",
        });
        recordedSteps.push("product");
        return { productId: PRODUCT_ID, createdAt: CREATED_AT };
      },
      async createInitialProductVersion(transaction, input) {
        assert.strictEqual(transaction, transactionToken);
        assert.deepEqual(input, {
          productId: PRODUCT_ID,
          organizationId: "organization-0001",
          sourceLocale: "hr",
          actorId: "user-0001",
        });
        recordedSteps.push("version");
        return { productVersionId: VERSION_ID };
      },
      async createInitialProductTranslation(transaction, input) {
        assert.strictEqual(transaction, transactionToken);
        assert.deepEqual(input, {
          productVersionId: VERSION_ID,
          locale: "hr",
          productName: "Proizvod",
        });
        recordedSteps.push("translation");
        return { productTranslationId: "translation-0001" };
      },
      async assignCurrentDraftVersionIfUnset(transaction, input) {
        assert.strictEqual(transaction, transactionToken);
        assert.deepEqual(input, {
          productId: PRODUCT_ID,
          organizationId: "organization-0001",
          productVersionId: VERSION_ID,
        });
        recordedSteps.push("pointer");
        return true;
      },
      async insertProductCreatedAuditEvent(transaction, input) {
        assert.strictEqual(transaction, transactionToken);
        assert.deepEqual(input, {
          organizationId: "organization-0001",
          actorId: "user-0001",
          productId: PRODUCT_ID,
          initialProductVersionId: VERSION_ID,
          skuSupplied: true,
          correlationId: "correlation-0001",
        });
        recordedSteps.push("audit");
        return { auditLogId: "audit-0001" };
      },
    },
    publicCodeGenerator: {
      generate() {
        return PUBLIC_CODE;
      },
    },
    monotonicNow: (() => {
      const values = [100, 143];
      return () => values.shift() ?? 143;
    })(),
    telemetry: {
      recordSuccess(input) {
        successTelemetryCalls.push(input);
      },
      recordFailure() {
        failureTelemetryCalls.push(undefined);
      },
      recordPublicCodeCollision() {
        assert.fail("success flow must not record collision telemetry");
      },
      recordPublicCodeExhaustion() {
        assert.fail("success flow must not record exhaustion telemetry");
      },
    },
  });

  const result = await service(
    {
      initialLocale: "hr",
      initialProductName: " Proizvod ",
      organizationSku: " SKU-1 ",
    },
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
    "transaction:start",
    "eligibility",
    "product",
    "version",
    "translation",
    "pointer",
    "audit",
    "transaction:commit",
  ]);
  assert.deepEqual(successTelemetryCalls, [{ durationMs: 43 }]);
  assert.deepEqual(failureTelemetryCalls, []);
});

const validCommand: CreateProductCommand = {
  initialLocale: "hr",
  initialProductName: "Proizvod",
  organizationSku: "SKU-1",
};

interface FailureFixtureOptions {
  readonly transactionError?: unknown;
  readonly eligibilityError?: unknown;
  readonly eligibility?: ProductCreationEligibility | null;
  readonly productError?: unknown;
  readonly versionError?: unknown;
  readonly translationError?: unknown;
  readonly pointerError?: unknown;
  readonly auditError?: unknown;
  readonly pointerAssigned?: boolean;
  readonly publicCode?: string;
}

interface FailureFixture {
  readonly service: ReturnType<typeof createCreateProductService<{ readonly id: string }>>;
  readonly recordedSteps: string[];
  readonly telemetry: {
    readonly successes: Array<{ readonly durationMs: number }>;
    readonly failures: Array<{
      readonly category: ApplicationErrorCategory;
      readonly durationMs: number;
    }>;
    readonly collisions: number;
    readonly exhaustions: number;
  };
  readonly monotonicCalls: () => number;
}

function createFailureFixture(options: FailureFixtureOptions = {}): FailureFixture {
  const recordedSteps: string[] = [];
  const transaction = { id: "transaction-failure" };
  const telemetry = {
    successes: [] as Array<{ readonly durationMs: number }>,
    failures: [] as Array<{
      readonly category: ApplicationErrorCategory;
      readonly durationMs: number;
    }>,
    collisions: 0,
    exhaustions: 0,
  };
  let monotonicCalls = 0;
  const monotonicValues = [100, 141];

  return {
    service: createCreateProductService({
      transactionRunner: {
        async run(work) {
          recordedSteps.push("transaction:start");
          if (options.transactionError !== undefined) {
            throw options.transactionError;
          }
          const result = await work(transaction);
          recordedSteps.push("transaction:commit");
          return result;
        },
      },
      persistence: {
        async readEligibility(receivedTransaction) {
          assert.strictEqual(receivedTransaction, transaction);
          recordedSteps.push("eligibility");
          if (options.eligibilityError !== undefined) {
            throw options.eligibilityError;
          }
          return options.eligibility === undefined
            ? {
                organizationStatus: "ACTIVE",
                membershipStatus: "ACTIVE",
                membershipRole: "EDITOR",
              }
            : options.eligibility;
        },
        async createProductIdentity(receivedTransaction) {
          assert.strictEqual(receivedTransaction, transaction);
          recordedSteps.push("product");
          if (options.productError !== undefined) {
            throw options.productError;
          }
          return { productId: PRODUCT_ID, createdAt: CREATED_AT };
        },
        async createInitialProductVersion(receivedTransaction) {
          assert.strictEqual(receivedTransaction, transaction);
          recordedSteps.push("version");
          if (options.versionError !== undefined) {
            throw options.versionError;
          }
          return { productVersionId: VERSION_ID };
        },
        async createInitialProductTranslation(receivedTransaction) {
          assert.strictEqual(receivedTransaction, transaction);
          recordedSteps.push("translation");
          if (options.translationError !== undefined) {
            throw options.translationError;
          }
          return { productTranslationId: "translation-0001" };
        },
        async assignCurrentDraftVersionIfUnset(receivedTransaction) {
          assert.strictEqual(receivedTransaction, transaction);
          recordedSteps.push("pointer");
          if (options.pointerError !== undefined) {
            throw options.pointerError;
          }
          return options.pointerAssigned ?? true;
        },
        async insertProductCreatedAuditEvent(receivedTransaction) {
          assert.strictEqual(receivedTransaction, transaction);
          recordedSteps.push("audit");
          if (options.auditError !== undefined) {
            throw options.auditError;
          }
          return { auditLogId: "audit-0001" };
        },
      },
      publicCodeGenerator: {
        generate() {
          recordedSteps.push("public-code");
          return options.publicCode ?? PUBLIC_CODE;
        },
      },
      monotonicNow() {
        monotonicCalls += 1;
        return monotonicValues.shift() ?? 141;
      },
      telemetry: {
        recordSuccess(input) {
          telemetry.successes.push(input);
        },
        recordFailure(input) {
          telemetry.failures.push(input);
        },
        recordPublicCodeCollision() {
          telemetry.collisions += 1;
        },
        recordPublicCodeExhaustion() {
          telemetry.exhaustions += 1;
        },
      },
    }),
    recordedSteps,
    telemetry,
    monotonicCalls: () => monotonicCalls,
  };
}

async function assertFailure(
  fixture: FailureFixture,
  context: AuthenticatedUserContext | null,
  expected: {
    readonly category: ApplicationErrorCategory;
    readonly code: string;
    readonly correlationId?: string;
  },
  command = validCommand,
): Promise<ApplicationError> {
  let observedError: ApplicationError | undefined;

  await assert.rejects(
    fixture.service(command, context),
    (error: unknown) => {
      assert.ok(error instanceof ApplicationError);
      assert.equal(error.category, expected.category);
      assert.equal(error.code, expected.code);
      assert.equal(error.retryable, false);
      assert.equal(error.correlationId, expected.correlationId);
      assertSafeError(error);
      observedError = error;
      return true;
    },
  );

  assert.deepEqual(fixture.telemetry.failures, [{ category: expected.category, durationMs: 41 }]);
  assert.deepEqual(fixture.telemetry.successes, []);
  assert.equal(fixture.telemetry.collisions, 0);
  assert.equal(fixture.telemetry.exhaustions, 0);
  assert.equal(fixture.monotonicCalls(), 2);

  assert.ok(observedError !== undefined);
  return observedError;
}

function assertSafeError(error: ApplicationError): void {
  const serialized = `${error.code} ${error.message}`;
  for (const unsafeValue of [
    "P2002",
    "Product_publicCode_key",
    "SQL",
    PUBLIC_CODE,
    activeEditorContext.userId,
    activeEditorContext.organizationId,
  ]) {
    assert.equal(serialized.includes(unsafeValue), false, `error exposed ${unsafeValue}`);
  }
  assert.equal("cause" in error, false, "error retained an unsafe cause");
}

test("returns an unauthenticated safe error without touching persistence for null context", async () => {
  const fixture = createFailureFixture();

  await assertFailure(fixture, null, {
    category: "UNAUTHENTICATED",
    code: "CREATE_PRODUCT_UNAUTHENTICATED",
  }, { initialLocale: "not-a-locale", initialProductName: "" });

  assert.deepEqual(fixture.recordedSteps, []);
});

test("rejects suspended or removed context Memberships before normalization or persistence", async () => {
  for (const membershipStatus of ["SUSPENDED", "REMOVED"] as const) {
    const fixture = createFailureFixture();
    const context = { ...activeEditorContext, membershipStatus };

    await assertFailure(
      fixture,
      context,
      {
        category: "FORBIDDEN",
        code: "CREATE_PRODUCT_FORBIDDEN",
        correlationId: context.correlationId,
      },
      { initialLocale: "not-a-locale", initialProductName: "" },
    );

    assert.deepEqual(fixture.recordedSteps, []);
  }
});

test("rejects a context without PRODUCT_CREATE before normalization or persistence", async () => {
  const fixture = createFailureFixture();
  const context = { ...activeEditorContext, permissions: [] };

  await assertFailure(
    fixture,
    context,
    {
      category: "FORBIDDEN",
      code: "CREATE_PRODUCT_FORBIDDEN",
      correlationId: context.correlationId,
    },
    { initialLocale: "not-a-locale", initialProductName: "" },
  );

  assert.deepEqual(fixture.recordedSteps, []);
});

test("preserves a normalized malformed-command ApplicationError after authenticated authorization", async () => {
  const fixture = createFailureFixture();

  await assertFailure(
    fixture,
    activeEditorContext,
    {
      category: "VALIDATION",
      code: "CREATE_PRODUCT_NAME_INVALID",
      correlationId: activeEditorContext.correlationId,
    },
    { ...validCommand, initialProductName: "   " },
  );

  assert.deepEqual(fixture.recordedSteps, []);
});

for (const missing of ["Membership", "Organization"] as const) {
  test(`maps transactionally missing ${missing} eligibility to safe context not-found`, async () => {
    const fixture = createFailureFixture({ eligibility: null });

    await assertFailure(fixture, activeEditorContext, {
      category: "NOT_FOUND",
      code: "CREATE_PRODUCT_CONTEXT_NOT_FOUND",
      correlationId: activeEditorContext.correlationId,
    });

    assert.deepEqual(fixture.recordedSteps, ["public-code", "transaction:start", "eligibility"]);
  });
}

test("maps every non-active Organization status to the safe ineligible-state error", async () => {
  for (const organizationStatus of ["SUSPENDED", "DEACTIVATED", "PENDING_DELETION"] as const) {
    const fixture = createFailureFixture({
      eligibility: {
        organizationStatus,
        membershipStatus: "ACTIVE",
        membershipRole: "EDITOR",
      },
    });

    await assertFailure(fixture, activeEditorContext, {
      category: "INVALID_STATE",
      code: "CREATE_PRODUCT_ORGANIZATION_INELIGIBLE",
      correlationId: activeEditorContext.correlationId,
    });

    assert.deepEqual(fixture.recordedSteps, ["public-code", "transaction:start", "eligibility"]);
  }
});

test("prioritizes revalidated Membership authorization over non-active Organization disclosure", async () => {
  const cases: readonly ProductCreationEligibility[] = [
    ...(["SUSPENDED", "DEACTIVATED", "PENDING_DELETION"] as const).flatMap(
      (organizationStatus) => [
        { organizationStatus, membershipStatus: "SUSPENDED" as const, membershipRole: "EDITOR" as const },
        { organizationStatus, membershipStatus: "REMOVED" as const, membershipRole: "EDITOR" as const },
        { organizationStatus, membershipStatus: "ACTIVE" as const, membershipRole: "VIEWER" as const },
      ],
    ),
  ];

  for (const eligibility of cases) {
    const fixture = createFailureFixture({ eligibility });

    await assertFailure(fixture, activeEditorContext, {
      category: "FORBIDDEN",
      code: "CREATE_PRODUCT_FORBIDDEN",
      correlationId: activeEditorContext.correlationId,
    });

    assert.deepEqual(fixture.recordedSteps, ["public-code", "transaction:start", "eligibility"]);
  }
});

test("maps transactionally inactive Membership or ineligible role to forbidden", async () => {
  const cases: readonly ProductCreationEligibility[] = [
    { organizationStatus: "ACTIVE", membershipStatus: "SUSPENDED", membershipRole: "EDITOR" },
    { organizationStatus: "ACTIVE", membershipStatus: "REMOVED", membershipRole: "EDITOR" },
    { organizationStatus: "ACTIVE", membershipStatus: "ACTIVE", membershipRole: "VIEWER" },
  ];

  for (const eligibility of cases) {
    const fixture = createFailureFixture({ eligibility });

    await assertFailure(fixture, activeEditorContext, {
      category: "FORBIDDEN",
      code: "CREATE_PRODUCT_FORBIDDEN",
      correlationId: activeEditorContext.correlationId,
    });

    assert.deepEqual(fixture.recordedSteps, ["public-code", "transaction:start", "eligibility"]);
  }
});

test("maps a false guarded pointer assignment to the safe pointer conflict error and stops before audit", async () => {
  const fixture = createFailureFixture({ pointerAssigned: false });

  await assertFailure(fixture, activeEditorContext, {
    category: "INVALID_STATE",
    code: "CREATE_PRODUCT_POINTER_CONFLICT",
    correlationId: activeEditorContext.correlationId,
  });

  assert.deepEqual(fixture.recordedSteps, [
    "public-code",
    "transaction:start",
    "eligibility",
    "product",
    "version",
    "translation",
    "pointer",
  ]);
});

test("maps known persistence failures to safe stable errors without retrying", async () => {
  const cases: readonly {
    readonly kind: "ORGANIZATION_SKU_CONFLICT" | "POINTER_CONFLICT" | "ACTIVE_DRAFT_CONFLICT" | "NOT_FOUND" | "UNKNOWN" | "PUBLIC_CODE_CONFLICT";
    readonly category: ApplicationErrorCategory;
    readonly code: string;
  }[] = [
    {
      kind: "ORGANIZATION_SKU_CONFLICT",
      category: "CONFLICT",
      code: "CREATE_PRODUCT_SKU_CONFLICT",
    },
    {
      kind: "POINTER_CONFLICT",
      category: "INVALID_STATE",
      code: "CREATE_PRODUCT_POINTER_CONFLICT",
    },
    {
      kind: "ACTIVE_DRAFT_CONFLICT",
      category: "INVALID_STATE",
      code: "CREATE_PRODUCT_POINTER_CONFLICT",
    },
    { kind: "NOT_FOUND", category: "NOT_FOUND", code: "CREATE_PRODUCT_CONTEXT_NOT_FOUND" },
    { kind: "UNKNOWN", category: "INTERNAL", code: "CREATE_PRODUCT_INTERNAL" },
    { kind: "PUBLIC_CODE_CONFLICT", category: "INTERNAL", code: "CREATE_PRODUCT_INTERNAL" },
  ];

  for (const { kind, category, code } of cases) {
    const fixture = createFailureFixture({
      productError: new CreateProductPersistenceError(kind),
    });

    await assertFailure(fixture, activeEditorContext, {
      category,
      code,
      correlationId: activeEditorContext.correlationId,
    });

    assert.deepEqual(fixture.recordedSteps, [
      "public-code",
      "transaction:start",
      "eligibility",
      "product",
    ]);
  }
});

test("maps an unrecognized persistence failure to safe internal without retrying", async () => {
  const fixture = createFailureFixture({
    productError: new Error(
      "P2002 Product_publicCode_key SQL candidate AbCdEfGhIjKlMnOpQrStUv user-0001 organization-0001",
    ),
  });

  await assertFailure(fixture, activeEditorContext, {
    category: "INTERNAL",
    code: "CREATE_PRODUCT_INTERNAL",
    correlationId: activeEditorContext.correlationId,
  });

  assert.deepEqual(fixture.recordedSteps, [
    "public-code",
    "transaction:start",
    "eligibility",
    "product",
  ]);
});

test("sanitizes tainted ApplicationErrors from every transaction and persistence boundary", async () => {
  const cases: readonly {
    readonly boundary: string;
    readonly configure: (error: ApplicationError) => FailureFixtureOptions;
    readonly expectedSteps: readonly string[];
  }[] = [
    {
      boundary: "transaction runner",
      configure: (error) => ({ transactionError: error }),
      expectedSteps: ["public-code", "transaction:start"],
    },
    {
      boundary: "eligibility read",
      configure: (error) => ({ eligibilityError: error }),
      expectedSteps: ["public-code", "transaction:start", "eligibility"],
    },
    {
      boundary: "product creation",
      configure: (error) => ({ productError: error }),
      expectedSteps: ["public-code", "transaction:start", "eligibility", "product"],
    },
    {
      boundary: "version creation",
      configure: (error) => ({ versionError: error }),
      expectedSteps: ["public-code", "transaction:start", "eligibility", "product", "version"],
    },
    {
      boundary: "translation creation",
      configure: (error) => ({ translationError: error }),
      expectedSteps: ["public-code", "transaction:start", "eligibility", "product", "version", "translation"],
    },
    {
      boundary: "pointer assignment",
      configure: (error) => ({ pointerError: error }),
      expectedSteps: ["public-code", "transaction:start", "eligibility", "product", "version", "translation", "pointer"],
    },
    {
      boundary: "audit insertion",
      configure: (error) => ({ auditError: error }),
      expectedSteps: ["public-code", "transaction:start", "eligibility", "product", "version", "translation", "pointer", "audit"],
    },
  ];

  for (const { boundary, configure, expectedSteps } of cases) {
    const taintedError = new ApplicationError(
      "CONFLICT",
      "P2002 Product_publicCode_key",
      "SQL candidate AbCdEfGhIjKlMnOpQrStUv user-0001 organization-0001",
      true,
      "tainted-correlation-0001",
    );
    Object.assign(taintedError, {
      cause: new Error("P2002 Product_publicCode_key SQL"),
    });
    const fixture = createFailureFixture(configure(taintedError));

    const returnedError = await assertFailure(fixture, activeEditorContext, {
      category: "INTERNAL",
      code: "CREATE_PRODUCT_INTERNAL",
      correlationId: activeEditorContext.correlationId,
    });

    assert.notStrictEqual(returnedError, taintedError, `${boundary} error passed through`);
    assert.deepEqual(fixture.recordedSteps, expectedSteps);
  }
});
