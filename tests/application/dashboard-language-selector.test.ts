/* React 19 provider types require children in createElement props in this non-JSX test. */
/* eslint-disable react/no-children-prop */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type hrMessages from "../../messages/hr.json";
import { NextIntlClientProvider } from "next-intl";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { DashboardShell } from "../../src/components/application/dashboard/dashboard-shell";
import { getPathname, usePathname, useRouter } from "../../src/i18n/navigation";
import type { AppLocale } from "../../src/i18n/routing";

// The framework router is the external boundary; rendering must not navigate or mutate.
const unexpected = () => { throw new Error("Unexpected operation during locale rendering"); };
const router: AppRouterInstance = { back: unexpected, forward: unexpected, refresh: unexpected, push: unexpected, replace: unexpected, prefetch: unexpected, bfcacheId: "test" };
const locales: AppLocale[] = ["hr", "en", "de", "sr", "sl", "pl"];
for (const locale of locales) test(`${locale}: shared authenticated header exposes a labelled native selector with six languages`, () => {
  const messages = JSON.parse(readFileSync(new URL(`../../messages/${locale}.json`, import.meta.url), "utf8")) as typeof hrMessages;
  const html = renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router },
    createElement(PathnameContext.Provider, { value: getPathname({ locale, href: "/dashboard/products" }) },
      createElement(NextIntlClientProvider, { locale, messages, timeZone: "Europe/Zagreb", children:
        createElement(DashboardShell, { brandLabel: "Passvero", title: "Products", productsLabel: "Products", signOutLabel: "Sign out", pendingLabel: "Pending", signOutFailureLabel: "Failed", userLabel: "Existing user", organizationName: "Existing organization", children: "Croatian Product content" }) }))));
  assert.match(html, /<select\b/);
  assert.ok(html.includes(`aria-label="${messages.Common.language}"`));
  assert.equal((html.match(/<option\b/g) ?? []).length, 6);
  assert.match(html, new RegExp(`<option[^>]*value="${locale}"[^>]*selected=""`));
  for (const code of locales) assert.ok(html.includes(messages.Common.languages[code]));
  assert.doesNotMatch(html, /Existing user/); // Identity card was replaced by the compact organization header.
  assert.match(html, /Existing organization/);
  assert.match(html, /Croatian Product content/);
  assert.match(html, /min-h-11[^\"]*focus:ring-2/);
});
const id = "00000000-0000-4000-8000-000000000001";
for (const [locale, href, expected] of [
  ["en", "/dashboard", "/en/dashboard"],
  ["de", "/dashboard/products", "/de/dashboard/products"],
  ["hr", `/dashboard/products/${id}`, `/dashboard/products/${id}`],
  ["sl", "/dashboard/products/new", "/sl/dashboard/products/new"],
  ["pl", `/dashboard/products/${id}/edit`, `/pl/dashboard/products/${id}/edit`],
  ["hr", `/dashboard/products/${id}/content/edit`, `/dashboard/products/${id}/content/edit`],
] as const) test(`locale navigation preserves ${href} in ${locale}`, () => {
  assert.equal(getPathname({ locale, href }), expected);
});

// Characterize the app's configured navigation at the browser/router boundary:
// route locale changes must only write NEXT_LOCALE, never session cookies or APIs.
for (const [from, to, path, expected] of [
  ["hr", "en", "/dashboard", "/en/dashboard"],
  ["en", "de", "/en/dashboard/products", "/de/dashboard/products"],
  ["de", "hr", `/de/dashboard/products/${id}`, `/hr/dashboard/products/${id}`],
  ["sr", "sl", "/sr/dashboard", "/sl/dashboard"],
  ["sl", "pl", "/sl/dashboard/products", "/pl/dashboard/products"],
  ["pl", "hr", "/pl/dashboard", "/hr/dashboard"],
] as const) test(`${from} to ${to} keeps route identity and only updates the locale cookie`, () => {
  const calls: string[] = [];
  const cookieWrites: string[] = [];
  let navigate: (() => void) | undefined;
  function Probe() {
    const currentPath = usePathname();
    const currentRouter = useRouter();
    navigate = () => currentRouter.replace(currentPath, { locale: to });
    return null;
  }
  renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: { ...router, replace: href => { calls.push(href); } } },
    createElement(PathnameContext.Provider, { value: path },
      createElement(NextIntlClientProvider, { locale: from, messages: {}, timeZone: "Europe/Zagreb", children: createElement(Probe) }))));
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { pathname: path } } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { set cookie(value: string) { cookieWrites.push(value); } } });
  try {
    assert.ok(navigate);
    navigate();
    assert.deepEqual(calls, [expected]);
    assert.equal(cookieWrites.length, 1);
    assert.match(cookieWrites[0], new RegExp(`^NEXT_LOCALE=${to};`));
    assert.match(cookieWrites[0], /sameSite=lax;/);
    assert.match(cookieWrites[0], /path=\/;/);
  } finally {
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else Reflect.deleteProperty(globalThis, "document");
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
