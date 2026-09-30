import { getCommercialServices } from "@/src/infrastructure/subscriptions/commercial-runtime";
import { getPlatformServices } from "@/src/infrastructure/platform/platform-runtime";
import { hasBillingPermission } from "@/src/application/permissions/billing-permissions";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { hasProductPermission, PRODUCT_READ } from "@/src/application/permissions/product-permissions";
import { resolveProtectedDashboard } from "@/src/infrastructure/context/organization-context-runtime";
import { DashboardNavigation } from "@/src/components/application/dashboard/dashboard-navigation";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Pages still resolve and authorize their own reads; the layout only decides navigation visibility.
  let canReadProducts = false;
  let canReadPlatform = false;
  let canManageCommercial = false;
  try { await getCommercialServices().requireBillingAccess(await headers()); canManageCommercial = true; } catch { /* Billing authority is a separate grant. */ }
  try { await getPlatformServices().requireAccess(await headers()); canReadPlatform = true; } catch { /* Platform grant is independent of tenant roles. */ }
  let canReadBilling = false;
  try {
    const result = await resolveProtectedDashboard(await headers());
    canReadBilling = result.status === "RESOLVED" && hasBillingPermission(result.context,"BILLING_PROFILE_READ");
    canReadProducts = result.status === "RESOLVED" && result.context.membershipStatus === "ACTIVE" && hasProductPermission(result.context, PRODUCT_READ);
  } catch { /* The page renders its existing safe access error. */ }
  return <div className="min-h-screen bg-slate-50 lg:pl-64">
    <DashboardNavigation canReadProducts={canReadProducts} canReadBilling={canReadBilling} canReadPlatform={canReadPlatform} canManageCommercial={canManageCommercial} />
    {children}
  </div>;
}
