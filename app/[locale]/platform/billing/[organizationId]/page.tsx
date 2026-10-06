import { paymentAllowed } from "@/src/application/subscriptions/service";
import { getCanonicalAppOrigin } from "@/src/infrastructure/config/canonical-app-origin";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { isAppLocale } from "@/src/i18n/routing";
import { editorSecondaryAction } from "@/src/components/application/products/product-editor-ui";
import { ReviewIcon } from "@/src/components/application/platform/review-ui";
import { Link } from "@/src/i18n/navigation";
import { getCommercialServices } from "@/src/infrastructure/subscriptions/commercial-runtime";
import { CommercialOverview } from "@/src/components/application/subscriptions/commercial-overview";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export default async function CommercialOrganizationPage({ params }: { params: Promise<{ locale: string; organizationId: string }> }) {
  const { locale, organizationId } = await params;
  if (!isAppLocale(locale)) notFound(); setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Subscription" });
  let state;
  try { state = await getCommercialServices().operatorState(await headers(), organizationId); } catch { /* Fail closed on direct reads. */ }
  if (!state) notFound();
  return <div className="space-y-6"><Link href="/platform/billing" className={editorSecondaryAction}><ReviewIcon name="back"/>{t("back")}</Link><h1 className="text-2xl font-bold text-slate-950 [overflow-wrap:anywhere]">{t("operatorTitle")} · {state.organizationName}</h1><CommercialOverview state={state} now={new Date().toISOString()} operator allowSimulation={paymentAllowed("SIMULATED_PAYMENT", getCanonicalAppOrigin(), process.env.PASSVERO_RUNTIME_ENV)}/></div>;
}
