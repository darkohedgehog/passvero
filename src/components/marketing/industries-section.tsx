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
    <section className="border-y border-slate-100 bg-slate-50/80 py-14 md:py-16">
      <MarketingContainer>
        <h2 className="text-center text-2xl font-bold tracking-[-0.03em] text-navy-950 md:text-3xl">{t("title")}</h2>
        <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
          {industries.map((industry) => (
            <li key={industry.key} className="flex flex-col items-center gap-3 text-center text-slate-600">
              <MarketingIcon name={industry.icon} className="size-8 text-slate-500" />
              <span className="text-sm font-semibold">{t(`items.${industry.key}`)}</span>
            </li>
          ))}
        </ul>
      </MarketingContainer>
    </section>
  );
}
