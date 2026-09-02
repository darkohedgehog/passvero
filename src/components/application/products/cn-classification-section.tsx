"use client";

import { type FormEvent, useRef, useState } from "react";

import type { CnClassificationEditableField } from "@/src/application/products/cn-classification-current-draft/contracts";
import { mutateCnClassificationFromDashboard, type CnClassificationMutationPayload, type CnClassificationMutationUiResult } from "@/src/application/products/cn-classification-current-draft/ui-client";

export interface CnClassificationLabels {
  readonly title: string;
  readonly code: string;
  readonly year: string;
  readonly addClassification: string;
  readonly editClassification: string;
  readonly removeClassification: string;
  readonly save: string;
  readonly add: string;
  readonly remove: string;
  readonly cancel: string;
  readonly saving: string;
  readonly removing: string;
  readonly reload: string;
  readonly empty: string;
  readonly noDraft: string;
  readonly invalidCode: string;
  readonly invalidYear: string;
  readonly conflict: string;
  readonly staleWrite: string;
  readonly draftNotEditable: string;
  readonly forbidden: string;
  readonly failure: string;
  readonly helper: string;
  readonly confirmRemove: string;
}

interface CnView { readonly identifierId: string; readonly value: string; readonly nomenclatureYear: number; readonly updatedAt: string }
interface CnViewData {
  readonly productId: string;
  readonly cn: CnView | null;
  readonly expectedDraftVersionId: string;
  readonly expectedProductUpdatedAt: string;
  readonly expectedDraftUpdatedAt: string;
}

export function CnClassificationSection({ data, canEdit, labels, detailHref, currentUtcYear, loadFailed = false }: Readonly<{
  data: CnViewData | null;
  canEdit: boolean;
  labels: CnClassificationLabels;
  detailHref: string;
  currentUtcYear: number;
  loadFailed?: boolean;
}>) {
  const cn = data?.cn ?? null;
  return (
    <section aria-labelledby="cn-classification-heading" className="mt-8 rounded-xl border border-slate-200 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 id="cn-classification-heading" className="text-lg font-bold text-slate-950">{labels.title}</h3>
        {canEdit && data !== null && !loadFailed ? cn === null ? (
          <details className="group relative">
            <summary className={summaryClassName}>{labels.addClassification}</summary>
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:min-w-[28rem]">
              <CnForm data={data} labels={labels} detailHref={detailHref} currentUtcYear={currentUtcYear} />
            </div>
          </details>
        ) : (
          <div className="flex flex-wrap gap-3">
            <details>
              <summary className={summaryClassName}>{labels.editClassification}</summary>
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:min-w-[28rem]">
                <CnForm data={data} cn={cn} labels={labels} detailHref={detailHref} currentUtcYear={currentUtcYear} />
              </div>
            </details>
            <details>
              <summary className={removeSummaryClassName}>{labels.removeClassification}</summary>
              <RemoveForm data={data} cn={cn} labels={labels} detailHref={detailHref} />
            </details>
          </div>
        ) : null}
      </div>
      {loadFailed ? <p role="alert" className="mt-4 text-sm text-red-700">{labels.failure}</p> : data === null ? (
        <p className="mt-4 text-sm text-slate-600">{labels.noDraft}</p>
      ) : cn === null ? (
        <p className="mt-4 text-sm text-slate-600">{labels.empty}</p>
      ) : (
        <dl className="mt-4 grid gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
          <Fact label={labels.code} value={cn.value} mono />
          <Fact label={labels.year} value={String(cn.nomenclatureYear)} />
        </dl>
      )}
      <p className="mt-4 text-xs leading-5 text-slate-600">{labels.helper}</p>
    </section>
  );
}

function CnForm({ data, cn, labels, detailHref, currentUtcYear }: Readonly<{ data: CnViewData; cn?: CnView; labels: CnClassificationLabels; detailHref: string; currentUtcYear: number }>) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<CnClassificationMutationUiResult | null>(null);
  const inFlight = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const prefix = cn === undefined ? "cn-add" : "cn-edit";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setResult(null);
    const form = new FormData(event.currentTarget);
    const base = {
      value: String(form.get("value") ?? ""),
      nomenclatureYear: Number(form.get("nomenclatureYear")),
      expectedDraftVersionId: data.expectedDraftVersionId,
      expectedProductUpdatedAt: data.expectedProductUpdatedAt,
      expectedDraftUpdatedAt: data.expectedDraftUpdatedAt,
    };
    const payload: CnClassificationMutationPayload = cn === undefined ? { operation: "ADD", ...base } : { operation: "EDIT", identifierId: cn.identifierId, expectedIdentifierUpdatedAt: cn.updatedAt, ...base };
    const next = await mutateCnClassificationFromDashboard(window.fetch.bind(window), data.productId, payload);
    if (next.status === "SUCCESS") { window.location.assign(detailHref); return; }
    inFlight.current = false;
    setPending(false);
    setResult(next);
    requestAnimationFrame(() => {
      if (next.status === "FIELD_ERROR") formRef.current?.querySelector<HTMLElement>(`[name="${next.field}"]`)?.focus();
      else summaryRef.current?.focus();
    });
  }

  const message = resultMessage(result, labels);
  return (
    <form ref={formRef} onSubmit={submit} aria-busy={pending} noValidate>
      <ResultMessage refValue={summaryRef} message={message} stale={result?.status === "STALE_WRITE"} labels={labels} detailHref={detailHref} />
      <fieldset disabled={pending} className="grid gap-4">
        <Field id={`${prefix}-code`} label={labels.code} description={labels.helper} error={fieldError(result, "value", labels)}>
          <input id={`${prefix}-code`} name="value" type="text" inputMode="numeric" required maxLength={10} defaultValue={cn?.value ?? ""} aria-describedby={`${prefix}-helper`} aria-invalid={hasFieldError(result, "value") || undefined} className={inputClassName} />
        </Field>
        <Field id={`${prefix}-year`} label={labels.year} error={fieldError(result, "nomenclatureYear", labels)}>
          <input id={`${prefix}-year`} name="nomenclatureYear" type="number" inputMode="numeric" required min={1988} max={currentUtcYear} step={1} defaultValue={cn?.nomenclatureYear ?? currentUtcYear} aria-invalid={hasFieldError(result, "nomenclatureYear") || undefined} className={inputClassName} />
        </Field>
      </fieldset>
      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-slate-600">{pending ? labels.saving : ""}</p>
      <div className="mt-3 flex flex-wrap justify-end gap-3">
        <button type="button" disabled={pending} onClick={closeDetails} className={secondaryButtonClassName}>{labels.cancel}</button>
        <button type="submit" disabled={pending} aria-disabled={pending} className={primaryButtonClassName}>{cn === undefined ? labels.add : labels.save}</button>
      </div>
    </form>
  );
}

function RemoveForm({ data, cn, labels, detailHref }: Readonly<{ data: CnViewData; cn: CnView; labels: CnClassificationLabels; detailHref: string }>) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<CnClassificationMutationUiResult | null>(null);
  const inFlight = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  async function remove() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setResult(null);
    const next = await mutateCnClassificationFromDashboard(window.fetch.bind(window), data.productId, { operation: "REMOVE", identifierId: cn.identifierId, expectedIdentifierUpdatedAt: cn.updatedAt, expectedDraftVersionId: data.expectedDraftVersionId, expectedProductUpdatedAt: data.expectedProductUpdatedAt, expectedDraftUpdatedAt: data.expectedDraftUpdatedAt });
    if (next.status === "SUCCESS") { window.location.assign(detailHref); return; }
    inFlight.current = false;
    setPending(false);
    setResult(next);
    requestAnimationFrame(() => summaryRef.current?.focus());
  }
  const message = resultMessage(result, labels);
  return (
    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
      <p>{labels.confirmRemove}</p>
      <div ref={summaryRef} role={message === "" ? undefined : "alert"} aria-live="assertive" tabIndex={message === "" ? undefined : -1}>{message}</div>
      {result?.status === "STALE_WRITE" ? <a href={detailHref} className="mt-2 block font-bold underline focus:ring-2 focus:ring-teal-600">{labels.reload}</a> : null}
      <p role="status" aria-live="polite" className="mt-2 min-h-5">{pending ? labels.removing : ""}</p>
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        <button type="button" disabled={pending} onClick={closeDetails} className={secondaryButtonClassName}>{labels.cancel}</button>
        <button type="button" disabled={pending} aria-disabled={pending} onClick={remove} className={dangerButtonClassName}>{labels.remove}</button>
      </div>
    </div>
  );
}

function ResultMessage({ refValue, message, stale, labels, detailHref }: Readonly<{ refValue: React.RefObject<HTMLDivElement | null>; message: string; stale: boolean; labels: CnClassificationLabels; detailHref: string }>) {
  return <div ref={refValue} role={message === "" ? undefined : "alert"} aria-live="assertive" tabIndex={message === "" ? undefined : -1} className={message === "" ? "sr-only" : "mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"}>{message}{stale ? <a href={detailHref} className="mt-2 block font-bold underline focus:ring-2 focus:ring-teal-600">{labels.reload}</a> : null}</div>;
}

function Field({ id, label, description, error, children }: Readonly<{ id: string; label: string; description?: string; error?: React.ReactNode; children: React.ReactNode }>) {
  return <div><label htmlFor={id} className="block text-sm font-semibold text-slate-800">{label}</label>{children}{description ? <p id={`${id.slice(0, -4)}helper`} className="mt-1 text-xs leading-5 text-slate-600">{description}</p> : null}{error}</div>;
}
function Fact({ label, value, mono = false }: Readonly<{ label: string; value: string; mono?: boolean }>) { return <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className={`mt-1 text-sm font-semibold text-slate-900${mono ? " font-mono" : ""}`}>{value}</dd></div>; }
function hasFieldError(result: CnClassificationMutationUiResult | null, field: CnClassificationEditableField) { return result?.status === "FIELD_ERROR" && result.field === field; }
function fieldError(result: CnClassificationMutationUiResult | null, field: CnClassificationEditableField, labels: CnClassificationLabels) { return hasFieldError(result, field) ? <p role="alert" className="mt-1 text-sm text-red-700">{field === "value" ? labels.invalidCode : labels.invalidYear}</p> : null; }
function resultMessage(result: CnClassificationMutationUiResult | null, labels: CnClassificationLabels) { if (result === null || result.status === "SUCCESS" || result.status === "FIELD_ERROR") return ""; return result.status === "STALE_WRITE" ? labels.staleWrite : result.status === "DRAFT_NOT_EDITABLE" ? labels.draftNotEditable : result.status === "CN_CONFLICT" ? labels.conflict : result.status === "FORBIDDEN" ? labels.forbidden : labels.failure; }
function closeDetails(event: React.MouseEvent<HTMLButtonElement>) { event.currentTarget.closest("details")?.removeAttribute("open"); }

const inputClassName = "mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-600";
const summaryClassName = "inline-flex min-h-11 cursor-pointer list-none items-center justify-center rounded-lg border border-teal-700 px-4 py-2 text-sm font-bold text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2";
const removeSummaryClassName = "inline-flex min-h-11 cursor-pointer list-none items-center justify-center rounded-lg border border-red-700 px-4 py-2 text-sm font-bold text-red-800 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2";
const primaryButtonClassName = "min-h-11 rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:opacity-60";
const secondaryButtonClassName = "min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-60";
const dangerButtonClassName = "min-h-11 rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-60";
