"use client";

import { useRef, useState } from "react";

export function CatalogExportAction({ search, labels }: Readonly<{
  search: string;
  labels: { button: string; pending: string; all: string; filtered: string; versionHelp: string; textHelp: string; failure: string; limit: string };
}>) {
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function download() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const query = new URLSearchParams(search ? { q: search } : {});
      const response = await fetch(`/api/products/export?${query}`, { credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(30_000) });
      if (!response.ok || !response.headers.get("content-type")?.startsWith("text/csv")) {
        setError(response.status === 422 ? labels.limit : labels.failure);
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "passvero-catalog-v1.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // Give the browser time to start the download before releasing its blob.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError(labels.failure); }
    finally { inFlight.current = false; setPending(false); }
  }
  return <section className="mb-6 space-y-2 rounded-lg border border-slate-200 p-4" aria-busy={pending}>
    <button type="button" onClick={download} disabled={pending} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-50">{pending ? labels.pending : labels.button}</button>
    <p className="text-sm text-slate-700">{search ? labels.filtered : labels.all}</p>
    <p className="text-sm text-slate-600">{labels.versionHelp}</p>
    <p className="text-sm text-slate-600">{labels.textHelp}</p>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
  </section>;
}
