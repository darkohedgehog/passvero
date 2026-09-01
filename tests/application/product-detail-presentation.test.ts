import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";

import type { ProductDetailResult } from "../../src/application/products/get-product-detail/contracts";
import {
  ProductDetailPresentation,
  type ProductDetailLabels,
} from "../../src/components/application/products/product-detail-presentation";

const labels: ProductDetailLabels = {
  backToProducts: "Back to Products",
  overview: "Product overview",
  lifecycle: "Lifecycle",
  identityTitle: "Product identity",
  internalName: "Internal name",
  organizationSku: "Organization SKU",
  publicCode: "Public code",
  publicCodeHint: "Stable product identity. A public passport is not available yet.",
  created: "Created",
  updated: "Updated",
  draftTitle: "Current draft",
  publishedTitle: "Current published version",
  status: "Status",
  sourceLocale: "Source locale",
  sourceProductName: "Source product name",
  versionNumber: "Version number",
  publishedAt: "Published",
  draftEmpty: "No current draft is available.",
  publishedEmpty: "This product is not published.",
  notAvailable: "Not available",
  lifecycleStatus: { ACTIVE: "Active", ARCHIVED: "Archived" },
  versionStatus: {
    DRAFT: "Draft",
    READY_FOR_REVIEW: "Ready for review",
    PUBLISHED: "Published",
  },
};

const detail: ProductDetailResult = {
  productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  internalName: "Industrial chair",
  organizationSku: "CHAIR-1",
  publicCode: "AbCdEfGhIjKlMnOpQrStUv",
  lifecycleStatus: "ACTIVE",
  currentDraft: {
    productVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    status: "READY_FOR_REVIEW",
    sourceLocale: "hr",
    sourceProductName: "Industrijska stolica",
    createdAt: new Date("2026-08-30T10:00:00.000Z"),
    updatedAt: new Date("2026-08-30T11:00:00.000Z"),
  },
  currentPublished: {
    productVersionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    status: "PUBLISHED",
    sourceLocale: "en",
    sourceProductName: "Industrial chair",
    versionNumber: 1,
    publishedAt: new Date("2026-08-20T12:00:00.000Z"),
  },
  createdAt: new Date("2026-08-20T09:00:00.000Z"),
  updatedAt: new Date("2026-08-30T11:00:00.000Z"),
};

const formattedDates = {
  productCreatedAt: "20 Aug 2026, 09:00",
  productUpdatedAt: "30 Aug 2026, 11:00",
  draftCreatedAt: "30 Aug 2026, 10:00",
  draftUpdatedAt: "30 Aug 2026, 11:00",
  publishedAt: "20 Aug 2026, 12:00",
};

function render(overrides: Partial<ProductDetailResult> = {}) {
  return renderToStaticMarkup(createElement(ProductDetailPresentation, {
    detail: { ...detail, ...overrides },
    productListHref: "/en/dashboard/products",
    formattedDates,
    labels,
  }));
}

test("renders the allowlisted product identity and semantic back navigation", () => {
  const html = render();

  assert.match(html, /<nav[^>]*aria-label="Product overview"/);
  assert.match(html, /href="\/en\/dashboard\/products"/);
  assert.match(html, />← Back to Products<\/a>/);
  assert.match(html, /<h2[^>]*>Industrial chair<\/h2>/);
  assert.match(html, /Active/);
  assert.match(html, /CHAIR-1/);
  assert.match(html, /AbCdEfGhIjKlMnOpQrStUv/);
  assert.match(html, /20 Aug 2026, 09:00/);
  assert.match(html, /30 Aug 2026, 11:00/);
  assert.doesNotMatch(html, /organizationId|createdById|updatedById|membershipId|storageKey/);
});

test("renders current draft and published summaries from the pointed projection", () => {
  const html = render();

  assert.match(html, /Current draft/);
  assert.match(html, /Ready for review/);
  assert.match(html, /Industrijska stolica/);
  assert.match(html, /HR/);
  assert.match(html, /Current published version/);
  assert.match(html, /Industrial chair/);
  assert.match(html, />1<\/dd>/);
  assert.match(html, /20 Aug 2026, 12:00/);
});

test("renders draft-null and published-null states without controls", () => {
  const html = render({ currentDraft: null, currentPublished: null });

  assert.match(html, /No current draft is available/);
  assert.match(html, /This product is not published/);
  assert.doesNotMatch(html, /<button|<form|role="tab"|aria-selected/);
});

test("keeps publicCode as plain identity text and exposes no future DPP controls", () => {
  const html = render();

  assert.doesNotMatch(html, /<a[^>]*>AbCdEfGhIjKlMnOpQrStUv<\/a>/);
  assert.match(html, /A public passport is not available yet/);
  assert.doesNotMatch(
    html,
    /Edit product|Publish product|Upload|Documents|Materials|Identifiers|QR code|Analytics/,
  );
});

test("renders exactly one Edit action only when the server supplies an authorized href", () => {
  const authorized = renderToStaticMarkup(createElement(ProductDetailPresentation, {
    detail,
    productListHref: "/en/dashboard/products",
    editHref: "/en/dashboard/products/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/edit",
    editLabel: "Edit product",
    formattedDates,
    labels,
  }));
  assert.match(
    authorized,
    /href="\/en\/dashboard\/products\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\/edit"[^>]*>Edit product<\/a>/,
  );
  assert.equal((authorized.match(/>Edit product<\/a>/g) ?? []).length, 1);

  const denied = renderToStaticMarkup(createElement(ProductDetailPresentation, {
    detail,
    productListHref: "/en/dashboard/products",
    editHref: null,
    editLabel: "Edit product",
    formattedDates,
    labels,
  }));
  assert.doesNotMatch(denied, /Edit product/);
});

test("keeps the purpose-specific Materials section inside the Product Detail workspace", () => {
  const html = renderToStaticMarkup(createElement(ProductDetailPresentation, {
    detail,
    productListHref: "/en/dashboard/products",
    formattedDates,
    labels,
    materialsSection: createElement("section", { "aria-label": "Materials" }, "Current draft materials"),
  }));
  assert.match(html, /aria-label="Materials"/);
  assert.match(html, /Current draft materials/);
  assert.equal((html.match(/Current draft materials/g) ?? []).length, 1);
});
