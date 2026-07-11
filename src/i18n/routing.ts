import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["hr", "sr", "en", "de", "sl", "pl"],
  defaultLocale: "hr",
  localePrefix: "as-needed",
  localeDetection: false,
});

export type AppLocale = (typeof routing.locales)[number];

export function isAppLocale(locale: string | undefined): locale is AppLocale {
  return locale !== undefined && routing.locales.some((item) => item === locale);
}
