import assert from "node:assert/strict";
import test from "node:test";
import { createPlatformServices, platformQuerySchema } from "../../src/application/platform/service";
import type { CurrentUserResolution } from "../../src/application/auth/resolve-current-user";
const authenticated: CurrentUserResolution = {status:"AUTHENTICATED",currentUser:{userId:"operator"},providerSession:{provider:"BETTER_AUTH",providerSessionId:"session"}};
test("every read denies anonymous and ungranted tenant users before reading organizations; revocation is fresh", async () => {
  let resolution: CurrentUserResolution = {status:"UNAUTHENTICATED",reason:"NO_PROVIDER_SESSION"};
  let granted=false; let reads=0;
  const api=createPlatformServices({resolve:async()=>resolution,authorize:async()=>granted,list:async()=>{reads++;return {items:[],nextCursor:null};},detail:async()=>{reads++;return null;}});
  await assert.rejects(api.list(new Headers(),{}),{code:"PLATFORM_FORBIDDEN"});
  resolution=authenticated;
  await assert.rejects(api.list(new Headers(),{}),{code:"PLATFORM_FORBIDDEN"});
  await assert.rejects(api.detail(new Headers(),"00000000-0000-4000-8000-000000000001"),{code:"PLATFORM_FORBIDDEN"});
  assert.equal(reads,0);
  granted=true;assert.deepEqual(await api.list(new Headers(),{}),{items:[],nextCursor:null});
  granted=false;await assert.rejects(api.list(new Headers(),{}),{code:"PLATFORM_FORBIDDEN"});assert.equal(reads,1);
  resolution={status:"UNAUTHENTICATED",reason:"IDENTITY_REVOKED"};granted=true;
  await assert.rejects(api.list(new Headers(),{}),{code:"PLATFORM_FORBIDDEN"});
});
test("bounded search and validated keyset cursor",()=>{
 assert.deepEqual(platformQuerySchema.parse({}),{q:"",cursor:null});
 assert.equal(platformQuerySchema.parse({q:"  Example  "}).q,"Example");
 for(const input of [{q:"x".repeat(101)},{q:["x"]},{cursor:"bad"},{pageSize:10000}])assert.equal(platformQuerySchema.safeParse(input).success,false);
});
