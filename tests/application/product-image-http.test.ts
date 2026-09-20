import assert from "node:assert/strict";
import test from "node:test";
import { createImageHttpHandlers } from "../../src/application/products/images/http";
import { imageError } from "../../src/application/products/images/contracts";
import type { createImageServices } from "../../src/application/products/images/service";
function harness() {
 let reads=0,authenticated=false;
 const services:ReturnType<typeof createImageServices>={get:async()=>{throw new Error();},authorize:async()=>{},mutate:async()=>({status:'UPDATED'}),download:async target=>{reads++;if('context' in target&&!target.context)throw imageError('FORBIDDEN','FORBIDDEN');return {bytes:new Uint8Array([1,2,3]),mimeType:'image/png',sizeBytes:3};}};
 const handlers=createImageHttpHandlers({services,canonicalOrigin:'https://app.invalid',verifyProxy:()=>true,resolveContext:async()=>{authenticated=true;return {status:'DENIED',reason:'NO_ACTIVE_MEMBERSHIP'};}});
 return {handlers,reads:()=>reads,authenticated:()=>authenticated};
}
test('anonymous draft requests are rejected before storage access',async()=>{
 const f=harness();const response=await f.handlers.download(new Request('https://app.invalid/api/image'),'id',{productId:'product'});
 assert.equal(response.status,403);assert.equal(f.reads(),0);assert(f.authenticated());
});
test('public GET HEAD range and conditional requests all reauthorize without cache or 304',async()=>{
 const f=harness();
 for(const method of ['GET','HEAD']){
  const response=await f.handlers.download(new Request('https://app.invalid/api/image',{method,headers:{range:'bytes=0-1','if-none-match':'old'}}),'id',{publicCode:'public'});
  assert.equal(response.status,200);assert.match(response.headers.get('cache-control')!,/no-store/);assert.equal(response.headers.get('cdn-cache-control'),'no-store');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.equal(response.headers.get('content-type'),'image/png');assert.equal(response.headers.get('etag'),null);
  assert.equal((await response.arrayBuffer()).byteLength,method==='HEAD'?0:3);
 }
 assert.equal(f.reads(),2);assert(!f.authenticated());
});
test('query variants cannot create alternate delivery paths',async()=>{
 const f=harness();const response=await f.handlers.download(new Request('https://app.invalid/api/image?old=true'),'id',{publicCode:'public'});assert.equal(response.status,404);assert.equal(f.reads(),0);
});
