import assert from "node:assert/strict";
import test from "node:test";

import {
  selectDashboardOrganization,
  signOutFromDashboard,
} from "../../src/application/context/dashboard-ui-client";

type CapturedRequest = Readonly<{ url: string; init: RequestInit | undefined }>;

function fakeFetch(response: Response) {
  const requests: CapturedRequest[] = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: input.toString(), init });
    return response;
  };
  return { fetcher, requests };
}

test("organization selection sends only the target ID to the validated transport", async () => {
  const fixture = fakeFetch(Response.json({ status: "SELECTED" }));

  const result = await selectDashboardOrganization(
    fixture.fetcher,
    "9d901304-4fbf-47aa-a1fe-45ac71da55f5",
  );

  assert.equal(result, "SUCCESS");
  assert.equal(fixture.requests[0]?.url, "/api/auth/organization-selection");
  assert.deepEqual(fixture.requests[0]?.init, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      targetOrganizationId: "9d901304-4fbf-47aa-a1fe-45ac71da55f5",
    }),
  });
});

test("dashboard sign-out uses only the existing endpoint and generic result", async () => {
  const fixture = fakeFetch(Response.json({
    status: "SIGNED_OUT",
    providerSession: "must-not-be-consumed",
  }));

  assert.equal(await signOutFromDashboard(fixture.fetcher), "SUCCESS");
  assert.equal(fixture.requests[0]?.url, "/api/auth/sign-out");
  assert.equal(fixture.requests[0]?.init?.method, "POST");
  assert.equal(fixture.requests[0]?.init?.credentials, "same-origin");
  assert.equal(fixture.requests[0]?.init?.referrerPolicy, "no-referrer");
  assert.equal(fixture.requests[0]?.init?.body, undefined);
});

test("dashboard mutations fail closed on malformed and operational responses", async () => {
  const malformed = fakeFetch(new Response("provider detail", { status: 500 }));
  const denied = fakeFetch(Response.json({ status: "DENIED" }, { status: 403 }));

  assert.equal(await signOutFromDashboard(malformed.fetcher), "FAILURE");
  assert.equal(
    await selectDashboardOrganization(
      denied.fetcher,
      "9d901304-4fbf-47aa-a1fe-45ac71da55f5",
    ),
    "FAILURE",
  );
});
