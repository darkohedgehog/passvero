import { getTranslations } from "next-intl/server";

import { MarketingContainer } from "@/src/components/marketing/marketing-container";
import { MarketingIcon, type MarketingIconName } from "@/src/components/marketing/marketing-icons";

const industries: ReadonlyArray<{ key: "furniture" | "textiles" | "packaging" | "electronics" | "manufacturing" | "consumer"; icon: MarketingIconName }> = [
  { key: "furniture", icon: "furniture" },
  { key: "textiles", icon: "textiles" },
  { key: "packaging", icon: "packaging" },
  { key: "electronics", icon: "electronics" },
  { key: "manufacturing", icon: "manufacturing" },
  { key: "consumer", icon: "consumer" },
];

export async function IndustriesSection() {
  const t = await getTranslations("Industries");

  return (
    <section id="industries" className="scroll-mt-6 border-y border-slate-100 bg-slate-50/70 py-11 md:py-12">
      <MarketingContainer>
        <h2 className="text-center text-xl font-bold tracking-[-0.03em] text-navy-950 md:text-2xl">{t("title")}</h2>
        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-6">
          {industries.map((industry) => (
            <li key={industry.key} className="flex flex-col items-center gap-3 text-center text-slate-600">
              <MarketingIcon name={industry.icon} className="size-7 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500">{t(`items.${industry.key}`)}</span>
            </li>
          ))}
        </ul>
      </MarketingContainer>
    </section>
  );
}
