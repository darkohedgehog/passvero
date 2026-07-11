import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { MarketingButton } from "@/src/components/marketing/marketing-button";
import { MarketingContainer } from "@/src/components/marketing/marketing-container";
import { MarketingIcon } from "@/src/components/marketing/marketing-icons";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export async function DashboardPreviewSection() {
  const t = await getTranslations("DashboardPreview");
  const rawFeatures: unknown = t.raw("features");
  const features = isStringArray(rawFeatures) ? rawFeatures : [];

  return (
    <section className="pb-16 pt-6 md:pb-20 md:pt-8">
      <MarketingContainer className="grid items-center gap-9 lg:grid-cols-[0.62fr_1.38fr] lg:gap-7">
        <div>
          <p className="marketing-section-label">{t("label")}</p>
          <h2 className="mt-3 text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-navy-950 lg:text-[2.75rem]">{t("title")}</h2>
          <p className="mt-6 max-w-lg text-base leading-7 text-slate-600">{t("description")}</p>
          <ul className="mt-7 space-y-3">
            {features.map((feature) => (
              <li key={feature} className="flex gap-3 text-sm text-slate-700">
                <MarketingIcon name="check" className="mt-0.5 size-5 shrink-0 text-teal-500" />
                {feature}
              </li>
            ))}
          </ul>
          <MarketingButton href="#demo" variant="secondary" className="mt-8">{t("action")}</MarketingButton>
        </div>
        <div className="relative -mx-3 overflow-hidden rounded-[20px] bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.1)] sm:mx-0">
          <div className="absolute inset-x-[8%] bottom-[2%] h-1/3 rounded-full bg-blue-100/60 blur-3xl" aria-hidden="true" />
          <Image
            src="/marketing/dashboard-preview.png"
            alt={t("visualAlt")}
            width={1619}
            height={972}
            sizes="(max-width: 1023px) 100vw, 67vw"
            className="relative h-auto w-full mix-blend-multiply"
          />
        </div>
      </MarketingContainer>
    </section>
  );
}
