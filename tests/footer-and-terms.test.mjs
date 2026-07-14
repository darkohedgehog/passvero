import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const locales = ["hr", "sr", "en", "de", "sl", "pl"];
const root = new URL("../", import.meta.url);

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

test("all locales expose the same Terms and footer message schema", async () => {
  const messages = await Promise.all(
    locales.map(async (locale) => JSON.parse(await read(`messages/${locale}.json`))),
  );
  const canonicalKeys = collectKeys(messages[0]).sort();

  for (const [index, locale] of locales.entries()) {
    assert.deepEqual(collectKeys(messages[index]).sort(), canonicalKeys, locale);
    assert.ok(messages[index].Legal.Terms.metadata.title);
    assert.ok(messages[index].Footer.badge);
    assert.ok(messages[index].Footer.groups.product.features);
    assert.ok(messages[index].Footer.groups.company.bookDemo);
    assert.ok(messages[index].Footer.groups.legal.terms);
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
  assert.match(footer, /createMailtoHref\(contact\("demoSubject"\)\)/);
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
