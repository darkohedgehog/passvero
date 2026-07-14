import { getTranslations } from "next-intl/server";

import { BrandLogo } from "@/src/components/marketing/brand-logo";
import { MarketingContainer } from "@/src/components/marketing/marketing-container";
import { Link } from "@/src/i18n/navigation";
import { CONTACT_EMAIL, createMailtoHref } from "@/src/lib/site";

type FooterLink =
  | { key: string; href: string; kind: "mailto" }
  | { key: string; href: string; kind: "route" };

type FooterGroup = {
  key: "product" | "company" | "legal";
  title: string;
  links: readonly (FooterLink & { label: string })[];
};

const linkClassName =
  "rounded-sm text-slate-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400";

function FooterLinkItem({ link }: Readonly<{ link: FooterLink & { label: string } }>) {
  if (link.kind === "route") {
    return <Link href={link.href} className={linkClassName}>{link.label}</Link>;
  }

  return <a href={link.href} className={linkClassName}>{link.label}</a>;
}

function FooterLinkList({ links, mobile = false }: Readonly<{ links: FooterGroup["links"]; mobile?: boolean }>) {
  return (
    <ul className={mobile ? "space-y-3 pb-5" : "mt-4 space-y-3"}>
      {links.map((link) => (
        <li key={link.key} className={mobile ? "text-sm" : "text-xs"}>
          <FooterLinkItem link={link} />
        </li>
      ))}
    </ul>
  );
}

export async function SiteFooter() {
  const t = await getTranslations("Footer");
  const navigation = await getTranslations("MarketingNavigation");
  const contact = await getTranslations("Contact");
  const groups: readonly FooterGroup[] = [
    {
      key: "product",
      title: t("groups.product.title"),
      links: [
        { key: "features", label: t("groups.product.features"), href: "/#features", kind: "route" },
        { key: "howItWorks", label: t("groups.product.howItWorks"), href: "/#how-it-works", kind: "route" },
        { key: "industries", label: t("groups.product.industries"), href: "/#industries", kind: "route" },
      ],
    },
    {
      key: "company",
      title: t("groups.company.title"),
      links: [
        { key: "about", label: t("groups.company.about"), href: "/about", kind: "route" },
        { key: "contact", label: t("groups.company.contact"), href: "/contact", kind: "route" },
        { key: "earlyAccess", label: t("groups.company.earlyAccess"), href: createMailtoHref(contact("earlyAccessSubject")), kind: "mailto" },
      ],
    },
    {
      key: "legal",
      title: t("groups.legal.title"),
      links: [
        { key: "privacy", label: t("groups.legal.privacy"), href: "/privacy", kind: "route" },
        { key: "cookies", label: t("groups.legal.cookies"), href: "/cookies", kind: "route" },
        { key: "terms", label: t("groups.legal.terms"), href: "/terms", kind: "route" },
      ],
    },
  ];
  const legalLinks = groups[2].links;

  return (
    <footer className="marketing-dark-grid text-white">
      <MarketingContainer className="py-11 md:py-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))] lg:gap-10">
          <div>
            <BrandLogo label={navigation("brand")} inverse />
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">{t("summary")}</p>
            <a href={`mailto:${CONTACT_EMAIL}`} className={`mt-4 inline-flex text-sm ${linkClassName}`}>
              {CONTACT_EMAIL}
            </a>
            <p className="mt-5 inline-flex max-w-full rounded-full border border-teal-400/35 bg-teal-400/10 px-3 py-1.5 text-xs font-medium leading-5 text-teal-100">
              {t("badge")}
            </p>
          </div>

          {groups.map((group) => (
            <div key={group.key} className="hidden lg:block">
              <h2 className="text-sm font-semibold">{group.title}</h2>
              <FooterLinkList links={group.links} />
            </div>
          ))}
        </div>

        <div className="mt-8 divide-y divide-slate-700 border-y border-slate-700 lg:hidden">
          {groups.map((group) => (
            <details key={group.key} className="group py-1">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between py-3 font-semibold marker:hidden">
                {group.title}
                <span aria-hidden="true" className="text-xl transition-transform group-open:rotate-45">+</span>
              </summary>
              <FooterLinkList links={group.links} mobile />
            </details>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-5 border-t border-slate-700 pt-7 text-xs text-slate-300 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <nav aria-label={t("legalLabel")}>
            <ul className="flex flex-wrap gap-x-6 gap-y-3">
              {legalLinks.map((link) => (
                <li key={link.key}><FooterLinkItem link={link} /></li>
              ))}
            </ul>
          </nav>
          <p className="text-slate-400">{t("copyright", { year: new Date().getFullYear() })}</p>
        </div>
      </MarketingContainer>
    </footer>
  );
}
