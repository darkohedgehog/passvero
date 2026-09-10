import type {
  GetProductDetailPersistence,
  ProductDetailVersionRecord,
} from "@/src/application/products/get-product-detail/ports";
import type { Prisma, PrismaClient } from "@/src/generated/prisma/client";

const translationProjection = {
  productVersionId: true,
  locale: true,
  productName: true,
  shortDescription: true,
  description: true,
  technicalDescription: true,
  repairInstructions: true,
  sparePartsInformation: true,
  recyclingInstructions: true,
  disposalInstructions: true,
  packagingInformation: true,
  safetyInformation: true,
  warrantyInformation: true,
  publicNotes: true,
} as const;

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
  identifiers: {
    where: { type: "CN" },
    select: { productVersionId: true, value: true, nomenclatureYear: true },
  },
  materials: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      productVersionId: true, materialName: true, category: true,
      percentage: true, isRecycled: true, recycledPercentage: true,
    },
  },
} satisfies Prisma.ProductVersionSelect;

const productDetailProjection = {
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
} as const;

export class PrismaGetProductDetailPersistence
implements GetProductDetailPersistence {
  constructor(private readonly prisma: Pick<PrismaClient, "product">) {}

  async findByIdAndOrganization(
    input: Parameters<GetProductDetailPersistence["findByIdAndOrganization"]>[0],
  ) {
    const row = await this.prisma.product.findFirst({
      where: {
        id: input.productId,
        organizationId: input.organizationId,
      },
      select: productDetailProjection,
    });

    if (row === null) return null;

    return {
      organizationId: row.organizationId,
      productId: row.id,
      internalName: row.internalName,
      sku: row.sku,
      publicCode: row.publicCode,
      lifecycleStatus: row.lifecycleStatus,
      currentDraftVersionId: row.currentDraftVersionId,
      currentPublishedVersionId: row.currentPublishedVersionId,
      currentDraftVersion: mapVersion(row.currentDraftVersion),
      currentPublishedVersion: mapVersion(row.currentPublishedVersion),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

function mapVersion(
  version: Prisma.ProductVersionGetPayload<{ select: typeof versionProjection }> | null,
): ProductDetailVersionRecord | null {
  if (version === null) return null;
  return {
    productVersionId: version.id,
    productId: version.productId,
    organizationId: version.organizationId,
    status: version.status,
    sourceLocale: version.sourceLocale,
    versionNumber: version.versionNumber,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
    publishedAt: version.publishedAt,
    translations: version.translations,
    cnRows: version.identifiers,
    materials: version.materials.map((row) => ({
      productVersionId: row.productVersionId,
      materialName: row.materialName,
      category: row.category,
      percentage: row.percentage === null ? null : row.percentage.toFixed(2),
      isRecycled: row.isRecycled,
      recycledPercentage: row.recycledPercentage === null ? null : row.recycledPercentage.toFixed(2),
    })),
  };
}
