import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/src/i18n/routing";
import type { AuthenticatedUserContext } from "@/src/application/context/authenticated-user-context";
import { hasProductPermission } from "@/src/application/permissions/product-permissions";
import { getImageServices } from "@/src/infrastructure/products/images/runtime";
import { ProductImageEditor } from "./image-editor";
export async function ProductImageServerSection({ productId, context, locale, published }: { productId: string; context: AuthenticatedUserContext; locale: AppLocale; published: boolean }) {
  const t = await getTranslations({ locale, namespace: "ProductImage" });
  let state;
  try {
    state = await getImageServices().get(productId, context);
  } catch { return <p role="alert">{t("failure")}</p>; }
  return <ProductImageEditor key={`${state.updatedAt}:${state.draft?.updatedAt}`} state={state} published={published} canEdit={state.editable && hasProductPermission(context, "PRODUCT_EDIT")} />;
}
