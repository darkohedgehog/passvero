import assert from "node:assert/strict";
import test from "node:test";
import { createCommercialHttpHandler } from "../../src/application/subscriptions/http";
import { ApplicationError } from "../../src/application/errors/application-error";

test("commercial mutation boundary rejects forged origin/proxy, query, content type and oversized bodies before mutation",async()=>{
 let calls=0;
 const handler=createCommercialHttpHandler({canonicalOrigin:"https://staging.passvero.eu",verifyProxy:h=>h.get("x-test-proxy")==="trusted",execute:async(_headers,input)=>{calls++;return input;}});
 const request=(body="{}",origin="https://staging.passvero.eu",proxy="trusted",path="",type="application/json")=>new Request(`https://staging.passvero.eu/api/subscription/request${path}`,{method:"POST",headers:{origin,"x-test-proxy":proxy,"content-type":type},body});
 for(const req of [request("{}","https://evil.invalid"),request("{}",undefined,"bad")])assert.equal((await handler(req)).status,403);
 for(const req of [request("x".repeat(16385)),request("{"),request("{}",undefined,undefined,"?organizationId=forged"),request("{}",undefined,undefined,"","text/plain")])assert.equal((await handler(req)).status,400);
 assert.equal(calls,0);
 const response=await handler(request());assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"private, no-store");assert.equal(calls,1);
});
test("commercial boundary returns safe errors",async()=>{
 const request=()=>new Request("https://staging.passvero.eu/api/subscription/request",{method:"POST",headers:{origin:"https://staging.passvero.eu","content-type":"application/json"},body:"{}"});
 for(const error of [new Error("private backend data"),new ApplicationError("FORBIDDEN","FORBIDDEN","private",false)]) {
  const handler=createCommercialHttpHandler({canonicalOrigin:"https://staging.passvero.eu",verifyProxy:()=>true,execute:async()=>{throw error;}});
  const response=await handler(request());assert.ok([403,503].includes(response.status));assert.doesNotMatch(await response.text(),/private/);
 }
});
test("expired commercial states use conflict status without exposing backend details",async()=>{
 const handler=createCommercialHttpHandler({canonicalOrigin:"https://staging.passvero.eu",verifyProxy:()=>true,execute:async()=>{throw new ApplicationError("INVALID_STATE","COMMERCIAL_OFFER_EXPIRED","private backend details",false);}});
 const response=await handler(new Request("https://staging.passvero.eu/api/subscription/payment",{method:"POST",headers:{origin:"https://staging.passvero.eu","content-type":"application/json"},body:"{}"}));
 assert.equal(response.status,409);assert.deepEqual(await response.json(),{status:"COMMERCIAL_OFFER_EXPIRED"});
});
