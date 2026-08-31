import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { dashboardDenialOutcome } from "@/src/application/context/protected-dashboard-entry";
import { ApplicationError } from "@/src/application/errors/application-error";
import { classifyEditProductDraftPageAccess } from "@/src/application/products/edit-product-draft/edit-product-draft-http";
import { createGetProductDraftForEditService } from "@/src/application/products/edit-product-draft/get-product-draft-for-edit";
import { DashboardShell } from "@/src/components/application/dashboard/dashboard-shell";
import { EditProductDraftForm } from "@/src/components/application/products/edit-product-draft-form";
import { getPathname } from "@/src/i18n/navigation";
import { isAppLocale } from "@/src/i18n/routing";
import { resolveProtectedDashboard } from "@/src/infrastructure/context/organization-context-runtime";
import { getProductionEditProductDraftDependencies } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";

type PageProps = Readonly<{
  params: Promise<{ locale: string; productId: string }>;
}>;

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "EditProduct" });
  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
    robots: { index: false, follow: false },
  };
}

export default async function EditProductPage({ params }: PageProps) {
  const { locale, productId } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);

  const [dashboardT, productsT, editT] = await Promise.all([
    getTranslations({ locale, namespace: "Dashboard" }),
    getTranslations({ locale, namespace: "Products" }),
    getTranslations({ locale, namespace: "EditProduct" }),
  ]);

  let resolution: Awaited<ReturnType<typeof resolveProtectedDashboard>>;
  try {
    resolution = await resolveProtectedDashboard(await headers());
  } catch {
    return shell(
      dashboardT,
      productsT("productsNav"),
      editT("title"),
      <AccessMessage title={editT("failureTitle")} description={editT("failure")} />,
    );
  }

  const access = classifyEditProductDraftPageAccess(resolution);
  if (access === "LOGIN" && resolution.status === "DENIED") {
    redirect(getPathname({ locale, href: "/login" }));
  }
  if (access === "ORGANIZATION_SELECTION_REQUIRED") {
    redirect(getPathname({ locale, href: "/dashboard" }));
  }
  if (access !== "FORM" || resolution.status !== "RESOLVED") {
    const denied = resolution.status === "DENIED"
      && dashboardDenialOutcome(resolution.reason) !== "LOGIN";
    return shell(
      dashboardT,
      productsT("productsNav"),
      editT("title"),
      <AccessMessage
        title={editT("forbiddenTitle")}
        description={editT("forbidden")}
      />,
      denied ? undefined : resolution.status === "RESOLVED" ? resolution.userLabel : undefined,
      resolution.status === "RESOLVED" ? resolution.presentation.organizationName : undefined,
    );
  }

  let form;
  try {
    const loader = createGetProductDraftForEditService(
      getProductionEditProductDraftDependencies(),
    );
    form = await loader({ productId }, resolution.context);
  } catch (error) {
    if (error instanceof ApplicationError && error.category === "NOT_FOUND") notFound();
    const notEditable = error instanceof ApplicationError
      && error.category === "INVALID_STATE";
    const forbidden = error instanceof ApplicationError
      && (error.category === "FORBIDDEN" || error.category === "UNAUTHENTICATED");
    return shell(
      dashboardT,
      productsT("productsNav"),
      editT("title"),
      <AccessMessage
        title={editT(forbidden ? "forbiddenTitle" : "failureTitle")}
        description={editT(
          forbidden ? "forbidden" : notEditable ? "draftNotEditable" : "failure",
        )}
      />,
      resolution.userLabel,
      resolution.presentation.organizationName,
    );
  }

  const detailHref = getPathname({
    locale,
    href: `/dashboard/products/${form.productId}`,
  });
  return shell(
    dashboardT,
    productsT("productsNav"),
    editT("title"),
    <div className="max-w-2xl">
      <p className="mb-6 text-sm leading-6 text-slate-600">{editT("description")}</p>
      <EditProductDraftForm
        productId={form.productId}
        initialProductName={form.productName}
        initialOrganizationSku={form.organizationSku}
        sourceLocale={form.sourceLocale}
        expectedDraftVersionId={form.expectedDraftVersionId}
        expectedProductUpdatedAt={form.expectedProductUpdatedAt.toISOString()}
        expectedDraftUpdatedAt={form.expectedDraftUpdatedAt.toISOString()}
        expectedSourceTranslationUpdatedAt={form.expectedSourceTranslationUpdatedAt.toISOString()}
        detailHref={detailHref}
        labels={{
          productName: editT("productName"),
          organizationSku: editT("organizationSku"),
          optional: editT("optional"),
          sourceLocale: editT("sourceLocale"),
          save: editT("save"),
          saving: editT("saving"),
          cancel: editT("cancel"),
          reload: editT("reload"),
          required: editT("required"),
          invalidName: editT("invalidName"),
          invalidSku: editT("invalidSku"),
          skuConflict: editT("skuConflict"),
          staleWrite: editT("staleWrite"),
          draftNotEditable: editT("draftNotEditable"),
          forbidden: editT("forbidden"),
          failure: editT("failure"),
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
