import type { ProductListItem } from "@/src/application/products/list-products/contracts";

type StatusLabels = Readonly<Record<
  NonNullable<ProductListItem["currentVersionStatus"]>,
  string
>>;

export interface ProductListLabels {
  readonly emptyTitle: string;
  readonly emptyDescription: string;
  readonly product: string;
  readonly sku: string;
  readonly lifecycle: string;
  readonly version: string;
  readonly locale: string;
  readonly updated: string;
  readonly notAvailable: string;
  readonly nextPage: string;
  readonly lifecycleStatus: Readonly<Record<ProductListItem["lifecycleStatus"], string>>;
  readonly versionStatus: StatusLabels;
}

export function ProductListPresentation({
  items,
  formattedUpdatedAt,
  nextPageHref,
  labels,
}: Readonly<{
  items: readonly ProductListItem[];
  formattedUpdatedAt: readonly string[];
  nextPageHref: string | null;
  labels: ProductListLabels;
}>) {
  if (items.length === 0) {
    return (
      <div role="status" className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center">
        <h2 className="text-lg font-bold text-slate-950">{labels.emptyTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {labels.emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th scope="col" className="px-4 py-3">{labels.product}</th>
              <th scope="col" className="px-4 py-3">{labels.sku}</th>
              <th scope="col" className="px-4 py-3">{labels.lifecycle}</th>
              <th scope="col" className="px-4 py-3">{labels.version}</th>
              <th scope="col" className="px-4 py-3">{labels.locale}</th>
              <th scope="col" className="px-4 py-3">{labels.updated}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {items.map((item, index) => (
              <tr key={item.productId}>
                <th scope="row" className="px-4 py-4 font-semibold text-slate-950">
                  {item.name}
                </th>
                <td className="px-4 py-4 text-slate-700">{item.sku ?? labels.notAvailable}</td>
                <td className="px-4 py-4 text-slate-700">
                  {labels.lifecycleStatus[item.lifecycleStatus]}
                </td>
                <td className="px-4 py-4 text-slate-700">
                  {item.currentVersionStatus === null
                    ? labels.notAvailable
                    : labels.versionStatus[item.currentVersionStatus]}
                </td>
                <td className="px-4 py-4 text-slate-700">
                  {item.sourceLocale?.toUpperCase() ?? labels.notAvailable}
                </td>
                <td className="px-4 py-4 text-slate-700">
                  {formattedUpdatedAt[index] ?? labels.notAvailable}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="grid gap-3 md:hidden">
        {items.map((item, index) => (
          <li key={item.productId} className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-bold text-slate-950">{item.name}</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <ProductFact label={labels.sku} value={item.sku ?? labels.notAvailable} />
              <ProductFact label={labels.lifecycle} value={labels.lifecycleStatus[item.lifecycleStatus]} />
              <ProductFact
                label={labels.version}
                value={item.currentVersionStatus === null
                  ? labels.notAvailable
                  : labels.versionStatus[item.currentVersionStatus]}
              />
              <ProductFact label={labels.locale} value={item.sourceLocale?.toUpperCase() ?? labels.notAvailable} />
              <ProductFact label={labels.updated} value={formattedUpdatedAt[index] ?? labels.notAvailable} />
            </dl>
          </li>
        ))}
      </ul>

      {nextPageHref === null ? null : (
        <nav aria-label={labels.nextPage} className="mt-6 flex justify-end">
          <a
            href={nextPageHref}
            className="inline-flex min-h-11 items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            {labels.nextPage}
          </a>
        </nav>
      )}
    </>
  );
}

function ProductFact({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-slate-800">{value}</dd>
    </div>
  );
}
