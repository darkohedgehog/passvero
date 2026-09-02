import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const pagePath = "app/[locale]/dashboard/products/[productId]/page.tsx";

test("adds one localized protected dynamic product-detail page", () => {
  assert.equal(existsSync(new URL(pagePath, root)), true);
  assert.equal(existsSync(new URL("app/dashboard/products/[productId]", root)), false);
  assert.equal(existsSync(new URL("app/[locale]/dashboard/products/[id]", root)), false);

  const page = read(pagePath);
  assert.match(page, /params:\s*Promise<\{\s*locale:\s*string;\s*productId:\s*string/);
  assert.match(page, /dynamic\s*=\s*"force-dynamic"/);
  assert.match(page, /fetchCache\s*=\s*"force-no-store"/);
  assert.match(page, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false/);
  assert.match(page, /getTranslations\(\{\s*locale,\s*namespace:\s*"ProductDetail"\s*\}\)/);
});

test("derives tenant authority only from protected context and maps NOT_FOUND safely", () => {
  const page = read(pagePath);

  assert.match(page, /getProductDetail\(\{\s*productId\s*\},\s*resolution\.context\)/);
  assert.match(page, /error\.category\s*===\s*"NOT_FOUND"[\s\S]*notFound\(\)/);
  assert.doesNotMatch(page, /organizationId/);
  assert.doesNotMatch(page, /searchParams/);
  assert.doesNotMatch(page, /publicCode[^\n]*(href|pathname)|href[^\n]*publicCode/);
});

test("keeps detail outside direct Prisma access and limits mutations to authorized handoffs", () => {
  const source = [
    read(pagePath),
    read("src/components/application/products/product-detail-presentation.tsx"),
  ].join("\n");

  assert.doesNotMatch(source, /generated\/prisma|\.product\.(create|update|delete|upsert)/);
  assert.match(source, /canShowPublishProductAction/);
  assert.match(source, /PublishProductSection/);
  assert.match(read(pagePath), /canShowEditProductDraftAction\(/);
  assert.doesNotMatch(
    source,
    /ProductIdentifier|ProductDocument|ProductImage|QRCode|ScanEvent|Analytics/,
  );
});

test("wires one server-side production read composition", () => {
  const runtime = read("src/infrastructure/persistence/prisma/production-prisma-runtime.ts");
  const page = read(pagePath);

  assert.match(runtime, /createPrismaGetProductDetailDependencies/);
  assert.match(runtime, /getProductionGetProductDetailDependencies/);
  assert.match(page, /createGetProductDetailService/);
  assert.match(page, /getProductionGetProductDetailDependencies/);
});

test("all six locales expose the same complete ProductDetail message contract", () => {
  const locales = ["hr", "sr", "en", "de", "sl", "pl"];
  const messages = locales.map((locale) => {
    const contents = JSON.parse(read(`messages/${locale}.json`));
    return contents.ProductDetail;
  });

  assert.ok(messages[0]);
  const keys = flattenKeys(messages[0]);
  assert.deepEqual(keys, [
    "backToProducts",
    "created",
    "draftEmpty",
    "draftTitle",
    "errorDescription",
    "errorTitle",
    "identityTitle",
    "internalName",
    "lifecycle",
    "lifecycleStatus.ACTIVE",
    "lifecycleStatus.ARCHIVED",
    "metadataDescription",
    "metadataTitle",
    "noAccessDescription",
    "noAccessTitle",
    "notAvailable",
    "organizationSku",
    "overview",
    "publicCode",
    "publicCodeHint",
    "publishedAt",
    "publishedEmpty",
    "publishedTitle",
    "sourceLocale",
    "sourceProductName",
    "status",
    "title",
    "updated",
    "versionNumber",
    "versionStatus.DRAFT",
    "versionStatus.PUBLISHED",
    "versionStatus.READY_FOR_REVIEW",
  ].sort());
  for (const [index, locale] of locales.entries()) {
    assert.deepEqual(flattenKeys(messages[index]), keys, locale);
  }
});

function flattenKeys(value, prefix = "") {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix.length === 0 ? key : `${prefix}.${key}`;
    return typeof child === "object" && child !== null && !Array.isArray(child)
      ? flattenKeys(child, path)
      : [path];
  }).sort();
}
