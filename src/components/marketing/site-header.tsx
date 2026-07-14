import { getTranslations } from "next-intl/server";

import { LanguageSwitcher } from "@/src/components/language-switcher";
import { BrandLogo } from "@/src/components/marketing/brand-logo";
import { MarketingButton } from "@/src/components/marketing/marketing-button";
import { MarketingContainer } from "@/src/components/marketing/marketing-container";
import { MobileNavigation } from "@/src/components/marketing/mobile-navigation";
import { Link } from "@/src/i18n/navigation";
import { createMailtoHref } from "@/src/lib/site";

export async function SiteHeader() {
  const t = await getTranslations("MarketingNavigation");
  const contact = await getTranslations("Contact");
  const earlyAccessHref = createMailtoHref(contact("earlyAccessSubject"));
  const links = [
    { href: "/#product", label: t("product") },
    { href: "/#solutions", label: t("solutions") },
    { href: "/#pricing", label: t("pricing") },
    { href: "/about", label: t("about") },
    { href: "/contact", label: t("contact") },
  ];

  return (
    <header className="relative z-30 py-4 lg:py-5">
      <MarketingContainer className="flex items-center justify-between gap-5">
        <Link href="/" className="rounded-lg" aria-label={t("brand")}>
          <BrandLogo label={t("brand")} />
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label={t("menu")}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md text-[0.8125rem] font-medium text-slate-700 transition-colors hover:text-blue-600"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <LanguageSwitcher />
          <MarketingButton href={earlyAccessHref}>{t("earlyAccess")}</MarketingButton>
        </div>

        <MobileNavigation
          brand={t("brand")}
          closeLabel={t("closeMenu")}
          ctaLabel={t("earlyAccess")}
          ctaHref={earlyAccessHref}
          links={links}
          menuLabel={t("menu")}
        />
      </MarketingContainer>
    </header>
  );
}
