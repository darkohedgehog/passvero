import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const ctas = { hr: "Zatraži pristup", en: "Request access", de: "Zugang anfragen", sr: "Zatraži pristup", sl: "Zaprosi za dostop", pl: "Poproś o dostęp" };

for (const [locale, cta] of Object.entries(ctas)) {
  test(`${locale}: access CTA inventory and password messages are complete`, () => {
    const m = JSON.parse(read(`messages/${locale}.json`));
    for (const value of [m.Navigation.earlyAccess, m.Hero.primaryAction, m.Pricing.action, m.CTA.primaryAction, m.AboutPage.cta.action, m.ContactPage.earlyAccess.action, m.Footer.groups.company.earlyAccess]) {
      assert.equal(value, cta);
    }
    for (const key of ["showPassword", "hidePassword"]) assert.ok(m.Auth.common[key].includes("{field}"));
    assert.match(m.Auth.common.passwordGuidance, /15–128/);
    assert.ok(m.Auth.common.passwordContextGuidance);
    assert.ok(m.Auth.login.newUser);
    assert.ok(m.Auth.login.requestAccess);
    assert.ok(m.MarketingNavigation.login);
  });
}

test("visibility is local to each field and cannot submit a form", () => {
  const s = read("src/components/application/auth/auth-primitives.tsx");
  assert.match(s, /useState\(false\)/);
  assert.match(s, /type=\{isPassword && visible \? "text" : input.type\}/);
  assert.match(s, /type="button"/);
  assert.match(s, /aria-label=\{t\(visible \? "hidePassword" : "showPassword", \{ field: label \}\)\}/);
  assert.match(s, /focus-visible:outline/);
  assert.match(s, /min-h-11 w-11/);
  assert.doesNotMatch(s, /localStorage|sessionStorage|console\.|clipboard/);
});

test("confirmation errors precede transport and are announced and focused", () => {
  for (const file of ["activation-form", "reset-password-form"]) {
    const s = read(`src/components/application/auth/${file}.tsx`);
    assert.match(s, /common.passwordMismatch/);
    assert.match(s, /confirm-password"\)\?\.focus\(\)/);
    assert.match(s, /error=\{passwordError\}/);
    assert.equal((s.match(/type="password"/g) ?? []).length, 2);
  }
  assert.match(read("src/components/application/auth/auth-primitives.tsx"), /<p role="alert"/);
});

test("header login uses i18n links and prospective users keep the existing mail target", () => {
  const header = read("src/components/marketing/site-header.tsx");
  assert.match(header, /<Link href="\/login"/);
  assert.match(header, /ctaHref="\/login"/);
  assert.doesNotMatch(header, /createMailtoHref/);
  assert.match(read("src/components/marketing/mobile-navigation.tsx"), /<Link[^>]+href=\{ctaHref\}/);
  assert.match(read("src/components/application/auth/login-form.tsx"), /href=\{createMailtoHref\(contact\("earlyAccessSubject"\)\)\}/);
});
