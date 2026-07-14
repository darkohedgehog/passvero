import type { MetadataRoute } from "next";

import { routing } from "@/src/i18n/routing";
import { getAbsoluteUrl } from "@/src/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["/", "/about", "/contact", "/privacy", "/cookies", "/terms"] as const;

  return routes.flatMap((pathname) =>
    routing.locales.map((locale) => ({
      url: getAbsoluteUrl(locale, pathname),
      lastModified: new Date("2026-07-14"),
      changeFrequency: pathname === "/" ? "weekly" : "monthly",
      priority: pathname === "/" ? (locale === routing.defaultLocale ? 1 : 0.9) : 0.5,
    })),
  );
}
