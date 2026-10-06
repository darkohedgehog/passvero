import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isAppLocale } from "@/src/i18n/routing";
import { getPlatformServices } from "@/src/infrastructure/platform/platform-runtime";
import { AccessRequestsView } from "@/src/components/application/platform/access-requests-view";
import { getOnboardingServices } from "@/src/infrastructure/auth/onboarding-runtime";
import { accessRequestQuerySchema } from "@/src/application/platform/service";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export default async function AccessRequestsPage({params, searchParams}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{status?: string | string[]; cursor?: string | string[]}>;
}) {
  const {locale} = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const query = accessRequestQuerySchema.safeParse(await searchParams);
  if (!query.success) notFound();
  let page;
  try { page = await getPlatformServices().accessRequests(await headers(), query.data); }
  catch { notFound(); }
  let canApprove = false;
  try { canApprove = await getOnboardingServices().canApprove(await headers()); } catch { /* Approval authority fails closed independently of read access. */ }
  return <AccessRequestsView page={page} status={query.data.status} locale={locale} canApprove={canApprove} />;
}
