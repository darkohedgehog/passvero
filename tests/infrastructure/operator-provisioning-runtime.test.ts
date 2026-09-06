import assert from "node:assert/strict";
import test from "node:test";
import { createConfiguredOperatorProvisioning } from "../../src/infrastructure/auth/operator-provisioning-runtime";
import { createActivationDigesters } from "../../src/infrastructure/auth/activation-digests";
import type { ProvisioningRecord } from "../../src/application/auth/operator-provisioning";
const env={BETTER_AUTH_URL:"https://passvero.example",BETTER_AUTH_SECRET:"synthetic-config-only-not-a-production-secret",AUTH_ACTIVATION_CAPABILITY_HMAC_SECRET:Buffer.alloc(32,1).toString("base64url"),AUTH_ACTIVATION_EMAIL_HMAC_SECRET:Buffer.alloc(32,2).toString("base64url")};
test("runtime generates fresh canonical capabilities compatible with the existing activation consumer",async()=>{
 const rows:ProvisioningRecord[]=[];const issue=createConfiguredOperatorProvisioning(env,{create:async row=>{rows.push(row);}});
 const input={email:"test@example.invalid",organizationDisplayName:"Synthetic",role:"ADMIN",locale:"en"};
 const a=await issue(input),b=await issue(input);assert.notEqual(a.activation.activationUrl,b.activation.activationUrl);
 const token=new URL(a.activation.activationUrl).hash.slice("#capability=".length);assert.match(token,/^[A-Za-z0-9_-]{43}$/);assert.equal(Buffer.from(token,"base64url").length,32);assert.equal(Buffer.from(token,"base64url").toString("base64url"),token);
 const digesters=createActivationDigesters({capabilityKey:Buffer.alloc(32,1),emailKey:Buffer.alloc(32,2)});
 assert.equal(rows[0].tokenDigest,await digesters.capabilityDigester.digest(token));assert.equal(await digesters.intendedEmailDigester.matches({canonicalEmail:rows[0].email,persistedDigest:rows[0].intendedEmailDigest}),true);
 assert.equal(rows[0].expiresAt.getTime()-rows[0].issuedAt.getTime(),259200000);
});
for(const override of [{BETTER_AUTH_URL:"http://localhost:3000"},{AUTH_ACTIVATION_EMAIL_HMAC_SECRET:env.AUTH_ACTIVATION_CAPABILITY_HMAC_SECRET},{AUTH_ACTIVATION_CAPABILITY_HMAC_SECRET:"bad"}])test("invalid configuration fails before persistence with no secret-bearing error",()=>{
 assert.throws(()=>createConfiguredOperatorProvisioning({...env,...override},{create:async()=>assert.fail("unexpected persistence")}),error=>error instanceof Error&&!error.message.includes(env.BETTER_AUTH_SECRET));
});
