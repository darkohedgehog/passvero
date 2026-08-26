import assert from "node:assert/strict";
import test from "node:test";

import type { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaListProductsPersistence } from "../../src/infrastructure/persistence/prisma/prisma-list-products";

const organizationId = "11111111-1111-4111-8111-111111111111";
const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const updatedAt = new Date("2026-08-26T10:00:00.000Z");

function harness() {
  const calls: unknown[] = [];
  const prisma = {
    product: {
      async findMany(input: unknown) {
        calls.push(input);
        return [{
          organizationId,
          id: productId,
          internalName: "Industrial Chair",
          sku: "CHAIR-1",
          lifecycleStatus: "ACTIVE" as const,
          currentDraftVersion: {
            status: "READY_FOR_REVIEW" as const,
            sourceLocale: "hr",
          },
          currentPublishedVersion: {
            status: "PUBLISHED" as const,
            sourceLocale: "en",
          },
          updatedAt,
        }];
      },
    },
  } as unknown as PrismaClient;
  const persistence = new PrismaListProductsPersistence(prisma);
  return { calls, persistence };
}

const projection = {
  organizationId: true,
  id: true,
  internalName: true,
  sku: true,
  lifecycleStatus: true,
  currentDraftVersion: { select: { status: true, sourceLocale: true } },
  currentPublishedVersion: { select: { status: true, sourceLocale: true } },
  updatedAt: true,
};

test("always scopes the first page to one trusted organization with fixed ordering and size", async () => {
  const fixture = harness();

  const rows = await fixture.persistence.listPage({
    organizationId,
    after: null,
    take: 26,
  });

  assert.deepEqual(fixture.calls, [{
    where: { organizationId },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 26,
    select: projection,
  }]);
  assert.deepEqual(rows, [{
    organizationId,
    productId,
    internalName: "Industrial Chair",
    sku: "CHAIR-1",
    lifecycleStatus: "ACTIVE",
    currentDraftVersion: {
      status: "READY_FOR_REVIEW",
      sourceLocale: "hr",
    },
    currentPublishedVersion: {
      status: "PUBLISHED",
      sourceLocale: "en",
    },
    updatedAt,
  }]);
});

test("uses the updatedAt and id cursor without weakening organization scope", async () => {
  const fixture = harness();

  await fixture.persistence.listPage({
    organizationId,
    after: { productId, updatedAt },
    take: 26,
  });

  assert.deepEqual(fixture.calls, [{
    where: {
      organizationId,
      OR: [
        { updatedAt: { lt: updatedAt } },
        { updatedAt, id: { lt: productId } },
      ],
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 26,
    select: projection,
  }]);
});
