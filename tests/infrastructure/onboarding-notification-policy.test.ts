import assert from "node:assert/strict";
import test from "node:test";
import { allowsAutomaticAdminNotification, onboardingNotificationPolicySchema, readOnboardingNotificationPolicy } from "../../src/infrastructure/persistence/prisma/onboarding-notification-policy";
const start = new Date("2026-10-07T14:00:00.000Z");
const request = { createdAt: start, email: "acceptance@example.invalid", contactName: "Acceptance", organizationDisplayName: "Synthetic", locale: "hr" };
const parsed = onboardingNotificationPolicySchema.parse({mode:"ACCEPTANCE", activatedAt:start.toISOString(),expiresAt:"2026-10-07T14:30:00.000Z",recipient:"admin@example.invalid",request:{email:request.email,contactName:request.contactName,organizationDisplayName:request.organizationDisplayName,locale:request.locale}});
if (parsed.mode !== "ACCEPTANCE") throw Error("Acceptance fixture required");
const policy = parsed;
test("acceptance allows only exact new request, correct inbox and a first attempt within thirty minutes",()=>{
 assert.equal(allowsAutomaticAdminNotification(policy,request,policy.recipient,0,start),true);
 for(const field of ["email","contactName","organizationDisplayName","locale"] as const) assert.equal(allowsAutomaticAdminNotification(policy,{...request,[field]:"other"},policy.recipient,0,start),false);
 assert.equal(allowsAutomaticAdminNotification(policy,request,"other@example.invalid",0,start),false);
 assert.equal(allowsAutomaticAdminNotification(policy,request,policy.recipient,1,start),false);
 assert.equal(allowsAutomaticAdminNotification(policy,request,policy.recipient,0,new Date(policy.expiresAt)),false);
 assert.equal(allowsAutomaticAdminNotification(policy,{...request,createdAt:new Date(start.getTime()-1)},policy.recipient,0,start),false);
 assert.equal(allowsAutomaticAdminNotification(policy,{...request,createdAt:new Date(start.getTime()+1)},policy.recipient,0,start),false);
});
test("expiry never promotes acceptance; missing, malformed or oversized windows fail closed",async()=>{
 assert.equal(allowsAutomaticAdminNotification(null,request,policy.recipient,0,start),false);
 assert.equal(onboardingNotificationPolicySchema.safeParse({...policy,expiresAt:"2026-10-07T15:00:00.000Z"}).success,false);
 assert.equal(onboardingNotificationPolicySchema.safeParse({...policy,mode:"NEW_REQUESTS"}).success,false);
 assert.equal(await readOnboardingNotificationPolicy(),null); // Local proof has no operator-owned runtime file.
});
test("explicit new-requests policy preserves original activation boundary and forbids repeat attempts",()=>{
 const live=onboardingNotificationPolicySchema.parse({mode:"NEW_REQUESTS",activatedAt:policy.activatedAt,recipient:policy.recipient});
 assert.equal(allowsAutomaticAdminNotification(live,request,live.recipient,0,new Date("2026-10-08T14:00:00.000Z")),true);
 assert.equal(allowsAutomaticAdminNotification(live,{...request,createdAt:new Date(0)},live.recipient,0,start),false);
 assert.equal(allowsAutomaticAdminNotification(live,request,live.recipient,1,start),false);
});
