import { useTranslations } from "next-intl";
import { Link, getPathname } from "@/src/i18n/navigation";
import type { AppLocale } from "@/src/i18n/routing";
import type { AccessRequestPage, AccessRequestQuery } from "@/src/application/platform/service";
import { ListPagination } from "@/src/components/application/products/list-pagination";

import { AccessRequestApproval } from "./access-request-approval";

const linkClass = "inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600";
const statusKeys = ["PENDING", "APPROVED", "REJECTED", "NOT_STARTED", "DELIVERY_IN_PROGRESS", "SENT", "DELIVERY_UNKNOWN", "PENDING_NOTIFICATION", "IN_PROGRESS", "NOT_PREPARED"] as const;
export function AccessRequestsView({page, status, locale, canApprove = false}: {
  page: AccessRequestPage; status: AccessRequestQuery["status"]; locale: AppLocale; canApprove?: boolean;
}) {
  const t = useTranslations("AccessRequests");
  const date = (value: Date | null) => value ? new Intl.DateTimeFormat(locale === "sr" ? "sr-Latn" : locale, {dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zagreb"}).format(value) : t("absent");
  const label = (value: string) => {
    const key = statusKeys.find(key => key === value);
    return key ? t(key) : t("unknown");
  };
  return <section className="space-y-5" aria-labelledby="access-requests-title">
    <div><h1 id="access-requests-title" className="text-xl font-bold text-slate-950">{t("title")}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{t("notice")}</p></div>
    <form method="get" action={getPathname({locale, href: "/platform/access-requests"})} className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div><label htmlFor="request-status" className="mb-2 block text-sm font-semibold text-slate-700">{t("status")}</label><select id="request-status" name="status" defaultValue={status} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-slate-900">{(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map(value => <option key={value} value={value}>{t(value)}</option>)}</select></div>
      <button type="submit" className={linkClass}>{t("filter")}</button>
    </form>
    {page.items.length === 0 ? <p role="status" className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">{t("empty")}</p> : <ul className="grid gap-4 xl:grid-cols-2">{page.items.map(row => {
      const facts = [
        [t("id"), row.id], [t("contact"), row.contactName], [t("email"), row.email],
        [t("language"), row.locale], [t("status"), label(row.status)], [t("createdAt"), date(row.createdAt)],
        [t("decidedAt"), date(row.decidedAt)], [t("delivery"), label(row.deliveryStatus)],
        [t("attempts"), String(row.deliveryAttempts)], [t("sentAt"), date(row.deliveredAt)],
        [t("adminNotification"), label(row.adminNotification?.status === "PENDING" ? "PENDING_NOTIFICATION" : row.adminNotification?.status ?? "NOT_PREPARED")],
        [t("adminAttempts"), String(row.adminNotification?.attempts ?? 0)],
      ];
      return <li key={row.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-950 [overflow-wrap:anywhere]">{row.organizationDisplayName}</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2">{facts.map(([name, value]) => <div key={name} className="min-w-0"><dt className="text-xs font-semibold text-slate-500">{name}</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900 [overflow-wrap:anywhere]">{value}</dd></div>)}</dl>{canApprove && row.status === "PENDING" ? <AccessRequestApproval requestId={row.id} /> : null}</li>;
    })}</ul>}
    <div className="flex flex-wrap justify-between gap-3"><Link href={{pathname: "/platform/access-requests", query: {status}}} prefetch={false} className={linkClass}>{t("first")}</Link><ListPagination label={t("next")} href={page.nextCursor ? getPathname({locale, href: {pathname: "/platform/access-requests", query: {status, cursor: page.nextCursor}}}) : null} /></div>
  </section>;
}
