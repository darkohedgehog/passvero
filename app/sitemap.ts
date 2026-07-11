import type { MetadataRoute } from "next";

import { routing } from "@/src/i18n/routing";
import { getAbsoluteUrl } from "@/src/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return routing.locales.map((locale) => ({
    url: getAbsoluteUrl(locale),
    lastModified: new Date("2026-07-11"),
    changeFrequency: "weekly",
    priority: locale === routing.defaultLocale ? 1 : 0.9,
  }));
}
