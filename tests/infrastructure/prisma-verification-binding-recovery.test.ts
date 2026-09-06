import assert from "node:assert/strict";
import test from "node:test";
import { Prisma, type PrismaClient } from "../../src/generated/prisma/client";
import { PrismaVerifiedActivationPersistence, PrismaAuthTransactionRunner } from "../../src/infrastructure/auth/prisma-controlled-activation";
import { VerifiedActivationConflict } from "../../src/application/auth/complete-verified-activation";

function fixture(status="AUTH_ACCOUNT_CREATED", moved=false) {
 const calls:string[]=[];const sql:string[]=[];let reads=0;
 const tx={
  $queryRaw:async (parts:TemplateStringsArray,...values:unknown[])=>{calls.push("lock");sql.push(parts.join("?"));assert.ok(values.length>0);return [{id:"user"}];},
  accountActivationIntent:{findFirst:async()=>{reads++;calls.push("intent");return {id:"intent",userId:moved&&reads>1?"other":"user",providerSubject:"subject",status,intendedEmailDigest:"digest",expiresAt:new Date("2026-10-01"),user:{email:"person@example.com"}};},updateMany:async(input:unknown)=>{calls.push("mark");return input;}},
 };
 return {tx:tx as unknown as Prisma.TransactionClient,calls,sql};
}
test("binding persistence locks user, intent and identities before re-reading authority",async()=>{
 const f=fixture();const row=await new PrismaVerifiedActivationPersistence().findActivationByProviderSubject(f.tx,"subject");
 assert.deepEqual(f.calls,["intent","lock","lock","lock","intent"]);
 assert.match(f.sql[0],/"User"[\s\S]*FOR UPDATE/);assert.match(f.sql[1],/"AccountActivationIntent"[\s\S]*FOR UPDATE/);assert.match(f.sql[2],/"AuthIdentity"[\s\S]*ORDER BY[\s\S]*FOR UPDATE/);
 assert.equal(row?.providerSubject,"subject");assert.equal(row?.expiresAt.toISOString(),"2026-10-01T00:00:00.000Z");
});
test("ownership change between lookup and locked revalidation fails closed",async()=>{const f=fixture("AUTH_ACCOUNT_CREATED",true);assert.equal(await new PrismaVerifiedActivationPersistence().findActivationByProviderSubject(f.tx,"subject"),null);});
for(const status of ["ISSUED","IN_PROGRESS","EXPIRED","REVOKED","CONFLICT"])test(`persistence rejects ${status}`,async()=>{const f=fixture(status);assert.equal(await new PrismaVerifiedActivationPersistence().findActivationByProviderSubject(f.tx,"subject"),null);});
test("transaction uniqueness failure becomes a bounded conflict after rollback",async()=>{
 const prisma={$transaction:async()=>{throw new Prisma.PrismaClientKnownRequestError("private constraint",{code:"P2002",clientVersion:"7.8.0"});}} as unknown as PrismaClient;
 await assert.rejects(new PrismaAuthTransactionRunner(prisma).run(async()=>null),VerifiedActivationConflict);
});

test("multiple identities for one User are a conflict instead of selecting one",async()=>{
 const tx={authIdentity:{findMany:async()=>[{id:"one",providerSubject:"one",revokedAt:null},{id:"two",providerSubject:"two",revokedAt:null}]}} as unknown as Prisma.TransactionClient;
 await assert.rejects(new PrismaVerifiedActivationPersistence().findIdentityForUser(tx,"user"),VerifiedActivationConflict);
});
test("BOUND transition revalidates expiry without changing expiry or subject",async()=>{
 let written:unknown;const tx={accountActivationIntent:{updateMany:async(input:unknown)=>{written=input;return {count:1};}}} as unknown as Prisma.TransactionClient;
 const time=new Date("2026-09-06T12:00:00Z");assert.equal(await new PrismaVerifiedActivationPersistence().markActivationBound(tx,{intentId:"intent",providerSubject:"subject",boundAt:time}),true);
 assert.deepEqual(written,{where:{id:"intent",provider:"BETTER_AUTH",providerSubject:"subject",status:{in:["AUTH_ACCOUNT_CREATED","EMAIL_VERIFIED"]},expiresAt:{gt:time}},data:{status:"BOUND",emailVerifiedAt:time,boundAt:time}});
});
