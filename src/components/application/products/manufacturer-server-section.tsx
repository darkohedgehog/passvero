import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/src/i18n/routing";
import type { AuthenticatedUserContext } from "@/src/application/context/authenticated-user-context";
import { hasProductPermission } from "@/src/application/permissions/product-permissions";
import { getManufacturerServices } from "@/src/infrastructure/products/manufacturer-runtime";
import { ManufacturerEditor, ManufacturerPreview } from "./manufacturer-editor";
export async function ManufacturerServerSection({ productId, context, locale, published }: { productId: string; context: AuthenticatedUserContext; locale: AppLocale; published: boolean }) {
  const t = await getTranslations({locale, namespace:"Manufacturer"});
  let state;
  try { state = await getManufacturerServices().get(productId, context); }
  catch { return <p role="alert">{t("failure")}</p>; }
    if (published) return state.published ? <section className="rounded-xl border p-5"><h3 className="font-semibold">{t("title")} — {t("published")}</h3><ManufacturerPreview value={state.published} empty={t("empty")} /></section> : null;
    return <ManufacturerEditor key={`${state.updatedAt}:${state.draft?.updatedAt ?? "published"}`} state={state} canEdit={state.lifecycleStatus==="ACTIVE" && hasProductPermission(context,"PRODUCT_EDIT")} />;

}
