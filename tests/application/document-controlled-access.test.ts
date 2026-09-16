import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { healthFixture } from "../helpers/signature-health-fixture";
import { createDocumentServices } from "../../src/application/documents/services";
import { cleanDocumentEligible, documentScanStatus } from "../../src/application/documents/access-policy";
import { DocumentError, type DocumentRecord, type DocumentPersistence, type PrivateDocumentStorage } from "../../src/application/documents/contracts";
import { sha256 } from "../../src/application/documents/pdf";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
const now = 1789500000000;
const week = 7 * 86400000;
const context: AuthenticatedUserContext = { userId:randomUUID(),organizationId:randomUUID(),membershipId:randomUUID(),membershipRole:"VIEWER",membershipStatus:"ACTIVE",permissions:["PRODUCT_READ"],correlationId:randomUUID() };
function fixture() {
  const bytes = Buffer.from("%PDF-synthetic unit fixture");
  const row: { -readonly [K in keyof DocumentRecord]: DocumentRecord[K] } = { id:randomUUID(),status:"AVAILABLE",originalFilename:"proof.pdf",displayName:null,sizeBytes:bytes.length,checksumSha256:sha256(bytes),storage:{provider:"fake",bucket:"private",key:"immutable"},scan:{status:"CLEAN",attemptId:randomUUID(),startedAt:now-1000,scannedAt:now,policyVersion:2,sha256:sha256(bytes)} };
  let reads=0; let storedReads=0; let healthReads=0;
  const persistence: DocumentPersistence = {
    async authorize(){},async createPending(){throw new Error();},async finalize(){},async fail(){},
    async read(actor){reads++;if(actor.organizationId!==context.organizationId)throw new DocumentError("NOT_FOUND");return {...row,storage:{...row.storage}};},
  };
  const storage: PrivateDocumentStorage = { identity:()=>row.storage,async put(){},async read(){storedReads++;return bytes;} };
  const health = { async read():Promise<unknown>{healthReads++;return healthFixture(now);} };
  return {row,bytes,persistence,storage,health, counts:()=>({reads,storedReads,healthReads}),service:()=>createDocumentServices({persistence,storage,health,now:()=>now})};
}
test("only current policy-2 CLEAN of matching immutable bytes may be delivered",async()=>{
  const f=fixture();const result=await f.service().download(f.row.id,context);
  assert.deepEqual(result.bytes,f.bytes);assert.deepEqual(f.counts(),{reads:2,storedReads:1,healthReads:2});
  assert.deepEqual(Object.keys(result).sort(),["bytes","filename","sizeBytes"]);
  for(const status of ["UNSCANNED","PENDING","INFECTED","ERROR"] as const){
    f.row.scan={...f.row.scan!,status};await assert.rejects(f.service().download(f.row.id,context),e=>e instanceof DocumentError&&e.code==="NOT_AVAILABLE");
  }
});
test("seven-day verdict boundary is independent of health expiry; missing/legacy/future mismatches deny",()=>{
  const f=fixture();const clean=f.row.scan!;
  for(const age of [0,week])assert.equal(cleanDocumentEligible({...f.row,scan:{...clean,scannedAt:now-age}},now),true);
  for(const scannedAt of [null,now+1,now-week-1])assert.equal(cleanDocumentEligible({...f.row,scan:{...clean,scannedAt}},now),false);
  for(const policyVersion of [null,1,3])assert.equal(cleanDocumentEligible({...f.row,scan:{...clean,policyVersion}},now),false);
  assert.equal(cleanDocumentEligible({...f.row,scan:{...clean,sha256:"b".repeat(64)}},now),false);
  assert.equal(cleanDocumentEligible({...f.row,scan:undefined},now),false);
  assert.equal(cleanDocumentEligible({...f.row,status:"ARCHIVED"},now),false);
});
test("health loss, digest corruption, revoked authority and changed object during delivery fail closed",async()=>{
  for(const phase of ["health","late-health","corruption","authority","object","verdict"]){
    const f=fixture();let healthCalls=0;
    if(phase==="health")f.health.read=async()=>null;
    if(phase==="late-health")f.health.read=async()=>++healthCalls===1?healthFixture(now):null;
    const read=f.storage.read;
    f.storage.read=async (...args)=>{
      const bytes=await read(...args);
      if(phase==="authority")f.persistence.read=async()=>{throw new DocumentError("FORBIDDEN");};
      if(phase==="object")f.row.storage={...f.row.storage,key:"replacement"};
      if(phase==="verdict")f.row.scan={...f.row.scan!,status:"PENDING"};
      return phase==="corruption"?Buffer.alloc(bytes.length):bytes;
    };
    await assert.rejects(f.service().download(f.row.id,context),DocumentError);
  }
  const f=fixture();await assert.rejects(f.service().download(f.row.id,{...context,organizationId:randomUUID()}));assert.equal(f.counts().storedReads,0);
  await assert.rejects(createDocumentServices({persistence:f.persistence,storage:f.storage,now:()=>now}).download(f.row.id,context));
});
test("read status has no private metadata; only expired PENDING exposes explicit recovery attempt",()=>{
  const f=fixture(); f.row.scan={...f.row.scan!,status:"PENDING",startedAt:now-120000};
  assert.deepEqual(documentScanStatus(f.row,now),{status:"PENDING",available:true,cleanEligible:false,recoverable:true,expectedAttemptId:f.row.scan!.attemptId});
  assert.equal(documentScanStatus(f.row,now-1).recoverable,false);
  assert.equal(documentScanStatus(f.row,now-1).expectedAttemptId,null);
});
