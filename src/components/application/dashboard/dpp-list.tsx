import type messages from "@/messages/en.json";
import type { DppListRow } from "@/src/application/dashboard/list-dpp";
import { ProductThumbnail } from "../products/product-thumbnail";
import { ListPagination } from "../products/list-pagination";
import { MarketingIcon } from "@/src/components/marketing/marketing-icons";
import { editorSecondaryAction } from "../products/product-editor-ui";
export function DppList({ items, nextHref, labels }: { items: readonly DppListRow[]; nextHref: string | null; labels: typeof messages.DppList }) {
  return <>
    <p className="mb-6 max-w-3xl text-sm leading-6 text-slate-600">{labels.description}</p>
    {!items.length ? <div role="status" className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><h2 className="text-lg font-bold">{labels.emptyTitle}</h2><p className="mt-2 text-sm text-slate-600">{labels.emptyDescription}</p></div> :
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">{items.map(item => <li key={item.productId} className="flex min-w-0 flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3"><ProductThumbnail productId={item.productId} imageId={item.imageId} /><div className="min-w-0"><h2 className="break-words font-semibold text-slate-950">{item.name ?? labels.unavailable}</h2><p className="mt-1 break-all text-sm text-slate-600">SKU: {item.sku ?? labels.unavailable}</p><p className="mt-1 text-sm text-slate-600">{labels.version}: {item.versionNumber ?? labels.unavailable}{item.archived ? ` · ${labels.archived}` : ""}</p></div></div>
        {item.publicHref ? <a href={item.publicHref} className={`${editorSecondaryAction} sm:max-w-[45%]`}><MarketingIcon name="preview" className="size-4 shrink-0" aria-hidden="true" focusable="false" />{labels.open}</a> : <span className="text-sm text-slate-500 sm:max-w-[40%]">{labels.notPublic}</span>}
      </li>)}</ul>}
    <ListPagination href={nextHref} label={labels.nextPage} />
  </>;
}
