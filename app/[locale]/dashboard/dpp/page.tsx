import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { dashboardDenialOutcome } from "@/src/application/context/protected-dashboard-entry";
import { createListDpp } from "@/src/application/dashboard/list-dpp";
import { DashboardShell } from "@/src/components/application/dashboard/dashboard-shell";
import { DppList } from "@/src/components/application/dashboard/dpp-list";
import { getPathname } from "@/src/i18n/navigation";
import { isAppLocale } from "@/src/i18n/routing";
import { resolveProtectedDashboard } from "@/src/infrastructure/context/organization-context-runtime";
import { getProductionPrismaClient } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";
import { PrismaListDpp } from "@/src/infrastructure/persistence/prisma/prisma-list-dpp";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ cursor?: string | string[] }> };
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "DppList" });
  return { title: t("title"), robots: { index: false, follow: false } };
}
export default async function DppPage({ params, searchParams }: Props) {
  const [{ locale }, query] = await Promise.all([params,searchParams]);
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const [t,d] = await Promise.all([getTranslations({locale,namespace:"DppList"}),getTranslations({locale,namespace:"Dashboard"})]);
  let organizationName: string | undefined;
  let content: React.ReactNode;
  let resolution: Awaited<ReturnType<typeof resolveProtectedDashboard>> | null = null;
  try { resolution = await resolveProtectedDashboard(await headers()); } catch { /* Safe localized error below. */ }
  if (resolution?.status === "DENIED" && dashboardDenialOutcome(resolution.reason) === "LOGIN") redirect(getPathname({locale,href:"/login"}));
  if (resolution?.status === "ORGANIZATION_SELECTION_REQUIRED") redirect(getPathname({locale,href:"/dashboard"}));
  content = <div role="alert" className="rounded-xl border border-slate-200 bg-white p-6">{d(resolution?.status === "DENIED" ? "noAccessDescription" : "genericErrorDescription")}</div>;
  if (resolution?.status === "RESOLVED") {
    organizationName = resolution.presentation.organizationName;
    let result: Awaited<ReturnType<ReturnType<typeof createListDpp>>> | null = null;
    try {
      result = await createListDpp(new PrismaListDpp(getProductionPrismaClient()))(typeof query.cursor === "string" ? query.cursor : query.cursor === undefined ? null : "",locale,resolution.context);
    } catch { /* No partial rows or zero-state on failure. */ }
    if (result) content = <DppList items={result.items} nextHref={result.nextCursor ? getPathname({locale,href:{pathname:"/dashboard/dpp",query:{cursor:result.nextCursor}}}) : null}
        labels={{title:t("title"),description:t("description"),emptyTitle:t("emptyTitle"),emptyDescription:t("emptyDescription"),version:t("version"),open:t("open"),notPublic:t("notPublic"),archived:t("archived"),unavailable:t("unavailable"),nextPage:t("nextPage")}} />;
  }
  return <DashboardShell brandLabel={d("brand")} title={t("title")} productsLabel="DPP" organizationLabel={d("currentOrganization")} organizationName={organizationName} signOutLabel={d("signOut")} pendingLabel={d("loading")} signOutFailureLabel={d("signOutFailure")}>{content}</DashboardShell>;
}
