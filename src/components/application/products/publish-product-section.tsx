"use client";

import { ProductActionIcon } from "./product-editor-ui";

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { publishProductFromDashboard, type PublishProductUiResult } from "@/src/application/products/publish-product/ui-client";

export interface PublishProductLabels {
  readonly title: string;
  readonly publish: string; readonly confirm: string; readonly publishing: string;
  readonly success: string; readonly noChange: string; readonly staleWrite: string;
  readonly notReady: string; readonly sourceTranslation: string; readonly productName: string; readonly translations: string;
  readonly publicAsset: string; readonly invalidState: string; readonly forbidden: string;
  readonly failure: string; readonly reload: string;
}

type PublishData = { productId: string; expectedDraftVersionId: string; expectedProductUpdatedAt: string; expectedDraftUpdatedAt: string; expectedCurrentPublishedVersionId: string | null };
type PublishProps = Readonly<{ data: PublishData; labels: PublishProductLabels }>;
const PublishContext = createContext<ReturnType<typeof usePublishState> | null>(null);

function usePublishState() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<PublishProductUiResult | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const inFlight = useRef(false);
  async function publish(data: PublishData, labels: PublishProductLabels, originId: string) {
    if (inFlight.current) return;
    if (!window.confirm(labels.confirm)) return;
    inFlight.current = true;
    setActiveId(originId);
    setPending(true); setResult(null);
    const next = await publishProductFromDashboard(fetch, data.productId, data);
    setResult(next); setPending(false); inFlight.current = false;
    if (next.status === "PUBLISHED" || next.status === "NO_CHANGE") window.location.reload();
  }
  return { pending, result, activeId, publish };
}

// Both placements share one mutation guard; surrounding server content stays server-rendered.
export function PublishProductScope({ children }: Readonly<{ children: ReactNode }>) {
  return <PublishContext.Provider value={usePublishState()}>{children}</PublishContext.Provider>;
}

export function PublishProductSection(props: PublishProps) {
  const shared = useContext(PublishContext);
  return shared ? <PublishControl {...props} /> : <PublishProductScope><PublishControl {...props} /></PublishProductScope>;
}

function PublishControl({ data, labels }: PublishProps) {
  const shared = useContext(PublishContext);
  if (!shared) throw new Error("Publish control requires its scope");
  return <PublishControlContent data={data} labels={labels} shared={shared} />;
}

function PublishControlContent({ data, labels, shared }: PublishProps & { shared: ReturnType<typeof usePublishState> }) {
  const { pending, result, activeId, publish } = shared;
  const id = useId();
  const resultRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (activeId === id && result !== null && result.status !== "PUBLISHED" && result.status !== "NO_CHANGE") resultRef.current?.focus();
  }, [activeId, id, result]);
  const message = result === null ? "" : result.status === "PUBLISHED" ? labels.success : result.status === "NO_CHANGE" ? labels.noChange : result.status === "STALE_WRITE" ? labels.staleWrite : result.status === "NOT_READY" ? `${labels.notReady} ${result.reason === "TRANSLATIONS" ? labels.translations : result.reason === "SOURCE_TRANSLATION" ? labels.sourceTranslation : result.reason === "PRODUCT_NAME" ? labels.productName : labels.publicAsset}` : result.status === "INVALID_STATE" || result.status === "NOT_FOUND" ? labels.invalidState : result.status === "FORBIDDEN" ? labels.forbidden : labels.failure;
  return (
    <div aria-busy={pending} className="flex flex-col items-start gap-2">
      <span className="sr-only">{labels.title}</span>
      <button type="button" disabled={pending} onClick={() => void publish(data, labels, id)} className="inline-flex min-h-11 max-w-full gap-2 whitespace-normal [overflow-wrap:anywhere] items-center justify-center rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-600 disabled:cursor-wait disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"><ProductActionIcon name="publish" />{pending ? labels.publishing : labels.publish}</button>
      <p ref={resultRef} tabIndex={-1} aria-live="polite" className="text-sm text-slate-700 focus:outline-none">{message}</p>
      {result?.status === "STALE_WRITE" ? <button type="button" onClick={() => window.location.reload()} className="text-sm font-bold text-teal-800 underline">{labels.reload}</button> : null}
    </div>
  );
}
