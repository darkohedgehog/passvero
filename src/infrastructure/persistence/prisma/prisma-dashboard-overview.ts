import { Prisma, type PrismaClient } from "@/src/generated/prisma/client";
import type { DashboardOverview, DashboardOverviewPersistence, OverviewCategory } from "@/src/application/dashboard/overview";

// Current pointers, not historical versions. Include ARCHIVED, as the unfiltered catalog does.
export class PrismaDashboardOverview implements DashboardOverviewPersistence {
  constructor(private readonly prisma: PrismaClient) {}
  async read(organizationId: string): Promise<DashboardOverview> {
    return this.prisma.$transaction(async tx => {
      const [counts] = await tx.$queryRaw<Array<{
        total: bigint; published: bigint; draft: bigint; archived: bigint;
        draftOnly: bigint; publishedOnly: bigint; publishedWithDraft: bigint; withoutVersion: bigint; invalid: bigint;
      }>>(Prisma.sql`
        SELECT COUNT(*) AS total,
          COUNT(*) FILTER (WHERE p."currentPublishedVersionId" IS NOT NULL) AS published,
          COUNT(*) FILTER (WHERE p."currentDraftVersionId" IS NOT NULL) AS draft,
          COUNT(*) FILTER (WHERE p."lifecycleStatus" = 'ARCHIVED') AS archived,
          COUNT(*) FILTER (WHERE p."currentDraftVersionId" IS NOT NULL AND p."currentPublishedVersionId" IS NULL) AS "draftOnly",
          COUNT(*) FILTER (WHERE p."currentDraftVersionId" IS NULL AND p."currentPublishedVersionId" IS NOT NULL) AS "publishedOnly",
          COUNT(*) FILTER (WHERE p."currentDraftVersionId" IS NOT NULL AND p."currentPublishedVersionId" IS NOT NULL) AS "publishedWithDraft",
          COUNT(*) FILTER (WHERE p."currentDraftVersionId" IS NULL AND p."currentPublishedVersionId" IS NULL) AS "withoutVersion",
          COUNT(*) FILTER (WHERE
            (p."currentDraftVersionId" IS NOT NULL AND (d.id IS NULL OR d.status NOT IN ('DRAFT','READY_FOR_REVIEW')))
            OR (p."currentPublishedVersionId" IS NOT NULL AND (v.id IS NULL OR v.status <> 'PUBLISHED'))
          ) AS invalid
        FROM "Product" p
        LEFT JOIN "ProductVersion" d ON d.id = p."currentDraftVersionId" AND d."productId" = p.id AND d."organizationId" = p."organizationId"
        LEFT JOIN "ProductVersion" v ON v.id = p."currentPublishedVersionId" AND v."productId" = p.id AND v."organizationId" = p."organizationId"
        WHERE p."organizationId" = ${organizationId}::uuid
      `);
      if (!counts || counts.invalid !== BigInt(0)) throw new Error("Invalid current version pointers");
      const version = { select: { organizationId: true, productId: true, images: { where: { isPrimary: true }, take: 2, orderBy: { id: "asc" as const }, select: { id: true, asset: { select: { organizationId: true } } } } } } as const;
      const rows = await tx.product.findMany({
        where: { organizationId }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 5,
        select: { id: true, organizationId: true, internalName: true, sku: true, lifecycleStatus: true, updatedAt: true,
          currentDraftVersionId: true, currentPublishedVersionId: true, currentDraftVersion: version, currentPublishedVersion: version },
      });
      return {
        organizationId, total: Number(counts.total), published: Number(counts.published), draft: Number(counts.draft), archived: Number(counts.archived),
        distribution: { draftOnly: Number(counts.draftOnly), publishedOnly: Number(counts.publishedOnly), publishedWithDraft: Number(counts.publishedWithDraft), withoutVersion: Number(counts.withoutVersion) },
        recent: rows.map(row => {
          const current = row.currentDraftVersion ?? row.currentPublishedVersion;
          if (current && (current.organizationId !== organizationId || current.productId !== row.id)) throw new Error("Version ownership mismatch");
          const image = current?.images.length === 1 ? current.images[0] : null;
          const category: OverviewCategory = row.currentDraftVersionId ? (row.currentPublishedVersionId ? "publishedWithDraft" : "draftOnly") : (row.currentPublishedVersionId ? "publishedOnly" : "withoutVersion");
          return { organizationId: row.organizationId, id: row.id, name: row.internalName, sku: row.sku,
            archived: row.lifecycleStatus === "ARCHIVED", updatedAt: row.updatedAt, category,
            imageId: image?.asset.organizationId === organizationId ? image.id : null };
        }),
      };
    }, { isolationLevel: "RepeatableRead", timeout: 10000 });
  }
}
