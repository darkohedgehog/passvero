import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createTestPrismaClient, requireSafeTestDatabaseConfig } from "../helpers/test-database";
import { createGtinServices } from "../../src/application/products/gtin/service";
import { createPrismaGtinDependencies } from "../../src/infrastructure/persistence/prisma/prisma-gtin";
import { createPublishProductService } from "../../src/application/products/publish-product/publish-product";
import { createPrismaPublishProductDependencies } from "../../src/infrastructure/persistence/prisma/prisma-publish-product-composition";
import { createDraftFromPublishedService } from "../../src/application/products/create-draft-from-published/service";
import { createPrismaCreateDraftFromPublishedDependencies } from "../../src/infrastructure/persistence/prisma/prisma-create-draft-from-published";
import { createGetPublicDppService } from "../../src/application/public-dpp/get-public-dpp";
import { PrismaPublicDppPersistence } from "../../src/infrastructure/persistence/prisma/prisma-public-dpp";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
const prisma = createTestPrismaClient(requireSafeTestDatabaseConfig(process.env));
test.after(()=>prisma.$disconnect());
const services = createGtinServices(createPrismaGtinDependencies(prisma));
const publish = createPublishProductService({ ...createPrismaPublishProductDependencies(prisma), canonicalOrigin:"https://app.invalid", now:()=>new Date(), generateQrCode:()=>randomUUID().toUpperCase() });
const clone = createDraftFromPublishedService(createPrismaCreateDraftFromPublishedDependencies(prisma));
const read = createGetPublicDppService({ persistence:new PrismaPublicDppPersistence(prisma) });
async function fixture() {
  const user=await prisma.user.create({data:{email:`${randomUUID()}@test.invalid`}});
  const org=await prisma.organization.create({data:{displayName:"Tenant - not manufacturer"}});
  const member=await prisma.membership.create({data:{organizationId:org.id,userId:user.id,role:"ADMIN",status:"ACTIVE"}});
  const context:AuthenticatedUserContext={organizationId:org.id,userId:user.id,membershipId:member.id,membershipRole:"ADMIN",membershipStatus:"ACTIVE",permissions:["PRODUCT_READ","PRODUCT_EDIT","PRODUCT_PUBLISH"],correlationId:randomUUID()};
  const product=await prisma.product.create({data:{organizationId:org.id,internalName:"Proof",publicCode:randomUUID().replaceAll("-","").slice(0,22)}});
  const draft=await prisma.productVersion.create({data:{productId:product.id,organizationId:org.id,sourceLocale:"hr",translations:{create:{locale:"hr",productName:"Proof"}}}});
  await prisma.product.update({where:{id:product.id},data:{currentDraftVersionId:draft.id}});
  return {context,id:product.id,draftId:draft.id,code:product.publicCode};
}
type Fixture=Awaited<ReturnType<typeof fixture>>;
async function evidence(f:Fixture) { const state=await services.get(f.id,f.context);return {expectedProductUpdatedAt:state.updatedAt,...(state.draft?{expectedDraftVersionId:state.draft.id,expectedDraftUpdatedAt:state.draft.updatedAt}:{})}; }
async function publication(f:Fixture) { const p=await prisma.product.findUniqueOrThrow({where:{id:f.id}});await publish({productId:f.id,...await evidence(f),expectedDraftVersionId:p.currentDraftVersionId!,expectedDraftUpdatedAt:(await prisma.productVersion.findUniqueOrThrow({where:{id:p.currentDraftVersionId!}})).updatedAt.toISOString(),expectedCurrentPublishedVersionId:p.currentPublishedVersionId},f.context); }
async function publicValue(f:Fixture) {const result=await read({publicCode:f.code,requestedLocale:"hr",acceptLanguage:null});assert.equal(result.kind,"PUBLIC");if(result.kind!=="PUBLIC")throw new Error();return result.dpp;}
async function snapshot(f:Fixture) {return {state:await services.get(f.id,f.context),audit:await prisma.auditLog.findMany({where:{organizationId:f.context.organizationId},orderBy:{id:"asc"}})};}
const value = "012345000058";
async function set(f:Fixture, gtin=value) { return services.mutate(f.id,{operation:"SET",value:gtin,...await evidence(f)},f.context); }
test("draft GTIN publishes, clones, changes and republishes with immutable history and stable identity", async()=>{
 const f=await fixture(); await set(f); await publication(f);
 const historical=await prisma.productIdentifier.findMany({where:{productVersionId:f.draftId}});
 assert.equal((await publicValue(f)).gtin,value);
 const p=await prisma.product.findUniqueOrThrow({where:{id:f.id},include:{passport:true}});
 await assert.rejects(services.mutate(f.id,{operation:"SET",value:"6291041500213",expectedProductUpdatedAt:p.updatedAt.toISOString(),expectedDraftVersionId:f.draftId,expectedDraftUpdatedAt:new Date().toISOString()},f.context));
 await clone({productId:f.id,expectedCurrentPublishedVersionId:p.currentPublishedVersionId!,expectedProductUpdatedAt:p.updatedAt.toISOString()},f.context);
 assert.equal((await services.get(f.id,f.context)).draft?.gtin,value);
 await set(f,"6291041500213"); assert.equal((await publicValue(f)).gtin,value);
 await publication(f); assert.equal((await publicValue(f)).gtin,"6291041500213");
 assert.deepEqual(await prisma.productIdentifier.findMany({where:{productVersionId:f.draftId}}),historical);
 const p2=await prisma.product.findUniqueOrThrow({where:{id:f.id},include:{passport:true}});
 assert.equal(p2.publicCode,p.publicCode); assert.equal(p2.passport?.id,p.passport?.id);
});
test("invalid values, forged tenant and stale CAS cause no writes or audits",async()=>{
 const f=await fixture(),g=await fixture(),before=await snapshot(f),e=await evidence(f);
 for(const bad of ["012345000059"," 012345000058","1234","abc"]) await assert.rejects(services.mutate(f.id,{operation:"SET",value:bad,...e},f.context));
 await assert.rejects(services.mutate(f.id,{operation:"SET",value,...e},g.context));
 await assert.rejects(services.mutate(f.id,{operation:"SET",value,...e,expectedDraftVersionId:g.draftId},f.context));
 assert.deepEqual(await snapshot(f),before);
 await set(f); await assert.rejects(services.mutate(f.id,{operation:"REMOVE",...e},f.context));
});
for(const kind of ["permission","membership","organization"] as const)test(`revalidates ${kind}`,async()=>{
 const f=await fixture(),e=await evidence(f);
 if(kind==="permission") await prisma.membership.update({where:{id:f.context.membershipId},data:{role:"VIEWER"}});
 if(kind==="membership") await prisma.membership.update({where:{id:f.context.membershipId},data:{status:"SUSPENDED"}});
 if(kind==="organization") await prisma.organization.update({where:{id:f.context.organizationId},data:{status:"SUSPENDED"}});
 await assert.rejects(services.mutate(f.id,{operation:"SET",value,...e},f.context));
 assert.equal(await prisma.productIdentifier.count({where:{productVersionId:f.draftId}}),0);
 assert.equal(await prisma.auditLog.count({where:{organizationId:f.context.organizationId}}),0);
});
test("concurrent application writes admit one CAS winner; rollback retains data and audit",async()=>{
 const f=await fixture(),cmd={operation:"SET",value,...await evidence(f)};
 const results=await Promise.allSettled([services.mutate(f.id,cmd,f.context),services.mutate(f.id,{...cmd,value:"6291041500213"},f.context)]);
 assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
 assert.equal(await prisma.productIdentifier.count({where:{productVersionId:f.draftId,type:"GTIN"}}),1);
 const before=await snapshot(f),deps=createPrismaGtinDependencies(prisma),write=deps.persistence.write.bind(deps.persistence);
 deps.persistence.write=async(...args)=>{await write(...args);throw new Error("transaction failure");};
 await assert.rejects(createGtinServices(deps).mutate(f.id,{operation:"REMOVE",...await evidence(f)},f.context));
 assert.deepEqual(await snapshot(f),before);
});
test("database arbitrates direct concurrent inserts without limiting CUSTOM or historical/tenant copies",async()=>{
 const f=await fixture(),g=await fixture();
 const results=await Promise.allSettled([value,"6291041500213"].map(value=>prisma.productIdentifier.create({data:{productVersionId:f.draftId,type:"GTIN",value}})));
 assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
 await prisma.productIdentifier.create({data:{productVersionId:g.draftId,type:"GTIN",value}});
 await prisma.productIdentifier.createMany({data:["A","B"].map(value=>({productVersionId:f.draftId,type:"CUSTOM" as const,value}))});
 await prisma.productIdentifier.create({data:{productVersionId:f.draftId,type:"CN",value:"12345678",nomenclatureYear:2026}});
 await assert.rejects(prisma.productIdentifier.create({data:{productVersionId:f.draftId,type:"CN",value:"87654321",nomenclatureYear:2026}}));
 await set(f); await services.mutate(f.id,{operation:"REMOVE",...await evidence(f)},f.context);
 assert.equal(await prisma.productIdentifier.count({where:{productVersionId:f.draftId,type:"CN"}}),1);
 assert.equal(await prisma.productIdentifier.count({where:{productVersionId:f.draftId,type:"CUSTOM"}}),2);
});
test("equivalent representation replaces the same slot; source length preserved; optional removal publishes",async()=>{
 const f=await fixture(); await set(f); await set(f,"00012345000058");
 assert.equal((await services.get(f.id,f.context)).draft?.gtin,"00012345000058");
 assert.equal(await prisma.productIdentifier.count({where:{productVersionId:f.draftId,type:"GTIN"}}),1);
 await services.mutate(f.id,{operation:"REMOVE",...await evidence(f)},f.context); await publication(f);
 assert.equal((await publicValue(f)).gtin,null);
});
