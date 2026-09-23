import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { BillingProfileForm } from "../../src/components/application/billing/billing-profile-form";
import en from "../../messages/en.json";
import hr from "../../messages/hr.json";
import sr from "../../messages/sr.json";
import de from "../../messages/de.json";
import sl from "../../messages/sl.json";
import pl from "../../messages/pl.json";
test("billing form labels, required fields, autocomplete and leading zeros in all locales",()=>{
 for(const locale of ["hr","sr","en","de","sl","pl"] as const) {
  const messages={hr,sr,en,de,sl,pl}[locale];
  assert.deepEqual(Object.keys(messages.BillingProfile).sort(),Object.keys(en.BillingProfile).sort());
  // The provider type requires children in props for React.createElement overload resolution.
  // eslint-disable-next-line react/no-children-prop
  const html=renderToStaticMarkup(createElement(NextIntlClientProvider,{locale,messages,timeZone:"Europe/Zagreb",children:createElement(BillingProfileForm,{profile:null})}));
  assert.match(html,/autocomplete="organization"/i);assert.match(html,/autocomplete="country"/i);assert.match(html,/type="email"/);assert.equal((html.match(/required=""/g)??[]).length,5);assert.match(html,/aria-hidden="true"/);assert.ok(html.includes(messages.BillingProfile.empty));
  if(locale==="sr")assert.ok(html.includes("Hrvatska (HR)"),"Serbian country names must use Latin script");
  assert.doesNotMatch(html,/organizationId|<input[^>]*type="number"/);
 }
});
