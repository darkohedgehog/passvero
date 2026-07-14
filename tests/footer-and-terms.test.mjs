import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const locales = ["hr", "sr", "en", "de", "sl", "pl"];
const root = new URL("../", import.meta.url);
const earlyAccessLabels = {
  hr: "Zatražite rani pristup",
  sr: "Zatražite rani pristup",
  en: "Request Early Access",
  de: "Frühzeitigen Zugang anfragen",
  sl: "Zaprosite za zgodnji dostop",
  pl: "Poproś o wczesny dostęp",
};
const earlyAccessSubjects = {
  hr: "Zahtjev za rani pristup Passveru",
  sr: "Zahtev za rani pristup Passveru",
  en: "Passvero early access request",
  de: "Anfrage für frühen Zugang zu Passvero",
  sl: "Zahteva za zgodnji dostop do Passvera",
  pl: "Prośba o wczesny dostęp do Passvero",
};

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

function collectKeys(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === "object" && !Array.isArray(child)
      ? collectKeys(child, path)
      : [path];
  });
}

test("all locales expose the same Early Access, Terms, and footer message schema", async () => {
  const messages = await Promise.all(
    locales.map(async (locale) => JSON.parse(await read(`messages/${locale}.json`))),
  );
  const canonicalKeys = collectKeys(messages[0]).sort();

  for (const [index, locale] of locales.entries()) {
    assert.deepEqual(collectKeys(messages[index]).sort(), canonicalKeys, locale);
    assert.equal(messages[index].MarketingNavigation.earlyAccess, earlyAccessLabels[locale]);
    assert.equal(messages[index].Hero.primaryAction, earlyAccessLabels[locale]);
    assert.equal(messages[index].CTA.primaryAction, earlyAccessLabels[locale]);
    assert.equal(messages[index].Footer.groups.company.earlyAccess, earlyAccessLabels[locale]);
    assert.equal(messages[index].Contact.earlyAccessSubject, earlyAccessSubjects[locale]);
    assert.equal(messages[index].MarketingNavigation.signIn, undefined);
    assert.equal(messages[index].MarketingNavigation.bookDemo, undefined);
    assert.equal(messages[index].CTA.secondaryAction, undefined);
    assert.ok(messages[index].Legal.Terms.metadata.title);
    assert.ok(messages[index].Footer.badge);
    assert.ok(messages[index].Footer.groups.product.features);
    assert.ok(messages[index].Footer.groups.legal.terms);
  }
});

test("public navigation and CTAs contain no sign-in or demo actions", async () => {
  const paths = [
    "src/components/marketing/site-header.tsx",
    "src/components/marketing/mobile-navigation.tsx",
    "src/components/marketing/hero-section.tsx",
    "src/components/marketing/final-cta-section.tsx",
    "src/components/marketing/site-footer.tsx",
    "src/components/marketing/dashboard-preview-section.tsx",
  ];
  const source = (await Promise.all(paths.map(read))).join("\n");

  for (const forbidden of ["signInLabel", 't("signIn")', "#demo", "demoSubject", "salesSubject", "bookDemo"])
    assert.doesNotMatch(source, new RegExp(forbidden.replace(/[()"#]/g, "\\$&")));
  assert.match(source, /#early-access/);
  assert.equal(source.match(/contact\("earlyAccessSubject"\)/g)?.length, 4);
});

test("public legal copy contains no draft or professional-review disclaimer", async () => {
  const messages = await Promise.all(
    locales.map(async (locale) => JSON.parse(await read(`messages/${locale}.json`))),
  );
  const forbiddenReviewCopy =
    /qualified legal counsel|professional legal review|before production launch|initial wording|pravni struč|pravnik|produkcijskog pokretanja|qualifizierter Rechtsberatung|Produktivstart|vorläufige Formulierung|pravni strokovnjak|produkcijskim zagonom|wykwalifikowanego prawnika|produkcyjnym uruchomieniem|wstępne brzmienie/i;
  const forbiddenDemoCopy =
    /book a demo|demo request|arrange demonstrations|dogovorite prezentaciju|organizaciju prezentacije|zakažite prezentaciju|organizovanje prezentacija|demo vereinbaren|vereinbarung von demonstrationen|rezervirajte predstavitev|dogovor predstavitev|umów prezentację|organizowania prezentacji|contact sales|kontaktirajte prodaju|vertrieb kontaktieren|skontaktuj się ze sprzedażą/i;

  for (const [index, locale] of locales.entries()) {
    const publicLegalCopy = JSON.stringify(messages[index].Legal);
    const publicMarketingCopy = JSON.stringify({
      navigation: messages[index].MarketingNavigation,
      hero: messages[index].Hero,
      cta: messages[index].CTA,
      contact: messages[index].Contact,
      footer: messages[index].Footer,
      privacyUse: messages[index].Legal.Privacy.sections.use.body,
    });
    assert.doesNotMatch(publicLegalCopy, forbiddenReviewCopy, locale);
    assert.doesNotMatch(publicMarketingCopy, forbiddenDemoCopy, locale);
  }
});

test("Terms route uses the shared legal document and all required sections", async () => {
  const source = await read("app/[locale]/terms/page.tsx");
  const requiredSections = [
    "introduction",
    "service",
    "eligibility",
    "acceptableUse",
    "productData",
    "intellectualProperty",
    "thirdPartyServices",
    "availability",
    "disclaimer",
    "liability",
    "termination",
    "governingLaw",
    "contact",
    "changes",
  ];

  assert.match(source, /LegalDocument/);
  assert.match(source, /pathname: "\/terms"/);
  for (const section of requiredSections) assert.match(source, new RegExp(`"${section}"`));
});

test("footer links only to real routes, anchors, and mail actions", async () => {
  const footer = await read("src/components/marketing/site-footer.tsx");
  const forbidden = [
    "Integrations",
    "Security",
    "API",
    "Documentation",
    "Guides",
    "Blog",
    "Webinars",
    "Careers",
    "Partners",
    "DPP",
    "ESPR",
    'href="#"',
  ];

  for (const value of forbidden) assert.doesNotMatch(footer, new RegExp(value));
  for (const href of ["#features", "#how-it-works", "#industries", "/privacy", "/cookies", "/terms"])
    assert.match(footer, new RegExp(href.replace("/", "\\/")));
  assert.match(footer, /createMailtoHref\(contact\("earlyAccessSubject"\)\)/);
  assert.match(footer, /mailto:\$\{CONTACT_EMAIL\}/);
});

test("footer anchors and Terms sitemap entries resolve", async () => {
  const features = await read("src/components/marketing/hero-section.tsx");
  const howItWorks = await read("src/components/marketing/how-it-works-section.tsx");
  const industries = await read("src/components/marketing/industries-section.tsx");
  const sitemap = await read("app/sitemap.ts");

  assert.match(features, /id="features"/);
  assert.match(howItWorks, /id="how-it-works"/);
  assert.match(industries, /id="industries"/);
  assert.match(sitemap, /"\/terms"/);
});

test("About and Contact messages exist in every locale", async () => {
  const messages = await Promise.all(
    locales.map(async (locale) => JSON.parse(await read(`messages/${locale}.json`))),
  );

  for (const [index, locale] of locales.entries()) {
    const about = messages[index].AboutPage;
    const contact = messages[index].ContactPage;

    assert.ok(about?.metadata?.title, `${locale} About metadata`);
    assert.ok(about?.hero?.title, `${locale} About hero`);
    assert.ok(about?.why?.title, `${locale} About rationale`);
    assert.ok(about?.audience?.items?.privateLabel, `${locale} About audience`);
    assert.ok(about?.company?.body, `${locale} About company`);
    assert.ok(about?.cta?.action, `${locale} About CTA`);
    assert.ok(contact?.metadata?.title, `${locale} Contact metadata`);
    assert.ok(contact?.hero?.title, `${locale} Contact hero`);
    assert.ok(contact?.email?.title, `${locale} Contact email`);
    assert.ok(contact?.company?.body, `${locale} Contact company`);
    assert.ok(contact?.earlyAccess?.action, `${locale} Contact CTA`);
    assert.ok(contact?.responseNote, `${locale} response note`);
  }
});

test("About and Contact routes use localized metadata and the shared marketing shell", async () => {
  const about = await read("app/[locale]/about/page.tsx");
  const contact = await read("app/[locale]/contact/page.tsx");

  for (const [source, pathname] of [[about, "/about"], [contact, "/contact"]]) {
    assert.match(source, /SiteHeader/);
    assert.match(source, /SiteFooter/);
    assert.match(source, /createLocalizedMetadata/);
    assert.match(source, new RegExp(`pathname: "${pathname}"`));
    assert.doesNotMatch(source, /<form\b|\/api\//);
  }

  assert.match(about, /createMailtoHref\(contact\("earlyAccessSubject"\)\)/);
  assert.match(contact, /createMailtoHref\(contact\("generalSubject"\)\)/);
  assert.match(contact, /createMailtoHref\(contact\("earlyAccessSubject"\)\)/);

  for (const source of [about, contact]) {
    assert.match(source, /target="_blank"/);
    assert.match(source, /rel="noopener noreferrer"/);
  }
});

test("public navigation and footer use localized About and Contact routes", async () => {
  const header = await read("src/components/marketing/site-header.tsx");
  const mobile = await read("src/components/marketing/mobile-navigation.tsx");
  const footer = await read("src/components/marketing/site-footer.tsx");

  for (const route of ["/about", "/contact"]) {
    assert.match(header, new RegExp(route));
    assert.match(footer, new RegExp(route));
  }

  assert.match(header, /import \{ Link \} from "@\/src\/i18n\/navigation"/);
  assert.match(mobile, /import \{ Link \} from "@\/src\/i18n\/navigation"/);
  assert.match(footer, /kind: "route"/);
  assert.doesNotMatch(header, /#pricing|#resources|#about/);
  assert.doesNotMatch(footer, /href: "#about"/);
});

test("sitemap and structured data include public company pages and supplied ownership", async () => {
  const sitemap = await read("app/sitemap.ts");
  const layout = await read("app/[locale]/layout.tsx");
  const site = await read("src/lib/site.ts");

  assert.match(sitemap, /"\/about"/);
  assert.match(sitemap, /"\/contact"/);
  assert.match(site, /Živić-elektro j\.d\.o\.o\./);
  assert.match(site, /https:\/\/www\.zivic-elektro\.com/);
  assert.match(layout, /"@type": "Brand"/);
  assert.match(layout, /publisher: \{ "@id": `\$\{SITE_URL\}\/\#organization` \}/);
});
