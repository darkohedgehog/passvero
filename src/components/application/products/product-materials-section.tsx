"use client";

import { type FormEvent, useRef, useState } from "react";

import type { ProductMaterialEditableField } from "@/src/application/products/product-materials-current-draft/contracts";
import {
  mutateProductMaterialFromDashboard,
  type ProductMaterialMutationPayload,
  type ProductMaterialMutationUiResult,
} from "@/src/application/products/product-materials-current-draft/ui-client";

export interface ProductMaterialsLabels {
  readonly title: string;
  readonly empty: string;
  readonly noDraft: string;
  readonly addMaterial: string;
  readonly editMaterial: string;
  readonly removeMaterial: string;
  readonly materialName: string;
  readonly category: string;
  readonly optional: string;
  readonly percentage: string;
  readonly percentageDescription: string;
  readonly containsRecycled: string;
  readonly recycledPercentage: string;
  readonly recycledPercentageDescription: string;
  readonly save: string;
  readonly add: string;
  readonly remove: string;
  readonly cancel: string;
  readonly saving: string;
  readonly removing: string;
  readonly reload: string;
  readonly staleWrite: string;
  readonly collectionInvalid: string;
  readonly validationError: string;
  readonly draftNotEditable: string;
  readonly forbidden: string;
  readonly failure: string;
  readonly confirmRemove: string;
  readonly yes: string;
  readonly no: string;
  readonly notSpecified: string;
}

interface MaterialView {
  readonly materialId: string;
  readonly materialName: string;
  readonly category: string | null;
  readonly percentage: string | null;
  readonly isRecycled: boolean;
  readonly recycledPercentage: string | null;
  readonly updatedAt: string;
}

interface MaterialsViewData {
  readonly productId: string;
  readonly materials: readonly MaterialView[];
  readonly expectedDraftVersionId: string;
  readonly expectedProductUpdatedAt: string;
  readonly expectedDraftUpdatedAt: string;
}

export function ProductMaterialsSection({
  data,
  canEdit,
  labels,
  detailHref,
  loadFailed = false,
}: Readonly<{
  data: MaterialsViewData | null;
  canEdit: boolean;
  labels: ProductMaterialsLabels;
  detailHref: string;
  loadFailed?: boolean;
}>) {
  return (
    <section aria-labelledby="materials-heading" className="mt-8 rounded-xl border border-slate-200 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 id="materials-heading" className="text-lg font-bold text-slate-950">{labels.title}</h3>
        {canEdit && data !== null && !loadFailed ? (
          <details className="group relative">
            <summary className={summaryClassName}>{labels.addMaterial}</summary>
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:min-w-[32rem]">
              <MaterialForm data={data} labels={labels} detailHref={detailHref} />
            </div>
          </details>
        ) : null}
      </div>

      {loadFailed ? <p role="alert" className="mt-4 text-sm text-red-700">{labels.failure}</p> : data === null ? (
        <p className="mt-4 text-sm text-slate-600">{labels.noDraft}</p>
      ) : data.materials.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">{labels.empty}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-3 py-3 font-semibold">{labels.materialName}</th>
                <th scope="col" className="px-3 py-3 font-semibold">{labels.category}</th>
                <th scope="col" className="px-3 py-3 font-semibold">{labels.percentage}</th>
                <th scope="col" className="px-3 py-3 font-semibold">{labels.containsRecycled}</th>
                <th scope="col" className="px-3 py-3 font-semibold">{labels.recycledPercentage}</th>
                {canEdit ? <th scope="col" className="px-3 py-3 font-semibold"><span className="sr-only">{labels.editMaterial}</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {data.materials.map((material) => (
                <tr key={material.materialId} className="border-b border-slate-100 align-top last:border-0">
                  <th scope="row" className="px-3 py-4 font-semibold text-slate-950">{material.materialName}</th>
                  <td className="px-3 py-4 text-slate-700">{material.category ?? labels.notSpecified}</td>
                  <td className="px-3 py-4 tabular-nums text-slate-700">{formatPercentage(material.percentage, labels.notSpecified)}</td>
                  <td className="px-3 py-4 text-slate-700">{material.isRecycled ? labels.yes : labels.no}</td>
                  <td className="px-3 py-4 tabular-nums text-slate-700">{formatPercentage(material.recycledPercentage, labels.notSpecified)}</td>
                  {canEdit ? (
                    <td className="px-3 py-4">
                      <div className="flex flex-col items-start gap-2">
                        <details className="w-full">
                          <summary className={rowSummaryClassName}>{labels.editMaterial}</summary>
                          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <MaterialForm data={data} material={material} labels={labels} detailHref={detailHref} />
                          </div>
                        </details>
                        <details className="w-full">
                          <summary className={removeSummaryClassName}>{labels.removeMaterial}</summary>
                          <RemoveForm data={data} material={material} labels={labels} detailHref={detailHref} />
                        </details>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function MaterialForm({
  data,
  material,
  labels,
  detailHref,
}: Readonly<{
  data: MaterialsViewData;
  material?: MaterialView;
  labels: ProductMaterialsLabels;
  detailHref: string;
}>) {
  const [isRecycled, setIsRecycled] = useState(material?.isRecycled ?? false);
  const [recycledPercentage, setRecycledPercentage] = useState(material?.recycledPercentage ?? "");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ProductMaterialMutationUiResult | null>(null);
  const inFlight = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const prefix = material === undefined ? "material-add" : `material-edit-${material.materialId}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setResult(null);
    const form = new FormData(event.currentTarget);
    const base = {
      materialName: String(form.get("materialName") ?? ""),
      category: nullableFormValue(form.get("category")),
      percentage: nullableFormValue(form.get("percentage")),
      isRecycled,
      recycledPercentage: isRecycled ? nullableFormValue(form.get("recycledPercentage")) : null,
      expectedDraftVersionId: data.expectedDraftVersionId,
      expectedProductUpdatedAt: data.expectedProductUpdatedAt,
      expectedDraftUpdatedAt: data.expectedDraftUpdatedAt,
    };
    const payload: ProductMaterialMutationPayload = material === undefined
      ? { operation: "ADD", ...base }
      : {
          operation: "EDIT",
          materialId: material.materialId,
          expectedMaterialUpdatedAt: material.updatedAt,
          ...base,
        };
    const next = await mutateProductMaterialFromDashboard(window.fetch.bind(window), data.productId, payload);
    if (next.status === "SUCCESS") {
      window.location.assign(detailHref);
      return;
    }
    inFlight.current = false;
    setPending(false);
    setResult(next);
    requestAnimationFrame(() => {
      if (next.status === "FIELD_ERROR") {
        formRef.current?.querySelector<HTMLElement>(`[name="${next.field}"]`)?.focus();
      } else summaryRef.current?.focus();
    });
  }

  const message = resultMessage(result, labels);
  return (
    <form ref={formRef} onSubmit={submit} aria-busy={pending} noValidate>
      <div
        ref={summaryRef}
        role={message === "" ? undefined : "alert"}
        aria-live="assertive"
        tabIndex={message === "" ? undefined : -1}
        className={message === "" ? "sr-only" : "mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"}
      >
        {message}
        {result?.status === "STALE_WRITE" ? <a href={detailHref} className="mt-2 block font-bold underline focus:ring-2 focus:ring-teal-600">{labels.reload}</a> : null}
      </div>
      <fieldset disabled={pending} className="grid gap-4">
        <Field id={`${prefix}-name`} label={labels.materialName} error={fieldError(result, "materialName", labels)}>
          <input id={`${prefix}-name`} name="materialName" type="text" required maxLength={200} defaultValue={material?.materialName ?? ""} aria-invalid={hasFieldError(result, "materialName") || undefined} className={inputClassName} />
        </Field>
        <Field id={`${prefix}-category`} label={`${labels.category} (${labels.optional})`} error={fieldError(result, "category", labels)}>
          <input id={`${prefix}-category`} name="category" type="text" maxLength={100} defaultValue={material?.category ?? ""} aria-invalid={hasFieldError(result, "category") || undefined} className={inputClassName} />
        </Field>
        <Field id={`${prefix}-percentage`} label={labels.percentage} description={labels.percentageDescription} error={fieldError(result, "percentage", labels)}>
          <input id={`${prefix}-percentage`} name="percentage" type="text" inputMode="decimal" defaultValue={material?.percentage ?? ""} aria-describedby={`${prefix}-percentage-description`} aria-invalid={hasFieldError(result, "percentage") || undefined} className={inputClassName} />
        </Field>
        <div>
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-slate-800">
            <input
              name="isRecycled"
              type="checkbox"
              checked={isRecycled}
              aria-invalid={hasFieldError(result, "isRecycled") || undefined}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setIsRecycled(checked);
                if (!checked) setRecycledPercentage("");
              }}
              className="size-5 accent-teal-700 focus:ring-2 focus:ring-teal-600"
            />
            {labels.containsRecycled}
          </label>
          {fieldError(result, "isRecycled", labels)}
        </div>
        <Field id={`${prefix}-recycled-percentage`} label={`${labels.recycledPercentage} (${labels.optional})`} description={labels.recycledPercentageDescription} error={fieldError(result, "recycledPercentage", labels)}>
          <input
            id={`${prefix}-recycled-percentage`}
            name="recycledPercentage"
            type="text"
            inputMode="decimal"
            value={recycledPercentage}
            onChange={(event) => setRecycledPercentage(event.currentTarget.value)}
            disabled={!isRecycled || pending}
            aria-describedby={`${prefix}-recycled-percentage-description`}
            aria-invalid={hasFieldError(result, "recycledPercentage") || undefined}
            className={inputClassName}
          />
        </Field>
      </fieldset>
      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-slate-600">{pending ? labels.saving : ""}</p>
      <div className="mt-3 flex flex-wrap justify-end gap-3">
        <button type="button" disabled={pending} onClick={closeDetails} className={secondaryButtonClassName}>{labels.cancel}</button>
        <button type="submit" disabled={pending} aria-disabled={pending} className={primaryButtonClassName}>{material === undefined ? labels.add : labels.save}</button>
      </div>
    </form>
  );
}

function RemoveForm({ data, material, labels, detailHref }: Readonly<{
  data: MaterialsViewData;
  material: MaterialView;
  labels: ProductMaterialsLabels;
  detailHref: string;
}>) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ProductMaterialMutationUiResult | null>(null);
  const inFlight = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  async function remove() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setResult(null);
    const next = await mutateProductMaterialFromDashboard(window.fetch.bind(window), data.productId, {
      operation: "REMOVE",
      materialId: material.materialId,
      expectedMaterialUpdatedAt: material.updatedAt,
      expectedDraftVersionId: data.expectedDraftVersionId,
      expectedProductUpdatedAt: data.expectedProductUpdatedAt,
      expectedDraftUpdatedAt: data.expectedDraftUpdatedAt,
    });
    if (next.status === "SUCCESS") {
      window.location.assign(detailHref);
      return;
    }
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
      <p role="status" aria-live="polite" className="mt-2 min-h-5">{pending ? labels.removing : ""}</p>
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        <button type="button" disabled={pending} onClick={closeDetails} className={secondaryButtonClassName}>{labels.cancel}</button>
        <button type="button" disabled={pending} aria-disabled={pending} onClick={remove} className={dangerButtonClassName}>{labels.remove}</button>
      </div>
    </div>
  );
}

function Field({ id, label, description, error, children }: Readonly<{
  id: string;
  label: string;
  description?: string;
  error?: React.ReactNode;
  children: React.ReactNode;
}>) {
  return <div>
    <label htmlFor={id} className="block text-sm font-semibold text-slate-800">{label}</label>
    {description ? <p id={`${id}-description`} className="mt-1 text-xs leading-5 text-slate-600">{description}</p> : null}
    {children}
    {error}
  </div>;
}

function fieldError(result: ProductMaterialMutationUiResult | null, field: ProductMaterialEditableField, labels: ProductMaterialsLabels) {
  return hasFieldError(result, field)
    ? <p className="mt-2 text-sm text-red-700">{labels.validationError}</p>
    : undefined;
}

function hasFieldError(
  result: ProductMaterialMutationUiResult | null,
  field: ProductMaterialEditableField,
): boolean {
  return result?.status === "FIELD_ERROR" && result.field === field;
}

function resultMessage(result: ProductMaterialMutationUiResult | null, labels: ProductMaterialsLabels): string {
  if (result === null || result.status === "SUCCESS" || result.status === "FIELD_ERROR") return "";
  if (result.status === "STALE_WRITE") return labels.staleWrite;
  if (result.status === "COLLECTION_INVALID") return labels.collectionInvalid;
  if (result.status === "DRAFT_NOT_EDITABLE") return labels.draftNotEditable;
  if (result.status === "FORBIDDEN") return labels.forbidden;
  return labels.failure;
}

function nullableFormValue(value: FormDataEntryValue | null): string | null {
  const stringValue = String(value ?? "");
  return stringValue.trim() === "" ? null : stringValue;
}

function formatPercentage(value: string | null, fallback: string): string {
  return value === null ? fallback : `${value}%`;
}

function closeDetails(event: React.MouseEvent<HTMLButtonElement>) {
  event.currentTarget.closest("details")?.removeAttribute("open");
}

const inputClassName = "mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-600/30 disabled:cursor-not-allowed disabled:bg-slate-100";
const summaryClassName = "inline-flex min-h-11 cursor-pointer list-none items-center justify-center rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2";
const rowSummaryClassName = "cursor-pointer list-none text-sm font-bold text-teal-800 underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-teal-600";
const removeSummaryClassName = "cursor-pointer list-none text-sm font-bold text-red-700 underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-red-600";
const primaryButtonClassName = "min-h-11 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white focus:ring-2 focus:ring-teal-600 disabled:cursor-wait disabled:opacity-70";
const secondaryButtonClassName = "min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-teal-600 disabled:opacity-70";
const dangerButtonClassName = "min-h-11 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-bold text-white focus:ring-2 focus:ring-red-600 disabled:cursor-wait disabled:opacity-70";
