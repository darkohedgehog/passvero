import assert from "node:assert/strict";
import test from "node:test";

import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { ApplicationError } from "../../src/application/errors/application-error";
import {
  createProductMaterialsHttpHandler,
} from "../../src/application/products/product-materials-current-draft/http";

const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const materialId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const context: AuthenticatedUserContext = {
  userId: "user-id",
  organizationId: "organization-id",
  membershipId: "membership-id",
  membershipRole: "EDITOR",
  membershipStatus: "ACTIVE",
  permissions: ["PRODUCT_READ", "PRODUCT_EDIT"],
  correlationId: "correlation-id",
};
const aggregateEvidence = {
  expectedDraftVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  expectedProductUpdatedAt: "2026-09-01T10:00:00.000Z",
  expectedDraftUpdatedAt: "2026-09-01T10:01:00.000Z",
};
const values = {
  materialName: "Steel",
  category: "Metal",
  percentage: "40.00",
  isRecycled: true,
  recycledPercentage: "75.00",
};

function request(body: unknown, init: { origin?: string; method?: string } = {}) {
  return new Request(`https://passvero.test/api/products/${productId}/materials`, {
    method: init.method ?? "POST",
    headers: {
      origin: init.origin ?? "https://passvero.test",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function fixture(overrides: {
  context?: AuthenticatedUserContext | null;
  error?: ApplicationError;
} = {}) {
  const calls: Array<{ operation: string; command: unknown }> = [];
  const resolved = overrides.context === null
    ? { status: "DENIED" as const, reason: "NO_PROVIDER_SESSION" as const }
    : { status: "RESOLVED" as const, context: overrides.context ?? context, userLabel: "User", presentation: { organizationName: "Org" } };
  const complete = async (operation: string, command: unknown) => {
    calls.push({ operation, command });
    if (overrides.error) throw overrides.error;
    return { productId, status: operation === "ADD" ? "ADDED" : operation === "EDIT" ? "UPDATED" : "REMOVED" } as never;
  };
  const handler = createProductMaterialsHttpHandler({
    canonicalOrigin: "https://passvero.test",
    resolveContext: async () => resolved,
    add: (command) => complete("ADD", command),
    edit: (command) => complete("EDIT", command),
    remove: (command) => complete("REMOVE", command),
  });
  return { calls, handler };
}

test("dispatches only allowlisted ADD EDIT and REMOVE payloads with route-owned productId", async () => {
  const subject = fixture();
  const payloads = [
    { operation: "ADD", ...values, ...aggregateEvidence },
    { operation: "EDIT", materialId, ...values, ...aggregateEvidence, expectedMaterialUpdatedAt: "2026-09-01T10:02:00.000Z" },
    { operation: "REMOVE", materialId, ...aggregateEvidence, expectedMaterialUpdatedAt: "2026-09-01T10:02:00.000Z" },
  ] as const;
  for (const payload of payloads) {
    const response = await subject.handler(request(payload), productId);
    assert.equal(response.status, 200);
    assert.equal((await response.json() as { status: string }).status, payload.operation === "ADD" ? "ADDED" : payload.operation === "EDIT" ? "UPDATED" : "REMOVED");
  }
  assert.deepEqual(subject.calls.map(({ operation }) => operation), ["ADD", "EDIT", "REMOVE"]);
  for (const [index, payload] of payloads.entries()) {
    const allowed = Object.fromEntries(
      Object.entries(payload).filter(([key]) => key !== "operation"),
    );
    assert.deepEqual(subject.calls[index].command, { productId, ...allowed });
  }
});

test("rejects authority fields extra editable fields malformed shapes and non-same-origin requests", async () => {
  const base = { operation: "ADD", ...values, ...aggregateEvidence };
  for (const forbidden of [
    "organizationId", "productVersionId", "userId", "membershipId", "actorId",
    "createdAt", "updatedAt", "supplier", "notes", "publishedVersionId", "id",
  ]) {
    const response = await fixture().handler(request({ ...base, [forbidden]: "attacker" }), productId);
    assert.equal(response.status, 400, forbidden);
    assert.deepEqual(await response.json(), { status: "VALIDATION_ERROR" }, forbidden);
  }
  assert.equal((await fixture().handler(request({ ...base, operation: "REPLACE" }), productId)).status, 400);
  assert.equal((await fixture().handler(request({ ...base, percentage: 40 }), productId)).status, 400);
  assert.equal((await fixture().handler(request(base, { origin: "https://attacker.test" }), productId)).status, 403);
  assert.equal((await fixture().handler(request(base, { method: "PUT" }), productId)).status, 403);
  assert.equal((await fixture({ context: null }).handler(request(base), productId)).status, 401);
});

test("maps only safe material outcomes and never returns internal details", async () => {
  const cases = [
    [new ApplicationError("CONFLICT", "PRODUCT_MATERIALS_STALE_WRITE", "raw", false, "c"), 409, "STALE_WRITE"],
    [new ApplicationError("INVALID_STATE", "PRODUCT_MATERIALS_DRAFT_NOT_EDITABLE", "raw", false, "c"), 409, "DRAFT_NOT_EDITABLE"],
    [new ApplicationError("VALIDATION", "PRODUCT_MATERIALS_COLLECTION_INVALID", "raw", false, "c"), 400, "COLLECTION_INVALID"],
    [new ApplicationError("NOT_FOUND", "PRODUCT_MATERIALS_NOT_FOUND", "raw", false, "c"), 404, "NOT_FOUND"],
    [new ApplicationError("FORBIDDEN", "PRODUCT_MATERIALS_FORBIDDEN", "raw", false, "c"), 403, "FORBIDDEN"],
    [new ApplicationError("INTERNAL", "PRODUCT_MATERIALS_OPERATIONAL_FAILURE", "Prisma secret", false, "c"), 503, "OPERATIONAL_FAILURE"],
  ] as const;
  for (const [error, status, safeStatus] of cases) {
    const response = await fixture({ error }).handler(request({ operation: "ADD", ...values, ...aggregateEvidence }), productId);
    assert.equal(response.status, status);
    const body = JSON.stringify(await response.json());
    assert.match(body, new RegExp(safeStatus));
    assert.doesNotMatch(body, /raw|Prisma|secret|Steel|Metal|40\.00|75\.00/);
    assert.equal(response.headers.get("cache-control"), "no-store, private");
  }
});
