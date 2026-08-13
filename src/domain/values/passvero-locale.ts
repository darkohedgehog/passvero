export const PASSVERO_LOCALES = ["hr", "sr", "en", "de", "sl", "pl"] as const;

export type PassveroLocale = (typeof PASSVERO_LOCALES)[number];

export function isPassveroLocale(locale: string): locale is PassveroLocale {
  return PASSVERO_LOCALES.some((item) => item === locale);
}
