import assert from "node:assert/strict";
import test from "node:test";

import type { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPublicDppPersistence } from "../../src/infrastructure/persistence/prisma/prisma-public-dpp";

const publicCode = "AbCdEfGhIjKlMnOpQrStUv";
const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const organizationId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const versionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const passportId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const firstPublishedAt = new Date("2026-08-20T10:00:00.000Z");
const publishedAt = new Date("2026-09-02T10:00:00.000Z");

test("authority read begins at exact publicCode and contains join identities inside infrastructure", async () => {
  let input: unknown;
  const prisma = {
    product: {
      async findUnique(value: unknown) {
        input = value;
        return {
          id: productId,
          organizationId,
          lifecycleStatus: "ACTIVE",
          currentPublishedVersionId: versionId,
          lastPublishedAt: publishedAt,
          organization: { id: organizationId, status: "ACTIVE", displayName: "Example Organization" },
          passport: {
            id: passportId,
            productId,
            organizationId,
            status: "ACTIVE",
            defaultLocale: "hr",
            firstPublishedAt,
            lastPublishedAt: publishedAt,
            publicWithdrawalMessage: null,
          },
        };
      },
    },
  } as unknown as PrismaClient;

  const result = await new PrismaPublicDppPersistence(prisma).readAuthorityByPublicCode(publicCode);
  assert.deepEqual(result, {
    productLifecycleStatus: "ACTIVE",
    organizationStatus: "ACTIVE",
    organizationDisplayName: "Example Organization",
    hasCurrentPublishedVersion: true,
    productLastPublishedAt: publishedAt,
    passport: {
      ownershipConsistent: true,
      status: "ACTIVE",
      defaultLocale: "hr",
      firstPublishedAt,
      lastPublishedAt: publishedAt,
      publicWithdrawalMessage: null,
    },
  });
  assert.deepEqual((input as { where: unknown }).where, { publicCode });
  const serializedInput = JSON.stringify(input);
  assert.doesNotMatch(serializedInput, /currentDraftVersion|versions|QRCode|qrCode|documents|images|Membership|User/);
  assert.doesNotMatch(JSON.stringify(result), /aaaaaaaa|bbbbbbbb|cccccccc|dddddddd|currentPublishedVersionId/);
});

test("content read targets only the pointed PUBLISHED version and maps the exact public children", async () => {
  let input: unknown;
  const prisma = {
    productVersion: {
      async findFirst(value: unknown) {
        input = value;
        return {
          id: versionId,
          productId,
          organizationId,
          versionNumber: 2,
          publishedAt,
          sourceLocale: "hr",
          product: { id: productId, organizationId },
          currentPublishedForProduct: { id: productId, organizationId, currentPublishedVersionId: versionId },
          translations: [{
            locale: "hr",
            productName: "Javna stolica",
            shortDescription: null,
            description: "Opis",
            technicalDescription: null,
            repairInstructions: null,
            sparePartsInformation: null,
            recyclingInstructions: null,
            disposalInstructions: null,
            packagingInformation: null,
            safetyInformation: null,
            warrantyInformation: null,
            publicNotes: null,
          }],
          materials: [{
            id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            materialName: "Steel",
            category: "Metal",
            percentage: { toFixed: () => "0.00" },
            isRecycled: false,
            recycledPercentage: null,
          }],
          identifiers: [{ value: "01012100", nomenclatureYear: 2026 }],
        };
      },
    },
  } as unknown as PrismaClient;

  const result = await new PrismaPublicDppPersistence(prisma).readCurrentPublishedContentByPublicCode(publicCode);
  assert.deepEqual(result, {
    ownershipConsistent: true,
    versionNumber: 2,
    publishedAt,
    sourceLocale: "hr",
    translations: [{
      locale: "hr",
      productName: "Javna stolica",
      shortDescription: null,
      description: "Opis",
      technicalDescription: null,
      repairInstructions: null,
      sparePartsInformation: null,
      recyclingInstructions: null,
      disposalInstructions: null,
      packagingInformation: null,
      safetyInformation: null,
      warrantyInformation: null,
      publicNotes: null,
    }],
    materials: [{ materialName: "Steel", category: "Metal", percentage: "0.00", isRecycled: false, recycledPercentage: null }],
    cnRows: [{ value: "01012100", nomenclatureYear: 2026 }],
  });

  const query = input as {
    where: unknown;
    select: {
      materials: { orderBy: unknown; select: unknown };
      identifiers: { where: unknown; take: number; select: unknown };
    };
  };
  assert.deepEqual(query.where, {
    status: "PUBLISHED",
    currentPublishedForProduct: { is: { publicCode } },
  });
  assert.deepEqual(query.select.materials.orderBy, [{ createdAt: "asc" }, { id: "asc" }]);
  assert.deepEqual(query.select.identifiers.where, { type: "CN" });
  assert.equal(query.select.identifiers.take, 2);
  const serializedInput = JSON.stringify(input);
  assert.doesNotMatch(serializedInput, /currentDraftVersion|versions|supplier|notes|ProductDocument|ProductImage|QRCode|AuditLog|createdBy|updatedBy|publishedBy/);
  assert.doesNotMatch(JSON.stringify(result), /aaaaaaaa|bbbbbbbb|cccccccc|eeeeeeee|productVersionId|identifierId/);
});

test("content read reports cross-product or cross-organization pointer corruption without leaking IDs", async () => {
  const prisma = {
    productVersion: {
      async findFirst() {
        return {
          id: versionId,
          productId,
          organizationId,
          versionNumber: 1,
          publishedAt,
          sourceLocale: "hr",
          product: { id: productId, organizationId },
          currentPublishedForProduct: {
            id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
            organizationId,
            currentPublishedVersionId: versionId,
          },
          translations: [],
          materials: [],
          identifiers: [],
        };
      },
    },
  } as unknown as PrismaClient;
  const result = await new PrismaPublicDppPersistence(prisma).readCurrentPublishedContentByPublicCode(publicCode);
  assert.equal(result?.ownershipConsistent, false);
  assert.doesNotMatch(JSON.stringify(result), /aaaaaaaa|bbbbbbbb|cccccccc|ffffffff/);
});

test("selects only the current PUBLISHED version when SUPERSEDED and different DRAFT content coexist", async () => {
  const currentPublishedVersionId = "11111111-1111-4111-8111-111111111111";
  const versions = [
    {
      id: "22222222-2222-4222-8222-222222222222",
      productId,
      organizationId,
      status: "SUPERSEDED",
      versionNumber: 1,
      publishedAt: new Date("2026-08-20T10:00:00.000Z"),
      sourceLocale: "hr",
      product: { id: productId, organizationId },
      currentPublishedForProduct: null,
      translations: [publishedTranslation("Stari SUPERSEDED sadržaj")],
      materials: [],
      identifiers: [],
    },
    {
      id: currentPublishedVersionId,
      productId,
      organizationId,
      status: "PUBLISHED",
      versionNumber: 2,
      publishedAt,
      sourceLocale: "hr",
      product: { id: productId, organizationId },
      currentPublishedForProduct: {
        id: productId,
        organizationId,
        currentPublishedVersionId,
        publicCode,
      },
      translations: [publishedTranslation("Trenutačni PUBLISHED sadržaj")],
      materials: [],
      identifiers: [],
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      productId,
      organizationId,
      status: "DRAFT",
      versionNumber: null,
      publishedAt: null,
      sourceLocale: "hr",
      product: { id: productId, organizationId },
      currentPublishedForProduct: null,
      translations: [publishedTranslation("Različiti DRAFT sadržaj")],
      materials: [],
      identifiers: [],
    },
  ];
  const prisma = {
    productVersion: {
      async findFirst(input: unknown) {
        const where = (input as {
          where: { status?: string; currentPublishedForProduct?: { is?: { publicCode?: string } } };
        }).where;
        return versions.find((version) =>
          version.status === where.status
          && version.currentPublishedForProduct?.publicCode === where.currentPublishedForProduct?.is?.publicCode,
        ) ?? null;
      },
    },
  } as unknown as PrismaClient;

  const result = await new PrismaPublicDppPersistence(prisma).readCurrentPublishedContentByPublicCode(publicCode);
  assert.equal(result?.versionNumber, 2);
  assert.equal(result?.translations[0]?.productName, "Trenutačni PUBLISHED sadržaj");
  assert.doesNotMatch(JSON.stringify(result), /Stari SUPERSEDED sadržaj|Različiti DRAFT sadržaj/);
});

function publishedTranslation(productName: string) {
  return {
    locale: "hr",
    productName,
    shortDescription: null,
    description: null,
    technicalDescription: null,
    repairInstructions: null,
    sparePartsInformation: null,
    recyclingInstructions: null,
    disposalInstructions: null,
    packagingInformation: null,
    safetyInformation: null,
    warrantyInformation: null,
    publicNotes: null,
  };
}
