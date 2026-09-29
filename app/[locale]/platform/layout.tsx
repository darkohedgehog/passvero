import type { ReactNode } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPlatformServices } from "@/src/infrastructure/platform/platform-runtime";
import { resolveReadOnlyAuthenticatedUserContext } from "@/src/infrastructure/context/organization-context-runtime";
import { DashboardShell } from "@/src/components/application/dashboard/dashboard-shell";
import { DashboardNavigation } from "@/src/components/application/dashboard/dashboard-navigation";
import { isAppLocale } from "@/src/i18n/routing";
export const dynamic="force-dynamic";
export const fetchCache="force-no-store";
export const metadata: Metadata = {title:"Platform Admin",robots:{index:false,follow:false}};
export default async function PlatformLayout({children,params}:{children:ReactNode;params:Promise<{locale:string}>}) {
  const {locale}=await params;
  if (!isAppLocale(locale)) notFound();
  const requestHeaders=await headers();
  let allowed=false;
  try {await getPlatformServices().requireAccess(requestHeaders);allowed=true;} catch { /* Fail closed, without disclosing organization data. */ }
  if (!allowed) notFound();
  let canReturn=false;
  try {const context=await resolveReadOnlyAuthenticatedUserContext(requestHeaders);canReturn=context.status==="RESOLVED" || context.status==="ORGANIZATION_SELECTION_REQUIRED";} catch { /* Tenant workspace availability is independent of platform authority. */ }
  const [t,d]=await Promise.all([getTranslations({locale,namespace:"PlatformAdmin"}),getTranslations({locale,namespace:"Dashboard"})]);
  return <div className="min-h-screen bg-slate-50 lg:pl-64">
    <DashboardNavigation canReadProducts={false} platform canReturn={canReturn} />
    <DashboardShell brandLabel={d("brand")} contextLabel={t("title")} title={t("organizations")} productsLabel={t("organizations")} signOutLabel={d("signOut")} pendingLabel={d("loading")} signOutFailureLabel={d("signOutFailure")}>
      {children}
    </DashboardShell>
  </div>;
}
