import { ProductThumbnail } from "../products/product-thumbnail";
import type messages from "@/messages/en.json";
import type { DashboardOverview } from "@/src/application/dashboard/overview";
import { overviewCategories } from "@/src/application/dashboard/overview";
import { MarketingIcon } from "@/src/components/marketing/marketing-icons";
import { editorPrimaryAction, editorSecondaryAction } from "@/src/components/application/products/product-editor-ui";
export type OverviewLabels = typeof messages.DashboardOverview;
const categoryColors = { draftOnly: "text-blue-600", publishedOnly: "text-teal-700", publishedWithDraft: "text-indigo-600", withoutVersion: "text-slate-500" };

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
      <div className="mt-6 flex flex-col items-center gap-7 md:flex-row md:gap-10">
        <div className="relative size-52 shrink-0">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true" focusable="false">
            <circle cx="60" cy="60" r="48" fill="none" strokeWidth="15" className="stroke-slate-100" />
            {overviewCategories.map((category, index) => {
              const fraction = data.total ? data.distribution[category] / data.total : 0;
              const offset = overviewCategories.slice(0,index).reduce((sum,key) => sum + data.distribution[key],0);
              return fraction > 0 ? <circle key={category} cx="60" cy="60" r="48" pathLength="100" fill="none" stroke="currentColor" strokeWidth="15" className={categoryColors[category]}
                strokeDasharray={`${fraction * 100} ${100 - fraction * 100}`} strokeDashoffset={-offset / data.total * 100} /> : null;
            })}
          </svg>
          <div className="absolute inset-8 flex flex-col items-center justify-center text-center"><strong className="max-w-full break-all text-3xl font-bold tabular-nums text-slate-950">{number.format(data.total)}</strong><span className="mt-1 text-xs text-slate-600">{labels.total}</span></div>
        </div>
        <ul className="grid w-full min-w-0 flex-1 gap-4">{overviewCategories.map(category => <li key={category} className="flex items-start gap-3">
          <span aria-hidden="true" className={`mt-1 size-3 shrink-0 rounded-full bg-current ${categoryColors[category]}`} />
          <span className="min-w-0 flex-1 break-words text-sm text-slate-700">{labels[category]}</span>
          <strong className="shrink-0 text-sm tabular-nums text-slate-950">{number.format(data.distribution[category])}</strong>
          <span className="w-12 shrink-0 text-right text-sm tabular-nums text-slate-600">{new Intl.NumberFormat(locale,{style:"percent",maximumFractionDigits:0}).format(data.total ? data.distribution[category] / data.total : 0)}</span>
        </li>)}</ul>
      </div>
      <p className="mt-5 text-sm text-slate-600">{labels.scope} {labels.archived}: {number.format(data.archived)}.</p>
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5 sm:px-6"><h2 className="text-lg font-bold text-slate-950">{labels.recent}</h2><a href={catalogHref} className="inline-flex min-h-11 items-center rounded text-sm font-semibold text-teal-800 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-teal-700">{labels.allProducts}</a></div>
      <ul className="divide-y divide-slate-200">{data.recent.map(row => <li key={row.id} className="flex min-w-0 flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="flex min-w-0 items-center gap-3">
        <ProductThumbnail productId={row.id} imageId={row.imageId} />
        <div className="min-w-0"><a href={`${catalogHref}/${row.id}`} className="break-words font-semibold text-slate-900 underline-offset-4 hover:text-teal-800 hover:underline focus-visible:ring-2 focus-visible:ring-teal-700">{row.name}</a>{row.sku ? <p className="mt-1 break-all text-sm text-slate-500">{labels.sku}: {row.sku}</p> : null}</div></div>
        <div className="shrink-0 space-y-2 sm:max-w-[45%] sm:text-right"><p className="text-sm font-medium text-teal-800">{labels[row.category]}{row.archived ? ` · ${labels.archived}` : ""}</p><time dateTime={row.updatedAt.toISOString()} className="block text-xs text-slate-500">{labels.updated}: {date.format(row.updatedAt)}</time></div>
      </li>)}</ul><p className="border-t border-slate-200 bg-slate-50 px-5 py-4 text-xs leading-5 text-slate-600">{labels.recentHelp}</p>
    </section>
  </div>;
}
