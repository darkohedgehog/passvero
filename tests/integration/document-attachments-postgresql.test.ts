import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createTestPrismaClient, requireSafeTestDatabaseConfig } from "../helpers/test-database";
import { createAttachmentService } from "../../src/application/products/document-attachments/service";
import { createPrismaAttachmentDependencies } from "../../src/infrastructure/persistence/prisma/prisma-document-attachments";
import { ApplicationError } from "../../src/application/errors/application-error";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { createPublishProductService } from "../../src/application/products/publish-product/publish-product";
import { createPrismaPublishProductDependencies } from "../../src/infrastructure/persistence/prisma/prisma-publish-product-composition";
import { createDraftFromPublishedService } from "../../src/application/products/create-draft-from-published/service";
import { createPrismaCreateDraftFromPublishedDependencies } from "../../src/infrastructure/persistence/prisma/prisma-create-draft-from-published";
import { createGetPublicDppService } from "../../src/application/public-dpp/get-public-dpp";
import { PrismaPublicDppPersistence } from "../../src/infrastructure/persistence/prisma/prisma-public-dpp";
import { createGetProductDetailService } from "../../src/application/products/get-product-detail/get-product-detail";
import { PrismaGetProductDetailPersistence } from "../../src/infrastructure/persistence/prisma/prisma-get-product-detail";
const config = requireSafeTestDatabaseConfig(process.env);
const prisma = createTestPrismaClient(config);
test.after(() => prisma.$disconnect());
const mutate = createAttachmentService(createPrismaAttachmentDependencies(prisma));
const publish = createPublishProductService({ ...createPrismaPublishProductDependencies(prisma), canonicalOrigin: "https://app.invalid", now: () => new Date(), generateQrCode: () => randomUUID().toUpperCase() });
const clone = createDraftFromPublishedService(createPrismaCreateDraftFromPublishedDependencies(prisma));
const publicDpp = createGetPublicDppService({ persistence: new PrismaPublicDppPersistence(prisma) });
const metadata = { category: "MANUAL", locale: null, displayLabel: "Manual", description: null, isPublic: false };
const safe = (error: unknown) => error instanceof ApplicationError && !/prisma|sql|secret/i.test(error.message);
async function fixture() {
  const user = await prisma.user.create({ data: { email: `${randomUUID()}@test.invalid` } });
  const org = await prisma.organization.create({ data: { displayName: "Attachment proof" } });
  const member = await prisma.membership.create({ data: { userId: user.id, organizationId: org.id, status: "ACTIVE", role: "ADMIN", joinedAt: new Date() } });
  const context: AuthenticatedUserContext = { userId: user.id, organizationId: org.id, membershipId: member.id, membershipRole: "ADMIN", membershipStatus: "ACTIVE", permissions: ["PRODUCT_READ", "PRODUCT_EDIT", "PRODUCT_PUBLISH"], correlationId: randomUUID() };
  const product = await prisma.product.create({ data: { organizationId: org.id, internalName: "Chair", publicCode: randomUUID().replaceAll("-", "").slice(0,22) } });
  const draft = await prisma.productVersion.create({ data: { organizationId: org.id, productId: product.id, sourceLocale: "hr", translations: { create: { locale: "hr", productName: "Chair" } } } });
  await prisma.product.update({ where: { id: product.id }, data: { currentDraftVersionId: draft.id } });
  const doc = await prisma.document.create({ data: { organizationId: org.id, originalFilename: "never-expose.pdf", storageProvider: "fake", storageBucket: "private", storageKey: randomUUID(), sizeBytes: BigInt(1), checksumSha256: "a".repeat(64), mimeType: "application/pdf", fileExtension: "pdf", status: "AVAILABLE", uploadedAt: new Date() } });
  return { context, productId: product.id, draftId: draft.id, doc, publicCode: product.publicCode };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function evidence(f: Fixture) {
  const p = await prisma.product.findUniqueOrThrow({ where: { id: f.productId }, include: { currentDraftVersion: true } });
  assert.ok(p.currentDraftVersion);
  return { expectedDraftVersionId: p.currentDraftVersion.id, expectedProductUpdatedAt: p.updatedAt.toISOString(), expectedDraftUpdatedAt: p.currentDraftVersion.updatedAt.toISOString() };
}
async function attach(f: Fixture, change = {}) { return mutate(f.productId, { ...await evidence(f), operation: "ATTACH", documentId: f.doc.id, metadata, ...change }, f.context); }
async function target(f: Fixture, id?: string) {
  const e = await evidence(f);
  const row = await prisma.productDocument.findFirstOrThrow({ where: { productVersionId: e.expectedDraftVersionId, id } });
  return { ...e, attachmentId: row.id, expectedAttachmentUpdatedAt: row.updatedAt.toISOString() };
}
async function snapshot(f: Fixture) {
  return { product: await prisma.product.findUniqueOrThrow({ where: { id: f.productId }, include: { versions: { orderBy: { id: "asc" }, include: { translations: true, productDocuments: { orderBy: { id: "asc" } } } }, passport: { include: { qrCode: true } } } }), documents: await prisma.document.findMany({ where: { organizationId: f.context.organizationId }, orderBy: { id: "asc" } }), audits: await prisma.auditLog.findMany({ where: { organizationId: f.context.organizationId }, orderBy: { id: "asc" } }) };
}
async function publication(f: Fixture) { const p=await prisma.product.findUniqueOrThrow({where:{id:f.productId}}); return publish({productId:f.productId,...await evidence(f),expectedCurrentPublishedVersionId:p.currentPublishedVersionId},f.context); }

test("attach append/edit/no-op/remove preserves immutable Document, source translation and public identity", async () => {
 const f = await fixture(); const before=await snapshot(f);
 await attach(f); const first=await prisma.productDocument.findFirstOrThrow({where:{productVersionId:f.draftId}});
 assert.equal(first.sortOrder,0);assert.equal(first.isPrimary,false);assert.equal(first.isPublic,false);
 await attach(f,{metadata:{...metadata,category:"CERTIFICATE",locale:"en",isPublic:true}});
 assert.equal((await prisma.productDocument.findFirstOrThrow({where:{productVersionId:f.draftId,category:"CERTIFICATE"}})).sortOrder,1);
 const cmd={...await target(f,first.id),operation:"EDIT",metadata:{...metadata,displayLabel:"Changed",locale:"de"},sortOrder:4};
 await mutate(f.productId,cmd,f.context);
 const noOpBefore=await snapshot(f);await mutate(f.productId,{...cmd,...await target(f,first.id)},f.context);assert.deepEqual(await snapshot(f),noOpBefore);
 await mutate(f.productId,{...await target(f,first.id),operation:"REMOVE"},f.context);
 const after=await snapshot(f);assert.deepEqual(after.documents,before.documents);assert.deepEqual(after.product.versions[0].translations,before.product.versions[0].translations);assert.equal(after.product.publicCode,before.product.publicCode);assert.deepEqual(after.product.passport,before.product.passport);
 assert.equal(after.audits.length,4);assert.ok(after.audits.every(a=>a.action==="PRODUCT_UPDATED"));assert.deepEqual(after.audits.map(a=>Object.keys(a.metadata as object)),Array(4).fill(["operation"]));
});
for(const status of ["PENDING_UPLOAD","FAILED","ARCHIVED"] as const) test(`attach rejects ${status} without writes`,async()=>{
 const f=await fixture();await prisma.document.update({where:{id:f.doc.id},data:{status,failedAt:status==="FAILED"?new Date():null,archivedAt:status==="ARCHIVED"?new Date():null}});
 const before=await snapshot(f);await assert.rejects(attach(f),safe);assert.deepEqual(await snapshot(f),before);
});
test("foreign Document, foreign Product, no draft, stale draft and revoked authority deny atomically",async()=>{
 const f=await fixture(),g=await fixture();const before=await snapshot(f);
 await assert.rejects(attach(f,{documentId:g.doc.id}),safe);
 await assert.rejects(mutate(f.productId,{...await evidence(f),operation:"ATTACH",documentId:f.doc.id,metadata},g.context),safe);
 await assert.rejects(attach(f,{expectedDraftVersionId:g.draftId}),safe);assert.deepEqual(await snapshot(f),before);
 await prisma.membership.update({where:{id:f.context.membershipId},data:{role:"VIEWER"}});await assert.rejects(attach(f),safe);
 await prisma.membership.update({where:{id:f.context.membershipId},data:{role:"ADMIN"}});
 const oldEvidence=await evidence(f);await prisma.product.update({where:{id:f.productId},data:{currentDraftVersionId:null}});await assert.rejects(mutate(f.productId,{...oldEvidence,operation:"ATTACH",documentId:f.doc.id,metadata},f.context),safe);
});
test("concurrent identical attaches yield one link and one audit; duplicate metadata edit denied",async()=>{
 const f=await fixture();const cmd={...await evidence(f),operation:"ATTACH",documentId:f.doc.id,metadata};
 const results=await Promise.allSettled([mutate(f.productId,cmd,f.context),mutate(f.productId,cmd,f.context)]);
 assert.equal(results.filter(r=>r.status==="fulfilled").length,1);assert.equal((await snapshot(f)).audits.length,1);assert.equal(await prisma.productDocument.count({where:{productVersionId:f.draftId}}),1);
 await attach(f,{metadata:{...metadata,category:"OTHER"}});
 const other=await prisma.productDocument.findFirstOrThrow({where:{productVersionId:f.draftId,category:"OTHER"}});const before=await snapshot(f);
 await assert.rejects(mutate(f.productId,{...await evidence(f),operation:"EDIT",attachmentId:other.id,expectedAttachmentUpdatedAt:other.updatedAt.toISOString(),metadata,sortOrder:1},f.context),safe);assert.deepEqual(await snapshot(f),before);
});
test("concurrent metadata edits have one CAS winner",async()=>{
 const f=await fixture();await attach(f);const cmd={...await target(f),operation:"EDIT",metadata:{...metadata,displayLabel:"Winner"},sortOrder:0};
 const results=await Promise.allSettled([mutate(f.productId,cmd,f.context),mutate(f.productId,cmd,f.context)]);assert.equal(results.filter(r=>r.status==="fulfilled").length,1);assert.equal((await snapshot(f)).audits.length,2);
});
for(const operation of ["ATTACH","EDIT","REMOVE"] as const) test(`${operation} rolls back links/timestamps when audit fails`,async()=>{
 const f=await fixture();if(operation!=="ATTACH")await attach(f);
 const broken=prisma.$extends({query:{auditLog:{async create(){throw new Error("secret injected failure");}}}});
 const service=createAttachmentService(createPrismaAttachmentDependencies(broken as unknown as typeof prisma));
 const cmd=operation==="ATTACH"?{...await evidence(f),operation,documentId:f.doc.id,metadata}:operation==="EDIT"?{...await target(f),operation,metadata:{...metadata,displayLabel:"New"},sortOrder:2}:{...await target(f),operation};
 const before=await snapshot(f);await assert.rejects(service(f.productId,cmd,f.context),safe);assert.deepEqual(await snapshot(f),before);
});
for(const isPublic of [false,true]) test(`publication checks all linked states and metadata isPublic=${isPublic}`,async()=>{
 const f=await fixture();await attach(f,{metadata:{...metadata,isPublic}});
 for(const status of ["PENDING_UPLOAD","FAILED","ARCHIVED"] as const){
 await prisma.document.update({where:{id:f.doc.id},data:{status,failedAt:status==="FAILED"?new Date():null,archivedAt:status==="ARCHIVED"?new Date():null}});
 const before=await snapshot(f);await assert.rejects(publication(f),safe);assert.deepEqual(await snapshot(f),before);
 }
 await prisma.document.update({where:{id:f.doc.id},data:{status:"AVAILABLE",failedAt:null,archivedAt:null}});
 for(const change of [{displayLabel:null},{displayLabel:""},{category:"BOGUS"},{locale:"fr"}]){
 await prisma.productDocument.updateMany({where:{productVersionId:f.draftId},data:{...metadata,isPublic,...change}});const before=await snapshot(f);await assert.rejects(publication(f),safe);assert.deepEqual(await snapshot(f),before);
 }
});
test("zero-document publication, clone same asset/new links, replacement preserves historical publication and public DTO",async()=>{
 const empty=await fixture();assert.equal((await publication(empty)).status,"PUBLISHED");
 const f=await fixture();await attach(f,{metadata:{...metadata,isPublic:true}});await publication(f);
 const old=await prisma.productDocument.findFirstOrThrow({where:{productVersionId:f.draftId}});const published=await snapshot(f);
 const p=published.product; await clone({productId:f.productId,expectedCurrentPublishedVersionId:p.currentPublishedVersionId!,expectedProductUpdatedAt:p.updatedAt.toISOString()},f.context);
 const cloned=await prisma.productDocument.findFirstOrThrow({where:{productVersionId:(await evidence(f)).expectedDraftVersionId}});
 assert.notEqual(cloned.id,old.id);for(const key of ["documentId","category","locale","displayLabel","description","isPublic","isPrimary","sortOrder"] as const)assert.equal(cloned[key],old[key]);
 const historical={...await evidence(f),attachmentId:old.id,expectedAttachmentUpdatedAt:old.updatedAt.toISOString()};
 for(const operation of ["EDIT","REMOVE"] as const)await assert.rejects(mutate(f.productId,{...historical,operation,...operation==="EDIT"?{metadata,sortOrder:0}:{}},f.context),safe);
 const docB=await prisma.document.create({data:{...f.doc,id:randomUUID(),storageKey:randomUUID()}});
 await attach(f,{documentId:docB.id});await mutate(f.productId,{...await evidence(f),operation:"REMOVE",attachmentId:cloned.id,expectedAttachmentUpdatedAt:cloned.updatedAt.toISOString()},f.context);
 assert.deepEqual(await prisma.productDocument.findUniqueOrThrow({where:{id:old.id}}),old);
 const detail=await createGetProductDetailService({persistence:new PrismaGetProductDetailPersistence(prisma),canonicalOrigin:"https://app.invalid",getPublicDpp:publicDpp})({productId:f.productId},f.context);
 assert.equal(detail.currentPublished!.documents[0].documentId,f.doc.id);assert.equal(detail.currentDraft!.documents[0].documentId,docB.id);assert.doesNotMatch(JSON.stringify(detail),/storageKey|storageBucket|checksumSha256|never-expose/);
 await publication(f);assert.deepEqual(await prisma.productDocument.findUniqueOrThrow({where:{id:old.id}}),old);assert.deepEqual(await prisma.document.findUniqueOrThrow({where:{id:f.doc.id}}),f.doc);
 const result=await publicDpp({publicCode:f.publicCode,requestedLocale:"hr",acceptLanguage:null});assert.equal(result.kind,"PUBLIC");assert.doesNotMatch(JSON.stringify(result),/document|\.pdf|storage|checksum/i);
 const after=await snapshot(f);assert.equal(after.product.passport!.id,published.product.passport!.id);assert.deepEqual(after.product.passport!.qrCode,published.product.passport!.qrCode);assert.equal(after.product.publicCode,p.publicCode);
});
test("remove races publication: exactly one wins, published attachment is immutable",async()=>{
 const f=await fixture();await attach(f);const removal={...await target(f),operation:"REMOVE"};
 const e=await evidence(f);const results=await Promise.allSettled([mutate(f.productId,removal,f.context),publish({productId:f.productId,...e,expectedCurrentPublishedVersionId:null},f.context)]);
 assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
 const state=await snapshot(f);if(state.product.currentPublishedVersionId){assert.equal(state.product.versions[0].productDocuments.length,1);await assert.rejects(mutate(f.productId,removal,f.context),safe);}else assert.equal(state.product.versions[0].productDocuments.length,0);
});
test("runtime least-privilege role supports attach/edit/remove without Document DELETE",async()=>{
 await prisma.$executeRawUnsafe("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='attachment_runtime_test') THEN CREATE ROLE attachment_runtime_test LOGIN; END IF; END $$");
 await prisma.$executeRawUnsafe('GRANT USAGE ON SCHEMA public TO attachment_runtime_test');
 await prisma.$executeRawUnsafe('GRANT SELECT ON "Product", "ProductVersion", "Membership", "Organization", "Document", "ProductDocument" TO attachment_runtime_test');
 await prisma.$executeRawUnsafe('GRANT UPDATE ON "Product", "ProductVersion" TO attachment_runtime_test');
 await prisma.$executeRawUnsafe('GRANT UPDATE ("id") ON "Membership", "Organization" TO attachment_runtime_test');
 await prisma.$executeRawUnsafe('GRANT INSERT, UPDATE ON "Document" TO attachment_runtime_test');
 await prisma.$executeRawUnsafe('GRANT INSERT, UPDATE, DELETE ON "ProductDocument" TO attachment_runtime_test');
 await prisma.$executeRawUnsafe('GRANT SELECT, INSERT ON "AuditLog" TO attachment_runtime_test');
 const u=new URL(config.url);u.username="attachment_runtime_test";const runtime=createTestPrismaClient({...config,url:u.toString()});
 try{
 const f=await fixture();const service=createAttachmentService(createPrismaAttachmentDependencies(runtime));
 await service(f.productId,{...await evidence(f),operation:"ATTACH",documentId:f.doc.id,metadata},f.context);
 await service(f.productId,{...await target(f),operation:"EDIT",metadata:{...metadata,displayLabel:"Restricted"},sortOrder:1},f.context);
 await service(f.productId,{...await target(f),operation:"REMOVE"},f.context);
 await assert.rejects(runtime.document.delete({where:{id:f.doc.id}}));assert.deepEqual(await prisma.document.findUniqueOrThrow({where:{id:f.doc.id}}),f.doc);
 }finally{await runtime.$disconnect();}
});
for (const role of ["OWNER", "ADMIN", "EDITOR"] as const) test(`${role} can author with PRODUCT_EDIT; VIEWER cannot even with forged permission context`, async () => {
 const f=await fixture();await prisma.membership.update({where:{id:f.context.membershipId},data:{role}});await attach(f);
 await prisma.membership.update({where:{id:f.context.membershipId},data:{role:"VIEWER"}});const before=await snapshot(f);
 await assert.rejects(mutate(f.productId,{...await target(f),operation:"REMOVE"},f.context),safe);assert.deepEqual(await snapshot(f),before);
});
test("publication rejects legacy cross-tenant link and reads fail closed",async()=>{
 const f=await fixture(),g=await fixture();
 await prisma.productDocument.create({data:{productVersionId:f.draftId,documentId:g.doc.id,...metadata,isPrimary:false,sortOrder:0}});
 const before=await snapshot(f);await assert.rejects(publication(f),safe);assert.deepEqual(await snapshot(f),before);
 await assert.rejects(createGetProductDetailService({persistence:new PrismaGetProductDetailPersistence(prisma),canonicalOrigin:"https://app.invalid",getPublicDpp:publicDpp})({productId:f.productId},f.context),safe);
});
test("stale link timestamp and historical attachment handle cannot mutate another link",async()=>{
 const f=await fixture(),g=await fixture();await attach(f);await attach(g);const before=await snapshot(f);
 await assert.rejects(mutate(f.productId,{...await target(f),operation:"EDIT",expectedAttachmentUpdatedAt:"2000-01-01T00:00:00.000Z",metadata,sortOrder:0},f.context),safe);
 const foreign=await target(g);await assert.rejects(mutate(f.productId,{...await evidence(f),operation:"REMOVE",attachmentId:foreign.attachmentId,expectedAttachmentUpdatedAt:foreign.expectedAttachmentUpdatedAt},f.context),safe);
 assert.deepEqual(await snapshot(f),before);
});
