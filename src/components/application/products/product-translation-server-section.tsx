import { getTranslations } from "next-intl/server";
import type { AuthenticatedUserContext } from "@/src/application/context/authenticated-user-context";
import { hasProductPermission, PRODUCT_EDIT } from "@/src/application/permissions/product-permissions";
import { getTranslationManagementServices } from "@/src/infrastructure/products/translation-management-runtime";
import { getPublicDppLabels } from "@/src/components/public-dpp/public-dpp-labels";
import { TRANSLATION_TEXT_FIELDS } from "@/src/application/products/translation-management/content";
import { ProductTranslationManager, type TranslationLabels } from "./product-translation-manager";
import type { AppLocale } from "@/src/i18n/routing";

export async function ProductTranslationServerSection({productId,versionId,productUpdatedAt,draftUpdatedAt,context,locale,published,baseEditHref}:Readonly<{
  productId:string;versionId:string;productUpdatedAt:string;draftUpdatedAt?:string;context:AuthenticatedUserContext;locale:AppLocale;published:boolean;baseEditHref:string;
}>) {
  const t=await getTranslations({locale,namespace:"ProductTranslations"});
  const publicLabels=getPublicDppLabels(locale);
  const labels:TranslationLabels={title:t("title"),source:t("source"),missing:t("missing"),incomplete:t("incomplete"),ready:t("ready"),published:t("published"),add:t("add"),save:t("save"),remove:t("remove"),confirmRemove:t("confirmRemove"),discard:t("discard"),pending:t("pending"),failure:t("failure"),conflict:t("conflict"),validation:t("validation"),reload:t("reload"),sourceName:t("sourceName"),empty:t("empty"),readOnly:t("readOnly"),privateDraft:t("privateDraft"),productName:t("productName"),languages:publicLabels.languageNames,fields:Object.fromEntries(TRANSLATION_TEXT_FIELDS.map(field=>[field,publicLabels[field]])) as TranslationLabels["fields"]};
  let state;
  try { state=await getTranslationManagementServices().get(productId,context); }
  catch { return <p role="alert">{labels.failure}</p>; }
    const version=published?state.published:state.draft;
    if (!version || version.productVersionId!==versionId || state.updatedAt.toISOString()!==productUpdatedAt || (!published && version.updatedAt.toISOString()!==draftUpdatedAt)) return <p role="alert">{labels.conflict}</p>;
    return <ProductTranslationManager data={{productId,sourceLocale:version.sourceLocale,published,
      canEdit:!published && state.lifecycleStatus==="ACTIVE" && hasProductPermission(context,PRODUCT_EDIT),
      translations:version.translations.map(row=>({...row,updatedAt:row.updatedAt.toISOString()})),
      evidence:{expectedDraftVersionId:versionId,expectedProductUpdatedAt:productUpdatedAt,expectedDraftUpdatedAt:version.updatedAt.toISOString()},
    }} labels={labels} baseEditHref={baseEditHref} />;
}
