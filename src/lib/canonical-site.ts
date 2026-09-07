import type { MetadataRoute } from "next";
import { routing, type AppLocale } from "@/src/i18n/routing";
import { COMPANY_NAME, COMPANY_URL, CONTACT_EMAIL, SITE_NAME, getLocalizedPath } from "./site";

// Pure URL presentation functions; the server composition supplies validated origin.
export function getAbsoluteUrl(canonicalOrigin: string, locale: AppLocale, pathname = "/") {
  return new URL(getLocalizedPath(locale, pathname), canonicalOrigin).toString();
}

export function getAppStructuredData(canonicalOrigin: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${canonicalOrigin}/#organization`,
        name: COMPANY_NAME,
        url: COMPANY_URL,
        email: CONTACT_EMAIL,
      },
      {
        "@type": "Brand",
        "@id": `${canonicalOrigin}/#brand`,
        name: SITE_NAME,
        url: canonicalOrigin,
      },
      {
        "@type": "WebSite",
        "@id": `${canonicalOrigin}/#website`,
        name: SITE_NAME,
        url: canonicalOrigin,
        brand: { "@id": `${canonicalOrigin}/#brand` },
        publisher: { "@id": `${canonicalOrigin}/#organization` },
        inLanguage: [...routing.locales],
      },
    ],
  };
}

export function getCanonicalSitemap(canonicalOrigin: string): MetadataRoute.Sitemap {
  const routes = ["/", "/about", "/contact", "/privacy", "/cookies", "/terms"] as const;
  return routes.flatMap((pathname) => routing.locales.map((locale) => ({
    url: getAbsoluteUrl(canonicalOrigin, locale, pathname),
    lastModified: new Date("2026-07-14"),
    changeFrequency: pathname === "/" ? "weekly" : "monthly",
    priority: pathname === "/" ? (locale === routing.defaultLocale ? 1 : 0.9) : 0.5,
  })));
}

export function getCanonicalRobots(canonicalOrigin: string): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" }, sitemap: `${canonicalOrigin}/sitemap.xml`, host: canonicalOrigin };
}
