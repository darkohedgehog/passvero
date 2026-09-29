import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isAppLocale } from "@/src/i18n/routing";
import { getPlatformServices } from "@/src/infrastructure/platform/platform-runtime";
import { OrganizationDetailView } from "@/src/components/application/platform/organizations-view";
export const dynamic="force-dynamic";
export const fetchCache="force-no-store";
export default async function OrganizationPage({params}:{params:Promise<{locale:string;organizationId:string}>}) {
  const {locale,organizationId}=await params;if(!isAppLocale(locale))notFound();setRequestLocale(locale);
  let organization;
  try {organization=await getPlatformServices().detail(await headers(),organizationId);} catch { /* Direct reads fail closed. */ }
  if(!organization)notFound();
  return <OrganizationDetailView organization={organization} locale={locale}/>;
}
