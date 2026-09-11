"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition, type ChangeEvent } from "react";

import { usePathname, useRouter } from "@/src/i18n/navigation";
import { isAppLocale, routing } from "@/src/i18n/routing";
import { dashboardLocaleHref } from "@/src/i18n/dashboard-locale-href";

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
    <label className="inline-flex items-center text-sm font-medium text-slate-700">
      <span className="sr-only">{t("language")}</span>
      <select
        aria-label={t("language")}
        className={variant === "dashboard"
          ? "min-h-11 max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
          : "min-h-9 max-w-24 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600 disabled:cursor-wait disabled:opacity-60"}
        disabled={isPending}
        onChange={handleLocaleChange}
        value={locale}
      >
        {routing.locales.map((item) => (
          <option key={item} value={item}>
            {t(`languages.${item}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
