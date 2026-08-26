import type {
  ListProductsPersistence,
  ProductListRecord,
} from "@/src/application/products/list-products/ports";
import type { PrismaClient } from "@/src/generated/prisma/client";

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
    const rows = await this.prisma.product.findMany({
      where: input.after === null
        ? { organizationId: input.organizationId }
        : {
          organizationId: input.organizationId,
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
