import assert from "node:assert/strict";
import test from "node:test";

import type { GetPublicDpp, GetPublicDppResult, PublicDpp } from "../../src/application/public-dpp/contracts";
import { createPublicDppHttpHandler } from "../../src/application/public-dpp/http";
import * as publicDppHttp from "../../src/application/public-dpp/http";
import type { PublicDppLabels } from "../../src/components/public-dpp/public-dpp-document";

const publicCode = "AbCdEfGhIjKlMnOpQrStUv";
const privateValues = [
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "QR_CODE_PRIVATE",
  "draft secret",
  "Prisma constraint secret",
];

const labels: PublicDppLabels = {
  documentTitle: "Digital Product Passport",
  active: "Active",
  organization: "Organization",
  version: "Version",
  published: "Published",
  language: "Language",
  shortDescription: "Short description",
  description: "Description",
  technicalDescription: "Technical description",
  repairInstructions: "Repair instructions",
  sparePartsInformation: "Spare parts information",
  recyclingInstructions: "Recycling instructions",
  disposalInstructions: "Disposal instructions",
  packagingInformation: "Packaging information",
  safetyInformation: "Safety information",
  warrantyInformation: "Warranty information",
  publicNotes: "Public notes",
  materials: "Materials",
  category: "Category",
  share: "Share of product composition",
  recycledStatus: "Contains recycled content",
  recycledWithinMaterial: "Recycled content within this material",
  yes: "Yes",
  no: "No",
  cn: "CN classification",
  cnCode: "CN code",
  cnYear: "Combined Nomenclature year",
  cnDisclaimer: "This classification is organization-recorded. Passvero does not determine or verify customs correctness.",
  withdrawnTitle: "Passport no longer active",
  withdrawnMessage: "This Digital Product Passport is no longer active.",
  notFoundTitle: "Passport not found",
  notFoundMessage: "The requested Digital Product Passport is unavailable.",
  unavailableTitle: "Temporarily unavailable",
  unavailableMessage: "This Digital Product Passport is temporarily unavailable. Try again later.",
  metadataDescription: "Digital Product Passport for {productName}.",
  languageNames: { hr: "Hrvatski", sr: "Srpski", en: "English", de: "Deutsch", sl: "Slovenščina", pl: "Polski" },
};

const dpp: PublicDpp = {
  locale: "en",
  availableLocales: ["hr", "en"],
  passport: { status: "ACTIVE", firstPublishedAt: "2026-08-20T10:00:00.000Z" },
  organization: { displayName: "Example Organization" },
  version: { number: 2, publishedAt: "2026-09-02T10:00:00.000Z" },
  content: {
    productName: "Chair <script>alert(1)</script>",
    shortDescription: "Short description",
    description: "Long public description",
    technicalDescription: null,
    repairInstructions: null,
    sparePartsInformation: null,
    recyclingInstructions: null,
    disposalInstructions: null,
    packagingInformation: null,
    safetyInformation: null,
    warrantyInformation: null,
    publicNotes: null,
  },
  materials: [
    { materialName: "Steel", category: "Metal", percentage: "0.00", isRecycled: false, recycledPercentage: null },
    { materialName: "Fabric", category: null, percentage: null, isRecycled: true, recycledPercentage: "75.00" },
  ],
  cn: { code: "01012100", nomenclatureYear: 2026 },
};

function handler(result: GetPublicDppResult, observed: Parameters<GetPublicDpp>[0][] = []) {
  return createPublicDppHttpHandler({
    canonicalOrigin: "https://passvero.eu",
    getLabels: () => labels,
    getPublicDpp: async (query) => {
      observed.push(query);
      return result;
    },
  });
}

function request(path = `/p/${publicCode}?lang=en`, headers: HeadersInit = {}) {
  return new Request(`https://passvero.eu${path}`, { headers });
}

async function assertGenericRuntimeUnavailable(
  response: Response,
  forbiddenDetail: string,
  expectedTitle = "Temporarily unavailable",
) {
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("set-cookie"), null);
  const html = await response.text();
  assert.match(html, new RegExp(expectedTitle));
  assert.match(html, /name="robots" content="noindex,nofollow"/);
  assert.doesNotMatch(html, new RegExp(forbiddenDetail));
  assert.doesNotMatch(html, new RegExp(publicCode));
  assert.doesNotMatch(html, /Example Organization|Chair|Steel|01012100|canonical|Prisma|SQL/i);
}

async function executeWithBoundary(
  requestValue: Request,
  getHandler: () => (request: Request, publicCode: string) => Promise<Response>,
  publicCodeValue: string | Promise<string> = publicCode,
) {
  const execute = (publicDppHttp as unknown as {
    executePublicDppRequest?: (
      request: Request,
      publicCode: string | Promise<string>,
      getHandler: () => (request: Request, publicCode: string) => Promise<Response>,
    ) => Promise<Response>;
  }).executePublicDppRequest;
  assert.equal(typeof execute, "function");
  return execute!(requestValue, publicCodeValue, getHandler);
}

test("renders the public allowlist as an escaped mobile-first semantic HTML response", async () => {
  const response = await handler({ kind: "PUBLIC", dpp })(request(), publicCode);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("set-cookie"), null);
  const html = await response.text();
  assert.match(html, /^<!DOCTYPE html><html lang="en"/);
  assert.match(html, /<main[^>]*>/);
  assert.equal((html.match(/<h1/g) ?? []).length, 1);
  assert.match(html, /Chair &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /aria-current="page"[^>]*>English|>English<\/a>/);
  assert.match(html, new RegExp(`/p/${publicCode}\\?lang=hr`));
  assert.doesNotMatch(html, /lang=de/);
  assert.match(html, /0\.00%/);
  assert.match(html, /75\.00%/);
  assert.match(html, /0101 21 00/);
  assert.match(html, /Passvero does not determine or verify customs correctness/);
  assert.match(html, /rel="canonical" href="https:\/\/passvero\.eu\/p\/AbCdEfGhIjKlMnOpQrStUv"/);
  assert.match(html, /name="robots" content="noindex,nofollow"/);
  assert.doesNotMatch(html, /application\/ld\+json|og:image|TARIC|Supplier|Notes|QRCode|dashboard|login/i);
  for (const value of privateValues) assert.doesNotMatch(html, new RegExp(value));
});

test("returns a content-free withdrawn response with exact 410 status", async () => {
  const response = await handler({ kind: "WITHDRAWN", publicMessage: "Contact the issuer." })(request(), publicCode);
  assert.equal(response.status, 410);
  const html = await response.text();
  assert.match(html, /This Digital Product Passport is no longer active/);
  assert.match(html, /Contact the issuer/);
  assert.doesNotMatch(html, /Example Organization|Chair|Steel|0101 21 00|Version 2/);
});

test("maps not-found and invariant failures to generic data-free status pages", async () => {
  for (const [result, status, message] of [
    [{ kind: "NOT_FOUND" }, 404, "Passport not found"],
    [{ kind: "TEMPORARILY_UNAVAILABLE" }, 503, "Temporarily unavailable"],
  ] as const) {
    const response = await handler(result)(request(), publicCode);
    assert.equal(response.status, status);
    const html = await response.text();
    assert.match(html, new RegExp(message));
    for (const value of [...privateValues, "Example Organization", "Chair", "Steel", "01012100"]) {
      assert.doesNotMatch(html, new RegExp(value));
    }
  }
});

test("passes only public locale inputs and ignores cookies or authenticated context", async () => {
  const observed: Parameters<GetPublicDpp>[0][] = [];
  const subject = handler({ kind: "NOT_FOUND" }, observed);
  const headers = { "accept-language": "de-DE;q=0.9", cookie: "session=private; organization=secret", authorization: "Bearer private" };
  await subject(request(`/p/${publicCode}?lang=en&lang=de`, headers), publicCode);
  await subject(request(`/p/${publicCode}?lang=en&lang=de`, {}), publicCode);
  assert.deepEqual(observed, [
    { publicCode, requestedLocale: ["en", "de"], acceptLanguage: "de-DE;q=0.9" },
    { publicCode, requestedLocale: ["en", "de"], acceptLanguage: null },
  ]);
  assert.equal("cookie" in observed[0], false);
  assert.equal("authorization" in observed[0], false);
});

test("renders a minimal valid publication without empty optional sections", async () => {
  const minimal: PublicDpp = {
    ...dpp,
    availableLocales: ["en"],
    content: {
      productName: "Minimal chair",
      shortDescription: null,
      description: null,
      technicalDescription: null,
      repairInstructions: null,
      sparePartsInformation: null,
      recyclingInstructions: null,
      disposalInstructions: null,
      packagingInformation: null,
      safetyInformation: null,
      warrantyInformation: null,
      publicNotes: null,
    },
    materials: [],
    cn: null,
  };
  const response = await handler({ kind: "PUBLIC", dpp: minimal })(request(), publicCode);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Minimal chair/);
  assert.match(html, /Example Organization/);
  assert.match(html, /Version/);
  assert.match(html, /Published/);
  assert.doesNotMatch(html, /<nav|materials-heading|cn-heading|Short description|Technical description/);
});

test("returns equivalent content for anonymous, unrelated, and same-tenant session headers", async () => {
  const subject = handler({ kind: "PUBLIC", dpp });
  const variants: HeadersInit[] = [
    { "accept-language": "en" },
    { "accept-language": "en", cookie: "session=unrelated", authorization: "Bearer unrelated" },
    { "accept-language": "en", cookie: "session=same-tenant", authorization: "Bearer same-tenant" },
  ];
  const bodies = await Promise.all(variants.map(async (headers) => {
    const response = await subject(request(`/p/${publicCode}?lang=en`, headers), publicCode);
    return response.text();
  }));
  assert.equal(bodies[1], bodies[0]);
  assert.equal(bodies[2], bodies[0]);
});

test("maps an unexpected service rejection to the confidential generic 503 contract", async () => {
  const subject = createPublicDppHttpHandler({
    canonicalOrigin: "https://passvero.eu",
    getLabels: () => labels,
    getPublicDpp: async () => { throw new Error("SERVICE_PRIVATE_DETAIL"); },
  });
  await assertGenericRuntimeUnavailable(
    await executeWithBoundary(request(), () => subject),
    "SERVICE_PRIVATE_DETAIL",
  );
});

test("maps label resolution failure to the confidential generic 503 contract", async () => {
  const subject = createPublicDppHttpHandler({
    canonicalOrigin: "https://passvero.eu",
    getLabels: () => { throw new Error("MISSING_LABEL_PRIVATE_DETAIL"); },
    getPublicDpp: async () => ({ kind: "NOT_FOUND" }),
  });
  await assertGenericRuntimeUnavailable(
    await executeWithBoundary(request(`/p/${publicCode}?lang=de`), () => subject),
    "MISSING_LABEL_PRIVATE_DETAIL",
    "Vorübergehend nicht verfügbar",
  );
});

test("maps canonical URL preparation failure to the confidential generic 503 contract", async () => {
  const subject = createPublicDppHttpHandler({
    canonicalOrigin: "https://passvero.eu",
    getLabels: () => labels,
    getPublicDpp: async () => ({ kind: "NOT_FOUND" }),
    createCanonicalUrl: () => { throw new Error("CANONICAL_ORIGIN_PRIVATE_DETAIL"); },
  });
  await assertGenericRuntimeUnavailable(
    await executeWithBoundary(request(), () => subject),
    "CANONICAL_ORIGIN_PRIVATE_DETAIL",
  );
});

test("maps renderer rejection to the confidential generic 503 contract", async () => {
  const subject = createPublicDppHttpHandler({
    canonicalOrigin: "https://passvero.eu",
    getLabels: () => labels,
    getPublicDpp: async () => ({ kind: "NOT_FOUND" }),
    renderDocument: async () => { throw new Error("RENDER_PRIVATE_DETAIL"); },
  });
  await assertGenericRuntimeUnavailable(
    await executeWithBoundary(request(), () => subject),
    "RENDER_PRIVATE_DETAIL",
  );
});

test("maps handler construction failure through the route outer boundary", async () => {
  const response = await executeWithBoundary(request(), () => { throw new Error("RUNTIME_CONSTRUCTION_PRIVATE_DETAIL"); });
  await assertGenericRuntimeUnavailable(response, "RUNTIME_CONSTRUCTION_PRIVATE_DETAIL");
});

test("maps route parameter resolution rejection through the same outer boundary", async () => {
  const response = await executeWithBoundary(
    request(),
    () => handler({ kind: "NOT_FOUND" }),
    Promise.reject(new Error("PARAMETER_PRIVATE_DETAIL")),
  );
  await assertGenericRuntimeUnavailable(response, "PARAMETER_PRIVATE_DETAIL");
});
