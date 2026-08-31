import assert from "node:assert/strict";
import test from "node:test";

import type { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaGetProductDetailPersistence } from "../../src/infrastructure/persistence/prisma/prisma-get-product-detail";
import { createPrismaGetProductDetailDependencies } from "../../src/infrastructure/persistence/prisma/prisma-get-product-detail-composition";

test("composes product-detail persistence without invoking Prisma", () => {
  let queryCalls = 0;
  const prisma = {
    product: {
      findFirst: () => {
        queryCalls += 1;
        throw new Error("must not query during composition");
      },
    },
  } as unknown as PrismaClient;

  const dependencies = createPrismaGetProductDetailDependencies(prisma);

  assert.ok(dependencies.persistence instanceof PrismaGetProductDetailPersistence);
  assert.equal(queryCalls, 0);
});
