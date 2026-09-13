import assert from "node:assert/strict";
import test from "node:test";
import { createAttachmentHttpHandler } from "../../src/application/products/document-attachments/http";
import { ApplicationError } from "../../src/application/errors/application-error";
import type { AuthenticatedUserContextResolution } from "../../src/application/context/resolve-authenticated-user-context";
const resolution = { status: "RESOLVED", context: {} } as AuthenticatedUserContextResolution;
const request=(body="{}", origin="https://app.invalid")=>new Request("https://app.invalid/api/products/p/documents", {method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body});
test("origin/proxy/context denial prevents mutation",async()=>{
 let writes=0;
 for(const [proxy,origin,resolved] of [[false,"https://app.invalid",true],[true,"https://evil.invalid",true],[true,"https://app.invalid",false]] as const){
 const handler=createAttachmentHttpHandler({canonicalOrigin:"https://app.invalid",verifyProxy:()=>proxy,resolveContext:async()=>resolved?resolution:{status:"DENIED", reason:"UNAUTHENTICATED"} as unknown as AuthenticatedUserContextResolution,mutate:async()=>{writes++;return {status:"ATTACHED"};}});
 assert.equal((await handler(request("{}",origin),"p")).status,403);
 }assert.equal(writes,0);
});
test("bounded body, malformed JSON, safe failures and successful allowlist",async()=>{
 let writes=0;const handler=createAttachmentHttpHandler({canonicalOrigin:"https://app.invalid",verifyProxy:()=>true,resolveContext:async()=>resolution,mutate:async()=>{writes++;return {status:"ATTACHED"};}});
 for(const body of ["not-json","x".repeat(32769)]) assert.equal((await handler(request(body),"p")).status,400);
 assert.equal(writes,0); const response=await handler(request(),"p");assert.deepEqual(await response.json(),{status:"ATTACHED"});assert.match(response.headers.get("cache-control")!,/no-store/);
 for(const error of [new Error("SECRET provider diagnostic"),new ApplicationError("CONFLICT","STALE_WRITE","safe",false)]){
 const broken=createAttachmentHttpHandler({canonicalOrigin:"https://app.invalid",verifyProxy:()=>true,resolveContext:async()=>resolution,mutate:async()=>{throw error;}});
 const result=await broken(request(),"p");assert.ok([409,503].includes(result.status));assert.doesNotMatch(await result.text(),/SECRET|diagnostic/);
 }
});
