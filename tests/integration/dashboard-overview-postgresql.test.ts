import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createTestPrismaClient, requireSafeTestDatabaseConfig } from "../helpers/test-database";
import { PrismaDashboardOverview } from "../../src/infrastructure/persistence/prisma/prisma-dashboard-overview";
import { createDashboardOverview } from "../../src/application/dashboard/overview";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
const prisma=createTestPrismaClient(requireSafeTestDatabaseConfig(process.env));
test.after(()=>prisma.$disconnect());
test("full catalog counts, current pointers, archived/no-version cases, recent limit and independent tenant reads",async()=>{
 const org=await prisma.organization.create({data:{displayName:"Dashboard proof"}});
 const other=await prisma.organization.create({data:{displayName:"Other dashboard tenant"}});
 const vacant=await prisma.organization.create({data:{displayName:"Empty dashboard tenant"}});
 const context:AuthenticatedUserContext={organizationId:org.id,userId:randomUUID(),membershipId:randomUUID(),membershipRole:"VIEWER",membershipStatus:"ACTIVE",permissions:["PRODUCT_READ"],correlationId:randomUUID()};
 const read=createDashboardOverview(new PrismaDashboardOverview(prisma));
 let newest="";
 for(let i=0;i<32;i++){
  const organizationId=i===31?other.id:org.id;
  const p=await prisma.product.create({data:{organizationId,internalName:`Dashboard ${i}`,publicCode:randomUUID(),lifecycleStatus:i===30?"ARCHIVED":"ACTIVE"}});
  const draft=i<20 || i===31?await prisma.productVersion.create({data:{organizationId,productId:p.id,sourceLocale:"hr",status:i===0?"READY_FOR_REVIEW":"DRAFT"}}):null;
  const pub=i>=10 && i<30?await prisma.productVersion.create({data:{organizationId,productId:p.id,sourceLocale:"hr",status:"PUBLISHED",versionNumber:1,publishedAt:new Date()}}):null;
  await prisma.product.update({where:{id:p.id},data:{currentDraftVersionId:draft?.id,currentPublishedVersionId:pub?.id,updatedAt:new Date(1750000000000+i*1000)}});
  if(i===30)newest=p.id;
 }
 const data=await read(context);
 assert.deepEqual([data.total,data.draft,data.published,data.archived],[31,20,20,1]);
 assert.deepEqual(data.distribution,{draftOnly:10,publishedOnly:10,publishedWithDraft:10,withoutVersion:1});
 assert.equal(data.recent.length,5);assert.equal(data.recent[0]?.id,newest);assert.ok(data.recent.every(p=>p.organizationId===org.id));
 assert.equal((await read({...context,organizationId:other.id})).total,1);
 assert.equal((await read({...context,organizationId:vacant.id})).total,0);
 // A corrupt pointer must not count or expose another organization's version/image.
 const alien=await prisma.productVersion.findFirstOrThrow({where:{organizationId:other.id}});
 const own=await prisma.product.findFirstOrThrow({where:{organizationId:org.id,currentDraftVersionId:null}});
 const alienProduct=await prisma.product.findFirstOrThrow({where:{organizationId:other.id}});
 await prisma.product.update({where:{id:alienProduct.id},data:{currentDraftVersionId:null}});
 await prisma.product.update({where:{id:own.id},data:{currentDraftVersionId:alien.id}});
 await assert.rejects(read(context));
});
