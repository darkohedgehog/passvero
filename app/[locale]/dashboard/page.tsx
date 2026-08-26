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
  const t = await getTranslations({ locale, namespace: "Dashboard" });

  let resolution: Awaited<ReturnType<typeof resolveProtectedDashboard>>;
  try {
    resolution = await resolveProtectedDashboard(await headers());
  } catch {
    return shell(t, <AccessMessage title={t("genericErrorTitle")} description={t("genericErrorDescription")} />);
  }

  if (
    resolution.status === "DENIED"
    && dashboardDenialOutcome(resolution.reason) === "LOGIN"
  ) {
    redirect(getPathname({ locale, href: "/login" }));
  }
  if (resolution.status === "DENIED") {
    return shell(t, <AccessMessage title={t("noAccessTitle")} description={t("noAccessDescription")} />);
  }
  if (resolution.status === "ORGANIZATION_SELECTION_REQUIRED") {
    return shell(
      t,
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

  return shell(
    t,
    <div>
      <h2 className="text-xl font-bold text-slate-950">{t("readyTitle")}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{t("readyDescription")}</p>
    </div>,
    resolution.userLabel,
    resolution.presentation.organizationName,
  );
}

function shell(
  t: Awaited<ReturnType<typeof getTranslations<"Dashboard">>>,
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
