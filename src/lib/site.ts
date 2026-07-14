import type { AppLocale } from "@/src/i18n/routing";

export const SITE_NAME = "Passvero";
export const SITE_URL = "https://passvero.eu";
export const CONTACT_EMAIL = "contact@passvero.eu";
export const COMPANY_NAME = "Živić-elektro j.d.o.o.";
export const COMPANY_URL = "https://www.zivic-elektro.com";
export const OG_IMAGE_PATH = "/og/passvero-og.png";

export const openGraphLocales: Record<AppLocale, string> = {
  hr: "hr_HR",
  sr: "sr_RS",
  en: "en_US",
  de: "de_DE",
  sl: "sl_SI",
  pl: "pl_PL",
};

export function getLocalizedPath(locale: AppLocale, pathname = "/") {
  const normalizedPath = pathname === "/" ? "" : pathname;
  return locale === "hr"
    ? normalizedPath || "/"
    : `/${locale}${normalizedPath}`;
}

export function getAbsoluteUrl(locale: AppLocale, pathname = "/") {
  return new URL(getLocalizedPath(locale, pathname), SITE_URL).toString();
}

export function createMailtoHref(subject: string) {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
