import assert from "node:assert/strict";
import test from "node:test";
import { createListDpp, type DppListRow } from "../../src/application/dashboard/list-dpp";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
const context:AuthenticatedUserContext={userId:"u",organizationId:"tenant",membershipId:"m",membershipRole:"VIEWER",membershipStatus:"ACTIVE",permissions:["PRODUCT_READ"],correlationId:"test"};
const row:DppListRow={organizationId:"tenant",productId:"00000000-0000-4000-8000-000000000001",name:"Published name",sku:"SKU",versionNumber:1,imageId:null,archived:false,publicHref:null};
test("DPP rejects unauthenticated, inactive and unauthorized reads before persistence",async()=>{
 let calls=0;const read=createListDpp({async listPage(){calls++;return [];}});
 for(const c of [null,{...context,permissions:[]},{...context,membershipStatus:"SUSPENDED" as const}])await assert.rejects(read(null,"hr",c));
 assert.equal(calls,0);
});
test("DPP bounds pages, carries cursor and rejects alien tenant rows",async()=>{
 const rows=Array.from({length:26},(_,i)=>({...row,productId:`00000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`}));
 const read=createListDpp({async listPage(input){assert.equal(input.organizationId,"tenant");assert.equal(input.take,26);return rows;}});
 const page=await read(null,"hr",context);assert.equal(page.items.length,25);assert.equal(page.nextCursor,rows[24].productId);
 await assert.rejects(read("invalid","hr",context));
 await assert.rejects(createListDpp({async listPage(){return [{...row,organizationId:"other"}];}})(null,"hr",context));
});
