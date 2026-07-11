import { getRequestConfig } from "next-intl/server";

import { isAppLocale, routing, type AppLocale } from "@/src/i18n/routing";

const messageLoaders: Record<AppLocale, () => Promise<{ default: Messages }>> = {
  hr: () => import("../../messages/hr.json"),
  sr: () => import("../../messages/sr.json"),
  en: () => import("../../messages/en.json"),
  de: () => import("../../messages/de.json"),
  sl: () => import("../../messages/sl.json"),
  pl: () => import("../../messages/pl.json"),
};

type Messages = typeof import("../../messages/hr.json");

export default getRequestConfig(async ({ requestLocale }) => {
  const requestedLocale = await requestLocale;
  const locale = isAppLocale(requestedLocale)
    ? requestedLocale
    : routing.defaultLocale;
  const messages = (await messageLoaders[locale]()).default;

  return {
    locale,
    messages,
  };
});
