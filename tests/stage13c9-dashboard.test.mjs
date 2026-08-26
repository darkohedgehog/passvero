import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const locales = ["hr", "en", "de", "sr", "sl", "pl"];
const read = (path) => readFileSync(new URL(path, root), "utf8");

function collectKeys(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === "object" && !Array.isArray(child)
      ? collectKeys(child, path)
      : [path];
  });
}

test("adds one localized dynamic dashboard entry and one explicit selection route", () => {
  const dashboardPath = "app/[locale]/dashboard/page.tsx";
  const selectionPath = "app/api/auth/organization-selection/route.ts";
  assert.equal(existsSync(new URL(dashboardPath, root)), true);
  assert.equal(existsSync(new URL(selectionPath, root)), true);
  assert.match(read(dashboardPath), /dynamic\s*=\s*"force-dynamic"/);
  assert.match(read(dashboardPath), /robots:\s*\{\s*index:\s*false/);
  assert.match(read(selectionPath), /export const POST/);
  assert.equal(existsSync(new URL("app/dashboard", root)), false);
});

test("all six locales contain the same complete Dashboard message contract", () => {
  const messages = locales.map((locale) => JSON.parse(read(`messages/${locale}.json`)));
  const keys = collectKeys(messages[0].Dashboard).sort();
  assert.ok(keys.length >= 15);
  for (const [index, locale] of locales.entries()) {
    assert.deepEqual(collectKeys(messages[index].Dashboard).sort(), keys, locale);
    for (const key of keys) {
      const value = key.split(".").reduce(
        (current, part) => current[part],
        messages[index].Dashboard,
      );
      assert.equal(typeof value, "string", `${locale}:${key}`);
      assert.ok(value.length > 0, `${locale}:${key}`);
    }
  }
});

test("dashboard clients submit no identity, membership, role, or permission authority", () => {
  const client = read("src/application/context/dashboard-ui-client.ts");
  const selector = read("src/components/application/dashboard/organization-selector.tsx");
  const signOut = read("src/components/application/dashboard/sign-out-button.tsx");
  const source = [client, selector, signOut].join("\n");

  assert.match(client, /targetOrganizationId/);
  assert.match(client, /\/api\/auth\/organization-selection/);
  assert.match(client, /\/api\/auth\/sign-out/);
  assert.doesNotMatch(source, /providerSubject|providerSessionId|membershipId|userId|permissions|membershipRole/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie|console\./);
});

test("dashboard UI remains a minimal shell without business feature surfaces", () => {
  const paths = [
    "app/[locale]/dashboard/page.tsx",
    "src/components/application/dashboard/dashboard-shell.tsx",
    "src/components/application/dashboard/organization-selector.tsx",
    "src/components/application/dashboard/sign-out-button.tsx",
  ];
  const source = paths.map(read).join("\n");

  assert.match(source, /aria-live/);
  assert.match(source, /aria-busy/);
  assert.match(source, /<fieldset/);
  assert.doesNotMatch(source, /CreateProduct|product list|billing|subscription|invitation|team management/i);
  assert.doesNotMatch(source, /better-auth|Prisma|DATABASE_URL/);
});

test("login success hands off only to the localized protected dashboard", () => {
  const login = read("src/components/application/auth/login-form.tsx");
  assert.match(login, /router\.replace\("\/dashboard"\)/);
  assert.doesNotMatch(login, /router\.replace\("\/"\)/);
});
