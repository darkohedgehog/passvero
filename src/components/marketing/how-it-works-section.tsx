import { getTranslations } from "next-intl/server";

import { MarketingContainer } from "@/src/components/marketing/marketing-container";
import { MarketingIcon, type MarketingIconName } from "@/src/components/marketing/marketing-icons";

const steps: ReadonlyArray<{ key: "create" | "generate" | "share" | "verify"; icon: MarketingIconName }> = [
  { key: "create", icon: "document" },
  { key: "generate", icon: "qr" },
  { key: "share", icon: "share" },
  { key: "verify", icon: "verify" },
];

export async function HowItWorksSection() {
  const t = await getTranslations("HowItWorks");

  return (
    <section id="how-it-works" className="scroll-mt-6 py-16 md:py-20">
      <MarketingContainer>
        <div className="text-center">
          <p className="marketing-section-label">{t("label")}</p>
          <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-bold tracking-[-0.035em] text-navy-950 md:text-4xl">{t("title")}</h2>
        </div>
        <ol className="relative mx-auto mt-12 grid max-w-5xl gap-7 md:grid-cols-4 md:gap-4">
          <span className="absolute bottom-8 left-8 top-8 border-l-2 border-dashed border-teal-200 md:hidden" aria-hidden="true" />
          <span className="absolute left-[12.5%] right-[12.5%] top-10 hidden border-t-2 border-dashed border-teal-300 md:block" aria-hidden="true" />
          {steps.map((step, index) => (
            <li key={step.key} className="relative grid grid-cols-[4rem_1fr] items-start gap-5 md:block md:text-center">
              <div className="relative z-10 grid size-16 place-items-center rounded-full bg-teal-50 text-teal-600 shadow-[0_8px_24px_rgba(15,159,145,0.08)] md:mx-auto md:size-20">
                <MarketingIcon name={step.icon} className="size-7 md:size-9" />
                <span className="absolute -bottom-2 grid size-6 place-items-center rounded-full bg-teal-700 text-xs font-bold text-white">{index + 1}</span>
              </div>
              <div className="pt-1 md:pt-5">
                <h3 className="font-bold text-navy-950">{t(`steps.${step.key}.title`)}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{t(`steps.${step.key}.description`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </MarketingContainer>
    </section>
  );
}
