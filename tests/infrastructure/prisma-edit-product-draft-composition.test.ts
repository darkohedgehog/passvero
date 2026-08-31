import assert from "node:assert/strict";
import test from "node:test";

import type { PrismaClient } from "../../src/generated/prisma/client";
import {
  PrismaEditProductDraftPersistence,
  PrismaEditProductDraftTransactionRunner,
} from "../../src/infrastructure/persistence/prisma/prisma-edit-product-draft";
import { createPrismaEditProductDraftDependencies } from "../../src/infrastructure/persistence/prisma/prisma-edit-product-draft-composition";

test("composes the purpose-specific loader and mutation boundaries without invoking Prisma", () => {
  let transactionCalls = 0;
  const prisma = {
    $transaction: () => {
      transactionCalls += 1;
      throw new Error("must not execute during composition");
    },
  } as unknown as PrismaClient;

  const dependencies = createPrismaEditProductDraftDependencies(prisma);

  assert.ok(dependencies.persistence instanceof PrismaEditProductDraftPersistence);
  assert.ok(dependencies.transactionRunner instanceof PrismaEditProductDraftTransactionRunner);
  assert.equal(transactionCalls, 0);
});
