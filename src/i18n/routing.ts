import { defineRouting } from "next-intl/routing";

import {
  PASSVERO_LOCALES,
  isPassveroLocale,
  type PassveroLocale,
} from "@/src/domain/values/passvero-locale";

export const routing = defineRouting({
  locales: PASSVERO_LOCALES,
  defaultLocale: "hr",
  localePrefix: "as-needed",
  localeDetection: false,
});

export type AppLocale = PassveroLocale;

export function isAppLocale(locale: string | undefined): locale is AppLocale {
  return locale !== undefined && isPassveroLocale(locale);
}
