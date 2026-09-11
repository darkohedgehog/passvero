import assert from "node:assert/strict";
import test from "node:test";
import { PrismaPublishProductPersistence } from "../../src/infrastructure/persistence/prisma/prisma-publish-product";
const persistence = new PrismaPublishProductPersistence({} as never);
for (const name of ["", " ", "a".repeat(201)]) test(`incomplete secondary name (${name.length}) blocks whole version`, async () => {
  const tx = { productTranslation: { findUnique: async()=>({productName:"Stolica"}), findMany: async()=>[{locale:"hr",productName:"Stolica"},{locale:"en",productName:name}] }, productDocument:{findFirst:async()=>null},productImage:{findFirst:async()=>null},productMaterial:{findMany:async()=>[]},productIdentifier:{findMany:async()=>[]} };
  const readiness = await persistence.readReadiness(tx as never,{productVersionId:"version",organizationId:"org",sourceLocale:"hr",currentUtcYear:2026});
  assert.equal(readiness.invalidTranslations,true);
});
