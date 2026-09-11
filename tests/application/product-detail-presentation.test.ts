import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";

import en from "../../messages/en.json";
import { canShowEditProductDraftAction } from "../../src/application/products/edit-product-draft/edit-product-draft-http";
import { canShowPublishProductAction } from "../../src/application/products/publish-product/http";
import { permissionsForMembershipRole } from "../../src/application/permissions/product-permissions";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import type { ProductDetailResult } from "../../src/application/products/get-product-detail/contracts";
import {
  ProductDetailPresentation,
  type ProductDetailLabels,
} from "../../src/components/application/products/product-detail-presentation";

const labels: ProductDetailLabels = {
  technicalDetails: "Technical details",
  viewPublicDpp: "View public DPP",
  publication: "Publication",
  publicAvailability: "Public availability",
  noDraftChanges: "No changes in draft",
  contentTitle: "DPP content",
  readOnly: "Read-only snapshot",
  draftPrivate: "These draft changes are not public.",
  publicationState: { DRAFT: "Draft", PUBLISHED: "Published", CHANGES_IN_DRAFT: "Published · Changes in draft" },
  availabilityStatus: { PUBLIC: "DPP is public", NOT_PUBLIC: "DPP is not public", WITHDRAWN: "DPP withdrawn" },
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

const content = { productName: "Chair", shortDescription: null, description: "Published instructions", technicalDescription: null, repairInstructions: null, sparePartsInformation: null, recyclingInstructions: null, disposalInstructions: null, packagingInformation: null, safetyInformation: null, warrantyInformation: null, publicNotes: null };
const detail: ProductDetailResult = {
  productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  internalName: "Industrial chair",
  organizationSku: "CHAIR-1",
  publicCode: "AbCdEfGhIjKlMnOpQrStUv",
  lifecycleStatus: "ACTIVE",
  publicationState: "CHANGES_IN_DRAFT",
  publicAvailability: { status: "PUBLIC", url: "https://catalog.example/p/AbCdEfGhIjKlMnOpQrStUv" },
  currentDraft: {
    productVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    status: "READY_FOR_REVIEW",
    kind: "CURRENT_DRAFT",
    content: { ...content, productName: "Industrijska stolica", description: "Private draft instructions" },
    cn: { code: "01012100", nomenclatureYear: 2026 },
    materials: [{ materialName: "Draft steel", category: null, percentage: "100.00", isRecycled: false, recycledPercentage: null }],
    sourceLocale: "hr",
    sourceProductName: "Industrijska stolica",
    createdAt: new Date("2026-08-30T10:00:00.000Z"),
    updatedAt: new Date("2026-08-30T11:00:00.000Z"),
  },
  currentPublished: {
    productVersionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    status: "PUBLISHED",
    kind: "CURRENT_PUBLISHED",
    content,
    cn: { code: "01012900", nomenclatureYear: 2026 },
    materials: [{ materialName: "Published wood", category: null, percentage: "100.00", isRecycled: false, recycledPercentage: null }],
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
    contentLabels: en.PublicDpp,
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

test("keeps publicCode in collapsed technical details and links through server-derived public URL", () => {
  const html = render();
  assert.match(html, /<details[^>]*><summary[^>]*>Technical details<\/summary>[\s\S]*AbCdEfGhIjKlMnOpQrStUv[\s\S]*<\/details>/);
  assert.doesNotMatch(html, /<details[^>]*open/);
  assert.match(html, /href="https:\/\/catalog.example\/p\/AbCdEfGhIjKlMnOpQrStUv"[^>]*>View public DPP<\/a>/);
  assert.doesNotMatch(html, /<a[^>]*>AbCdEfGhIjKlMnOpQrStUv<\/a>/);
});

test("renders exactly one Edit action only when the server supplies an authorized href", () => {
  const authorized = renderToStaticMarkup(createElement(ProductDetailPresentation, {
    detail,
    productListHref: "/en/dashboard/products",
    editHref: "/en/dashboard/products/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/edit",
    editLabel: "Edit product",
    formattedDates,
    labels,
    contentLabels: en.PublicDpp,
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
    contentLabels: en.PublicDpp,
  }));
  assert.doesNotMatch(denied, /Edit product/);
});

test("keeps the purpose-specific Materials section inside the Product Detail workspace", () => {
  const html = renderToStaticMarkup(createElement(ProductDetailPresentation, {
    detail,
    productListHref: "/en/dashboard/products",
    formattedDates,
    labels,
    contentLabels: en.PublicDpp,
    materialsSection: createElement("section", { "aria-label": "Materials" }, "Current draft materials"),
  }));
  assert.match(html, /aria-label="Materials"/);
  assert.match(html, /Current draft materials/);
  assert.equal((html.match(/Current draft materials/g) ?? []).length, 1);
});

test("QR section remains visible without an editable draft", () => {
  const html = renderToStaticMarkup(createElement(ProductDetailPresentation, {
    detail: { ...detail, currentDraft: null }, productListHref: "/dashboard/products", formattedDates, labels, contentLabels: en.PublicDpp,
    qrSection: createElement("section", null, "QR lifecycle and downloads"),
  }));
  assert.match(html, /QR lifecycle and downloads/);
});

test("published-only renders published source CN and materials read-only without false draft warnings", () => {
  const html = render({ currentDraft: null, publicationState: "PUBLISHED" });
  assert.match(html, /Published instructions/);
  assert.match(html, /01012900/);
  assert.match(html, /Published wood/);
  assert.match(html, /No changes in draft/);
  assert.match(html, /DPP is public/);
  assert.doesNotMatch(html, /Private draft instructions|Draft steel|01012100|No current draft is available|<form|<button/);
});

test("draft and published sections never mix their content or collections", () => {
  const html = render();
  const published = html.slice(html.indexOf('aria-labelledby="current-published-heading"'), html.indexOf('aria-labelledby="current-draft-heading"'));
  const draft = html.slice(html.indexOf('aria-labelledby="current-draft-heading"'), html.indexOf('<details'));
  assert.match(published, /Published instructions/);
  assert.match(published, /Published wood/);
  assert.match(published, /01012900/);
  assert.doesNotMatch(published, /Private draft instructions|Draft steel|01012100/);
  assert.match(draft, /Private draft instructions/);
  assert.match(draft, /Draft steel/);
  assert.match(draft, /01012100/);
  assert.doesNotMatch(draft, /Published instructions|Published wood|01012900/);
  assert.match(draft, /These draft changes are not public/);
});

test("never-published draft and withdrawn states do not offer public-content navigation", () => {
  const draft = render({ currentPublished: null, publicationState: "DRAFT", publicAvailability: { status: "NOT_PUBLIC" } });
  assert.match(draft, /Private draft instructions/);
  assert.match(draft, /Draft steel/);
  assert.match(draft, /DPP is not public/);
  assert.doesNotMatch(draft, /View public DPP/);
  const withdrawn = render({ publicAvailability: { status: "WITHDRAWN" } });
  assert.match(withdrawn, /DPP withdrawn/);
  assert.doesNotMatch(withdrawn, /View public DPP/);
});

for (const role of ["VIEWER", "ADMIN"] as const) {
  test(`${role} retains existing draft controls only when a current editable draft exists`, () => {
    const context: AuthenticatedUserContext = { userId: "actor", organizationId: "org", membershipId: "member", membershipRole: role, membershipStatus: "ACTIVE", permissions: permissionsForMembershipRole(role), correlationId: "detail-test" };
    for (const currentDraft of [detail.currentDraft, null]) {
      const canEdit = canShowEditProductDraftAction(context, "ACTIVE", currentDraft?.status ?? null);
      const canPublish = canShowPublishProductAction(context, "ACTIVE", currentDraft?.status ?? null);
      const html = renderToStaticMarkup(createElement(ProductDetailPresentation, {
        detail: { ...detail, currentDraft }, productListHref: "/dashboard/products", formattedDates, labels, contentLabels: en.PublicDpp,
        editHref: canEdit ? "/dashboard/products/product/edit" : null, editLabel: "Edit product",
        publishSection: canPublish ? createElement("button", null, "Publish product") : null,
      }));
      if (role === "ADMIN" && currentDraft !== null) {
        assert.match(html, /Edit product/); assert.match(html, /Publish product/);
      } else {
        assert.doesNotMatch(html, /Edit product|Publish product/);
      }
      assert.match(html, /Published instructions/);
    }
  });
}

test("archived snapshot has no edit controls even if stale action props are supplied", () => {
  const html = renderToStaticMarkup(createElement(ProductDetailPresentation, {
    detail: { ...detail, lifecycleStatus: "ARCHIVED", publicAvailability: { status: "NOT_PUBLIC" } },
    productListHref: "/dashboard/products", formattedDates, labels, contentLabels: en.PublicDpp,
    editHref: "/edit", editLabel: "Edit product", publishSection: createElement("button", null, "Publish product"),
  }));
  assert.match(html, /Archived/);
  assert.match(html, /Published instructions/);
  assert.doesNotMatch(html, /Edit product|Publish product|View public DPP/);
});

for (const locale of ["hr", "en", "de", "sr", "sl", "pl"]) {
  test(`${locale} renders localized publication status and public action without placeholder labels`, () => {
    const messages: typeof en = JSON.parse(readFileSync(new URL(`../../messages/${locale}.json`, import.meta.url), "utf8"));
    const localized = messages.ProductDetail;
    for (const value of [localized.technicalDetails, localized.viewPublicDpp, localized.noDraftChanges, localized.publicationState?.PUBLISHED, localized.availabilityStatus?.PUBLIC]) {
      assert.equal(typeof value, "string");
      assert.ok(value.trim().length > 0);
    }
    const html = renderToStaticMarkup(createElement(ProductDetailPresentation, {
      detail: { ...detail, currentDraft: null, publicationState: "PUBLISHED" },
      productListHref: "/dashboard/products", formattedDates, labels: localized, contentLabels: messages.PublicDpp,
    }));
    assert.ok(html.includes(localized.viewPublicDpp));
    assert.ok(html.includes(localized.availabilityStatus.PUBLIC));
    assert.ok(html.includes(localized.noDraftChanges));
    assert.doesNotMatch(html, /undefined|ProductDetail\./);
  });
}

test("published-only creation slot appears only on active published Product without draft", () => {
  for (const [changes, visible] of [
    [{ currentDraft: null }, true],
    [{ currentDraft: null, lifecycleStatus: "ARCHIVED" }, false],
    [{ currentDraft: null, currentPublished: null }, false],
    [{}, false],
  ] as const) {
    const html = renderToStaticMarkup(createElement(ProductDetailPresentation, {
      detail: { ...detail, ...changes }, productListHref: "/dashboard/products", formattedDates, labels, contentLabels: en.PublicDpp,
      createDraftAction: createElement("button", null, "Create private draft"),
    }));
    assert.equal(html.includes("Create private draft"), visible);
  }
});

for (const locale of ["hr", "en", "de", "sr", "sl", "pl"]) test(`${locale} UI labels preserve Croatian draft/published content and the public target`, () => {
  const messages = JSON.parse(readFileSync(new URL(`../../messages/${locale}.json`, import.meta.url), "utf8")) as typeof en;
  const product: ProductDetailResult = {
    ...detail,
    currentPublished: { ...detail.currentPublished!, sourceLocale: "hr", sourceProductName: "Objavljena stolica", content: { ...content, productName: "Objavljena stolica" } },
  };
  const before = structuredClone(product);
  const html = renderToStaticMarkup(createElement(ProductDetailPresentation, {
    detail: product, productListHref: locale === "hr" ? "/dashboard/products" : `/${locale}/dashboard/products`,
    formattedDates, labels: messages.ProductDetail, contentLabels: messages.PublicDpp,
  }));
  assert.ok(html.includes(messages.ProductDetail.readOnly));
  assert.ok(html.includes(messages.ProductDetail.draftPrivate));
  assert.match(html, /Objavljena stolica/);
  assert.match(html, /Industrijska stolica/);
  assert.match(html, /href="https:\/\/catalog.example\/p\/AbCdEfGhIjKlMnOpQrStUv"/);
  assert.doesNotMatch(html, /\?lang=/);
  assert.deepEqual(product, before);
});
