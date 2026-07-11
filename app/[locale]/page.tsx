import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { ComplianceSection } from "@/src/components/marketing/compliance-section";
import { DashboardPreviewSection } from "@/src/components/marketing/dashboard-preview-section";
import { FinalCtaSection } from "@/src/components/marketing/final-cta-section";
import { HeroSection } from "@/src/components/marketing/hero-section";
import { HowItWorksSection } from "@/src/components/marketing/how-it-works-section";
import { IndustriesSection } from "@/src/components/marketing/industries-section";
import { SiteFooter } from "@/src/components/marketing/site-footer";
import { SiteHeader } from "@/src/components/marketing/site-header";
import { isAppLocale } from "@/src/i18n/routing";

type HomePageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export async function generateMetadata({
  params,
}: HomePageProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function Home({ params }: HomePageProps) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <div className="marketing-shell min-h-screen font-sans">
      <SiteHeader />
      <main>
        <HeroSection />
        <ComplianceSection />
        <HowItWorksSection />
        <DashboardPreviewSection />
        <IndustriesSection />
        <FinalCtaSection />
      </main>
      <SiteFooter />
    </div>
  );
}
