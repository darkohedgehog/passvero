import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { MarketingButton } from "@/src/components/marketing/marketing-button";
import { MarketingContainer } from "@/src/components/marketing/marketing-container";
import { MarketingIcon } from "@/src/components/marketing/marketing-icons";
import { BenefitsSection } from "@/src/components/marketing/benefits-section";

export async function FinalCtaSection() {
  const t = await getTranslations("CTA");

  return (
    <section id="demo" className="bg-slate-50 py-12 md:py-16">
      <MarketingContainer>
        <div className="overflow-hidden rounded-[20px] border border-slate-100 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)] lg:grid lg:grid-cols-[0.82fr_1.18fr]">
          <BenefitsSection />
          <div className="relative m-3 min-h-[27rem] overflow-hidden rounded-2xl bg-[linear-gradient(120deg,#eff6ff_0%,#f8fafc_48%,#e6fffb_100%)] px-7 py-9 sm:min-h-[22rem] sm:px-10 lg:m-4 lg:min-h-0 lg:px-10 lg:py-10">
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
              className="absolute -bottom-4 left-1/2 h-auto w-[58%] max-w-[16rem] -translate-x-1/2 sm:-bottom-7 sm:left-auto sm:right-[-0.5rem] sm:w-[42%] sm:translate-x-0 lg:-bottom-5 lg:right-[-0.75rem] lg:w-[43%]"
            />
          </div>
        </div>
      </MarketingContainer>
    </section>
  );
}
