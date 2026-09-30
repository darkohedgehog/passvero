import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCommercialServices } from "@/src/infrastructure/subscriptions/commercial-runtime";
import { isAppLocale } from "@/src/i18n/routing";
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
  return <section className="space-y-5"><h1 className="text-2xl font-semibold text-slate-950">{t("operatorTitle")}</h1><Link href="/platform/billing/deliveries" className="inline-flex min-h-11 items-center text-teal-700 underline">{reminders("title")}</Link><p className="text-sm text-slate-600">{t("listNotice")}</p>
    {!requests ? <p role="alert">{t("failure")}</p> : requests.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-6">{t("empty")}</p> : <ul className="space-y-3">{requests.map(request => <li key={request.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5"><div className="min-w-0 space-y-1"><h2 className="break-words font-semibold">{request.organizationName}</h2><p className="text-sm text-slate-600">{request.planSlug} · {t("months", { count: request.months })} · {t(request.status)}</p></div><Link href={`/platform/billing/${request.organizationId}`} className="inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-teal-700 underline-offset-4 hover:underline">{t("open")}</Link></li>)}</ul>}
  </section>;
}
