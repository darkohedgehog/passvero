import { prerender } from "react-dom/static";
import { createElement } from "react";
import type { ReactElement } from "react";

import type { GetPublicDpp, GetPublicDppResult, PublicDppLocale } from "@/src/application/public-dpp/contracts";
import { PUBLIC_DPP_LOCALES } from "@/src/application/public-dpp/contracts";
import { resolvePublicDppLocale } from "@/src/application/public-dpp/locale";
import { PublicDppDocument, type PublicDppLabels } from "@/src/components/public-dpp/public-dpp-document";

export type PublicDppHttpHandler = (request: Request, publicCode: string) => Promise<Response>;

interface PublicDppHttpDependencies {
  readonly canonicalOrigin: string;
  readonly getPublicDpp: GetPublicDpp;
  readonly getLabels: (locale: PublicDppLocale) => PublicDppLabels;
  readonly createCanonicalUrl?: (canonicalOrigin: string, publicCode: string) => string;
  readonly renderDocument?: (document: ReactElement) => Promise<BodyInit>;
}

export function createPublicDppHttpHandler(dependencies: PublicDppHttpDependencies): PublicDppHttpHandler {
  const createCanonicalUrl = dependencies.createCanonicalUrl
    ?? ((canonicalOrigin: string, publicCode: string) => new URL(`/p/${publicCode}`, canonicalOrigin).toString());
  const renderDocument = dependencies.renderDocument
    ?? (async (document: ReactElement) => (await prerender(document)).prelude);
  return async (request: Request, publicCode: string): Promise<Response> => {
    const url = new URL(request.url);
    const langValues = url.searchParams.getAll("lang");
    const requestedLocale: unknown = langValues.length === 0
      ? undefined
      : langValues.length === 1 ? langValues[0] : langValues;
    const acceptLanguage = request.headers.get("accept-language");
    const result = await dependencies.getPublicDpp({ publicCode, requestedLocale, acceptLanguage });
    const locale = result.kind === "PUBLIC"
      ? result.dpp.locale
      : resolvePublicDppLocale(requestedLocale, acceptLanguage, PUBLIC_DPP_LOCALES, "hr", "hr") ?? "hr";
    const labels = dependencies.getLabels(locale);
    const canonicalUrl = createCanonicalUrl(dependencies.canonicalOrigin, publicCode);
    const body = await renderDocument(createElement(PublicDppDocument, {
      result,
      locale,
      labels,
      canonicalUrl,
      publicCode,
    }));
    return new Response(body, {
      status: statusFor(result),
      headers: publicDppHeaders(),
    });
  };
}

export async function executePublicDppRequest(
  request: Request,
  publicCode: string | Promise<string>,
  getHandler: () => PublicDppHttpHandler,
): Promise<Response> {
  try {
    return await getHandler()(request, await publicCode);
  } catch {
    return createGenericPublicDppUnavailableResponse(request);
  }
}

function statusFor(result: GetPublicDppResult): number {
  if (result.kind === "PUBLIC") return 200;
  if (result.kind === "WITHDRAWN") return 410;
  return result.kind === "NOT_FOUND" ? 404 : 503;
}

function createGenericPublicDppUnavailableResponse(request: Request): Response {
  const locale = safeUnavailableLocale(request);
  const copy = RUNTIME_UNAVAILABLE_COPY[locale];
  const html = `<!DOCTYPE html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(copy.title)}</title><meta name="description" content="${escapeHtml(copy.message)}"><meta name="robots" content="noindex,nofollow"><style>${RUNTIME_UNAVAILABLE_CSS}</style></head><body><main><div class="brand">Passvero</div><p class="eyebrow">${escapeHtml(copy.documentTitle)}</p><h1>${escapeHtml(copy.title)}</h1><p>${escapeHtml(copy.message)}</p></main></body></html>`;
  return new Response(html, { status: 503, headers: publicDppHeaders() });
}

function safeUnavailableLocale(request: Request): PublicDppLocale {
  try {
    const url = new URL(request.url);
    const langValues = url.searchParams.getAll("lang");
    const requestedLocale: unknown = langValues.length === 0
      ? undefined
      : langValues.length === 1 ? langValues[0] : langValues;
    return resolvePublicDppLocale(
      requestedLocale,
      request.headers.get("accept-language"),
      PUBLIC_DPP_LOCALES,
      "hr",
      "hr",
    ) ?? "hr";
  } catch {
    return "hr";
  }
}

function publicDppHeaders(): Record<string, string> {
  return {
    "cache-control": "no-store",
    "content-type": "text/html; charset=utf-8",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;",
};

const RUNTIME_UNAVAILABLE_COPY = {
  hr: { documentTitle: "Digitalna putovnica proizvoda", title: "Privremeno nedostupno", message: "Ovu digitalnu putovnicu proizvoda trenutačno nije moguće prikazati. Pokušajte ponovno kasnije." },
  sr: { documentTitle: "Digitalni pasoš proizvoda", title: "Privremeno nedostupno", message: "Ovaj digitalni pasoš proizvoda trenutno nije moguće prikazati. Pokušajte ponovo kasnije." },
  en: { documentTitle: "Digital Product Passport", title: "Temporarily unavailable", message: "This Digital Product Passport cannot be displayed right now. Please try again later." },
  de: { documentTitle: "Digitaler Produktpass", title: "Vorübergehend nicht verfügbar", message: "Dieser digitale Produktpass kann derzeit nicht angezeigt werden. Bitte versuchen Sie es später erneut." },
  sl: { documentTitle: "Digitalni potni list izdelka", title: "Začasno ni na voljo", message: "Tega digitalnega potnega lista izdelka trenutno ni mogoče prikazati. Poskusite znova pozneje." },
  pl: { documentTitle: "Cyfrowy paszport produktu", title: "Tymczasowo niedostępny", message: "Tego cyfrowego paszportu produktu nie można teraz wyświetlić. Spróbuj ponownie później." },
} satisfies Record<PublicDppLocale, { readonly documentTitle: string; readonly title: string; readonly message: string }>;

const RUNTIME_UNAVAILABLE_CSS = ":root{color-scheme:light;font-family:Geist,Inter,ui-sans-serif,system-ui,sans-serif;color:#0f172a;background:#f8fafc}*{box-sizing:border-box}body{margin:0;background:#f8fafc;color:#0f172a}main{width:min(100% - 2rem,48rem);margin:2rem auto;padding:1.5rem;border:1px solid #e2e8f0;border-radius:1rem;background:#fff;overflow-wrap:anywhere}.brand{font-weight:800;color:#0f766e}.eyebrow{margin:1rem 0 .35rem;color:#475569;font-size:.875rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em}h1{margin:.25rem 0;font-size:clamp(1.75rem,8vw,2.75rem);line-height:1.12}p{font-size:1rem;line-height:1.65}@media(min-width:40rem){main{margin-top:3rem;padding:2rem}}";
