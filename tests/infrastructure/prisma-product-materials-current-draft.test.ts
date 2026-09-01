import assert from "node:assert/strict";
import test from "node:test";

import type { PrismaClient } from "../../src/generated/prisma/client";
import {
  PrismaProductMaterialsCurrentDraftPersistence,
  PrismaProductMaterialsCurrentDraftTransactionRunner,
} from "../../src/infrastructure/persistence/prisma/prisma-product-materials-current-draft";

const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const organizationId = "11111111-1111-4111-8111-111111111111";
const draftId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const materialId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const actorId = "22222222-2222-4222-8222-222222222222";
const updatedAt = new Date("2026-09-01T10:00:00.000Z");
const values = { materialName: "Steel", category: "Metal", percentage: "40.00", isRecycled: true, recycledPercentage: "75.00" } as const;

test("loads only tenant-scoped current-draft materials in createdAt/id order", async () => {
  let input: unknown;
  const prisma = {
    product: {
      async findFirst(value: unknown) {
        input = value;
        return {
          id: productId,
          organizationId,
          lifecycleStatus: "ACTIVE",
          currentDraftVersionId: draftId,
          updatedAt,
          currentDraftVersion: {
            id: draftId,
            productId,
            organizationId,
            status: "DRAFT",
            updatedAt,
            materials: [{ id: materialId, productVersionId: draftId, ...values, createdAt: updatedAt, updatedAt }],
          },
        };
      },
    },
  } as unknown as PrismaClient;
  const result = await new PrismaProductMaterialsCurrentDraftPersistence(prisma)
    .findCurrentDraftByProductAndOrganization({ productId, organizationId });
  assert.equal(result?.currentDraftVersion?.materials[0].percentage, "40.00");
  assert.deepEqual((input as { where: unknown }).where, { id: productId, organizationId });
  assert.deepEqual(
    ((input as { select: { currentDraftVersion: { select: { materials: { orderBy: unknown } } } } }).select.currentDraftVersion.select.materials.orderBy),
    [{ createdAt: "asc" }, { id: "asc" }],
  );
  assert.doesNotMatch(JSON.stringify(input), /currentPublishedVersion|supplier|notes/);
});

test("uses aggregate and row CAS predicates and writes only the five editable fields", async () => {
  const calls: Array<{ operation: string; input: unknown }> = [];
  const tx = {
    product: { async updateMany(input: unknown) { calls.push({ operation: "product", input }); return { count: 1 }; } },
    productVersion: { async updateMany(input: unknown) { calls.push({ operation: "draft", input }); return { count: 1 }; } },
    productMaterial: {
      async create(input: unknown) { calls.push({ operation: "create", input }); return { id: materialId }; },
      async updateMany(input: unknown) { calls.push({ operation: "edit", input }); return { count: 1 }; },
      async deleteMany(input: unknown) { calls.push({ operation: "remove", input }); return { count: 1 }; },
    },
  };
  const persistence = new PrismaProductMaterialsCurrentDraftPersistence({} as PrismaClient);
  assert.equal(await persistence.touchProductIfCurrent(tx as never, { productId, organizationId, currentDraftVersionId: draftId, expectedUpdatedAt: updatedAt, actorId }), true);
  assert.equal(await persistence.touchDraftVersionIfCurrent(tx as never, { productVersionId: draftId, productId, organizationId, expectedUpdatedAt: updatedAt, actorId }), true);
  assert.deepEqual(await persistence.insertMaterial(tx as never, { productVersionId: draftId, values }), { materialId });
  assert.equal(await persistence.updateMaterialIfCurrent(tx as never, { materialId, productVersionId: draftId, expectedUpdatedAt: updatedAt, values }), true);
  assert.equal(await persistence.deleteMaterialIfCurrent(tx as never, { materialId, productVersionId: draftId, expectedUpdatedAt: updatedAt }), true);
  assert.deepEqual((calls[3].input as { where: unknown }).where, { id: materialId, productVersionId: draftId, updatedAt });
  assert.deepEqual((calls[4].input as { where: unknown }).where, { id: materialId, productVersionId: draftId, updatedAt });
  const serialized = JSON.stringify(calls);
  assert.match(serialized, /currentDraftVersionId/);
  assert.doesNotMatch(serialized, /currentPublishedVersionId|supplier|notes/);
  assert.doesNotMatch(JSON.stringify((calls[2].input as { data: unknown }).data), /organizationId|productId|actorId/);
  assert.doesNotMatch(JSON.stringify((calls[3].input as { data: unknown }).data), /organizationId|productId|actorId/);
});

test("writes minimized PRODUCT_UPDATED metadata without values or material identity", async () => {
  let input: unknown;
  const tx = { auditLog: { async create(value: unknown) { input = value; return { id: "audit-id" }; } } };
  const persistence = new PrismaProductMaterialsCurrentDraftPersistence({} as PrismaClient);
  await persistence.insertProductUpdatedAuditEvent(tx as never, {
    organizationId,
    actorId,
    productId,
    operation: "EDIT",
    changedFields: ["category", "percentage"],
    correlationId: "correlation-id",
  });
  assert.deepEqual((input as { data: { metadata: unknown } }).data.metadata, {
    changedCollection: "materials",
    operation: "EDIT",
    changedFields: ["category", "percentage"],
  });
  const serialized = JSON.stringify(input);
  assert.match(serialized, /PRODUCT_UPDATED/);
  assert.doesNotMatch(serialized, /Steel|Metal|40\.00|75\.00|cccccccc/);
});

test("runs all material work in exactly one business Prisma transaction", async () => {
  const token = Symbol("transaction");
  let count = 0;
  const runner = new PrismaProductMaterialsCurrentDraftTransactionRunner({
    $transaction: async (work: (tx: symbol) => Promise<string>) => {
      count += 1;
      return work(token);
    },
  } as unknown as PrismaClient);
  assert.equal(await runner.run(async (transaction) => {
    assert.strictEqual(transaction, token);
    return "ok";
  }), "ok");
  assert.equal(count, 1);
});
