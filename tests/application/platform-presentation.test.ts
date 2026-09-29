/* eslint-disable react/no-children-prop */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { OrganizationsView, OrganizationDetailView } from "../../src/components/application/platform/organizations-view";
import en from "../../messages/en.json";
import hr from "../../messages/hr.json";
import sr from "../../messages/sr.json";
import de from "../../messages/de.json";
import sl from "../../messages/sl.json";
import pl from "../../messages/pl.json";
test("six-locale organization list/detail/empty profile preserve read-only semantics and safe text",()=>{
 const organization={id:"00000000-0000-4000-8000-000000000001",displayName:"<script>synthetic</script>",status:"ACTIVE" as const,createdAt:new Date("2026-09-29T12:00:00Z"),hasBillingProfile:false,billingProfile:null};
 for(const locale of ["hr","sr","en","de","sl","pl"] as const) {
  const messages={hr,sr,en,de,sl,pl}[locale];
  assert.deepEqual(Object.keys(messages.PlatformAdmin).sort(),Object.keys(en.PlatformAdmin).sort());
  const views=[createElement(OrganizationsView,{page:{items:[organization],nextCursor:null},q:"",locale}),createElement(OrganizationDetailView,{organization,locale}),createElement(OrganizationDetailView,{organization:{...organization,hasBillingProfile:true,billingProfile:{legalName:"Synthetic",addressLine1:"Test",addressLine2:null,city:"Test",postalCode:"00100",countryCode:"HR",billingEmail:"synthetic@example.invalid",taxIdentifier:"000123",vatIdentifier:null,updatedAt:organization.createdAt}},locale})];
  // NextIntlClientProvider requires children in its createElement props type.
  const html=views.map(children=>renderToStaticMarkup(createElement(NextIntlClientProvider,{locale,messages,timeZone:"Europe/Zagreb",children}))).join("");
  assert.ok(html.includes(messages.PlatformAdmin.emptyProfile));assert.ok(html.includes(messages.PlatformAdmin.notice));assert.ok(html.includes("000123"));assert.ok(html.includes("00100"));assert.ok(html.includes('maxLength="100"'));assert.match(html,/for="organization-search"/);assert.doesNotMatch(html,/<script>|type="submit"[^>]*>Save/);assert.ok(html.includes(messages.PlatformAdmin.notProvided));
  if(locale==="sr")assert.ok(html.includes("Hrvatska (HR)"));
 }
});

test("search reset, distinct empty states and next-page links keep bounded query semantics",()=>{
 const render=(q:string,nextCursor:string|null)=>renderToStaticMarkup(createElement(NextIntlClientProvider,{locale:"en",messages:en,timeZone:"Europe/Zagreb",children:createElement(OrganizationsView,{page:{items:[],nextCursor},q,locale:"en"})}));
 const empty=render("",null);
 assert.ok(empty.includes(en.PlatformAdmin.emptyOrganizations));
 assert.ok(!empty.includes(en.PlatformAdmin.reset));
 const filtered=render("Synthetic & Co","00000000-0000-4000-8000-000000000001");
 assert.ok(filtered.includes(en.PlatformAdmin.empty));
 assert.ok(filtered.includes(en.PlatformAdmin.reset));
 assert.ok(filtered.includes("q=Synthetic+%26+Co"));
 assert.ok(filtered.includes("cursor=00000000-0000-4000-8000-000000000001"));
});
