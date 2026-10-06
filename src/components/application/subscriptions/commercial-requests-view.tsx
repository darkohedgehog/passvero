import { useLocale, useTranslations } from "next-intl";
import type { RequestDto } from "@/src/application/subscriptions/contracts";
import { Link } from "@/src/i18n/navigation";
import { STANDARD_PLANS } from "@/src/application/subscriptions/catalog";
import { editorSecondaryAction } from "@/src/components/application/products/product-editor-ui";
import { ReviewBadge, ReviewFact, ReviewIcon, reviewPanel } from "@/src/components/application/platform/review-ui";

export function CommercialRequestsView({ requests }: { requests: RequestDto[] | undefined }) {
  const t = useTranslations("Subscription"), locale = useLocale();
  const money = (cents: number) => new Intl.NumberFormat(locale, {style: "currency", currency: "EUR"}).format(cents / 100);
  if (!requests) return <p role="alert" className={`${reviewPanel} p-5 text-sm text-slate-700`}>{t("failure")}</p>;
  if (!requests.length) return <p className={`${reviewPanel} border-dashed p-6 text-sm text-slate-600`}>{t("empty")}</p>;
  return <ul className="space-y-4">{requests.map(request => <li key={request.id} className={`${reviewPanel} overflow-hidden`}>
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50/80 p-5">
      <div className="flex min-w-0 flex-1 items-start gap-3"><span className="rounded-lg bg-teal-50 p-2 text-teal-800"><ReviewIcon name="manufacturing"/></span><div className="min-w-0"><h2 className="font-bold text-slate-950 [overflow-wrap:anywhere]">{request.organizationName}</h2><p className="mt-1 text-xs text-slate-500 [overflow-wrap:anywhere]">{request.id}</p></div></div>
      <ReviewBadge status={request.status}>{t(request.status)}</ReviewBadge>
    </div>
    <div className="flex min-w-0 flex-col gap-5 p-5 sm:flex-row sm:items-end sm:justify-between"><dl className="grid min-w-0 flex-1 gap-4 sm:grid-cols-3"><ReviewFact label={t("plan")}>{STANDARD_PLANS.find(plan => plan.slug === request.planSlug)?.name ?? request.planSlug}</ReviewFact><ReviewFact label={t("period")}>{t("months", {count: request.months})}</ReviewFact>{request.offer ? <ReviewFact label={t("total")}>{money(request.offer.snapshot.totalAmountCents)}</ReviewFact> : null}</dl><Link href={`/platform/billing/${request.organizationId}`} className={editorSecondaryAction}><ReviewIcon name="preview"/>{t("open")}</Link></div>
  </li>)}</ul>;
}
