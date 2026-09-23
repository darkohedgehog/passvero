import type { AuthenticatedUserContext } from "@/src/application/context/authenticated-user-context";
import { ApplicationError } from "@/src/application/errors/application-error";
import { hasProductPermission, PRODUCT_READ } from "@/src/application/permissions/product-permissions";

export const overviewCategories = ["draftOnly", "publishedOnly", "publishedWithDraft", "withoutVersion"] as const;
export type OverviewCategory = typeof overviewCategories[number];
export interface DashboardOverview {
  organizationId: string;
  total: number;
  published: number;
  draft: number;
  archived: number;
  distribution: Record<OverviewCategory, number>;
  recent: readonly {
    organizationId: string;
    id: string;
    name: string;
    sku: string | null;
    archived: boolean;
    category: OverviewCategory;
    updatedAt: Date;
    imageId: string | null;
  }[];
}
export interface DashboardOverviewPersistence {
  read(organizationId: string): Promise<DashboardOverview>;
}
export function createDashboardOverview(persistence: DashboardOverviewPersistence) {
  return async (context: AuthenticatedUserContext | null): Promise<DashboardOverview> => {
    if (!context || context.membershipStatus !== "ACTIVE" || !hasProductPermission(context, PRODUCT_READ)) {
      throw new ApplicationError("FORBIDDEN", "DASHBOARD_FORBIDDEN", "Dashboard access denied.", false);
    }
    try {
      const result = await persistence.read(context.organizationId);
      if (result.organizationId !== context.organizationId || result.recent.some(row => row.organizationId !== context.organizationId)) throw new Error("Tenant mismatch");
      const counts = [result.total, result.published, result.draft, result.archived, ...Object.values(result.distribution)];
      if (counts.some(n => !Number.isSafeInteger(n) || n < 0)
        || Object.values(result.distribution).reduce((a,b) => a+b, 0) !== result.total
        || result.published !== result.distribution.publishedOnly + result.distribution.publishedWithDraft
        || result.draft !== result.distribution.draftOnly + result.distribution.publishedWithDraft
        || result.archived > result.total || result.recent.length > 5) throw new Error("Invalid overview");
      return result;
    } catch {
      throw new ApplicationError("INTERNAL", "DASHBOARD_LOAD_FAILED", "Dashboard could not be loaded.", false, context.correlationId);
    }
  };
}
