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
