import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const routePath = "app/(public-dpp)/p/[publicCode]/route.ts";
const runtimePath = "src/infrastructure/public-dpp/public-dpp-http-runtime.ts";

test("wires one anonymous force-dynamic no-store public route outside locale and dashboard trees", () => {
  assert.equal(existsSync(new URL(routePath, root)), true);
  assert.equal(existsSync(new URL("app/[locale]/p/[publicCode]", root)), false);
  assert.equal(existsSync(new URL("app/[locale]/dashboard/p/[publicCode]", root)), false);
  const route = read(routePath);
  assert.match(route, /dynamic\s*=\s*"force-dynamic"/);
  assert.match(route, /fetchCache\s*=\s*"force-no-store"/);
  assert.match(route, /export async function GET/);
  assert.match(route, /params\.then\(\(value\) => value\.publicCode\)/);
  assert.match(route, /executePublicDppRequest\(request, publicCode, getPublicDppHttpHandler\)/);
});

test("passes /p through the locale proxy without weakening normal locale routing", () => {
  const proxy = read("proxy.ts");
  assert.match(proxy, /pathname\s*===\s*"\/p"\s*\|\|\s*pathname\.startsWith\("\/p\/"\)/);
  assert.match(proxy, /NextResponse\.next\(\)/);
  assert.match(proxy, /intlMiddleware\(request\)/);
  assert.doesNotMatch(proxy, /BetterAuth|resolveAuthenticated|resolveProtectedDashboard|Membership/);
});

test("keeps Prisma and environment access in server-only infrastructure", () => {
  const publicSource = [
    routePath,
    "src/application/public-dpp/contracts.ts",
    "src/application/public-dpp/get-public-dpp.ts",
    "src/application/public-dpp/http.ts",
    "src/application/public-dpp/locale.ts",
    "src/application/public-dpp/ports.ts",
    "src/components/public-dpp/public-dpp-document.tsx",
    "src/components/public-dpp/public-dpp-labels.ts",
  ].map(read).join("\n");
  assert.doesNotMatch(publicSource, /generated\/prisma|DATABASE_URL|TEST_DATABASE_URL|BETTER_AUTH|resolveAuthenticated|resolveProtectedDashboard/);
  assert.doesNotMatch(publicSource, /currentDraftVersion|ProductDocument|ProductImage|QRCode|ScanEvent|localStorage|sessionStorage|cookies\(/);
  assert.doesNotMatch(publicSource, /"use client"|dangerouslySetInnerHTML/);
  const runtime = read(runtimePath);
  assert.match(runtime, /import "server-only"/);
  assert.match(runtime, /getProductionPrismaClient/);
  assert.match(runtime, /PrismaPublicDppPersistence/);
  assert.doesNotMatch(runtime, /auth|session|membership/i);
});

test("all six locales expose the same complete PublicDpp message contract", () => {
  const locales = ["hr", "sr", "en", "de", "sl", "pl"];
  const messages = locales.map((locale) => JSON.parse(read(`messages/${locale}.json`)).PublicDpp);
  assert.ok(messages[0]);
  const keys = flattenKeys(messages[0]);
  assert.equal(keys.length, 41);
  for (const [index, locale] of locales.entries()) {
    assert.deepEqual(flattenKeys(messages[index]), keys, locale);
  }
  assert.equal(messages[0].withdrawnMessage, "Ova digitalna putovnica proizvoda više nije aktivna.");
  assert.equal(messages[2].withdrawnMessage, "This Digital Product Passport is no longer active.");
  assert.equal(messages[3].organization, "Organisation");
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
