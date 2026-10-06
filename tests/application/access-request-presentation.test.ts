/* eslint-disable react/no-children-prop */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { AccessRequestsView } from "../../src/components/application/platform/access-requests-view";
import en from "../../messages/en.json";
import hr from "../../messages/hr.json";
import sr from "../../messages/sr.json";
import de from "../../messages/de.json";
import sl from "../../messages/sl.json";
import pl from "../../messages/pl.json";

test("six-locale review displays retained request and delivery separately, escapes PII, offers no writes", () => {
  for (const locale of ["hr","sr","en","de","sl","pl"] as const) {
    const messages = {hr,sr,en,de,sl,pl}[locale];
    assert.deepEqual(Object.keys(messages.AccessRequests).sort(), Object.keys(en.AccessRequests).sort());
    const row = {id:"00000000-0000-4000-8000-000000000001",contactName:"<script>synthetic</script>",email:"synthetic@example.invalid",organizationDisplayName:"Synthetic <Org>",locale:"hr",status:"PENDING",createdAt:new Date("2026-10-05T07:50:00Z"),decidedAt:null,deliveryStatus:"NOT_STARTED",deliveryAttempts:0,deliveredAt:null,adminNotification:null};
    const html = renderToStaticMarkup(createElement(NextIntlClientProvider, {locale,messages,timeZone:"Europe/Zagreb",children:createElement(AccessRequestsView,{page:{items:[row],nextCursor:row.id},status:"PENDING",locale})}));
    assert.ok(html.includes(messages.AccessRequests.PENDING));
    assert.ok(html.includes(messages.AccessRequests.NOT_STARTED));
    assert.ok(html.includes(row.id));
    assert.ok(html.includes("synthetic@example.invalid"));
    assert.match(html, /&lt;script&gt;synthetic&lt;\/script&gt;/);
    assert.match(html, /method="get"/);
    assert.match(html, /cursor=00000000-0000-4000-8000-000000000001/);
    assert.doesNotMatch(html, /<script>|method="post"|activationUrl|tokenDigest|retry-delivery/);
    const empty = renderToStaticMarkup(createElement(NextIntlClientProvider, {locale,messages,timeZone:"Europe/Zagreb",children:createElement(AccessRequestsView,{page:{items:[],nextCursor:null},status:"PENDING",locale})}));
    assert.ok(empty.includes(messages.AccessRequests.empty));
  }
});
