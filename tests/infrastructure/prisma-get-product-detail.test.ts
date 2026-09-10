import assert from "node:assert/strict";
import test from "node:test";

import type { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaGetProductDetailPersistence } from "../../src/infrastructure/persistence/prisma/prisma-get-product-detail";

const organizationId = "11111111-1111-4111-8111-111111111111";
const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const draftId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const publishedId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const translationProjection = {
  productVersionId: true,
  locale: true,
  productName: true,
  shortDescription: true, description: true, technicalDescription: true, repairInstructions: true,
  sparePartsInformation: true, recyclingInstructions: true, disposalInstructions: true,
  packagingInformation: true, safetyInformation: true, warrantyInformation: true, publicNotes: true,
};

const versionProjection = {
  id: true,
  productId: true,
  organizationId: true,
  status: true,
  sourceLocale: true,
  versionNumber: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
  translations: { select: translationProjection },
  identifiers: { where: { type: "CN" }, select: { productVersionId: true, value: true, nomenclatureYear: true } },
  materials: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { productVersionId: true, materialName: true, category: true, percentage: true, isRecycled: true, recycledPercentage: true } },
};

const productProjection = {
  organizationId: true,
  id: true,
  internalName: true,
  sku: true,
  publicCode: true,
  lifecycleStatus: true,
  currentDraftVersionId: true,
  currentPublishedVersionId: true,
  currentDraftVersion: { select: versionProjection },
  currentPublishedVersion: { select: versionProjection },
  createdAt: true,
  updatedAt: true,
};

test("queries one product by productId and trusted organization without version heuristics", async () => {
  const calls: unknown[] = [];
  const createdAt = new Date("2026-08-20T09:00:00.000Z");
  const updatedAt = new Date("2026-08-30T11:00:00.000Z");
  const draftCreatedAt = new Date("2026-08-30T10:00:00.000Z");
  const publishedAt = new Date("2026-08-20T12:00:00.000Z");
  const prisma = {
    product: {
      async findFirst(input: unknown) {
        calls.push(input);
        return {
          organizationId,
          id: productId,
          internalName: "Industrial chair",
          sku: "CHAIR-1",
          publicCode: "AbCdEfGhIjKlMnOpQrStUv",
          lifecycleStatus: "ACTIVE" as const,
          currentDraftVersionId: draftId,
          currentPublishedVersionId: publishedId,
          currentDraftVersion: {
            id: draftId,
            productId,
            organizationId,
            status: "DRAFT" as const,
            sourceLocale: "hr",
            versionNumber: null,
            createdAt: draftCreatedAt,
            updatedAt,
            publishedAt: null,
            identifiers: [], materials: [],
            translations: [{
              productVersionId: draftId,
              locale: "hr",
              productName: "Industrijska stolica",
            }],
          },
          currentPublishedVersion: {
            id: publishedId,
            productId,
            organizationId,
            status: "PUBLISHED" as const,
            sourceLocale: "en",
            versionNumber: 1,
            createdAt,
            updatedAt: publishedAt,
            publishedAt,
            identifiers: [], materials: [],
            translations: [{
              productVersionId: publishedId,
              locale: "en",
              productName: "Industrial chair",
            }],
          },
          createdAt,
          updatedAt,
        };
      },
    },
  } as unknown as PrismaClient;
  const persistence = new PrismaGetProductDetailPersistence(prisma);

  const result = await persistence.findByIdAndOrganization({ productId, organizationId });

  assert.deepEqual(calls, [{
    where: { id: productId, organizationId },
    select: productProjection,
  }]);
  assert.deepEqual(result, {
    organizationId,
    productId,
    internalName: "Industrial chair",
    sku: "CHAIR-1",
    publicCode: "AbCdEfGhIjKlMnOpQrStUv",
    lifecycleStatus: "ACTIVE",
    currentDraftVersionId: draftId,
    currentPublishedVersionId: publishedId,
    currentDraftVersion: {
      productVersionId: draftId,
      productId,
      organizationId,
      status: "DRAFT",
      sourceLocale: "hr",
      versionNumber: null,
      createdAt: draftCreatedAt,
      updatedAt,
      publishedAt: null,
      cnRows: [], materials: [],
      translations: [{
        productVersionId: draftId,
        locale: "hr",
        productName: "Industrijska stolica",
      }],
    },
    currentPublishedVersion: {
      productVersionId: publishedId,
      productId,
      organizationId,
      status: "PUBLISHED",
      sourceLocale: "en",
      versionNumber: 1,
      createdAt,
      updatedAt: publishedAt,
      publishedAt,
      cnRows: [], materials: [],
      translations: [{
        productVersionId: publishedId,
        locale: "en",
        productName: "Industrial chair",
      }],
    },
    createdAt,
    updatedAt,
  });
  assert.equal("orderBy" in (calls[0] as Record<string, unknown>), false);
});

test("preserves a missing tenant-scoped product as null", async () => {
  const prisma = {
    product: { async findFirst() { return null; } },
  } as unknown as PrismaClient;
  const persistence = new PrismaGetProductDetailPersistence(prisma);

  assert.equal(
    await persistence.findByIdAndOrganization({ productId, organizationId }),
    null,
  );
});


test("reads published-only child ownership and decimal values without selecting private metadata", async () => {
  let query: unknown;
  const prisma = { product: { findFirst: async (input: unknown) => {
    query = input;
    return {
      id: productId, organizationId, internalName: "Chair", sku: null, publicCode: "AbCdEfGhIjKlMnOpQrStUv", lifecycleStatus: "ACTIVE",
      currentDraftVersionId: null, currentDraftVersion: null, currentPublishedVersionId: publishedId,
      createdAt: new Date(), updatedAt: new Date(),
      currentPublishedVersion: { id: publishedId, productId, organizationId, status: "PUBLISHED", sourceLocale: "hr", versionNumber: 1, createdAt: new Date(), updatedAt: new Date(), publishedAt: new Date(),
        translations: [{ productVersionId: publishedId, locale: "hr", productName: "Stolica", description: "Published description" }],
        identifiers: [{ productVersionId: publishedId, value: "01012100", nomenclatureYear: 2026 }],
        materials: [{ productVersionId: publishedId, materialName: "Wood", category: null, percentage: { toFixed: () => "75.50" }, isRecycled: true, recycledPercentage: { toFixed: () => "20.00" } }],
      },
    };
  } } } as unknown as PrismaClient;
  const result = await new PrismaGetProductDetailPersistence(prisma).findByIdAndOrganization({ productId, organizationId });
  assert.equal(result?.currentDraftVersion, null);
  assert.equal(result?.currentPublishedVersion?.translations[0].description, "Published description");
  assert.deepEqual(result?.currentPublishedVersion?.cnRows, [{ productVersionId: publishedId, value: "01012100", nomenclatureYear: 2026 }]);
  assert.deepEqual(result?.currentPublishedVersion?.materials, [{ productVersionId: publishedId, materialName: "Wood", category: null, percentage: "75.50", isRecycled: true, recycledPercentage: "20.00" }]);
  assert.doesNotMatch(JSON.stringify(query), /"supplier"|"notes"|storage|createdBy|images|documents/i);
});
