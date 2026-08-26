import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const locales = ["hr", "en", "de", "sr", "sl", "pl"];
const pages = [
  "login",
  "activate-account",
  "verify-email",
  "forgot-password",
  "reset-password",
];

const read = (path) => readFileSync(new URL(path, root), "utf8");

function collectKeys(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === "object" && !Array.isArray(child)
      ? collectKeys(child, path)
      : [path];
  });
}

test("adds exactly the five localized auth page entries with dynamic no-store posture", () => {
  for (const page of pages) {
    const path = `app/[locale]/${page}/page.tsx`;
    assert.equal(existsSync(new URL(path, root)), true, path);
    const source = read(path);
    assert.match(source, /dynamic\s*=\s*"force-dynamic"/);
    assert.match(source, /robots:\s*\{\s*index:\s*false/);
  }
});

test("all six locales contain the same complete Auth message contract", () => {
  const messages = locales.map((locale) => JSON.parse(read(`messages/${locale}.json`)));
  const keys = collectKeys(messages[0].Auth).sort();
  assert.ok(keys.length >= 45);
  for (const [index, locale] of locales.entries()) {
    assert.deepEqual(collectKeys(messages[index].Auth).sort(), keys, locale);
    for (const key of keys) {
      const value = key.split(".").reduce((current, part) => current[part], messages[index].Auth);
      assert.equal(typeof value, "string", `${locale}:${key}`);
      assert.ok(value.length > 0, `${locale}:${key}`);
    }
  }
});

test("client auth UI contains no server secrets, persistence, raw logging, or browser storage", () => {
  const paths = [
    "src/application/auth/auth-ui-client.ts",
    "src/components/application/auth/login-form.tsx",
    "src/components/application/auth/activation-form.tsx",
    "src/components/application/auth/verification-panel.tsx",
    "src/components/application/auth/forgot-password-form.tsx",
    "src/components/application/auth/reset-password-form.tsx",
    "src/components/application/auth/turnstile-challenge.tsx",
  ];
  const source = paths.map(read).join("\n");
  assert.doesNotMatch(source, /TURNSTILE_SECRET_KEY|SMTP_PASSWORD|AUTH_DATABASE_URL|BETTER_AUTH_SECRET/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|console\.|Prisma|better-auth/);
  assert.doesNotMatch(source, /sign-up|signup|register|create-account/i);
  assert.match(source, /NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
});

test("capability pages use transient fragment capture and never reread URL capability state during submission", () => {
  const activation = read("src/components/application/auth/activation-form.tsx");
  const verification = read("src/components/application/auth/verification-panel.tsx");
  const reset = read("src/components/application/auth/reset-password-form.tsx");
  const all = [activation, verification, reset].join("\n");

  assert.match(activation, /captureActivationCapability/);
  assert.match(verification, /captureEmailLinkToken/);
  assert.match(reset, /captureEmailLinkToken/);
  assert.doesNotMatch(all, /window\.location\.(search|hash)/);
});

test("forms preserve semantic labels, autocomplete, busy state, and explicit auth routes", () => {
  const login = read("src/components/application/auth/login-form.tsx");
  const activation = read("src/components/application/auth/activation-form.tsx");
  const forgot = read("src/components/application/auth/forgot-password-form.tsx");
  const reset = read("src/components/application/auth/reset-password-form.tsx");
  const primitives = read("src/components/application/auth/auth-primitives.tsx");
  const all = [login, activation, forgot, reset, primitives].join("\n");

  assert.match(login, /autoComplete="email"/);
  assert.match(login, /autoComplete="current-password"/);
  assert.match(forgot, /autoComplete="email"/);
  assert.match(activation, /autoComplete="new-password"/);
  assert.match(reset, /autoComplete="new-password"/);
  assert.match(all, /aria-busy/);
  assert.match(all, /aria-live/);
  assert.match(all, /<label/);
  assert.doesNotMatch(all, /dangerouslySetInnerHTML|response\.text\(\)/);
});

test("the explicit auth UI surface still adds no signup or catch-all route", () => {
  for (const path of [
    "app/[locale]/signup",
    "app/[locale]/register",
    "app/api/auth/[...all]",
  ]) {
    assert.equal(existsSync(new URL(path, root)), false, path);
  }
});
