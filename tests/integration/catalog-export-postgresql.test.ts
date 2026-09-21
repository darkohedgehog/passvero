import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { requireSafeTestDatabaseConfig } from "../helpers/test-database";
import { PrismaExportCatalogPersistence } from "../../src/infrastructure/persistence/prisma/prisma-export-catalog";
import { createExportCatalog } from "../../src/application/products/export-catalog/export-catalog";
import { CatalogExportError } from "../../src/application/products/export-catalog/contracts";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
const config = requireSafeTestDatabaseConfig(process.env);
const pool = new Pool({ connectionString: config.url });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: config.url }) });
const persistence = new PrismaExportCatalogPersistence(prisma);
const exportCatalog = createExportCatalog(persistence);
test.after(async () => { await prisma.$disconnect(); await pool.end(); });
function parse(bytes: Uint8Array): string[][] {
  const result = spawnSync("python3", ["-c", 'import sys,csv,json,io; print(json.dumps(list(csv.reader(io.TextIOWrapper(sys.stdin.buffer,encoding="utf-8-sig",newline="")))))'], { input: bytes, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout) as string[][];
}

test("5000-product CSV: all pages, tenants, current-version selection, repeatable snapshot and bounded export", async () => {
  const org = await prisma.organization.create({ data: { displayName: "CSV pilot" } });
  const other = await prisma.organization.create({ data: { displayName: "Other CSV tenant" } });
  const context: AuthenticatedUserContext = { organizationId: org.id, userId: randomUUID(), membershipId: randomUUID(), membershipRole: "VIEWER", membershipStatus: "ACTIVE", permissions: ["PRODUCT_READ"], correlationId: randomUUID() };
  const products = Array.from({ length: 5001 }, (_, i) => ({ id: randomUUID(), organizationId: i < 5000 ? org.id : other.id, internalName: `CSV ${i % 5 === 0 ? "Chair" : "Component"} ${i}`, sku: String(i).padStart(8, "0"), publicCode: randomUUID(), updatedAt: new Date(1750000000000 + i * 1000) }));
  for (let start = 0; start < products.length; start += 500) await prisma.product.createMany({ data: products.slice(start, start + 500) });
  const versions = products.map(p => ({ id: randomUUID(), productId: p.id, organizationId: p.organizationId, sourceLocale: "hr", status: "DRAFT" as const }));
  for (let start = 0; start < versions.length; start += 500) await prisma.productVersion.createMany({ data: versions.slice(start, start + 500) });
  await pool.query('UPDATE "Product" p SET "currentDraftVersionId"=v.id FROM "ProductVersion" v WHERE v."productId"=p.id');
  const target = products[0]!;
  await prisma.productIdentifier.createMany({ data: [
    { productVersionId: versions[0]!.id, type: "GTIN", value: "012345000058" },
    { productVersionId: versions[5000]!.id, type: "GTIN", value: "012345000058" },
    { productVersionId: versions[0]!.id, type: "CN", value: "01012100", nomenclatureYear: 2026 },
  ] });
  const published = await prisma.productVersion.create({ data: { productId: target.id, organizationId: org.id, sourceLocale: "en", status: "PUBLISHED", versionNumber: 1, publishedAt: new Date(), identifiers: { create: { type: "GTIN", value: "6291041500213" } } } });
  await prisma.product.update({ where: { id: target.id }, data: { currentPublishedVersionId: published.id } });
  const rssBefore = process.memoryUsage().rss;
  let peak = rssBefore;
  const sample = setInterval(() => { peak = Math.max(peak, process.memoryUsage().rss); }, 5);
  const started = performance.now();
  let bytes: Uint8Array;
  try { bytes = await exportCatalog("", context); } finally { clearInterval(sample); }
  peak = Math.max(peak, process.memoryUsage().rss);
  const durationMs = performance.now() - started;
  const rows = parse(bytes);
  assert.equal(rows.length, 5001); assert.equal(new Set(rows.slice(1).map(r => r[0])).size, 5000);
  assert.ok(rows.slice(1).every(r => r.length === 14 && r[0] !== products[5000]!.id));
  assert.ok(peak - rssBefore < 128 * 1024 * 1024, "5000-row incremental RSS exceeds local 128 MiB guard");
  assert.equal(parse(await exportCatalog("chair", context)).length, 1001);
  for (const q of ["012345000058", "00012345000058", "6291041500213"]) {
    const filtered = parse(await exportCatalog(q, context)); assert.equal(filtered.length, 2); assert.equal(filtered[1]![0], target.id);
    assert.deepEqual(filtered[1]!.slice(5, 10), ["DRAFT", "hr", "012345000058", "01012100", "2026"]);
  }
  assert.equal(parse(await exportCatalog("012345000058", { ...context, organizationId: other.id }))[1]![0], products[5000]!.id);
  assert.equal(parse(await exportCatalog("no-result", context)).length, 1);
  // A committed concurrent change after the first batch must not change later snapshot rows.
  let update: Promise<unknown> | undefined;
  let batch = 0;
  let oldNameSeen = false;
  await persistence.readSnapshot(org.id, "", async records => {
    batch++;
    if (batch === 1) { update = pool.query('UPDATE "Product" SET "internalName"=$1 WHERE id=$2', ["Concurrent rename", products[1]!.id]); await update; }
    for (const row of records) if (row.id === products[1]!.id) { assert.equal(row.internalName, products[1]!.internalName); oldNameSeen = true; }
  });
  await update; assert.ok(batch > 1 && oldNameSeen);
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: products[1]!.id } })).internalName, "Concurrent rename");
  // Restore base-only semantics for one product; then published-only and no-version fields.
  await prisma.product.update({ where: { id: target.id }, data: { currentDraftVersionId: null } });
  assert.equal(parse(await exportCatalog("6291041500213", context))[1]![7], "6291041500213");
  await prisma.product.update({ where: { id: target.id }, data: { currentPublishedVersionId: null } });
  assert.deepEqual(parse(await exportCatalog("00000000", context))[1]!.slice(4, 12), Array(8).fill(""));
  // DB-level row limit, not merely a mocked application boundary.
  const extra = Array.from({ length: 5001 }, (_, i) => ({ organizationId: org.id, internalName: `Extra ${i}`, publicCode: randomUUID() }));
  for (let start = 0; start < extra.length; start += 500) await prisma.product.createMany({ data: extra.slice(start, start + 500) });
  await assert.rejects(exportCatalog("", context), (e: unknown) => e instanceof CatalogExportError && e.code === "LIMIT");
  const result = { products: 5000, columns: 14, csvBytes: bytes.byteLength, durationMs, rssBefore, peakRss: peak, incrementalRss: peak - rssBefore, snapshot: "PASS", tenantIsolation: "PASS", allPages: "PASS", rowLimit: "PASS", productionAccess: false, limitation: "Single local disposable run; sampled process RSS, not production SLA or universal memory bound." };
  if (process.env.CSV_PROOF_OUTPUT) writeFileSync(process.env.CSV_PROOF_OUTPUT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
});
