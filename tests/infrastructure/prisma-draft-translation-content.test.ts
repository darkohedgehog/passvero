import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaDraftTranslationContentPersistence, PrismaDraftTranslationContentTransactionRunner } from "../../src/infrastructure/persistence/prisma/prisma-draft-translation-content";

const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", organizationId = "11111111-1111-4111-8111-111111111111", draftId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", actorId = "22222222-2222-4222-8222-222222222222";
const updatedAt = new Date("2026-09-01T10:00:00.000Z");
test("uses exact tenant pointer and CAS predicates without product name SKU or published writes", async () => {
  const calls: unknown[] = [];
  const tx = { product: { async updateMany(input: unknown) { calls.push(input); return { count: 1 }; } }, productVersion: { async updateMany(input: unknown) { calls.push(input); return { count: 1 }; } }, productTranslation: { async updateMany(input: unknown) { calls.push(input); return { count: 1 }; } } };
  const persistence = new PrismaDraftTranslationContentPersistence({} as PrismaClient);
  assert.equal(await persistence.touchProductIfCurrent(tx as never, { productId, organizationId, currentDraftVersionId: draftId, expectedUpdatedAt: updatedAt, actorId }), true);
  assert.equal(await persistence.touchDraftVersionIfCurrent(tx as never, { productVersionId: draftId, productId, organizationId, expectedUpdatedAt: updatedAt, actorId }), true);
  const values = { shortDescription: null, description: "Opis", technicalDescription: null, repairInstructions: null, sparePartsInformation: null, recyclingInstructions: null, disposalInstructions: null, packagingInformation: null, safetyInformation: null };
  assert.equal(await persistence.updateSourceTranslationIfCurrent(tx as never, { productVersionId: draftId, locale: "hr", expectedUpdatedAt: updatedAt, values }), true);
  const source = JSON.stringify(calls);
  assert.doesNotMatch(source, /internalName|sku|currentPublished|productName|warrantyInformation|publicNotes/);
  assert.match(source, /currentDraftVersionId/);
  assert.deepEqual((calls[2] as { where: unknown }).where, { productVersionId: draftId, locale: "hr", updatedAt });
});

test("runs work in exactly one business Prisma transaction", async () => {
  const token = Symbol("tx"); let count = 0;
  const runner = new PrismaDraftTranslationContentTransactionRunner({ $transaction: async (work: (tx: symbol) => Promise<string>) => { count += 1; return work(token); } } as unknown as PrismaClient);
  assert.equal(await runner.run(async (tx) => { assert.strictEqual(tx, token); return "ok"; }), "ok");
  assert.equal(count, 1);
});
