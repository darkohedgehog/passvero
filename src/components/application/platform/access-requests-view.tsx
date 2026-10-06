import { useTranslations } from "next-intl";
import { Link, getPathname } from "@/src/i18n/navigation";
import type { AppLocale } from "@/src/i18n/routing";
import type { AccessRequestPage, AccessRequestQuery } from "@/src/application/platform/service";
import { ListPagination } from "@/src/components/application/products/list-pagination";

import { editorPrimaryAction, editorSecondaryAction } from "@/src/components/application/products/product-editor-ui";
import { ReviewBadge, ReviewFact, ReviewHeading, ReviewIcon, ReviewSelect, reviewPanel } from "./review-ui";
import { AccessRequestApproval } from "./access-request-approval";

const linkClass = editorSecondaryAction;
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
    <div><h1 id="access-requests-title" className="text-xl font-bold text-slate-950">{t("title")}</h1><details className="mt-3 text-sm text-slate-600"><summary className="w-fit cursor-pointer rounded-md py-2 font-semibold text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700">{t("help")}</summary><p className="mt-2 max-w-3xl leading-6">{t("notice")}</p></details></div>
    <form method="get" action={getPathname({locale, href: "/platform/access-requests"})} className={`${reviewPanel} flex flex-wrap items-end gap-3 p-4 sm:p-5`}>
      <div className="min-w-0 basis-full sm:basis-auto sm:min-w-56"><label htmlFor="request-status" className="mb-2 block text-sm font-semibold text-slate-700">{t("status")}</label><ReviewSelect id="request-status" name="status" defaultValue={status}>{(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map(value => <option key={value} value={value}>{t(value)}</option>)}</ReviewSelect></div>
      <button type="submit" className={editorPrimaryAction}><ReviewIcon name="preview"/>{t("filter")}</button>
    </form>
    {page.items.length === 0 ? <p role="status" className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">{t("empty")}</p> : <ul className="grid gap-4 xl:grid-cols-2">{page.items.map(row => {
      const sections = [
        {title: "contactSection", icon: "trust", facts: [[t("contact"), row.contactName], [t("email"), row.email], [t("language"), row.locale]]},
        {title: "decisionSection", icon: "secure", facts: [[t("createdAt"), date(row.createdAt)], [t("decidedAt"), date(row.decidedAt)]]},
        {title: "deliverySection", icon: "share", facts: [
          [t("delivery"), label(row.deliveryStatus)], [t("attempts"), String(row.deliveryAttempts)], [t("sentAt"), date(row.deliveredAt)],
          [t("adminNotification"), label(row.adminNotification?.status === "PENDING" ? "PENDING_NOTIFICATION" : row.adminNotification?.status ?? "NOT_PREPARED")],
          [t("adminAttempts"), String(row.adminNotification?.attempts ?? 0)],
        ]},
      ] as const;
      return <li key={row.id} className={`${reviewPanel} overflow-hidden`}>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50/80 p-5 sm:p-6">
          <div className="flex min-w-0 flex-1 items-start gap-3"><span className="rounded-lg bg-teal-50 p-2 text-teal-800"><ReviewIcon name="manufacturing"/></span><div className="min-w-0"><h2 className="font-bold text-slate-950 [overflow-wrap:anywhere]">{row.organizationDisplayName}</h2><p className="mt-2 text-xs leading-5 text-slate-500 [overflow-wrap:anywhere]">{t("id")}: {row.id}</p></div></div>
          <ReviewBadge status={row.status}>{label(row.status)}</ReviewBadge>
        </div>
        <div className="divide-y divide-slate-100 px-5 sm:px-6">{sections.map(section => <section key={section.title} className="py-5" aria-label={t(section.title)}><ReviewHeading icon={section.icon}>{t(section.title)}</ReviewHeading><dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">{section.facts.map(([name, value]) => <ReviewFact key={name} label={name}>{value}</ReviewFact>)}</dl></section>)}</div>
        {canApprove && row.status === "PENDING" ? <div className="bg-slate-50/80 px-5 pb-5 sm:px-6"><AccessRequestApproval requestId={row.id}/></div> : null}
      </li>;
    })}</ul>}
    <div className="flex flex-wrap justify-between gap-3"><Link href={{pathname: "/platform/access-requests", query: {status}}} prefetch={false} className={linkClass}><ReviewIcon name="back"/>{t("first")}</Link><ListPagination label={t("next")} href={page.nextCursor ? getPathname({locale, href: {pathname: "/platform/access-requests", query: {status, cursor: page.nextCursor}}}) : null} /></div>
  </section>;
}
