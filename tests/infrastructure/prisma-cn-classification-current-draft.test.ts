import assert from "node:assert/strict";
import test from "node:test";

import { Prisma, type PrismaClient } from "../../src/generated/prisma/client";
import { CnClassificationConflictPersistenceError } from "../../src/application/products/cn-classification-current-draft/ports";
import {
  PrismaCnClassificationCurrentDraftPersistence,
  PrismaCnClassificationCurrentDraftTransactionRunner,
} from "../../src/infrastructure/persistence/prisma/prisma-cn-classification-current-draft";

const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const draftId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const identifierId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const organizationId = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";
const updatedAt = new Date("2026-09-01T10:00:00.000Z");

test("loads only the pointed current draft and its zero-or-one CN projection", async () => {
  let input: unknown;
  const prisma = {
    product: {
      async findFirst(value: unknown) {
        input = value;
        return {
          id: productId, organizationId, lifecycleStatus: "ACTIVE", currentDraftVersionId: draftId, updatedAt,
          currentDraftVersion: {
            id: draftId, productId, organizationId, status: "DRAFT", updatedAt,
            identifiers: [{ id: identifierId, productVersionId: draftId, type: "CN", value: "01012100", nomenclatureYear: 2026, issuingAuthority: null, notes: null, createdAt: updatedAt, updatedAt }],
          },
        };
      },
    },
  } as unknown as PrismaClient;
  const result = await new PrismaCnClassificationCurrentDraftPersistence(prisma)
    .findCurrentDraftByProductAndOrganization({ productId, organizationId });
  assert.equal(result?.currentDraftVersion?.cn?.value, "01012100");
  assert.equal(result?.currentDraftVersion?.cn?.nomenclatureYear, 2026);
  const serialized = JSON.stringify(input);
  assert.match(serialized, /"currentDraftVersion"/);
  assert.match(serialized, /"type":"CN"/);
  assert.match(serialized, /"take":2/);
  assert.doesNotMatch(serialized, /currentPublishedVersion|userId|membershipId/);
});

test("uses exact CN and aggregate CAS predicates and server-fixed CN values", async () => {
  const calls: Array<{ operation: string; input: unknown }> = [];
  const tx = {
    product: { async updateMany(input: unknown) { calls.push({ operation: "product", input }); return { count: 1 }; } },
    productVersion: { async updateMany(input: unknown) { calls.push({ operation: "draft", input }); return { count: 1 }; } },
    productIdentifier: {
      async findFirst(input: unknown) { calls.push({ operation: "read", input }); return null; },
      async create(input: unknown) { calls.push({ operation: "create", input }); return { id: identifierId }; },
      async updateMany(input: unknown) { calls.push({ operation: "edit", input }); return { count: 1 }; },
      async deleteMany(input: unknown) { calls.push({ operation: "remove", input }); return { count: 1 }; },
    },
  };
  const subject = new PrismaCnClassificationCurrentDraftPersistence({} as PrismaClient);
  await subject.readCurrentDraftCn(tx as never, { productVersionId: draftId, identifierId });
  assert.equal(await subject.touchProductIfCurrent(tx as never, { productId, organizationId, currentDraftVersionId: draftId, expectedUpdatedAt: updatedAt, actorId }), true);
  assert.equal(await subject.touchDraftVersionIfCurrent(tx as never, { productVersionId: draftId, productId, organizationId, expectedUpdatedAt: updatedAt, actorId }), true);
  const values = { value: "01012100", nomenclatureYear: 2026, issuingAuthority: null, notes: null } as const;
  assert.deepEqual(await subject.insertCn(tx as never, { productVersionId: draftId, values }), { identifierId });
  assert.equal(await subject.updateCnIfCurrent(tx as never, { identifierId, productVersionId: draftId, expectedUpdatedAt: updatedAt, values }), true);
  assert.equal(await subject.deleteCnIfCurrent(tx as never, { identifierId, productVersionId: draftId, expectedUpdatedAt: updatedAt }), true);
  for (const operation of ["read", "edit", "remove"] as const) {
    const where = (calls.find((call) => call.operation === operation)?.input as { where: Record<string, unknown> }).where;
    assert.equal(where.productVersionId, draftId);
    assert.equal(where.type, "CN");
  }
  assert.deepEqual((calls.find((call) => call.operation === "create")?.input as { data: unknown }).data, { productVersionId: draftId, type: "CN", ...values });
  assert.deepEqual((calls.find((call) => call.operation === "edit")?.input as { data: unknown }).data, { type: "CN", ...values });
  assert.match(JSON.stringify(calls), /currentDraftVersionId/);
  assert.doesNotMatch(JSON.stringify(calls), /currentPublishedVersionId/);
});

test("maps only a Prisma unique violation during CN insert to the safe conflict sentinel", async () => {
  const unique = new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "test" });
  const tx = { productIdentifier: { async create() { throw unique; } } };
  const subject = new PrismaCnClassificationCurrentDraftPersistence({} as PrismaClient);
  await assert.rejects(
    subject.insertCn(tx as never, { productVersionId: draftId, values: { value: "01012100", nomenclatureYear: 2026, issuingAuthority: null, notes: null } }),
    CnClassificationConflictPersistenceError,
  );
});

test("writes only approved minimized PRODUCT_UPDATED metadata", async () => {
  let input: unknown;
  const tx = { auditLog: { async create(value: unknown) { input = value; return { id: "audit-id" }; } } };
  const subject = new PrismaCnClassificationCurrentDraftPersistence({} as PrismaClient);
  await subject.insertProductUpdatedAuditEvent(tx as never, {
    organizationId, actorId, productId, operation: "EDIT", changedFields: ["value", "nomenclatureYear"], correlationId: "correlation-id",
  });
  assert.deepEqual((input as { data: { metadata: unknown } }).data.metadata, {
    changedCollection: "identifiers", operation: "EDIT", identifierType: "CN", changedFields: ["value", "nomenclatureYear"],
  });
  assert.doesNotMatch(JSON.stringify(input), /01012100|2026|cccccccc|issuingAuthority|notes/);
});

test("runs CN work in exactly one business Prisma transaction", async () => {
  const token = Symbol("transaction");
  let count = 0;
  const runner = new PrismaCnClassificationCurrentDraftTransactionRunner({
    $transaction: async (work: (transaction: symbol) => Promise<string>) => { count += 1; return work(token); },
  } as unknown as PrismaClient);
  assert.equal(await runner.run(async (transaction) => { assert.strictEqual(transaction, token); return "ok"; }), "ok");
  assert.equal(count, 1);
});
