import assert from "node:assert/strict";
import test from "node:test";

import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { ApplicationError } from "../../src/application/errors/application-error";
import type { PublishProduct } from "../../src/application/products/publish-product/contracts";
import { createPublishProductHttpHandler } from "../../src/application/products/publish-product/http";
import * as publishProductHttp from "../../src/application/products/publish-product/http";

const origin = "https://passvero.eu";
const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const context = { userId: "22222222-2222-4222-8222-222222222222", organizationId: "11111111-1111-4111-8111-111111111111", membershipId: "33333333-3333-4333-8333-333333333333", membershipRole: "ADMIN" as const, membershipStatus: "ACTIVE" as const, permissions: ["PRODUCT_READ", "PRODUCT_PUBLISH"] as const, correlationId: "correlation" };
const body = { expectedDraftVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", expectedProductUpdatedAt: "2026-09-02T08:00:00.000Z", expectedDraftUpdatedAt: "2026-09-02T08:01:00.000Z", expectedCurrentPublishedVersionId: null };

function request(payload: unknown = body, requestOrigin = origin) { return new Request(`${origin}/api/products/${productId}/publish`, { method: "POST", headers: { origin: requestOrigin, "content-type": "application/json" }, body: JSON.stringify(payload) }); }
function fixture(publish?: PublishProduct) {
  const calls: unknown[] = [];
  return { calls, handler: createPublishProductHttpHandler({ canonicalOrigin: origin, async resolveContext() { return { status: "RESOLVED" as const, context, presentation: { organizationName: "Org" } }; }, publish: publish ?? (async (command, received) => { calls.push({ command, received }); return { productId, status: "PUBLISHED", versionNumber: 1 }; }) }) };
}

test("accepts only the evidence payload and returns the publication result", async () => {
  const subject = fixture();
  const response = await subject.handler(request(), productId);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "PUBLISHED", versionNumber: 1 });
  assert.deepEqual(subject.calls, [{ command: { productId, ...body }, received: context }]);
});

test("rejects cross-origin and client authority before invoking the service", async () => {
  for (const candidate of [request(body, "https://attacker.example"), request({ ...body, organizationId: context.organizationId }), request({ ...body, versionNumber: 9 })]) {
    const subject = fixture();
    const response = await subject.handler(candidate, productId);
    assert.ok([400, 403].includes(response.status));
    if (response.status === 400) assert.deepEqual(await response.json(), { status: "VALIDATION_ERROR" });
    assert.equal(subject.calls.length, 0);
  }
});

test("shows Publish only for active Admin or Owner products with an editable source status", () => {
  const canShow = (publishProductHttp as Record<string, unknown>).canShowPublishProductAction;
  assert.equal(typeof canShow, "function");
  const predicate = canShow as (candidate: AuthenticatedUserContext, lifecycle: "ACTIVE" | "ARCHIVED", status: "DRAFT" | "READY_FOR_REVIEW" | "PUBLISHED" | null) => boolean;
  assert.equal(predicate(context, "ACTIVE", "DRAFT"), true);
  assert.equal(predicate({ ...context, membershipRole: "OWNER" }, "ACTIVE", "READY_FOR_REVIEW"), true);
  assert.equal(predicate({ ...context, membershipRole: "EDITOR", permissions: ["PRODUCT_READ"] }, "ACTIVE", "DRAFT"), false);
  assert.equal(predicate(context, "ARCHIVED", "DRAFT"), false);
  assert.equal(predicate(context, "ACTIVE", "PUBLISHED"), false);
  assert.equal(predicate(context, "ACTIVE", null), false);
});

test("maps safe publication outcomes without leaking errors", async () => {
  for (const [error, status, payload] of [
    [new ApplicationError("CONFLICT", "PUBLISH_PRODUCT_STALE_WRITE", "hidden", false), 409, { status: "STALE_WRITE" }],
    [new ApplicationError("INVALID_STATE", "PUBLISH_PRODUCT_NOT_READY_SOURCE_TRANSLATION", "hidden", false), 409, { status: "NOT_READY", reason: "SOURCE_TRANSLATION" }],
    [new ApplicationError("INVALID_STATE", "PUBLISH_PRODUCT_NOT_READY_PRODUCT_NAME", "hidden", false), 409, { status: "NOT_READY", reason: "PRODUCT_NAME" }],
    [new ApplicationError("INVALID_STATE", "PUBLISH_PRODUCT_NOT_READY_PUBLIC_ASSET", "hidden", false), 409, { status: "NOT_READY", reason: "PUBLIC_ASSET" }],
    [new ApplicationError("INVALID_STATE", "PUBLISH_PRODUCT_INVALID_STATE", "hidden", false), 409, { status: "INVALID_STATE" }],
    [new ApplicationError("NOT_FOUND", "PUBLISH_PRODUCT_NOT_FOUND", "hidden", false), 404, { status: "NOT_FOUND" }],
    [new ApplicationError("VALIDATION", "PUBLISH_PRODUCT_VALIDATION_ERROR", "hidden", false), 400, { status: "VALIDATION_ERROR" }],
    [new Error("Prisma constraint secret"), 503, { status: "OPERATIONAL_FAILURE" }],
  ] as const) {
    const subject = fixture(async () => { throw error; });
    const response = await subject.handler(request(), productId);
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), payload);
  }
});
