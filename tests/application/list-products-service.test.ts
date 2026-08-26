import assert from "node:assert/strict";
import test from "node:test";

import { ApplicationError } from "../../src/application/errors/application-error";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { createListProductsService } from "../../src/application/products/list-products/list-products";
import type {
  ListProductsPersistence,
  ProductListRecord,
} from "../../src/application/products/list-products/ports";

const organizationId = "11111111-1111-4111-8111-111111111111";
const context: AuthenticatedUserContext = {
  userId: "22222222-2222-4222-8222-222222222222",
  organizationId,
  membershipId: "33333333-3333-4333-8333-333333333333",
  membershipRole: "VIEWER",
  membershipStatus: "ACTIVE",
  permissions: ["PRODUCT_READ"],
  correlationId: "list-products-correlation",
};

function record(
  index: number,
  overrides: Partial<ProductListRecord> = {},
): ProductListRecord {
  const suffix = index.toString(16).padStart(12, "0");
  return {
    organizationId,
    productId: `aaaaaaaa-aaaa-4aaa-8aaa-${suffix}`,
    internalName: `Product ${index}`,
    sku: index % 2 === 0 ? `SKU-${index}` : null,
    lifecycleStatus: "ACTIVE",
    currentDraftVersion: { status: "DRAFT", sourceLocale: "hr" },
    currentPublishedVersion: null,
    updatedAt: new Date(`2026-08-${String(index).padStart(2, "0")}T10:00:00.000Z`),
    ...overrides,
  };
}

function harness(rows: readonly ProductListRecord[]) {
  const calls: Parameters<ListProductsPersistence["listPage"]>[0][] = [];
  const persistence: ListProductsPersistence = {
    async listPage(input) {
      calls.push(input);
      return rows;
    },
  };
  return {
    calls,
    listProducts: createListProductsService({ persistence }),
  };
}

function assertApplicationError(
  error: unknown,
  category: ApplicationError["category"],
  code: string,
  correlationId: string | null = context.correlationId,
): boolean {
  assert.ok(error instanceof ApplicationError);
  assert.equal(error.category, category);
  assert.equal(error.code, code);
  assert.equal(error.correlationId, correlationId ?? undefined);
  return true;
}

test("uses only trusted context organization authority and returns the narrow projection", async () => {
  const fixture = harness([
    record(1, {
      internalName: "Industrial Chair",
      currentDraftVersion: { status: "READY_FOR_REVIEW", sourceLocale: "de" },
      currentPublishedVersion: { status: "PUBLISHED", sourceLocale: "en" },
    }),
    record(2, {
      currentDraftVersion: null,
      currentPublishedVersion: { status: "PUBLISHED", sourceLocale: "sl" },
    }),
  ]);

  const result = await fixture.listProducts({ cursor: null }, context);

  assert.deepEqual(fixture.calls, [{ organizationId, after: null, take: 26 }]);
  assert.deepEqual(result, {
    items: [
      {
        productId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
        name: "Industrial Chair",
        sku: null,
        lifecycleStatus: "ACTIVE",
        currentVersionStatus: "READY_FOR_REVIEW",
        sourceLocale: "de",
        updatedAt: new Date("2026-08-01T10:00:00.000Z"),
      },
      {
        productId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000002",
        name: "Product 2",
        sku: "SKU-2",
        lifecycleStatus: "ACTIVE",
        currentVersionStatus: "PUBLISHED",
        sourceLocale: "sl",
        updatedAt: new Date("2026-08-02T10:00:00.000Z"),
      },
    ],
    nextCursor: null,
  });
  assert.equal("organizationId" in result.items[0]!, false);
});

test("returns 25 items and decodes its opaque cursor for the next scoped page", async () => {
  const rows = Array.from({ length: 26 }, (_, index) => record(index + 1));
  const first = harness(rows);

  const result = await first.listProducts({ cursor: null }, context);

  assert.equal(result.items.length, 25);
  assert.equal(typeof result.nextCursor, "string");
  assert.equal(result.nextCursor?.includes(rows[24]!.productId), false);
  assert.equal(result.nextCursor?.includes(rows[24]!.updatedAt.toISOString()), false);

  const second = harness([]);
  await second.listProducts({ cursor: result.nextCursor }, context);
  assert.deepEqual(second.calls, [{
    organizationId,
    after: {
      productId: rows[24]!.productId,
      updatedAt: rows[24]!.updatedAt,
    },
    take: 26,
  }]);
});

test("fails safely on malformed cursors before persistence", async () => {
  const fixture = harness([]);

  for (const cursor of ["", "not-base64url!", "e30", "eyJ2IjoxfQ"]) {
    await assert.rejects(
      fixture.listProducts({ cursor }, context),
      (error) => assertApplicationError(error, "VALIDATION", "LIST_PRODUCTS_CURSOR_INVALID"),
    );
  }

  assert.equal(fixture.calls.length, 0);
});

test("requires an active authenticated context with PRODUCT_READ", async () => {
  const fixture = harness([]);

  await assert.rejects(
    fixture.listProducts({ cursor: null }, null),
    (error) => assertApplicationError(
      error,
      "UNAUTHENTICATED",
      "LIST_PRODUCTS_UNAUTHENTICATED",
      null,
    ),
  );
  await assert.rejects(
    fixture.listProducts({ cursor: null }, { ...context, permissions: [] }),
    (error) => assertApplicationError(error, "FORBIDDEN", "LIST_PRODUCTS_FORBIDDEN"),
  );
  await assert.rejects(
    fixture.listProducts(
      { cursor: null },
      { ...context, membershipStatus: "SUSPENDED" },
    ),
    (error) => assertApplicationError(error, "FORBIDDEN", "LIST_PRODUCTS_FORBIDDEN"),
  );
  assert.equal(fixture.calls.length, 0);
});

test("fails closed before projection if persistence returns a cross-tenant row", async () => {
  const fixture = harness([
    record(1, { organizationId: "99999999-9999-4999-8999-999999999999" }),
  ]);

  await assert.rejects(
    fixture.listProducts({ cursor: null }, context),
    (error) => assertApplicationError(error, "INTERNAL", "LIST_PRODUCTS_INTERNAL"),
  );
});
