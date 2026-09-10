"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { InputHTMLAttributes, ReactNode, RefObject } from "react";

export function AuthField({
  label,
  error,
  hint,
  inputRef,
  ...input
}: Readonly<{
  label: string;
  error?: string;
  hint?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
}> & InputHTMLAttributes<HTMLInputElement>) {
  const t = useTranslations("Auth.common");
  const [visible, setVisible] = useState(false);
  const isPassword = input.type === "password";
  const describedBy = [hint === undefined ? null : `${input.id}-hint`, error === undefined ? null : `${input.id}-error`]
    .filter(Boolean)
    .join(" ") || undefined;
  return (
    <div>
      <label htmlFor={input.id} className="block text-sm font-semibold text-slate-800">
        {label}
      </label>
      {hint === undefined ? null : (
        <p id={`${input.id}-hint`} className="mt-1 text-xs leading-5 text-slate-600">
          {hint}
        </p>
      )}
      <div className="relative mt-2">
        <input
          {...input}
          type={isPassword && visible ? "text" : input.type}
          ref={inputRef}
          aria-describedby={describedBy}
          aria-invalid={error === undefined ? undefined : true}
          className={`min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-950 shadow-sm transition-colors placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:outline-none disabled:bg-slate-50 ${isPassword ? "pr-14" : ""}`}
        />
        {isPassword ? (
          <button
            type="button"
            aria-label={t(visible ? "hidePassword" : "showPassword", { field: label })}
            aria-controls={input.id}
            disabled={input.disabled}
            onClick={() => setVisible((current) => !current)}
            className="absolute right-0 top-0 flex min-h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              {visible ? <path d="m3 3 18 18" /> : null}
            </svg>
          </button>
        ) : null}
      </div>
      {error === undefined ? null : (
        <p role="alert" id={`${input.id}-error`} className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function AuthSubmitButton({
  pending,
  label,
  pendingLabel,
}: Readonly<{ pending: boolean; label: string; pendingLabel: string }>) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="min-h-11 w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-teal-600 disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function AuthStatusMessage({
  id = "auth-status",
  tone,
  children,
  focusRef,
}: Readonly<{
  id?: string;
  tone: "error" | "success" | "info";
  children: ReactNode;
  focusRef?: RefObject<HTMLDivElement | null>;
}>) {
  const styles = tone === "error"
    ? "border-red-200 bg-red-50 text-red-800"
    : tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-blue-200 bg-blue-50 text-blue-900";
  return (
    <div
      ref={focusRef}
      id={id}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      tabIndex={tone === "error" ? -1 : undefined}
      className={`rounded-lg border px-4 py-3 text-sm leading-6 ${styles}`}
    >
      {children}
    </div>
  );
}
