"use client";

import { ProductActionIcon } from "./product-editor-ui";

import { useEffect, useRef, useState } from "react";
import type { CreateDraftFromPublishedCommand } from "@/src/application/products/create-draft-from-published/contracts";
import { createDraftFromDashboard, type CreateDraftUiStatus } from "@/src/application/products/create-draft-from-published/ui-client";
export interface CreateDraftLabels {
  edit: string; continueEditing: string; pending: string; imagesUnsupported: string; conflict: string; forbidden: string; failure: string; reload: string;
}
export function CreateDraftFromPublishedAction({ data, labels }: Readonly<{ data: CreateDraftFromPublishedCommand; labels: CreateDraftLabels }>) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<CreateDraftUiStatus | null>(null);
  const inFlight = useRef(false);
  const messageRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (result !== null) messageRef.current?.focus(); }, [result]);
  async function create() {
    if (inFlight.current) return;
    inFlight.current = true; setPending(true); setResult(null);
    const response = await createDraftFromDashboard(fetch, data.productId, data);
    if (response.status === "CREATED_NEW_DRAFT" || response.status === "EXISTING_DRAFT") { window.location.reload(); return; }
    setResult(response.status); setPending(false); inFlight.current = false;
  }
  const message = result === "IMAGES_UNSUPPORTED" ? labels.imagesUnsupported : result === "CONFLICT" ? labels.conflict : result === "FORBIDDEN" ? labels.forbidden : labels.failure;
  return <div aria-busy={pending} className="flex max-w-sm flex-col items-start gap-2">
    <button type="button" disabled={pending} onClick={create} className="inline-flex min-h-11 max-w-full gap-2 whitespace-normal [overflow-wrap:anywhere] items-center justify-center rounded-lg border border-teal-700 px-4 py-2.5 text-sm font-bold text-teal-800 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-teal-600"><ProductActionIcon name="edit" />{pending ? labels.pending : labels.edit}</button>
    {result === null ? null : <p ref={messageRef} tabIndex={-1} role="alert" className="text-sm text-slate-700">{message}</p>}
    {result === "CONFLICT" ? <button type="button" onClick={() => window.location.reload()} className="text-sm font-bold text-teal-800 underline">{labels.reload}</button> : null}
  </div>;
}
