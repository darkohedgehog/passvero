import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { isAppLocale } from "@/src/i18n/routing";
import { getPlatformServices } from "@/src/infrastructure/platform/platform-runtime";
import { OrganizationsView } from "@/src/components/application/platform/organizations-view";
export const dynamic="force-dynamic";
export const fetchCache="force-no-store";
export default async function OrganizationsPage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{q?:string|string[];cursor?:string|string[]}>}) {
  const {locale}=await params;if(!isAppLocale(locale))notFound();setRequestLocale(locale);
  const query=await searchParams;
  let result;
  try {result=await getPlatformServices().list(await headers(),{q:query.q,cursor:query.cursor});} catch { /* Safe translated error for denied, invalid and failed reads. */ }
  if(!result){const t=await getTranslations({locale,namespace:"Dashboard"});return <p role="alert">{t("genericErrorDescription")}</p>;}
  return <OrganizationsView page={result} q={typeof query.q==="string"?query.q.trim():""} locale={locale}/>;
}
