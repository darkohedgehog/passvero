"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";

const statusSchema = z.object({
  status: z.enum(["UNSCANNED", "PENDING", "CLEAN", "INFECTED", "ERROR"]),
  available: z.boolean(), cleanEligible: z.boolean(), recoverable: z.boolean(),
  expectedAttemptId: z.string().uuid().nullable(),
}).strict();
const button = "inline-flex min-h-11 items-center justify-center rounded-lg border border-teal-700 px-3 py-2 text-sm font-semibold text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-50";

export function DocumentScanControls({ documentId, canEdit }: Readonly<{ documentId: string; canEdit: boolean }>) {
  const t = useTranslations("DocumentScan");
  const [state, setState] = useState<z.infer<typeof statusSchema> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);
  const mutation = useRef<AbortController | null>(null);
  const endpoint = `/api/documents/${encodeURIComponent(documentId)}/scan`;
  const read = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(endpoint, { cache: "no-store", signal });
    if (!response.ok) throw new Error();
    const value = statusSchema.parse(await response.json());
    setState(value);
  }, [endpoint]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => { void read(controller.signal).catch(() => { if (!controller.signal.aborted) setError(true); }); }, 0);
    return () => { clearTimeout(timer); controller.abort(); mutation.current?.abort(); };
  }, [read]);
  useEffect(() => {
    if (state?.status !== "PENDING" || state.recoverable) return;
    const controller = new AbortController();
    let count = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { await read(controller.signal); }
      catch { if (!controller.signal.aborted) setError(true); return; }
      if (++count < 40 && !controller.signal.aborted) timer = setTimeout(() => void poll(), 3000);
    };
    timer = setTimeout(() => void poll(), 3000);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [state?.status, state?.recoverable, read]);
  async function act(operation: "SCAN" | "RECOVER") {
    if (inFlight.current || !canEdit || !state?.available) return;
    inFlight.current = true; setBusy(true); setError(false);
    const controller = new AbortController(); mutation.current = controller;
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(95_000)]),
        body: JSON.stringify(operation === "SCAN" ? { operation } : { operation, expectedAttemptId: state.expectedAttemptId }) });
      if (!response.ok) setError(true); // Do not promise a terminal verdict on failed finalization.
      await read(controller.signal);
    } catch { if (!controller.signal.aborted) setError(true); }
    finally { inFlight.current = false; mutation.current = null; setBusy(false); }
  }
  return <div className="mt-3 space-y-2">
    <p role="status" className="text-sm font-medium">{t(busy ? "working" : state ? `statuses.${state.status}` : "loading")}</p>
    {state?.status === "CLEAN" && !state.cleanEligible ? <p className="text-sm">{t("expired")}</p> : null}
    {error ? <p role="alert" className="text-sm text-red-800">{t("failure")}</p> : null}
    <div className="flex flex-wrap gap-2">
      {canEdit && state?.available && ["UNSCANNED", "ERROR", "CLEAN"].includes(state.status)
        ? <button type="button" className={button} disabled={busy} onClick={() => void act("SCAN")}>{t("scan")}</button> : null}
      {canEdit && state?.recoverable && state.expectedAttemptId
        ? <button type="button" className={button} disabled={busy} onClick={() => void act("RECOVER")}>{t("recover")}</button> : null}
      {state?.cleanEligible ? <a className={button} href={`/api/documents/${encodeURIComponent(documentId)}`}>{t("download")}</a>
        : <span className="text-sm">{t("blocked")}</span>}
      <button type="button" className={button} disabled={busy} onClick={() => { setError(false); void read().catch(() => setError(true)); }}>{t("refresh")}</button>
    </div>
  </div>;
}
