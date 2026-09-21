import type {
  ListProductsPersistence,
  ProductListRecord,
} from "@/src/application/products/list-products/ports";
import { gtinSchema } from "@/src/application/products/gtin/validation";
import type { Prisma, PrismaClient } from "@/src/generated/prisma/client";

const productListProjection = {
  organizationId: true,
  id: true,
  internalName: true,
  sku: true,
  lifecycleStatus: true,
  currentDraftVersion: { select: { status: true, sourceLocale: true } },
  currentPublishedVersion: { select: { status: true, sourceLocale: true } },
  updatedAt: true,
} as const;

export class PrismaListProductsPersistence implements ListProductsPersistence {
  constructor(private readonly prisma: Pick<PrismaClient, "product">) {}

  async listPage(
    input: Parameters<ListProductsPersistence["listPage"]>[0],
  ): Promise<readonly ProductListRecord[]> {
    const search = input.search ?? "";
    // Prisma contains uses LIKE: escape its metacharacters for literal substring semantics.
    const literal = search.replace(/[\\%_]/g, "\\$&");
    const parsedGtin = gtinSchema.safeParse(search);
    const canonical = parsedGtin.success ? parsedGtin.data.padStart(14, "0") : null;
    const gtins = canonical ? [8, 12, 13, 14].map(length => canonical.slice(-length)).filter(value => value.padStart(14, "0") === canonical && gtinSchema.safeParse(value).success) : [];
    const matches: Prisma.ProductWhereInput[] = [
      { internalName: { contains: literal, mode: "insensitive" } },
      { sku: { contains: literal, mode: "insensitive" } },
      ...(gtins.length ? [
        { currentDraftVersion: { is: { organizationId: input.organizationId, status: { in: ["DRAFT", "READY_FOR_REVIEW"] }, identifiers: { some: { type: "GTIN", value: { in: gtins } } } } } },
        { currentPublishedVersion: { is: { organizationId: input.organizationId, status: "PUBLISHED", identifiers: { some: { type: "GTIN", value: { in: gtins } } } } } },
      ] satisfies Prisma.ProductWhereInput[] : []),
    ];
    const searchWhere = search ? { AND: [{ OR: matches }] } : {};
    const rows = await this.prisma.product.findMany({
      where: input.after === null
        ? { organizationId: input.organizationId, ...searchWhere }
        : {
          organizationId: input.organizationId,
          ...searchWhere,
          OR: [
            { updatedAt: { lt: input.after.updatedAt } },
            {
              updatedAt: input.after.updatedAt,
              id: { lt: input.after.productId },
            },
          ],
        },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: input.take,
      select: productListProjection,
    });

    return rows.map((row) => ({
      organizationId: row.organizationId,
      productId: row.id,
      internalName: row.internalName,
      sku: row.sku,
      lifecycleStatus: row.lifecycleStatus,
      currentDraftVersion: row.currentDraftVersion,
      currentPublishedVersion: row.currentPublishedVersion,
      updatedAt: row.updatedAt,
    }));
  }
}
