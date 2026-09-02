"use client";

import { useEffect, useRef, useState } from "react";
import { publishProductFromDashboard, type PublishProductUiResult } from "@/src/application/products/publish-product/ui-client";

export interface PublishProductLabels {
  readonly title: string;
  readonly publish: string; readonly confirm: string; readonly publishing: string;
  readonly success: string; readonly noChange: string; readonly staleWrite: string;
  readonly notReady: string; readonly sourceTranslation: string; readonly productName: string;
  readonly publicAsset: string; readonly invalidState: string; readonly forbidden: string;
  readonly failure: string; readonly reload: string;
}

export function PublishProductSection({ data, labels }: Readonly<{ data: { productId: string; expectedDraftVersionId: string; expectedProductUpdatedAt: string; expectedDraftUpdatedAt: string; expectedCurrentPublishedVersionId: string | null }; labels: PublishProductLabels }>) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<PublishProductUiResult | null>(null);
  const inFlight = useRef(false);
  const resultRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (result !== null && result.status !== "PUBLISHED" && result.status !== "NO_CHANGE") resultRef.current?.focus();
  }, [result]);
  async function publish() {
    if (inFlight.current) return;
    if (!window.confirm(labels.confirm)) return;
    inFlight.current = true;
    setPending(true); setResult(null);
    const next = await publishProductFromDashboard(fetch, data.productId, data);
    setResult(next); setPending(false); inFlight.current = false;
    if (next.status === "PUBLISHED" || next.status === "NO_CHANGE") window.location.reload();
  }
  const message = result === null ? "" : result.status === "PUBLISHED" ? labels.success : result.status === "NO_CHANGE" ? labels.noChange : result.status === "STALE_WRITE" ? labels.staleWrite : result.status === "NOT_READY" ? `${labels.notReady} ${result.reason === "SOURCE_TRANSLATION" ? labels.sourceTranslation : result.reason === "PRODUCT_NAME" ? labels.productName : labels.publicAsset}` : result.status === "INVALID_STATE" || result.status === "NOT_FOUND" ? labels.invalidState : result.status === "FORBIDDEN" ? labels.forbidden : labels.failure;
  return (
    <div aria-busy={pending} className="flex flex-col items-start gap-2">
      <span className="sr-only">{labels.title}</span>
      <button type="button" disabled={pending} onClick={publish} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-600 disabled:cursor-wait disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2">{pending ? labels.publishing : labels.publish}</button>
      <p ref={resultRef} tabIndex={-1} aria-live="polite" className="text-sm text-slate-700 focus:outline-none">{message}</p>
      {result?.status === "STALE_WRITE" ? <button type="button" onClick={() => window.location.reload()} className="text-sm font-bold text-teal-800 underline">{labels.reload}</button> : null}
    </div>
  );
}
