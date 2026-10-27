"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useTransition, type ChangeEvent } from "react";

import { usePathname, useRouter } from "@/src/i18n/navigation";
import { isAppLocale, routing } from "@/src/i18n/routing";
import { dashboardLocaleHref } from "@/src/i18n/dashboard-locale-href";

const marketingFlags = { hr: "hr", sr: "rs", en: "gb", de: "de", sl: "si", pl: "pl" } as const;

export function LanguageSwitcher({ variant = "marketing" }: { variant?: "marketing" | "dashboard" }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("Common");
  const [isPending, startTransition] = useTransition();

  function handleLocaleChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value;

    if (!isAppLocale(nextLocale)) {
      return;
    }

    startTransition(() => {
      const href = variant === "dashboard"
        ? dashboardLocaleHref(pathname, window.location.search)
        : pathname;
      router.replace(href, { locale: nextLocale });
    });
  }

  return (
    <label className="relative inline-flex max-w-full items-center text-sm font-medium text-slate-700">
      <span className="sr-only">{t("language")}</span>
      {isAppLocale(locale) ? (
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center gap-2 px-3 text-xs font-semibold text-slate-700">
          <Image src={`/marketing/flags/${marketingFlags[locale]}.svg`} alt="" width={20} height={15} className="h-[15px] w-5 rounded-[2px]" />
          {locale.toUpperCase()}
        </span>
      ) : null}
      <select
        aria-label={`${t("language")}: ${t(`languages.${locale}`)}`}
        data-language-control={variant === "dashboard" ? "dashboard" : undefined}
        className={variant === "dashboard"
          ? "h-11 min-h-11 w-[6.75rem] max-w-full appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-8 text-xs text-transparent shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
          : "min-h-11 w-[6.75rem] appearance-none rounded-lg border border-slate-300 bg-transparent py-2 pl-3 pr-8 text-xs text-transparent hover:bg-navy-950/5 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60"}
        disabled={isPending}
        onChange={handleLocaleChange}
        value={locale}
      >
        {routing.locales.map((item) => (
          <option key={item} value={item} className="bg-white text-slate-700">
            {t(`languages.${item}`)}
          </option>
        ))}
      </select>
      {variant === "marketing" ? (
        <svg className="pointer-events-none absolute right-3 size-3 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" focusable="false">
          <path d="m7 10 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
      {variant === "dashboard" ? (
        <svg className="pointer-events-none absolute right-3 size-4 text-teal-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" focusable="false">
          <path d="m7 10 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </label>
  );
}
