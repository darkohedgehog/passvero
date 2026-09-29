import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { OrganizationDetail, OrganizationPage } from "@/src/application/platform/service";
import { Link, getPathname } from "@/src/i18n/navigation";
import type { AppLocale } from "@/src/i18n/routing";
import { ListPagination } from "@/src/components/application/products/list-pagination";
import { MarketingIcon, type MarketingIconName } from "@/src/components/marketing/marketing-icons";

const linkClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2";
const panelClass = "min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm";
function date(value: Date, locale: AppLocale) {
  return new Intl.DateTimeFormat(locale === "sr" ? "sr-Latn" : locale, { dateStyle: "medium", timeZone: "Europe/Zagreb" }).format(value);
}
function Icon({ name }: { name: MarketingIconName }) {
  return <MarketingIcon name={name} aria-hidden="true" focusable="false" className="size-5 shrink-0" />;
}
function Status({ status }: { status: OrganizationDetail["status"] }) {
  const t = useTranslations("PlatformAdmin");
  const tones = {
    ACTIVE: "bg-teal-50 text-teal-800 ring-teal-600/20",
    SUSPENDED: "bg-amber-50 text-amber-900 ring-amber-600/20",
    DEACTIVATED: "bg-slate-100 text-slate-700 ring-slate-500/20",
    PENDING_DELETION: "bg-rose-50 text-rose-800 ring-rose-600/20",
  };
  return <span className={`inline-flex max-w-full rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${tones[status]}`}>{t(status)}</span>;
}
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-900 [overflow-wrap:anywhere]">{children}</dd></div>;
}
function SectionTitle({ id, icon, children }: { id: string; icon: MarketingIconName; children: ReactNode }) {
  return <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-4 sm:px-6"><span className="text-teal-800"><Icon name={icon} /></span><h2 id={id} className="text-base font-bold text-slate-950">{children}</h2></div>;
}
export function OrganizationsView({ page, q, locale }: { page: OrganizationPage; q: string; locale: AppLocale }) {
  const t = useTranslations("PlatformAdmin");
  const detail = (row: OrganizationPage["items"][number]) => <Link href={`/platform/organizations/${row.id}`} prefetch={false} className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 py-2 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2" aria-label={`${t("details")}: ${row.displayName}`}><Icon name="preview" />{t("details")}</Link>;
  return <section aria-label={t("organizations")} className="space-y-5">
    <form action={getPathname({ locale, href: "/platform/organizations" })} method="get" className={`${panelClass} flex flex-wrap items-end gap-3 p-4 sm:p-5`}>
      <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
        <label htmlFor="organization-search" className="mb-2 block text-sm font-semibold text-slate-700">{t("searchLabel")}</label>
        <div className="relative"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" focusable="false" className="pointer-events-none absolute left-3 top-3 size-5 text-slate-400"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg><input id="organization-search" name="q" type="search" defaultValue={q} maxLength={100} className="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-950 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-600" /></div>
      </div>
      <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2">{t("search")}</button>
      {q ? <Link href="/platform/organizations" prefetch={false} className={linkClass}>{t("reset")}</Link> : null}
    </form>
    {page.items.length === 0 ? <div role="status" className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-teal-50 text-teal-800"><Icon name="manufacturing" /></span><h2 className="text-lg font-bold text-slate-950">{t(q ? "empty" : "emptyOrganizations")}</h2><p className="mt-2 text-sm text-slate-600">{t(q ? "emptyHint" : "emptyOrganizationsHint")}</p></div> : <>
      <div className={`${panelClass} hidden md:block`}><table className="w-full table-fixed border-collapse text-left text-sm"><thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600"><tr>{(["displayName", "status", "createdAt", "billing", "details"] as const).map(key => <th key={key} scope="col" className="px-4 py-3 [overflow-wrap:anywhere]">{t(key)}</th>)}</tr></thead><tbody className="divide-y divide-slate-200">{page.items.map(row => <tr key={row.id} className="transition-colors hover:bg-slate-50 focus-within:bg-teal-50/50"><th scope="row" className="px-4 py-4 font-semibold text-slate-950 [overflow-wrap:anywhere]">{row.displayName}</th><td className="px-4 py-4"><Status status={row.status} /></td><td className="px-4 py-4 text-slate-600">{date(row.createdAt, locale)}</td><td className="px-4 py-4 text-slate-600">{t(row.hasBillingProfile ? "present" : "absent")}</td><td className="px-2 py-2 [overflow-wrap:anywhere]">{detail(row)}</td></tr>)}</tbody></table></div>
      <ul className="grid gap-3 md:hidden">{page.items.map(row => <li key={row.id} className={`${panelClass} p-4`}><h2 className="font-bold text-slate-950 [overflow-wrap:anywhere]">{row.displayName}</h2><dl className="mt-4 grid grid-cols-2 gap-4"><Fact label={t("status")}><Status status={row.status} /></Fact><Fact label={t("createdAt")}>{date(row.createdAt, locale)}</Fact><Fact label={t("billing")}>{t(row.hasBillingProfile ? "present" : "absent")}</Fact></dl><div className="mt-4 border-t border-slate-100 pt-2">{detail(row)}</div></li>)}</ul>
    </>}
    <div className="flex flex-wrap items-baseline justify-between gap-3"><Link href={{ pathname: "/platform/organizations", query: { q } }} prefetch={false} className={linkClass}><Icon name="back" />{t("first")}</Link><ListPagination label={t("next")} href={page.nextCursor ? getPathname({ locale, href: { pathname: "/platform/organizations", query: { q, cursor: page.nextCursor } } }) : null} /></div>
  </section>;
}
export function OrganizationDetailView({ organization, locale }: { organization: OrganizationDetail; locale: AppLocale }) {
  const t = useTranslations("PlatformAdmin");
  const b = useTranslations("BillingProfile");
  const profile = organization.billingProfile;
  const fields = ["legalName", "addressLine1", "addressLine2", "city", "postalCode", "countryCode", "billingEmail", "taxIdentifier", "vatIdentifier"] as const;
  return <div className="space-y-5">
    <Link href="/platform/organizations" prefetch={false} className={linkClass}><Icon name="back" />{t("backToList")}</Link>
    <section className={panelClass} aria-labelledby="identity-title"><SectionTitle id="identity-title" icon="manufacturing">{t("identity")}</SectionTitle><dl className="grid gap-6 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3"><Fact label={t("displayName")}><span className="font-semibold">{organization.displayName}</span></Fact><Fact label={t("status")}><Status status={organization.status} /></Fact><Fact label={t("createdAt")}>{date(organization.createdAt, locale)}</Fact></dl></section>
    <section className={panelClass} aria-labelledby="billing-title"><SectionTitle id="billing-title" icon="receipt">{t("billing")}</SectionTitle><div className="p-5 sm:p-6"><p className="mb-6 max-w-3xl text-sm leading-6 text-slate-600">{t("notice")}</p>
      {profile ? <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">{fields.map(field => <Fact key={field} label={b(field)}>{profile[field] === null ? <span className="text-slate-500">{t("notProvided")}</span> : field === "countryCode" ? `${new Intl.DisplayNames([locale === "sr" ? "sr-Latn" : locale], { type: "region" }).of(profile.countryCode)} (${profile.countryCode})` : profile[field]}</Fact>)}<Fact label={t("updatedAt")}>{date(profile.updatedAt, locale)}</Fact></dl> : <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-600">{t("emptyProfile")}</div>}
    </div></section>
  </div>;
}
