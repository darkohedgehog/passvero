import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const pagePath = "app/[locale]/dashboard/products/[productId]/edit/page.tsx";
const routePath = "app/api/products/[productId]/edit/route.ts";

test("adds one localized protected dynamic edit page and one explicit POST route", () => {
  assert.equal(existsSync(new URL(pagePath, root)), true);
  assert.equal(existsSync(new URL(routePath, root)), true);
  assert.equal(existsSync(new URL("app/dashboard/products/[productId]/edit", root)), false);
  const page = read(pagePath);
  assert.match(page, /dynamic\s*=\s*"force-dynamic"/);
  assert.match(page, /fetchCache\s*=\s*"force-no-store"/);
  assert.match(page, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false/);
  assert.match(read(routePath), /export (?:const|async function) POST/);
});

test("keeps client tenant authority and direct Prisma outside route page component and application", () => {
  const paths = [
    pagePath,
    routePath,
    "src/application/products/edit-product-draft/contracts.ts",
    "src/application/products/edit-product-draft/edit-product-draft.ts",
    "src/application/products/edit-product-draft/edit-product-draft-http.ts",
    "src/application/products/edit-product-draft/edit-product-draft-ui-client.ts",
    "src/application/products/edit-product-draft/get-product-draft-for-edit.ts",
    "src/components/application/products/edit-product-draft-form.tsx",
  ];
  const source = paths.map(read).join("\n");
  assert.doesNotMatch(source, /generated\/prisma|\.product\.(create|update|delete|upsert)/);
  const clientAuthority = [
    read("src/application/products/edit-product-draft/edit-product-draft-ui-client.ts"),
    read("src/components/application/products/edit-product-draft-form.tsx"),
  ].join("\n");
  assert.doesNotMatch(
    clientAuthority,
    /(?:organizationId|membershipId|userId|permissions|publishedVersionId)\s*[:"]|name="role"/,
  );
});

test("keeps the form and workspace handoff limited to basic edit", () => {
  const form = read("src/components/application/products/edit-product-draft-form.tsx");
  assert.match(form, /if \(inFlightRef\.current\) return;[\s\S]*inFlightRef\.current = true;[\s\S]*await editProductDraftFromDashboard/);
  assert.match(form, /disabled=\{pending\}/);
  assert.match(form, /STALE_WRITE/);
  assert.doesNotMatch(form, /name="sourceLocale"|versionLabel|changeSummary|publicCode|lifecycleStatus/);
  assert.doesNotMatch(form, /Document|Material|Identifier|QRCode|Publish|Analytics/);
});

test("keeps dependency schema migration and environment boundaries unchanged", () => {
  for (const path of ["package.json", "package-lock.json", "prisma/schema.prisma"]) {
    assert.equal(existsSync(new URL(path, root)), true);
  }
  assert.doesNotMatch(
    [read(pagePath), read(routePath)].join("\n"),
    /DATABASE_URL|TEST_DATABASE_URL|BETTER_AUTH_SECRET/,
  );
});
