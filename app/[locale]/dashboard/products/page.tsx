import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ApplicationError } from "@/src/application/errors/application-error";
import { dashboardDenialOutcome } from "@/src/application/context/protected-dashboard-entry";
import {
  hasProductPermission,
  PRODUCT_CREATE,
} from "@/src/application/permissions/product-permissions";
import type { ListProductsResult } from "@/src/application/products/list-products/contracts";
import { createListProductsService, MAX_PRODUCT_SEARCH_LENGTH } from "@/src/application/products/list-products/list-products";
import { DashboardShell } from "@/src/components/application/dashboard/dashboard-shell";
import {
  ProductListPresentation,
  type ProductListLabels,
} from "@/src/components/application/products/product-list-presentation";
import { ProductListCreateAction } from "@/src/components/application/products/product-list-create-action";
import { getPathname } from "@/src/i18n/navigation";
import { isAppLocale } from "@/src/i18n/routing";
import { resolveProtectedDashboard } from "@/src/infrastructure/context/organization-context-runtime";
import { getProductionListProductsDependencies } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";

type PageProps = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ cursor?: string | readonly string[]; q?: string | readonly string[] }>;
}>;

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Products" });
  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
    robots: { index: false, follow: false },
  };
}

export default async function ProductsPage({ params, searchParams }: PageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
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
    return productShell(
      dashboardT,
      productsT,
      <AccessMessage
        title={productsT("errorTitle")}
        description={productsT("errorDescription")}
      />,
    );
  }

  if (
    resolution.status === "DENIED"
    && dashboardDenialOutcome(resolution.reason) === "LOGIN"
  ) {
    redirect(getPathname({ locale, href: "/login" }));
  }
  if (resolution.status === "DENIED") {
    return productShell(
      dashboardT,
      productsT,
      <AccessMessage
        title={productsT("noAccessTitle")}
        description={productsT("noAccessDescription")}
      />,
    );
  }
  if (resolution.status === "ORGANIZATION_SELECTION_REQUIRED") {
    redirect(getPathname({ locale, href: "/dashboard" }));
  }

  const cursor = typeof query.cursor === "string"
    ? query.cursor
    : query.cursor === undefined
      ? null
      : "";
  const search = typeof query.q === "string" ? query.q.trim() : query.q === undefined ? "" : "\0";
  let result: ListProductsResult;
  try {
    const listProducts = createListProductsService(
      getProductionListProductsDependencies(),
    );
    result = await listProducts({ cursor, search: typeof query.q === "string" ? query.q : search }, resolution.context);
  } catch (error) {
    const denied = error instanceof ApplicationError
      && (error.category === "FORBIDDEN" || error.category === "UNAUTHENTICATED");
    return productShell(
      dashboardT,
      productsT,
      <AccessMessage
        title={productsT(denied ? "noAccessTitle" : "errorTitle")}
        description={productsT(denied ? "noAccessDescription" : "errorDescription")}
      />,
      resolution.userLabel,
      resolution.presentation.organizationName,
    );
  }

  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const createHref = hasProductPermission(resolution.context, PRODUCT_CREATE)
    ? getPathname({ locale, href: "/dashboard/products/new" })
    : null;
  const nextPageHref = result.nextCursor === null
    ? null
    : getPathname({
      locale,
      href: {
        pathname: "/dashboard/products",
        query: { cursor: result.nextCursor, ...(search ? { q: search } : {}) },
      },
    });

  return productShell(
    dashboardT,
    productsT,
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-slate-600">
          {productsT("description")}
        </p>
        <ProductListCreateAction
          href={createHref}
          label={createT("create")}
        />
      </div>
      <form method="get" action={getPathname({ locale, href: "/dashboard/products" })} className="mb-6 space-y-2" role="search">
        <label htmlFor="product-search" className="block text-sm font-medium text-slate-900">{productsT("searchLabel")}</label>
        <p id="product-search-help" className="text-sm text-slate-600">{productsT("searchHelp")}</p>
        <div className="flex flex-wrap gap-2">
          <input id="product-search" name="q" type="search" defaultValue={search} maxLength={MAX_PRODUCT_SEARCH_LENGTH} aria-describedby="product-search-help" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2" />
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">{productsT("searchSubmit")}</button>
          {search ? <a href={getPathname({ locale, href: "/dashboard/products" })} className="rounded-lg border px-4 py-2 text-sm">{productsT("searchClear")}</a> : null}
        </div>
      </form>
      <ProductListPresentation
        items={result.items}
        formattedUpdatedAt={result.items.map((item) => dateFormatter.format(item.updatedAt))}
        detailHrefs={result.items.map((item) => getPathname({
          locale,
          href: `/dashboard/products/${item.productId}`,
        }))}
        nextPageHref={nextPageHref}
        labels={{ ...productListLabels(productsT), ...(search ? { emptyTitle: productsT("searchEmptyTitle"), emptyDescription: productsT("searchEmptyDescription") } : {}) }}
      />
    </>,
    resolution.userLabel,
    resolution.presentation.organizationName,
  );
}

function productShell(
  dashboardT: Awaited<ReturnType<typeof getTranslations<"Dashboard">>>,
  productsT: Awaited<ReturnType<typeof getTranslations<"Products">>>,
  children: React.ReactNode,
  userLabel?: string,
  organizationName?: string,
) {
  return (
    <DashboardShell
      brandLabel={dashboardT("brand")}
      title={productsT("title")}
      signedInAsLabel={dashboardT("signedInAs")}
      userLabel={userLabel}
      organizationLabel={dashboardT("currentOrganization")}
      organizationName={organizationName}
      productsLabel={productsT("productsNav")}
      signOutLabel={dashboardT("signOut")}
      pendingLabel={dashboardT("loading")}
      signOutFailureLabel={dashboardT("signOutFailure")}
    >
      {children}
    </DashboardShell>
  );
}

function productListLabels(
  t: Awaited<ReturnType<typeof getTranslations<"Products">>>,
): ProductListLabels {
  return {
    emptyTitle: t("emptyTitle"),
    emptyDescription: t("emptyDescription"),
    product: t("product"),
    sku: t("sku"),
    lifecycle: t("lifecycle"),
    version: t("version"),
    locale: t("locale"),
    updated: t("updated"),
    notAvailable: t("notAvailable"),
    nextPage: t("nextPage"),
    lifecycleStatus: {
      ACTIVE: t("lifecycleStatus.ACTIVE"),
      ARCHIVED: t("lifecycleStatus.ARCHIVED"),
    },
    versionStatus: {
      DRAFT: t("versionStatus.DRAFT"),
      READY_FOR_REVIEW: t("versionStatus.READY_FOR_REVIEW"),
      PUBLISHED: t("versionStatus.PUBLISHED"),
      SUPERSEDED: t("versionStatus.SUPERSEDED"),
      DISCARDED: t("versionStatus.DISCARDED"),
    },
  };
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
