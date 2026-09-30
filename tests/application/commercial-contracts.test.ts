import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { requestSchema,offerSchema,paymentSchema,limitsSchema } from "../../src/application/subscriptions/contracts";
import { paymentAllowed } from "../../src/application/subscriptions/service";
test("commercial commands reject implicit replacement, arbitrary periods and missing Custom limits",()=>{
 const base={idempotencyKey:randomUUID(),planSlug:"start",months:3};
 assert.equal(requestSchema.safeParse(base).success,true);
 assert.equal(requestSchema.safeParse({...base,months:1}).success,false);
 assert.equal(requestSchema.safeParse({...base,organizationId:randomUUID()}).success,false);
 assert.equal(limitsSchema.safeParse({maxPublishedProducts:100,maxStoredProducts:25,maxStorageBytes:1,maxPdfAttachments:1}).success,false);
 assert.equal(offerSchema.safeParse({issuedAtLocal:"2027-01-31T12:00",requestId:randomUUID(),reference:{issuer:"Synesis",year:2026,number:"1"},netAmountCents:14700,totalAmountCents:100,taxTreatment:"VAT",termsVersion:"v1"}).success,false);
 assert.equal(paymentSchema.safeParse({requestId:randomUUID(),offerId:randomUUID(),reference:{issuer:"Synesis",year:2026,number:"1"},kind:"SIMULATED_PAYMENT",allowSimulation:true}).success,false);
});
test("simulated payments require an exact staging runtime identity",()=>{
 assert.equal(paymentAllowed("SIMULATED_PAYMENT","https://staging.passvero.eu","staging"),true);
 for(const origin of ["https://passvero.eu","https://staging.passvero.eu.evil.test","http://staging.passvero.eu",undefined])assert.equal(paymentAllowed("SIMULATED_PAYMENT",origin,"staging"),false);
 assert.equal(paymentAllowed("SIMULATED_PAYMENT","https://staging.passvero.eu","production"),false);
 assert.equal(paymentAllowed("BANK_TRANSFER","https://passvero.eu","production"),true);
});

test("external offers require a valid Zagreb issuance time",()=>{
 const input={issuedAtLocal:"2027-01-31T12:00",requestId:randomUUID(),reference:{issuer:"Synesis",year:2027,number:"1"},netAmountCents:14700,totalAmountCents:18375,taxTreatment:"VAT 25%",termsVersion:"v1"};
 assert.equal(offerSchema.safeParse(input).success,true);
 for(const issuedAtLocal of [undefined,"2027-02-31T12:00","2027-01-31T12:00Z",""])assert.equal(offerSchema.safeParse({...input,issuedAtLocal}).success,false);
});
