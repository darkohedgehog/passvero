import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCommercialServices } from "@/src/infrastructure/subscriptions/commercial-runtime";
import { getReminderServices } from "@/src/infrastructure/subscriptions/reminder-runtime";
import { ReminderActions, BillingEmailConfirmationForm } from "@/src/components/application/subscriptions/reminder-actions";
import { isAppLocale } from "@/src/i18n/routing";
import { Link } from "@/src/i18n/navigation";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params; if (!isAppLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "SubscriptionReminders" });
  return { title: t("title"), robots: { index: false, follow: false } };
}
export default async function ReminderDeliveriesPage({ params }: Props) {
  const { locale } = await params; if (!isAppLocale(locale)) notFound(); setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "SubscriptionReminders" }), requestHeaders = await headers();
  try { await getCommercialServices().requireBillingAccess(requestHeaders); } catch { notFound(); }
  let view;
  try { view = await getReminderServices().overview(requestHeaders); } catch { return <p role="alert">{t("failure")}</p>; }
  const date = (value: Date | null) => value ? `${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "long", timeZone: "Europe/Zagreb" }).format(value)} (Europe/Zagreb)` : "—";
  const labels = ["PENDING", "CLAIMED", "SENDING", "SENT", "FAILED", "DELIVERY_UNKNOWN", "CANCELLED", "SUBSCRIPTION", "PUBLIC_AVAILABILITY", "WORKER_FAILED", "STALE_OR_UNAUTHORIZED", "CAMPAIGN_BUDGET_EXHAUSTED", "SMTP_CONNECT_FAILED", "SMTP_REJECTED_TEMPORARY", "SMTP_REJECTED", "SMTP_CONFIGURATION", "SMTP_OUTCOME_UNKNOWN", "ATTEMPT_OUTCOME_NOT_RECORDED", "OPERATOR_CONFIRMED_ACCEPTANCE", "OPERATOR_CONFIRMED_NOT_ACCEPTED"] as const;
  const state = (value: string) => t(labels.find(key => key === value) ?? "failure");
  return <section className="space-y-5"><Link href="/platform/billing" className="text-teal-700 underline">{t("back")}</Link><h1 className="text-2xl font-semibold">{t("title")}</h1><p className="text-sm text-slate-600">{t("notice")}</p>
    <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{["PENDING", "CLAIMED", "SENDING", "SENT", "FAILED", "DELIVERY_UNKNOWN", "CANCELLED"].map(status => <div key={status} className="rounded-xl border border-slate-200 bg-white p-4"><dt className="text-sm text-slate-600">{state(status)}</dt><dd className="text-2xl font-semibold">{view.counts.find(c => c.status === status)?._count ?? 0}</dd></div>)}</dl>
    <h2 className="text-lg font-semibold">{t("worker")}</h2>{view.campaigns.length === 0 ? <p>{t("disabled")}</p> : <ul className="space-y-3">{view.campaigns.map(c => <li key={c.id} className="space-y-2 rounded-xl border border-slate-200 bg-white p-5"><p className="break-all text-xs text-slate-500">{c.id}</p><p>{c.enabled ? t("enabled") : t("disabled")} · {c.dispatches}/{c.maxDispatches}</p><p>{t("lastSuccess")}: {date(c.lastSuccessAt)}</p><p>{t("expires")}: {date(c.expiresAt)}</p>{c.lastError && <p>{state(c.lastError)}</p>}</li>)}</ul>}
    <BillingEmailConfirmationForm /><h2 className="text-lg font-semibold">{t("recent")}</h2><ul className="space-y-4">{view.deliveries.map(d => <li key={d.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-5"><h3 className="break-words font-semibold">{d.organization.displayName}</h3><p className="break-all text-sm">{d.recipient}</p><p className="mt-2">{state(d.kind)} · {t("threshold", { days: d.threshold })} · {state(d.status)}</p><dl className="mt-3 space-y-2 text-sm"><div><dt className="text-slate-500">{t("deadline")}</dt><dd>{date(d.deadline)}</dd></div><div><dt className="text-slate-500">{t("attempts")}</dt><dd>{d.attempts}/3</dd></div><div><dt className="text-slate-500">{t("nextAttempt")}</dt><dd>{date(d.nextAttemptAt)}</dd></div><div><dt className="text-slate-500">{t("accepted")}</dt><dd>{date(d.acceptedAt)}</dd></div><div><dt className="text-slate-500">{t("receipt")}</dt><dd>{date(d.receiptConfirmedAt)}</dd></div>{d.lastError && <div><dt className="text-slate-500">{t("reason")}</dt><dd>{state(d.lastError)}</dd></div>}</dl><ReminderActions id={d.id} status={d.status} receiptConfirmed={d.receiptConfirmedAt !== null} /></li>)}</ul>
  </section>;
}
