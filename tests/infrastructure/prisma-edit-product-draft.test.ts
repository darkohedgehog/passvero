import assert from "node:assert/strict";
import test from "node:test";

import type { PrismaClient } from "../../src/generated/prisma/client";
import { EditProductDraftPersistenceError } from "../../src/application/products/edit-product-draft/ports";
import {
  PrismaEditProductDraftPersistence,
  PrismaEditProductDraftTransactionRunner,
} from "../../src/infrastructure/persistence/prisma/prisma-edit-product-draft";
import { translatePrismaEditProductDraftError } from "../../src/infrastructure/persistence/prisma/prisma-edit-product-draft-errors";

const organizationId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const membershipId = "33333333-3333-4333-8333-333333333333";
const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const draftId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const productUpdatedAt = new Date("2026-08-31T10:00:00.000Z");
const draftUpdatedAt = new Date("2026-08-31T10:01:00.000Z");
const translationUpdatedAt = new Date("2026-08-31T10:02:00.000Z");

test("loads one narrow tenant-scoped pointed draft without published data or heuristics", async () => {
  const calls: unknown[] = [];
  const prisma = {
    product: {
      async findFirst(input: unknown) {
        calls.push(input);
        return {
          id: productId,
          organizationId,
          internalName: "Industrial chair",
          sku: "CHAIR-1",
          normalizedSku: "CHAIR-1",
          lifecycleStatus: "ACTIVE" as const,
          currentDraftVersionId: draftId,
          updatedAt: productUpdatedAt,
          currentDraftVersion: {
            id: draftId,
            productId,
            organizationId,
            status: "DRAFT" as const,
            sourceLocale: "hr",
            updatedAt: draftUpdatedAt,
            translations: [
              { productVersionId: draftId, locale: "en", productName: "Chair", updatedAt: translationUpdatedAt },
              { productVersionId: draftId, locale: "hr", productName: "Industrial chair", updatedAt: translationUpdatedAt },
            ],
          },
        };
      },
    },
  } as unknown as PrismaClient;

  const persistence = new PrismaEditProductDraftPersistence(prisma);
  const result = await persistence.findByIdAndOrganization({ productId, organizationId });

  assert.equal(calls.length, 1);
  const query = calls[0] as Record<string, unknown>;
  assert.deepEqual(query.where, { id: productId, organizationId });
  assert.equal("orderBy" in query, false);
  assert.equal(JSON.stringify(query).includes("currentPublished"), false);
  assert.deepEqual(result, {
    productId,
    organizationId,
    internalName: "Industrial chair",
    sku: "CHAIR-1",
    normalizedSku: "CHAIR-1",
    lifecycleStatus: "ACTIVE",
    currentDraftVersionId: draftId,
    updatedAt: productUpdatedAt,
    currentDraftVersion: {
      productVersionId: draftId,
      productId,
      organizationId,
      status: "DRAFT",
      sourceLocale: "hr",
      updatedAt: draftUpdatedAt,
      sourceTranslation: {
        productVersionId: draftId,
        locale: "hr",
        productName: "Industrial chair",
        updatedAt: translationUpdatedAt,
      },
    },
  });
});

test("uses exact tenant ownership reads and all three conditional update predicates", async () => {
  const calls: Array<{ readonly model: string; readonly method: string; readonly input: unknown }> = [];
  const transaction = {
    membership: {
      async findFirst(input: unknown) {
        calls.push({ model: "membership", method: "findFirst", input });
        return { role: "EDITOR" as const, status: "ACTIVE" as const, organization: { status: "ACTIVE" as const } };
      },
    },
    product: {
      async findFirst(input: unknown) {
        calls.push({ model: "product", method: "findFirst", input });
        return {
          id: productId,
          organizationId,
          internalName: "Industrial chair",
          sku: "CHAIR-1",
          normalizedSku: "CHAIR-1",
          lifecycleStatus: "ACTIVE" as const,
          currentDraftVersionId: draftId,
          updatedAt: productUpdatedAt,
        };
      },
      async updateMany(input: unknown) {
        calls.push({ model: "product", method: "updateMany", input });
        return { count: 1 };
      },
    },
    productVersion: {
      async findFirst(input: unknown) {
        calls.push({ model: "productVersion", method: "findFirst", input });
        return {
          id: draftId,
          productId,
          organizationId,
          status: "DRAFT" as const,
          sourceLocale: "hr",
          updatedAt: draftUpdatedAt,
        };
      },
      async updateMany(input: unknown) {
        calls.push({ model: "productVersion", method: "updateMany", input });
        return { count: 1 };
      },
    },
    productTranslation: {
      async findFirst(input: unknown) {
        calls.push({ model: "productTranslation", method: "findFirst", input });
        return { productVersionId: draftId, locale: "hr", productName: "Industrial chair", updatedAt: translationUpdatedAt };
      },
      async updateMany(input: unknown) {
        calls.push({ model: "productTranslation", method: "updateMany", input });
        return { count: 1 };
      },
    },
    auditLog: {
      async create(input: unknown) {
        calls.push({ model: "auditLog", method: "create", input });
        return { id: "audit-id" };
      },
    },
  };
  const persistence = new PrismaEditProductDraftPersistence({} as PrismaClient);

  assert.deepEqual(await persistence.readEligibility(transaction as never, { organizationId, userId, membershipId }), {
    organizationStatus: "ACTIVE",
    membershipStatus: "ACTIVE",
    membershipRole: "EDITOR",
  });
  assert.deepEqual(await persistence.readProduct(transaction as never, { productId, organizationId }), {
    productId,
    organizationId,
    internalName: "Industrial chair",
    sku: "CHAIR-1",
    normalizedSku: "CHAIR-1",
    lifecycleStatus: "ACTIVE",
    currentDraftVersionId: draftId,
    updatedAt: productUpdatedAt,
  });
  assert.deepEqual(await persistence.readDraftVersion(transaction as never, { productVersionId: draftId, productId, organizationId }), {
    productVersionId: draftId,
    productId,
    organizationId,
    status: "DRAFT",
    sourceLocale: "hr",
    updatedAt: draftUpdatedAt,
  });
  assert.deepEqual(await persistence.readSourceTranslation(transaction as never, { productVersionId: draftId, locale: "hr" }), {
    productVersionId: draftId,
    locale: "hr",
    productName: "Industrial chair",
    updatedAt: translationUpdatedAt,
  });
  assert.equal(await persistence.updateProductIfCurrent(transaction as never, {
    productId,
    organizationId,
    currentDraftVersionId: draftId,
    expectedUpdatedAt: productUpdatedAt,
    internalName: "Updated chair",
    sku: "Chair-X",
    normalizedSku: "Chair-X",
    actorId: userId,
  }), true);
  assert.equal(await persistence.touchDraftVersionIfCurrent(transaction as never, {
    productVersionId: draftId,
    productId,
    organizationId,
    expectedUpdatedAt: draftUpdatedAt,
    actorId: userId,
  }), true);
  assert.equal(await persistence.updateSourceTranslationIfCurrent(transaction as never, {
    productVersionId: draftId,
    locale: "hr",
    expectedUpdatedAt: translationUpdatedAt,
    productName: "Updated chair",
  }), true);
  await persistence.insertProductUpdatedAuditEvent(transaction as never, {
    organizationId,
    actorId: userId,
    productId,
    changedFields: ["productName", "organizationSku"],
    correlationId: "correlation-id",
  });

  assert.deepEqual(calls[0], {
    model: "membership",
    method: "findFirst",
    input: {
      where: { id: membershipId, organizationId, userId },
      select: { role: true, status: true, organization: { select: { status: true } } },
    },
  });
  assert.deepEqual((calls[1].input as { where: unknown }).where, { id: productId, organizationId });
  assert.deepEqual((calls[2].input as { where: unknown }).where, { id: draftId, productId, organizationId });
  assert.deepEqual((calls[3].input as { where: unknown }).where, { productVersionId: draftId, locale: "hr" });
  assert.deepEqual((calls[4].input as { where: unknown }).where, {
    id: productId,
    organizationId,
    lifecycleStatus: "ACTIVE",
    currentDraftVersionId: draftId,
    updatedAt: productUpdatedAt,
  });
  assert.deepEqual((calls[5].input as { where: unknown }).where, {
    id: draftId,
    productId,
    organizationId,
    status: { in: ["DRAFT", "READY_FOR_REVIEW"] },
    updatedAt: draftUpdatedAt,
  });
  assert.deepEqual((calls[6].input as { where: unknown }).where, {
    productVersionId: draftId,
    locale: "hr",
    updatedAt: translationUpdatedAt,
  });
  assert.deepEqual(calls[7], {
    model: "auditLog",
    method: "create",
    input: {
      data: {
        organizationId,
        actorId: userId,
        action: "PRODUCT_UPDATED",
        entityType: "PRODUCT",
        entityId: productId,
        summary: "Product updated.",
        metadata: { changedFields: ["productName", "organizationSku"] },
        correlationId: "correlation-id",
      },
      select: { id: true },
    },
  });
  assert.equal(JSON.stringify(calls[7]).includes("Updated chair"), false);
  assert.equal(JSON.stringify(calls[7]).includes("Chair-X"), false);
});

test("returns false for zero-count CAS updates and maps only the exact SKU uniqueness target", async () => {
  const persistence = new PrismaEditProductDraftPersistence({} as PrismaClient);
  const transaction = {
    product: { async updateMany() { return { count: 0 }; } },
  };
  assert.equal(await persistence.updateProductIfCurrent(transaction as never, {
    productId,
    organizationId,
    currentDraftVersionId: draftId,
    expectedUpdatedAt: productUpdatedAt,
    internalName: "Name",
    sku: "SKU",
    normalizedSku: "SKU",
    actorId: userId,
  }), false);

  const conflict = translatePrismaEditProductDraftError({
    code: "P2002",
    meta: { modelName: "Product", target: ["organizationId", "normalizedSku"] },
  }, "updateProduct");
  assert.ok(conflict instanceof EditProductDraftPersistenceError);
  assert.equal(conflict.kind, "ORGANIZATION_SKU_CONFLICT");

  for (const error of [
    { code: "P2002", meta: { modelName: "Product", target: ["publicCode"] } },
    { code: "P2002", meta: { modelName: "ProductTranslation", target: ["productVersionId", "locale"] } },
    new Error("database detail"),
  ]) {
    assert.equal(translatePrismaEditProductDraftError(error, "updateProduct").kind, "UNKNOWN");
  }
});

test("runs mutation work through exactly one Prisma business transaction", async () => {
  const token = Symbol("transaction");
  const calls: unknown[] = [];
  const prisma = {
    async $transaction(work: (transaction: symbol) => Promise<unknown>) {
      calls.push("transaction");
      return work(token);
    },
  } as unknown as PrismaClient;
  const runner = new PrismaEditProductDraftTransactionRunner(prisma);

  assert.equal(await runner.run(async (transaction) => {
    assert.strictEqual(transaction, token);
    return "result";
  }), "result");
  assert.deepEqual(calls, ["transaction"]);
});
