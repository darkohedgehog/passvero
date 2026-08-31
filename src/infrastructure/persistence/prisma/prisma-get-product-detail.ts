import type {
  GetProductDetailPersistence,
  ProductDetailVersionRecord,
} from "@/src/application/products/get-product-detail/ports";
import type { PrismaClient } from "@/src/generated/prisma/client";

const translationProjection = {
  productVersionId: true,
  locale: true,
  productName: true,
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
} as const;

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
  version: {
    readonly id: string;
    readonly productId: string;
    readonly organizationId: string;
    readonly status: ProductDetailVersionRecord["status"];
    readonly sourceLocale: string;
    readonly versionNumber: number | null;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly publishedAt: Date | null;
    readonly translations: ProductDetailVersionRecord["translations"];
  } | null,
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
  };
}
