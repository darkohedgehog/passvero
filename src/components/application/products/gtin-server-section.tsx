import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/src/i18n/routing";
import type { AuthenticatedUserContext } from "@/src/application/context/authenticated-user-context";
import { hasProductPermission } from "@/src/application/permissions/product-permissions";
import { getGtinServices } from "@/src/infrastructure/products/gtin-runtime";
import { gtinSchema } from "@/src/application/products/gtin/validation";
import { GtinEditor } from "./gtin-editor";
import { GtinBarcode } from "./gtin-barcode";

export async function GtinServerSection({ productId, context, locale, published }: { productId: string; context: AuthenticatedUserContext; locale: AppLocale; published: boolean }) {
  const t = await getTranslations({ locale, namespace: "Gtin" });
  let state;
  try { state = await getGtinServices().get(productId, context); }
  catch { return <p role="alert">{t("failure")}</p>; }
  if (published) return state.published ? <section className="space-y-3 rounded-xl border p-5"><h3 className="font-semibold">{t("title")} — {t("published")}</h3>
    {gtinSchema.safeParse(state.published).success ? <GtinBarcode value={state.published} label={t("barcode")} /> : <p role="alert">{t("invalid")}</p>}
    <p className="text-sm text-slate-600">{t("notice")}</p></section> : null;
  return <GtinEditor key={`${state.updatedAt}:${state.draft?.updatedAt}`} state={state} canEdit={state.lifecycleStatus === "ACTIVE" && !!state.draft && ["DRAFT", "READY_FOR_REVIEW"].includes(state.draft.status) && hasProductPermission(context, "PRODUCT_EDIT")} />;
}
