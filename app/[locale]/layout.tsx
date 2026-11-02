import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { geistVariables } from "../fonts/geist";
import "../fonts/fallback.css";

import { isAppLocale, routing } from "@/src/i18n/routing";
import { getAppStructuredData } from "@/src/lib/canonical-site";
import { getCanonicalAppOrigin } from "@/src/infrastructure/config/canonical-app-origin";

import "../globals.css";

export const metadata: Metadata = {
  applicationName: "Passvero",
  manifest: "/manifest.webmanifest",
  verification: {
    google: "7UgejaCfY0FRiWXwHGtXauzg-KaiJQ0wsZ0miT9Khbs",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
};

type LocaleLayoutProps = Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages({ locale });
  const structuredData = getAppStructuredData(getCanonicalAppOrigin());

  return (
    <html
      lang={locale}
      className="h-full antialiased"
      style={geistVariables}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c"),
          }}
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
