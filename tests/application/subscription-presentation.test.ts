/* eslint-disable react/no-children-prop */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { CommercialOverview } from "../../src/components/application/subscriptions/commercial-overview";
import type { CommercialState } from "../../src/application/subscriptions/contracts";
import hr from "../../messages/hr.json";
import en from "../../messages/en.json";
import de from "../../messages/de.json";
import sr from "../../messages/sr.json";
import sl from "../../messages/sl.json";
import pl from "../../messages/pl.json";
const state:CommercialState={organizationId:"00000000-0000-4000-8000-000000000001",organizationName:"Synthetic",renewalPlanSlug:null,canManage:false,hasBillingProfile:true,requests:[],currentPeriod:null,futurePeriods:[],coverageEnd:null,occupiedPublishedProducts:7,storedProducts:11};
test("six localized subscription views distinguish occupied slots, enforcement and read-only permissions",()=>{
 for(const locale of ["hr","en","de","sr","sl","pl"] as const){
  const messages={hr,en,de,sr,sl,pl}[locale];
  assert.deepEqual(Object.keys(messages.Subscription).sort(),Object.keys(en.Subscription).sort());
  const html=renderToStaticMarkup(createElement(NextIntlClientProvider,{locale,messages,timeZone:"Europe/Zagreb",children:createElement(CommercialOverview,{state,now:"2026-09-30T10:00:00Z"})}));
  assert.ok(html.includes(messages.Subscription.quotaNotice));assert.ok(html.includes(messages.Subscription.occupied));assert.ok(html.includes(messages.Subscription.readOnly));assert.doesNotMatch(html,/<form|type="submit"/);
 }
});
test("owner sees period totals and explicit replacement; administrator cannot accept",()=>{
 const request={id:"00000000-0000-4000-8000-000000000002",organizationId:state.organizationId,organizationName:"Synthetic",planSlug:"start",months:3,status:"REQUESTED" as const,createdAt:"2026-09-30T10:00:00Z",acceptedAt:null,offer:null};
 const html=renderToStaticMarkup(createElement(NextIntlClientProvider,{locale:"en",messages:en,timeZone:"Europe/Zagreb",children:createElement(CommercialOverview,{state:{...state,canManage:true,requests:[request]},now:"2026-09-30T10:00:00Z"})}));
 assert.ok(html.includes(en.Subscription.replaceConfirm));assert.ok(html.includes(en.Subscription.priceNotice));assert.match(html,/147/);assert.match(html,/type="checkbox"/);
});

const offeredRequest: CommercialState["requests"][number] = {
 id:"00000000-0000-4000-8000-000000000002",organizationId:state.organizationId,organizationName:"Synthetic",planSlug:"start",months:3,status:"OFFERED",createdAt:"2026-09-30T10:00:00Z",acceptedAt:null,
 offer:{id:"00000000-0000-4000-8000-000000000003",createdAt:"2026-09-30T10:00:00Z",expiresAt:"2026-10-30T10:00:00Z",reference:{issuer:"Synthetic issuer",year:2026,number:"000123"},snapshot:{version:1,offerIssuedAt:"2026-09-30T10:00:00Z",planSlug:"start",months:3,currency:"EUR",netAmountCents:14700,totalAmountCents:18375,taxTreatment:"Synthetic VAT 25%",termsVersion:"terms-v1",limits:{maxPublishedProducts:25,maxStoredProducts:100,maxStorageBytes:2147483648,maxPdfAttachments:10},billingProfile:{legalName:"<script>Company</script>",addressLine1:"Test street 1",addressLine2:null,city:"Zagreb",postalCode:"00100",countryCode:"HR",billingEmail:"synthetic@example.invalid",taxIdentifier:"0012345",vatIdentifier:null},billingRevision:2,timezone:"Europe/Zagreb",startPolicy:"ON_PAYMENT",scheduledStart:null,scheduledEnd:null,anchor:null,publicRetentionMonths:6,privateRetentionMonths:12}}
};
function renderState(commercial:CommercialState,operator=false,now="2026-09-30T10:00:00Z") {
 return renderToStaticMarkup(createElement(NextIntlClientProvider,{locale:"en",messages:en,timeZone:"Europe/Zagreb",children:createElement(CommercialOverview,{state:commercial,operator,now,allowSimulation:true})}));
}
test("offer acceptance displays immutable billing and all commercial terms, with expiry hiding acceptance",()=>{
 const owner={...state,canManage:true,requests:[offeredRequest]};
 const html=renderState(owner);
 for(const value of [en.Subscription.acceptConfirm,en.Subscription.retention,en.Subscription.tax,en.Subscription.storage,en.Subscription.pdfLimit,"183.75","terms-v1","Synthetic VAT 25%","00100","0012345","000123","Europe/Zagreb"])assert.ok(html.includes(value),value);
 assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
 assert.ok(renderState(owner,false,"2026-10-30T10:00:00Z").includes(en.Subscription.expired));
 assert.ok(!renderState(owner,false,"2026-10-30T10:00:00Z").includes(en.Subscription.acceptConfirm));
 assert.ok(!renderState({...owner,canManage:false}).includes(en.Subscription.acceptConfirm));
});
test("billing operator simulation is explicit, readonly operator has no forms and expired offers cannot be paid",()=>{
 const accepted={...state,canManage:true,requests:[{...offeredRequest,status:"ACCEPTED" as const}]};
 const html=renderState(accepted,true);
 assert.ok(!html.includes(en.Subscription.recordOffer));assert.ok(html.includes(en.Subscription.paymentConfirm));assert.ok(html.includes(en.Subscription.SIMULATED_PAYMENT));
 assert.match(html,/value="" disabled="" selected=""/);
 assert.doesNotMatch(renderState({...accepted,canManage:false},true),/<form/);
 const expired=renderState(accepted,true,"2026-10-30T10:00:00Z");assert.ok(!expired.includes(en.Subscription.paymentConfirm));assert.ok(!expired.includes(en.Subscription.recordOffer));assert.ok(expired.includes(en.Subscription.replaceAccepted));
});
test("production view omits simulation and displays occupied quota denominator with binary storage",()=>{
 const period={id:"period-1",planSlug:"start",start:"2026-09-01T10:00:00Z",end:"2026-12-01T11:00:00Z",paymentKind:"BANK_TRANSFER" as const,snapshot:offeredRequest.offer!.snapshot};
 const html=renderToStaticMarkup(createElement(NextIntlClientProvider,{locale:"en",messages:en,timeZone:"Europe/Zagreb",children:createElement(CommercialOverview,{state:{...state,canManage:true,renewalPlanSlug:"start",currentPeriod:period,requests:[{...offeredRequest,status:"ACCEPTED"}]},operator:true,now:"2026-09-30T10:00:00Z"})}));
 assert.ok(!html.includes('value="SIMULATED_PAYMENT"'));assert.ok(html.includes("7 / 25"));assert.ok(html.includes("11 / 100"));assert.ok(html.includes("2 GiB"));
});
test("external offer issuance is explicit Zagreb local time and long references wrap",()=>{
 const longReference="R".repeat(200);
 const request={...offeredRequest,offer:{...offeredRequest.offer!,reference:{issuer:longReference,year:2026,number:longReference}}};
 const html=renderState({...state,canManage:true,requests:[request]},true);
 assert.match(html,/<input(?=[^>]*name="issuedAtLocal")(?=[^>]*type="datetime-local")[^>]*>/);
 assert.doesNotMatch(html,/<input(?=[^>]*name="issuedAtLocal")(?=[^>]*value=)[^>]*>/);
 assert.match(html,/step="1"/);assert.ok(html.includes("Europe/Zagreb"));
 assert.match(html,/<h4 class="[^"]*\[overflow-wrap:anywhere\][^"]*">[\s\S]*?<span class="min-w-0 flex-1">[^<]*R{200}/);
});
test("all six offer views distinguish agreed expiry policy from enforcement available in this release",()=>{
 for(const locale of ["hr","en","de","sr","sl","pl"] as const){
  const messages={hr,en,de,sr,sl,pl}[locale];
  const html=renderToStaticMarkup(createElement(NextIntlClientProvider,{locale,messages,timeZone:"Europe/Zagreb",children:createElement(CommercialOverview,{state:{...state,requests:[offeredRequest]},now:"2026-09-30T10:00:00Z"})}));
  assert.ok(html.includes(messages.Subscription.contentLock));assert.ok(html.includes(messages.Subscription.quotaNotice));assert.ok(html.includes(messages.Subscription.issued));
 }
 assert.match(en.Subscription.contentLock,/require active rights/);assert.doesNotMatch(en.Subscription.quotaNotice,/not yet/);
});

test("downgrade consequences and excess limits appear before acceptance",()=>{
 const snapshot=offeredRequest.offer!.snapshot;
 const request={...offeredRequest,offer:{...offeredRequest.offer!,snapshot:{...snapshot,version:2 as const,changeKind:"DOWNGRADE" as const,basePeriodId:"00000000-0000-4000-8000-000000000004",baseLimits:snapshot.limits,downgradeWarnings:["STORAGE_LIMIT"]}}};
 const html=renderState({...state,canManage:true,requests:[request]});
 assert.ok(html.indexOf(en.Subscription.downgradeConsequence)<html.indexOf(en.Subscription.acceptConfirm));
 assert.ok(html.includes(en.Subscription.STORAGE_LIMIT));
});

test("expired blocked receipt retains replacement recovery independently of current denial reasons",()=>{
 const blocked={...state,canManage:true,unresolvedReplacementPeriodId:"00000000-0000-4000-8000-000000000099",entitlements:{kind:"EXPIRED",planSlug:"start",end:"2026-09-01T10:00:00Z",limits:null,blockedReasons:[]}};
 const html=renderState(blocked);
 assert.match(html,/<option value="REPLACEMENT" selected="">/);
 assert.ok(html.includes(en.Subscription.replacementConsequence));
 assert.doesNotMatch(renderState({...blocked,unresolvedReplacementPeriodId:null}),/<option value="REPLACEMENT"/);
});
