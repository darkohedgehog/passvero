import type { BillingProfile } from "@/src/application/billing/contracts";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { dashboardDenialOutcome } from "@/src/application/context/protected-dashboard-entry";
import { getBillingServices } from "@/src/infrastructure/billing/billing-runtime";
import { hasBillingPermission } from "@/src/application/permissions/billing-permissions";
import { DashboardShell } from "@/src/components/application/dashboard/dashboard-shell";
import { BillingProfileForm } from "@/src/components/application/billing/billing-profile-form";
import { getPathname } from "@/src/i18n/navigation";
import { isAppLocale } from "@/src/i18n/routing";
import { resolveProtectedDashboard } from "@/src/infrastructure/context/organization-context-runtime";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ cursor?: string | string[] }> };
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "BillingProfile" });
  return { title: t("title"), robots: { index: false, follow: false } };
}
export default async function BillingPage({ params }: Props) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const [t,d] = await Promise.all([getTranslations({locale,namespace:"BillingProfile"}),getTranslations({locale,namespace:"Dashboard"})]);
  let organizationName: string | undefined;
  let content: React.ReactNode;
  let resolution: Awaited<ReturnType<typeof resolveProtectedDashboard>> | null = null;
  try { resolution = await resolveProtectedDashboard(await headers()); } catch { /* Safe localized error below. */ }
  if (resolution?.status === "DENIED" && dashboardDenialOutcome(resolution.reason) === "LOGIN") redirect(getPathname({locale,href:"/login"}));
  if (resolution?.status === "ORGANIZATION_SELECTION_REQUIRED") redirect(getPathname({locale,href:"/dashboard"}));
  content = <div role="alert" className="rounded-xl border border-slate-200 bg-white p-6">{d(resolution?.status === "DENIED" ? "noAccessDescription" : "genericErrorDescription")}</div>;
  if (resolution?.status === "RESOLVED") {
    organizationName = resolution.presentation.organizationName;
    if (!hasBillingPermission(resolution.context,"BILLING_PROFILE_READ")) content = <p role="alert">{d("noAccessDescription")}</p>;
    else {
      let profile: BillingProfile | null | undefined;
      try { profile = await getBillingServices().get(resolution.context); }
      catch { /* Render the safe localized error; never render an empty profile on failure. */ }
      if (profile !== undefined) content = <BillingProfileForm profile={profile}/>;
    }

  }
  return <DashboardShell brandLabel={d("brand")} title={t("title")} productsLabel={t("title")} organizationLabel={d("currentOrganization")} organizationName={organizationName} signOutLabel={d("signOut")} pendingLabel={d("loading")} signOutFailureLabel={d("signOutFailure")}>{content}</DashboardShell>;
}
