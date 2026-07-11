"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition, type ChangeEvent } from "react";

import { usePathname, useRouter } from "@/src/i18n/navigation";
import { isAppLocale, routing } from "@/src/i18n/routing";

export function LanguageSwitcher() {
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
      router.replace(pathname, { locale: nextLocale });
    });
  }

  return (
    <label className="flex items-center gap-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
      <span>{t("language")}</span>
      <select
        aria-label={t("language")}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus-visible:outline-zinc-50"
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
