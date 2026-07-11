import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { MarketingButton } from "@/src/components/marketing/marketing-button";
import { MarketingContainer } from "@/src/components/marketing/marketing-container";
import { MarketingIcon } from "@/src/components/marketing/marketing-icons";
import { BenefitsSection } from "@/src/components/marketing/benefits-section";

export async function FinalCtaSection() {
  const t = await getTranslations("CTA");

  return (
    <section id="demo" className="bg-slate-50 py-14 md:py-20">
      <MarketingContainer>
        <div className="overflow-hidden rounded-[20px] border border-slate-100 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)] lg:grid lg:grid-cols-[0.8fr_1.2fr]">
          <BenefitsSection />
          <div className="relative m-3 overflow-hidden rounded-2xl bg-[linear-gradient(120deg,#eff6ff_0%,#f8fafc_48%,#e6fffb_100%)] px-7 py-10 sm:px-10 lg:m-5 lg:px-12 lg:py-12">
            <div className="relative z-10 max-w-md">
              <h2 className="text-3xl font-bold tracking-[-0.035em] text-navy-950 md:text-4xl">{t("title")}</h2>
              <p className="mt-4 text-base text-slate-600">{t("description")}</p>
              <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
                <MarketingButton href="#product" variant="primary" className="w-full sm:w-auto">{t("primaryAction")}</MarketingButton>
                <MarketingButton href="#resources" variant="secondary" className="w-full sm:w-auto">{t("secondaryAction")}</MarketingButton>
              </div>
              <div className="mt-6 flex flex-col gap-3 text-xs text-slate-600 sm:flex-row sm:gap-7">
                <span className="flex items-center gap-2"><MarketingIcon name="check" className="size-4 text-teal-500" />{t("noteOne")}</span>
                <span className="flex items-center gap-2"><MarketingIcon name="check" className="size-4 text-teal-500" />{t("noteTwo")}</span>
              </div>
            </div>
            <Image
              src="/marketing/verification-shield.png"
              alt={t("visualAlt")}
              width={1254}
              height={1254}
              sizes="(max-width: 639px) 45vw, 290px"
              className="relative -bottom-9 left-1/2 h-auto w-[62%] max-w-[18rem] -translate-x-1/2 sm:absolute sm:-bottom-8 sm:left-auto sm:right-[-1rem] sm:w-[44%] sm:translate-x-0 lg:right-[-0.5rem]"
            />
          </div>
        </div>
      </MarketingContainer>
    </section>
  );
}
