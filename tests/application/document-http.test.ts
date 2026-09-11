import assert from "node:assert/strict";
import test from "node:test";
import { createDocumentHttpHandlers } from "../../src/application/documents/http";
import type { DocumentServices } from "../../src/application/documents/contracts";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
const context:AuthenticatedUserContext={userId:"user",organizationId:"org",membershipId:"member",membershipRole:"EDITOR",membershipStatus:"ACTIVE",permissions:["PRODUCT_READ","PRODUCT_EDIT"],correlationId:"request"};
function fixture(anonymous=false) {
 let uploads=0;let reads=0;
 const services:DocumentServices={async authorizeUpload(){},async upload(input){uploads++;assert.equal(input.filename,"proof.pdf");return {status:"AVAILABLE",documentId:"id"};},async recoverPending(){throw new Error();},async download(){reads++;return {filename:"proof.pdf",sizeBytes:6,bytes:Buffer.from("%PDF-x")};}};
 const http=createDocumentHttpHandlers({services,canonicalOrigin:"https://app.invalid",verifyProxy:()=>true,resolveContext:async()=>anonymous?{status:"DENIED",reason:"NO_PROVIDER_SESSION"}:{status:"RESOLVED",context,presentation:{organizationName:"Test"}}});
 return {http,uploads:()=>uploads,reads:()=>reads};
}
const request=()=>new Request("https://app.invalid/api/documents",{method:"POST",headers:{origin:"https://app.invalid","content-type":"application/pdf","x-document-filename":"proof.pdf"},body:"%PDF-x"});
test("authorized upload and safe attachment GET/HEAD; Range intentionally ignored",async()=>{
 const f=fixture();assert.equal((await f.http.upload(request())).status,201);assert.equal(f.uploads(),1);
 const get=await f.http.download(new Request("https://app.invalid/api/documents/id",{headers:{range:"bytes=0-1"}}),"id");assert.equal(get.status,200);assert.equal(get.headers.get("content-disposition"),'attachment; filename="proof.pdf"; filename*=UTF-8\'\'proof.pdf');assert.equal(get.headers.get("cache-control"),"private, no-store");assert.equal(get.headers.get("x-content-type-options"),"nosniff");
 const head=await f.http.download(new Request("https://app.invalid/api/documents/id",{method:"HEAD"}),"id");assert.equal(await head.text(),"");assert.equal(f.reads(),2);
});
test("anonymous upload/download/HEAD denied before services",async()=>{
 const f=fixture(true);assert.equal((await f.http.upload(request())).status,403);for(const method of ["GET","HEAD"])assert.equal((await f.http.download(new Request("https://app.invalid/api/documents/id",{method}),"id")).status,403);assert.equal(f.uploads(),0);assert.equal(f.reads(),0);
});
test("foreign origin and oversized chunked body are rejected",async()=>{
 const f=fixture();const r=request();r.headers.set("origin","https://evil.invalid");assert.equal((await f.http.upload(r)).status,403);
 const large=new Request("https://app.invalid/api/documents",{method:"POST",headers:{origin:"https://app.invalid","content-type":"application/pdf","x-document-filename":"proof.pdf"},body:new Uint8Array(10*1024*1024+1)});assert.equal((await f.http.upload(large)).status,400);assert.equal(f.uploads(),0);
});
test("safe failure bodies never include underlying provider diagnostics",async()=>{
 const {documentHttpFailure}=await import("../../src/application/documents/http");
 const response=documentHttpFailure(new Error("supabase private bucket secret token"));assert.deepEqual(await response.json(),{status:"OPERATIONAL_FAILURE"});
 const head=documentHttpFailure(new Error("secret"),true);assert.equal(await head.text(),"");
});
