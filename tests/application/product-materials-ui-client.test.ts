import assert from "node:assert/strict";
import test from "node:test";

import {
  mutateProductMaterialFromDashboard,
} from "../../src/application/products/product-materials-current-draft/ui-client";

const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const payload = {
  operation: "ADD" as const,
  materialName: "Steel",
  category: null,
  percentage: "40.00",
  isRecycled: true,
  recycledPercentage: "75.00",
  expectedDraftVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  expectedProductUpdatedAt: "2026-09-01T10:00:00.000Z",
  expectedDraftUpdatedAt: "2026-09-01T10:01:00.000Z",
};

test("posts exactly once to the narrow same-origin material route", async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const result = await mutateProductMaterialFromDashboard(async (input, init) => {
    calls.push({ input, init });
    return Response.json({ status: "ADDED" });
  }, productId, payload);
  assert.deepEqual(result, { status: "SUCCESS" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input, `/api/products/${productId}/materials`);
  assert.equal(calls[0].init?.method, "POST");
  assert.equal(calls[0].init?.credentials, "same-origin");
  assert.equal(calls[0].init?.cache, "no-store");
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), payload);
});

test("maps only safe transport outcomes without retrying", async () => {
  const outcomes = [
    [409, "STALE_WRITE", { status: "STALE_WRITE" }],
    [409, "DRAFT_NOT_EDITABLE", { status: "DRAFT_NOT_EDITABLE" }],
    [400, "COLLECTION_INVALID", { status: "COLLECTION_INVALID" }],
    [400, "VALIDATION_ERROR", { status: "FIELD_ERROR", field: "materialName" }],
    [403, "FORBIDDEN", { status: "FORBIDDEN" }],
    [503, "OPERATIONAL_FAILURE", { status: "FAILURE" }],
  ] as const;
  for (const [status, responseStatus, expected] of outcomes) {
    let calls = 0;
    const result = await mutateProductMaterialFromDashboard(async () => {
      calls += 1;
      return Response.json(
        responseStatus === "VALIDATION_ERROR"
          ? { status: responseStatus, field: "materialName" }
          : { status: responseStatus },
        { status },
      );
    }, productId, payload);
    assert.deepEqual(result, expected);
    assert.equal(calls, 1);
  }
});
