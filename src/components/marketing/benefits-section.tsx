import { getTranslations } from "next-intl/server";

import { MarketingIcon, type MarketingIconName } from "@/src/components/marketing/marketing-icons";

const benefits: ReadonlyArray<{ key: "trust" | "risk" | "efficiency" | "value"; icon: MarketingIconName }> = [
  { key: "trust", icon: "trust" },
  { key: "risk", icon: "risk" },
  { key: "efficiency", icon: "efficiency" },
  { key: "value", icon: "value" },
];

export async function BenefitsSection() {
  const t = await getTranslations("Benefits");

  return (
    <div className="p-7 sm:p-8 lg:p-9">
      <p className="marketing-section-label">{t("label")}</p>
      <h2 className="mt-3 max-w-lg text-3xl font-bold leading-[1.12] tracking-[-0.035em] text-navy-950 lg:text-[2rem]">{t("title")}</h2>
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {benefits.map((benefit) => (
          <article key={benefit.key} className="flex gap-4">
            <MarketingIcon name={benefit.icon} className="size-8 shrink-0 text-teal-500" />
            <div>
              <h3 className="text-sm font-bold text-navy-950">{t(`items.${benefit.key}.title`)}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">{t(`items.${benefit.key}.description`)}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
