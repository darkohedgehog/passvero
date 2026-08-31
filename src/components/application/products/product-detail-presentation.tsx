import type { ProductDetailResult } from "@/src/application/products/get-product-detail/contracts";

export interface ProductDetailLabels {
  readonly backToProducts: string;
  readonly overview: string;
  readonly lifecycle: string;
  readonly identityTitle: string;
  readonly internalName: string;
  readonly organizationSku: string;
  readonly publicCode: string;
  readonly publicCodeHint: string;
  readonly created: string;
  readonly updated: string;
  readonly draftTitle: string;
  readonly publishedTitle: string;
  readonly status: string;
  readonly sourceLocale: string;
  readonly sourceProductName: string;
  readonly versionNumber: string;
  readonly publishedAt: string;
  readonly draftEmpty: string;
  readonly publishedEmpty: string;
  readonly notAvailable: string;
  readonly lifecycleStatus: Readonly<Record<ProductDetailResult["lifecycleStatus"], string>>;
  readonly versionStatus: Readonly<Record<
    "DRAFT" | "READY_FOR_REVIEW" | "PUBLISHED",
    string
  >>;
}

export interface ProductDetailFormattedDates {
  readonly productCreatedAt: string;
  readonly productUpdatedAt: string;
  readonly draftCreatedAt: string | null;
  readonly draftUpdatedAt: string | null;
  readonly publishedAt: string | null;
}

export function ProductDetailPresentation({
  detail,
  productListHref,
  editHref,
  editLabel,
  formattedDates,
  labels,
}: Readonly<{
  detail: ProductDetailResult;
  productListHref: string;
  editHref?: string | null;
  editLabel?: string;
  formattedDates: ProductDetailFormattedDates;
  labels: ProductDetailLabels;
}>) {
  return (
    <div>
      <nav aria-label={labels.overview}>
        <a
          href={productListHref}
          className="inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
        >
          ← {labels.backToProducts}
        </a>
      </nav>

      <header className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-[-0.025em] text-slate-950">
            {detail.internalName}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{labels.overview}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {editHref !== null && editHref !== undefined && editLabel !== undefined ? (
            <a
              href={editHref}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
            >
              {editLabel}
            </a>
          ) : null}
          <p className="inline-flex w-fit rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-800">
            <span className="sr-only">{labels.lifecycle}: </span>
            {labels.lifecycleStatus[detail.lifecycleStatus]}
          </p>
        </div>
      </header>

      <section aria-labelledby="product-identity-heading" className="mt-8">
        <h3 id="product-identity-heading" className="text-lg font-bold text-slate-950">
          {labels.identityTitle}
        </h3>
        <dl className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
          <Fact label={labels.internalName} value={detail.internalName} />
          <Fact
            label={labels.organizationSku}
            value={detail.organizationSku ?? labels.notAvailable}
          />
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {labels.publicCode}
            </dt>
            <dd className="mt-1 break-all font-mono text-sm text-slate-900">
              {detail.publicCode}
            </dd>
            <p className="mt-1 text-xs leading-5 text-slate-500">{labels.publicCodeHint}</p>
          </div>
          <Fact label={labels.created} value={formattedDates.productCreatedAt} />
          <Fact label={labels.updated} value={formattedDates.productUpdatedAt} />
        </dl>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="current-draft-heading" className="rounded-xl border border-slate-200 p-4 sm:p-5">
          <h3 id="current-draft-heading" className="text-lg font-bold text-slate-950">
            {labels.draftTitle}
          </h3>
          {detail.currentDraft === null ? (
            <p className="mt-3 text-sm leading-6 text-slate-600">{labels.draftEmpty}</p>
          ) : (
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Fact label={labels.status} value={labels.versionStatus[detail.currentDraft.status]} />
              <Fact label={labels.sourceLocale} value={detail.currentDraft.sourceLocale.toUpperCase()} />
              <Fact label={labels.sourceProductName} value={detail.currentDraft.sourceProductName} />
              <Fact label={labels.created} value={formattedDates.draftCreatedAt ?? labels.notAvailable} />
              <Fact label={labels.updated} value={formattedDates.draftUpdatedAt ?? labels.notAvailable} />
            </dl>
          )}
        </section>

        <section aria-labelledby="current-published-heading" className="rounded-xl border border-slate-200 p-4 sm:p-5">
          <h3 id="current-published-heading" className="text-lg font-bold text-slate-950">
            {labels.publishedTitle}
          </h3>
          {detail.currentPublished === null ? (
            <p className="mt-3 text-sm leading-6 text-slate-600">{labels.publishedEmpty}</p>
          ) : (
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Fact label={labels.status} value={labels.versionStatus.PUBLISHED} />
              <Fact label={labels.sourceLocale} value={detail.currentPublished.sourceLocale.toUpperCase()} />
              <Fact label={labels.sourceProductName} value={detail.currentPublished.sourceProductName} />
              <Fact
                label={labels.versionNumber}
                value={detail.currentPublished.versionNumber?.toString() ?? labels.notAvailable}
              />
              <Fact
                label={labels.publishedAt}
                value={formattedDates.publishedAt ?? labels.notAvailable}
              />
            </dl>
          )}
        </section>
      </div>
    </div>
  );
}

function Fact({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}
