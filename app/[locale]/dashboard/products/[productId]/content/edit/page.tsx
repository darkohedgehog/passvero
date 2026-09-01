import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ApplicationError } from "@/src/application/errors/application-error";
import { classifyDraftTranslationContentPageAccess } from "@/src/application/products/draft-translation-content/draft-translation-content-http";
import { createGetDraftTranslationContentForEditService } from "@/src/application/products/draft-translation-content/get-draft-translation-content-for-edit";
import { DRAFT_TRANSLATION_CONTENT_FIELDS } from "@/src/application/products/draft-translation-content/contracts";
import { DashboardShell } from "@/src/components/application/dashboard/dashboard-shell";
import { DraftTranslationContentForm } from "@/src/components/application/products/draft-translation-content-form";
import { getPathname } from "@/src/i18n/navigation";
import { isAppLocale } from "@/src/i18n/routing";
import { resolveProtectedDashboard } from "@/src/infrastructure/context/organization-context-runtime";
import { getProductionDraftTranslationContentDependencies } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";

type Props = { params: Promise<{ locale: string; productId: string }> };
export const dynamic = "force-dynamic"; export const fetchCache = "force-no-store";
export async function generateMetadata({ params }: Props): Promise<Metadata> { const { locale } = await params; if (!isAppLocale(locale)) notFound(); const t = await getTranslations({ locale, namespace: "DraftTranslationContent" }); return { title: t("metadataTitle"), description: t("metadataDescription"), robots: { index: false, follow: false } }; }
export default async function Page({ params }: Props) {
  const { locale, productId } = await params; if (!isAppLocale(locale)) notFound(); setRequestLocale(locale);
  const [dashboardT, productsT, t] = await Promise.all([getTranslations({ locale, namespace: "Dashboard" }), getTranslations({ locale, namespace: "Products" }), getTranslations({ locale, namespace: "DraftTranslationContent" })]);
  const resolution = await resolveProtectedDashboard(await headers()); const access = classifyDraftTranslationContentPageAccess(resolution);
  if (access === "LOGIN") redirect(getPathname({ locale, href: "/login" })); if (access === "ORGANIZATION_SELECTION_REQUIRED") redirect(getPathname({ locale, href: "/dashboard" }));
  const shell = (children: React.ReactNode) => <DashboardShell brandLabel={dashboardT("brand")} title={t("title")} signedInAsLabel={dashboardT("signedInAs")} userLabel={resolution.status === "RESOLVED" ? resolution.userLabel : undefined} organizationLabel={dashboardT("currentOrganization")} organizationName={resolution.status === "RESOLVED" ? resolution.presentation.organizationName : undefined} productsLabel={productsT("productsNav")} signOutLabel={dashboardT("signOut")} pendingLabel={dashboardT("loading")} signOutFailureLabel={dashboardT("signOutFailure")}>{children}</DashboardShell>;
  if (access !== "FORM" || resolution.status !== "RESOLVED") return shell(<div role="alert">{t("forbidden")}</div>);
  let data; try { data = await createGetDraftTranslationContentForEditService(getProductionDraftTranslationContentDependencies())({ productId }, resolution.context); } catch (error) { if (error instanceof ApplicationError && error.category === "NOT_FOUND") notFound(); return shell(<div role="alert">{t(error instanceof ApplicationError && error.category === "INVALID_STATE" ? "draftNotEditable" : "failure")}</div>); }
  const detailHref = getPathname({ locale, href: `/dashboard/products/${data.productId}` }); const initialValues = Object.fromEntries(DRAFT_TRANSLATION_CONTENT_FIELDS.map((field) => [field, data[field]]));
  const labels = {
    shortDescription: t("shortDescription"), description: t("description"), technicalDescription: t("technicalDescription"), repairInstructions: t("repairInstructions"), sparePartsInformation: t("sparePartsInformation"), recyclingInstructions: t("recyclingInstructions"), disposalInstructions: t("disposalInstructions"), packagingInformation: t("packagingInformation"), safetyInformation: t("safetyInformation"), sourceLocale: t("sourceLocale"), save: t("save"), saving: t("saving"), cancel: t("cancel"), reload: t("reload"), validationError: t("validationError"), staleWrite: t("staleWrite"), draftNotEditable: t("draftNotEditable"), forbidden: t("forbidden"), failure: t("failure"),
  };
  return shell(<div className="max-w-3xl"><p className="mb-6 text-sm text-slate-600">{t("descriptionText")}</p><DraftTranslationContentForm productId={data.productId} sourceLocale={data.sourceLocale} initialValues={initialValues as never} evidence={{ expectedDraftVersionId: data.expectedDraftVersionId, expectedProductUpdatedAt: data.expectedProductUpdatedAt.toISOString(), expectedDraftUpdatedAt: data.expectedDraftUpdatedAt.toISOString(), expectedSourceTranslationUpdatedAt: data.expectedSourceTranslationUpdatedAt.toISOString() }} detailHref={detailHref} labels={labels as never} /></div>);
}
