"use client";
import { type FormEvent, useRef, useState } from "react";
import { DRAFT_TRANSLATION_CONTENT_FIELDS, type DraftTranslationContentField, type DraftTranslationContentValues } from "@/src/application/products/draft-translation-content/contracts";
import { updateDraftTranslationContentFromDashboard } from "@/src/application/products/draft-translation-content/draft-translation-content-ui-client";

export function DraftTranslationContentForm(props: Readonly<{ productId: string; sourceLocale: string; initialValues: DraftTranslationContentValues; evidence: Record<"expectedDraftVersionId" | "expectedProductUpdatedAt" | "expectedDraftUpdatedAt" | "expectedSourceTranslationUpdatedAt", string>; detailHref: string; labels: Record<DraftTranslationContentField | "sourceLocale" | "save" | "saving" | "cancel" | "reload" | "validationError" | "staleWrite" | "draftNotEditable" | "forbidden" | "failure", string> }>) {
  const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null); const [fieldError, setFieldError] = useState<DraftTranslationContentField | null>(null);
  const inFlight = useRef(false); const summary = useRef<HTMLDivElement>(null); const form = useRef<HTMLFormElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (inFlight.current) return; inFlight.current = true; setPending(true); setError(null); setFieldError(null);
    const data = new FormData(event.currentTarget); const values = Object.fromEntries(DRAFT_TRANSLATION_CONTENT_FIELDS.map((field) => [field, String(data.get(field) ?? "")])) as unknown as DraftTranslationContentValues;
    const result = await updateDraftTranslationContentFromDashboard(window.fetch.bind(window), props.productId, { ...values, ...props.evidence });
    if (result.status === "SUCCESS") { window.location.assign(props.detailHref); return; }
    inFlight.current = false; setPending(false);
    if (result.status === "FIELD_ERROR" && result.field) { setFieldError(result.field); requestAnimationFrame(() => form.current?.querySelector<HTMLElement>(`[name="${result.field}"]`)?.focus()); return; }
    const message = result.status === "STALE_WRITE" ? props.labels.staleWrite : result.status === "DRAFT_NOT_EDITABLE" ? props.labels.draftNotEditable : result.status === "FORBIDDEN" ? props.labels.forbidden : props.labels.failure;
    setError(message); requestAnimationFrame(() => summary.current?.focus());
  }
  return <form ref={form} onSubmit={submit} aria-busy={pending} className="space-y-6" noValidate>
    <div ref={summary} role={error ? "alert" : undefined} aria-live="assertive" tabIndex={error ? -1 : undefined} className={error ? "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" : "sr-only"}>{error}{error === props.labels.staleWrite ? <a href={props.detailHref} className="mt-2 block font-bold underline focus:ring-2 focus:ring-teal-600">{props.labels.reload}</a> : null}</div>
    <div><p className="text-sm font-semibold text-slate-800">{props.labels.sourceLocale}</p><p className="mt-2 text-sm font-semibold uppercase">{props.sourceLocale.toUpperCase()}</p></div>
    {DRAFT_TRANSLATION_CONTENT_FIELDS.map((field) => <div key={field}><label htmlFor={`content-${field}`} className="block text-sm font-semibold text-slate-800">{props.labels[field]}</label><textarea id={`content-${field}`} name={field} defaultValue={props.initialValues[field] ?? ""} rows={field === "shortDescription" ? 3 : 5} disabled={pending} aria-invalid={fieldError === field || undefined} aria-describedby={fieldError === field ? `${field}-error` : undefined} className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-base outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-600/30 disabled:bg-slate-100" />{fieldError === field ? <p id={`${field}-error`} className="mt-2 text-sm text-red-700">{props.labels.validationError}</p> : null}</div>)}
    <p aria-live="polite" role="status" className="min-h-6 text-sm text-slate-600">{pending ? props.labels.saving : ""}</p>
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><a href={props.detailHref} className="inline-flex min-h-11 items-center justify-center rounded-lg border px-4 py-2.5 font-bold focus:ring-2 focus:ring-teal-600">{props.labels.cancel}</a><button type="submit" disabled={pending} aria-disabled={pending} className="min-h-11 rounded-lg bg-teal-700 px-4 py-2.5 font-bold text-white focus:ring-2 focus:ring-teal-600 disabled:opacity-70">{pending ? props.labels.saving : props.labels.save}</button></div>
  </form>;
}
