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
  createMailtoHref,
} from "@/src/lib/site";

type AboutPageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

const challengeKeys = ["scattered", "complexity", "accessibility"] as const;
const audienceKeys = [
  "manufacturers",
  "importers",
  "distributors",
  "privateLabel",
  "smallBusiness",
] as const;

export async function generateMetadata({
  params,
}: AboutPageProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isAppLocale(locale)) notFound();

  const t = await getTranslations({ locale, namespace: "AboutPage" });
  const metadata = await getTranslations({ locale, namespace: "Metadata" });

  return createLocalizedMetadata({
    locale,
    pathname: "/about",
    title: t("metadata.title"),
    description: t("metadata.description"),
    imageAlt: metadata("openGraphImageAlt"),
  });
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { locale } = await params;

  if (!isAppLocale(locale)) notFound();

  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "AboutPage" });
  const contact = await getTranslations({ locale, namespace: "Contact" });
  const earlyAccessHref = createMailtoHref(contact("earlyAccessSubject"));

  return (
    <div className="marketing-shell min-h-screen font-sans">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden pb-16 pt-10 md:pb-24 md:pt-16">
          <div
            aria-hidden="true"
            className="absolute -right-24 top-6 size-80 rounded-full bg-blue-100/70 blur-3xl md:size-[28rem]"
          />
          <MarketingContainer className="relative grid items-center gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
            <div className="max-w-3xl">
              <p className="marketing-section-label">{t("hero.eyebrow")}</p>
              <h1 className="mt-4 text-4xl font-bold tracking-[-0.045em] text-navy-950 sm:text-5xl lg:text-6xl lg:leading-[1.06]">
                {t("hero.title")}
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                {t("hero.description")}
              </p>
            </div>

            <div
              aria-hidden="true"
              className="relative mx-auto aspect-square w-full max-w-sm rounded-[2rem] border border-blue-100 bg-white/80 p-8 shadow-[var(--shadow-marketing)]"
            >
              <div className="absolute inset-8 rounded-full border border-blue-200" />
              <div className="absolute inset-16 rounded-full border border-teal-200" />
              <div className="absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-navy-950 shadow-lg" />
              <div className="absolute left-[18%] top-[18%] size-5 rounded-full bg-blue-600" />
              <div className="absolute bottom-[20%] right-[16%] size-6 rounded-full bg-teal-500" />
              <div className="absolute bottom-[14%] left-[28%] size-3 rounded-full bg-blue-300" />
            </div>
          </MarketingContainer>
        </section>

        <section className="border-y border-slate-200 bg-white py-16 md:py-24">
          <MarketingContainer>
            <div className="max-w-3xl">
              <p className="marketing-section-label">{t("why.eyebrow")}</p>
              <h2 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-navy-950 md:text-4xl">
                {t("why.title")}
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                {t("why.description")}
              </p>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {challengeKeys.map((key, index) => (
                <article
                  key={key}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-6"
                >
                  <span className="text-sm font-bold text-teal-700">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-4 text-xl font-bold text-navy-950">
                    {t(`why.items.${key}.title`)}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {t(`why.items.${key}.body`)}
                  </p>
                </article>
              ))}
            </div>
          </MarketingContainer>
        </section>

        <section className="marketing-dark-grid py-16 text-white md:py-20">
          <MarketingContainer className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center">
            <div>
              <p className="marketing-section-label marketing-section-label-on-dark">
                {t("audience.eyebrow")}
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-[-0.035em] md:text-4xl">
                {t("audience.title")}
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
                {t("audience.description")}
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {audienceKeys.map((key) => (
                <li
                  key={key}
                  className="flex min-h-14 items-center rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-slate-100"
                >
                  <span aria-hidden="true" className="mr-3 size-2 rounded-full bg-teal-400" />
                  {t(`audience.items.${key}`)}
                </li>
              ))}
            </ul>
          </MarketingContainer>
        </section>

        <section className="bg-white py-16 md:py-24">
          <MarketingContainer className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
            <div>
              <p className="marketing-section-label">{t("company.eyebrow")}</p>
              <h2 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-navy-950 md:text-4xl">
                {t("company.title")}
              </h2>
            </div>
            <div className="rounded-[20px] border border-blue-100 bg-blue-50/60 p-7 md:p-9">
              <p className="text-base leading-7 text-slate-700">
                {t("company.body", { company: COMPANY_NAME })}
              </p>
              <a
                href={COMPANY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex max-w-full items-center gap-2 break-all rounded-md font-semibold text-blue-600 underline decoration-blue-200 underline-offset-4 hover:text-blue-700"
              >
                <span>{t("company.linkLabel")}</span>
                <span aria-hidden="true">↗</span>
              </a>
              <p className="mt-2 break-all text-sm text-slate-500">{COMPANY_URL}</p>
            </div>
          </MarketingContainer>
        </section>

        <section className="bg-slate-50 py-14 md:py-20">
          <MarketingContainer>
            <div className="rounded-[24px] bg-navy-950 px-6 py-10 text-center text-white shadow-[var(--shadow-marketing)] sm:px-10 md:py-14">
              <p className="marketing-section-label marketing-section-label-on-dark">{t("cta.eyebrow")}</p>
              <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-bold tracking-[-0.035em] md:text-4xl">
                {t("cta.title")}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-300">
                {t("cta.description")}
              </p>
              <MarketingButton className="mt-7" href={earlyAccessHref} variant="teal">
                {t("cta.action")}
              </MarketingButton>
            </div>
          </MarketingContainer>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
