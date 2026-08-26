"use client";

import {
  type FormEvent,
  useRef,
  useState,
} from "react";

import {
  createProductFromDashboard,
  missingRequiredCreateProductField,
} from "@/src/application/products/create-product/create-product-ui-client";
import type { PassveroLocale } from "@/src/domain/values/passvero-locale";

type FieldName = "initialProductName" | "organizationSku" | "initialLocale";
type FieldError = Readonly<{
  field: FieldName;
  reason: "REQUIRED" | "INVALID" | "CONFLICT";
}>;

export interface CreateProductFormLabels {
  readonly productName: string;
  readonly sku: string;
  readonly skuOptional: string;
  readonly initialLocale: string;
  readonly create: string;
  readonly creating: string;
  readonly cancel: string;
  readonly required: string;
  readonly invalidName: string;
  readonly invalidSku: string;
  readonly invalidLocale: string;
  readonly skuConflict: string;
  readonly forbidden: string;
  readonly failure: string;
}

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export function CreateProductForm({
  initialLocale,
  locales,
  localeLabels,
  successHref,
  cancelHref,
  labels,
  fetcher,
  navigate,
}: Readonly<{
  initialLocale: PassveroLocale;
  locales: readonly PassveroLocale[];
  localeLabels: Readonly<Record<PassveroLocale, string>>;
  successHref: string;
  cancelHref: string;
  labels: CreateProductFormLabels;
  fetcher?: Fetcher;
  navigate?: (href: string) => void;
}>) {
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState<FieldError | null>(null);
  const [formError, setFormError] = useState<"FORBIDDEN" | "FAILURE" | null>(null);
  const inFlightRef = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const skuRef = useRef<HTMLInputElement>(null);
  const localeRef = useRef<HTMLSelectElement>(null);

  const fieldMessage = fieldError?.reason === "REQUIRED"
    ? labels.required
    : fieldError?.reason === "CONFLICT"
      ? labels.skuConflict
      : fieldError?.field === "initialProductName"
        ? labels.invalidName
        : fieldError?.field === "organizationSku"
          ? labels.invalidSku
          : fieldError?.field === "initialLocale"
            ? labels.invalidLocale
            : undefined;

  function focusFailure(field: FieldName | null) {
    requestAnimationFrame(() => {
      if (field === "initialProductName") nameRef.current?.focus();
      else if (field === "organizationSku") skuRef.current?.focus();
      else if (field === "initialLocale") localeRef.current?.focus();
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
    const organizationSku = String(data.get("organizationSku") ?? "");
    const command = {
      initialProductName: String(data.get("initialProductName") ?? ""),
      ...(organizationSku.length === 0 ? {} : { organizationSku }),
      initialLocale: String(data.get("initialLocale") ?? ""),
    };
    const missingField = missingRequiredCreateProductField(command);
    if (missingField !== null) {
      inFlightRef.current = false;
      setPending(false);
      setFieldError({ field: missingField, reason: "REQUIRED" });
      focusFailure(missingField);
      return;
    }

    const result = await createProductFromDashboard(
      fetcher ?? window.fetch.bind(window),
      command,
    );

    if (result.status === "SUCCESS") {
      (navigate ?? ((href) => window.location.assign(href)))(successHref);
      return;
    }

    inFlightRef.current = false;
    setPending(false);
    if (result.status === "FIELD_ERROR") {
      setFieldError({ field: result.field, reason: result.reason });
      focusFailure(result.field);
      return;
    }
    const nextFormError = result.status === "FORBIDDEN" ? "FORBIDDEN" : "FAILURE";
    setFormError(nextFormError);
    focusFailure(null);
  }

  const summary = formError === "FORBIDDEN"
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
      </div>

      <FormField
        id="create-product-name"
        label={labels.productName}
        error={fieldError?.field === "initialProductName" ? fieldMessage : undefined}
      >
        <input
          ref={nameRef}
          id="create-product-name"
          name="initialProductName"
          type="text"
          autoComplete="off"
          required
          maxLength={200}
          disabled={pending}
          aria-invalid={fieldError?.field === "initialProductName" || undefined}
          aria-describedby={fieldError?.field === "initialProductName" ? "create-product-name-error" : undefined}
          className={inputClassName}
        />
      </FormField>

      <FormField
        id="create-product-sku"
        label={`${labels.sku} (${labels.skuOptional})`}
        error={fieldError?.field === "organizationSku" ? fieldMessage : undefined}
      >
        <input
          ref={skuRef}
          id="create-product-sku"
          name="organizationSku"
          type="text"
          autoComplete="off"
          maxLength={128}
          disabled={pending}
          aria-invalid={fieldError?.field === "organizationSku" || undefined}
          aria-describedby={fieldError?.field === "organizationSku" ? "create-product-sku-error" : undefined}
          className={inputClassName}
        />
      </FormField>

      <FormField
        id="create-product-locale"
        label={labels.initialLocale}
        error={fieldError?.field === "initialLocale" ? fieldMessage : undefined}
      >
        <select
          ref={localeRef}
          id="create-product-locale"
          name="initialLocale"
          required
          defaultValue={initialLocale}
          disabled={pending}
          aria-invalid={fieldError?.field === "initialLocale" || undefined}
          aria-describedby={fieldError?.field === "initialLocale" ? "create-product-locale-error" : undefined}
          className={inputClassName}
        >
          {locales.map((locale) => (
            <option key={locale} value={locale}>{localeLabels[locale]}</option>
          ))}
        </select>
      </FormField>

      <p aria-live="polite" role="status" className="min-h-6 text-sm text-slate-600">
        {pending ? labels.creating : ""}
      </p>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <a
          href={cancelHref}
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
          {pending ? labels.creating : labels.create}
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
        <p id={`${id}-error`} className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

const inputClassName = "mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-950 shadow-sm hover:border-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 disabled:bg-slate-50";
