import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import sharp from "sharp";
import { createTestPrismaClient, requireSafeTestDatabaseConfig } from "../helpers/test-database";
import { createImageServices } from "../../src/application/products/images/service";
import { PrismaProductImagePersistence } from "../../src/infrastructure/persistence/prisma/prisma-product-images";
import { normalizeProductImage } from "../../src/infrastructure/products/images/normalize";
import type { ImageStorage } from "../../src/application/products/images/contracts";
import { createPublishProductService } from "../../src/application/products/publish-product/publish-product";
import { createPrismaPublishProductDependencies } from "../../src/infrastructure/persistence/prisma/prisma-publish-product-composition";
import { createDraftFromPublishedService } from "../../src/application/products/create-draft-from-published/service";
import { createPrismaCreateDraftFromPublishedDependencies } from "../../src/infrastructure/persistence/prisma/prisma-create-draft-from-published";
import { createGetPublicDppService } from "../../src/application/public-dpp/get-public-dpp";
import { PrismaPublicDppPersistence } from "../../src/infrastructure/persistence/prisma/prisma-public-dpp";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
const prisma=createTestPrismaClient(requireSafeTestDatabaseConfig(process.env));test.after(()=>prisma.$disconnect());
const persistence=new PrismaProductImagePersistence(prisma);
const objects=new Map<string,Uint8Array>();let failPut=false;let afterRead:(()=>Promise<void>)|null=null;
const storage:ImageStorage={identity:(id,mime)=>({storageProvider:'proof',storageBucket:'private',storageKey:`${id}.${mime==='image/png'?'png':'jpg'}`}),
 async put(a,b){if(failPut)throw new Error('write failed');objects.set(a.id,b);}, async read(a){const result=objects.get(a.id);if(!result)throw new Error();if(afterRead){const action=afterRead;afterRead=null;await action();}return result;},async remove(a){objects.delete(a.id);}};
const services=createImageServices({persistence,storage,normalize:normalizeProductImage});
const publish=createPublishProductService({...createPrismaPublishProductDependencies(prisma),canonicalOrigin:'https://app.invalid',now:()=>new Date(),generateQrCode:()=>randomUUID().toUpperCase()});
const clone=createDraftFromPublishedService(createPrismaCreateDraftFromPublishedDependencies(prisma));
const read=createGetPublicDppService({persistence:new PrismaPublicDppPersistence(prisma)});
async function fixture(){
 const user=await prisma.user.create({data:{email:`${randomUUID()}@test.invalid`}});const org=await prisma.organization.create({data:{displayName:'Image proof'}});
 const member=await prisma.membership.create({data:{organizationId:org.id,userId:user.id,role:'ADMIN',status:'ACTIVE'}});
 const context:AuthenticatedUserContext={organizationId:org.id,userId:user.id,membershipId:member.id,membershipRole:'ADMIN',membershipStatus:'ACTIVE',permissions:['PRODUCT_READ','PRODUCT_EDIT','PRODUCT_PUBLISH'],correlationId:randomUUID()};
 const product=await prisma.product.create({data:{organizationId:org.id,internalName:'Image proof',publicCode:randomUUID().replaceAll('-','').slice(0,22)}});
 const version=await prisma.productVersion.create({data:{productId:product.id,organizationId:org.id,sourceLocale:'hr',translations:{create:{locale:'hr',productName:'Image proof'}}}});
 await prisma.product.update({where:{id:product.id},data:{currentDraftVersionId:version.id}});return {id:product.id,code:product.publicCode,context,versionId:version.id};
}
type Fixture=Awaited<ReturnType<typeof fixture>>;
async function command(f:Fixture,operation:'SET'|'REMOVE'='SET'){const s=await services.get(f.id,f.context);return {operation,expectedDraftVersionId:s.draft!.id,expectedProductUpdatedAt:s.updatedAt,expectedDraftUpdatedAt:s.draft!.updatedAt,...(operation==='SET'?{altText:'Test image'}:{})};}
async function bytes(color='red'){return sharp({create:{width:60,height:40,channels:3,background:color}}).png().toBuffer();}
async function upload(f:Fixture,color='red'){return services.mutate(f.id,await command(f),await bytes(color),f.context);}
async function publication(f:Fixture){const p=await prisma.product.findUniqueOrThrow({where:{id:f.id},include:{currentDraftVersion:true}});await publish({productId:f.id,expectedDraftVersionId:p.currentDraftVersionId!,expectedDraftUpdatedAt:p.currentDraftVersion!.updatedAt.toISOString(),expectedProductUpdatedAt:p.updatedAt.toISOString(),expectedCurrentPublishedVersionId:p.currentPublishedVersionId},f.context);}
async function cloning(f:Fixture){const p=await prisma.product.findUniqueOrThrow({where:{id:f.id}});return clone({productId:f.id,expectedCurrentPublishedVersionId:p.currentPublishedVersionId!,expectedProductUpdatedAt:p.updatedAt.toISOString()},f.context);}
test('upload preview publication clone replacement immutable history and stable public identity',async()=>{
 const f=await fixture();await upload(f);const a=(await services.get(f.id,f.context)).draft!.image!;
 assert((await services.download({productId:f.id,context:f.context},a.id)).bytes.length>0);
 await assert.rejects(services.download({publicCode:f.code},a.id));
 await publication(f);const original=await prisma.productImage.findUniqueOrThrow({where:{id:a.id},include:{asset:true}});
 const passport=await prisma.passport.findUniqueOrThrow({where:{productId:f.id}});
 const publicA=await services.download({publicCode:f.code},a.id);await cloning(f);
 const inherited=(await services.get(f.id,f.context)).draft!.image!;assert.notEqual(inherited.id,a.id);
 assert.equal((await prisma.productImage.findUniqueOrThrow({where:{id:inherited.id}})).assetId,original.assetId);
 await upload(f,'blue');const b=(await services.get(f.id,f.context)).draft!.image!;
 assert.deepEqual(await services.download({publicCode:f.code},a.id),publicA);await assert.rejects(services.download({publicCode:f.code},b.id));
 await publication(f);assert.notDeepEqual((await services.download({publicCode:f.code},b.id)).bytes,publicA.bytes);
 await assert.rejects(services.download({publicCode:f.code},a.id));
 assert.deepEqual(await prisma.productImage.findUniqueOrThrow({where:{id:a.id},include:{asset:true}}),original);
 assert.equal((await prisma.passport.findUniqueOrThrow({where:{productId:f.id}})).id,passport.id);
 const dto=await read({publicCode:f.code,requestedLocale:'hr',acceptLanguage:null});assert.equal(dto.kind,'PUBLIC');
 assert(!JSON.stringify(dto).includes(original.asset.storageKey));assert(!JSON.stringify(dto).includes('storageBucket'));
 await cloning(f);await services.mutate(f.id,await command(f,'REMOVE'),null,f.context);assert.equal((await services.get(f.id,f.context)).draft!.image,null);
 assert((await services.download({publicCode:f.code},b.id)).bytes.length>0);await publication(f);
 await assert.rejects(services.download({publicCode:f.code},b.id));assert.deepEqual(await prisma.productImage.findUniqueOrThrow({where:{id:a.id},include:{asset:true}}),original);
});
test('invalid input, foreign tenant, permissions and stale CAS preserve image and audit',async()=>{
 const f=await fixture(),g=await fixture();await upload(f);const before=await services.get(f.id,f.context),c=await command(f);const count=await prisma.auditLog.count({where:{entityId:f.id}});
 for(const ctx of [null,g.context,{...f.context,permissions:['PRODUCT_READ'] as const}])await assert.rejects(services.mutate(f.id,c,await bytes(),ctx));
 await assert.rejects(services.mutate(f.id,c,Buffer.from('invalid'),f.context));
 await assert.rejects(services.mutate(f.id,{...c,expectedDraftVersionId:g.versionId},await bytes(),f.context));
 assert.deepEqual(await services.get(f.id,f.context),before);assert.equal(await prisma.auditLog.count({where:{entityId:f.id}}),count);
 await prisma.membership.update({where:{id:f.context.membershipId},data:{status:'SUSPENDED'}});
 await assert.rejects(services.mutate(f.id,c,await bytes(),f.context));
});
test('storage write failure and finalization CAS failure preserve old reference and cleanup only abandoned asset',async()=>{
 const f=await fixture();await upload(f);const before=await services.get(f.id,f.context);
 failPut=true;try{await assert.rejects(upload(f,'blue'));}finally{failPut=false;}
 assert.deepEqual(await services.get(f.id,f.context),before);
 afterRead=async()=>{await prisma.product.update({where:{id:f.id},data:{updatedAt:new Date(Date.now()+1000)}});};
 await assert.rejects(upload(f,'blue'));assert.deepEqual((await services.get(f.id,f.context)).draft!.image,before.draft!.image);
 const abandoned=await prisma.productImageAsset.findMany({where:{organizationId:f.context.organizationId,state:'ABANDONED'}});assert.equal(abandoned.length,2);for(const a of abandoned)assert(!objects.has(a.id));
});
test('concurrent replacements have one CAS winner and database prevents asset mutation or cross-tenant references',async()=>{
 const f=await fixture(),g=await fixture();const c=await command(f),data=await bytes();const result=await Promise.allSettled([services.mutate(f.id,c,data,f.context),services.mutate(f.id,c,data,f.context)]);
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal(await prisma.productImage.count({where:{productVersionId:f.versionId}}),1);
 const row=await prisma.productImage.findFirstOrThrow({where:{productVersionId:f.versionId}});
 await assert.rejects(prisma.productImageAsset.update({where:{id:row.assetId},data:{storageKey:'overwrite'}}));
 await assert.rejects(prisma.productImage.create({data:{assetId:row.assetId,productVersionId:g.versionId}}));
 await assert.rejects(prisma.productImageAsset.delete({where:{id:row.assetId}}));
 assert.equal(await persistence.abandon(row.assetId,f.context.organizationId),false);
});
test('visibility is checked again after storage read; withdrawn passport never delivers',async()=>{
 const f=await fixture();await upload(f);await publication(f);const image=(await services.get(f.id,f.context)).published!;
 afterRead=async()=>{await prisma.passport.update({where:{productId:f.id},data:{status:'WITHDRAWN'}});};
 await assert.rejects(services.download({publicCode:f.code},image.id));
});
test('uncertain successful finalization never deletes referenced bytes',async()=>{
 const f=await fixture();const uncertain=new Proxy(persistence,{get(target,key){
  if(key==='finalize')return async(...args:Parameters<typeof persistence.finalize>)=>{await target.finalize(...args);throw new Error('response lost');};
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
 }});
 const subject=createImageServices({persistence:uncertain,storage,normalize:normalizeProductImage});
 await assert.rejects(subject.mutate(f.id,await command(f),await bytes(),f.context));
 const image=(await services.get(f.id,f.context)).draft!.image!;assert(image);
 assert((await services.download({productId:f.id,context:f.context},image.id)).bytes.length>0);
});
