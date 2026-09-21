import { gtinSchema } from "@/src/application/products/gtin/validation";
import type { Prisma } from "@/src/generated/prisma/client";

export function productCatalogSearchWhere(organizationId: string, searchInput?: string): Prisma.ProductWhereInput {
  const search = searchInput ?? "";
  // Prisma contains uses LIKE: escape its metacharacters for literal substring semantics.
  const literal = search.replace(/[\\%_]/g, "\\$&");
  const parsedGtin = gtinSchema.safeParse(search);
  const canonical = parsedGtin.success ? parsedGtin.data.padStart(14, "0") : null;
  const gtins = canonical ? [8, 12, 13, 14].map(length => canonical.slice(-length)).filter(value => value.padStart(14, "0") === canonical && gtinSchema.safeParse(value).success) : [];
  const matches: Prisma.ProductWhereInput[] = [
    { internalName: { contains: literal, mode: "insensitive" } },
    { sku: { contains: literal, mode: "insensitive" } },
    ...(gtins.length ? [
      { currentDraftVersion: { is: { organizationId: organizationId, status: { in: ["DRAFT", "READY_FOR_REVIEW"] }, identifiers: { some: { type: "GTIN", value: { in: gtins } } } } } },
      { currentPublishedVersion: { is: { organizationId: organizationId, status: "PUBLISHED", identifiers: { some: { type: "GTIN", value: { in: gtins } } } } } },
    ] satisfies Prisma.ProductWhereInput[] : []),
  ];
  const searchWhere = search ? { AND: [{ OR: matches }] } : {};
  return { organizationId, ...searchWhere };
}
