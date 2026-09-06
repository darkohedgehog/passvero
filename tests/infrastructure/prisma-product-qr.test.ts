import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma, PrismaClient } from "../../src/generated/prisma/client";
import { PrismaProductQrPersistence, PrismaProductQrTransactionRunner } from "../../src/infrastructure/persistence/prisma/prisma-product-qr";
import type { QrRecord } from "../../src/application/products/qr/ports";
const at = new Date("2026-09-06T12:00:01Z");
const qr: QrRecord = { id: "qr", passportId: "passport", code: "INTERNAL_CODE", targetUrl: "https://example.test/p/AbCdEfGhIjKlMnOpQrStUv", status: "PENDING", generatedAt: new Date(at.getTime() - 1000), createdAt: new Date(at.getTime() - 1000), updatedAt: new Date(at.getTime() - 1000), activatedAt: null, revokedAt: null };
const context = { userId: "actor", membershipId: "member", organizationId: "org", membershipRole: "ADMIN" as const, membershipStatus: "ACTIVE" as const, permissions: ["PRODUCT_READ" as const, "QRCODE_ACTIVATE" as const], correlationId: "correlation" };
test("conditional QR mutation writes one minimized native audit and touches no other model", async () => {
  const writes: unknown[] = [];
  const tx = { qRCode: { async updateMany(value: unknown) { writes.push(value); return { count: 1 }; } }, auditLog: { async create(value: unknown) { writes.push(value); return { id: "audit" }; } } } as unknown as Prisma.TransactionClient;
  assert.equal(await new PrismaProductQrPersistence().activate(tx, { qr, at, context }), true);
  assert.deepEqual(writes, [
    { where: { id: "qr", passportId: "passport", code: "INTERNAL_CODE", targetUrl: qr.targetUrl, generatedAt: qr.generatedAt, createdAt: qr.createdAt, updatedAt: qr.updatedAt, status: "PENDING", activatedAt: null, revokedAt: null }, data: { status: "ACTIVE", activatedAt: at, updatedAt: at } },
    { data: { organizationId: "org", actorId: "actor", action: "QRCODE_ACTIVATED", entityType: "QRCODE", entityId: "qr", summary: "QR code activated.", metadata: { previousStatus: "PENDING", status: "ACTIVE" }, correlationId: "correlation", occurredAt: at }, select: { id: true } },
  ]);
});
test("failed conditional write does not insert an audit", async () => {
  const tx = { qRCode: { async updateMany() { return { count: 0 }; } }, auditLog: { async create() { assert.fail("Unexpected audit"); } } } as unknown as Prisma.TransactionClient;
  assert.equal(await new PrismaProductQrPersistence().activate(tx, { qr, at, context }), false);
});
test("audit insertion error escapes so the owning transaction rolls back", async () => {
  const tx = { qRCode: { async updateMany() { return { count: 1 }; } }, auditLog: { async create() { throw new Error("audit unavailable"); } } } as unknown as Prisma.TransactionClient;
  await assert.rejects(new PrismaProductQrPersistence().activate(tx, { qr, at, context }), /audit unavailable/);
});
test("transaction runner selects coherent read snapshot and serialized writes without retries", async () => {
  const calls: unknown[] = [];
  const client = { async $transaction(work: (tx: object) => Promise<unknown>, options: unknown) { calls.push(options); return work({}); } } as unknown as PrismaClient;
  const runner = new PrismaProductQrTransactionRunner(client);
  assert.equal(await runner.run("READ", async () => "read"), "read");
  await assert.rejects(runner.run("ACTIVATE", async () => { throw new Error("conflict"); }), /conflict/);
  assert.deepEqual(calls, [{ isolationLevel: "RepeatableRead" }, { isolationLevel: "ReadCommitted" }]);
});
test("eligibility takes Organization then exact Membership shared locks before role read", async () => {
  const calls: unknown[] = [];
  const tx = { async $queryRaw(query: { strings: string[]; values: unknown[] }) { calls.push({ sql: query.strings.join("?"), values: query.values }); return []; }, membership: { async findFirst(query: unknown) { calls.push(query); return { role: "ADMIN", status: "ACTIVE", organization: { status: "ACTIVE" } }; } } } as unknown as Prisma.TransactionClient;
  assert.deepEqual(await new PrismaProductQrPersistence().readEligibility(tx, context, "ACTIVATE"), { membershipRole: "ADMIN", membershipStatus: "ACTIVE", organizationStatus: "ACTIVE" });
  assert.equal(calls.length, 3);
  assert.match(JSON.stringify(calls[0]), /Organization.*FOR SHARE/);
  assert.match(JSON.stringify(calls[1]), /Membership.*FOR SHARE/);
  assert.deepEqual((calls[1] as { values: unknown }).values, ["member", "actor", "org"]);
});

test("Product resolution scopes and locks the ownership chain without writes", async () => {
  const sql: Array<{ text: string; values: unknown[] }> = [];
  const queries: Array<{ model: string; input: unknown }> = [];
  const tx = {
    async $queryRaw(query: { strings: string[]; values: unknown[] }) { sql.push({ text: query.strings.join("?"), values: query.values }); return []; },
    product: { async findFirst(input: unknown) { queries.push({ model: "product", input }); return { id: "product", organizationId: "org", lifecycleStatus: "ACTIVE", publicCode: "AbCdEfGhIjKlMnOpQrStUv", currentPublishedVersionId: "version" }; } },
    passport: { async findMany(input: unknown) { queries.push({ model: "passport", input }); return [{ id: "passport", productId: "product", organizationId: "org", status: "ACTIVE" }]; } },
    qRCode: { async findMany(input: unknown) { queries.push({ model: "qr", input }); return [qr]; } },
    productVersion: { async findUnique(input: unknown) { queries.push({ model: "version", input }); return { id: "version", productId: "product", organizationId: "org", status: "PUBLISHED", sourceLocale: "hr" }; } },
  } as unknown as Prisma.TransactionClient;
  const persistence = new PrismaProductQrPersistence();
  const row = await persistence.readProduct(tx, "product", "org", "ACTIVATE");
  assert.equal(row?.passports[0].qrCodes[0], qr);
  assert.equal(sql.length, 4);
  assert.match(sql[0].text, /Product.*organizationId.*FOR UPDATE/);
  assert.deepEqual(sql[0].values, ["product", "org"]);
  assert.match(sql[1].text, /Passport.*FOR SHARE/);
  assert.deepEqual(sql[1].values, ["product"]);
  assert.match(sql[2].text, /QRCode.*FOR UPDATE/);
  assert.deepEqual(sql[2].values, ["passport"]);
  assert.match(sql[3].text, /ProductVersion.*FOR SHARE/);
  assert.deepEqual(sql[3].values, ["version", "product", "org"]);
  assert.deepEqual((queries[0].input as { where: unknown }).where, { id: "product", organizationId: "org" });
  assert.equal((queries[1].input as { take: number }).take, 2);
  assert.equal((queries[2].input as { take: number }).take, 2);
  sql.length = 0;
  await persistence.readProduct(tx, "product", "org", "READ");
  assert.equal(sql.length, 0);
});
