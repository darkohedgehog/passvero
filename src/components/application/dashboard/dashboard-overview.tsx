/* eslint-disable @next/next/no-img-element -- Private image delivery requires the existing authenticated endpoint, not the public optimizer. */
import type messages from "@/messages/en.json";
import type { DashboardOverview } from "@/src/application/dashboard/overview";
import { overviewCategories } from "@/src/application/dashboard/overview";
import { MarketingIcon } from "@/src/components/marketing/marketing-icons";
import { editorPrimaryAction, editorSecondaryAction } from "@/src/components/application/products/product-editor-ui";
export type OverviewLabels = typeof messages.DashboardOverview;
const categoryColors = { draftOnly: "bg-blue-600", publishedOnly: "bg-teal-700", publishedWithDraft: "bg-indigo-600", withoutVersion: "bg-slate-500" };

export function DashboardOverviewPanel({ data, labels, locale, catalogHref, createHref, importHref, exportHref }: {
  data: DashboardOverview | null; labels: OverviewLabels; locale: string; catalogHref: string;
  createHref: string | null; importHref: string | null; exportHref: string | null;
}) {
  const number = new Intl.NumberFormat(locale);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zagreb" });
  if (!data) return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900"><p>{labels.loadError}</p><a href="" className="mt-3 inline-flex min-h-11 items-center font-semibold underline">{labels.retry}</a></div>;
  return <div className="space-y-7">
    <section aria-label={labels.overview}>
      <dl className="grid gap-4 sm:grid-cols-3">{([
        [labels.total, data.total, "packaging"], [labels.published, data.published, "publish"], [labels.draft, data.draft, "edit"],
      ] as const).map(([label,value,icon]) => <div key={icon} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:p-6"><div className="min-w-0"><dt className="break-words text-sm font-medium text-slate-600">{label}</dt><dd className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{number.format(value)}</dd></div><span className="rounded-xl bg-teal-50 p-3 text-teal-700"><MarketingIcon name={icon} className="size-6" aria-hidden="true" focusable="false" /></span></div>)}</dl>
      <p className="mt-3 text-sm text-slate-600">{labels.overlap}</p>
    </section>
    <section aria-label={labels.quickActions} className="flex flex-wrap gap-3">
      {createHref ? <a href={createHref} className={editorPrimaryAction}><MarketingIcon name="add" className="size-4 shrink-0" aria-hidden="true" />{labels.newProduct}</a> : null}
      {importHref ? <a href={importHref} className={editorSecondaryAction}><MarketingIcon name="upload" className="size-4 shrink-0" aria-hidden="true" />{labels.importCsv}</a> : null}
      {exportHref ? <a href={exportHref} className={editorSecondaryAction}><MarketingIcon name="download" className="size-4 shrink-0" aria-hidden="true" />{labels.exportCsv}</a> : null}
    </section>
    {data.total === 0 ? <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8"><h2 className="text-lg font-bold">{labels.emptyTitle}</h2><p className="mt-2 text-sm text-slate-600">{labels.emptyDescription}</p></section> : null}
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-bold text-slate-950">{labels.distribution}</h2>
      <ul className="mt-5 grid gap-5 sm:grid-cols-2">{overviewCategories.map(category => <li key={category}><div className="mb-2 flex items-start justify-between gap-4 text-sm"><span className="text-slate-700">{labels[category]}</span><strong className="text-slate-950">{number.format(data.distribution[category])}</strong></div><div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${categoryColors[category]}`} style={{ width: `${data.total ? data.distribution[category] / data.total * 100 : 0}%` }} /></div></li>)}</ul>
      <p className="mt-5 text-sm text-slate-600">{labels.scope} {labels.archived}: {number.format(data.archived)}.</p>
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5 sm:px-6"><h2 className="text-lg font-bold text-slate-950">{labels.recent}</h2><a href={catalogHref} className="inline-flex min-h-11 items-center rounded text-sm font-semibold text-teal-800 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-teal-700">{labels.allProducts}</a></div>
      <ul className="divide-y divide-slate-200">{data.recent.map(row => <li key={row.id} className="flex min-w-0 flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="flex min-w-0 items-center gap-3">
        {row.imageId ? <img src={`/api/products/${row.id}/images/${row.imageId}`} alt="" width={48} height={48} className="size-12 shrink-0 rounded-lg border border-slate-200 object-contain" /> : <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500"><MarketingIcon name="packaging" className="size-6" /></span>}
        <div className="min-w-0"><a href={`${catalogHref}/${row.id}`} className="break-words font-semibold text-slate-900 underline-offset-4 hover:text-teal-800 hover:underline focus-visible:ring-2 focus-visible:ring-teal-700">{row.name}</a>{row.sku ? <p className="mt-1 break-all text-sm text-slate-500">{labels.sku}: {row.sku}</p> : null}</div></div>
        <div className="shrink-0 space-y-2 sm:max-w-[45%] sm:text-right"><p className="text-sm font-medium text-teal-800">{labels[row.category]}{row.archived ? ` · ${labels.archived}` : ""}</p><time dateTime={row.updatedAt.toISOString()} className="block text-xs text-slate-500">{labels.updated}: {date.format(row.updatedAt)}</time></div>
      </li>)}</ul><p className="border-t border-slate-200 bg-slate-50 px-5 py-4 text-xs leading-5 text-slate-600">{labels.recentHelp}</p>
    </section>
  </div>;
}
