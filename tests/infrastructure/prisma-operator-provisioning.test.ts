import assert from "node:assert/strict";
import test from "node:test";
import { Prisma, type PrismaClient } from "../../src/generated/prisma/client";
import { PrismaOperatorProvisioningPersistence } from "../../src/infrastructure/persistence/prisma/prisma-operator-provisioning";
import { ProvisioningError, type ProvisioningRecord } from "../../src/application/auth/operator-provisioning";
const record:ProvisioningRecord={email:"test@example.invalid",organizationDisplayName:"Synthetic",role:"ADMIN",issuedAt:new Date("2026-09-06T12:00:00Z"),expiresAt:new Date("2026-09-09T12:00:00Z"),tokenDigest:"a".repeat(43),intendedEmailDigest:"b".repeat(43)};
function fixture(failAt="",exists=false) {
 const calls:Array<{model:string,input:unknown}>=[]; let transactions=0;
 const create=(model:string,id:string)=>async(input:unknown)=>{calls.push({model,input});if(failAt===model)throw new Error("private database details");return{id};};
 const tx={organization:{create:create("organization","org")},user:{findUnique:async()=>exists?{id:"existing"}:null,create:create("user","user")},membership:{create:create("membership","membership")},accountActivationIntent:{create:create("intent","intent")},auditLog:{create:create("audit","audit")}};
 const prisma={$transaction:async(work:(t:typeof tx)=>Promise<unknown>)=>{transactions++;return work(tx);}} as unknown as PrismaClient;
 return{persistence:new PrismaOperatorProvisioningPersistence(prisma),calls,transactions:()=>transactions};
}
test("creates only minimal business aggregate and a secret-free audit inside one transaction",async()=>{
 const f=fixture();await f.persistence.create(record);assert.equal(f.transactions(),1);assert.deepEqual(f.calls,[
 {model:"organization",input:{data:{displayName:"Synthetic",status:"ACTIVE"},select:{id:true}}},
 {model:"user",input:{data:{email:"test@example.invalid"},select:{id:true}}},
 {model:"membership",input:{data:{organizationId:"org",userId:"user",role:"ADMIN",status:"ACTIVE"},select:{id:true}}},
 {model:"intent",input:{data:{userId:"user",status:"ISSUED",provider:"BETTER_AUTH",tokenDigest:record.tokenDigest,intendedEmailDigest:record.intendedEmailDigest,createdAt:record.issuedAt,expiresAt:record.expiresAt},select:{id:true}}},
 {model:"audit",input:{data:{organizationId:"org",actorId:null,action:"CONTROLLED_CUSTOMER_PROVISIONED",entityType:"ORGANIZATION",entityId:"org",summary:"Controlled customer provisioned.",metadata:{role:"ADMIN"},occurredAt:record.issuedAt},select:{id:true}}}
 ]);
});
test("existing business email stops before Organization creation regardless of existing membership or intent",async()=>{
 const f=fixture("",true);await assert.rejects(f.persistence.create(record),(e:unknown)=>e instanceof ProvisioningError&&e.code==="EXISTING_BUSINESS_EMAIL");assert.deepEqual(f.calls,[]);
});
for(const point of ["organization","user","membership","intent","audit"])test(`failure at ${point} escapes owning transaction without continuing`,async()=>{
 const f=fixture(point);await assert.rejects(f.persistence.create(record),ProvisioningError);assert.equal(f.calls.at(-1)?.model,point);assert.equal(f.transactions(),1);
});
test("uniqueness race is a bounded conflict without retry or attaching existing rows",async()=>{
 let calls=0;const prisma={$transaction:async()=>{calls++;throw new Prisma.PrismaClientKnownRequestError("private",{code:"P2002",clientVersion:"7.8.0"});}} as unknown as PrismaClient;
 await assert.rejects(new PrismaOperatorProvisioningPersistence(prisma).create(record),(e:unknown)=>e instanceof ProvisioningError&&e.code==="PROVISIONING_CONFLICT");assert.equal(calls,1);
});
