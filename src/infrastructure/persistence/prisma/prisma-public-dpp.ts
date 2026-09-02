import type { PublicDppPersistence } from "@/src/application/public-dpp/ports";
import { PUBLIC_DPP_LOCALES } from "@/src/application/public-dpp/contracts";
import type { PrismaClient } from "@/src/generated/prisma/client";

const translationSelect = {
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

export class PrismaPublicDppPersistence implements PublicDppPersistence {
  constructor(private readonly prisma: Pick<PrismaClient, "product" | "productVersion">) {}

  async readAuthorityByPublicCode(publicCode: string) {
    const product = await this.prisma.product.findUnique({
      where: { publicCode },
      select: {
        id: true,
        organizationId: true,
        lifecycleStatus: true,
        currentPublishedVersionId: true,
        lastPublishedAt: true,
        organization: { select: { id: true, status: true, displayName: true } },
        passport: {
          select: {
            productId: true,
            organizationId: true,
            status: true,
            defaultLocale: true,
            firstPublishedAt: true,
            lastPublishedAt: true,
            publicWithdrawalMessage: true,
          },
        },
      },
    });
    if (product === null) return null;
    return {
      productLifecycleStatus: product.lifecycleStatus,
      organizationStatus: product.organization.status,
      organizationDisplayName: product.organization.displayName,
      hasCurrentPublishedVersion: product.currentPublishedVersionId !== null,
      productLastPublishedAt: product.lastPublishedAt,
      passport: product.passport === null ? null : {
        ownershipConsistent: product.organization.id === product.organizationId
          && product.passport.productId === product.id
          && product.passport.organizationId === product.organizationId,
        status: product.passport.status,
        defaultLocale: product.passport.defaultLocale,
        firstPublishedAt: product.passport.firstPublishedAt,
        lastPublishedAt: product.passport.lastPublishedAt,
        publicWithdrawalMessage: product.passport.publicWithdrawalMessage,
      },
    };
  }

  async readCurrentPublishedContentByPublicCode(publicCode: string) {
    const version = await this.prisma.productVersion.findFirst({
      where: {
        status: "PUBLISHED",
        currentPublishedForProduct: { is: { publicCode } },
      },
      select: {
        id: true,
        productId: true,
        organizationId: true,
        versionNumber: true,
        publishedAt: true,
        sourceLocale: true,
        product: { select: { id: true, organizationId: true } },
        currentPublishedForProduct: {
          select: { id: true, organizationId: true, currentPublishedVersionId: true },
        },
        translations: {
          where: { locale: { in: [...PUBLIC_DPP_LOCALES] } },
          select: translationSelect,
        },
        materials: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            materialName: true,
            category: true,
            percentage: true,
            isRecycled: true,
            recycledPercentage: true,
          },
        },
        identifiers: {
          where: { type: "CN" },
          take: 2,
          select: { value: true, nomenclatureYear: true },
        },
      },
    });
    if (version === null) return null;
    const currentProduct = version.currentPublishedForProduct;
    return {
      ownershipConsistent: currentProduct !== null
        && version.product.id === version.productId
        && version.product.organizationId === version.organizationId
        && currentProduct.id === version.productId
        && currentProduct.organizationId === version.organizationId
        && currentProduct.currentPublishedVersionId === version.id,
      versionNumber: version.versionNumber,
      publishedAt: version.publishedAt,
      sourceLocale: version.sourceLocale,
      translations: version.translations,
      materials: version.materials.map((material) => ({
        materialName: material.materialName,
        category: material.category,
        percentage: decimalString(material.percentage),
        isRecycled: material.isRecycled,
        recycledPercentage: decimalString(material.recycledPercentage),
      })),
      cnRows: version.identifiers,
    };
  }
}

function decimalString(value: { toFixed(decimalPlaces: number): string } | null): string | null {
  return value === null ? null : value.toFixed(2);
}
