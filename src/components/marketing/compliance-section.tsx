import { getTranslations } from "next-intl/server";

import { MarketingContainer } from "@/src/components/marketing/marketing-container";
import { MarketingIcon, type MarketingIconName } from "@/src/components/marketing/marketing-icons";

const items: ReadonlyArray<{ key: "ready" | "secure" | "interoperable" | "scalable"; icon: MarketingIconName }> = [
  { key: "ready", icon: "compliance" },
  { key: "secure", icon: "secure" },
  { key: "interoperable", icon: "interoperable" },
  { key: "scalable", icon: "analytics" },
];

export async function ComplianceSection() {
  const t = await getTranslations("Compliance");

  return (
    <section id="solutions" className="marketing-dark-grid py-11 text-white md:py-12">
      <MarketingContainer>
        <div className="text-center">
          <h2 className="text-[1.35rem] font-bold tracking-[-0.03em] md:text-2xl">{t("title")}</h2>
          <span className="mx-auto mt-4 block h-0.5 w-12 bg-teal-400" aria-hidden="true" />
        </div>
        <div className="mt-9 grid gap-7 sm:grid-cols-2 lg:grid-cols-4 lg:gap-9">
          {items.map((item) => (
            <article key={item.key} className="flex gap-4">
              <MarketingIcon name={item.icon} className="size-8 shrink-0 text-blue-400" />
              <div>
                <h3 className="font-semibold">{t(`items.${item.key}.title`)}</h3>
                <p className="mt-1.5 text-[0.8125rem] leading-5 text-slate-300">{t(`items.${item.key}.description`)}</p>
              </div>
            </article>
          ))}
        </div>
      </MarketingContainer>
    </section>
  );
}
