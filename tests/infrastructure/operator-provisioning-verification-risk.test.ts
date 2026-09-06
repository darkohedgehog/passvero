import assert from "node:assert/strict";
import test from "node:test";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createControlledActivationBetterAuthServerOptions, validateBetterAuthServerConfig } from "../../src/infrastructure/auth/better-auth-server-config";
import { createBetterAuthLifecycleCallbacks } from "../../src/infrastructure/auth/better-auth-lifecycle-adapter";
import { createPassveroPasswordCallbacks } from "../../src/infrastructure/auth/better-auth-password-core";

test("known acceptance risk: provider verification commits before binding failure and replay does not retry binding", async()=>{
  const db:Record<string,Record<string,unknown>[]>= {AuthProviderUser:[],AuthProviderAccount:[],AuthProviderSession:[],AuthProviderVerification:[]};
  let link:string|undefined,bindings=0;
  const origin="https://passvero.example";
  const callbacks=createBetterAuthLifecycleCallbacks({send:async message=>{assert.equal(message.type,"VERIFY_EMAIL");if(message.type==="VERIFY_EMAIL")link=message.verificationUrl;return{status:"SENT"};}},origin,{onEmailVerified:async()=>{bindings++;throw new Error("Synthetic binding failure");}});
  const options=createControlledActivationBetterAuthServerOptions(validateBetterAuthServerConfig({secret:"synthetic-test-only-secret-not-for-runtime",baseURL:origin}),memoryAdapter(db),createPassveroPasswordCallbacks(),callbacks);
  const auth=betterAuth({...options,logger:{disabled:true}});
  await auth.api.signUpEmail({body:{email:"fixture@example.invalid",name:"Fixture",password:"A synthetic credential for this fixture!",rememberMe:false}});
  await auth.api.sendVerificationEmail({body:{email:"fixture@example.invalid"}});
  assert.ok(link);const token=new URLSearchParams(new URL(link).hash.slice(1)).get("token");assert.ok(token);
  await assert.rejects(auth.api.verifyEmail({query:{token}}));
  assert.equal(bindings,1);assert.equal(db.AuthProviderUser[0].emailVerified,true);
  await auth.api.verifyEmail({query:{token}});
  assert.equal(bindings,1,"valid replay bypasses the callback, so it cannot repair the failed binding");
  assert.equal(db.AuthProviderSession.length,0);
});
