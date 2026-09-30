import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaCommercial } from "../../src/infrastructure/subscriptions/prisma-commercial";
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

test("supplement preserves paid renewal; blocked downgrade stays blocked and explicit replacement creates fresh rights",async()=>{
 const owner=await actor(),operator=await actor();
 let org=await db.organization.create({data:{displayName:"SYNTHETIC plan changes"}});
 await db.membership.create({data:{organizationId:org.id,userId:owner.user.id,role:"OWNER"}});
 await db.organizationBillingProfile.create({data:{organizationId:org.id,...values}});
 await db.platformBillingGrant.create({data:{userId:operator.user.id}});
 let now=new Date("2027-01-10T11:00:00Z"),sequence=0;
 const api=new PrismaCommercial(db,db,{canonicalOrigin:"https://staging.passvero.eu",runtimeEnvironment:"staging",now:()=>now});
 async function purchase(planSlug:"business"|"pro"|"start",changeKind:"STANDARD"|"UPGRADE"|"DOWNGRADE"|"REPLACEMENT",net:number){
  let request=open(await api.request(owner.actor,org.id,{idempotencyKey:randomUUID(),planSlug,months:3,changeKind}));
  const local=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Zagreb",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(now).replace(" ","T");
  request=open(await api.offer(operator.actor,{requestId:request.id,issuedAtLocal:local,reference:{issuer:org.id,year:2027,number:`O-${++sequence}`},netAmountCents:net,totalAmountCents:net,taxTreatment:"Synthetic",termsVersion:"v2"}));
  await api.accept(owner.actor,org.id,{requestId:request.id,offerId:request.offer!.id});
  const payment:PaymentCommand={requestId:request.id,offerId:request.offer!.id,reference:{issuer:org.id,year:2027,number:`P-${sequence}`},kind:"SIMULATED_PAYMENT"};
  return {request,payment,state:await api.pay(operator.actor,payment)};
 }
 const initial=await purchase("business","STANDARD",29700);
 const end=initial.state.currentPeriod!.end;
 const renewal=await purchase("business","STANDARD",29700);
 const renewalBefore=await db.subscriptionPaidPeriod.findUniqueOrThrow({where:{requestId:renewal.request.id}});
 // A rejected audit write must roll back the supplemental receipt and PAID transition.
 await db.$executeRawUnsafe(`CREATE FUNCTION synthetic_upgrade_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='COMMERCIAL_UPGRADE_PAYMENT_CONFIRMED' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END; $$`);
 await db.$executeRawUnsafe('CREATE TRIGGER synthetic_upgrade_audit_failure BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION synthetic_upgrade_audit_failure()');
 try { await assert.rejects(purchase("pro","UPGRADE",1234),/Synthetic audit failure/); }
 finally { await db.$executeRawUnsafe('DROP TRIGGER synthetic_upgrade_audit_failure ON "AuditLog"');await db.$executeRawUnsafe('DROP FUNCTION synthetic_upgrade_audit_failure()'); }
 assert.equal(await db.subscriptionUpgradeReceipt.count({where:{organizationId:org.id}}),0);
 const pending=open(await api.state(owner.actor,org.id,false));
 const resumed:PaymentCommand={requestId:pending.id,offerId:pending.offer!.id,reference:{issuer:org.id,year:2027,number:`P-${sequence}`},kind:"SIMULATED_PAYMENT"};
 const upgrade={payment:resumed,state:await api.pay(operator.actor,resumed)};
 assert.equal(upgrade.state.currentPeriod!.planSlug,"pro");assert.equal(upgrade.state.currentPeriod!.end,end);
 await Promise.all([api.pay(operator.actor,upgrade.payment),api.pay(operator.actor,upgrade.payment)]);
 assert.equal(await db.subscriptionUpgradeReceipt.count({where:{organizationId:org.id}}),1);
 assert.deepEqual(await db.subscriptionPaidPeriod.findUniqueOrThrow({where:{id:renewalBefore.id}}),renewalBefore);
 assert.equal(await db.auditLog.count({where:{organizationId:org.id,action:"COMMERCIAL_UPGRADE_PAYMENT_CONFIRMED"}}),1);
 now=new Date(end);assert.equal((await api.state(owner.actor,org.id,false)).currentPeriod!.planSlug,"business");
 await db.product.createMany({data:Array.from({length:101},(_,i)=>({organizationId:org.id,internalName:`Synthetic ${i}`,publicCode:randomUUID()}))});
 const downgrade=await purchase("start","DOWNGRADE",14700);
 assert.equal(downgrade.request.offer!.snapshot.version,2);
 if(downgrade.request.offer!.snapshot.version===2)assert.ok(downgrade.request.offer!.snapshot.downgradeWarnings.includes("STORED_PRODUCT_LIMIT"));
 now=new Date(renewalBefore.endsAt);
 const blocked=await api.state(owner.actor,org.id,false);
 assert.equal(blocked.currentPeriod,null);assert.ok(blocked.entitlements!.blockedReasons.includes("STORED_PRODUCT_LIMIT"));
 const receipt=await db.subscriptionPaidPeriod.findUniqueOrThrow({where:{requestId:downgrade.request.id}});
 assert.equal((await db.subscriptionPaidPeriodActivation.findUniqueOrThrow({where:{periodId:receipt.id}})).status,"BLOCKED_REQUIRES_OPERATOR");
 await Promise.all([api.state(owner.actor,org.id,false),api.state(owner.actor,org.id,false)]);
 assert.equal(await db.auditLog.count({where:{organizationId:org.id,action:"SUBSCRIPTION_DOWNGRADE_BLOCKED"}}),1);
 await assert.rejects(db.subscriptionPaidPeriodActivation.update({where:{periodId:receipt.id},data:{status:"ACTIVE"}}));
 now=new Date(receipt.endsAt.getTime()+1);
 const expiredBlocked=await api.state(owner.actor,org.id,false);
 assert.deepEqual(expiredBlocked.entitlements!.blockedReasons,[]);
 assert.equal(expiredBlocked.unresolvedReplacementPeriodId,receipt.id);
 const replacement=await purchase("business","REPLACEMENT",29700);
 assert.equal(replacement.state.unresolvedReplacementPeriodId,null);
 await assert.rejects(api.request(owner.actor,org.id,{idempotencyKey:randomUUID(),planSlug:"business",months:3,changeKind:"REPLACEMENT"}),{code:"COMMERCIAL_INVALID_PLAN_CHANGE"});
 assert.equal(replacement.state.currentPeriod!.planSlug,"business");assert.equal(replacement.state.currentPeriod!.start,now.toISOString());
 assert.deepEqual(await db.subscriptionPaidPeriod.findUniqueOrThrow({where:{id:receipt.id}}),receipt);
 // A distinct organization under every target quota activates the scheduled downgrade.
 org=await db.organization.create({data:{displayName:"SYNTHETIC allowed downgrade"}});
 await db.membership.create({data:{organizationId:org.id,userId:owner.user.id,role:"OWNER"}});
 await db.organizationBillingProfile.create({data:{organizationId:org.id,...values}});
 const upper=await purchase("business","STANDARD",29700);
 const lower=await purchase("start","DOWNGRADE",14700);
 now=new Date(upper.state.currentPeriod!.end);
 const activated=await api.state(owner.actor,org.id,false);
 assert.equal(activated.currentPeriod!.planSlug,"start");
 const lowerReceipt=await db.subscriptionPaidPeriod.findUniqueOrThrow({where:{requestId:lower.request.id}});
 assert.equal((await db.subscriptionPaidPeriodActivation.findUniqueOrThrow({where:{periodId:lowerReceipt.id}})).status,"ACTIVE");
 await api.state(owner.actor,org.id,false);
 assert.equal(await db.auditLog.count({where:{organizationId:org.id,action:"SUBSCRIPTION_DOWNGRADE_ACTIVATED"}}),1);
});
