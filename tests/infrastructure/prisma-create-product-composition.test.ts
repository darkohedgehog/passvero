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
