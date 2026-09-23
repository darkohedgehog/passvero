import { createDashboardOverview } from "@/src/application/dashboard/overview";
import { getProductionDashboardOverviewPersistence } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";
import { hasProductPermission } from "@/src/application/permissions/product-permissions";
import { DashboardOverviewPanel } from "@/src/components/application/dashboard/dashboard-overview";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { DashboardShell } from "@/src/components/application/dashboard/dashboard-shell";
import { OrganizationSelector } from "@/src/components/application/dashboard/organization-selector";
import { dashboardDenialOutcome } from "@/src/application/context/protected-dashboard-entry";
import { getPathname } from "@/src/i18n/navigation";
import { isAppLocale } from "@/src/i18n/routing";
import { resolveProtectedDashboard } from "@/src/infrastructure/context/organization-context-runtime";

type PageProps = Readonly<{ params: Promise<{ locale: string }> }>;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Dashboard" });
  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
    robots: { index: false, follow: false },
  };
}

export default async function DashboardPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const [t, productsT] = await Promise.all([
    getTranslations({ locale, namespace: "Dashboard" }),
    getTranslations({ locale, namespace: "Products" }),
  ]);

  let resolution: Awaited<ReturnType<typeof resolveProtectedDashboard>>;
  try {
    resolution = await resolveProtectedDashboard(await headers());
  } catch {
    return shell(t, productsT("productsNav"), <AccessMessage title={t("genericErrorTitle")} description={t("genericErrorDescription")} />);
  }

  if (
    resolution.status === "DENIED"
    && dashboardDenialOutcome(resolution.reason) === "LOGIN"
  ) {
    redirect(getPathname({ locale, href: "/login" }));
  }
  if (resolution.status === "DENIED") {
    return shell(t, productsT("productsNav"), <AccessMessage title={t("noAccessTitle")} description={t("noAccessDescription")} />);
  }
  if (resolution.status === "ORGANIZATION_SELECTION_REQUIRED") {
    return shell(
      t,
      productsT("productsNav"),
      <div>
        <h2 className="text-xl font-bold text-slate-950">{t("chooseTitle")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{t("chooseDescription")}</p>
        <div className="mt-6">
          <OrganizationSelector
            organizations={resolution.organizations}
            legend={t("selectOrganizationLabel")}
            continueLabel={t("continue")}
            pendingLabel={t("loading")}
            failureLabel={t("genericFailure")}
          />
        </div>
      </div>,
      resolution.userLabel,
    );
  }

  const overviewT = await getTranslations({ locale, namespace: "DashboardOverview" });
  let overview = null;
  try { overview = await createDashboardOverview(getProductionDashboardOverviewPersistence())(resolution.context); }
  catch { /* A failed read is rendered as unavailable, never as zero. */ }
  const catalogHref = getPathname({ locale, href: "/dashboard/products" });
  return shell(t, productsT("productsNav"), <DashboardOverviewPanel
    data={overview} locale={locale} catalogHref={catalogHref}
    createHref={hasProductPermission(resolution.context, "PRODUCT_CREATE") ? getPathname({ locale, href: "/dashboard/products/new" }) : null}
    importHref={hasProductPermission(resolution.context, "PRODUCT_CREATE") && hasProductPermission(resolution.context, "PRODUCT_EDIT") ? catalogHref + "?action=import#catalog-import" : null}
    exportHref={hasProductPermission(resolution.context, "PRODUCT_READ") ? catalogHref + "#catalog-export" : null}
    labels={{
      overview: overviewT("overview"),
      products: overviewT("products"),
      navigation: overviewT("navigation"),
      menu: overviewT("menu"),
      closeMenu: overviewT("closeMenu"),
      skip: overviewT("skip"),
      total: overviewT("total"),
      published: overviewT("published"),
      draft: overviewT("draft"),
      overlap: overviewT("overlap"),
      distribution: overviewT("distribution"),
      draftOnly: overviewT("draftOnly"),
      publishedOnly: overviewT("publishedOnly"),
      publishedWithDraft: overviewT("publishedWithDraft"),
      withoutVersion: overviewT("withoutVersion"),
      scope: overviewT("scope"),
      archived: overviewT("archived"),
      recent: overviewT("recent"),
      recentHelp: overviewT("recentHelp"),
      allProducts: overviewT("allProducts"),
      newProduct: overviewT("newProduct"),
      importCsv: overviewT("importCsv"),
      exportCsv: overviewT("exportCsv"),
      quickActions: overviewT("quickActions"),
      emptyTitle: overviewT("emptyTitle"),
      emptyDescription: overviewT("emptyDescription"),
      loadError: overviewT("loadError"),
      retry: overviewT("retry"),
      updated: overviewT("updated"),
      sku: overviewT("sku"),
    }} />,
    resolution.userLabel, resolution.presentation.organizationName);

}

function shell(
  t: Awaited<ReturnType<typeof getTranslations<"Dashboard">>>,
  productsLabel: string,
  children: React.ReactNode,
  userLabel?: string,
  organizationName?: string,
) {
  return (
    <DashboardShell
      brandLabel={t("brand")}
      title={t("title")}
      signedInAsLabel={t("signedInAs")}
      userLabel={userLabel}
      organizationLabel={t("currentOrganization")}
      organizationName={organizationName}
      productsLabel={productsLabel}
      signOutLabel={t("signOut")}
      pendingLabel={t("loading")}
      signOutFailureLabel={t("signOutFailure")}
    >
      {children}
    </DashboardShell>
  );
}

function AccessMessage({ title, description }: Readonly<{ title: string; description: string }>) {
  return (
    <div role="alert" aria-live="assertive">
      <h2 className="text-xl font-bold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
