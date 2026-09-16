import { healthFixture } from "../helpers/signature-health-fixture";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createDocumentServices } from "../../src/application/documents/services";
import { DocumentError, type DocumentPersistence, type DocumentRecord, type PrivateDocumentStorage } from "../../src/application/documents/contracts";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
const context:AuthenticatedUserContext={userId:randomUUID(),organizationId:randomUUID(),membershipId:randomUUID(),membershipRole:"EDITOR",membershipStatus:"ACTIVE",permissions:["PRODUCT_EDIT","PRODUCT_READ"],correlationId:randomUUID()};
const input={filename:"proof.pdf",mimeType:"application/pdf",bytes:Buffer.from("%PDF-1.7 fixture")};
const now = 1789500000000;
function fixture() {
 const rows=new Map<string,DocumentRecord>();const objects=new Map<string,Uint8Array>();let audits=0;let failPut=false;let failFinalize=false;
 const persistence:DocumentPersistence={
  async authorize(c,p){if(c.organizationId!==context.organizationId||!c.permissions.includes(p))throw new DocumentError("FORBIDDEN");},
  async createPending(c,data){await this.authorize(c,"PRODUCT_EDIT");const row={...data,id:randomUUID(),status:"PENDING_UPLOAD" as const};rows.set(row.id,row);return row;},
  async read(c,id,p){await this.authorize(c,p);const row=rows.get(id);if(!row)throw new DocumentError("NOT_FOUND");return row;},
  async finalize(c,id){await this.authorize(c,"PRODUCT_EDIT");if(failFinalize)throw new Error("private database detail");const row=rows.get(id)!;if(row.status==="AVAILABLE")return;if(row.status!=="PENDING_UPLOAD")throw new DocumentError("NOT_AVAILABLE");rows.set(id,{...row,status:"AVAILABLE"});audits++;},
  async fail(c,id){await this.authorize(c,"PRODUCT_EDIT");const row=rows.get(id)!;if(row.status==="PENDING_UPLOAD")rows.set(id,{...row,status:"FAILED"});}
 };
 const storage:PrivateDocumentStorage={identity:()=>({provider:"fake",bucket:"private",key:`documents/${randomUUID()}.pdf`}),async put(i,b){if(failPut)throw new Error("SECRET provider detail");if(objects.has(i.key))throw new Error("overwrite");objects.set(i.key,b.slice());},async read(i){const b=objects.get(i.key);if(!b)throw new Error("absent");return b.slice();}};
 return {rows,objects,services:createDocumentServices({persistence,storage,now:()=>now,health:{async read(){return healthFixture(now);}}}),audits:()=>audits,setPutFailure:()=>{failPut=true;},setFinalizeFailure:(v:boolean)=>{failFinalize=v;}};
}
test("upload creates private AVAILABLE asset, safe DTO, distinct immutable keys; no dedup",async()=>{
 const f=fixture();const first=await f.services.upload(input,context);const old=[...f.objects.values()][0].slice();const second=await f.services.upload(input,context);
 assert.deepEqual(Object.keys(first).sort(),["documentId","status"]);assert.notEqual(first.documentId,second.documentId);assert.equal(f.objects.size,2);assert.equal(f.audits(),2);assert.deepEqual([...f.objects.values()][0],old);
 for(const key of f.objects.keys())assert.ok(!key.includes(input.filename));
 await assert.rejects(f.services.download(first.documentId,context),e=>e instanceof DocumentError&&e.code==="NOT_AVAILABLE");
});
test("invalid input and viewer cannot create rows or objects",async()=>{
 const f=fixture();await assert.rejects(f.services.upload({...input,filename:"bad.exe"},context));
 await assert.rejects(f.services.upload(input,{...context,permissions:["PRODUCT_READ"],membershipRole:"VIEWER"}));assert.equal(f.rows.size,0);assert.equal(f.objects.size,0);
});
test("storage failure is FAILED with no success audit or leaked provider error",async()=>{
 const f=fixture();f.setPutFailure();await assert.rejects(f.services.upload(input,context),e=>e instanceof DocumentError&&e.code==="UPLOAD_FAILED");assert.equal([...f.rows.values()][0].status,"FAILED");assert.equal(f.audits(),0);
});
test("finalization failure is recoverable; repeated finalization produces one audit and no overwrite",async()=>{
 const f=fixture();f.setFinalizeFailure(true);await assert.rejects(f.services.upload(input,context),e=>e instanceof DocumentError&&e.code==="RECOVERY_REQUIRED");const row=[...f.rows.values()][0];assert.equal(row.status,"PENDING_UPLOAD");assert.equal(f.objects.size,1);assert.equal(f.audits(),0);
 await assert.rejects(f.services.download(row.id,context));f.setFinalizeFailure(false);await f.services.recoverPending(row.id,context);await f.services.recoverPending(row.id,context);assert.equal(f.audits(),1);assert.equal(f.objects.size,1);
});
test("cross-tenant denied; viewer may read; HEAD returns no bytes",async()=>{
 const f=fixture();const row=await f.services.upload(input,context);await assert.rejects(f.services.download(row.documentId,{...context,organizationId:randomUUID()}));
 const saved=f.rows.get(row.documentId)!; f.rows.set(saved.id,{...saved,scan:{status:"CLEAN",attemptId:randomUUID(),startedAt:now-1000,scannedAt:now,sha256:saved.checksumSha256,policyVersion:2}});
 const file=await f.services.download(row.documentId,{...context,permissions:["PRODUCT_READ"],membershipRole:"VIEWER"},true);assert.equal(file.bytes,null);
});
test("upload snapshots a Buffer before async metadata persistence",async()=>{
 const bytes=Buffer.from("%PDF-original");let release:()=>void=()=>{};
 const waiting=new Promise<void>(resolve=>{release=resolve;});let entered:()=>void=()=>{};
 const started=new Promise<void>(resolve=>{entered=resolve;});let stored:Uint8Array|undefined;
 const row:DocumentRecord={id:randomUUID(),originalFilename:"a.pdf",displayName:null,sizeBytes:bytes.length,checksumSha256:"",storage:{provider:"fake",bucket:"private",key:"key"},status:"PENDING_UPLOAD"};
 const persistence:DocumentPersistence={async authorize(){},async createPending(_c,data){Object.assign(row,data);entered();await waiting;return row;},async read(){return row;},async finalize(){},async fail(){}};
 const storage:PrivateDocumentStorage={identity:()=>row.storage,async put(_i,b){stored=b;},async read(){return stored!;}};
 const result=createDocumentServices({persistence,storage}).upload({filename:"a.pdf",mimeType:"application/pdf",bytes},context);
 await started;bytes.fill(0);release();await result;assert.equal(Buffer.from(stored!).toString(),"%PDF-original");
});
test("read-back checksum mismatch cannot finalize AVAILABLE",async()=>{
 const f=fixture();let finalizeCount=0;let failed=false;
 const id=randomUUID();let row:DocumentRecord;
 const persistence:DocumentPersistence={async authorize(){},async createPending(_c,data){row={...data,id,status:"PENDING_UPLOAD"};return row;},async read(){return row;},async finalize(){finalizeCount++;},async fail(){failed=true;}};
 const storage:PrivateDocumentStorage={identity:()=>({provider:"fake",bucket:"private",key:"key"}),async put(){},async read(){return Buffer.from("%PDF-corrupt");}};
 await assert.rejects(createDocumentServices({persistence,storage}).upload(input,context),e=>e instanceof DocumentError&&e.code==="UPLOAD_FAILED");assert.equal(finalizeCount,0);assert.equal(failed,true);assert.equal(f.rows.size,0);
});
