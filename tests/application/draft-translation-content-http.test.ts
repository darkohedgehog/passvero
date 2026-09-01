import assert from "node:assert/strict";
import test from "node:test";
import { createDraftTranslationContentHttpHandler } from "../../src/application/products/draft-translation-content/draft-translation-content-http";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";

const context: AuthenticatedUserContext = { userId: "u", organizationId: "o", membershipId: "m", membershipRole: "EDITOR", membershipStatus: "ACTIVE", permissions: ["PRODUCT_EDIT"], correlationId: "c" };
const fields = { shortDescription: null, description: null, technicalDescription: null, repairInstructions: null, sparePartsInformation: null, recyclingInstructions: null, disposalInstructions: null, packagingInformation: null, safetyInformation: null };
const evidence = { expectedDraftVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", expectedProductUpdatedAt: "2026-09-01T10:00:00.000Z", expectedDraftUpdatedAt: "2026-09-01T10:01:00.000Z", expectedSourceTranslationUpdatedAt: "2026-09-01T10:02:00.000Z" };

test("accepts only content and concurrency keys while product authority comes from route", async () => {
  let received: unknown;
  const handler = createDraftTranslationContentHttpHandler({ canonicalOrigin: "https://passvero.test", resolveContext: async () => ({ status: "RESOLVED" as const, context, userLabel: "User", presentation: { organizationName: "Org" } }), update: async (command) => { received = command; return { productId: command.productId, status: "UPDATED" }; } });
  const response = await handler(new Request("https://passvero.test/api/products/route-id/draft-translation-content", { method: "POST", headers: { origin: "https://passvero.test", "content-type": "application/json" }, body: JSON.stringify({ ...fields, ...evidence }) }), "route-id");
  assert.equal(response.status, 200);
  assert.deepEqual(received, { productId: "route-id", ...fields, ...evidence });
  for (const forbidden of ["organizationId", "locale", "translationId", "versionId", "status", "role"]) {
    const denied = await handler(new Request("https://passvero.test/api/products/route-id/draft-translation-content", { method: "POST", headers: { origin: "https://passvero.test", "content-type": "application/json" }, body: JSON.stringify({ ...fields, ...evidence, [forbidden]: "attacker" }) }), "route-id");
    assert.equal(denied.status, 400);
  }
});
