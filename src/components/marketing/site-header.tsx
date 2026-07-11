import { getTranslations } from "next-intl/server";

import { LanguageSwitcher } from "@/src/components/language-switcher";
import { BrandLogo } from "@/src/components/marketing/brand-logo";
import { MarketingButton } from "@/src/components/marketing/marketing-button";
import { MarketingContainer } from "@/src/components/marketing/marketing-container";
import { MobileNavigation } from "@/src/components/marketing/mobile-navigation";
import { createMailtoHref } from "@/src/lib/site";

export async function SiteHeader() {
  const t = await getTranslations("MarketingNavigation");
  const contact = await getTranslations("Contact");
  const demoHref = createMailtoHref(contact("demoSubject"));
  const links = [
    { href: "#product", label: t("product") },
    { href: "#solutions", label: t("solutions") },
    { href: "#pricing", label: t("pricing") },
    { href: "#resources", label: t("resources") },
    { href: "#about", label: t("about") },
  ];

  return (
    <header className="relative z-30 py-4 lg:py-5">
      <MarketingContainer className="flex items-center justify-between gap-5">
        <a href="#product" className="rounded-lg" aria-label={t("brand")}>
          <BrandLogo label={t("brand")} />
        </a>

        <nav className="hidden items-center gap-7 lg:flex" aria-label={t("menu")}>
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md text-[0.8125rem] font-medium text-slate-700 transition-colors hover:text-blue-600"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <LanguageSwitcher />
          <a
            href="#demo"
            className="rounded-md text-[0.8125rem] font-semibold text-blue-600 hover:text-blue-700"
          >
            {t("signIn")}
          </a>
          <MarketingButton href={demoHref}>{t("bookDemo")}</MarketingButton>
        </div>

        <MobileNavigation
          brand={t("brand")}
          closeLabel={t("closeMenu")}
          ctaLabel={t("bookDemo")}
          ctaHref={demoHref}
          links={links}
          menuLabel={t("menu")}
          signInLabel={t("signIn")}
        />
      </MarketingContainer>
    </header>
  );
}
