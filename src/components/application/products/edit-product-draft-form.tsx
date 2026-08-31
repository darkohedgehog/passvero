"use client";

import {
  type FormEvent,
  useRef,
  useState,
} from "react";

import {
  editProductDraftFromDashboard,
  missingRequiredEditProductDraftField,
} from "@/src/application/products/edit-product-draft/edit-product-draft-ui-client";

type FieldName = "productName" | "organizationSku";
type FieldError = Readonly<{
  field: FieldName;
  reason: "REQUIRED" | "INVALID" | "CONFLICT";
}>;
type FormError = "STALE_WRITE" | "DRAFT_NOT_EDITABLE" | "FORBIDDEN" | "FAILURE";

export interface EditProductDraftFormLabels {
  readonly productName: string;
  readonly organizationSku: string;
  readonly optional: string;
  readonly sourceLocale: string;
  readonly save: string;
  readonly saving: string;
  readonly cancel: string;
  readonly reload: string;
  readonly required: string;
  readonly invalidName: string;
  readonly invalidSku: string;
  readonly skuConflict: string;
  readonly staleWrite: string;
  readonly draftNotEditable: string;
  readonly forbidden: string;
  readonly failure: string;
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function EditProductDraftForm({
  productId,
  initialProductName,
  initialOrganizationSku,
  sourceLocale,
  expectedDraftVersionId,
  expectedProductUpdatedAt,
  expectedDraftUpdatedAt,
  expectedSourceTranslationUpdatedAt,
  detailHref,
  labels,
  fetcher,
  navigate,
}: Readonly<{
  productId: string;
  initialProductName: string;
  initialOrganizationSku: string | null;
  sourceLocale: string;
  expectedDraftVersionId: string;
  expectedProductUpdatedAt: string;
  expectedDraftUpdatedAt: string;
  expectedSourceTranslationUpdatedAt: string;
  detailHref: string;
  labels: EditProductDraftFormLabels;
  fetcher?: Fetcher;
  navigate?: (href: string) => void;
}>) {
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState<FieldError | null>(null);
  const [formError, setFormError] = useState<FormError | null>(null);
  const inFlightRef = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const skuRef = useRef<HTMLInputElement>(null);

  const fieldMessage = fieldError?.reason === "REQUIRED"
    ? labels.required
    : fieldError?.reason === "CONFLICT"
      ? labels.skuConflict
      : fieldError?.field === "productName"
        ? labels.invalidName
        : fieldError?.field === "organizationSku"
          ? labels.invalidSku
          : undefined;

  function focusFailure(field: FieldName | null) {
    requestAnimationFrame(() => {
      if (field === "productName") nameRef.current?.focus();
      else if (field === "organizationSku") skuRef.current?.focus();
      else summaryRef.current?.focus();
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setPending(true);
    setFieldError(null);
    setFormError(null);

    const data = new FormData(event.currentTarget);
    const command = {
      productName: String(data.get("productName") ?? ""),
      organizationSku: String(data.get("organizationSku") ?? ""),
      expectedDraftVersionId,
      expectedProductUpdatedAt,
      expectedDraftUpdatedAt,
      expectedSourceTranslationUpdatedAt,
    };
    const missingField = missingRequiredEditProductDraftField(command);
    if (missingField !== null) {
      inFlightRef.current = false;
      setPending(false);
      setFieldError({ field: missingField, reason: "REQUIRED" });
      focusFailure(missingField);
      return;
    }

    const result = await editProductDraftFromDashboard(
      fetcher ?? window.fetch.bind(window),
      productId,
      command,
    );
    if (result.status === "SUCCESS") {
      (navigate ?? ((href) => window.location.assign(href)))(detailHref);
      return;
    }

    inFlightRef.current = false;
    setPending(false);
    if (result.status === "FIELD_ERROR") {
      setFieldError({ field: result.field, reason: result.reason });
      focusFailure(result.field);
      return;
    }
    const nextError: FormError = result.status === "STALE_WRITE"
      ? "STALE_WRITE"
      : result.status === "DRAFT_NOT_EDITABLE"
        ? "DRAFT_NOT_EDITABLE"
        : result.status === "FORBIDDEN"
          ? "FORBIDDEN"
          : "FAILURE";
    setFormError(nextError);
    focusFailure(null);
  }

  const summary = formError === "STALE_WRITE"
    ? labels.staleWrite
    : formError === "DRAFT_NOT_EDITABLE"
      ? labels.draftNotEditable
      : formError === "FORBIDDEN"
        ? labels.forbidden
        : formError === "FAILURE"
          ? labels.failure
          : "";

  return (
    <form onSubmit={submit} aria-busy={pending} className="space-y-6" noValidate>
      <div
        ref={summaryRef}
        role={summary.length === 0 ? undefined : "alert"}
        aria-live="assertive"
        tabIndex={summary.length === 0 ? undefined : -1}
        className={summary.length === 0
          ? "sr-only"
          : "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"}
      >
        {summary}
        {formError === "STALE_WRITE" ? (
          <a
            href={detailHref}
            className="mt-2 block w-fit font-bold underline focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
          >
            {labels.reload}
          </a>
        ) : null}
      </div>

      <FormField
        id="edit-product-name"
        label={labels.productName}
        error={fieldError?.field === "productName" ? fieldMessage : undefined}
      >
        <input
          ref={nameRef}
          id="edit-product-name"
          name="productName"
          type="text"
          defaultValue={initialProductName}
          autoComplete="off"
          required
          maxLength={200}
          disabled={pending}
          aria-invalid={fieldError?.field === "productName" || undefined}
          aria-describedby={fieldError?.field === "productName" ? "edit-product-name-error" : undefined}
          className={inputClassName}
        />
      </FormField>

      <FormField
        id="edit-product-sku"
        label={`${labels.organizationSku} (${labels.optional})`}
        error={fieldError?.field === "organizationSku" ? fieldMessage : undefined}
      >
        <input
          ref={skuRef}
          id="edit-product-sku"
          name="organizationSku"
          type="text"
          defaultValue={initialOrganizationSku ?? ""}
          autoComplete="off"
          maxLength={128}
          disabled={pending}
          aria-invalid={fieldError?.field === "organizationSku" || undefined}
          aria-describedby={fieldError?.field === "organizationSku" ? "edit-product-sku-error" : undefined}
          className={inputClassName}
        />
      </FormField>

      <div>
        <p className="text-sm font-semibold text-slate-800">{labels.sourceLocale}</p>
        <p className="mt-2 text-sm font-semibold uppercase text-slate-950">
          {sourceLocale.toUpperCase()}
        </p>
      </div>

      <p aria-live="polite" role="status" className="min-h-6 text-sm text-slate-600">
        {pending ? labels.saving : ""}
      </p>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <a
          href={detailHref}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-900 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
        >
          {labels.cancel}
        </a>
        <button
          type="submit"
          disabled={pending}
          aria-disabled={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? labels.saving : labels.save}
        </button>
      </div>
    </form>
  );
}

function FormField({
  id,
  label,
  error,
  children,
}: Readonly<{
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}>) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800">
        {label}
      </label>
      {children}
      {error === undefined ? null : (
        <p id={`${id}-error`} className="mt-2 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}

const inputClassName = "mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-600/30 disabled:cursor-wait disabled:bg-slate-100";
