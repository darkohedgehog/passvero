import assert from "node:assert/strict";
import test from "node:test";
import { createLocalizedMetadata } from "../../src/lib/seo";

test("staging metadata uses explicitly supplied canonical origin", () => {
  const metadata = createLocalizedMetadata({ locale: "hr", title: "Test", description: "Test", imageAlt: "Test" }, "https://acceptance.example.test");
  assert.equal(new URL(String(metadata.metadataBase)).origin, "https://acceptance.example.test");
  assert.equal(metadata.alternates?.canonical, "https://acceptance.example.test/");
  assert.ok(!JSON.stringify(metadata).includes("https://passvero.eu"));
});

import { getAppStructuredData, getCanonicalRobots, getCanonicalSitemap } from "../../src/lib/canonical-site";
import { routing } from "../../src/i18n/routing";

for (const canonicalOrigin of ["https://passvero.eu", "https://acceptance.example.test"]) {
  test(`${canonicalOrigin}: all locale canonical, alternate and social URLs share one origin`, () => {
    for (const locale of routing.locales) {
      const metadata = createLocalizedMetadata({ locale, title: "Test", description: "Test", imageAlt: "Test", pathname: "/about" }, canonicalOrigin);
      const expectedPath = locale === "hr" ? "/about" : `/${locale}/about`;
      assert.equal(metadata.alternates?.canonical, canonicalOrigin + expectedPath);
      assert.equal(metadata.openGraph?.url, canonicalOrigin + expectedPath);
      assert.equal(metadata.alternates?.languages?.["x-default"], canonicalOrigin + "/about");
      for (const alternate of routing.locales) {
        assert.equal(metadata.alternates?.languages?.[alternate], canonicalOrigin + (alternate === "hr" ? "/about" : `/${alternate}/about`));
      }
      assert.equal(new URL("/og/passvero-og.png", String(metadata.metadataBase)).origin, canonicalOrigin);
      if (canonicalOrigin !== "https://passvero.eu") assert.ok(!JSON.stringify(metadata).includes("https://passvero.eu"));
    }
    const sitemap = getCanonicalSitemap(canonicalOrigin);
    assert.equal(sitemap.length, 36);
    assert.ok(sitemap.every(entry => new URL(entry.url).origin === canonicalOrigin));
    const robots = getCanonicalRobots(canonicalOrigin);
    assert.equal(robots.host, canonicalOrigin);
    assert.equal(robots.sitemap, canonicalOrigin + "/sitemap.xml");
    const structured = getAppStructuredData(canonicalOrigin)["@graph"];
    assert.ok(structured.every(entry => entry["@id"].startsWith(canonicalOrigin + "/#")));
    assert.equal(structured[0].url, "https://www.zivic-elektro.com");
    assert.equal(structured[1].url, canonicalOrigin);
    assert.equal(structured[2].url, canonicalOrigin);
  });
}
