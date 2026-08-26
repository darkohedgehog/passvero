import assert from "node:assert/strict";
import test from "node:test";

import {
  createProductFromDashboard,
  missingRequiredCreateProductField,
} from "../../src/application/products/create-product/create-product-ui-client";

type CapturedRequest = Readonly<{ url: string; init: RequestInit | undefined }>;

function fakeFetch(response: Response) {
  const requests: CapturedRequest[] = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: input.toString(), init });
    return response;
  };
  return { fetcher, requests };
}

test("submits exactly the three canonical fields once to the explicit endpoint", async () => {
  const fixture = fakeFetch(Response.json(
    { status: "CREATED", productId: "must-not-enter-the-ui-result" },
    { status: 201 },
  ));
  const result = await createProductFromDashboard(fixture.fetcher, {
    initialProductName: "Industrial Chair",
    organizationSku: "CHAIR-1",
    initialLocale: "de",
  });

  assert.deepEqual(result, { status: "SUCCESS" });
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.requests[0]?.url, "/api/products/create");
  assert.deepEqual(fixture.requests[0]?.init, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      initialProductName: "Industrial Chair",
      organizationSku: "CHAIR-1",
      initialLocale: "de",
    }),
  });
});

test("preserves an omitted SKU without adding any authority fields", async () => {
  const fixture = fakeFetch(Response.json({ status: "CREATED" }, { status: 201 }));
  await createProductFromDashboard(fixture.fetcher, {
    initialProductName: "Chair",
    initialLocale: "en",
  });
  assert.deepEqual(JSON.parse(String(fixture.requests[0]?.init?.body)), {
    initialProductName: "Chair",
    initialLocale: "en",
  });
});

test("distinguishes safe invalid-field and SKU-conflict results", async () => {
  const invalid = fakeFetch(Response.json(
    { status: "VALIDATION_ERROR", field: "organizationSku" },
    { status: 400 },
  ));
  const conflict = fakeFetch(Response.json(
    { status: "VALIDATION_ERROR", field: "organizationSku", detail: "ignored" },
    { status: 409 },
  ));
  const forbidden = fakeFetch(Response.json({ status: "FORBIDDEN" }, { status: 403 }));
  const malformed = fakeFetch(new Response("Prisma details", { status: 500 }));

  assert.deepEqual(await createProductFromDashboard(invalid.fetcher, {
    initialProductName: "Chair",
    initialLocale: "en",
  }), { status: "FIELD_ERROR", field: "organizationSku", reason: "INVALID" });
  assert.deepEqual(await createProductFromDashboard(conflict.fetcher, {
    initialProductName: "Chair",
    initialLocale: "en",
  }), { status: "FIELD_ERROR", field: "organizationSku", reason: "CONFLICT" });
  assert.deepEqual(await createProductFromDashboard(forbidden.fetcher, {
    initialProductName: "Chair",
    initialLocale: "en",
  }), { status: "FORBIDDEN" });
  assert.deepEqual(await createProductFromDashboard(malformed.fetcher, {
    initialProductName: "Chair",
    initialLocale: "en",
  }), { status: "FAILURE" });
});

test("detects only structurally missing required form fields", () => {
  assert.equal(missingRequiredCreateProductField({
    initialProductName: "",
    initialLocale: "en",
  }), "initialProductName");
  assert.equal(missingRequiredCreateProductField({
    initialProductName: "Chair",
    initialLocale: "",
  }), "initialLocale");
  assert.equal(missingRequiredCreateProductField({
    initialProductName: " ",
    initialLocale: "en",
  }), null);
});
