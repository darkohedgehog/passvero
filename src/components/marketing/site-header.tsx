import { getTranslations } from "next-intl/server";

import { LanguageSwitcher } from "@/src/components/language-switcher";
import { BrandLogo } from "@/src/components/marketing/brand-logo";
import { MarketingContainer } from "@/src/components/marketing/marketing-container";
import { MobileNavigation } from "@/src/components/marketing/mobile-navigation";
import { Link } from "@/src/i18n/navigation";

export async function SiteHeader() {
  const t = await getTranslations("MarketingNavigation");
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
          <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-blue-600 bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-blue-700 hover:bg-blue-700">{t("login")}</Link>
        </div>

        <MobileNavigation
          brand={t("brand")}
          closeLabel={t("closeMenu")}
          ctaLabel={t("login")}
          ctaHref="/login"
          links={links}
          menuLabel={t("menu")}
        />
      </MarketingContainer>
    </header>
  );
}
