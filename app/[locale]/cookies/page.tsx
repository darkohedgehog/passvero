import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { LegalDocument } from "@/src/components/legal/legal-document";
import { isAppLocale } from "@/src/i18n/routing";
import { createLocalizedMetadata } from "@/src/lib/seo";

type CookiesPageProps = Readonly<{ params: Promise<{ locale: string }> }>;

const sectionKeys = ["overview", "necessary", "locale", "analytics", "control", "changes"] as const;

export async function generateMetadata({ params }: CookiesPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Legal.Cookies" });
  const metadata = await getTranslations({ locale, namespace: "Metadata" });
  return createLocalizedMetadata({
    locale,
    pathname: "/cookies",
    title: t("metadata.title"),
    description: t("metadata.description"),
    imageAlt: metadata("openGraphImageAlt"),
  });
}

export default async function CookiesPage({ params }: CookiesPageProps) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Legal.Cookies" });
  const common = await getTranslations({ locale, namespace: "Legal.Common" });
  const contact = await getTranslations({ locale, namespace: "Contact" });
  const navigation = await getTranslations({ locale, namespace: "MarketingNavigation" });

  return (
    <LegalDocument
      title={t("title")}
      intro={t("intro")}
      lastUpdated={common("lastUpdated")}
      lastUpdatedLabel={common("lastUpdatedLabel")}
      backLabel={common("backHome")}
      pricingLabel={navigation("pricing")}
      emailLabel={contact("emailLabel")}
      emailSubject={contact("privacySubject")}
      sections={sectionKeys.map((key) => ({
        title: t(`sections.${key}.title`),
        body: t(`sections.${key}.body`),
      }))}
    />
  );
}
