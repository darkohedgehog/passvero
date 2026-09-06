import assert from "node:assert/strict";
import test from "node:test";
import { createOperatorProvisioningService, ProvisioningError, type ProvisioningRecord } from "../../src/application/auth/operator-provisioning";
import { createActivationDigesters } from "../../src/infrastructure/auth/activation-digests";
import { canonicalizeAuthAccountIdentifier } from "../../src/infrastructure/auth/auth-abuse-identifiers";
const input = { email: " Test.User@Example.invalid ", organizationDisplayName: " Test organization ", role: "ADMIN", locale: "hr" };
const capability = Buffer.alloc(32, 7).toString("base64url");
function fixture() {
  const records: ProvisioningRecord[] = [];
  const digesters = createActivationDigesters({ capabilityKey: Buffer.alloc(32, 1), emailKey: Buffer.alloc(32, 2) });
  let clockCalls = 0;
  const service = createOperatorProvisioningService({
    canonicalOrigin: "https://passvero.example", normalizeEmail: canonicalizeAuthAccountIdentifier,
    now: () => { clockCalls++; return new Date("2026-10-24T12:00:00.000Z"); },
    generateCapability: () => capability, digesters,
    persistence: { async create(record) { records.push(record); } },
  });
  return { service, records, digesters, clockCalls: () => clockCalls };
}
test("issues only safe output with a single absolute 72-hour timestamp and existing digests", async () => {
  const f = fixture(); const result = await f.service(input);
  assert.deepEqual(result, { organization: { displayName: "Test organization" }, user: { email: "test.user@example.invalid" }, membership: { role: "ADMIN" }, activation: { expiresAt: "2026-10-27T12:00:00.000Z", activationUrl: `https://passvero.example/activate-account#capability=${capability}` } });
  assert.equal(f.clockCalls(), 1); assert.equal(f.records.length, 1);
  const row = f.records[0];
  assert.equal(row.tokenDigest, await f.digesters.capabilityDigester.digest(capability));
  assert.equal(await f.digesters.intendedEmailDigester.matches({canonicalEmail: row.email, persistedDigest: row.intendedEmailDigest}), true);
  assert.equal(JSON.stringify(row).includes(capability), false);
  assert.equal(row.issuedAt.toISOString(), "2026-10-24T12:00:00.000Z");
  assert.equal(row.expiresAt.toISOString(), "2026-10-27T12:00:00.000Z");
});
for (const locale of ["hr", "en", "de", "sr", "sl", "pl"]) test(`localized fragment-only issuance: ${locale}`, async () => {
  const result = await fixture().service({...input,locale}); const url = new URL(result.activation.activationUrl);
  assert.equal(url.pathname, `${locale === "hr" ? "" : `/${locale}`}/activate-account`); assert.equal(url.search, ""); assert.equal(url.hash, `#capability=${capability}`);
});
for (const key of ["password", "userId", "organizationId", "membershipId", "providerSubject", "authIdentityId", "activationDigest", "capability", "actorId", "expiresAt", "ttl", "displayName"]) test(`rejects caller authority: ${key}`, async () => {
  const f=fixture(); await assert.rejects(f.service({...input,[key]:"injected"}), (e:unknown)=>e instanceof ProvisioningError && e.code==="INVALID_INPUT"); assert.equal(f.records.length,0);
});
for (const change of [{role:undefined},{role:"PLATFORM_ADMIN"},{locale:undefined},{locale:"fr"},{email:"bad"},{email:"a b@example.invalid"},{organizationDisplayName:" "},{organizationDisplayName:"x".repeat(201)}]) test(`invalid input ${JSON.stringify(change)}`, async()=>{
  const f=fixture(); await assert.rejects(f.service({...input,...change}),ProvisioningError); assert.equal(f.records.length,0);
});
for (const role of ["VIEWER","EDITOR","ADMIN","OWNER"]) test(`explicit role preserved: ${role}`, async()=>{assert.equal((await fixture().service({...input,role})).membership.role,role);});
test("digest issuance uses exact existing email namespace", async()=>{
  const f=fixture(); const digest=await f.digesters.intendedEmailDigester.digest("test.user@example.invalid");
  assert.equal(await f.digesters.intendedEmailDigester.matches({canonicalEmail:"test.user@example.invalid",persistedDigest:digest}),true);
  assert.equal(await f.digesters.intendedEmailDigester.matches({canonicalEmail:"foreign@example.invalid",persistedDigest:digest}),false);
});

test("failure returns no one-time result and sanitizes persistence details", async()=>{
  const f=fixture();
  const service=createOperatorProvisioningService({canonicalOrigin:"https://passvero.example",normalizeEmail:canonicalizeAuthAccountIdentifier,now:()=>new Date("2026-09-06T00:00:00Z"),generateCapability:()=>capability,digesters:f.digesters,persistence:{create:async()=>{throw new Error(`private ${capability}`);}}});
  await assert.rejects(service(input),(error:unknown)=>error instanceof ProvisioningError&&error.code==="OPERATIONAL_FAILURE"&&!error.message.includes(capability));
});

for (const email of ["a!b@example.invalid", "a@example.c", "a@123.123", "a'@example.invalid"]) test(`rejects email that the existing credential flow cannot accept: ${email}`, async()=>{
  const f=fixture();await assert.rejects(f.service({...input,email}),(error:unknown)=>error instanceof ProvisioningError&&error.code==="INVALID_INPUT");assert.equal(f.records.length,0);
});
