import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createDocumentScanHttpHandlers } from "../../src/application/documents/scan-http";
import { DocumentError, type DocumentRecord, type DocumentPersistence } from "../../src/application/documents/contracts";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
const id=randomUUID(); const origin="https://staging.passvero.eu";
const context:AuthenticatedUserContext={userId:randomUUID(),organizationId:randomUUID(),membershipId:randomUUID(),membershipRole:"EDITOR",membershipStatus:"ACTIVE",permissions:["PRODUCT_READ","PRODUCT_EDIT"],correlationId:randomUUID()};
function fixture(){
  let scans=0;let recoveries=0;let reads=0;let signal:AbortSignal|undefined;
  const row:DocumentRecord={id,status:"AVAILABLE",originalFilename:"private.pdf",displayName:null,sizeBytes:1,checksumSha256:"a".repeat(64),storage:{provider:"fake",bucket:"private",key:"secret"}};
  const persistence:DocumentPersistence={async authorize(){},async createPending(){throw new Error();},async finalize(){},async fail(){},async read(actor,_id,permission){assert.equal(actor,context);assert.equal(permission,"PRODUCT_READ");reads++;return row;}};
  const deps={enabled:()=>true,canonicalOrigin:origin,verifyProxy:(h:Headers)=>h.get("x-passvero-proxy-token")==="test",resolveContext:async()=>({status:"RESOLVED" as const,context,presentation:{organizationName:"Test"}}),persistence,
    scan:async(_id:string,actor:AuthenticatedUserContext,options:{signal:AbortSignal})=>{assert.equal(actor,context);scans++;signal=options.signal;return {documentId:id,status:"CLEAN" as const};},
    recover:async(_id:string,attempt:string,actor:AuthenticatedUserContext)=>{assert.equal(actor,context);assert.equal(attempt,id);recoveries++;return {status:"RECOVERED"};},};
  return {deps,counts:()=>({scans,recoveries,reads}),signal:()=>signal,handle:(r:Request)=>createDocumentScanHttpHandlers(deps)(r,id)};
}
function request(body?:unknown,headers:Record<string,string>={},signal?:AbortSignal){return new Request(origin+`/api/documents/${id}/scan`,{method:body===undefined?"GET":"POST",headers:{"x-passvero-proxy-token":"test",origin,"content-type":"application/json",...headers},body:body===undefined?undefined:JSON.stringify(body),signal});}
test("status is read-only and returns only explicit allowlisted fields",async()=>{
 const f=fixture();const response=await f.handle(request());assert.equal(response.status,200);assert.match(response.headers.get("cache-control")!,/no-store/);
 assert.deepEqual(await response.json(),{status:"UNSCANNED",available:true,cleanEligible:false,recoverable:false,expectedAttemptId:null});assert.deepEqual(f.counts(),{scans:0,recoveries:0,reads:1});
});
test("explicit scan and recovery pass the resolved context; recovery never scans",async()=>{
 const f=fixture();assert.equal((await f.handle(request({operation:"SCAN"}))).status,200);assert.ok(f.signal());
 assert.equal((await f.handle(request({operation:"RECOVER",expectedAttemptId:id}))).status,200);assert.deepEqual(f.counts(),{scans:1,recoveries:1,reads:0});
});
test("origin, proxy, strict command, disabled runtime and missing permission fail closed",async()=>{
 for(const r of [request({operation:"SCAN"},{origin:"https://evil.invalid"}),request({operation:"SCAN"},{"x-passvero-proxy-token":"bad"}),request({operation:"SCAN",actor:context}),request({operation:"RECOVER"}),request({operation:"SCAN",padding:"a".repeat(300)})]){const f=fixture();assert.notEqual((await f.handle(r)).status,200);assert.equal(f.counts().scans,0);}
 const disabled=fixture();disabled.deps.enabled=()=>false;assert.notEqual((await disabled.handle(request({operation:"SCAN"}))).status,200);
 const denied=fixture();denied.deps.scan=async()=>{throw new DocumentError("FORBIDDEN");};assert.equal((await denied.handle(request({operation:"SCAN"}))).status,403);
});
test("request cancellation reaches workflow; failed finalization is not a successful verdict",async()=>{
 const f=fixture();const controller=new AbortController();await f.handle(request({operation:"SCAN"},{},controller.signal));controller.abort();assert.equal(f.signal()?.aborted,true);
 for(const code of ["NOT_AVAILABLE","RECOVERY_REQUIRED","FORBIDDEN"] as const){const g=fixture();g.deps.scan=async()=>{throw new DocumentError(code);};const r=await g.handle(request({operation:"SCAN"}));assert.notEqual(r.status,200);assert.doesNotMatch(await r.text(),/CLEAN/);}
});
