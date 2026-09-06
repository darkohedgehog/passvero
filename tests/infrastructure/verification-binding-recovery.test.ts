import assert from "node:assert/strict";
import test from "node:test";
import { signJWT } from "better-auth/crypto";
import { createVerificationBindingRecovery, VerificationRecoveryError } from "../../src/infrastructure/auth/verification-binding-recovery";
const secret = "synthetic-verification-recovery-test-secret";
const email = "person@example.com";
function fixture() {
  const calls: string[] = [];
  const recover = createVerificationBindingRecovery({
    secret,
    verifyEmail: async (token) => { calls.push(`verify:${token}`); return {status:true,user:null}; },
    findUserByEmail: async (value) => { assert.equal(value,email);calls.push("read");return {id:"subject",email,emailVerified:true}; },
    complete: async (identity) => { assert.deepEqual(identity,{providerSubject:"subject",email});calls.push("complete");return {status:"BOUND",userId:"business-user"}; },
  });
  return {recover,calls};
}
test("successful provider replay resolves trusted identity and completes binding despite null provider result user", async()=>{
 const f=fixture(),token=await signJWT({email},secret,60);
 assert.equal(await f.recover({token}),"VERIFIED");assert.deepEqual(f.calls,[`verify:${token}`,"read","complete"]);
});
for(const [name,payload,lifetime,key] of [
 ["expired",{email},-1,secret],["wrong signature",{email},60,"different-test-secret"],
 ["email change",{email,updateTo:"other@example.com"},60,secret],
 ["request type",{email,requestType:"change-email-verification"},60,secret],
 ["missing email",{},60,secret],["unexpected authority",{email,userId:"injected"},60,secret],
] as const) test(`rejects ${name} before provider or business operations`,async()=>{
 const f=fixture();const token=await signJWT(payload,key,lifetime);
 await assert.rejects(f.recover({token}),e=>e instanceof VerificationRecoveryError&&e.code==="VERIFICATION_DENIED");assert.deepEqual(f.calls,[]);
});
test("malformed token is denied safely",async()=>{const f=fixture();await assert.rejects(f.recover({token:"malformed"}),VerificationRecoveryError);assert.deepEqual(f.calls,[]);});

for (const user of [null,{id:"",email,emailVerified:true},{id:"subject",email,emailVerified:false},{id:"subject",email:"other@example.com",emailVerified:true}]) test("missing or mismatched verified provider evidence cannot reach binding",async()=>{
 let completed=false;const recover=createVerificationBindingRecovery({secret,verifyEmail:async()=>({status:true,user:null}),findUserByEmail:async()=>user,complete:async()=>{completed=true;return {status:"BOUND",userId:"user"};}});
 await assert.rejects(recover({token:await signJWT({email},secret,60)}),VerificationRecoveryError);assert.equal(completed,false);
});
for(const status of ["DENIED","CONFLICT"] as const)test(`business ${status} cannot become verification success`,async()=>{
 const recover=createVerificationBindingRecovery({secret,verifyEmail:async()=>({status:true,user:null}),findUserByEmail:async()=>({id:"subject",email,emailVerified:true}),complete:async()=>({status})});
 await assert.rejects(recover({token:await signJWT({email},secret,60)}),e=>e instanceof VerificationRecoveryError&&e.code===(status==="DENIED"?"VERIFICATION_DENIED":"CONFLICT"));
});
test("business operational failure is sanitized and not retried",async()=>{
 let attempts=0;const token=await signJWT({email},secret,60);
 const recover=createVerificationBindingRecovery({secret,verifyEmail:async()=>({status:true,user:null}),findUserByEmail:async()=>({id:"subject",email,emailVerified:true}),complete:async()=>{attempts++;throw new Error(token);}});
 await assert.rejects(recover({token}),e=>e instanceof VerificationRecoveryError&&e.code==="OPERATIONAL_FAILURE"&&!e.message.includes(token));assert.equal(attempts,1);
});
test("provider failure prevents business reads and reconciliation",async()=>{
 const recover=createVerificationBindingRecovery({secret,verifyEmail:async()=>{throw new Error("provider failed");},findUserByEmail:async()=>assert.fail("unexpected read"),complete:async()=>assert.fail("unexpected binding")});
 await assert.rejects(recover({token:await signJWT({email},secret,60)}),VerificationRecoveryError);
});
