import assert from "node:assert/strict";
import test from "node:test";

import { PrismaPublishProductPersistence } from "../../src/infrastructure/persistence/prisma/prisma-publish-product";

const ids = { organizationId: "11111111-1111-4111-8111-111111111111", actorId: "22222222-2222-4222-8222-222222222222", productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", draftVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };
const at = new Date("2026-09-02T09:00:00.000Z");

function client(productCount = 1) {
  const calls: Array<{ name: string; value: unknown }> = [];
  const tx = {
    product: { async updateMany(value: unknown) { calls.push({ name: "product", value }); return { count: productCount }; } },
    productVersion: { async updateMany(value: unknown) { calls.push({ name: "version", value }); return { count: 1 }; } },
    passport: {
      async create(value: unknown) { calls.push({ name: "passport:create", value }); return { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" }; },
      async updateMany(value: unknown) { calls.push({ name: "passport:update", value }); return { count: 1 }; },
    },
    qRCode: { async create(value: unknown) { calls.push({ name: "qr:create", value }); return { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" }; } },
    auditLog: { async create(value: unknown) { calls.push({ name: "audit", value }); return { id: "ffffffff-ffff-4fff-8fff-ffffffffffff" }; } },
  };
  return { calls, tx };
}

test("writes first publication Passport pending QR and minimized audit after winning Product CAS", async () => {
  const fake = client();
  const persistence = new PrismaPublishProductPersistence({} as never);
  const result = await persistence.applyPublication(fake.tx as never, {
    ...ids, previousPublishedVersionId: null, expectedProductUpdatedAt: new Date("2026-09-02T08:00:00Z"), expectedDraftUpdatedAt: new Date("2026-09-02T08:01:00Z"), expectedCurrentPublishedVersionId: null,
    versionNumber: 1, publishedAt: at, sourceLocale: "hr", passport: null, qrCode: "QR_CODE_00000001", qrTargetUrl: "https://passvero.eu/p/ABCDEFGHIJKLMNOPQRSTUV", correlationId: "correlation",
  });
  assert.equal(result, "APPLIED");
  assert.deepEqual(fake.calls.map((call) => call.name), ["version", "product", "passport:create", "qr:create", "audit"]);
  const serialized = JSON.stringify(fake.calls);
  assert.match(serialized, /VERSION_PUBLISHED/);
  assert.match(serialized, /previousVersionSuperseded/);
  assert.match(serialized, /PENDING/);
  const audit = fake.calls.find((call) => call.name === "audit");
  assert.deepEqual((audit?.value as { data: { metadata: unknown } }).data.metadata, { versionNumber: 1, previousVersionSuperseded: false });
  assert.deepEqual((fake.calls.find((call) => call.name === "passport:create")?.value as { data: unknown }).data, { productId: ids.productId, organizationId: ids.organizationId, status: "ACTIVE", defaultLocale: "hr", firstPublishedAt: at, lastPublishedAt: at });
  assert.deepEqual((fake.calls.find((call) => call.name === "qr:create")?.value as { data: unknown }).data, { passportId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", code: "QR_CODE_00000001", targetUrl: "https://passvero.eu/p/ABCDEFGHIJKLMNOPQRSTUV", status: "PENDING", generatedAt: at, activatedAt: null, revokedAt: null });
  assert.deepEqual((audit?.value as { data: unknown }).data, { organizationId: ids.organizationId, actorId: ids.actorId, action: "VERSION_PUBLISHED", entityType: "PRODUCT", entityId: ids.productId, summary: "Product version published.", metadata: { versionNumber: 1, previousVersionSuperseded: false }, correlationId: "correlation", occurredAt: at });
});

test("returns STALE after the source CAS so the business transaction rolls both back", async () => {
  const fake = client(0);
  const persistence = new PrismaPublishProductPersistence({} as never);
  const result = await persistence.applyPublication(fake.tx as never, {
    ...ids, previousPublishedVersionId: null, expectedProductUpdatedAt: at, expectedDraftUpdatedAt: at, expectedCurrentPublishedVersionId: null,
    versionNumber: 1, publishedAt: at, sourceLocale: "hr", passport: null, qrCode: "QR_CODE_00000001", qrTargetUrl: "https://passvero.eu/p/CODE", correlationId: "correlation",
  });
  assert.equal(result, "STALE");
  assert.deepEqual(fake.calls.map((call) => call.name), ["version", "product"]);
});

test("supersedes the previous version and reuses existing Passport and QR", async () => {
  const fake = client();
  const persistence = new PrismaPublishProductPersistence({} as never);
  await persistence.applyPublication(fake.tx as never, {
    ...ids, previousPublishedVersionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", expectedProductUpdatedAt: at, expectedDraftUpdatedAt: at, expectedCurrentPublishedVersionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    versionNumber: 2, publishedAt: at, sourceLocale: "hr", passport: { passportId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", productId: ids.productId, organizationId: ids.organizationId, status: "ACTIVE", qrCode: { qrCodeId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", code: "QR_EXISTING", targetUrl: "https://passvero.eu/p/CODE", status: "ACTIVE" } }, qrCode: null, qrTargetUrl: "https://passvero.eu/p/CODE", correlationId: "correlation",
  });
  assert.deepEqual(fake.calls.map((call) => call.name), ["version", "version", "product", "passport:update", "audit"]);
  assert.equal(fake.calls.some((call) => call.name === "qr:create"), false);
});

test("serializes the exact tenant scoped Product row before publication decisions", async () => {
  let query: { strings: readonly string[]; values: readonly unknown[] } | undefined;
  const row = { id: ids.productId, organizationId: ids.organizationId, lifecycleStatus: "ACTIVE", publicCode: "ABCDEFGHIJKLMNOPQRSTUV", currentDraftVersionId: ids.draftVersionId, currentPublishedVersionId: null, updatedAt: at };
  const tx = {
    product: { async findFirst() { return null; } },
    async $queryRaw(received: { strings: readonly string[]; values: readonly unknown[] }) { query = received; return [row]; },
  };
  const persistence = new PrismaPublishProductPersistence({} as never);
  assert.deepEqual(await persistence.readProductForPublication(tx as never, { productId: ids.productId, organizationId: ids.organizationId }), { ...row, productId: ids.productId });
  assert.match(query?.strings.join("?") ?? "", /FOR UPDATE/);
  assert.deepEqual(query?.values, [ids.productId, ids.organizationId]);
  const missing = { async $queryRaw() { return []; } };
  assert.equal(await persistence.readProductForPublication(missing as never, { productId: ids.productId, organizationId: ids.organizationId }), null);
});

test("validates existing material and CN invariants as part of publication readiness", async () => {
  const persistence = new PrismaPublishProductPersistence({} as never);
  const base = {
    productTranslation: { async findUnique() { return { productName: "Chair" }; } },
    productDocument: { async findFirst() { return null; } },
    productImage: { async findFirst() { return null; } },
    productMaterial: { async findMany() { return [{ materialName: "Steel", category: null, percentage: "60.00", isRecycled: true, recycledPercentage: "20.00" }, { materialName: "Wood", category: "Wood", percentage: "40.00", isRecycled: false, recycledPercentage: null }]; } },
    productIdentifier: { async findMany() { return [{ type: "CN", value: "01234567", nomenclatureYear: 2026, issuingAuthority: null, notes: null }]; } },
  };
  assert.deepEqual(await persistence.readReadiness(base as never, { productVersionId: ids.draftVersionId, organizationId: ids.organizationId, sourceLocale: "hr", currentUtcYear: 2026 }), { sourceTranslationExists: true, sourceProductName: "Chair", unavailablePublicAsset: false, invalidAuthoredAggregate: false });
  const invalid = { ...base, productMaterial: { async findMany() { return [{ materialName: "Steel", category: null, percentage: "70.00", isRecycled: false, recycledPercentage: null }, { materialName: "Wood", category: null, percentage: "40.00", isRecycled: false, recycledPercentage: null }]; } } };
  assert.equal((await persistence.readReadiness(invalid as never, { productVersionId: ids.draftVersionId, organizationId: ids.organizationId, sourceLocale: "hr", currentUtcYear: 2026 })).invalidAuthoredAggregate, true);
});

test("loads the Product-owned Passport so the service can validate tenant consistency", async () => {
  let where: unknown;
  const row = { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", productId: ids.productId, organizationId: "99999999-9999-4999-8999-999999999999", status: "ACTIVE", qrCode: null };
  const tx = { passport: {
    async findFirst() { return null; },
    async findUnique(input: { where: unknown }) { where = input.where; return row; },
  } };
  const persistence = new PrismaPublishProductPersistence({} as never);
  assert.deepEqual(await persistence.readPassport(tx as never, { productId: ids.productId, organizationId: ids.organizationId }), { passportId: row.id, productId: row.productId, organizationId: row.organizationId, status: row.status, qrCode: null });
  assert.deepEqual(where, { productId: ids.productId });
});
