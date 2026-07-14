import { getTranslations } from "next-intl/server";

import { MarketingButton } from "@/src/components/marketing/marketing-button";
import { MarketingContainer } from "@/src/components/marketing/marketing-container";
import { createMailtoHref } from "@/src/lib/site";

const plans = ["starter", "growth", "business"] as const;

export async function PricingSection() {
  const t = await getTranslations("Pricing");
  const contact = await getTranslations("Contact");

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

        <div className="mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-3 md:items-stretch">
          {plans.map((plan) => {
            const isFeatured = plan === "growth";

            return (
              <article
                key={plan}
                className={`relative flex min-w-0 flex-col rounded-[20px] border p-6 md:p-7 ${
                  isFeatured
                    ? "border-blue-500 bg-blue-50/50 shadow-[0_16px_40px_rgba(37,99,235,0.12)] md:-translate-y-2"
                    : "border-slate-200 bg-slate-50/70"
                }`}
              >
                {isFeatured ? (
                  <p className="mb-4 inline-flex self-start rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                    {t("featured")}
                  </p>
                ) : null}
                <h3 className="text-2xl font-bold text-navy-950">
                  {t(`plans.${plan}.name`)}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {t(`plans.${plan}.description`)}
                </p>
                <p className="mt-8 border-t border-slate-200 pt-5 text-sm font-semibold text-teal-700">
                  {t("status")}
                </p>
              </article>
            );
          })}
        </div>

        <div className="mt-10 flex flex-col items-center text-center">
          <MarketingButton href={createMailtoHref(contact("earlyAccessSubject"))}>
            {t("action")}
          </MarketingButton>
          <p className="mt-4 text-sm text-slate-500">{t("note")}</p>
        </div>
      </MarketingContainer>
    </section>
  );
}
