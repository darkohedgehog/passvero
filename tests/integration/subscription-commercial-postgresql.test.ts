import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaCommercial } from "../../src/infrastructure/subscriptions/prisma-commercial";
import { changeBillingGrant } from "../../src/infrastructure/subscriptions/grant";
import type { CommercialActor, CommercialState, PaymentCommand } from "../../src/application/subscriptions/contracts";
import { createTestPrismaClient, requireSafeTestDatabaseConfig } from "../helpers/test-database";
const db=createTestPrismaClient(requireSafeTestDatabaseConfig(process.env));
test.after(()=>db.$disconnect());
async function actor(){
 const email=`${randomUUID()}@example.invalid`,user=await db.user.create({data:{email}});
 const provider=await db.authProviderUser.create({data:{id:randomUUID(),email,name:"Synthetic",emailVerified:true}});
 await db.authIdentity.create({data:{userId:user.id,provider:"BETTER_AUTH",providerSubject:provider.id}});
 const session=await db.authProviderSession.create({data:{id:randomUUID(),userId:provider.id,token:randomUUID(),expiresAt:new Date(Date.now()+3600000)}});
 return {email,user,provider,session,actor:{status:"AUTHENTICATED",currentUser:{userId:user.id},providerSession:{provider:"BETTER_AUTH",providerSessionId:session.id}} satisfies CommercialActor};
}
const values={legalName:"SYNTHETIC",addressLine1:"Test 1",addressLine2:null,city:"Test",countryCode:"HR",postalCode:"00100",billingEmail:"synthetic@example.invalid",taxIdentifier:"0001",vatIdentifier:null};
function open(state:CommercialState){return state.requests.find(r=>["REQUESTED","OFFERED","ACCEPTED"].includes(r.status))!;}
test("commercial least-privilege initial purchase, immutable evidence, renewal, idempotency and fresh authorization",async()=>{
 const owner=await actor(),operator=await actor(),reader=await actor();
 const org=await db.organization.create({data:{displayName:"SYNTHETIC commercial proof"}}),other=await db.organization.create({data:{displayName:"Other"}});
 const member=await db.membership.create({data:{userId:owner.user.id,organizationId:org.id,role:"OWNER"}});
 await db.platformGrant.create({data:{userId:reader.user.id}});
 assert.equal((await changeBillingGrant(db,db,{action:"grant",email:operator.email,operator:"synthetic-proof"})).status,"GRANTED");
 await db.$executeRawUnsafe('CREATE ROLE commercial_runtime_proof NOLOGIN');
 await db.$executeRawUnsafe('GRANT USAGE ON SCHEMA public TO commercial_runtime_proof');
 await db.$executeRawUnsafe('GRANT SELECT ON "User","Organization","Membership","AuthIdentity","PlatformBillingGrant","OrganizationBillingProfile","Plan","Product","CommercialOffer","SubscriptionPaidPeriod" TO commercial_runtime_proof');
 // PostgreSQL requires UPDATE permission on at least one column for FOR UPDATE; no organization mutation occurs.
 await db.$executeRawUnsafe('GRANT UPDATE (id) ON "Organization" TO commercial_runtime_proof');
 await db.$executeRawUnsafe('GRANT SELECT,INSERT,UPDATE ON "CommercialRequest","Subscription" TO commercial_runtime_proof');
 await db.$executeRawUnsafe('GRANT INSERT ON "CommercialOffer","SubscriptionPaidPeriod","AuditLog" TO commercial_runtime_proof');
 const url=new URL(process.env.TEST_DATABASE_URL!);url.searchParams.set("options","-c role=commercial_runtime_proof");
 const restricted=createTestPrismaClient(requireSafeTestDatabaseConfig({NODE_ENV:"test",TEST_DATABASE_URL:url.toString()}));test.after(()=>restricted.$disconnect());
 let now=new Date("2027-01-31T11:00:00Z");
 const api=new PrismaCommercial(restricted,db,{canonicalOrigin:"https://staging.passvero.eu",runtimeEnvironment:"staging",now:()=>now});
 assert.equal(await api.authorize(reader.actor),false);
 await assert.rejects(api.list(reader.actor),{code:"COMMERCIAL_FORBIDDEN"});
 await assert.rejects(api.state(owner.actor,other.id,false),{code:"COMMERCIAL_FORBIDDEN"});
 // Prove the specific INSERT RETURNING permission requirement, then grant it narrowly.
 await assert.rejects(api.request(owner.actor,org.id,{idempotencyKey:randomUUID(),planSlug:"start",months:3}),error=>{
  assert.match(String(error),/permission denied for table AuditLog/);return true;
 });
 assert.equal(await db.commercialRequest.count({where:{organizationId:org.id}}),0);
 await db.$executeRawUnsafe('GRANT SELECT ON "AuditLog" TO commercial_runtime_proof');
 const key=randomUUID();
 const races=await Promise.allSettled([api.request(owner.actor,org.id,{idempotencyKey:key,planSlug:"start",months:3}),api.request(owner.actor,org.id,{idempotencyKey:key,planSlug:"start",months:3})]);
 assert.equal(races.filter(r=>r.status==="fulfilled").length,2,races.filter(r=>r.status==="rejected").map(r=>String(r.reason)).join("\n"));
 assert.equal(await db.commercialRequest.count({where:{organizationId:org.id}}),1);
 await assert.rejects(api.request(owner.actor,org.id,{idempotencyKey:key,planSlug:"pro",months:3}),{code:"COMMERCIAL_CONFLICT"});
 await assert.rejects(api.request(owner.actor,org.id,{idempotencyKey:randomUUID(),planSlug:"start",months:12}),{code:"COMMERCIAL_CONFLICT"});
 let request=open(await api.state(owner.actor,org.id,false));
 let offerInput={issuedAtLocal:"2027-01-31T12:00",requestId:request.id,reference:{issuer:`test-${org.id}`,year:2027,number:"O-1"},netAmountCents:14700,totalAmountCents:18375,taxTreatment:"VAT 25% external offer",termsVersion:"v1"};
 await assert.rejects(api.offer(operator.actor,offerInput),{code:"COMMERCIAL_BILLING_PROFILE_REQUIRED"});
 await db.organizationBillingProfile.create({data:{organizationId:org.id,...values}});
 await assert.rejects(api.offer(operator.actor,{...offerInput,netAmountCents:1}),{code:"COMMERCIAL_PRICE_MISMATCH"});
 request=open(await api.offer(operator.actor,offerInput));
 const oldOffer=request.offer!;
 request=open(await api.offer(operator.actor,{...offerInput,reference:{...offerInput.reference,number:"O-2"}}));
 await assert.rejects(api.accept(owner.actor,org.id,{requestId:request.id,offerId:oldOffer.id}),{code:"COMMERCIAL_CONFLICT"});
 await db.organizationBillingProfile.update({where:{organizationId:org.id},data:{city:"Changed after offer",revision:2}});
 request=open(await api.accept(owner.actor,org.id,{requestId:request.id,offerId:request.offer!.id}));
 assert.equal(request.offer!.snapshot.billingProfile.city,"Test");
 const payment:PaymentCommand={requestId:request.id,offerId:request.offer!.id,reference:{issuer:`test-${org.id}`,year:2027,number:"P-1"},kind:"SIMULATED_PAYMENT"};
 const production=new PrismaCommercial(restricted,db,{canonicalOrigin:"https://passvero.eu",runtimeEnvironment:"production",now:()=>now});
 await assert.rejects(production.pay(operator.actor,payment),{code:"COMMERCIAL_SIMULATION_FORBIDDEN"});
 await db.$executeRawUnsafe(`CREATE FUNCTION commercial_proof_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'COMMERCIAL_PAYMENT_CONFIRMED' THEN RAISE EXCEPTION 'proof'; END IF; RETURN NEW; END $$`);
 await db.$executeRawUnsafe(`CREATE TRIGGER commercial_proof_reject BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION commercial_proof_reject()`);
 try{await assert.rejects(api.pay(operator.actor,payment));assert.equal(await db.subscriptionPaidPeriod.count({where:{organizationId:org.id}}),0);assert.equal(await db.subscription.count({where:{organizationId:org.id}}),0);}
 finally{await db.$executeRawUnsafe('DROP TRIGGER commercial_proof_reject ON "AuditLog"');await db.$executeRawUnsafe('DROP FUNCTION commercial_proof_reject()');}
 await db.plan.update({where:{slug:"start"},data:{quarterlyPrice:999}});
 try {await Promise.all([api.pay(operator.actor,payment),api.pay(operator.actor,payment)]);}
 finally {await db.plan.update({where:{slug:"start"},data:{quarterlyPrice:147}});}
 let state=await api.state(owner.actor,org.id,false);
 assert.equal(state.currentPeriod!.snapshot.netAmountCents,14700);
 assert.equal(state.currentPeriod!.end,"2027-04-30T10:00:00.000Z");
 assert.equal(await db.subscriptionPaidPeriod.count({where:{organizationId:org.id}}),1);
 assert.equal(await db.auditLog.count({where:{organizationId:org.id,action:"COMMERCIAL_PAYMENT_CONFIRMED"}}),1);
 const first=state.currentPeriod!,projection=await db.subscription.findUniqueOrThrow({where:{organizationId:org.id}});
 await assert.rejects(api.pay(operator.actor,{...payment,reference:{...payment.reference,number:"P-other"}}),{code:"COMMERCIAL_CONFLICT"});
 await assert.rejects(db.commercialOffer.update({where:{id:payment.offerId},data:{expiresAt:new Date("2030-01-01")}}));
 await assert.rejects(db.subscriptionPaidPeriod.update({where:{id:first.id},data:{endsAt:new Date("2030-01-01")}}));
 await assert.rejects(restricted.platformBillingGrant.update({where:{userId:operator.user.id},data:{revokedAt:now}}));
 await assert.rejects(restricted.plan.update({where:{slug:"start"},data:{quarterlyPrice:1}}));
 now=new Date("2027-04-20T10:00:00Z");
 request=open(await api.request(owner.actor,org.id,{idempotencyKey:randomUUID(),planSlug:"start",months:3}));
 offerInput={...offerInput,issuedAtLocal:"2027-04-20T12:00",requestId:request.id,reference:{...offerInput.reference,number:"O-renew"}};
 request=open(await api.offer(operator.actor,offerInput));
 assert.equal(request.offer!.snapshot.startPolicy,"CONTIGUOUS_RENEWAL");
 await api.accept(owner.actor,org.id,{requestId:request.id,offerId:request.offer!.id});
 await api.pay(operator.actor,{...payment,requestId:request.id,offerId:request.offer!.id,reference:{...payment.reference,number:"P-renew"}});
 state=await api.state(owner.actor,org.id,false);
 assert.equal(state.currentPeriod!.id,first.id);assert.equal(state.futurePeriods.length,1);assert.equal(state.coverageEnd,"2027-07-31T10:00:00.000Z");
 const after=await db.subscription.findUniqueOrThrow({where:{organizationId:org.id}});assert.equal(after.currentPeriodStart.toISOString(),projection.currentPeriodStart.toISOString());assert.equal(after.currentPeriodEnd.toISOString(),projection.currentPeriodEnd.toISOString());
 now=new Date(first.end);state=await api.state(owner.actor,org.id,false);assert.equal(state.currentPeriod!.start,first.end);assert.equal(state.futurePeriods.length,0);
 // Receipt replay remains successful beyond offer expiry and never grants another period.
 await api.pay(operator.actor,payment);assert.equal(await db.subscriptionPaidPeriod.count({where:{organizationId:org.id}}),2);
 await assert.rejects(api.request(owner.actor,org.id,{idempotencyKey:randomUUID(),planSlug:"pro",months:3}),{code:"COMMERCIAL_PLAN_CHANGE_UNSUPPORTED"});
 now=new Date("2027-08-04T08:30:00Z");
 assert.equal((await api.state(owner.actor,org.id,false)).currentPeriod,null);
 const uniqueRaces=await Promise.allSettled([api.request(owner.actor,org.id,{idempotencyKey:randomUUID(),planSlug:"start",months:3}),api.request(owner.actor,org.id,{idempotencyKey:randomUUID(),planSlug:"start",months:3})]);
 assert.equal(uniqueRaces.filter(r=>r.status==="fulfilled").length,1);
 request=open(await api.state(owner.actor,org.id,false));
 request=open(await api.offer(operator.actor,{...offerInput,issuedAtLocal:"2027-08-04T10:30",requestId:request.id,reference:{...offerInput.reference,number:"O-late"}}));
 assert.equal(request.offer!.snapshot.startPolicy,"ON_PAYMENT");
 await api.accept(owner.actor,org.id,{requestId:request.id,offerId:request.offer!.id});
 state=await api.pay(operator.actor,{...payment,requestId:request.id,offerId:request.offer!.id,reference:{...payment.reference,number:"P-late"}});
 assert.equal(state.currentPeriod!.start,now.toISOString());
 await db.membership.update({where:{id:member.id},data:{role:"ADMIN"}});assert.equal((await api.state(owner.actor,org.id,false)).canManage,false);
 await assert.rejects(api.request(owner.actor,org.id,{idempotencyKey:randomUUID(),planSlug:"start",months:3}),{code:"COMMERCIAL_FORBIDDEN"});
 await db.membership.update({where:{id:member.id},data:{role:"OWNER"}});
 await db.authIdentity.updateMany({where:{userId:owner.user.id},data:{revokedAt:new Date()}});await assert.rejects(api.state(owner.actor,org.id,false),{code:"COMMERCIAL_FORBIDDEN"});
 await changeBillingGrant(db,db,{action:"revoke",email:operator.email,operator:"synthetic-proof"});await assert.rejects(api.pay(operator.actor,payment),{code:"COMMERCIAL_FORBIDDEN"});
});

test("expired offer and explicit replacement require renewed acceptance; Custom has explicit terms",async()=>{
 const owner=await actor(),operator=await actor();await changeBillingGrant(db,db,{action:"grant",email:operator.email,operator:"synthetic-proof"});
 const org=await db.organization.create({data:{displayName:"SYNTHETIC Custom"}});await db.membership.create({data:{userId:owner.user.id,organizationId:org.id,role:"OWNER"}});await db.organizationBillingProfile.create({data:{organizationId:org.id,...values}});
 let now=new Date("2027-01-01T12:00:00Z");const api=new PrismaCommercial(db,db,{canonicalOrigin:"https://staging.passvero.eu",runtimeEnvironment:"staging",now:()=>now});
 let request=open(await api.request(owner.actor,org.id,{idempotencyKey:randomUUID(),planSlug:"custom",months:12}));
 const reference={issuer:org.id,year:2027,number:"custom-1"},input={issuedAtLocal:"2027-01-01T13:00",requestId:request.id,reference,netAmountCents:500000,totalAmountCents:625000,taxTreatment:"VAT 25%",termsVersion:"v1"};
 await assert.rejects(api.offer(operator.actor,input),{code:"COMMERCIAL_CUSTOM_LIMITS_REQUIRED"});
 const customLimits={maxPublishedProducts:1000,maxStoredProducts:3000,maxStorageBytes:100000000000,maxPdfAttachments:15};
 for(const data of [{status:"DRAFT" as const},{currencyCode:"USD"}]){
  await db.plan.update({where:{slug:"custom"},data});
  try {await assert.rejects(api.offer(operator.actor,{...input,customLimits}),{code:"COMMERCIAL_CATALOG_UNAVAILABLE"});}
  finally {await db.plan.update({where:{slug:"custom"},data:{status:"ACTIVE",currencyCode:"EUR"}});}
 }
 await assert.rejects(api.offer(operator.actor,{...input,issuedAtLocal:"2027-01-02T13:00",customLimits}),{code:"COMMERCIAL_OFFER_ISSUANCE_INVALID"});
 await assert.rejects(api.offer(operator.actor,{...input,issuedAtLocal:"2026-12-01T13:00",customLimits}),{code:"COMMERCIAL_OFFER_EXPIRED"});
 request=open(await api.offer(operator.actor,{...input,issuedAtLocal:"2026-12-25T13:00",customLimits:{maxPublishedProducts:1000,maxStoredProducts:3000,maxStorageBytes:100000000000,maxPdfAttachments:15}}));
 assert.equal(request.offer!.snapshot.offerIssuedAt,"2026-12-25T12:00:00.000Z");
 assert.equal(request.offer!.expiresAt,"2027-01-24T12:00:00.000Z");
 const issuedAt=now;
 now=new Date(request.offer!.expiresAt);
 await assert.rejects(api.accept(owner.actor,org.id,{requestId:request.id,offerId:request.offer!.id}),{code:"COMMERCIAL_OFFER_EXPIRED"});
 now=issuedAt;
 await api.accept(owner.actor,org.id,{requestId:request.id,offerId:request.offer!.id});
 now=new Date(request.offer!.expiresAt);
 await assert.rejects(api.pay(operator.actor,{requestId:request.id,offerId:request.offer!.id,reference,kind:"SIMULATED_PAYMENT"}),{code:"COMMERCIAL_OFFER_EXPIRED"});
 const replaced=request.id;
 request=open(await api.request(owner.actor,org.id,{idempotencyKey:randomUUID(),planSlug:"custom",months:12,replaceRequestId:replaced}));
 assert.equal((await db.commercialRequest.findUniqueOrThrow({where:{id:replaced}})).status,"REPLACED");
 request=open(await api.offer(operator.actor,{...input,issuedAtLocal:"2027-01-24T13:00",requestId:request.id,reference:{...reference,number:"custom-2"},customLimits:{maxPublishedProducts:1000,maxStoredProducts:3000,maxStorageBytes:100000000000,maxPdfAttachments:15}}));
 await assert.rejects(api.pay(operator.actor,{requestId:request.id,offerId:request.offer!.id,reference,kind:"SIMULATED_PAYMENT"}),{code:"COMMERCIAL_CONFLICT"});
 await api.accept(owner.actor,org.id,{requestId:request.id,offerId:request.offer!.id});
 const state=await api.pay(operator.actor,{requestId:request.id,offerId:request.offer!.id,reference,kind:"SIMULATED_PAYMENT"});
 assert.equal(state.currentPeriod!.snapshot.netAmountCents,500000);assert.equal(state.currentPeriod!.snapshot.limits.maxPdfAttachments,15);
 assert.equal(state.currentPeriod!.start,now.toISOString());
 request=open(await api.request(owner.actor,org.id,{idempotencyKey:randomUUID(),planSlug:"custom",months:12}));
 await assert.rejects(api.offer(operator.actor,{...input,requestId:request.id,reference:{...reference,number:"custom-upgrade"},customLimits:{maxPublishedProducts:1001,maxStoredProducts:3000,maxStorageBytes:100000000000,maxPdfAttachments:15}}),{code:"COMMERCIAL_PLAN_CHANGE_UNSUPPORTED"});
});

test("synthetic setup advisory lock must expose a Prisma-supported result type",async()=>{
 await assert.rejects(db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(9302026,147)`;
 }),error=>error instanceof Error && error.message.includes("void"));
 await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(9302026,147)::text AS lock`;
  assert.equal(await tx.organization.count({where:{slug:"synthetic-subscription-commercial-20260930"}}),0);
 });
});
