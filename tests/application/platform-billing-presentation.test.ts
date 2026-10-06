/* eslint-disable react/no-children-prop */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { CommercialRequestsView } from "../../src/components/application/subscriptions/commercial-requests-view";
import { ReviewBadge } from "../../src/components/application/platform/review-ui";
import type { RequestDto } from "../../src/application/subscriptions/contracts";
import hr from "../../messages/hr.json";
import en from "../../messages/en.json";
import de from "../../messages/de.json";
import sr from "../../messages/sr.json";
import sl from "../../messages/sl.json";
import pl from "../../messages/pl.json";

test("six-locale billing list preserves read-only links, status meaning and long values", () => {
  const request: RequestDto = {id:"00000000-0000-4000-8000-000000000002",organizationId:"00000000-0000-4000-8000-000000000001",organizationName:"Synthetic <Company> "+"L".repeat(200),planSlug:"start",months:3,status:"ACCEPTED",createdAt:"2026-10-06T10:00:00Z",acceptedAt:"2026-10-06T10:01:00Z",offer:null};
  for (const locale of ["hr","en","de","sr","sl","pl"] as const) {
    const messages={hr,en,de,sr,sl,pl}[locale];
    const render = (requests: RequestDto[] | undefined) => renderToStaticMarkup(createElement(NextIntlClientProvider,{locale,messages,timeZone:"Europe/Zagreb",children:createElement(CommercialRequestsView,{requests})}));
    const html=render([request]);
    assert.ok(html.includes(messages.Subscription.ACCEPTED));
    assert.ok(html.includes(messages.Subscription.open));
    assert.ok(html.includes("&lt;Company&gt;"));
    assert.match(html,/overflow-wrap:anywhere/);
    assert.match(html,/aria-hidden="true"/);
    assert.doesNotMatch(html,/<form|type="submit"|<script>/);
    assert.ok(render([]).includes(messages.Subscription.empty));
    assert.match(render(undefined),/role="alert"/);
  }
});
test("sent-email badge is neutral and carries text without an inbox-success icon", () => {
  const html=renderToStaticMarkup(createElement(ReviewBadge,{status:"SENT",children:"Provider accepted"}));
  assert.match(html,/bg-slate-100/);
  assert.doesNotMatch(html,/<svg|bg-teal-50/);
  assert.ok(html.includes("Provider accepted"));
});
