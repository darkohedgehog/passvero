"use client";

import { ProductActionIcon } from "./product-editor-ui";

import { useEffect, useRef, useState } from "react";
import type { ProductQrProjection } from "@/src/application/products/qr/contracts";
import { activateQrFromDashboard, type QrUiResult } from "@/src/application/products/qr/ui-client";

export interface ProductQrLabels {
  readonly title: string; readonly pending: string; readonly active: string; readonly revoked: string;
  readonly activate: string; readonly confirm: string; readonly activating: string; readonly success: string;
  readonly stale: string; readonly forbidden: string; readonly unavailable: string; readonly previewAlt: string;
  readonly downloadSvg: string; readonly downloadPng: string; readonly publicationRequired: string;
  readonly noLongerAvailable: string; readonly helper: string; readonly reload: string;
}
const linkClass = "inline-flex min-h-11 max-w-full gap-2 whitespace-normal [overflow-wrap:anywhere] items-center rounded-lg px-3 py-2 text-sm font-bold text-teal-800 underline focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2";
export function ProductQrSection({ productId, data, labels }: Readonly<{
  productId: string; data: ProductQrProjection | null; labels: ProductQrLabels;
}>) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<QrUiResult | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const inFlight = useRef(false);
  const resultRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (result !== null) resultRef.current?.focus(); }, [result]);
  async function activate() {
    if (inFlight.current || result?.status === "STALE_WRITE" || data?.kind !== "QR" || data.activationEvidence === null) return;
    if (!window.confirm(labels.confirm)) return;
    inFlight.current = true;
    setPending(true); setResult(null);
    const next = await activateQrFromDashboard(fetch, productId, data.activationEvidence);
    setResult(next); setPending(false); inFlight.current = false;
    if (next.status === "ACTIVATED" || next.status === "NO_CHANGE") window.location.reload();
  }
  const message = result === null ? "" : result.status === "ACTIVATED" || result.status === "NO_CHANGE" ? labels.success
    : result.status === "STALE_WRITE" ? labels.stale : result.status === "FORBIDDEN" || result.status === "UNAUTHENTICATED" ? labels.forbidden
    : result.status === "INVALID_STATE" || result.status === "NOT_FOUND" ? labels.noLongerAvailable : labels.unavailable;
  return (
    <section aria-labelledby="product-qr-heading" aria-busy={pending} className="mt-8 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <h3 id="product-qr-heading" className="text-lg font-bold text-slate-950">{labels.title}</h3>
      {data === null ? <p role="alert" className="mt-3 text-sm text-slate-700">{labels.unavailable}</p>
        : data.kind === "NOT_PUBLISHED" ? <p className="mt-3 text-sm text-slate-700">{labels.publicationRequired}</p>
        : <>
          <p className="mt-3 text-sm font-semibold text-slate-800">{data.status === "PENDING" ? labels.pending : data.status === "ACTIVE" ? labels.active : labels.revoked}</p>
          {data.status === "PENDING" && data.activationEvidence !== null ? <>
            <p className="mt-2 text-sm leading-6 text-slate-600">{labels.helper}</p>
            <button type="button" disabled={pending || result?.status === "STALE_WRITE"} onClick={activate} className="mt-3 inline-flex min-h-11 max-w-full gap-2 whitespace-normal [overflow-wrap:anywhere] items-center justify-center rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2">{pending ? labels.activating : labels.activate}</button>
          </> : null}
          {data.status === "ACTIVE" && data.previewUrl !== null && !previewFailed ? <>
            {/* Authenticated image delivery must bypass the Next image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.previewUrl} alt={labels.previewAlt} width={256} height={256} referrerPolicy="no-referrer" onError={() => setPreviewFailed(true)} className="mt-4 h-auto w-64 max-w-full bg-white" />
            <div className="mt-3 flex flex-wrap gap-2">
              {data.downloadSvgUrl !== null ? <a href={data.downloadSvgUrl} className={linkClass}><ProductActionIcon name="download" />{labels.downloadSvg}</a> : null}
              {data.downloadPngUrl !== null ? <a href={data.downloadPngUrl} className={linkClass}><ProductActionIcon name="download" />{labels.downloadPng}</a> : null}
            </div>
          </> : null}
          {data.status === "REVOKED" || (data.status === "ACTIVE" && data.previewUrl === null) || previewFailed ? <p role="status" className="mt-3 text-sm text-slate-700">{labels.noLongerAvailable}</p> : null}
        </>}
      <p ref={resultRef} tabIndex={-1} aria-live="polite" className="mt-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600">{message}</p>
      {result?.status === "STALE_WRITE" || previewFailed ? <button type="button" onClick={() => window.location.reload()} className={linkClass}>{labels.reload}</button> : null}
    </section>
  );
}
