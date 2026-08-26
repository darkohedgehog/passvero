import { Buffer } from "node:buffer";

import { ApplicationError } from "@/src/application/errors/application-error";
import {
  hasProductPermission,
  PRODUCT_READ,
} from "@/src/application/permissions/product-permissions";
import type { ListProducts } from "@/src/application/products/list-products/contracts";
import type {
  ListProductsPersistence,
  ProductListCursor,
  ProductListRecord,
} from "@/src/application/products/list-products/ports";

const PAGE_SIZE = 25;
const CURSOR_VERSION = 1;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export function createListProductsService(dependencies: {
  readonly persistence: ListProductsPersistence;
}): ListProducts {
  return async (query, context) => {
    if (context === null) {
      throw new ApplicationError(
        "UNAUTHENTICATED",
        "LIST_PRODUCTS_UNAUTHENTICATED",
        "Product listing requires authentication.",
        false,
      );
    }

    if (
      context.membershipStatus !== "ACTIVE"
      || !hasProductPermission(context, PRODUCT_READ)
    ) {
      throw listProductsError(
        "FORBIDDEN",
        "LIST_PRODUCTS_FORBIDDEN",
        context.correlationId,
      );
    }

    const after = decodeCursor(query.cursor, context.correlationId);

    try {
      const rows = await dependencies.persistence.listPage({
        organizationId: context.organizationId,
        after,
        take: 26,
      });

      if (rows.some((row) => row.organizationId !== context.organizationId)) {
        throw new Error("Cross-tenant product record rejected.");
      }

      const pageRows = rows.slice(0, PAGE_SIZE);
      return {
        items: pageRows.map(toProductListItem),
        nextCursor: rows.length > PAGE_SIZE
          ? encodeCursor(pageRows[PAGE_SIZE - 1]!)
          : null,
      };
    } catch {
      throw listProductsError(
        "INTERNAL",
        "LIST_PRODUCTS_INTERNAL",
        context.correlationId,
      );
    }
  };
}

function toProductListItem(record: ProductListRecord) {
  const currentVersion = record.currentDraftVersion
    ?? record.currentPublishedVersion;

  return {
    productId: record.productId,
    name: record.internalName,
    sku: record.sku,
    lifecycleStatus: record.lifecycleStatus,
    currentVersionStatus: currentVersion?.status ?? null,
    sourceLocale: currentVersion?.sourceLocale ?? null,
    updatedAt: record.updatedAt,
  };
}

function encodeCursor(record: ProductListRecord): string {
  return Buffer.from(JSON.stringify({
    v: CURSOR_VERSION,
    updatedAt: record.updatedAt.toISOString(),
    productId: record.productId,
  }), "utf8").toString("base64url");
}

function decodeCursor(
  cursor: string | null | undefined,
  correlationId: string,
): ProductListCursor | null {
  if (cursor === null || cursor === undefined) {
    return null;
  }

  try {
    if (
      cursor.length === 0
      || cursor.length > 512
      || !BASE64URL_PATTERN.test(cursor)
    ) {
      throw new Error("Invalid cursor encoding.");
    }

    const decoded = Buffer.from(cursor, "base64url");
    if (decoded.toString("base64url") !== cursor) {
      throw new Error("Non-canonical cursor encoding.");
    }

    const value: unknown = JSON.parse(decoded.toString("utf8"));
    if (!isCursorPayload(value)) {
      throw new Error("Invalid cursor payload.");
    }

    const updatedAt = new Date(value.updatedAt);
    if (
      Number.isNaN(updatedAt.getTime())
      || updatedAt.toISOString() !== value.updatedAt
    ) {
      throw new Error("Invalid cursor timestamp.");
    }

    return { productId: value.productId, updatedAt };
  } catch {
    throw listProductsError(
      "VALIDATION",
      "LIST_PRODUCTS_CURSOR_INVALID",
      correlationId,
    );
  }
}

function isCursorPayload(value: unknown): value is {
  readonly v: 1;
  readonly updatedAt: string;
  readonly productId: string;
} {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return Object.keys(payload).length === 3
    && payload.v === CURSOR_VERSION
    && typeof payload.updatedAt === "string"
    && typeof payload.productId === "string"
    && UUID_PATTERN.test(payload.productId);
}

function listProductsError(
  category: "VALIDATION" | "FORBIDDEN" | "INTERNAL",
  code: string,
  correlationId: string,
): ApplicationError {
  return new ApplicationError(
    category,
    code,
    "The product list request could not be completed.",
    false,
    correlationId,
  );
}
