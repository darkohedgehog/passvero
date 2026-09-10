import assert from "node:assert/strict";
import test from "node:test";
import { createCreateDraftHttpHandler, canCreateDraftFromPublished } from "../../src/application/products/create-draft-from-published/http";
import { createDraftFromDashboard } from "../../src/application/products/create-draft-from-published/ui-client";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { ApplicationError } from "../../src/application/errors/application-error";
const context: AuthenticatedUserContext = { userId: "actor", organizationId: "org", membershipId: "member", membershipRole: "ADMIN", membershipStatus: "ACTIVE", permissions: ["PRODUCT_EDIT"], correlationId: "test" };
const productId = "11111111-1111-4111-8111-111111111111";
const data = { expectedCurrentPublishedVersionId: "22222222-2222-4222-8222-222222222222", expectedProductUpdatedAt: "2026-09-10T12:00:00.000Z" };
const origin = "https://passvero.example";
function request(payload: unknown = data, suppliedOrigin = origin) { return new Request(`${origin}/api/products/${productId}/draft`, { method: "POST", headers: { origin: suppliedOrigin, "content-type": "application/json" }, body: JSON.stringify(payload) }); }
test("only authorized active published-only Product offers creation", () => {
  assert.equal(canCreateDraftFromPublished(context, "ACTIVE", true, false), true);
  assert.equal(canCreateDraftFromPublished({ ...context, permissions: ["PRODUCT_READ"] }, "ACTIVE", true, false), false);
  assert.equal(canCreateDraftFromPublished(context, "ARCHIVED", true, false), false);
  assert.equal(canCreateDraftFromPublished(context, "ACTIVE", true, true), false);
  assert.equal(canCreateDraftFromPublished(context, "ACTIVE", false, false), false);
});
test("HTTP guards origin proxy auth and strict evidence before mutation", async () => {
  let writes = 0;
  const handler = createCreateDraftHttpHandler({ canonicalOrigin: origin, verifyProxy: () => true, resolveContext: async () => ({ status: "RESOLVED", context, presentation: { organizationName: "Test" } }), createDraft: async () => { writes++; return { status: "CREATED_NEW_DRAFT" }; } });
  assert.equal((await handler(request(data, "https://wrong.example"), productId)).status, 403);
  assert.equal((await handler(request({ ...data, organizationId: "foreign" }), productId)).status, 400);
  assert.equal(writes, 0);
  const response = await handler(request(), productId); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { status: "CREATED_NEW_DRAFT" }); assert.equal(response.headers.get("cache-control"), "no-store"); assert.equal(writes, 1);
});
test("image failure returns only a safe discriminator", async () => {
  const handler = createCreateDraftHttpHandler({ canonicalOrigin: origin, verifyProxy: () => true, resolveContext: async () => ({ status: "RESOLVED", context, presentation: { organizationName: "Test" } }), createDraft: async () => { throw new ApplicationError("INVALID_STATE", "CREATE_DRAFT_IMAGES_UNSUPPORTED", "private storage path", false); } });
  const response = await handler(request(), productId); assert.equal(response.status, 409); assert.deepEqual(await response.json(), { status: "IMAGES_UNSUPPORTED" });
});
test("client sends only stale-write evidence and never retries uncertain failure", async () => {
  let calls = 0;
  const result = await createDraftFromDashboard(async (_url, init) => { calls++; assert.deepEqual(JSON.parse(String(init?.body)), data); throw new Error("network"); }, productId, data);
  assert.equal(result.status, "OPERATIONAL_FAILURE"); assert.equal(calls, 1);
});
for (const status of ["CREATED_NEW_DRAFT", "EXISTING_DRAFT", "IMAGES_UNSUPPORTED", "CONFLICT"] as const) test(`client recognizes ${status}`, async () => {
  assert.deepEqual(await createDraftFromDashboard(async () => Response.json({ status }, { status: status.endsWith("DRAFT") ? 200 : 409 }), productId, data), { status });
});
