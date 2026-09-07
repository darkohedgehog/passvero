import { getAbsoluteUrl } from "./canonical-site";
import { parseCanonicalAppOrigin } from "@/src/application/config/canonical-app-origin";
import type { Metadata } from "next";

import { routing, type AppLocale } from "@/src/i18n/routing";
import {
  OG_IMAGE_PATH,
  openGraphLocales,
  SITE_NAME,
} from "@/src/lib/site";

type LocalizedMetadataInput = {
  locale: AppLocale;
  title: string;
  description: string;
  imageAlt: string;
  pathname?: string;
};

export function getLanguageAlternates(canonicalOrigin: string, pathname = "/") {
  return {
    ...Object.fromEntries(
      routing.locales.map((locale) => [locale, getAbsoluteUrl(canonicalOrigin, locale, pathname)]),
    ),
    "x-default": new URL(pathname === "/" ? "/" : pathname, canonicalOrigin).toString(),
  };
}

export function createLocalizedMetadata({
  locale,
  title,
  description,
  imageAlt,
  pathname = "/",
}: LocalizedMetadataInput, origin: string): Metadata {
  const canonicalOrigin = parseCanonicalAppOrigin(origin);
  const canonical = getAbsoluteUrl(canonicalOrigin, locale, pathname);

  return {
    metadataBase: new URL(canonicalOrigin),
    title,
    description,
    alternates: {
      canonical,
      languages: getLanguageAlternates(canonicalOrigin, pathname),
    },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url: canonical,
      locale: openGraphLocales[locale],
      alternateLocale: routing.locales
        .filter((item) => item !== locale)
        .map((item) => openGraphLocales[item]),
      images: [
        {
          url: OG_IMAGE_PATH,
          width: 1200,
          height: 630,
          alt: imageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE_PATH],
    },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/icon.png", type: "image/png" },
      ],
      apple: [{ url: "/apple-icon.png", type: "image/png" }],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}
