import type { PublicDppLabels } from "@/src/components/public-dpp/public-dpp-document";
import { ProductDetailSnapshotContent } from "./product-detail-snapshot";
import type { ProductDetailResult } from "@/src/application/products/get-product-detail/contracts";

export interface ProductDetailLabels {
  readonly technicalDetails: string;
  readonly viewPublicDpp: string;
  readonly publication: string;
  readonly publicAvailability: string;
  readonly noDraftChanges: string;
  readonly contentTitle: string;
  readonly readOnly: string;
  readonly draftPrivate: string;
  readonly publicationState: Readonly<Record<"DRAFT" | "PUBLISHED" | "CHANGES_IN_DRAFT", string>>;
  readonly availabilityStatus: Readonly<Record<"PUBLIC" | "NOT_PUBLIC" | "WITHDRAWN", string>>;
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
  contentEditHref,
  contentEditLabel,
  cnClassificationSection,
  materialsSection,
  publishSection,
  createDraftAction,
  qrSection,
  publishedTranslations,
  draftTranslations,
  formattedDates,
  labels,
  contentLabels,
}: Readonly<{
  detail: ProductDetailResult;
  productListHref: string;
  editHref?: string | null;
  editLabel?: string;
  contentEditHref?: string | null;
  contentEditLabel?: string;
  cnClassificationSection?: React.ReactNode;
  materialsSection?: React.ReactNode;
  publishSection?: React.ReactNode;
  createDraftAction?: React.ReactNode;
  qrSection?: React.ReactNode;
  publishedTranslations?: React.ReactNode;
  draftTranslations?: React.ReactNode;
  formattedDates: ProductDetailFormattedDates;
  labels: ProductDetailLabels;
  contentLabels: PublicDppLabels;
}>) {
  const draft = detail.currentDraft;
  const published = detail.currentPublished;
  const editable = detail.lifecycleStatus === "ACTIVE" && draft !== null;
  return (
    <div>
      <nav aria-label={labels.overview}>
        <a href={productListHref} className="inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2">← {labels.backToProducts}</a>
      </nav>
      <header className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-[-0.025em] text-slate-950">{detail.internalName}</h2>
          <div className="mt-3 space-y-2">
            {detail.publicationState === null ? null : <p className="font-semibold text-slate-950"><span className="sr-only">{labels.publication}: </span>{labels.publicationState[detail.publicationState]}</p>}
            <p className="text-sm font-semibold text-slate-700"><span className="sr-only">{labels.publicAvailability}: </span>{labels.availabilityStatus[detail.publicAvailability.status]}</p>
            <p className="text-sm text-slate-600">{labels.lifecycle}: {labels.lifecycleStatus[detail.lifecycleStatus]}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {detail.publicAvailability.status === "PUBLIC" ? <a href={detail.publicAvailability.url} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2">{labels.viewPublicDpp}</a> : null}
          {detail.lifecycleStatus === "ACTIVE" && published !== null && draft === null ? createDraftAction : null}
          {editable ? publishSection : null}
          {editable && contentEditHref && contentEditLabel ? <a href={contentEditHref} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-teal-700 px-4 py-2.5 text-sm font-bold text-teal-800 focus:ring-2 focus:ring-teal-600">{contentEditLabel}</a> : null}
          {editable && editHref && editLabel ? <a href={editHref} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-teal-700 px-4 py-2.5 text-sm font-bold text-teal-800 focus:ring-2 focus:ring-teal-600">{editLabel}</a> : null}
        </div>
      </header>

      <section aria-labelledby="product-identity-heading" className="mt-8">
        <h3 id="product-identity-heading" className="text-lg font-bold text-slate-950">{labels.identityTitle}</h3>
        <dl className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
          <Fact label={labels.internalName} value={detail.internalName} />
          <Fact label={labels.organizationSku} value={detail.organizationSku ?? labels.notAvailable} />
          <Fact label={labels.created} value={formattedDates.productCreatedAt} />
          <Fact label={labels.updated} value={formattedDates.productUpdatedAt} />
        </dl>
      </section>

      <section aria-labelledby="current-published-heading" className="mt-8 rounded-xl border border-slate-200 p-4 sm:p-5">
        <h3 id="current-published-heading" className="text-lg font-bold text-slate-950">{labels.publishedTitle}</h3>
        {published === null ? <p className="mt-3 text-sm leading-6 text-slate-600">{labels.publishedEmpty}</p> : (
          <>
            <p className="mt-1 text-sm text-slate-600">{labels.readOnly}</p>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Fact label={labels.status} value={labels.versionStatus.PUBLISHED} />
              <Fact label={labels.sourceLocale} value={published.sourceLocale.toUpperCase()} />
              <Fact label={labels.sourceProductName} value={published.sourceProductName} />
              <Fact label={labels.versionNumber} value={published.versionNumber.toString()} />
              <Fact label={labels.publishedAt} value={formattedDates.publishedAt ?? labels.notAvailable} />
            </dl>
            {publishedTranslations}
            <ProductDetailSnapshotContent snapshot={published} sourceLocale={published.sourceLocale} contentTitle={labels.contentTitle} labels={contentLabels} />
          </>
        )}
      </section>

      <section aria-labelledby="current-draft-heading" className="mt-8 rounded-xl border border-slate-200 p-4 sm:p-5">
        <h3 id="current-draft-heading" className="text-lg font-bold text-slate-950">{labels.draftTitle}</h3>
        {draft === null ? <p className="mt-3 text-sm leading-6 text-slate-600">{published === null ? labels.draftEmpty : labels.noDraftChanges}</p> : (
          <>
            <p className="mt-1 text-sm text-slate-600">{labels.draftPrivate}</p>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Fact label={labels.status} value={labels.versionStatus[draft.status]} />
              <Fact label={labels.sourceLocale} value={draft.sourceLocale.toUpperCase()} />
              <Fact label={labels.sourceProductName} value={draft.sourceProductName} />
              <Fact label={labels.created} value={formattedDates.draftCreatedAt ?? labels.notAvailable} />
              <Fact label={labels.updated} value={formattedDates.draftUpdatedAt ?? labels.notAvailable} />
            </dl>
            {draftTranslations}
            <ProductDetailSnapshotContent snapshot={draft} sourceLocale={draft.sourceLocale} contentTitle={labels.contentTitle} labels={contentLabels}
              cnSection={editable ? cnClassificationSection : undefined}
              materialsSection={editable ? materialsSection : undefined} />
          </>
        )}
      </section>
      {qrSection}
      <details className="mt-8 rounded-xl border border-slate-200 p-4">
        <summary className="cursor-pointer rounded text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600">{labels.technicalDetails}</summary>
        <dl className="mt-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{labels.publicCode}</dt>
          <dd className="mt-1 select-all break-all font-mono text-sm text-slate-900">{detail.publicCode}</dd>
        </dl>
        <p className="mt-2 text-xs leading-5 text-slate-500">{labels.publicCodeHint}</p>
      </details>
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
