import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { MarketingButton } from "@/src/components/marketing/marketing-button";
import { MarketingContainer } from "@/src/components/marketing/marketing-container";
import { MarketingIcon, type MarketingIconName } from "@/src/components/marketing/marketing-icons";
import { createMailtoHref } from "@/src/lib/site";

const featureItems: ReadonlyArray<{ key: "ready" | "secure" | "interoperable" | "scalable"; icon: MarketingIconName }> = [
  { key: "ready", icon: "compliance" },
  { key: "secure", icon: "secure" },
  { key: "interoperable", icon: "interoperable" },
  { key: "scalable", icon: "analytics" },
];

export async function HeroSection() {
  const t = await getTranslations("Hero");
  const contact = await getTranslations("Contact");
  const title = t("title");
  const highlight = t("highlight");
  const highlightIndex = title.indexOf(highlight);
  const titleStart = highlightIndex >= 0 ? title.slice(0, highlightIndex) : title;

  return (
    <section id="product" className="pb-12 pt-6 md:pb-16 lg:pb-8 lg:pt-5">
      <MarketingContainer>
        <div className="grid items-center gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-5">
          <div className="relative z-10 max-w-140 lg:pb-20">
            <span className="inline-flex rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-teal-700">
              {t("badge")}
            </span>
            <h1 className="mt-4 text-[2.375rem] font-bold leading-[1.06] tracking-[-0.045em] text-navy-950 sm:text-5xl lg:text-[3.5rem] lg:leading-[1.04]">
              {titleStart}
              {highlightIndex >= 0 ? <span className="block text-teal-500">{highlight}</span> : null}
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-600 lg:text-[1.0625rem] lg:leading-8">
              {t("description")}
            </p>
            <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
              <MarketingButton href={createMailtoHref(contact("demoSubject"))} variant="primary" className="w-full sm:w-auto">{t("primaryAction")}</MarketingButton>
              <MarketingButton href="#solutions" variant="secondary" className="w-full gap-2 sm:w-auto">
                <MarketingIcon name="play" className="size-4" />
                {t("secondaryAction")}
              </MarketingButton>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-152 lg:-mb-8 lg:-mt-16 lg:justify-self-end">
            <Image
              src="/marketing/hero-passport.png"
              alt={t("visualAlt")}
              width={1012}
              height={1536}
              priority
              sizes="(max-width: 1023px) 90vw, 52vw"
              className="mx-auto h-auto w-[min(100%,30rem)] object-contain mix-blend-multiply lg:w-xl"
              style={{
                WebkitMaskImage:
                  "linear-gradient(to right, transparent 0, black 5%)",
                maskImage:
                  "linear-gradient(to right, transparent 0, black 5%)",
              }}
            />
          </div>
        </div>

        <div id="features" className="mt-8 scroll-mt-6 grid grid-cols-2 gap-x-5 gap-y-6 border-t border-slate-100 pt-7 lg:-mt-28 lg:w-[53%] lg:grid-cols-4 lg:gap-x-7 lg:border-0 lg:pt-0">
          {featureItems.map((item) => (
            <div key={item.key} className="flex gap-3 lg:flex lg:items-start">
              <MarketingIcon name={item.icon} className="size-6 shrink-0 text-navy-800" />
              <div>
                <h2 className="text-xs font-bold text-navy-950">{t(`features.${item.key}.title`)}</h2>
                <p className="mt-1 text-[0.68rem] leading-4 text-slate-600">{t(`features.${item.key}.description`)}</p>
              </div>
            </div>
          ))}
        </div>
      </MarketingContainer>
    </section>
  );
}
