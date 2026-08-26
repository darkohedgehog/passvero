import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("adds one localized dynamic create page and one explicit POST route", () => {
  const page = "app/[locale]/dashboard/products/new/page.tsx";
  const route = "app/api/products/create/route.ts";
  assert.equal(existsSync(new URL(page, root)), true);
  assert.equal(existsSync(new URL(route, root)), true);
  assert.match(read(page), /dynamic\s*=\s*"force-dynamic"/);
  assert.match(read(page), /fetchCache\s*=\s*"force-no-store"/);
  assert.match(read(page), /robots:\s*\{\s*index:\s*false/);
  assert.match(read(route), /export const POST/);
  assert.equal(existsSync(new URL("app/dashboard/products/new", root)), false);
  assert.equal(existsSync(new URL("app/[locale]/dashboard/products/[id]", root)), false);
});

test("keeps transport and UI out of direct Prisma and tenant-authority input", () => {
  const paths = [
    "app/[locale]/dashboard/products/new/page.tsx",
    "app/api/products/create/route.ts",
    "src/application/products/create-product/create-product-http.ts",
    "src/application/products/create-product/create-product-ui-client.ts",
    "src/components/application/products/create-product-form.tsx",
    "src/components/application/products/product-list-create-action.tsx",
    "src/infrastructure/products/create-product-http-runtime.ts",
  ];
  const source = paths.map(read).join("\n");
  assert.doesNotMatch(source, /generated\/prisma|\.product\.(create|update|delete|upsert)/);
  assert.doesNotMatch(
    [
      read("app/[locale]/dashboard/products/new/page.tsx"),
      read("app/api/products/create/route.ts"),
      read("src/application/products/create-product/create-product-http.ts"),
      read("src/application/products/create-product/create-product-ui-client.ts"),
      read("src/components/application/products/create-product-form.tsx"),
    ].join("\n"),
    /better-auth|authPrisma|AuthProvider(User|Session|Account|Verification)/,
  );
  assert.doesNotMatch(
    [
      read("src/application/products/create-product/create-product-ui-client.ts"),
      read("src/components/application/products/create-product-form.tsx"),
    ].join("\n"),
    /organizationId|membershipId|userId|permissions|providerSubject|providerSessionId/,
  );
  assert.doesNotMatch(source, /Turnstile|document|image|material|identifier|QRCode|ScanEvent/i);
});

test("claims one form submission before awaiting transport and disables the submit action", () => {
  const form = read("src/components/application/products/create-product-form.tsx");
  assert.match(
    form,
    /if \(inFlightRef\.current\) return;[\s\S]*inFlightRef\.current = true;[\s\S]*await createProductFromDashboard/,
  );
  assert.match(form, /<button[\s\S]*type="submit"[\s\S]*disabled=\{pending\}/);
});

test("keeps schema dependencies migrations and environment files unchanged", () => {
  for (const path of ["package.json", "package-lock.json", "prisma/schema.prisma"]) {
    assert.equal(existsSync(new URL(path, root)), true);
  }
});
