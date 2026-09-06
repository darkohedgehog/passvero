import assert from "node:assert/strict";
import test from "node:test";
import { runOperatorProvisioningCli } from "../../src/application/auth/operator-provisioning-cli";
import { ProvisioningError } from "../../src/application/auth/operator-provisioning";
const args=["--email","test@example.invalid","--organization-display-name","Synthetic","--role","ADMIN","--locale","en"];
const result={organization:{displayName:"Synthetic"},user:{email:"test@example.invalid"},membership:{role:"ADMIN" as const},activation:{expiresAt:"2026-09-09T12:00:00.000Z",activationUrl:"https://example.invalid/en/activate-account#capability=ONE_TIME_SYNTHETIC"}};
test("CLI emits the safe result once, only after service success",async()=>{
 const out:string[]=[],err:string[]=[];let calls=0;
 const code=await runOperatorProvisioningCli(args,{provision:async input=>{calls++;assert.deepEqual(input,{email:"test@example.invalid",organizationDisplayName:"Synthetic",role:"ADMIN",locale:"en"});assert.equal(out.length,0);return result;},stdout:value=>out.push(value),stderr:value=>err.push(value)});
 assert.equal(code,0);assert.equal(calls,1);assert.deepEqual(out,[JSON.stringify(result)+"\n"]);assert.deepEqual(err,[]);
});
for(const invalid of [[],args.slice(0,-2),[...args,"--password","secret"],[...args,"--role","OWNER"],[...args,"extra"],args.map(x=>x==="ADMIN"?"":x)])test("invalid CLI input emits no capability and never invokes service",async()=>{
 const out:string[]=[],err:string[]=[];const code=await runOperatorProvisioningCli(invalid,{provision:async()=>assert.fail("unexpected service"),stdout:s=>out.push(s),stderr:s=>err.push(s)});assert.equal(code,2);assert.deepEqual(out,[]);assert.equal(err.length,1);assert.doesNotMatch(err[0],/secret|capability=/);
});
for(const error of [new Error(result.activation.activationUrl),new ProvisioningError("EXISTING_BUSINESS_EMAIL"),new ProvisioningError("PROVISIONING_CONFLICT")])test("CLI errors never contain secrets and do not retry",async()=>{
 const out:string[]=[],err:string[]=[];let calls=0;const code=await runOperatorProvisioningCli(args,{provision:async()=>{calls++;throw error;},stdout:s=>out.push(s),stderr:s=>err.push(s)});assert.notEqual(code,0);assert.equal(calls,1);assert.deepEqual(out,[]);assert.equal(err.length,1);assert.doesNotMatch(err[0],/ONE_TIME|https:|digest|secret/);
});
