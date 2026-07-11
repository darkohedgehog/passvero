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
    <section className="py-18 md:py-24">
      <MarketingContainer>
        <div className="text-center">
          <p className="marketing-section-label">{t("label")}</p>
          <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-bold tracking-[-0.035em] text-navy-950 md:text-4xl">{t("title")}</h2>
        </div>
        <ol className="relative mx-auto mt-14 grid max-w-5xl gap-8 md:grid-cols-4 md:gap-4">
          <span className="absolute left-[12.5%] right-[12.5%] top-12 hidden border-t-2 border-dashed border-teal-300 md:block" aria-hidden="true" />
          {steps.map((step, index) => (
            <li key={step.key} className="relative grid grid-cols-[4.75rem_1fr] items-start gap-5 md:block md:text-center">
              <div className="relative z-10 grid size-20 place-items-center rounded-full bg-teal-50 text-teal-600 shadow-[0_10px_30px_rgba(15,159,145,0.08)] md:mx-auto md:size-24">
                <MarketingIcon name={step.icon} className="size-9 md:size-11" />
                <span className="absolute -bottom-2 grid size-6 place-items-center rounded-full bg-teal-500 text-xs font-bold text-white">{index + 1}</span>
              </div>
              <div className="pt-2 md:pt-6">
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
