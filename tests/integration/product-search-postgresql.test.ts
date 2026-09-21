import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { requireSafeTestDatabaseConfig } from "../helpers/test-database";
import { PrismaListProductsPersistence } from "../../src/infrastructure/persistence/prisma/prisma-list-products";
import { createListProductsService } from "../../src/application/products/list-products/list-products";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
const config = requireSafeTestDatabaseConfig(process.env);
const pool = new Pool({ connectionString: config.url });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: config.url }), log: [{ emit: "event", level: "query" }] });
const queries: { query: string; params: string }[] = [];
prisma.$on("query", event => queries.push({ query: event.query, params: event.params }));
const list = createListProductsService({ persistence: new PrismaListProductsPersistence(prisma) });
test.after(async () => { await prisma.$disconnect(); await pool.end(); });

test("6000-product multi-tenant catalog: literal text, current GTIN, stable pagination and actual query plans", async () => {
  const org = await prisma.organization.create({ data: { displayName: "Search pilot" } });
  const other = await prisma.organization.create({ data: { displayName: "Other search tenant" } });
  const context: AuthenticatedUserContext = { organizationId: org.id, userId: randomUUID(), membershipId: randomUUID(), membershipRole: "VIEWER", membershipStatus: "ACTIVE", permissions: ["PRODUCT_READ"], correlationId: randomUUID() };
  const products = Array.from({ length: 6000 }, (_, i) => ({ id: randomUUID(), organizationId: i < 5000 ? org.id : other.id, internalName: `Pilot ${i % 5 === 0 ? "Chair" : "Component"} ${i}`, sku: `CAT-${String(i).padStart(6, "0")}`, publicCode: randomUUID(), updatedAt: new Date(1750000000000 + Math.floor(i / 3) * 1000) }));
  for (let start = 0; start < products.length; start += 500) await prisma.product.createMany({ data: products.slice(start, start + 500) });
  // Realistic current-version fanout; only sparse identifiers share the searched GTIN.
  const versions = products.map(p => ({ id: randomUUID(), productId: p.id, organizationId: p.organizationId, sourceLocale: "hr", status: "DRAFT" as const }));
  for (let start = 0; start < versions.length; start += 500) await prisma.productVersion.createMany({ data: versions.slice(start, start + 500) });
  await pool.query('UPDATE "Product" p SET "currentDraftVersionId"=v.id FROM "ProductVersion" v WHERE v."productId"=p.id');
  function gtin(n: number) { const body = String(100000000000 + n); let sum = 0; for (let i = 11, w = 3; i >= 0; i--, w = 4-w) sum += Number(body[i])*w; return body + String((10-sum%10)%10); }
  for (let start = 0; start < versions.length; start += 500) await prisma.productIdentifier.createMany({ data: versions.slice(start, start+500).map((v,i) => ({ productVersionId: v.id, type: "GTIN" as const, value: gtin(start+i) })) });
  const target = products[0]!;
  await prisma.product.update({ where: { id: target.id }, data: { internalName: "Literal 50%_\\ Pilot CHAIR", sku: "Mixed-Sku-Needle" } });
  await prisma.productIdentifier.updateMany({ where: { productVersionId: versions[0]!.id }, data: { value: "012345000058" } });
  const published = await prisma.productVersion.create({ data: { productId: target.id, organizationId: org.id, sourceLocale: "hr", status: "PUBLISHED", versionNumber: 1, publishedAt: new Date(), identifiers: { create: { type: "GTIN", value: "00012345000058" } } } });
  await prisma.product.update({ where: { id: target.id }, data: { currentPublishedVersionId: published.id } });
  await prisma.productVersion.create({ data: { productId: target.id, organizationId: org.id, sourceLocale: "hr", status: "SUPERSEDED", versionNumber: 2, publishedAt: new Date(), supersededAt: new Date(), identifiers: { create: { type: "GTIN", value: "6291041500213" } } } });
  await prisma.productVersion.create({ data: { productId: target.id, organizationId: org.id, sourceLocale: "hr", status: "DISCARDED", identifiers: { create: { type: "GTIN", value: "96385074" } } } });
  await prisma.productIdentifier.updateMany({ where: { productVersionId: versions[5000]!.id }, data: { value: "012345000058" } });
  await pool.query('ANALYZE "Product"; ANALYZE "ProductVersion"; ANALYZE "ProductIdentifier"');
  for (const search of ["50%_\\", "mixed-sKU-needLE", " 012345000058 ", "00012345000058"]) assert.deepEqual((await list({ search },context)).items.map(p=>p.productId),[target.id]);
  for (const search of ["6291041500213", "96385074", "CAT-005000", "no-such-result"]) assert.equal((await list({ search },context)).items.length,0);
  assert.equal((await list({search:"012345000058"},{...context,organizationId:other.id})).items[0]?.productId,products[5000]!.id);
  assert.equal((await list({search:"   "},context)).items.length,25);
  const seen = new Set<string>(); let cursor: string|null = null;
  for (let page=0; page<3; page++) { const result=await list({search:"chair",cursor},context); assert.equal(result.items.length,25); for(const row of result.items){assert.ok(!seen.has(row.productId));seen.add(row.productId);}cursor=result.nextCursor;assert.ok(cursor); }
  await assert.rejects(list({ search:"component",cursor },context));
  await assert.rejects(list({ search:"chair",cursor:"not-valid" },context));
  // Published-only match must survive a different current draft GTIN.
  await prisma.productIdentifier.updateMany({where:{productVersionId:versions[0]!.id},data:{value:"4006381333931"}});
  for(const search of ["012345000058","4006381333931"])assert.deepEqual((await list({search},context)).items.map(p=>p.productId),[target.id]);
  const plans=[];
  for(const [name,search,after] of [["name","chair",null],["sku","CAT-000123",null],["gtin","00012345000058",null],["no-results","zz-no-result",null],["next-page","chair",cursor]] as const){
    queries.length=0;await list({search,cursor:after},context);
    const query=queries.find(q=>q.query.includes('FROM "public"."Product"'));assert.ok(query);
    const plan=await pool.query('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+query.query,JSON.parse(query.params));
    plans.push({name,query:query.query,parameters:JSON.parse(query.params),plan:plan.rows[0]["QUERY PLAN"]});
  }
  if(process.env.SEARCH_PLAN_OUTPUT)writeFileSync(process.env.SEARCH_PLAN_OUTPUT,JSON.stringify(plans,null,2));
  console.log(JSON.stringify(plans.map(p=>({name:p.name,executionMs:p.plan[0]["Execution Time"]}))));
});
