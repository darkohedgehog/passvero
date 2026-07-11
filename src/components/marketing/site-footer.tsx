import { getTranslations } from "next-intl/server";

import { BrandLogo } from "@/src/components/marketing/brand-logo";
import { MarketingContainer } from "@/src/components/marketing/marketing-container";
import { Link } from "@/src/i18n/navigation";
import { CONTACT_EMAIL, createMailtoHref } from "@/src/lib/site";

type FooterGroupKey = "product" | "solutions" | "resources" | "company" | "compliance";

const groupKeys: readonly FooterGroupKey[] = ["product", "solutions", "resources", "company", "compliance"];

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export async function SiteFooter() {
  const t = await getTranslations("Footer");
  const navigation = await getTranslations("MarketingNavigation");
  const contact = await getTranslations("Contact");
  const groups = groupKeys.map((key) => {
    const rawItems: unknown = t.raw(`groups.${key}.items`);
    return { key, title: t(`groups.${key}.title`), items: isStringArray(rawItems) ? rawItems : [] };
  });

  return (
    <footer id="about" className="marketing-dark-grid text-white">
      <MarketingContainer className="py-11 md:py-12">
        <div className="grid gap-10 lg:grid-cols-[1.25fr_repeat(5,0.75fr)] lg:gap-7">
          <div>
            <BrandLogo label={navigation("brand")} inverse />
            <p className="mt-4 max-w-[15rem] text-xs leading-5 text-slate-300">{t("summary")}</p>
          </div>

          {groups.map((group) => (
            <div key={group.key} className="hidden lg:block">
              <h2 className="text-sm font-semibold">{group.title}</h2>
              <ul className="mt-3 space-y-2.5">
                {group.items.map((item) => <li key={item} className="text-xs text-slate-300">{item}</li>)}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 divide-y divide-slate-700 border-y border-slate-700 lg:hidden">
          {groups.map((group) => (
            <details key={group.key} className="group py-1">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between py-3 font-semibold marker:hidden">
                {group.title}<span aria-hidden="true" className="text-xl transition-transform group-open:rotate-45">+</span>
              </summary>
              <ul className="pb-5 space-y-3">
                {group.items.map((item) => <li key={item} className="text-sm text-slate-300">{item}</li>)}
              </ul>
            </details>
          ))}
        </div>
        <nav aria-label={t("legalLabel")} className="mt-8 flex flex-col items-center justify-center gap-3 border-t border-slate-700 pt-7 text-xs text-slate-300 sm:flex-row sm:gap-6">
          <Link href="/privacy" className="rounded-sm hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400">{t("privacy")}</Link>
          <Link href="/cookies" className="rounded-sm hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400">{t("cookies")}</Link>
          <a href={createMailtoHref(contact("generalSubject"))} className="rounded-sm hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400">
            {t("email")}: {CONTACT_EMAIL}
          </a>
        </nav>
        <p className="mt-9 text-center text-[0.6875rem] text-slate-400">{t("copyright")}</p>
      </MarketingContainer>
    </footer>
  );
}
