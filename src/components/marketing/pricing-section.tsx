import { getLocale, getTranslations } from "next-intl/server";

import { MarketingButton } from "@/src/components/marketing/marketing-button";
import { MarketingContainer } from "@/src/components/marketing/marketing-container";
import { getPathname } from "@/src/i18n/navigation";
import { STANDARD_PLANS } from "@/src/application/subscriptions/catalog";

export async function PricingSection() {
  const t = await getTranslations("Pricing");
  const locale = await getLocale();
  const accessHref = getPathname({ locale, href: "/request-access" });
  const currency = new Intl.NumberFormat(locale, {
    style: "currency", currency: "EUR", maximumFractionDigits: 0,
  });

  return (
    <section id="pricing" className="scroll-mt-6 border-t border-slate-100 bg-white py-16 md:py-24">
      <MarketingContainer>
        <div className="mx-auto max-w-3xl text-center">
          <p className="marketing-section-label">{t("label")}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-navy-950 md:text-4xl">
            {t("title")}
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
            {t("description")}
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-slate-600">{t("priceNotice")}</p>
        <div className="mx-auto mt-12 grid max-w-6xl gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {STANDARD_PLANS.map((plan) => (
            <article key={plan.slug} className="flex min-w-0 flex-col rounded-[20px] border border-slate-200 bg-slate-50/70 p-6">
              <h3 className="text-2xl font-bold text-navy-950">{plan.name}</h3>
              <p className="mt-3 text-sm font-semibold text-teal-700">{t("published", { count: plan.limits.maxPublishedProducts })}</p>
              <dl className="mt-6 space-y-4 border-t border-slate-200 pt-5">
                {[3, 12].map((months) => (
                  <div key={months}>
                    <dt className="text-sm text-slate-600">{t("months", { count: months })}</dt>
                    <dd className="mt-1 text-2xl font-bold text-navy-950">{currency.format((months === 3 ? plan.quarterlyPriceCents : plan.yearlyPriceCents) / 100)}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-5 text-sm leading-6 text-slate-600">{t("limits", { count: plan.limits.maxStoredProducts, storage: plan.limits.maxStorageBytes / 1024 ** 3, pdf: plan.limits.maxPdfAttachments })}</p>
              <div className="mt-auto pt-6"><MarketingButton href={accessHref} className="w-full">{t("action")}</MarketingButton></div>
            </article>
          ))}
          <article className="flex min-w-0 flex-col rounded-[20px] border border-slate-200 bg-slate-50/70 p-6">
            <h3 className="text-2xl font-bold text-navy-950">Custom</h3>
            <p className="mt-3 text-sm font-semibold text-teal-700">{t("customScope")}</p>
            <p className="mt-6 border-t border-slate-200 pt-5 text-2xl font-bold text-navy-950">{t("customPrice")}</p>
            <p className="mt-5 text-sm leading-6 text-slate-600">{t("customDescription")}</p>
            <div className="mt-auto pt-6"><MarketingButton href={accessHref} className="w-full">{t("action")}</MarketingButton></div>
          </article>
        </div>
        <div className="mx-auto mt-10 max-w-4xl space-y-4 text-sm leading-6 text-slate-600">
          <p>{t("trial")}</p>
          <p>{t("payment")}</p>
          <p>{t("expiry")} <a href="#pricing-availability" className="font-semibold text-teal-700 underline">{t("availabilityLink")}</a></p>
          <details id="pricing-availability" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <summary className="cursor-pointer font-semibold text-navy-950">{t("detailsTitle")}</summary>
            <div className="mt-4 space-y-3">
              <p>{t("counting")}</p>
              <p>{t("availability")}</p>
              <p>{t("retention")}</p>
            </div>
          </details>
        </div>
      </MarketingContainer>
    </section>
  );
}
