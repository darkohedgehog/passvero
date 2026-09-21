import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { CatalogExportError, MAX_EXPORT_BYTES, type CatalogRecord } from "../../src/application/products/export-catalog/contracts";
import { createCatalogCsv, csvCell, CATALOG_CSV_COLUMNS } from "../../src/application/products/export-catalog/csv";
import { createExportCatalog } from "../../src/application/products/export-catalog/export-catalog";
import { createCatalogExportHandler } from "../../src/application/products/export-catalog/http";

const context: AuthenticatedUserContext = { organizationId: "org", userId: "user", membershipId: "member", membershipRole: "VIEWER", membershipStatus: "ACTIVE", permissions: ["PRODUCT_READ"], correlationId: "csv-test" };
const record: CatalogRecord = { id: "product", organizationId: "org", internalName: 'Živić, "stolica"\nred', sku: "00012", lifecycleStatus: "ACTIVE", updatedAt: new Date("2026-09-21T00:00:00Z"), currentDraftVersion: null, currentPublishedVersion: null };
function parse(bytes: Uint8Array): string[][] {
  const result = spawnSync("python3", ["-c", 'import sys,csv,json,io; print(json.dumps(list(csv.reader(io.TextIOWrapper(sys.stdin.buffer,encoding="utf-8-sig",newline="")))))'], { input: bytes, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout) as string[][];
}
const service = (rows: readonly CatalogRecord[]) => createExportCatalog({ async readSnapshot(org, search, consume) { assert.equal(org, "org"); assert.equal(typeof search, "string"); consume(rows); } });
const code = (expected: string) => (error: unknown) => error instanceof CatalogExportError && error.code === expected;

test("independent Python CSV parser: BOM, CRLF, stable columns, diacritics, quotes, multiline, zeroes and nulls", async () => {
  const bytes = await service([record])(undefined, context);
  assert.deepEqual([...bytes.slice(0, 3)], [239, 187, 191]);
  const rows = parse(bytes);
  assert.deepEqual(rows[0], CATALOG_CSV_COLUMNS);
  assert.equal(rows[1]!.length, 14);
  assert.deepEqual(rows[1]!.slice(0, 3), [record.id, record.internalName, "00012"]);
  assert.deepEqual(rows[1]!.slice(4, 12), Array(8).fill(""));
  assert.equal(rows[1]![12], "2026-09-21T00:00:00.000Z");
  assert.ok(Buffer.from(bytes).toString().endsWith("\r\n"));
  assert.equal(parse(await service([])("", context)).length, 1);
});
test("formula/control prefixes are protected as cell data; separator injection cannot add columns", () => {
  for (const value of ["=1+1", "+cmd", "-1", "@SUM(A1)", "\t=1", "\r=1", "\n=1", "\x7f=1", "  =1", " \x01=1", "\ufeff=1", "\u200b=1", "＝1", "＋1", "－1", "＠1"]) {
    const csv = createCatalogCsv(); csv.append([value, ...Array<string>(13).fill("")]);
    const rows = parse(csv.finish()); assert.equal(rows[1]![0], "'" + value); assert.equal(rows[1]!.length, 14);
  }
  assert.equal(csvCell("\0=1"), '"\'\0=1"');
  assert.equal(csvCell("000012"), '"000012"');
  const csv = createCatalogCsv(); csv.append(['safe",=1', ...Array<string>(13).fill("")]);
  assert.equal(parse(csv.finish())[1]![0], 'safe",=1');
});
test("version choice is wholly draft, then published, with snapshot manufacturer and identifier strings", async () => {
  const published = { organizationId: "org", productId: "product", versionNumber: 1, status: "PUBLISHED", sourceLocale: "en", updatedAt: record.updatedAt, identifiers: [{ type: "GTIN", value: "00012345000058", nomenclatureYear: null }, { type: "CN", value: "01012100", nomenclatureYear: 2026 }], manufacturer: { organizationId: "org", name: "Snapshot", countryCode: "HR" } };
  const draft = { ...published, versionNumber: null, status: "DRAFT", sourceLocale: "hr", identifiers: [], manufacturer: null };
  const rows = parse(await service([{ ...record, currentPublishedVersion: published }, { ...record, currentDraftVersion: draft, currentPublishedVersion: published }])("", context));
  assert.deepEqual(rows[1]!.slice(4, 12), ["1", "PUBLISHED", "en", "00012345000058", "01012100", "2026", "Snapshot", "HR"]);
  assert.deepEqual(rows[2]!.slice(4, 12), ["", "DRAFT", "hr", "", "", "", "", ""]);
  await assert.rejects(service([{ ...record, currentDraftVersion: { ...draft, identifiers: [published.identifiers[0]!, published.identifiers[0]!] } }])("", context), code("FAILED"));
  await assert.rejects(service([{ ...record, currentDraftVersion: { ...draft, organizationId: "other" } }])("", context), code("FAILED"));
});
test("read permission only; rejects anonymous, inactive, missing permission and cross-tenant rows", async () => {
  for (const actor of [null, { ...context, membershipStatus: "SUSPENDED" as const }, { ...context, permissions: [] }]) await assert.rejects(service([])("", actor), code("FORBIDDEN"));
  await assert.rejects(service([{ ...record, organizationId: "other" }])("", context), code("FAILED"));
  for (const search of ["a".repeat(201), "\0", ["a", "b"]]) await assert.rejects(service([])(search, context), code("INVALID_SEARCH"));
});
test("10000 rows allowed, 10001 rejected; final UTF-8 byte budget includes escaping and never truncates", async () => {
  assert.equal(parse(await service(Array<CatalogRecord>(10000).fill(record))("", context)).length, 10001);
  await assert.rejects(service(Array<CatalogRecord>(10001).fill(record))("", context), code("LIMIT"));
  const csv = createCatalogCsv();
  const base = csv.finish().byteLength;
  // 14 quoted cells (28 bytes), 13 commas, CRLF = 43 bytes overhead.
  csv.append(["x".repeat(MAX_EXPORT_BYTES - base - 43), ...Array<string>(13).fill("")]);
  assert.equal(csv.finish().byteLength, MAX_EXPORT_BYTES);
  assert.throws(() => csv.append(Array<string>(14).fill("")), code("LIMIT"));
  const doubled = createCatalogCsv();
  assert.throws(() => doubled.append(['"'.repeat(MAX_EXPORT_BYTES / 2), ...Array<string>(13).fill("")]), code("LIMIT"));
});
test("HTTP: full response only, safe headers/filename, cursor ignored, errors never attachment", async () => {
  let seen: unknown;
  const handler = createCatalogExportHandler({ async resolveContext() { return { status: "RESOLVED", context, presentation: { organizationName: "Org" } }; }, async exportCatalog(search, actor) { seen = search; return service([record])(search, actor); } });
  const response = await handler(new Request("https://example.test/api/products/export?q=chair&cursor=irrelevant"));
  assert.equal(response.status, 200); assert.equal(seen, "chair");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("content-disposition"), 'attachment; filename="passvero-catalog-v1.csv"');
  assert.equal(parse(new Uint8Array(await response.arrayBuffer())).length, 2);
  for (const suffix of ["?q=a&q=b", "?organizationId=other"]) {
    const failed = await handler(new Request("https://example.test/api/products/export" + suffix));
    assert.equal(failed.status, 400); assert.equal(failed.headers.get("content-disposition"), null);
  }
  const failure = createCatalogExportHandler({ async resolveContext() { return { status: "RESOLVED", context, presentation: { organizationName: "Org" } }; }, exportCatalog: createExportCatalog({ async readSnapshot(_org, _q, consume) { consume([record]); throw new Error("private DB failure"); } }) });
  const failed = await failure(new Request("https://example.test"));
  assert.equal(failed.status, 500); assert.equal(failed.headers.get("content-disposition"), null); assert.deepEqual(await failed.json(), { code: "FAILED" });
  const denied = createCatalogExportHandler({ async resolveContext() { return { status: "DENIED", reason: "NO_PROVIDER_SESSION" }; }, exportCatalog: service([]) });
  assert.equal((await denied(new Request("https://example.test"))).status, 403);
});

test("HTTP deadline rejects a stalled context without starting a late export", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let resolveContext!: (value: { status: "RESOLVED"; context: AuthenticatedUserContext; presentation: { organizationName: string } }) => void;
  let exports = 0;
  const handler = createCatalogExportHandler({ resolveContext: () => new Promise(resolve => { resolveContext = resolve; }), async exportCatalog() { exports++; return new Uint8Array(); } });
  const request = handler(new Request("https://example.test"));
  t.mock.timers.tick(25_000);
  const response = await request;
  assert.equal(response.status, 422); assert.equal(response.headers.get("content-disposition"), null);
  resolveContext({ status: "RESOLVED", context, presentation: { organizationName: "Org" } });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(exports, 0);
});
