import assert from "node:assert/strict";
import test from "node:test";
import { createTranslationHttpHandler, parseTranslationPayload } from "../../src/application/products/translation-management/http";
import { emptyTranslation } from "../../src/application/products/translation-management/content";
import { ApplicationError } from "../../src/application/errors/application-error";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
const context:AuthenticatedUserContext={userId:"user",organizationId:"org",membershipId:"member",membershipRole:"ADMIN",membershipStatus:"ACTIVE",permissions:["PRODUCT_EDIT","PRODUCT_READ"],correlationId:"test"};
const base={operation:"ADD",locale:"en",expectedDraftVersionId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",expectedProductUpdatedAt:"2026-09-11T10:00:00.000Z",expectedDraftUpdatedAt:"2026-09-11T10:00:00.000Z"};
function request(value:unknown,origin="https://passvero.test"){return new Request("https://passvero.test/api/products/product/translations",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify(value)});}
test("payload permits exactly each operation contract and rejects authority injection",()=>{
 assert.ok(parseTranslationPayload(base));
 assert.ok(parseTranslationPayload({...base,operation:"EDIT",translationId:"row",expectedTranslationUpdatedAt:base.expectedDraftUpdatedAt,content:emptyTranslation()}));
 assert.ok(parseTranslationPayload({...base,operation:"REMOVE",translationId:"row",expectedTranslationUpdatedAt:base.expectedDraftUpdatedAt}));
 for(const key of ["organizationId","actorId","sourceLocale","productId","productVersionId","role","permissions","content"]) assert.equal(parseTranslationPayload({...base,[key]:"injected"}),null);
 assert.equal(parseTranslationPayload({...base,operation:"DELETE"}),null);
 assert.equal(parseTranslationPayload({...base,operation:"EDIT",translationId:"row",expectedTranslationUpdatedAt:base.expectedDraftUpdatedAt,content:{...emptyTranslation(),sku:"private"}}),null);
});
test("origin and proxy gates reject before context or writes",async()=>{
 for(const trustedProxy of [true,false]){
 let calls=0;const handler=createTranslationHttpHandler({canonicalOrigin:"https://passvero.test",verifyProxy:()=>trustedProxy,resolveContext:async()=>{calls++;return {status:"RESOLVED",context,userLabel:"User",presentation:{organizationName:"Org"}};},mutate:async()=>{calls++;return{status:"ADDED"};}});
 assert.equal((await handler(request(base,trustedProxy?"https://foreign.test":"https://passvero.test"),"product")).status,403);assert.equal(calls,0);
 }
});
test("safe errors and no-store boundary",async()=>{
 for(const [category,code,status] of [["CONFLICT","TRANSLATION_STALE_WRITE",409],["INVALID_STATE","TRANSLATION_SOURCE_PROTECTED",409],["VALIDATION","TRANSLATION_VALIDATION_ERROR",400],["NOT_FOUND","TRANSLATION_NOT_FOUND",404],["FORBIDDEN","TRANSLATION_FORBIDDEN",403],["INTERNAL","TRANSLATION_OPERATIONAL_FAILURE",503]] as const){
 const handler=createTranslationHttpHandler({canonicalOrigin:"https://passvero.test",verifyProxy:()=>true,resolveContext:async()=>({status:"RESOLVED",context,userLabel:"User",presentation:{organizationName:"Org"}}),mutate:async()=>{throw new ApplicationError(category,code,"private SQL credentials",false);}});
 const response=await handler(request(base),"product");assert.equal(response.status,status);assert.equal(response.headers.get("cache-control"),"no-store, private");assert.doesNotMatch(await response.text(),/private|SQL|credentials/);
 }
});
