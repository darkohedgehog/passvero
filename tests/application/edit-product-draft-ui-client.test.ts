import assert from "node:assert/strict";
import test from "node:test";

import {
  editProductDraftFromDashboard,
  missingRequiredEditProductDraftField,
} from "../../src/application/products/edit-product-draft/edit-product-draft-ui-client";

const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const command = {
  productName: "Updated chair",
  organizationSku: "CHAIR-X",
  expectedDraftVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  expectedProductUpdatedAt: "2026-08-31T10:00:00.000Z",
  expectedDraftUpdatedAt: "2026-08-31T10:01:00.000Z",
  expectedSourceTranslationUpdatedAt: "2026-08-31T10:02:00.000Z",
};

function fakeFetch(response: Response) {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  return {
    requests,
    fetcher: async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: input.toString(), init });
      return response;
    },
  };
}

test("submits only editable values and concurrency evidence to the route product", async () => {
  const fixture = fakeFetch(Response.json({ status: "UPDATED" }));
  assert.deepEqual(
    await editProductDraftFromDashboard(fixture.fetcher, productId, command),
    { status: "SUCCESS" },
  );
  assert.deepEqual(fixture.requests, [{
    url: `/api/products/${productId}/edit`,
    init: {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command),
    },
  }]);
  assert.equal("productId" in JSON.parse(String(fixture.requests[0]?.init?.body)), false);
});

test("maps every safe form state without automatic retry", async () => {
  const cases = [
    [409, { status: "SKU_CONFLICT" }, { status: "FIELD_ERROR", field: "organizationSku", reason: "CONFLICT" }],
    [400, { status: "VALIDATION_ERROR", field: "productName" }, { status: "FIELD_ERROR", field: "productName", reason: "INVALID" }],
    [409, { status: "STALE_WRITE" }, { status: "STALE_WRITE" }],
    [409, { status: "DRAFT_NOT_EDITABLE" }, { status: "DRAFT_NOT_EDITABLE" }],
    [403, { status: "FORBIDDEN" }, { status: "FORBIDDEN" }],
    [503, { status: "OPERATIONAL_FAILURE" }, { status: "FAILURE" }],
  ] as const;
  for (const [status, responseBody, expected] of cases) {
    const fixture = fakeFetch(Response.json(responseBody, { status }));
    assert.deepEqual(await editProductDraftFromDashboard(fixture.fetcher, productId, command), expected);
    assert.equal(fixture.requests.length, 1);
  }
});

test("detects only the required product name before transport", () => {
  assert.equal(missingRequiredEditProductDraftField({ ...command, productName: "" }), "productName");
  assert.equal(missingRequiredEditProductDraftField({ ...command, productName: " " }), null);
  assert.equal(missingRequiredEditProductDraftField(command), null);
});
