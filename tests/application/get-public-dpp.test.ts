import assert from "node:assert/strict";
import test from "node:test";

import { createGetPublicDppService } from "../../src/application/public-dpp/get-public-dpp";
import { resolvePublicDppLocale } from "../../src/application/public-dpp/locale";
import type {
  PublicDppAuthorityRecord,
  PublicDppContentRecord,
  PublicDppPersistence,
} from "../../src/application/public-dpp/ports";

const publicCode = "AbCdEfGhIjKlMnOpQrStUv";
const firstPublishedAt = new Date("2026-08-20T10:00:00.000Z");
const publishedAt = new Date("2026-09-02T10:00:00.000Z");

const authority: PublicDppAuthorityRecord = {
  productLifecycleStatus: "ACTIVE",
  organizationStatus: "ACTIVE",
  organizationDisplayName: "Example Organization",
  hasCurrentPublishedVersion: true,
  productLastPublishedAt: publishedAt,
  passport: {
    ownershipConsistent: true,
    status: "ACTIVE",
    defaultLocale: "hr",
    firstPublishedAt,
    lastPublishedAt: publishedAt,
    publicWithdrawalMessage: null,
  },
};

const content: PublicDppContentRecord = {
  ownershipConsistent: true,
  versionNumber: 2,
  publishedAt,
  sourceLocale: "hr",
  translations: [
    translation("en", "Public chair", { shortDescription: "Short public text" }),
    translation("hr", "Javna stolica"),
    translation("de", "Öffentlicher Stuhl"),
    translation("xx", "Unsupported"),
  ],
  materials: [
    { materialName: "Steel", category: "Metal", percentage: "0.00", isRecycled: false, recycledPercentage: null },
    { materialName: "Fabric", category: null, percentage: null, isRecycled: true, recycledPercentage: "75.00" },
  ],
  cnRows: [{ value: "01012100", nomenclatureYear: 2026 }],
};

function translation(
  locale: string,
  productName: string,
  overrides: Partial<PublicDppContentRecord["translations"][number]> = {},
): PublicDppContentRecord["translations"][number] {
  return {
    locale,
    productName,
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
    ...overrides,
  };
}

function fixture(input: {
  authority?: PublicDppAuthorityRecord | null;
  content?: PublicDppContentRecord | null;
  authorityFailure?: boolean;
  contentFailure?: boolean;
} = {}) {
  const calls: Array<{ operation: "authority" | "content"; publicCode: string }> = [];
  const persistence: PublicDppPersistence = {
    async readAuthorityByPublicCode(code) {
      calls.push({ operation: "authority", publicCode: code });
      if (input.authorityFailure) throw new Error("Prisma secret authority failure");
      return input.authority === undefined ? authority : input.authority;
    },
    async readCurrentPublishedContentByPublicCode(code) {
      calls.push({ operation: "content", publicCode: code });
      if (input.contentFailure) throw new Error("SQL secret content failure");
      return input.content === undefined ? content : input.content;
    },
  };
  return { calls, getPublicDpp: createGetPublicDppService({ persistence }) };
}

test("returns the exact allowlisted DTO from the pointed publication", async () => {
  const subject = fixture();
  const result = await subject.getPublicDpp({ publicCode, requestedLocale: " EN ", acceptLanguage: "de;q=1" });
  assert.deepEqual(result, {
    kind: "PUBLIC",
    dpp: {
      locale: "en",
      availableLocales: ["hr", "en", "de"],
      passport: { status: "ACTIVE", firstPublishedAt: "2026-08-20T10:00:00.000Z" },
      organization: { displayName: "Example Organization" },
      version: { number: 2, publishedAt: "2026-09-02T10:00:00.000Z" },
      content: {
        productName: "Public chair",
        shortDescription: "Short public text",
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
      materials: content.materials,
      cn: { code: "01012100", nomenclatureYear: 2026 },
    },
  });
  assert.deepEqual(subject.calls, [
    { operation: "authority", publicCode },
    { operation: "content", publicCode },
  ]);
  assert.doesNotMatch(JSON.stringify(result), /organizationId|productVersionId|currentDraft|supplier|notes|QRCode|Unsupported/);
});

test("implements explicit query, Accept-Language, default, and source locale precedence", () => {
  const available = ["hr", "en", "de"] as const;
  assert.equal(resolvePublicDppLocale("de", "en;q=1", available, "hr", "hr"), "de");
  assert.equal(resolvePublicDppLocale("pl", "de;q=1", available, "en", "hr"), "en");
  assert.equal(resolvePublicDppLocale(["de", "en"], "de-DE;q=0.8,en-US;q=0.9", available, "hr", "hr"), "en");
  assert.equal(resolvePublicDppLocale(" ", "de-DE;q=0.9,en;q=0", available, "hr", "hr"), "de");
  assert.equal(resolvePublicDppLocale(undefined, "de;q=0,pl;q=1", available, "en", "hr"), "en");
  assert.equal(resolvePublicDppLocale(undefined, null, available, "pl", "hr"), "hr");
  assert.equal(resolvePublicDppLocale(undefined, null, available, "pl", "pl"), null);
});

test("collapses non-public states and stops before the content read", async () => {
  const cases: Array<[PublicDppAuthorityRecord | null, "NOT_FOUND" | "WITHDRAWN"]> = [
    [null, "NOT_FOUND"],
    [{ ...authority, productLifecycleStatus: "ARCHIVED" }, "NOT_FOUND"],
    [{ ...authority, organizationStatus: "SUSPENDED" }, "NOT_FOUND"],
    [{ ...authority, hasCurrentPublishedVersion: false }, "NOT_FOUND"],
    [{ ...authority, passport: null }, "NOT_FOUND"],
    [{ ...authority, passport: { ...authority.passport!, status: "ARCHIVED" } }, "NOT_FOUND"],
    [{ ...authority, passport: { ...authority.passport!, status: "WITHDRAWN", publicWithdrawalMessage: "  Contact the issuer.  " } }, "WITHDRAWN"],
  ];
  for (const [record, kind] of cases) {
    const subject = fixture({ authority: record });
    const result = await subject.getPublicDpp({ publicCode, requestedLocale: undefined, acceptLanguage: null });
    assert.equal(result.kind, kind);
    if (kind === "WITHDRAWN") assert.deepEqual(result, { kind, publicMessage: "Contact the issuer." });
    assert.deepEqual(subject.calls, [{ operation: "authority", publicCode }]);
  }
});

test("fails closed for malformed identity and every publication invariant failure", async () => {
  const malformed = fixture();
  assert.deepEqual(await malformed.getPublicDpp({ publicCode: `${publicCode} `, requestedLocale: "en", acceptLanguage: null }), { kind: "NOT_FOUND" });
  assert.deepEqual(malformed.calls, []);

  const invalidAuthorities: PublicDppAuthorityRecord[] = [
    { ...authority, organizationDisplayName: "  " },
    { ...authority, passport: { ...authority.passport!, ownershipConsistent: false } },
    { ...authority, passport: { ...authority.passport!, lastPublishedAt: null } },
    { ...authority, passport: { ...authority.passport!, firstPublishedAt: new Date("2026-09-03T00:00:00.000Z") } },
  ];
  for (const record of invalidAuthorities) {
    assert.deepEqual(await fixture({ authority: record }).getPublicDpp({ publicCode, requestedLocale: undefined, acceptLanguage: null }), { kind: "TEMPORARILY_UNAVAILABLE" });
  }

  const invalidContents: Array<PublicDppContentRecord | null> = [
    null,
    { ...content, ownershipConsistent: false },
    { ...content, versionNumber: 0 },
    { ...content, publishedAt: new Date("2026-09-01T10:00:00.000Z") },
    { ...content, sourceLocale: "xx" },
    { ...content, translations: content.translations.filter(({ locale }) => locale !== "hr") },
    { ...content, cnRows: [{ value: "01012100", nomenclatureYear: 2026 }, { value: "02022200", nomenclatureYear: 2026 }] },
  ];
  for (const record of invalidContents) {
    assert.deepEqual(await fixture({ content: record }).getPublicDpp({ publicCode, requestedLocale: undefined, acceptLanguage: null }), { kind: "TEMPORARILY_UNAVAILABLE" });
  }
});

test("maps unexpected persistence failures to a data-free unavailable result", async () => {
  assert.deepEqual(await fixture({ authorityFailure: true }).getPublicDpp({ publicCode, requestedLocale: null, acceptLanguage: null }), { kind: "TEMPORARILY_UNAVAILABLE" });
  assert.deepEqual(await fixture({ contentFailure: true }).getPublicDpp({ publicCode, requestedLocale: null, acceptLanguage: null }), { kind: "TEMPORARILY_UNAVAILABLE" });
});

test("rereads the current publication on every request for a stable public identity", async () => {
  let current = { ...content, versionNumber: 1, publishedAt, translations: [translation("hr", "Stari objavljeni sadržaj")] };
  const persistence: PublicDppPersistence = {
    async readAuthorityByPublicCode() {
      return { ...authority, productLastPublishedAt: current.publishedAt, passport: { ...authority.passport!, lastPublishedAt: current.publishedAt } };
    },
    async readCurrentPublishedContentByPublicCode() {
      return current;
    },
  };
  const getPublicDpp = createGetPublicDppService({ persistence });
  const query = { publicCode, requestedLocale: "hr", acceptLanguage: null };

  const before = await getPublicDpp(query);
  current = {
    ...content,
    versionNumber: 2,
    publishedAt: new Date("2026-09-02T11:00:00.000Z"),
    translations: [translation("hr", "Novi objavljeni sadržaj")],
  };
  const after = await getPublicDpp(query);

  assert.equal(before.kind === "PUBLIC" ? before.dpp.content.productName : null, "Stari objavljeni sadržaj");
  assert.equal(after.kind === "PUBLIC" ? after.dpp.content.productName : null, "Novi objavljeni sadržaj");
  assert.equal(after.kind === "PUBLIC" ? after.dpp.version.number : null, 2);
});
