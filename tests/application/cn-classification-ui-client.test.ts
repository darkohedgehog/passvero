import assert from "node:assert/strict";
import test from "node:test";

import { mutateCnClassificationFromDashboard } from "../../src/application/products/cn-classification-current-draft/ui-client";

const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const payload = { operation: "ADD" as const, value: "01012100", nomenclatureYear: 2026, expectedDraftVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", expectedProductUpdatedAt: "2026-09-01T10:00:00.000Z", expectedDraftUpdatedAt: "2026-09-01T10:01:00.000Z" };

test("posts exactly once to the narrow same-origin CN route without numeric coercion", async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const result = await mutateCnClassificationFromDashboard(async (input, init) => { calls.push({ input, init }); return Response.json({ status: "ADDED" }); }, productId, payload);
  assert.deepEqual(result, { status: "SUCCESS" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input, `/api/products/${productId}/cn-classification`);
  assert.equal(calls[0].init?.method, "POST");
  assert.equal(calls[0].init?.credentials, "same-origin");
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), payload);
  assert.equal(typeof JSON.parse(String(calls[0].init?.body)).value, "string");
});

test("maps only safe UI outcomes and never retries", async () => {
  const outcomes = [
    [409, { status: "STALE_WRITE" }, { status: "STALE_WRITE" }],
    [409, { status: "CN_CONFLICT" }, { status: "CN_CONFLICT" }],
    [409, { status: "DRAFT_NOT_EDITABLE" }, { status: "DRAFT_NOT_EDITABLE" }],
    [400, { status: "VALIDATION_ERROR", field: "value" }, { status: "FIELD_ERROR", field: "value" }],
    [400, { status: "VALIDATION_ERROR", field: "nomenclatureYear" }, { status: "FIELD_ERROR", field: "nomenclatureYear" }],
    [403, { status: "FORBIDDEN" }, { status: "FORBIDDEN" }],
    [503, { status: "OPERATIONAL_FAILURE" }, { status: "FAILURE" }],
  ] as const;
  for (const [status, body, expected] of outcomes) {
    let calls = 0;
    const result = await mutateCnClassificationFromDashboard(async () => { calls += 1; return Response.json(body, { status }); }, productId, payload);
    assert.deepEqual(result, expected);
    assert.equal(calls, 1);
  }
});
