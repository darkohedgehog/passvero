import assert from "node:assert/strict";
import test from "node:test";
import { billingValuesSchema, billingCommandSchema } from "../../src/application/billing/contracts";
import { billingPermissionsForRole } from "../../src/application/permissions/billing-permissions";
const values = {legalName:" Synthetic d.o.o. ",addressLine1:"Test 1",addressLine2:null,city:"Zagreb",postalCode:"00100",countryCode:"HR",billingEmail:"billing@example.invalid",taxIdentifier:"000123",vatIdentifier:"HR000123"};
test("billing validation preserves leading zeros and rejects incomplete, unknown and invalid input",()=>{
 const result=billingValuesSchema.parse(values);assert.equal(result.legalName,"Synthetic d.o.o.");assert.equal(result.postalCode,"00100");assert.equal(result.taxIdentifier,"000123");
 for(const patch of [{legalName:" "},{addressLine1:""},{city:""},{billingEmail:"not-email"},{countryCode:"ZZ"},{legalName:"a".repeat(201)},{organizationId:"injected"}])assert.equal(billingValuesSchema.safeParse({...values,...patch}).success,false);
 assert.equal(billingValuesSchema.safeParse({...values,postalCode:null,taxIdentifier:null,vatIdentifier:null}).success,true);
 assert.equal(billingCommandSchema.safeParse({expectedRevision:0,values}).success,true);
 assert.equal(billingCommandSchema.safeParse({expectedRevision:-1,values}).success,false);
 assert.equal(billingCommandSchema.safeParse({expectedRevision:0,values,organizationId:"injected"}).success,false);
});
test("only owner and admin receive billing profile authority",()=>{
 for(const role of ["OWNER","ADMIN"] as const)assert.deepEqual(billingPermissionsForRole(role),["BILLING_PROFILE_READ","BILLING_PROFILE_UPDATE"]);
 for(const role of ["EDITOR","VIEWER"] as const)assert.deepEqual(billingPermissionsForRole(role),[]);
});
