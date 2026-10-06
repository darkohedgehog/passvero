import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { createTestPrismaClient, requireSafeTestDatabaseConfig } from "../helpers/test-database";
import { PrismaAccessRequests } from "../../src/infrastructure/persistence/prisma/prisma-access-requests";
import { PrismaAccessRequestNotifications } from "../../src/infrastructure/persistence/prisma/prisma-access-request-notifications";
import type { AuthEmailSender, AuthEmailMessage } from "../../src/application/auth/auth-email";
import {runOnboardingOperator} from "../../src/infrastructure/platform/onboarding-operator";
import type { PlatformActor } from "../../src/application/platform/service";
import { PrismaVerifiedActivationPersistence } from "../../src/infrastructure/auth/prisma-controlled-activation";
const db=createTestPrismaClient(requireSafeTestDatabaseConfig(process.env));
const env={BETTER_AUTH_URL:"https://staging.passvero.eu",BETTER_AUTH_SECRET:"proof-secret-".repeat(6),AUTH_ACTIVATION_CAPABILITY_HMAC_SECRET:Buffer.alloc(32,1).toString("base64url"),AUTH_ACTIVATION_EMAIL_HMAC_SECRET:Buffer.alloc(32,2).toString("base64url")};
const sent:AuthEmailMessage[]=[];
const sender:AuthEmailSender={send:async message=>{sent.push(message);return {status:"SENT"};}};
const repo=new PrismaAccessRequests(db,async email=>Boolean(await db.authProviderUser.findUnique({where:{email},select:{id:true}})),{sender,canonicalOrigin:env.BETTER_AUTH_URL});
const payload=()=>({contactName:"Synthetic",email:`${randomUUID()}@example.invalid`,organizationDisplayName:"Synthetic organization",locale:"hr"});
test.after(()=>db.$disconnect());

test("verified AccessRequest ADMIN starts only its own trial; unrelated ADMIN does not; OWNER retains trial", async () => {
 const persistence = new PrismaVerifiedActivationPersistence();
 for (const kind of ["ACCESS_REQUEST_ADMIN", "UNRELATED_ADMIN", "OWNER"] as const) {
  const input = payload();
  await repo.submit(input);
  const request = await db.accessRequest.findUniqueOrThrow({where:{email:input.email}});
  await repo.approve(request.id,"synthetic-proof",env,sender);
  const approved = await db.accessRequest.findUniqueOrThrow({where:{id:request.id}});
  const userId = approved.userId!;
  const organizationId = approved.organizationId!;
  const intentId = approved.activationId!;
  // Retain historical ADMIN trial coverage; new approvals must provision OWNER.
  assert.equal((await db.membership.findUniqueOrThrow({where:{organizationId_userId:{organizationId,userId}}})).role,"OWNER");
  if (kind !== "OWNER") await db.membership.update({where:{organizationId_userId:{organizationId,userId}},data:{role:"ADMIN"}});
  if (kind === "UNRELATED_ADMIN") {
   // Another ADMIN of the same organization is not its approved applicant.
   const unrelatedUser = await db.user.create({data:{email:`${randomUUID()}@example.invalid`}});
   await db.membership.create({data:{organizationId,userId:unrelatedUser.id,role:"ADMIN"}});
   const intent = await db.accountActivationIntent.create({data:{userId:unrelatedUser.id,tokenDigest:randomBytes(32).toString("base64url"),intendedEmailDigest:randomBytes(32).toString("base64url"),expiresAt:new Date(Date.now()+3600000)}});
   await verify(intent.id);
  } else {
   const unrelated = await db.organization.create({data:{displayName:"Unrelated synthetic organization"}});
   await db.membership.create({data:{organizationId:unrelated.id,userId,role:"ADMIN"}});
   await verify(intentId);
   assert.equal(await db.organizationEntitlementEnrollment.count({where:{organizationId:unrelated.id}}),0);
  }
  const enrollment = await db.organizationEntitlementEnrollment.findUnique({where:{organizationId}});
  assert.equal(Boolean(enrollment),kind !== "UNRELATED_ADMIN");
  assert.equal(await db.auditLog.count({where:{organizationId,action:"SUBSCRIPTION_TRIAL_STARTED"}}),kind === "UNRELATED_ADMIN" ? 0 : 1);
  if (enrollment) {
   const intent = await db.accountActivationIntent.findUniqueOrThrow({where:{id:intentId}});
   assert.equal(enrollment.trialStartedAt?.getTime(),intent.boundAt?.getTime());
   const end = new Date(intent.boundAt!); end.setUTCMonth(end.getUTCMonth()+6);
   assert.equal(enrollment.trialEndsAt?.getTime(),end.getTime());
   await db.$transaction(tx=>persistence.markActivationBound(tx,{intentId,providerSubject:intent.providerSubject!,boundAt:new Date()}));
   assert.equal(await db.auditLog.count({where:{organizationId,action:"SUBSCRIPTION_TRIAL_STARTED"}}),1);
  }
  assert.equal(await db.subscriptionPaidPeriod.count({where:{organizationId}}),0);
 }
 async function verify(intentId:string) {
  const subject = randomUUID();
  const boundAt = new Date();
  await db.accountActivationIntent.update({where:{id:intentId},data:{status:"AUTH_ACCOUNT_CREATED",providerSubject:subject,authAccountCreatedAt:boundAt}});
  assert.equal(await db.$transaction(tx=>persistence.markActivationBound(tx,{intentId,providerSubject:subject,boundAt})),true);
 }
});

test("new request and one admin outbox are atomic; duplicate submits never resend or provision",async()=>{
 await db.onboardingNotificationSettings.create({data:{id:1,recipientEmail:"admin@example.invalid",enabled:true}});
 const input=payload();const before=sent.length;
 await Promise.all(Array.from({length:5},()=>repo.submit(input)));
 const row=await db.accessRequest.findUniqueOrThrow({where:{email:input.email}});
 assert.equal(row.status,"PENDING");assert.equal(row.deliveryAttempts,0);
 assert.equal(await db.user.count({where:{email:input.email}}),0);
 const notification=await db.accessRequestAdminNotification.findUniqueOrThrow({where:{requestId:row.id}});
 assert.equal(notification.status,"SENT");assert.equal(notification.attempts,1);assert.equal(sent.length,before+1);
 assert.equal(sent.at(-1)?.type,"ACCESS_REQUEST_ADMIN");
 const logs=await db.authAuditEvent.findMany({where:{correlationId:row.id}});
 assert.doesNotMatch(JSON.stringify(logs),/example.invalid|Synthetic|activationUrl|tokenDigest/);
});

test("public submission completes before deferred SMTP; duplicate and scheduling failure retain one pending notice",async()=>{
 const tasks:Array<()=>Promise<void>>=[];const before=sent.length;
 const repository=new PrismaAccessRequests(db,undefined,{sender,canonicalOrigin:env.BETTER_AUTH_URL,defer:task=>{tasks.push(task);}});
 const input=payload();await repository.submit(input);await repository.submit(input);
 const row=await db.accessRequest.findUniqueOrThrow({where:{email:input.email}});
 assert.equal(tasks.length,1);assert.equal(sent.length,before);
 assert.equal((await db.accessRequestAdminNotification.findUniqueOrThrow({where:{requestId:row.id}})).status,"PENDING");
 await tasks[0]();assert.equal(sent.length,before+1);
 const failed=payload();
 await new PrismaAccessRequests(db,undefined,{sender,canonicalOrigin:env.BETTER_AUTH_URL,defer:()=>{throw Error("scheduler unavailable");}}).submit(failed);
 const retained=await db.accessRequest.findUniqueOrThrow({where:{email:failed.email}});
 assert.equal((await db.accessRequestAdminNotification.findUniqueOrThrow({where:{requestId:retained.id}})).status,"PENDING");
 assert.equal(sent.length,before+1);
});

test("uncertain admin delivery survives save; replay never retries; retry is explicit and bounded",async()=>{
 let calls=0;const failed:AuthEmailSender={send:async()=>{calls++;throw Error("private SMTP error");}};
 const input=payload();const repository=new PrismaAccessRequests(db,undefined,{sender:failed,canonicalOrigin:env.BETTER_AUTH_URL});
 await repository.submit(input);
 const row=await db.accessRequest.findUniqueOrThrow({where:{email:input.email}});
 const notifications=new PrismaAccessRequestNotifications(db,env.BETTER_AUTH_URL);
 assert.equal((await db.accessRequestAdminNotification.findUniqueOrThrow({where:{requestId:row.id}})).status,"DELIVERY_UNKNOWN");
 await repository.submit(input);await notifications.deliver(row.id,sender);assert.equal(calls,1);
 await notifications.deliver(row.id,failed,true);await notifications.deliver(row.id,failed,true);
 await assert.rejects(notifications.deliver(row.id,sender,true));
 assert.equal(calls,3);assert.equal(await db.user.count({where:{email:input.email}}),0);
});

test("disabled notifications prepare without sending and outbox failure rolls back new request",async()=>{
 await db.onboardingNotificationSettings.update({where:{id:1},data:{enabled:false}});
 const before=sent.length;const input=payload();await repo.submit(input);
 const row=await db.accessRequest.findUniqueOrThrow({where:{email:input.email}});
 assert.equal(sent.length,before);assert.equal((await db.accessRequestAdminNotification.findUniqueOrThrow({where:{requestId:row.id}})).status,"PENDING");
 await db.$executeRawUnsafe(`CREATE FUNCTION notification_proof_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic'; END $$`);
 await db.$executeRawUnsafe('CREATE TRIGGER notification_proof_fail BEFORE INSERT ON "AccessRequestAdminNotification" FOR EACH ROW EXECUTE FUNCTION notification_proof_fail()');
 const failed=payload();
 try{await assert.rejects(repo.submit(failed));assert.equal(await db.accessRequest.count({where:{email:failed.email}}),0);}
 finally{await db.$executeRawUnsafe('DROP TRIGGER notification_proof_fail ON "AccessRequestAdminNotification"');await db.$executeRawUnsafe('DROP FUNCTION notification_proof_fail()');}
});

test("explicit private operator sends once with automatic notifications still disabled",async()=>{
 const input=payload();const before=sent.length;await repo.submit(input);
 const row=await db.accessRequest.findUniqueOrThrow({where:{email:input.email}});
 const command={action:"send-notification",id:row.id,operator:"proof",confirm:"APPLY"};
 assert.deepEqual(await runOnboardingOperator(db,db,command,env.BETTER_AUTH_URL,sender),{status:"SENT"});
 assert.deepEqual(await runOnboardingOperator(db,db,command,env.BETTER_AUTH_URL,sender),{status:"SENT"});
 assert.equal(sent.length,before+1);
 assert.equal((await db.onboardingNotificationSettings.findUniqueOrThrow({where:{id:1}})).enabled,false);
 assert.equal((await db.accessRequestAdminNotification.findUniqueOrThrow({where:{requestId:row.id}})).attempts,1);
 assert.equal(await db.user.count({where:{email:input.email}}),0);
});

test("dashboard approval requires independent grant in transaction; approval replay cannot send again",async()=>{
 const user=await db.user.create({data:{email:`${randomUUID()}@example.invalid`}});
 const provider=await db.authProviderUser.create({data:{id:randomUUID(),email:user.email,name:"Synthetic reviewer",emailVerified:true}});
 await db.authIdentity.create({data:{userId:user.id,provider:"BETTER_AUTH",providerSubject:provider.id}});
 const session=await db.authProviderSession.create({data:{id:randomUUID(),userId:provider.id,token:randomUUID(),expiresAt:new Date(Date.now()+3600000)}});
 const actor:PlatformActor={status:"AUTHENTICATED",currentUser:{userId:user.id},providerSession:{provider:"BETTER_AUTH",providerSessionId:session.id}};
 await db.platformGrant.create({data:{userId:user.id}});await db.platformBillingGrant.create({data:{userId:user.id}});
 const input=payload();await repo.submit(input);const row=await db.accessRequest.findUniqueOrThrow({where:{email:input.email}});
 const before=sent.length;
 await assert.rejects(repo.approveFromPlatform(row.id,actor,db,env,sender));
 assert.equal((await repo.review(row.id))?.status,"PENDING");assert.equal(sent.length,before);
 const grant={action:"grant",email:user.email,operator:"local-proof",confirm:"APPLY"};
 const granted=await runOnboardingOperator(db,db,grant,env.BETTER_AUTH_URL,sender);
 assert.equal("status" in granted && granted.status,"GRANTED");
 const replay=await runOnboardingOperator(db,db,grant,env.BETTER_AUTH_URL,sender);
 assert.equal("status" in replay && replay.status,"NO_CHANGE");
 const results=await Promise.all(Array.from({length:4},()=>repo.approveFromPlatform(row.id,actor,db,env,sender)));
 assert.equal(results.filter(r=>r.status==="APPROVED").length,1);assert.equal(sent.length,before+1);
 assert.equal(sent.at(-1)?.type,"CONTROLLED_ACTIVATION");
 const approved=await repo.review(row.id);assert.ok(approved?.activationId);assert.equal(approved?.decidedBy,user.id);
 assert.equal(await db.membership.count({where:{userId:approved!.userId!}}),1);
 const membership=await db.membership.findUniqueOrThrow({where:{organizationId_userId:{organizationId:approved!.organizationId!,userId:approved!.userId!}}});
 assert.equal(membership.role,"OWNER");
 assert.equal(await db.membership.count({where:{organizationId:approved!.organizationId!,role:"OWNER"}}),1);
 // Replayed approval must never promote an existing ADMIN or add provisioning/audit/mail.
 await db.membership.update({where:{id:membership.id},data:{role:"ADMIN"}});
 const auditBefore=await db.authAuditEvent.count({where:{correlationId:row.id}});
 assert.equal((await repo.approveFromPlatform(row.id,actor,db,env,sender)).status,"ALREADY_APPROVED");
 assert.equal((await db.membership.findUniqueOrThrow({where:{id:membership.id}})).role,"ADMIN");
 assert.equal(await db.authAuditEvent.count({where:{correlationId:row.id}}),auditBefore);
 assert.equal(await db.auditLog.count({where:{organizationId:approved!.organizationId!,action:"CONTROLLED_CUSTOMER_PROVISIONED"}}),1);
 assert.equal(sent.length,before+1);
 assert.equal(await db.commercialRequest.count({where:{organizationId:approved!.organizationId!}}),0);
 await db.platformOnboardingGrant.update({where:{userId:user.id},data:{revokedAt:new Date()}});
 await assert.rejects(repo.approveFromPlatform(row.id,actor,db,env,sender));assert.equal(sent.length,before+1);
});

test("application role cannot grant authority or enable email; independent grant works under minimal ACL",async()=>{
 await db.$executeRawUnsafe('CREATE ROLE onboarding_business_proof NOLOGIN');
 await db.$executeRawUnsafe('GRANT USAGE ON SCHEMA public TO onboarding_business_proof');
 await db.$executeRawUnsafe('GRANT SELECT ON "User", "Organization", "Membership", "AuthIdentity", "AccountActivationIntent", "AccessRequest", "AuthAuditEvent", "AuditLog", "PlatformGrant", "PlatformOnboardingGrant", "OnboardingNotificationSettings", "AccessRequestAdminNotification" TO onboarding_business_proof');
 await db.$executeRawUnsafe('GRANT INSERT ON "User", "Organization", "Membership", "AccountActivationIntent", "AuthAuditEvent", "AuditLog", "AccessRequest", "AccessRequestAdminNotification" TO onboarding_business_proof');
 await db.$executeRawUnsafe('GRANT UPDATE ON "AccessRequest", "AccessRequestAdminNotification" TO onboarding_business_proof');
 const url=new URL(process.env.TEST_DATABASE_URL!);url.searchParams.set("options","-c role=onboarding_business_proof");
 const app=createTestPrismaClient(requireSafeTestDatabaseConfig({NODE_ENV:"test",TEST_DATABASE_URL:url.toString()}));
 try {
  const user=await db.user.create({data:{email:`${randomUUID()}@example.invalid`}});
  const provider=await db.authProviderUser.create({data:{id:randomUUID(),email:user.email,name:"Synthetic",emailVerified:true}});
  await db.authIdentity.create({data:{userId:user.id,provider:"BETTER_AUTH",providerSubject:provider.id}});
  const session=await db.authProviderSession.create({data:{id:randomUUID(),userId:provider.id,token:randomUUID(),expiresAt:new Date(Date.now()+3600000)}});
  await db.platformGrant.create({data:{userId:user.id}});await db.platformOnboardingGrant.create({data:{userId:user.id}});
  const actor:PlatformActor={status:"AUTHENTICATED",currentUser:{userId:user.id},providerSession:{provider:"BETTER_AUTH",providerSessionId:session.id}};
  await assert.rejects(app.platformOnboardingGrant.update({where:{userId:user.id},data:{revokedAt:new Date()}}));
  await assert.rejects(app.onboardingNotificationSettings.update({where:{id:1},data:{enabled:true}}));
  await db.onboardingNotificationSettings.update({where:{id:1},data:{enabled:true}});
  const input=payload();const repository=new PrismaAccessRequests(app,async()=>false,{sender,canonicalOrigin:env.BETTER_AUTH_URL});
  await repository.submit(input);const request=await db.accessRequest.findUniqueOrThrow({where:{email:input.email}});
  assert.equal((await app.accessRequestAdminNotification.findUniqueOrThrow({where:{requestId:request.id}})).status,"SENT");
  assert.equal((await repository.approveFromPlatform(request.id,actor,db,env,sender)).status,"APPROVED");
  await db.authProviderSession.update({where:{id:session.id},data:{expiresAt:new Date(0)}});
  await assert.rejects(repository.approveFromPlatform(request.id,actor,db,env,sender));
 } finally {await app.$disconnect();}
});
