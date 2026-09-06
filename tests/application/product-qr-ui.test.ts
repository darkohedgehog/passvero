import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { ProductQrSection, type ProductQrLabels } from "../../src/components/application/products/product-qr-section";
import { activateQrFromDashboard } from "../../src/application/products/qr/ui-client";
import type { ProductQrProjection } from "../../src/application/products/qr/contracts";
const pending: ProductQrProjection = { kind: "QR", status: "PENDING", activationEvidence: "opaque", previewUrl: null, downloadSvgUrl: null, downloadPngUrl: null };
const active: ProductQrProjection = { kind: "QR", status: "ACTIVE", activationEvidence: null, previewUrl: "/api/products/product/qr/preview.svg", downloadSvgUrl: "/api/products/product/qr.svg", downloadPngUrl: "/api/products/product/qr.png" };
for (const locale of ["hr", "en", "de", "sr", "sl", "pl"]) test(`${locale} renders status, publication prerequisite, authorized actions and native accessible controls`, () => {
  const labels: ProductQrLabels = JSON.parse(readFileSync(`messages/${locale}.json`, "utf8")).ProductQr;
  assert.ok(labels);
  const render = (data: ProductQrProjection | null) => renderToStaticMarkup(createElement(ProductQrSection, { productId: "product", data, labels }));
  const html = render(pending);
  assert.match(html, /<h3/); assert.match(html, /aria-labelledby/); assert.match(html, /aria-live="polite"/);
  assert.ok(html.includes(labels.activate)); assert.ok(html.includes(labels.pending)); assert.doesNotMatch(html, /<img|download=/);
  assert.ok(!render({ ...pending, activationEvidence: null }).includes(`<button`));
  const activeHtml = render(active);
  assert.match(activeHtml, /<img/); assert.match(activeHtml, /alt="[^"]+"/);
  assert.ok(activeHtml.includes(labels.downloadSvg)); assert.ok(activeHtml.includes(labels.downloadPng));
  assert.ok(render({ kind: "NOT_PUBLISHED" }).includes(labels.publicationRequired));
  assert.doesNotMatch(render({ ...pending, status: "REVOKED", activationEvidence: null }), /<button|<img/);
  assert.ok(render(null).includes(labels.unavailable));
  assert.deepEqual(Object.keys(labels).sort(), ["title", "pending", "active", "revoked", "activate", "confirm", "activating", "success", "stale", "forbidden", "unavailable", "previewAlt", "downloadSvg", "downloadPng", "publicationRequired", "noLongerAvailable", "helper", "reload"].sort());
});
test("UI posts only evidence, uses same-origin credentials and never retries", async () => {
  const calls: unknown[] = [];
  const fetcher: typeof fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ status: "STALE_WRITE" }, { status: 409 }); };
  assert.deepEqual(await activateQrFromDashboard(fetcher, "product", "opaque"), { status: "STALE_WRITE" });
  assert.equal(calls.length, 1);
  const call = calls[0] as { url: string; init: RequestInit };
  assert.equal(call.url, "/api/products/product/qr/activate");
  assert.equal(call.init.credentials, "same-origin"); assert.equal(call.init.cache, "no-store");
  assert.deepEqual(JSON.parse(String(call.init.body)), { activationEvidence: "opaque" });
});
test("UI rejects malformed success and sanitizes network failures", async () => {
  for (const fetcher of [async () => Response.json({ status: "ACTIVATED" }, { status: 500 }), async () => Response.json({ status: "private" }), async () => { throw new Error("secret"); }]) {
    assert.deepEqual(await activateQrFromDashboard(fetcher, "product", "opaque"), { status: "OPERATIONAL_FAILURE" });
  }
});
