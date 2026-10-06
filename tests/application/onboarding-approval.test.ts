import assert from "node:assert/strict";
import test from "node:test";
import { createOnboardingServices, onboardingApprovalSchema } from "../../src/application/auth/onboarding-approval";
import type { CurrentUserResolution } from "../../src/application/auth/resolve-current-user";

test("dashboard approval requires independent current authority and explicit send confirmation", async () => {
 let actor:CurrentUserResolution={status:"UNAUTHENTICATED",reason:"NO_PROVIDER_SESSION"};
 let allowed=false;let decisions=0;
 const services=createOnboardingServices({resolve:async()=>actor,authorize:async()=>allowed,approve:async()=>{decisions++;return {status:"APPROVED",deliveryStatus:"SENT"};}});
 const input={id:"00000000-0000-4000-8000-000000000001",confirm:"APPROVE_AND_SEND_ACTIVATION"};
 await assert.rejects(services.approve(new Headers(),input),{code:"ONBOARDING_FORBIDDEN"});
 actor={status:"AUTHENTICATED",currentUser:{userId:"operator"},providerSession:{provider:"BETTER_AUTH",providerSessionId:"session"}};
 await assert.rejects(services.approve(new Headers(),input),{code:"ONBOARDING_FORBIDDEN"});
 assert.equal(decisions,0);allowed=true;
 for(const invalid of [{id:input.id},{...input,email:"other@example.invalid"},{...input,role:"OWNER"},{...input,organizationId:input.id}]) assert.equal(onboardingApprovalSchema.safeParse(invalid).success,false);
 assert.deepEqual(await services.approve(new Headers(),input),{status:"APPROVED",deliveryStatus:"SENT"});
 allowed=false;await assert.rejects(services.approve(new Headers(),input),{code:"ONBOARDING_FORBIDDEN"});assert.equal(decisions,1);
});
