import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { dashboardDenialOutcome } from "@/src/application/context/protected-dashboard-entry";
import { ApplicationError } from "@/src/application/errors/application-error";
import { canShowEditProductDraftAction } from "@/src/application/products/edit-product-draft/edit-product-draft-http";
import { createGetProductDetailService } from "@/src/application/products/get-product-detail/get-product-detail";
import { DashboardShell } from "@/src/components/application/dashboard/dashboard-shell";
import {
  ProductDetailPresentation,
  type ProductDetailLabels,
} from "@/src/components/application/products/product-detail-presentation";
import { getPathname } from "@/src/i18n/navigation";
import { isAppLocale } from "@/src/i18n/routing";
import { resolveProtectedDashboard } from "@/src/infrastructure/context/organization-context-runtime";
import { getProductionGetProductDetailDependencies } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";

type PageProps = Readonly<{
  params: Promise<{ locale: string; productId: string }>;
}>;

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "ProductDetail" });
  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
    robots: { index: false, follow: false },
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { locale, productId } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);

  const [dashboardT, productsT, detailT, editT, contentT] = await Promise.all([
    getTranslations({ locale, namespace: "Dashboard" }),
    getTranslations({ locale, namespace: "Products" }),
    getTranslations({ locale, namespace: "ProductDetail" }),
    getTranslations({ locale, namespace: "EditProduct" }),
    getTranslations({ locale, namespace: "DraftTranslationContent" }),
  ]);

  let resolution: Awaited<ReturnType<typeof resolveProtectedDashboard>>;
  try {
    resolution = await resolveProtectedDashboard(await headers());
  } catch {
    return detailShell(
      dashboardT,
      productsT("productsNav"),
      detailT("title"),
      <AccessMessage title={detailT("errorTitle")} description={detailT("errorDescription")} />,
    );
  }

  if (
    resolution.status === "DENIED"
    && dashboardDenialOutcome(resolution.reason) === "LOGIN"
  ) {
    redirect(getPathname({ locale, href: "/login" }));
  }
  if (resolution.status === "DENIED") {
    return detailShell(
      dashboardT,
      productsT("productsNav"),
      detailT("title"),
      <AccessMessage title={detailT("noAccessTitle")} description={detailT("noAccessDescription")} />,
    );
  }
  if (resolution.status === "ORGANIZATION_SELECTION_REQUIRED") {
    redirect(getPathname({ locale, href: "/dashboard" }));
  }

  let detail;
  try {
    const getProductDetail = createGetProductDetailService(
      getProductionGetProductDetailDependencies(),
    );
    detail = await getProductDetail({ productId }, resolution.context);
  } catch (error) {
    if (error instanceof ApplicationError && error.category === "NOT_FOUND") {
      notFound();
    }
    const denied = error instanceof ApplicationError
      && (error.category === "FORBIDDEN" || error.category === "UNAUTHENTICATED");
    return detailShell(
      dashboardT,
      productsT("productsNav"),
      detailT("title"),
      <AccessMessage
        title={detailT(denied ? "noAccessTitle" : "errorTitle")}
        description={detailT(denied ? "noAccessDescription" : "errorDescription")}
      />,
      resolution.userLabel,
      resolution.presentation.organizationName,
    );
  }

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const productListHref = getPathname({ locale, href: "/dashboard/products" });
  const editHref = canShowEditProductDraftAction(
    resolution.context,
    detail.lifecycleStatus,
    detail.currentDraft?.status ?? null,
  )
    ? getPathname({
        locale,
        href: `/dashboard/products/${detail.productId}/edit`,
      })
    : null;
  const contentEditHref = editHref === null ? null : getPathname({ locale, href: `/dashboard/products/${detail.productId}/content/edit` });

  return detailShell(
    dashboardT,
    productsT("productsNav"),
    detailT("title"),
    <ProductDetailPresentation
      detail={detail}
      productListHref={productListHref}
      editHref={editHref}
      editLabel={editT("title")}
      contentEditHref={contentEditHref}
      contentEditLabel={contentT("editAction")}
      formattedDates={{
        productCreatedAt: dateFormatter.format(detail.createdAt),
        productUpdatedAt: dateFormatter.format(detail.updatedAt),
        draftCreatedAt: detail.currentDraft === null
          ? null
          : dateFormatter.format(detail.currentDraft.createdAt),
        draftUpdatedAt: detail.currentDraft === null
          ? null
          : dateFormatter.format(detail.currentDraft.updatedAt),
        publishedAt: detail.currentPublished?.publishedAt === null
          || detail.currentPublished === null
          ? null
          : dateFormatter.format(detail.currentPublished.publishedAt),
      }}
      labels={productDetailLabels(detailT)}
    />,
    resolution.userLabel,
    resolution.presentation.organizationName,
  );
}

function productDetailLabels(
  t: Awaited<ReturnType<typeof getTranslations<"ProductDetail">>>,
): ProductDetailLabels {
  return {
    backToProducts: t("backToProducts"),
    overview: t("overview"),
    lifecycle: t("lifecycle"),
    identityTitle: t("identityTitle"),
    internalName: t("internalName"),
    organizationSku: t("organizationSku"),
    publicCode: t("publicCode"),
    publicCodeHint: t("publicCodeHint"),
    created: t("created"),
    updated: t("updated"),
    draftTitle: t("draftTitle"),
    publishedTitle: t("publishedTitle"),
    status: t("status"),
    sourceLocale: t("sourceLocale"),
    sourceProductName: t("sourceProductName"),
    versionNumber: t("versionNumber"),
    publishedAt: t("publishedAt"),
    draftEmpty: t("draftEmpty"),
    publishedEmpty: t("publishedEmpty"),
    notAvailable: t("notAvailable"),
    lifecycleStatus: {
      ACTIVE: t("lifecycleStatus.ACTIVE"),
      ARCHIVED: t("lifecycleStatus.ARCHIVED"),
    },
    versionStatus: {
      DRAFT: t("versionStatus.DRAFT"),
      READY_FOR_REVIEW: t("versionStatus.READY_FOR_REVIEW"),
      PUBLISHED: t("versionStatus.PUBLISHED"),
    },
  };
}

function detailShell(
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
