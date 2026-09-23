import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID, randomBytes } from "node:crypto";
import { createTestPrismaClient, requireSafeTestDatabaseConfig } from "../helpers/test-database";
import { PrismaListDpp } from "../../src/infrastructure/persistence/prisma/prisma-list-dpp";
import { createListDpp } from "../../src/application/dashboard/list-dpp";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
const db=createTestPrismaClient(requireSafeTestDatabaseConfig(process.env));
test.after(()=>db.$disconnect());
test("published snapshot and image, current pointer, tenant scope, public availability and bounded pages",async()=>{
 const org=await db.organization.create({data:{displayName:"DPP proof",status:"ACTIVE"}});
 const other=await db.organization.create({data:{displayName:"Other DPP",status:"ACTIVE"}});
 const context:AuthenticatedUserContext={userId:randomUUID(),organizationId:org.id,membershipId:randomUUID(),membershipRole:"VIEWER",membershipStatus:"ACTIVE",permissions:["PRODUCT_READ"],correlationId:randomUUID()};
 const read=createListDpp(new PrismaListDpp(db));
 assert.deepEqual(await read(null,"hr",context),{items:[],nextCursor:null});
 const publishedAt=new Date('2026-09-23T10:00:00Z');let snapshotId="",imageId="",archivedId="",withdrawnId="",draftOnlyId="";
 for(let i=0;i<29;i++){
  const organizationId=i===28?other.id:org.id;
  const p=await db.product.create({data:{organizationId,internalName:'Draft identity',sku:`DPP-${i}`,publicCode:randomBytes(16).toString('base64url'),lifecycleStatus:i===2?"ARCHIVED":"ACTIVE"}});
  const v=await db.productVersion.create({data:{organizationId,productId:p.id,status:"PUBLISHED",sourceLocale:"hr",versionNumber:1,publishedAt,translations:{create:{locale:"hr",productName:`Published ${i}`}}}});
  await db.passport.create({data:{organizationId,productId:p.id,status:i===3?"WITHDRAWN":"ACTIVE",firstPublishedAt:publishedAt,lastPublishedAt:publishedAt,defaultLocale:"hr"}});
  await db.product.update({where:{id:p.id},data:{currentPublishedVersionId:i===27?null:v.id,lastPublishedAt:publishedAt}});
  if(i===0 || i===27){
   const draft=await db.productVersion.create({data:{organizationId,productId:p.id,status:"DRAFT",sourceLocale:"hr",translations:{create:{locale:"hr",productName:"SECRET NEW DRAFT"}}}});
   await db.product.update({where:{id:p.id},data:{currentDraftVersionId:draft.id}});
   if(i===0){snapshotId=p.id;
    for(const [versionId,suffix] of [[v.id,'published'],[draft.id,'draft']] as const){
     const asset=await db.productImageAsset.create({data:{organizationId,originalFilename:"proof.png",storageProvider:"supabase",storageBucket:"passvero-staging-images",storageKey:`proof/${randomUUID()}.png`,mimeType:"image/png",sizeBytes:100,checksumSha256:'a'.repeat(64),width:20,height:10,state:"READY",policyVersion:1,uploadedAt:publishedAt}});
     const image=await db.productImage.create({data:{productVersionId:versionId,assetId:asset.id,isPrimary:true}});
     if(suffix==='published')imageId=image.id;
    }
   }else draftOnlyId=p.id;
  }
  if(i===2)archivedId=p.id;if(i===3)withdrawnId=p.id;
 }
 const first=await read(null,"hr",context);assert.equal(first.items.length,25);assert.ok(first.nextCursor);
 const second=await read(first.nextCursor,"hr",context);assert.equal(second.items.length,2);assert.equal(second.nextCursor,null);
 const all=[...first.items,...second.items];assert.equal(new Set(all.map(r=>r.productId)).size,27);
 assert.ok(all.every(r=>r.organizationId===org.id && !r.name?.includes('DRAFT')));assert.ok(!all.some(r=>r.productId===draftOnlyId));
 const snapshot=all.find(r=>r.productId===snapshotId)!;assert.equal(snapshot.name,'Published 0');assert.equal(snapshot.imageId,imageId);assert.ok(snapshot.publicHref?.startsWith('/p/'));
 assert.equal(all.find(r=>r.productId===archivedId)?.publicHref,null);assert.equal(all.find(r=>r.productId===withdrawnId)?.publicHref,null);
 assert.equal((await read(null,'de',{...context,organizationId:other.id})).items.length,1);
 await db.organization.update({where:{id:org.id},data:{status:"SUSPENDED"}});
 assert.ok((await read(null,'hr',context)).items.every(r=>r.publicHref===null));
});
