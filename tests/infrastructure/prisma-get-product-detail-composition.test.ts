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

  const dependencies = createPrismaGetProductDetailDependencies(prisma, "https://catalog.example");

  assert.ok(dependencies.persistence instanceof PrismaGetProductDetailPersistence);
  assert.equal(queryCalls, 0);
});

test("detail composition uses real public eligibility for active withdrawn archived and absent Passports", async () => {
  const { createGetProductDetailService } = await import("../../src/application/products/get-product-detail/get-product-detail");
  const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const organizationId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const versionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const at = new Date("2026-09-01T10:00:00.000Z");
  const translation = { productVersionId: versionId, locale: "hr", productName: "Stolica", shortDescription: null, description: "Published content", technicalDescription: null, repairInstructions: null, sparePartsInformation: null, recyclingInstructions: null, disposalInstructions: null, packagingInformation: null, safetyInformation: null, warrantyInformation: null, publicNotes: null };
  const version = { id: versionId, productId, organizationId, status: "PUBLISHED", sourceLocale: "hr", versionNumber: 1, createdAt: at, updatedAt: at, publishedAt: at, translations: [translation], identifiers: [], materials: [], productDocuments: [] };
  for (const [passportStatus, lifecycleStatus, expected] of [
    ["ACTIVE", "ACTIVE", "PUBLIC"], ["WITHDRAWN", "ACTIVE", "WITHDRAWN"],
    ["ARCHIVED", "ACTIVE", "NOT_PUBLIC"], [null, "ACTIVE", "NOT_PUBLIC"],
    ["ACTIVE", "ARCHIVED", "NOT_PUBLIC"], ["WITHDRAWN", "ARCHIVED", "NOT_PUBLIC"],
  ] as const) {
    const row = {
      id: productId, organizationId, lifecycleStatus, internalName: "Chair", sku: null,
      publicCode: "AbCdEfGhIjKlMnOpQrStUv", currentDraftVersionId: null, currentDraftVersion: null,
      currentPublishedVersionId: versionId, currentPublishedVersion: version,
      createdAt: at, updatedAt: at, lastPublishedAt: at,
      organization: { id: organizationId, status: "ACTIVE", displayName: "Company" },
      passport: passportStatus === null ? null : { productId, organizationId, status: passportStatus, defaultLocale: "hr", firstPublishedAt: at, lastPublishedAt: at, publicWithdrawalMessage: null },
    };
    const prisma = {
      product: {
        findFirst: async (input: { where: { id: string; organizationId: string } }) => {
          assert.deepEqual(input.where, { id: productId, organizationId });
          return row;
        },
        findUnique: async (input: { where: { publicCode: string } }) => {
          assert.deepEqual(input.where, { publicCode: row.publicCode });
          return row;
        },
      },
      productVersion: { findFirst: async () => ({ ...version, product: { id: productId, organizationId }, currentPublishedForProduct: { id: productId, organizationId, currentPublishedVersionId: versionId } }) },
    } as unknown as PrismaClient;
    const service = createGetProductDetailService(createPrismaGetProductDetailDependencies(prisma, "https://catalog.example"));
    const result = await service({ productId }, { userId: "actor", organizationId, membershipId: "member", membershipRole: "VIEWER", membershipStatus: "ACTIVE", permissions: ["PRODUCT_READ"], correlationId: "detail-composition" });
    assert.equal(result.publicAvailability.status, expected, `${lifecycleStatus}/${passportStatus}`);
    assert.equal(result.currentPublished?.content.description, "Published content");
    if (result.publicAvailability.status === "PUBLIC") {
      assert.equal(result.publicAvailability.url, "https://catalog.example/p/AbCdEfGhIjKlMnOpQrStUv");
    } else {
      assert.equal("url" in result.publicAvailability, false);
    }
  }
});
