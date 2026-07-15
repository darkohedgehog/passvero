import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { MarketingButton } from "@/src/components/marketing/marketing-button";
import { MarketingContainer } from "@/src/components/marketing/marketing-container";
import { SiteFooter } from "@/src/components/marketing/site-footer";
import { SiteHeader } from "@/src/components/marketing/site-header";
import { isAppLocale } from "@/src/i18n/routing";
import { createLocalizedMetadata } from "@/src/lib/seo";
import {
  COMPANY_NAME,
  COMPANY_URL,
  CONTACT_EMAIL,
  createMailtoHref,
} from "@/src/lib/site";

type ContactPageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export async function generateMetadata({
  params,
}: ContactPageProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isAppLocale(locale)) notFound();

  const t = await getTranslations({ locale, namespace: "ContactPage" });
  const metadata = await getTranslations({ locale, namespace: "Metadata" });

  return createLocalizedMetadata({
    locale,
    pathname: "/contact",
    title: t("metadata.title"),
    description: t("metadata.description"),
    imageAlt: metadata("openGraphImageAlt"),
  });
}

export default async function ContactPage({ params }: ContactPageProps) {
  const { locale } = await params;

  if (!isAppLocale(locale)) notFound();

  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "ContactPage" });
  const contact = await getTranslations({ locale, namespace: "Contact" });
  const generalHref = createMailtoHref(contact("generalSubject"));
  const earlyAccessHref = createMailtoHref(contact("earlyAccessSubject"));

  return (
    <div className="marketing-shell min-h-screen font-sans">
      <SiteHeader />
      <main>
        <section className="pb-12 pt-8 md:pb-16 md:pt-12">
          <MarketingContainer>
            <div className="relative overflow-hidden rounded-[24px] border border-blue-100 bg-blue-50/80 px-6 py-12 sm:px-10 md:px-14 md:py-16">
              <div
                aria-hidden="true"
                className="absolute -right-20 -top-24 size-72 rounded-full bg-teal-200/60 blur-3xl"
              />
              <div className="relative max-w-3xl">
                <p className="marketing-section-label">{t("hero.eyebrow")}</p>
                <h1 className="mt-4 text-4xl font-bold tracking-[-0.045em] text-navy-950 sm:text-5xl lg:text-6xl lg:leading-[1.06]">
                  {t("hero.title")}
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                  {t("hero.description")}
                </p>
              </div>
            </div>
          </MarketingContainer>
        </section>

        <section className="bg-white py-12 md:py-20">
          <MarketingContainer className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-[20px] border border-slate-200 bg-white p-7 shadow-sm md:p-9">
              <p className="marketing-section-label">{t("email.eyebrow")}</p>
              <h2 className="mt-3 text-2xl font-bold text-navy-950 md:text-3xl">
                {t("email.title")}
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                {t("email.description")}
              </p>
              <a
                href={generalHref}
                className="mt-7 inline-flex max-w-full break-all rounded-md text-lg font-bold text-blue-600 underline decoration-blue-200 underline-offset-4 hover:text-blue-700 sm:text-xl"
              >
                {CONTACT_EMAIL}
              </a>
              <p className="mt-4 text-sm leading-6 text-slate-500">{t("responseNote")}</p>
            </article>

            <article className="rounded-[20px] border border-slate-200 bg-slate-50 p-7 md:p-9">
              <p className="marketing-section-label">{t("company.eyebrow")}</p>
              <h2 className="mt-3 text-2xl font-bold text-navy-950 md:text-3xl">
                {t("company.title")}
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                {t("company.body", { company: COMPANY_NAME })}
              </p>
              <a
                href={COMPANY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-7 inline-flex max-w-full items-center gap-2 break-all rounded-md font-semibold text-blue-600 underline decoration-blue-200 underline-offset-4 hover:text-blue-700"
              >
                <span>{t("company.linkLabel")}</span>
                <span aria-hidden="true">↗</span>
              </a>
              <p className="mt-2 break-all text-sm text-slate-500">{COMPANY_URL}</p>
            </article>
          </MarketingContainer>
        </section>

        <section className="bg-slate-50 py-14 md:py-20">
          <MarketingContainer>
            <div className="grid items-center gap-7 rounded-[24px] bg-navy-950 px-6 py-10 text-white shadow-[var(--shadow-marketing)] sm:px-10 md:grid-cols-[minmax(0,1fr)_auto] md:px-12 md:py-12">
              <div>
                <p className="marketing-section-label marketing-section-label-on-dark">
                  {t("earlyAccess.eyebrow")}
                </p>
                <h2 className="mt-3 text-3xl font-bold tracking-[-0.035em]">
                  {t("earlyAccess.title")}
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                  {t("earlyAccess.description")}
                </p>
              </div>
              <MarketingButton href={earlyAccessHref} variant="teal">
                {t("earlyAccess.action")}
              </MarketingButton>
            </div>
          </MarketingContainer>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
