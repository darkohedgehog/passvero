import assert from "node:assert/strict";
import test from "node:test";

import type { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaListProductsPersistence } from "../../src/infrastructure/persistence/prisma/prisma-list-products";
import { createPrismaListProductsDependencies } from "../../src/infrastructure/persistence/prisma/prisma-list-products-composition";

test("composes list persistence without invoking Prisma", () => {
  let queryCalls = 0;
  const prisma = {
    product: {
      findMany: () => {
        queryCalls += 1;
        throw new Error("must not query during composition");
      },
    },
  } as unknown as PrismaClient;

  const dependencies = createPrismaListProductsDependencies(prisma);

  assert.ok(dependencies.persistence instanceof PrismaListProductsPersistence);
  assert.equal(queryCalls, 0);
});
