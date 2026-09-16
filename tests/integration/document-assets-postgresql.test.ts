import { healthFixture } from "../helpers/signature-health-fixture";
import { trustedProvenance } from "../../src/application/documents/malware-scan";
import { PrismaDocumentScanPersistence } from "../../src/infrastructure/persistence/prisma/prisma-document-scan";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createDocumentServices } from "../../src/application/documents/services";
import { PrismaDocumentPersistence } from "../../src/infrastructure/persistence/prisma/prisma-document-assets";
import { DocumentError, type PrivateDocumentStorage } from "../../src/application/documents/contracts";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { createTestPrismaClient, requireSafeTestDatabaseConfig } from "../helpers/test-database";
const prisma=createTestPrismaClient(requireSafeTestDatabaseConfig(process.env));
test.after(()=>prisma.$disconnect());
const input={filename:"proof.pdf",mimeType:"application/pdf",bytes:Buffer.from("%PDF-1.7 private proof")};
async function fixture() {
 const user=await prisma.user.create({data:{email:`${randomUUID()}@test.invalid`}});
 const org=await prisma.organization.create({data:{displayName:"Document proof"}});
 const membership=await prisma.membership.create({data:{userId:user.id,organizationId:org.id,role:"EDITOR",status:"ACTIVE",joinedAt:new Date()}});
 const context:AuthenticatedUserContext={userId:user.id,organizationId:org.id,membershipId:membership.id,membershipRole:"EDITOR",membershipStatus:"ACTIVE",permissions:["PRODUCT_READ","PRODUCT_EDIT"],correlationId:randomUUID()};
 const objects=new Map<string,Uint8Array>();let fail=false;
 const storage:PrivateDocumentStorage={identity:()=>({provider:"fake",bucket:"isolated",key:randomUUID()}),async put(i,b){if(fail)throw new Error("storage failed");assert.ok(!objects.has(i.key));objects.set(i.key,b.slice());},async read(i){const b=objects.get(i.key);if(!b)throw new Error("missing");return b;}};
 const persistence=new PrismaDocumentPersistence(prisma);
 return {context,objects,persistence,storage,services:createDocumentServices({persistence,storage,health:{async read(){return healthFixture(Date.now());}}}),failStorage:()=>{fail=true;}};
}
test("AVAILABLE CHECKs and one audit, no Product/version/link mutation; concurrent finalization idempotent",async()=>{
 const f=await fixture();const before=await Promise.all([prisma.product.count(),prisma.productVersion.count(),prisma.productDocument.count()]);
 const result=await f.services.upload(input,f.context);const row=await prisma.document.findUniqueOrThrow({where:{id:result.documentId}});
 assert.equal(row.status,"AVAILABLE");assert.ok(row.uploadedAt);assert.match(row.checksumSha256,/^[0-9a-f]{64}$/);assert.equal(row.sizeBytes,BigInt(input.bytes.length));
 await Promise.all([f.persistence.finalize(f.context,row.id),f.persistence.finalize(f.context,row.id)]);
 const audits=await prisma.auditLog.findMany({where:{entityId:row.id}});assert.equal(audits.length,1);assert.equal(audits[0].action,"DOCUMENT_UPLOADED");assert.equal(audits[0].metadata,null);
 assert.deepEqual(await Promise.all([prisma.product.count(),prisma.productVersion.count(),prisma.productDocument.count()]),before);
 assert.deepEqual(await prisma.document.findUnique({where:{id:row.id}}),row);
});
test("storage failure produces FAILED timestamp and no success audit",async()=>{
 const f=await fixture();f.failStorage();await assert.rejects(f.services.upload(input,f.context));const row=await prisma.document.findFirstOrThrow({where:{organizationId:f.context.organizationId}});assert.equal(row.status,"FAILED");assert.ok(row.failedAt);assert.equal(row.failureCode,"STORAGE_FAILURE");assert.equal(await prisma.auditLog.count({where:{entityId:row.id}}),0);
});
test("database-authoritative viewer and cross tenant checks; authorized viewer download",async()=>{
 const f=await fixture();const g=await fixture();const row=await f.services.upload(input,f.context);
 await assert.rejects(f.services.download(row.documentId,g.context));await assert.rejects(f.services.recoverPending(row.documentId,g.context));
 await assert.rejects(f.services.download(row.documentId,f.context),e=>e instanceof DocumentError&&e.code==="NOT_AVAILABLE");
 const scans=new PrismaDocumentScanPersistence(prisma); const claim=await scans.claim(f.context,row.documentId);
 await scans.finalize(f.context,claim,{status:"CLEAN",identity:claim.identity,provenance:trustedProvenance(healthFixture(Date.now()),Date.now())!});
 await prisma.membership.update({where:{id:f.context.membershipId},data:{role:"VIEWER"}});
 await assert.rejects(f.services.upload(input,f.context),e=>e instanceof DocumentError&&e.code==="FORBIDDEN");
 const deliveryRow=await f.persistence.read(f.context,row.documentId,"PRODUCT_READ");
 assert.equal(deliveryRow.scan?.policyVersion,2); assert.ok(deliveryRow.scan?.scannedAt && deliveryRow.scan.scannedAt <= Date.now(),JSON.stringify({scan:deliveryRow.scan,now:Date.now()}));
 assert.deepEqual(Buffer.from((await f.services.download(row.documentId,f.context)).bytes!),input.bytes);
 await prisma.organization.update({where:{id:f.context.organizationId},data:{status:"SUSPENDED"}});
 await assert.rejects(f.services.download(row.documentId,f.context));
});
test("audit failure rolls back AVAILABLE; existing private object can be recovered exactly once",async()=>{
 const f=await fixture();
 const broken=prisma.$extends({query:{auditLog:{async create(){throw new Error("injected audit failure");}}}});
 const services=createDocumentServices({persistence:new PrismaDocumentPersistence(broken as unknown as typeof prisma),storage:f.storage});
 await assert.rejects(services.upload(input,f.context),e=>e instanceof DocumentError&&e.code==="RECOVERY_REQUIRED");
 const row=await prisma.document.findFirstOrThrow({where:{organizationId:f.context.organizationId}});assert.equal(row.status,"PENDING_UPLOAD");assert.equal(row.uploadedAt,null);assert.equal(f.objects.size,1);assert.equal(await prisma.auditLog.count({where:{entityId:row.id}}),0);
 await f.services.recoverPending(row.id,f.context);await f.services.recoverPending(row.id,f.context);assert.equal(await prisma.auditLog.count({where:{entityId:row.id}}),1);assert.equal(f.objects.size,1);
});
test("revoked membership during storage prevents success finalization and audit",async()=>{
 const f=await fixture();const put=f.storage.put.bind(f.storage);
 f.storage.put=async(identity,bytes)=>{await put(identity,bytes);await prisma.membership.update({where:{id:f.context.membershipId},data:{status:"SUSPENDED"}});};
 await assert.rejects(f.services.upload(input,f.context),e=>e instanceof DocumentError&&e.code==="RECOVERY_REQUIRED");
 const row=await prisma.document.findFirstOrThrow({where:{organizationId:f.context.organizationId}});assert.equal(row.status,"PENDING_UPLOAD");assert.equal(await prisma.auditLog.count({where:{entityId:row.id}}),0);
});
test("database independently rejects false metadata and AVAILABLE without uploadedAt",async()=>{
 const f=await fixture();const base={organizationId:f.context.organizationId,originalFilename:"test.pdf",storageProvider:"fake",storageBucket:"isolated",storageKey:randomUUID(),mimeType:"application/pdf",sizeBytes:BigInt(1),checksumSha256:"a".repeat(64)};
 for(const change of [{sizeBytes:BigInt(0)},{checksumSha256:"not-a-hash"},{status:"AVAILABLE" as const}])await assert.rejects(prisma.document.create({data:{...base,...change}}));
 assert.equal(await prisma.document.count({where:{organizationId:f.context.organizationId}}),0);
});
test("existing Product and draft rows remain byte-for-byte unchanged after upload",async()=>{
 const f=await fixture();const product=await prisma.product.create({data:{organizationId:f.context.organizationId,internalName:"Unchanged",publicCode:randomUUID().replaceAll("-","").slice(0,22)}});
 const draft=await prisma.productVersion.create({data:{organizationId:f.context.organizationId,productId:product.id,sourceLocale:"hr",createdById:f.context.userId,translations:{create:{locale:"hr",productName:"Unchanged"}}}});
 await prisma.product.update({where:{id:product.id},data:{currentDraftVersionId:draft.id}});
 const state=()=>prisma.product.findUniqueOrThrow({where:{id:product.id},include:{versions:{include:{translations:true,productDocuments:true}},passport:{include:{qrCode:true}}}});
 const before=await state();await f.services.upload(input,f.context);assert.deepEqual(await state(),before);
});

test("upload DTO stays minimal and ERROR cannot download despite AVAILABLE lifecycle", async () => {
 const f = await fixture();
 const uploaded = await f.services.upload(input, f.context);
 assert.deepEqual(Object.keys(uploaded).sort(), ["documentId", "status"]);
 const row = await prisma.document.findUniqueOrThrow({where:{id:uploaded.documentId}});
 assert.equal(row.malwareScanStatus, "UNSCANNED");
 const started = new Date();
 // Database fixture only: no scanner invocation and no claim that bytes were scanned.
 await prisma.document.update({where:{id:row.id},data:{malwareScanStatus:"ERROR",malwareScanAttemptId:randomUUID(),malwareScanStartedAt:started,malwarePolicyVersion:1,malwareFailureCode:"TIMEOUT"}});
 const record = await f.persistence.read(f.context,row.id,"PRODUCT_READ");
 assert.deepEqual(Object.keys(record).sort(),["checksumSha256","displayName","id","originalFilename","scan","sizeBytes","status","storage"]);
 assert.equal(record.scan?.status,"ERROR");
 await assert.rejects(f.services.download(row.id,f.context),e=>e instanceof DocumentError&&e.code==="NOT_AVAILABLE");
});
