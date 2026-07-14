import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { LegalDocument } from "@/src/components/legal/legal-document";
import { isAppLocale } from "@/src/i18n/routing";
import { createLocalizedMetadata } from "@/src/lib/seo";

type TermsPageProps = Readonly<{ params: Promise<{ locale: string }> }>;

const sectionKeys = [
  "introduction",
  "service",
  "eligibility",
  "acceptableUse",
  "productData",
  "intellectualProperty",
  "thirdPartyServices",
  "availability",
  "disclaimer",
  "liability",
  "termination",
  "governingLaw",
  "contact",
  "changes",
] as const;

export async function generateMetadata({ params }: TermsPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Legal.Terms" });
  const metadata = await getTranslations({ locale, namespace: "Metadata" });
  return createLocalizedMetadata({
    locale,
    pathname: "/terms",
    title: t("metadata.title"),
    description: t("metadata.description"),
    imageAlt: metadata("openGraphImageAlt"),
  });
}

export default async function TermsPage({ params }: TermsPageProps) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Legal.Terms" });
  const common = await getTranslations({ locale, namespace: "Legal.Common" });
  const contact = await getTranslations({ locale, namespace: "Contact" });

  return (
    <LegalDocument
      title={t("title")}
      intro={t("intro")}
      lastUpdated={common("lastUpdated")}
      lastUpdatedLabel={common("lastUpdatedLabel")}
      backLabel={common("backHome")}
      emailLabel={contact("emailLabel")}
      emailSubject={contact("generalSubject")}
      sections={sectionKeys.map((key) => ({
        title: t(`sections.${key}.title`),
        body: t(`sections.${key}.body`),
      }))}
    />
  );
}
