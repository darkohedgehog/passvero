import "server-only";

import { getTranslations } from "next-intl/server";
import type { AuthenticatedUserContext } from "@/src/application/context/authenticated-user-context";
import type { ProductQrProjection } from "@/src/application/products/qr/contracts";
import type { AppLocale } from "@/src/i18n/routing";
import { getProductQrRuntime } from "@/src/infrastructure/products/qr-runtime";
import { ProductQrSection, type ProductQrLabels } from "./product-qr-section";

export async function ProductQrServerSection({ productId, context, locale }: Readonly<{
  productId: string; context: AuthenticatedUserContext; locale: AppLocale;
}>) {
  const t = await getTranslations({ locale, namespace: "ProductQr" });
  const labels: ProductQrLabels = {
    title: t("title"), pending: t("pending"), active: t("active"), revoked: t("revoked"),
    activate: t("activate"), confirm: t("confirm"), activating: t("activating"), success: t("success"),
    stale: t("stale"), forbidden: t("forbidden"), unavailable: t("unavailable"), previewAlt: t("previewAlt"),
    downloadSvg: t("downloadSvg"), downloadPng: t("downloadPng"), publicationRequired: t("publicationRequired"),
    noLongerAvailable: t("noLongerAvailable"), helper: t("helper"), reload: t("reload"),
  };
  let data: ProductQrProjection | null = null;
  try { data = await getProductQrRuntime().services.get({ productId }, context); } catch { /* Safe QR-local failure leaves the Product workspace usable. */ }
  return <ProductQrSection productId={productId} data={data} labels={labels} />;
}
