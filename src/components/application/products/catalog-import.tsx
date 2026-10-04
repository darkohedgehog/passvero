"use client";

import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { PASSVERO_LOCALES } from "@/src/domain/values/passvero-locale";
import { IMPORT_FIELDS, IMPORT_BATCH_SIZE, MAX_IMPORT_BYTES, type ImportOptions, type ImportPreview, type ImportBatchState } from "@/src/application/products/import-catalog/contracts";

import { ProductActionIcon, editorInput, editorPrimaryAction, editorSecondaryAction } from "./product-editor-ui";

export function CatalogImport() {
  const t = useTranslations("CatalogImport");
  const fileInput = useRef<HTMLInputElement>(null);
  const fileHintId = useId();
  const blockedId = useId();
  const subscription = useTranslations("Subscription");
  const errors: Record<string, string> = Object.fromEntries((["FORBIDDEN", "FILE", "MAPPING", "VALIDATION", "STALE_PREVIEW", "SELECTION", "NOT_FOUND", "FAILED", "CANCELLED"] as const).map(k => [k, t(`errors.${k}`)]));
  const rowErrors: Record<string, string> = Object.fromEntries((["CREATE_PRODUCT_NAME_INVALID", "CREATE_PRODUCT_SKU_INVALID", "CREATE_PRODUCT_LOCALE_INVALID", "INVALID_GTIN", "INVALID_CN", "SKU_CONFLICT", "GTIN_REVIEW_REQUIRED", "ROW_FAILED", "INVALID_ROW"] as const).map(k => [k, t(`rowErrors.${k}`)]));
  for (const code of ["STORED_PRODUCT_LIMIT", "TRIAL_CREATION_LIMIT", "STORAGE_LIMIT", "PUBLICATION_LIMIT", "PDF_ATTACHMENT_LIMIT"] as const) rowErrors[code] = subscription(code);
  rowErrors.SUBSCRIPTION_EXPIRED = subscription("EXPIRED");
  rowErrors.SUBSCRIPTION_TRANSITION_REQUIRED = subscription("TRANSITION_REQUIRED");
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
  const hasGtinMatch = preview?.rows.some(row => selectedSet.has(row.number) && row.gtinMatch) ?? false;
  const conflicts = preview?.rows.filter(row => row.skuConflict).map(row => row.values.sku) ?? [];
  const blocked = busy ? t("working") : !selected.length
    ? conflicts.length ? t("blockedSku", { skus: [...new Set(conflicts)].slice(0, 3).join(", ") }) : t("blockedEmpty")
    : hasGtinMatch && !acceptGtin ? t("blockedGtin") : !confirmed ? t("blockedConfirm") : null;
  const succeeded = batch?.outcomes.filter(row => row.status === "SUCCEEDED").length ?? 0;
  const failed = batch?.outcomes.filter(row => row.status === "FAILED").length ?? 0;
  const pending = batch?.outcomes.filter(row => row.status === "PENDING").length ?? 0;
  const completeMessage = batch?.status === "COMPLETE"
    ? failed ? t(succeeded ? "partialSuccess" : "noSuccess") : t("success") : null;

  return <section className="mb-6 min-w-0 space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-busy={busy}>
    <header>
      <h2 className="flex items-center gap-2 text-xl font-bold text-slate-950"><ProductActionIcon name="upload" />{t("title")}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{t("createOnly")}</p>
    </header>
    <details className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
      <summary className="cursor-pointer font-semibold text-slate-800 focus-visible:outline-2 focus-visible:outline-teal-700">{t("help")}</summary>
      <div className="mt-3 space-y-2 leading-6"><p>{t("scope")}</p><p>{t("escape")}</p><p>{t("resumeHelp")}</p></div>
    </details>
    <fieldset disabled={busy || !!batch} className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <legend className="px-1 font-semibold text-slate-950">1. {t("steps.file")}</legend>
      <input ref={fileInput} className="sr-only" tabIndex={-1} aria-label={t("file")} type="file" accept=".csv,text/csv" onChange={event => { setFile(event.target.files?.[0] ?? null); setHeaders([]); invalidate(); }} />
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <button type="button" className={editorPrimaryAction} aria-describedby={fileHintId} onClick={() => fileInput.current?.click()}><ProductActionIcon name="upload" />{t("chooseFile")}</button>
        <p className="min-w-0 break-all text-sm font-medium text-slate-800" role="status">{file?.name ?? t("noFile")}</p>
      </div>
      <p id={fileHintId} className="text-sm text-slate-600">{t("file")}. {t("selectionOnly")}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">{t("delimiter")}<select className={editorInput} value={options.delimiter} onChange={event => { setOptions({ ...options, delimiter: event.target.value as "," | ";" }); setHeaders([]); invalidate(); }}><option value=",">,</option><option value=";">;</option></select></label>
        <button type="button" onClick={() => void act(loadHeaders)} disabled={!file} className={editorSecondaryAction}>{t("readHeader")}</button>
      </div>
    </fieldset>
    {headers.length > 0 && <fieldset disabled={busy || !!batch} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <legend className="px-1 font-semibold text-slate-950">2. {t("steps.mapping")}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        {IMPORT_FIELDS.map(field => <label key={field} className="min-w-0 text-sm font-medium text-slate-800">{t(`fields.${field}`)}<span className="ml-2 text-xs font-normal text-slate-500">({field})</span><select className={editorInput} value={options.mapping[field] ?? ""} onChange={event => { setOptions({ ...options, mapping: { ...options.mapping, [field]: event.target.value === "" ? null : Number(event.target.value) } }); invalidate(); }}><option value="">{t("notMapped")}</option>{headers.map((header, index) => <option key={index} value={index}>{header}</option>)}</select></label>)}
        <label className="text-sm font-medium">{t("defaultLocale")}<select className={editorInput} value={options.defaultLocale} onChange={event => { setOptions({ ...options, defaultLocale: event.target.value as ImportOptions["defaultLocale"] }); invalidate(); }}>{PASSVERO_LOCALES.map(locale => <option key={locale}>{locale}</option>)}</select></label>
      </div>
      <button type="button" className={`${editorSecondaryAction} mt-4`} onClick={() => void act(loadPreview)}><ProductActionIcon name="preview" />{t("preview")}</button>
    </fieldset>}
    {preview && <>
      <div className="min-w-0 space-y-4 rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-950">3. {t("steps.rows")}</h3>
        <p className="text-sm text-slate-600">{subscription("availableCreationSlots", { count: preview.availableCreationSlots ?? 0 })}</p>
        <p className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-800" role="status">{t("summary", { total: preview.rows.length, invalid: preview.invalidCount, errors: preview.errorCount, selected: selected.length, excluded: preview.rows.length - selected.length })}</p>
        {preview.ignored.length > 0 && <p className="break-words text-xs text-slate-500">{t("ignored")}: {preview.ignored.join(", ")}</p>}
        {!batch && <button type="button" disabled={busy} className={editorSecondaryAction} onClick={() => { setSelected(preview.rows.filter(row => row.valid && !row.skuConflict).map(row => row.number)); setConfirmed(false); }}>{t("selectValid")}</button>}
        <div className="overflow-x-auto rounded-lg border border-slate-200" tabIndex={0} role="region" aria-label={t("steps.rows")}><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th scope="col" className="p-3">{t("select")}</th><th scope="col" className="p-3">#</th>{IMPORT_FIELDS.map(field => <th scope="col" className="min-w-32 p-3" key={field}>{t(`fields.${field}`)}</th>)}<th scope="col" className="p-3">{t("result")}</th></tr></thead><tbody>{visible.map(row => {
          const outcome = outcomes.get(row.number);
          return <tr key={row.number} className="border-t border-slate-200 align-top"><td className="p-3"><input className="size-4 accent-teal-700" aria-label={t("row", { number: row.number })} type="checkbox" disabled={busy || !!batch || !row.valid || row.skuConflict} checked={selectedSet.has(row.number)} onChange={event => { setSelected(event.target.checked ? [...selected, row.number] : selected.filter(number => number !== row.number)); setConfirmed(false); }} /></td><td className="p-3">{row.number}</td>{IMPORT_FIELDS.map(field => <td key={field} className="max-w-64 whitespace-pre-wrap break-words p-3">{row.values[field]}</td>)}<td className="min-w-64 space-y-2 p-3">
            {!row.valid && <p className="text-red-800">{t("invalid")}{row.errors.length ? ` (${row.errors.map(code => rowErrors[code] ?? t("invalid")).join(", ")})` : ""}</p>}
            {row.skuConflict && <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 font-medium text-amber-950">{t("skuConflict")}</p>}
            {row.gtinMatch && <p className="text-amber-900">{t("gtinWarning")}</p>}{row.similarName && <p>{t("nameWarning")}</p>}{row.apostrophe && <p>{t("apostropheWarning")}</p>}{row.numericSku && <p>{t("numericWarning")}</p>}
            {outcome && <p className={outcome.status === "FAILED" ? "font-medium text-red-800" : "font-medium text-teal-800"}>{statuses[outcome.status]} {outcome.error ? (rowErrors[outcome.error] ?? t("invalid")) : ""}</p>}
            {outcome?.productId && <Link className="inline-flex min-h-11 items-center font-semibold text-teal-800 underline" href={`/dashboard/products/${outcome.productId}`}>{t("openProduct")}</Link>}
          </td></tr>;
        })}</tbody></table></div>
        <div className="flex flex-wrap items-center gap-3"><button type="button" className={editorSecondaryAction} disabled={page === 0} onClick={() => setPage(page - 1)}>{t("previous")}</button><span className="text-sm">{page + 1} / {Math.max(1, Math.ceil(preview.rows.length / 50))}</span><button type="button" className={editorSecondaryAction} disabled={(page + 1) * 50 >= preview.rows.length} onClick={() => setPage(page + 1)}>{t("next")}</button></div>
      </div>
      <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/30 p-4">
        <h3 className="font-semibold text-slate-950">4. {t("steps.confirm")}</h3>
        {!batch && <>
          {preview.rows.some(row => row.gtinMatch) && <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
            <label className="flex items-start gap-2"><input className="mt-1 size-4 shrink-0 accent-teal-700" type="checkbox" checked={acceptGtin} disabled={busy} onChange={event => { setAcceptGtin(event.target.checked); setConfirmed(false); }} /><span>{t("gtinAccept")}</span></label>
            <p className="text-amber-950">{t("gtinDoesNotResolveSku")}</p>
          </div>}
          {selected.length > 0 && <label className="flex items-start gap-2 text-sm"><input className="mt-1 size-4 shrink-0 accent-teal-700" type="checkbox" disabled={busy} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>{t("confirmHelp", { count: selected.length, excluded: preview.rows.length - selected.length })}</span></label>}
          {blocked && <p id={blockedId} role="status" className="text-sm font-medium leading-6 text-slate-700">{blocked}</p>}
          <button type="button" disabled={blocked !== null} aria-describedby={blocked ? blockedId : undefined} onClick={() => void act(confirm)} className={editorPrimaryAction}><ProductActionIcon name="add" />{t("confirm")}</button>
        </>}
        {batch && <>
          <p role="status" className="text-sm font-medium">{completeMessage ?? statuses[batch.status]} — {t("progress", { success: succeeded, failed, pending })}</p>
          <progress className="h-2 w-full accent-teal-700" aria-label={t("progressLabel")} max={Math.max(1, batch.selected.length)} value={succeeded + failed} />
          <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || batch.status === "CANCELLED"} onClick={() => void act(() => runBatches(batch))} className={editorSecondaryAction}>{batch.status === "COMPLETE" ? t("refreshReport") : t("resume")}</button>
            {batch.status === "ACTIVE" && <button type="button" className={editorSecondaryAction} onClick={() => { stop.current = true; void request("cancel", JSON.stringify({ id: batch.id }), true).then(data => setBatch(data as ImportBatchState)).catch(() => setError(t("errors.FAILED"))); }}>{t("cancel")}</button>}</div>
        </>}
      </div>
    </>}
    {busy && <div role="status" className="space-y-2 text-sm font-medium text-teal-800"><p>{t("working")}</p>{!batch && <progress className="h-2 w-full accent-teal-700" aria-label={t("working")} />}</div>}
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {batch && !busy && <button type="button" className={editorSecondaryAction} onClick={() => { invalidate(); setHeaders([]); setFile(null); if (fileInput.current) fileInput.current.value = ""; }}>{t("reset")}</button>}
  </section>;
}
