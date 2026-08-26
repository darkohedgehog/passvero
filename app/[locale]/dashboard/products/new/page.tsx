import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { classifyCreateProductPageAccess } from "@/src/application/products/create-product/create-product-http";
import { CreateProductForm } from "@/src/components/application/products/create-product-form";
import { DashboardShell } from "@/src/components/application/dashboard/dashboard-shell";
import { PASSVERO_LOCALES } from "@/src/domain/values/passvero-locale";
import { getPathname } from "@/src/i18n/navigation";
import { isAppLocale } from "@/src/i18n/routing";
import { resolveProtectedDashboard } from "@/src/infrastructure/context/organization-context-runtime";

type PageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "CreateProduct" });
  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
    robots: { index: false, follow: false },
  };
}

export default async function CreateProductPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);

  const [dashboardT, productsT, createT] = await Promise.all([
    getTranslations({ locale, namespace: "Dashboard" }),
    getTranslations({ locale, namespace: "Products" }),
    getTranslations({ locale, namespace: "CreateProduct" }),
  ]);

  let resolution: Awaited<ReturnType<typeof resolveProtectedDashboard>>;
  try {
    resolution = await resolveProtectedDashboard(await headers());
  } catch {
    return shell(
      dashboardT,
      productsT("productsNav"),
      createT("title"),
      <AccessMessage
        title={createT("failureTitle")}
        description={createT("failure")}
      />,
    );
  }

  const access = classifyCreateProductPageAccess(resolution);
  if (access === "LOGIN") {
    redirect(getPathname({ locale, href: "/login" }));
  }
  if (access === "ORGANIZATION_SELECTION_REQUIRED") {
    redirect(getPathname({ locale, href: "/dashboard" }));
  }
  if (access !== "FORM" || resolution.status !== "RESOLVED") {
    return shell(
      dashboardT,
      productsT("productsNav"),
      createT("title"),
      <AccessMessage
        title={createT("forbiddenTitle")}
        description={createT("forbidden")}
      />,
      resolution.status === "RESOLVED" ? resolution.userLabel : undefined,
      resolution.status === "RESOLVED"
        ? resolution.presentation.organizationName
        : undefined,
    );
  }

  const productListHref = getPathname({ locale, href: "/dashboard/products" });

  return shell(
    dashboardT,
    productsT("productsNav"),
    createT("title"),
    <div className="max-w-2xl">
      <p className="mb-6 text-sm leading-6 text-slate-600">
        {createT("description")}
      </p>
      <CreateProductForm
        initialLocale={locale}
        locales={PASSVERO_LOCALES}
        localeLabels={{
          hr: createT("locales.hr"),
          sr: createT("locales.sr"),
          en: createT("locales.en"),
          de: createT("locales.de"),
          sl: createT("locales.sl"),
          pl: createT("locales.pl"),
        }}
        successHref={productListHref}
        cancelHref={productListHref}
        labels={{
          productName: createT("productName"),
          sku: createT("sku"),
          skuOptional: createT("skuOptional"),
          initialLocale: createT("initialLocale"),
          create: createT("create"),
          creating: createT("creating"),
          cancel: createT("cancel"),
          required: createT("required"),
          invalidName: createT("invalidName"),
          invalidSku: createT("invalidSku"),
          invalidLocale: createT("invalidLocale"),
          skuConflict: createT("skuConflict"),
          forbidden: createT("forbidden"),
          failure: createT("failure"),
        }}
      />
    </div>,
    resolution.userLabel,
    resolution.presentation.organizationName,
  );
}

function shell(
  dashboardT: Awaited<ReturnType<typeof getTranslations<"Dashboard">>>,
  productsLabel: string,
  title: string,
  children: React.ReactNode,
  userLabel?: string,
  organizationName?: string,
) {
  return (
    <DashboardShell
      brandLabel={dashboardT("brand")}
      title={title}
      signedInAsLabel={dashboardT("signedInAs")}
      userLabel={userLabel}
      organizationLabel={dashboardT("currentOrganization")}
      organizationName={organizationName}
      productsLabel={productsLabel}
      signOutLabel={dashboardT("signOut")}
      pendingLabel={dashboardT("loading")}
      signOutFailureLabel={dashboardT("signOutFailure")}
    >
      {children}
    </DashboardShell>
  );
}

function AccessMessage({ title, description }: Readonly<{
  title: string;
  description: string;
}>) {
  return (
    <div role="alert" aria-live="assertive">
      <h2 className="text-xl font-bold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
