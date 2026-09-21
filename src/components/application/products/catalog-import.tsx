"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { PASSVERO_LOCALES } from "@/src/domain/values/passvero-locale";
import { IMPORT_FIELDS, IMPORT_BATCH_SIZE, MAX_IMPORT_BYTES, type ImportOptions, type ImportPreview, type ImportBatchState } from "@/src/application/products/import-catalog/contracts";

export function CatalogImport() {
  const t = useTranslations("CatalogImport");
  const errors: Record<string, string> = Object.fromEntries((["FORBIDDEN", "FILE", "MAPPING", "VALIDATION", "STALE_PREVIEW", "SELECTION", "NOT_FOUND", "FAILED", "CANCELLED"] as const).map(k => [k, t(`errors.${k}`)]));
  const rowErrors: Record<string, string> = Object.fromEntries((["CREATE_PRODUCT_NAME_INVALID", "CREATE_PRODUCT_SKU_INVALID", "CREATE_PRODUCT_LOCALE_INVALID", "INVALID_GTIN", "INVALID_CN", "SKU_CONFLICT", "GTIN_REVIEW_REQUIRED", "ROW_FAILED", "INVALID_ROW"] as const).map(k => [k, t(`rowErrors.${k}`)]));
  const statuses: Record<string, string> = Object.fromEntries((["PENDING", "SUCCEEDED", "FAILED", "ACTIVE", "COMPLETE", "CANCELLED"] as const).map(k => [k, t(`status.${k}`)]));
  const [file, setFile] = useState<File | null>(null);
  const [options, setOptions] = useState<ImportOptions>({ delimiter: ",", defaultLocale: "hr", mapping: { internal_name: null, sku: null, source_locale: null, gtin: null, cn_code: null, cn_nomenclature_year: null } });
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [acceptGtin, setAcceptGtin] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [batch, setBatch] = useState<ImportBatchState | null>(null);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false), stop = useRef(false);
  function invalidate() { setPreview(null); setSelected([]); setBatch(null); setConfirmed(false); setAcceptGtin(false); setPage(0); setError(null); }
  async function request(action: string, body: BodyInit, json = false) {
    const response = await fetch(`/api/products/import?action=${action}`, { method: "POST", credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer", headers: json ? { "content-type": "application/json" } : undefined, body, signal: AbortSignal.timeout(45_000) });
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.code === "string" ? data.code : "FAILED");
    return data;
  }
  async function upload(action: string) {
    if (!file || file.size > MAX_IMPORT_BYTES || !/\.csv$/i.test(file.name)) throw new Error("FILE");
    const form = new FormData(); form.set("file", file); form.set("options", JSON.stringify(options));
    if (action === "confirm") form.set("confirmation", JSON.stringify({ token: preview?.token, selected, acceptGtinMatches: acceptGtin }));
    return request(action, form);
  }
  async function act(work: () => Promise<void>) {
    if (running.current) return; running.current = true; setBusy(true); setError(null);
    try { await work(); } catch (e) { const code = e instanceof Error ? e.message : "FAILED"; setError(errors[code] ?? t("errors.FAILED")); }
    finally { running.current = false; setBusy(false); }
  }
  async function loadHeaders() {
    const data: { headers: string[] } = await upload("headers"); setHeaders(data.headers);
    setOptions(previous => ({ ...previous, mapping: Object.fromEntries(IMPORT_FIELDS.map(f => [f, data.headers.includes(f) ? data.headers.indexOf(f) : null])) as ImportOptions["mapping"] }));
    invalidate();
  }
  async function loadPreview() {
    const data: ImportPreview = await upload("preview"); setPreview(data); setPage(0); setConfirmed(false); setBatch(data.existing); setSelected(data.existing?.selected ?? []);
  }
  async function runBatches(initial: ImportBatchState) {
    if (!preview) return;
    stop.current = false; let current = initial;
    do {
      const pending = current.outcomes.filter(r => r.status === "PENDING").map(r => r.number);
      // A completed import may be re-delivered safely when refreshing its report.
      const numbers = (pending.length ? pending : current.selected).slice(0, IMPORT_BATCH_SIZE);
      if (!numbers.length || current.status === "CANCELLED") break;
      const rows = numbers.map(number => ({ number, values: preview.rows[number - 1]!.values }));
      current = await request("execute", JSON.stringify({ id: current.id, rows }), true) as ImportBatchState;
      setBatch(current);
      if (current.status !== "ACTIVE" || !current.outcomes.some(r => r.status === "PENDING")) break;
    } while (!stop.current);
  }
  async function confirm() { const data: ImportBatchState = await upload("confirm"); setBatch(data); await runBatches(data); }
  const selectedSet = new Set(selected);
  const visible = preview?.rows.slice(page * 50, (page + 1) * 50) ?? [];
  const outcomes = new Map(batch?.outcomes.map(r => [r.number, r]));
  return <section className="mb-6 space-y-4 rounded-xl border border-slate-200 p-4" aria-busy={busy}>
    <h2 className="text-xl font-semibold">{t("title")}</h2><p className="text-sm text-slate-600">{t("scope")}</p>
    <p className="text-sm text-slate-600">{t("escape")}</p>
    <fieldset disabled={busy || !!batch} className="flex flex-wrap gap-4">
      <label className="min-w-0 flex-1">{t("file")}<input className="block max-w-full text-sm" type="file" accept=".csv,text/csv" onChange={e => { setFile(e.target.files?.[0] ?? null); setHeaders([]); invalidate(); }} /></label>
      <label>{t("delimiter")}<select className="ml-2 rounded border p-2" value={options.delimiter} onChange={e => { setOptions({ ...options, delimiter: e.target.value as "," | ";" }); setHeaders([]); invalidate(); }}><option value=",">,</option><option value=";">;</option></select></label>
      <button type="button" onClick={() => void act(loadHeaders)} disabled={!file} className="rounded border px-3 py-2">{t("readHeader")}</button>
    </fieldset>
    {headers.length > 0 && <fieldset disabled={busy || !!batch} className="grid gap-3 sm:grid-cols-2">
      {IMPORT_FIELDS.map(field => <label key={field} className="min-w-0 text-sm">{field}<select className="mt-1 block w-full rounded border p-2" value={options.mapping[field] ?? ""} onChange={e => { setOptions({ ...options, mapping: { ...options.mapping, [field]: e.target.value === "" ? null : Number(e.target.value) } }); invalidate(); }}><option value="">{t("notMapped")}</option>{headers.map((h,i) => <option key={i} value={i}>{h}</option>)}</select></label>)}
      <label>{t("defaultLocale")}<select className="ml-2 rounded border p-2" value={options.defaultLocale} onChange={e => { setOptions({ ...options, defaultLocale: e.target.value as ImportOptions["defaultLocale"] }); invalidate(); }}>{PASSVERO_LOCALES.map(l => <option key={l}>{l}</option>)}</select></label>
      <button type="button" className="rounded border px-3 py-2" onClick={() => void act(loadPreview)}>{t("preview")}</button>
    </fieldset>}
    {preview && <>
      <p className="text-sm">{t("ignored")}: {preview.ignored.join(", ") || "—"}</p>
      <p className="text-sm" role="status">{t("summary", { total: preview.rows.length, invalid: preview.invalidCount, errors: preview.errorCount, selected: selected.length, excluded: preview.rows.length - selected.length })}</p>
      {!batch && <>
        <button type="button" disabled={busy} className="rounded border px-3 py-2" onClick={() => { setSelected(preview.rows.filter(r => r.valid && !r.skuConflict).map(r => r.number)); setConfirmed(false); }}>{t("selectValid")}</button>
        <label className="block text-sm"><input type="checkbox" checked={acceptGtin} disabled={busy} onChange={e => { setAcceptGtin(e.target.checked); setConfirmed(false); }} /> {t("gtinAccept")}</label>
      </>}
      <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th>{t("select")}</th><th>#</th>{IMPORT_FIELDS.map(f => <th className="p-2" key={f}>{f}</th>)}<th>{t("result")}</th></tr></thead><tbody>{visible.map(row => {
        const outcome = outcomes.get(row.number);
        return <tr key={row.number} className="border-t"><td><input aria-label={t("row", { number: row.number })} type="checkbox" disabled={busy || !!batch || !row.valid || row.skuConflict} checked={selectedSet.has(row.number)} onChange={e => { setSelected(e.target.checked ? [...selected, row.number] : selected.filter(n => n !== row.number)); setConfirmed(false); }} /></td><td>{row.number}</td>{IMPORT_FIELDS.map(f => <td key={f} className="max-w-64 whitespace-pre-wrap break-words p-2">{row.values[f]}</td>)}<td className="min-w-44 p-2">
          {!row.valid && <p>{t("invalid")}{row.errors.length ? ` (${row.errors.map(code => rowErrors[code] ?? t("invalid")).join(", ")})` : ""}</p>}
          {row.skuConflict && <p>{t("skuConflict")}</p>}{row.gtinMatch && <p>{t("gtinWarning")}</p>}{row.similarName && <p>{t("nameWarning")}</p>}{row.apostrophe && <p>{t("apostropheWarning")}</p>}{row.numericSku && <p>{t("numericWarning")}</p>}
          {outcome && <p>{statuses[outcome.status]} {outcome.error ? (rowErrors[outcome.error] ?? t("invalid")) : ""}</p>}
          {outcome?.productId && <Link className="underline" href={`/dashboard/products/${outcome.productId}`}>{t("openProduct")}</Link>}
        </td></tr>;
      })}</tbody></table></div>
      <div className="flex gap-3"><button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>{t("previous")}</button><span>{page+1} / {Math.max(1,Math.ceil(preview.rows.length/50))}</span><button type="button" disabled={(page+1)*50 >= preview.rows.length} onClick={() => setPage(page + 1)}>{t("next")}</button></div>
      {!batch && <><label className="block text-sm"><input type="checkbox" disabled={busy} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> {t("confirmHelp", { count: selected.length, excluded: preview.rows.length-selected.length })}</label><button type="button" disabled={busy || !confirmed || !selected.length || (!acceptGtin && preview.rows.some(r => selectedSet.has(r.number) && r.gtinMatch))} onClick={() => void act(confirm)} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{t("confirm")}</button></>}
      {batch && <>
        <p role="status">{t("progress", { success: batch.outcomes.filter(r=>r.status==='SUCCEEDED').length, failed: batch.outcomes.filter(r=>r.status==='FAILED').length, pending: batch.outcomes.filter(r=>r.status==='PENDING').length })} — {statuses[batch.status]}</p>
        <button type="button" disabled={busy || batch.status === "CANCELLED"} onClick={() => void act(() => runBatches(batch))} className="rounded border px-3 py-2">{batch.status === "COMPLETE" ? t("refreshReport") : t("resume")}</button>
        {batch.status === "ACTIVE" && <button type="button" className="ml-2 rounded border px-3 py-2" onClick={() => { stop.current = true; void request("cancel",JSON.stringify({id:batch.id}),true).then(data=>setBatch(data as ImportBatchState)).catch(()=>setError(t("errors.FAILED"))); }}>{t("cancel")}</button>}
      </>}
    </>}
    <p className="text-sm text-slate-600">{t("resumeHelp")}</p>
    {batch && !busy && <button type="button" className="rounded border px-3 py-2" onClick={() => { invalidate(); setHeaders([]); setFile(null); }}>{t("reset")}</button>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {busy && <p role="status">{t("working")}</p>}
  </section>;
}
