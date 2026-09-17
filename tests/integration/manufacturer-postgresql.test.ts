import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createTestPrismaClient, requireSafeTestDatabaseConfig } from "../helpers/test-database";
import { createManufacturerServices } from "../../src/application/products/manufacturer/service";
import { createPrismaManufacturerDependencies } from "../../src/infrastructure/persistence/prisma/prisma-manufacturer";
import { createPublishProductService } from "../../src/application/products/publish-product/publish-product";
import { createPrismaPublishProductDependencies } from "../../src/infrastructure/persistence/prisma/prisma-publish-product-composition";
import { createDraftFromPublishedService } from "../../src/application/products/create-draft-from-published/service";
import { createPrismaCreateDraftFromPublishedDependencies } from "../../src/infrastructure/persistence/prisma/prisma-create-draft-from-published";
import { createGetPublicDppService } from "../../src/application/public-dpp/get-public-dpp";
import { PrismaPublicDppPersistence } from "../../src/infrastructure/persistence/prisma/prisma-public-dpp";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
const prisma = createTestPrismaClient(requireSafeTestDatabaseConfig(process.env));
test.after(()=>prisma.$disconnect());
const services = createManufacturerServices(createPrismaManufacturerDependencies(prisma));
const publish = createPublishProductService({ ...createPrismaPublishProductDependencies(prisma), canonicalOrigin:"https://app.invalid", now:()=>new Date(), generateQrCode:()=>randomUUID().toUpperCase() });
const clone = createDraftFromPublishedService(createPrismaCreateDraftFromPublishedDependencies(prisma));
const read = createGetPublicDppService({ persistence:new PrismaPublicDppPersistence(prisma) });
const values = { name:"Synthetic Manufacturer", addressLine1:"Test Street 1", addressLine2:null, city:"Zagreb", region:null, postalCode:"10000", countryCode:"HR", publicEmail:"public@example.invalid", website:"https://example.invalid" };
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
async function directory(f:Fixture) { const {expectedProductUpdatedAt}=await evidence(f);await services.mutate(f.id,{operation:"CREATE",expectedProductUpdatedAt,values},f.context);return (await services.get(f.id,f.context)).operators[0]; }
async function apply(f:Fixture, operator:Awaited<ReturnType<typeof directory>>) { await services.mutate(f.id,{operation:"APPLY",...await evidence(f),operatorId:operator.id,expectedOperatorUpdatedAt:operator.updatedAt},f.context); }
async function publication(f:Fixture) { const p=await prisma.product.findUniqueOrThrow({where:{id:f.id}});await publish({productId:f.id,...await evidence(f),expectedDraftVersionId:p.currentDraftVersionId!,expectedDraftUpdatedAt:(await prisma.productVersion.findUniqueOrThrow({where:{id:p.currentDraftVersionId!}})).updatedAt.toISOString(),expectedCurrentPublishedVersionId:p.currentPublishedVersionId},f.context); }
async function publicValue(f:Fixture) {const result=await read({publicCode:f.code,requestedLocale:"hr",acceptLanguage:null});assert.equal(result.kind,"PUBLIC");if(result.kind!=="PUBLIC")throw new Error();return result.dpp;}
async function snapshot(f:Fixture) {return {state:await services.get(f.id,f.context),audit:await prisma.auditLog.findMany({where:{organizationId:f.context.organizationId},orderBy:{id:"asc"}})};}
test("create/select, public allowlist, operator edit, historical copy and explicit refresh/republish",async()=>{
 const f=await fixture(),o=await directory(f);assert.equal((await services.get(f.id,f.context)).draft?.snapshot,null);
 await apply(f,o);await publication(f);assert.deepEqual((await publicValue(f)).manufacturer,values);
 const historical=await prisma.productVersionManufacturer.findUniqueOrThrow({where:{productVersionId:f.draftId}});
 const p1=await prisma.product.findUniqueOrThrow({where:{id:f.id},include:{passport:true}});
 const {expectedProductUpdatedAt}=await evidence(f);await services.mutate(f.id,{operation:"UPDATE",expectedProductUpdatedAt,operatorId:o.id,expectedOperatorUpdatedAt:o.updatedAt,values:{...values,city:"Split"}},f.context);
 assert.deepEqual((await publicValue(f)).manufacturer,values);
 const p=await prisma.product.findUniqueOrThrow({where:{id:f.id}});await clone({productId:f.id,expectedCurrentPublishedVersionId:p.currentPublishedVersionId!,expectedProductUpdatedAt:p.updatedAt.toISOString()},f.context);
 const state=await services.get(f.id,f.context);assert.equal(state.draft?.snapshot?.city,"Zagreb");assert.equal(state.draft?.operatorId,o.id);
 await apply(f,state.operators[0]);await publication(f);assert.equal((await publicValue(f)).manufacturer?.city,"Split");
 assert.deepEqual(await prisma.productVersionManufacturer.findUniqueOrThrow({where:{productVersionId:f.draftId}}),historical);
 const p2=await prisma.product.findUniqueOrThrow({where:{id:f.id},include:{passport:true}});assert.equal(p2.publicCode,p1.publicCode);assert.equal(p2.passport?.id,p1.passport?.id);
 assert.deepEqual(Object.keys((await publicValue(f)).manufacturer!).sort(),Object.keys(values).sort());
});
test("no manufacturer remains publishable; remove affects draft only",async()=>{
 const f=await fixture();await publication(f);assert.equal((await publicValue(f)).manufacturer,null);
 const p=await prisma.product.findUniqueOrThrow({where:{id:f.id}});await clone({productId:f.id,expectedCurrentPublishedVersionId:p.currentPublishedVersionId!,expectedProductUpdatedAt:p.updatedAt.toISOString()},f.context);
 await apply(f,await directory(f));await services.mutate(f.id,{operation:"REMOVE",...await evidence(f)},f.context);assert.equal((await services.get(f.id,f.context)).draft?.snapshot,null);
});
test("cross-tenant product/operator and composite foreign keys reject without writes",async()=>{
 const f=await fixture(),g=await fixture(),o=await directory(g),before=await snapshot(f);
 await assert.rejects(services.mutate(f.id,{operation:"APPLY",...await evidence(f),operatorId:o.id,expectedOperatorUpdatedAt:o.updatedAt},f.context));
 await assert.rejects(services.mutate(f.id,{operation:"CREATE",expectedProductUpdatedAt:before.state.updatedAt,values},g.context));
 await assert.rejects(prisma.productVersionManufacturer.create({data:{productVersionId:f.draftId,organizationId:f.context.organizationId,economicOperatorId:o.id,...values}}));
 assert.deepEqual(await snapshot(f),before);
});
for(const kind of ["permission","membership","organization"] as const)test(`revalidates ${kind}`,async()=>{
 const f=await fixture(),e=await evidence(f);const audits=await prisma.auditLog.count({where:{organizationId:f.context.organizationId}});
 if(kind==="permission")await prisma.membership.update({where:{id:f.context.membershipId},data:{role:"VIEWER"}});
 if(kind==="membership")await prisma.membership.update({where:{id:f.context.membershipId},data:{status:"SUSPENDED"}});
 if(kind==="organization")await prisma.organization.update({where:{id:f.context.organizationId},data:{status:"SUSPENDED"}});
 await assert.rejects(services.mutate(f.id,{operation:"CREATE",expectedProductUpdatedAt:e.expectedProductUpdatedAt,values},f.context));
 assert.equal(await prisma.economicOperator.count({where:{organizationId:f.context.organizationId}}),0);assert.equal(await prisma.auditLog.count({where:{organizationId:f.context.organizationId}}),audits);
});
test("concurrent CAS, stale operator and audit failure roll back atomically",async()=>{
 const f=await fixture(),o=await directory(f),cmd={operation:"APPLY",...await evidence(f),operatorId:o.id,expectedOperatorUpdatedAt:o.updatedAt};
 const results=await Promise.allSettled([services.mutate(f.id,cmd,f.context),services.mutate(f.id,cmd,f.context)]);assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
 const before=await snapshot(f);await assert.rejects(services.mutate(f.id,{...cmd,...await evidence(f),expectedOperatorUpdatedAt:new Date(0).toISOString()},f.context));assert.deepEqual(await snapshot(f),before);
 const deps=createPrismaManufacturerDependencies(prisma),original=deps.persistence.write.bind(deps.persistence);deps.persistence.write=async(...args)=>{await original(...args);throw new Error("simulated audit/transaction failure");};
 await assert.rejects(createManufacturerServices(deps).mutate(f.id,{operation:"REMOVE",...await evidence(f)},f.context));assert.deepEqual(await snapshot(f),before);
});
test("shared operator edits leave another product snapshot unchanged",async()=>{
 const f=await fixture(),o=await directory(f);await apply(f,o);
 const other=await prisma.product.create({data:{organizationId:f.context.organizationId,internalName:"Second",publicCode:randomUUID().replaceAll("-","").slice(0,22)}});
 const v=await prisma.productVersion.create({data:{productId:other.id,organizationId:f.context.organizationId,sourceLocale:"hr",translations:{create:{locale:"hr",productName:"Second"}}}});await prisma.product.update({where:{id:other.id},data:{currentDraftVersionId:v.id}});
 const g={...f,id:other.id,draftId:v.id,code:other.publicCode};await apply(g,o);await publication(g);
 const before=await publicValue(g);const {expectedProductUpdatedAt}=await evidence(f);await services.mutate(f.id,{operation:"UPDATE",expectedProductUpdatedAt,operatorId:o.id,expectedOperatorUpdatedAt:o.updatedAt,values:{...values,name:"Changed"}},f.context);assert.deepEqual(await publicValue(g),before);assert.equal((await services.get(f.id,f.context)).draft?.snapshot?.name,values.name);
});
