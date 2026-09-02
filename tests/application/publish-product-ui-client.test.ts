import assert from "node:assert/strict";
import test from "node:test";
import { publishProductFromDashboard } from "../../src/application/products/publish-product/ui-client";

test("posts only publication evidence and accepts bounded results", async () => {
  let received: RequestInit | undefined;
  const result = await publishProductFromDashboard(async (_input, init) => { received = init; return new Response(JSON.stringify({ status: "PUBLISHED", versionNumber: 2 }), { status: 200, headers: { "content-type": "application/json" } }); }, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", { expectedDraftVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", expectedProductUpdatedAt: "2026-09-02T08:00:00.000Z", expectedDraftUpdatedAt: "2026-09-02T08:01:00.000Z", expectedCurrentPublishedVersionId: null });
  assert.deepEqual(result, { status: "PUBLISHED", versionNumber: 2 });
  assert.equal(received?.method, "POST");
});

test("collapses malformed responses", async () => {
  const result = await publishProductFromDashboard(async () => new Response(JSON.stringify({ status: "PUBLISHED", versionNumber: "secret" }), { status: 200 }), "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", { expectedDraftVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", expectedProductUpdatedAt: "2026-09-02T08:00:00.000Z", expectedDraftUpdatedAt: "2026-09-02T08:01:00.000Z", expectedCurrentPublishedVersionId: null });
  assert.deepEqual(result, { status: "FAILURE" });
});

test("never retries and rejects a success payload carried by a failed response", async () => {
  let calls = 0;
  const result = await publishProductFromDashboard(async () => { calls += 1; return new Response(JSON.stringify({ status: "PUBLISHED", versionNumber: 1 }), { status: 503 }); }, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", { expectedDraftVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", expectedProductUpdatedAt: "2026-09-02T08:00:00.000Z", expectedDraftUpdatedAt: "2026-09-02T08:01:00.000Z", expectedCurrentPublishedVersionId: null });
  assert.deepEqual(result, { status: "FAILURE" });
  assert.equal(calls, 1);
});

test("accepts only bounded publication readiness reasons", async () => {
  const payload = { expectedDraftVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", expectedProductUpdatedAt: "2026-09-02T08:00:00.000Z", expectedDraftUpdatedAt: "2026-09-02T08:01:00.000Z", expectedCurrentPublishedVersionId: null };
  for (const reason of ["SOURCE_TRANSLATION", "PRODUCT_NAME", "PUBLIC_ASSET"] as const) {
    const result = await publishProductFromDashboard(async () => new Response(JSON.stringify({ status: "NOT_READY", reason }), { status: 409 }), "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", payload);
    assert.deepEqual(result, { status: "NOT_READY", reason });
  }
  const malformed = await publishProductFromDashboard(async () => new Response(JSON.stringify({ status: "NOT_READY", reason: "SECRET_DATABASE_DETAIL" }), { status: 409 }), "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", payload);
  assert.deepEqual(malformed, { status: "FAILURE" });
});
