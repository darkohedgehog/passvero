import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { dashboardDenialOutcome } from "@/src/application/context/protected-dashboard-entry";
import { getCommercialServices } from "@/src/infrastructure/subscriptions/commercial-runtime";
import { DashboardShell } from "@/src/components/application/dashboard/dashboard-shell";
import { CommercialOverview } from "@/src/components/application/subscriptions/commercial-overview";
import { getPathname } from "@/src/i18n/navigation";
import { isAppLocale } from "@/src/i18n/routing";
import { resolveProtectedDashboard } from "@/src/infrastructure/context/organization-context-runtime";

type Props = { params: Promise<{ locale: string }> };
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Subscription" });
  return { title: t("title"), robots: { index: false, follow: false } };
}
export default async function SubscriptionPage({ params }: Props) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const [t, d] = await Promise.all([getTranslations({ locale, namespace: "Subscription" }), getTranslations({ locale, namespace: "Dashboard" })]);
  const requestHeaders = await headers();
  let resolution: Awaited<ReturnType<typeof resolveProtectedDashboard>> | null = null;
  try { resolution = await resolveProtectedDashboard(requestHeaders); } catch { /* Render a safe localized failure. */ }
  if (resolution?.status === "DENIED" && dashboardDenialOutcome(resolution.reason) === "LOGIN") redirect(getPathname({ locale, href: "/login" }));
  if (resolution?.status === "ORGANIZATION_SELECTION_REQUIRED") redirect(getPathname({ locale, href: "/dashboard" }));
  let state;
  if (resolution?.status === "RESOLVED") {
    try { state = await getCommercialServices().tenantState(requestHeaders); } catch { /* Reads fail closed; never invent an empty commercial state. */ }
  }
  return <DashboardShell brandLabel={d("brand")} title={t("title")} productsLabel={t("title")} organizationLabel={d("currentOrganization")} organizationName={resolution?.status === "RESOLVED" ? resolution.presentation.organizationName : undefined} signOutLabel={d("signOut")} pendingLabel={d("loading")} signOutFailureLabel={d("signOutFailure")}>
    {state ? <CommercialOverview state={state} now={new Date().toISOString()}/> : <p role="alert" className="rounded-xl border border-slate-200 bg-white p-6">{resolution?.status === "DENIED" ? d("noAccessDescription") : t("failure")}</p>}
  </DashboardShell>;
}
