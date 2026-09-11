import assert from "node:assert/strict";
import test from "node:test";
import { dashboardLocaleHref } from "../../src/i18n/dashboard-locale-href";
const cursor = Buffer.from(JSON.stringify({ v: 1, updatedAt: "2026-09-10T12:00:00.000Z", productId: "00000000-0000-4000-8000-000000000001" })).toString("base64url");
test("locale navigation preserves only the valid list cursor and drops sensitive query values", () => {
  assert.equal(dashboardLocaleHref("/dashboard/products", `?cursor=${cursor}&token=secret&next=https://other.invalid#fragment`), `/dashboard/products?cursor=${cursor}`);
});
test("other dashboard routes never carry query credentials or list cursor", () => {
  for (const path of ["/dashboard", "/dashboard/products/new", "/dashboard/products/id", "/dashboard/products/id/edit"]) {
    assert.equal(dashboardLocaleHref(path, `?cursor=${cursor}&token=secret`), path);
  }
});
test("invalid or ambiguous cursor is dropped rather than forwarded", () => {
  for (const query of ["?token=secret", "?cursor=secret", `?cursor=${cursor}&cursor=${cursor}`, "?cursor=" + "a".repeat(513), "?cursor=" + Buffer.from(JSON.stringify({v:1, updatedAt:"bad", productId:"secret"})).toString("base64url"), "?cursor=" + Buffer.from(JSON.stringify({v:1, updatedAt:"2026-09-10T12:00:00.000Z", productId:"00000000-0000-4000-8000-000000000001", token:"secret"})).toString("base64url")]) {
    assert.equal(dashboardLocaleHref("/dashboard/products", query), "/dashboard/products");
  }
});
