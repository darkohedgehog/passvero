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
    <section id="solutions" className="marketing-dark-grid py-14 text-white md:py-16">
      <MarketingContainer>
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-[-0.03em] md:text-3xl">{t("title")}</h2>
          <span className="mx-auto mt-5 block h-0.5 w-14 bg-teal-400" aria-hidden="true" />
        </div>
        <div className="mt-12 grid gap-9 sm:grid-cols-2 lg:grid-cols-4 lg:gap-12">
          {items.map((item) => (
            <article key={item.key} className="flex gap-4">
              <MarketingIcon name={item.icon} className="size-10 shrink-0 text-blue-400" />
              <div>
                <h3 className="font-semibold">{t(`items.${item.key}.title`)}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{t(`items.${item.key}.description`)}</p>
              </div>
            </article>
          ))}
        </div>
      </MarketingContainer>
    </section>
  );
}
