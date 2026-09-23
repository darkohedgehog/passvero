import { z } from "zod";
import type { AuthenticatedUserContext } from "../context/authenticated-user-context";
import { ApplicationError } from "../errors/application-error";
import { hasProductPermission } from "../permissions/product-permissions";
import type { AppLocale } from "@/src/i18n/routing";

export interface DppListRow {
  readonly organizationId: string;
  readonly productId: string;
  readonly name: string | null;
  readonly sku: string | null;
  readonly versionNumber: number | null;
  readonly imageId: string | null;
  readonly archived: boolean;
  readonly publicHref: string | null;
}
export interface DppListPersistence {
  listPage(input: { organizationId: string; after: string | null; take: number; locale: AppLocale }): Promise<readonly DppListRow[]>;
}
export function createListDpp(persistence: DppListPersistence) {
  return async (cursor: string | null, locale: AppLocale, context: AuthenticatedUserContext | null) => {
    if (!context || context.membershipStatus !== "ACTIVE" || !hasProductPermission(context, "PRODUCT_READ")) {
      throw new ApplicationError("FORBIDDEN", "DPP_LIST_FORBIDDEN", "DPP access denied.", false);
    }
    const parsed = z.uuid().nullable().safeParse(cursor);
    if (!parsed.success) throw new ApplicationError("VALIDATION", "DPP_CURSOR_INVALID", "Invalid page.", false);
    try {
      const rows = await persistence.listPage({ organizationId: context.organizationId, after: parsed.data, take: 26, locale });
      if (rows.length > 26 || rows.some(row => row.organizationId !== context.organizationId)) throw new Error("Invalid page");
      return { items: rows.slice(0,25), nextCursor: rows.length > 25 ? rows[24].productId : null };
    } catch {
      throw new ApplicationError("INTERNAL", "DPP_LIST_FAILED", "DPP list unavailable.", false);
    }
  };
}
