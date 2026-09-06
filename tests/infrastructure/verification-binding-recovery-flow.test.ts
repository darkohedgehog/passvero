import assert from "node:assert/strict";
import test from "node:test";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createControlledActivationBetterAuthServerOptions, validateBetterAuthServerConfig } from "../../src/infrastructure/auth/better-auth-server-config";
import { createBetterAuthLifecycleCallbacks } from "../../src/infrastructure/auth/better-auth-lifecycle-adapter";
import { createPassveroPasswordCallbacks } from "../../src/infrastructure/auth/better-auth-password-core";
import { createActivationDigesters } from "../../src/infrastructure/auth/activation-digests";
import { createVerifiedActivationCompletionService } from "../../src/application/auth/complete-verified-activation";
import { createVerificationBindingRecovery } from "../../src/infrastructure/auth/verification-binding-recovery";
import { createCurrentUserResolver } from "../../src/application/auth/resolve-current-user";
import { createAuthenticatedUserContextResolver } from "../../src/application/context/resolve-authenticated-user-context";

// Transactional in-memory business fixture; actual PostgreSQL locking/rollback has a separate gate.
interface State {
 status: "AUTH_ACCOUNT_CREATED" | "EMAIL_VERIFIED" | "BOUND";
 identity: {id:string;userId:string;providerSubject:string;revokedAt:Date|null}|null;
 audits: unknown[];
 boundAt: Date|null;
}
async function fixture(failFirstAudit:boolean) {
 const providerDb:Record<string,Record<string,unknown>[]>= {AuthProviderUser:[],AuthProviderAccount:[],AuthProviderSession:[],AuthProviderVerification:[]};
 const email="recovery@example.com",secret="synthetic-memory-verification-recovery-secret",origin="https://passvero.example";
 let state:State={status:"AUTH_ACCOUNT_CREATED",identity:null,audits:[],boundAt:null};
 let subject="",link="",callbacks=0,fail=failFirstAudit;
 const digesters=createActivationDigesters({capabilityKey:Buffer.alloc(32,1),emailKey:Buffer.alloc(32,2)});
 const intendedEmailDigest=await digesters.intendedEmailDigester.digest(email);
 const expiry=new Date(Date.now()+72*60*60*1000);
 let tail=Promise.resolve();
 const complete=createVerifiedActivationCompletionService<State>({
  transactionRunner:{async run(work){const previous=tail;let release!:()=>void;tail=new Promise<void>(r=>{release=r;});await previous;const tx=structuredClone(state);try{const result=await work(tx);state=tx;return result;}finally{release();}}},
  intendedEmailDigester:digesters.intendedEmailDigester,now:()=>new Date(),
  persistence:{
   async findActivationByProviderSubject(tx,value){return value===subject?{id:"intent",userId:"business-user",providerSubject:subject,status:tx.status,canonicalEmail:email,intendedEmailDigest,expiresAt:expiry}:null;},
   async findIdentityByProviderSubject(tx,value){return tx.identity?.providerSubject===value?tx.identity:null;},
   async findIdentityForUser(tx){return tx.identity;},
   async createIdentity(tx,input){assert.equal(tx.identity,null);tx.identity={id:"identity",...input,revokedAt:null};return {identityId:"identity"};},
   async markActivationBound(tx,input){if(tx.status==="BOUND")return false;tx.status="BOUND";tx.boundAt=input.boundAt;return true;},
   async createAuditEvent(tx,input){if(fail){fail=false;throw new Error("Synthetic transactional audit failure");}tx.audits.push(input);},
  },
 });
 const lifecycle=createBetterAuthLifecycleCallbacks({send:async message=>{if(message.type==="VERIFY_EMAIL")link=message.verificationUrl;return {status:"SENT"};}},origin,{onEmailVerified:async identity=>{callbacks++;const result=await complete(identity,"normal-callback");if(result.status!=="BOUND"&&result.status!=="ALREADY_BOUND")throw new Error("Denied");}});
 const auth=betterAuth({...createControlledActivationBetterAuthServerOptions(validateBetterAuthServerConfig({secret,baseURL:origin}),memoryAdapter(providerDb),createPassveroPasswordCallbacks(),lifecycle),logger:{disabled:true}});
 // Synthetic credential setup only; no SMTP, external provider or database connection.
 const signup=await auth.api.signUpEmail({body:{email,name:"Recovery fixture",password:"A synthetic recovery fixture credential!",rememberMe:false}});subject=signup.user.id;
 await auth.api.sendVerificationEmail({body:{email}});
 const token=new URLSearchParams(new URL(link).hash.slice(1)).get("token");assert.ok(token);
 const recover=createVerificationBindingRecovery({secret,verifyEmail:token=>auth.api.verifyEmail({query:{token}}),findUserByEmail:async email=>(await (await auth.$context).internalAdapter.findUserByEmail(email,{includeAccounts:false}))?.user??null,complete:identity=>complete(identity,"replay")});
 return {recover,token,providerDb,subject,get state(){return state;},get callbacks(){return callbacks;},complete};
}
for(const failFirst of [false,true])test(failFirst?"same native token repairs committed verification after failed business binding":"normal callback and consume reconciliation produce exactly one binding",async()=>{
 const f=await fixture(failFirst);
 if(failFirst){await assert.rejects(f.recover({token:f.token}));assert.equal(f.providerDb.AuthProviderUser[0].emailVerified,true);assert.equal(f.state.identity,null);assert.equal(f.state.status,"AUTH_ACCOUNT_CREATED");assert.deepEqual(f.state.audits,[]);}
 const providerBefore=JSON.stringify(f.providerDb.AuthProviderAccount);
 assert.equal(await f.recover({token:f.token}),failFirst?"VERIFIED":"NO_CHANGE");
 assert.equal(f.callbacks,1);assert.equal(f.state.status,"BOUND");assert.equal(f.state.identity?.providerSubject,f.subject);assert.equal(f.state.audits.length,1);
 const saved=JSON.stringify(f.state);assert.equal(await f.recover({token:f.token}),"NO_CHANGE");assert.equal(JSON.stringify(f.state),saved);assert.equal(f.callbacks,1);
 assert.equal(JSON.stringify(f.providerDb.AuthProviderAccount),providerBefore);assert.equal(f.providerDb.AuthProviderSession.length,0);
 const audit=f.state.audits[0] as {action:string;metadata:unknown};assert.equal(audit.action,"AUTH_IDENTITY_BOUND");assert.deepEqual(audit.metadata,{provider:"BETTER_AUTH"});
 const resolveCurrentUser=createCurrentUserResolver({now:()=>new Date(),identityReader:{findByProviderSubject:async input=>f.state.identity?.providerSubject===input.providerSubject?{revokedAt:null,currentUser:{userId:"business-user"}}:null}});
 const resolver=createAuthenticatedUserContextResolver({resolveCurrentUser,correlationId:()=>"context",repository:{listMembershipsForUser:async()=>[{membershipId:"membership",userId:"business-user",organizationId:"organization",membershipStatus:"ACTIVE",membershipRole:"ADMIN",organizationStatus:"ACTIVE",organizationDisplayName:"Synthetic"}],findSelection:async()=>null,deleteSelection:async()=>{},upsertSelection:async()=>{}}});
 const context=await resolver({provider:"BETTER_AUTH",providerSubject:f.subject,providerSessionId:"later-explicit-login-session",authenticatedAt:new Date()});assert.equal(context.status,"RESOLVED");
});
test("concurrent replay coordination converges to one binding and one no-change",async()=>{
 const f=await fixture(true);await assert.rejects(f.recover({token:f.token}));
 assert.deepEqual((await Promise.all([f.recover({token:f.token}),f.recover({token:f.token})])).sort(),["NO_CHANGE","VERIFIED"]);
 assert.equal(f.state.audits.length,1);assert.equal(f.providerDb.AuthProviderSession.length,0);
});
