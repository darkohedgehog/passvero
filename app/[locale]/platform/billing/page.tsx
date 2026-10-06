import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCommercialServices } from "@/src/infrastructure/subscriptions/commercial-runtime";
import { isAppLocale } from "@/src/i18n/routing";
import { CommercialRequestsView } from "@/src/components/application/subscriptions/commercial-requests-view";
import { editorSecondaryAction } from "@/src/components/application/products/product-editor-ui";
import { ReviewIcon } from "@/src/components/application/platform/review-ui";
import { Link } from "@/src/i18n/navigation";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params; if (!isAppLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Subscription" });
  return { title: t("operatorTitle"), robots: { index: false, follow: false } };
}
export default async function CommercialRequestsPage({ params }: Props) {
  const { locale } = await params; if (!isAppLocale(locale)) notFound(); setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Subscription" });
  const requestHeaders = await headers();
  try { await getCommercialServices().requireBillingAccess(requestHeaders); } catch { notFound(); }
  let requests;
  try { requests = await getCommercialServices().listRequests(requestHeaders); } catch { /* Keep operational failure distinct from an empty list. */ }
  const reminders = await getTranslations({ locale, namespace: "SubscriptionReminders" });
  return <section className="space-y-5"><h1 className="text-2xl font-semibold text-slate-950">{t("operatorTitle")}</h1><Link href="/platform/billing/deliveries" className={editorSecondaryAction}><ReviewIcon name="share"/>{reminders("title")}</Link><p className="text-sm text-slate-600">{t("listNotice")}</p>
    <CommercialRequestsView requests={requests}/>
  </section>;
}
