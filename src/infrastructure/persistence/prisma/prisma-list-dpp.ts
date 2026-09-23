import type { PrismaClient } from "@/src/generated/prisma/client";
import type { DppListPersistence } from "@/src/application/dashboard/list-dpp";
import { createGetPublicDppService } from "@/src/application/public-dpp/get-public-dpp";
import { resolvePublicDppLocale, isPublicDppLocale } from "@/src/application/public-dpp/locale";
import { manufacturerSelect } from "@/src/application/products/manufacturer/contracts";

/** One bounded, tenant-scoped page. Never read the draft relation or filter in the browser. */
export class PrismaListDpp implements DppListPersistence {
  constructor(private readonly prisma: Pick<PrismaClient,"product">) {}
  async listPage(input: Parameters<DppListPersistence["listPage"]>[0]) {
    const rows = await this.prisma.product.findMany({
      where: { organizationId: input.organizationId, currentPublishedVersionId: { not: null },
        ...(input.after ? { id: { lt: input.after } } : {}) },
      orderBy: { id: "desc" }, take: input.take,
      select: { id: true, organizationId: true, sku: true, publicCode: true, lifecycleStatus: true,
        currentPublishedVersionId: true, lastPublishedAt: true,
        organization: { select: { id: true, status: true, displayName: true } },
        passport: { select: { organizationId: true, productId: true, status: true, defaultLocale: true, firstPublishedAt: true, lastPublishedAt: true, publicWithdrawalMessage: true } },
        currentPublishedVersion: { select: { id: true, productId: true, organizationId: true, status: true, sourceLocale: true, versionNumber: true, publishedAt: true,
          translations: true, manufacturer: { select: manufacturerSelect },
          identifiers: { where: { type: { in: ["CN","GTIN"] } }, select: { type: true, value: true, nomenclatureYear: true } },
          materials: { select: { materialName: true, category: true, percentage: true, isRecycled: true, recycledPercentage: true } },
          images: { where: { isPrimary: true }, take: 2, select: { id: true, asset: { select: { organizationId: true, state: true, policyVersion: true } } } },
        } },
      },
    });
    return Promise.all(rows.map(async row => {
      const version = row.currentPublishedVersion;
      if (!version || version.status !== "PUBLISHED" || version.id !== row.currentPublishedVersionId
        || version.productId !== row.id || version.organizationId !== input.organizationId
        || row.organization.id !== input.organizationId) throw new Error("Invalid published pointer");
      const passport = row.passport;
      const authority = {
        productLifecycleStatus: row.lifecycleStatus, organizationStatus: row.organization.status,
        organizationDisplayName: row.organization.displayName, hasCurrentPublishedVersion: true,
        productLastPublishedAt: row.lastPublishedAt,
        passport: passport ? { ...passport, ownershipConsistent: passport.productId === row.id && passport.organizationId === row.organizationId } : null,
      };
      const content = {
        ownershipConsistent: true, versionNumber: version.versionNumber, publishedAt: version.publishedAt,
        sourceLocale: version.sourceLocale, translations: version.translations, manufacturer: version.manufacturer,
        materials: version.materials.map(m => ({ ...m, percentage: m.percentage?.toFixed(2) ?? null, recycledPercentage: m.recycledPercentage?.toFixed(2) ?? null })),
        cnRows: version.identifiers.filter(i => i.type === "CN").map(i => ({ value: i.value, nomenclatureYear: i.nomenclatureYear })),
        gtinRows: version.identifiers.filter(i => i.type === "GTIN").map(i => ({ value: i.value })),
      };
      // Reuse the public service's complete availability checks without additional DB reads.
      const result = await createGetPublicDppService({ persistence: {
        async readAuthorityByPublicCode() { return authority; },
        async readCurrentPublishedContentByPublicCode() { return content; },
      } })({ publicCode: row.publicCode, requestedLocale: input.locale, acceptLanguage: null });
      const locale = resolvePublicDppLocale(input.locale,null,version.translations.map(t => t.locale).filter(isPublicDppLocale),passport?.defaultLocale ?? null,version.sourceLocale);
      const name = version.translations.find(t => t.locale === locale)?.productName.trim() || null;
      const image = version.images.length === 1 ? version.images[0] : null;
      return { organizationId: row.organizationId, productId: row.id, name, sku: row.sku,
        versionNumber: version.versionNumber, archived: row.lifecycleStatus === "ARCHIVED",
        imageId: image?.asset.organizationId === input.organizationId && image.asset.state === "READY" && image.asset.policyVersion === 1 ? image.id : null,
        publicHref: result.kind === "PUBLIC" ? `/p/${row.publicCode}?lang=${result.dpp.locale}` : null,
      };
    }));
  }
}
