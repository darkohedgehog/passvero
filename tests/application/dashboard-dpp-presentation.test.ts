import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DppList } from "../../src/components/application/dashboard/dpp-list";
import { isDashboardNavActive } from "../../src/components/application/dashboard/dashboard-navigation";
import en from "../../messages/en.json";
import hr from "../../messages/hr.json";
import sr from "../../messages/sr.json";
import sl from "../../messages/sl.json";
import de from "../../messages/de.json";
import pl from "../../messages/pl.json";

test("six locales expose published version, safe public action, archived state and empty list", () => {
  for (const messages of [en, hr, sr, sl, de, pl]) {
    assert.deepEqual(Object.keys(messages.DppList).sort(), Object.keys(en.DppList).sort());
    const labels = messages.DppList;
    const row = { organizationId: "org", productId: "product", name: "<Published>", sku: "SKU", versionNumber: 1, imageId: "published-image", archived: false, publicHref: "/p/public-code?lang=hr" };
    const html = renderToStaticMarkup(createElement(DppList, { labels, items: [row, { ...row, productId: "archived", archived: true, imageId: null, publicHref: null }], nextHref: "/dashboard/dpp?cursor=next" }));
    assert.ok(html.includes(labels.open));
    assert.ok(html.includes(labels.notPublic));
    assert.ok(html.includes(labels.archived));
    assert.match(html, /&lt;Published&gt;/);
    assert.match(html, /\/api\/products\/product\/images\/published-image/);
    assert.equal((html.match(/href="\/p\//g) ?? []).length, 1);
    assert.match(html, /aria-hidden="true"/);
    const empty = renderToStaticMarkup(createElement(DppList, { labels, items: [], nextHref: null }));
    assert.ok(empty.includes(labels.emptyTitle));
    assert.match(empty, /role="status"/);
    assert.doesNotMatch(empty, /<img|href=/);
  }
});
test("DPP is active without also activating Products or Overview", () => {
  assert.equal(isDashboardNavActive("/dashboard/dpp", "/dashboard/dpp"), true);
  assert.equal(isDashboardNavActive("/dashboard/dpp", "/dashboard/products"), false);
  assert.equal(isDashboardNavActive("/dashboard/dpp", "/dashboard"), false);
});
