import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import test from "node:test";

import { ProductListPresentation } from "../../src/components/application/products/product-list-presentation";
import { DashboardProductsNavigation } from "../../src/components/application/dashboard/dashboard-products-navigation";
import { getPathname } from "../../src/i18n/navigation";

const labels = {
  emptyTitle: "No products yet",
  emptyDescription: "Products for this organization will appear here.",
  product: "Product",
  sku: "SKU",
  lifecycle: "Lifecycle",
  version: "Version",
  locale: "Locale",
  updated: "Updated",
  notAvailable: "Not available",
  nextPage: "Next page",
  lifecycleStatus: { ACTIVE: "Active", ARCHIVED: "Archived" },
  versionStatus: {
    DRAFT: "Draft",
    READY_FOR_REVIEW: "Ready for review",
    PUBLISHED: "Published",
    SUPERSEDED: "Superseded",
    DISCARDED: "Discarded",
  },
} as const;

test("renders the same narrow product projection as a semantic table and mobile list", () => {
  const html = renderToStaticMarkup(createElement(ProductListPresentation, {
    items: [{
      productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "Industrial Chair",
      sku: "CHAIR-1",
      lifecycleStatus: "ACTIVE" as const,
      currentVersionStatus: "READY_FOR_REVIEW" as const,
      sourceLocale: "hr",
      updatedAt: new Date("2026-08-26T10:00:00.000Z"),
    }],
    formattedUpdatedAt: ["26 Aug 2026"],
    detailHrefs: ["/en/dashboard/products/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
    nextPageHref: "/en/dashboard/products?cursor=opaque",
    labels,
  }));

  assert.match(html, /<table/);
  assert.match(html, /<ul/);
  assert.match(html, /Industrial Chair/);
  assert.match(html, /CHAIR-1/);
  assert.match(html, /Ready for review/);
  assert.match(html, /href="\/en\/dashboard\/products\?cursor=opaque"/);
  assert.equal(
    html.match(/href="\/en\/dashboard\/products\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"/g)?.length,
    2,
  );
  assert.doesNotMatch(html, /organizationId|publicCode|currentDraftVersionId/);
});

test("renders an explicit empty state without an unimplemented create action", () => {
  const html = renderToStaticMarkup(createElement(ProductListPresentation, {
    items: [],
    formattedUpdatedAt: [],
    detailHrefs: [],
    nextPageHref: null,
    labels,
  }));

  assert.match(html, /role="status"/);
  assert.match(html, /No products yet/);
  assert.doesNotMatch(html, /Create product|products\/new/);
});

test("adds one Products link only after an organization context is resolved", () => {
  const renderShell = (organizationName?: string) => renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      ({
        locale: "en",
        messages: {},
      } as ComponentProps<typeof NextIntlClientProvider>),
      createElement(DashboardProductsNavigation, {
        productsLabel: "Products",
        organizationResolved: organizationName !== undefined,
      }),
    ),
  );
  const resolved = renderShell("Organization A");
  const unresolved = renderShell();

  assert.match(resolved, /href="\/en\/dashboard\/products"/);
  assert.match(resolved, />Products<\/a>/);
  assert.doesNotMatch(unresolved, /dashboard\/products/);
});

test("inherits the canonical locale-prefix policy for the products route", () => {
  const expectations = {
    hr: "/dashboard/products",
    sr: "/sr/dashboard/products",
    en: "/en/dashboard/products",
    de: "/de/dashboard/products",
    sl: "/sl/dashboard/products",
    pl: "/pl/dashboard/products",
  } as const;

  for (const locale of Object.keys(expectations) as Array<keyof typeof expectations>) {
    assert.equal(
      getPathname({ locale, href: "/dashboard/products" }),
      expectations[locale],
    );
  }
});

test("builds protected product-detail destinations from internal productId in every locale", () => {
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const expectations = {
    hr: `/dashboard/products/${id}`,
    sr: `/sr/dashboard/products/${id}`,
    en: `/en/dashboard/products/${id}`,
    de: `/de/dashboard/products/${id}`,
    sl: `/sl/dashboard/products/${id}`,
    pl: `/pl/dashboard/products/${id}`,
  } as const;

  for (const locale of Object.keys(expectations) as Array<keyof typeof expectations>) {
    assert.equal(
      getPathname({ locale, href: `/dashboard/products/${id}` }),
      expectations[locale],
    );
  }
});

test("all six locale files expose the same complete Products message contract", () => {
  const root = new URL("../../", import.meta.url);
  const locales = ["hr", "sr", "en", "de", "sl", "pl"] as const;
  const products = locales.map((locale) => {
    const messages = JSON.parse(
      readFileSync(new URL(`messages/${locale}.json`, root), "utf8"),
    ) as { Products?: Record<string, unknown> };
    return messages.Products;
  });

  assert.ok(products[0]);
  const keys = flattenKeys(products[0]);
  assert.ok(keys.length >= 23);
  for (const [index, locale] of locales.entries()) {
    assert.deepEqual(flattenKeys(products[index]), keys, locale);
  }
});

function flattenKeys(value: unknown, prefix = ""): readonly string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [];
  }
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix.length === 0 ? key : `${prefix}.${key}`;
    return typeof child === "object" && child !== null && !Array.isArray(child)
      ? flattenKeys(child, path)
      : [path];
  }).sort();
}
