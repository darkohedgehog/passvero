import { getTranslations } from "next-intl/server";

import { MarketingContainer } from "@/src/components/marketing/marketing-container";
import { SiteFooter } from "@/src/components/marketing/site-footer";
import { SiteHeader } from "@/src/components/marketing/site-header";
import { Link } from "@/src/i18n/navigation";
import { CONTACT_EMAIL, createMailtoHref } from "@/src/lib/site";

type LegalSection = {
  title: string;
  body: string;
};

type LegalDocumentProps = {
  title: string;
  intro: string;
  lastUpdated: string;
  lastUpdatedLabel: string;
  sections: readonly LegalSection[];
  backLabel: string;
  pricingLabel: string;
  emailLabel: string;
  emailSubject: string;
};

export async function LegalDocument({
  title,
  intro,
  lastUpdated,
  lastUpdatedLabel,
  sections,
  backLabel,
  pricingLabel,
  emailLabel,
  emailSubject,
}: LegalDocumentProps) {
  const [common, legal] = await Promise.all([
    getTranslations("Legal.Common"),
    getTranslations("Footer.groups.legal"),
  ]);
  const linkClass = "rounded-md font-semibold text-teal-700 underline decoration-teal-200 underline-offset-4 hover:text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-600";

  return (
    <div className="marketing-shell min-h-screen font-sans text-slate-700">
      <SiteHeader />
      <main id="legal-content" className="pb-12 pt-6 md:pb-20 md:pt-10">
        <MarketingContainer>
          <article className="mx-auto max-w-4xl min-w-0 rounded-[24px] border border-slate-200 bg-white px-5 py-8 shadow-sm [overflow-wrap:anywhere] sm:px-10 md:px-14 md:py-12">
            <nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm" aria-label={backLabel}>
              <Link href="/" className={linkClass}>← {backLabel}</Link>
              <Link href="/#pricing" className={linkClass}>{pricingLabel}</Link>
            </nav>

            <h1 className="mt-8 text-2xl font-bold tracking-[-0.035em] text-navy-950 hyphens-auto min-[375px]:text-3xl sm:text-4xl md:text-5xl">
              {title}
            </h1>
            <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">{intro}</p>
            <p className="mt-4 text-sm font-medium text-slate-500">
              {lastUpdatedLabel}: {lastUpdated}
            </p>

            <nav className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6" aria-label={common("contents")}>
              <h2 className="text-base font-bold text-navy-950">{common("contents")}</h2>
              <ul className="mt-3 grid gap-3 text-sm leading-6 sm:grid-cols-2 sm:gap-x-6">
                {sections.map((section, index) => (
                  <li key={section.title}>
                    <a href={`#legal-section-${index + 1}`} className={linkClass}>{section.title}</a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mt-10 space-y-10">
              {sections.map((section, index) => (
                <section key={section.title} id={`legal-section-${index + 1}`} className="scroll-mt-8" aria-labelledby={`legal-heading-${index + 1}`}>
                  <h2 id={`legal-heading-${index + 1}`} className="text-xl font-bold text-navy-950 sm:text-2xl">{section.title}</h2>
                  <div className="mt-3 space-y-4 text-base leading-7">
                    {section.body.split("\n\n").map((paragraph, paragraphIndex) => (
                      <p key={paragraphIndex}>{paragraph}</p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-10 border-t border-slate-200 pt-6">
              <a href={createMailtoHref(emailSubject)} className={`inline-flex max-w-full flex-wrap gap-x-1 ${linkClass}`}>
                <span>{emailLabel}:</span> <span>{CONTACT_EMAIL}</span>
              </a>
              <nav className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-sm" aria-label={common("related")}>
                <Link href="/privacy" className={linkClass}>{legal("privacy")}</Link>
                <Link href="/terms" className={linkClass}>{legal("terms")}</Link>
                <Link href="/cookies" className={linkClass}>{legal("cookies")}</Link>
                <a href="https://www.cloudflare.com/turnstile-privacy-policy/" className={linkClass}>Cloudflare Turnstile Privacy Addendum</a>
                <a href="https://azop.hr/" className={linkClass}>AZOP</a>
              </nav>
            </div>
          </article>
        </MarketingContainer>
      </main>
      <SiteFooter />
    </div>
  );
}
