import assert from "node:assert/strict";
import test from "node:test";

import type { AuthenticatedUserContextResolution } from "../../src/application/context/resolve-authenticated-user-context";
import { ApplicationError } from "../../src/application/errors/application-error";
import { PRODUCT_EDIT } from "../../src/application/permissions/product-permissions";
import type { EditProductDraft } from "../../src/application/products/edit-product-draft/contracts";
import {
  canShowEditProductDraftAction,
  classifyEditProductDraftPageAccess,
  createEditProductDraftHttpHandler,
} from "../../src/application/products/edit-product-draft/edit-product-draft-http";

const canonicalOrigin = "https://passvero.eu";
const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const context = {
  userId: "22222222-2222-4222-8222-222222222222",
  organizationId: "11111111-1111-4111-8111-111111111111",
  membershipId: "33333333-3333-4333-8333-333333333333",
  membershipRole: "EDITOR" as const,
  membershipStatus: "ACTIVE" as const,
  permissions: ["PRODUCT_READ", PRODUCT_EDIT] as const,
  correlationId: "server-correlation-id",
};
const resolved: AuthenticatedUserContextResolution = {
  status: "RESOLVED",
  context,
  presentation: { organizationName: "Organization A" },
};
const payload = {
  productName: "Updated chair",
  organizationSku: "CHAIR-X",
  expectedDraftVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  expectedProductUpdatedAt: "2026-08-31T10:00:00.000Z",
  expectedDraftUpdatedAt: "2026-08-31T10:01:00.000Z",
  expectedSourceTranslationUpdatedAt: "2026-08-31T10:02:00.000Z",
};

function request(body: unknown, init: { origin?: string; method?: string; contentType?: string } = {}) {
  return new Request(`${canonicalOrigin}/api/products/${productId}/edit`, {
    method: init.method ?? "POST",
    headers: {
      origin: init.origin ?? canonicalOrigin,
      "content-type": init.contentType ?? "application/json",
    },
    body: init.method === "GET" ? undefined : JSON.stringify(body),
  });
}

function harness(input: {
  readonly resolution?: AuthenticatedUserContextResolution;
  readonly edit?: EditProductDraft;
} = {}) {
  const calls: Array<{ command: Parameters<EditProductDraft>[0]; context: Parameters<EditProductDraft>[1] }> = [];
  let resolutionCalls = 0;
  const handler = createEditProductDraftHttpHandler({
    canonicalOrigin,
    async resolveContext() {
      resolutionCalls += 1;
      return input.resolution ?? resolved;
    },
    edit: input.edit ?? (async (command, editContext) => {
      calls.push({ command, context: editContext });
      return { productId, status: "UPDATED" };
    }),
  });
  return { calls, handler, get resolutionCalls() { return resolutionCalls; } };
}

test("injects route productId into the exact canonical command and returns no identifiers", async () => {
  const fixture = harness();
  const response = await fixture.handler(request(payload), productId);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { status: "UPDATED" });
  assert.deepEqual(fixture.calls, [{ command: { productId, ...payload }, context }]);
});

test("rejects unexpected privileged and target-selection fields before context resolution", async () => {
  for (const extra of [
    { organizationId: context.organizationId },
    { membershipId: context.membershipId },
    { userId: context.userId },
    { role: "OWNER" },
    { permissions: [PRODUCT_EDIT] },
    { productId },
    { draftVersionId: payload.expectedDraftVersionId },
    { translationId: "translation-id" },
    { publishedVersionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
    { sourceLocale: "en" },
    { status: "DRAFT" },
    { publicCode: "secret" },
  ]) {
    const fixture = harness();
    const response = await fixture.handler(request({ ...payload, ...extra }), productId);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { status: "INVALID_REQUEST" });
    assert.equal(fixture.resolutionCalls, 0);
    assert.equal(fixture.calls.length, 0);
  }
});

test("requires same-origin bounded JSON POST with all concurrency evidence", async () => {
  const missingEvidence = {
    productName: payload.productName,
    organizationSku: payload.organizationSku,
    expectedDraftVersionId: payload.expectedDraftVersionId,
    expectedProductUpdatedAt: payload.expectedProductUpdatedAt,
    expectedSourceTranslationUpdatedAt: payload.expectedSourceTranslationUpdatedAt,
  };
  for (const candidate of [
    request(payload, { method: "GET" }),
    request(payload, { origin: "https://attacker.example" }),
    request(payload, { contentType: "text/plain" }),
    request(missingEvidence),
    request({ ...payload, productName: 7 }),
    request({ ...payload, expectedProductUpdatedAt: 7 }),
    request({ ...payload, productName: "x".repeat(9000) }),
  ]) {
    const fixture = harness();
    const response = await fixture.handler(candidate, productId);
    assert.ok([400, 403].includes(response.status));
    assert.equal(fixture.resolutionCalls, 0);
  }
});

test("direct transport cannot bypass PRODUCT_EDIT", async () => {
  const fixture = harness({
    resolution: {
      ...resolved,
      context: { ...context, membershipRole: "VIEWER", permissions: ["PRODUCT_READ"] },
    },
  });
  const response = await fixture.handler(request(payload), productId);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { status: "FORBIDDEN" });
  assert.equal(fixture.calls.length, 0);
});

test("maps only approved safe application outcomes", async () => {
  const cases = [
    [new ApplicationError("VALIDATION", "EDIT_PRODUCT_DRAFT_NAME_INVALID", "hidden", false), 400, { status: "VALIDATION_ERROR", field: "productName" }],
    [new ApplicationError("VALIDATION", "EDIT_PRODUCT_DRAFT_SKU_INVALID", "hidden", false), 400, { status: "VALIDATION_ERROR", field: "organizationSku" }],
    [new ApplicationError("CONFLICT", "EDIT_PRODUCT_DRAFT_SKU_CONFLICT", "hidden", false), 409, { status: "SKU_CONFLICT" }],
    [new ApplicationError("CONFLICT", "EDIT_PRODUCT_DRAFT_STALE_WRITE", "hidden", false), 409, { status: "STALE_WRITE" }],
    [new ApplicationError("INVALID_STATE", "EDIT_PRODUCT_DRAFT_NOT_EDITABLE", "hidden", false), 409, { status: "DRAFT_NOT_EDITABLE" }],
    [new ApplicationError("NOT_FOUND", "EDIT_PRODUCT_DRAFT_NOT_FOUND", "hidden", false), 404, { status: "NOT_FOUND" }],
    [new ApplicationError("FORBIDDEN", "EDIT_PRODUCT_DRAFT_FORBIDDEN", "hidden", false), 403, { status: "FORBIDDEN" }],
    [new ApplicationError("INTERNAL", "EDIT_PRODUCT_DRAFT_INVARIANT_FAILURE", "hidden", false), 503, { status: "OPERATIONAL_FAILURE" }],
  ] as const;
  for (const [error, status, body] of cases) {
    const fixture = harness({ edit: async () => { throw error; } });
    const response = await fixture.handler(request(payload), productId);
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), body);
    assert.doesNotMatch(JSON.stringify(body), /hidden|Prisma|constraint/i);
  }
});

test("classifies page access using only PRODUCT_EDIT", () => {
  assert.equal(classifyEditProductDraftPageAccess({ status: "DENIED", reason: "NO_PROVIDER_SESSION" }), "LOGIN");
  assert.equal(classifyEditProductDraftPageAccess({ status: "DENIED", reason: "NO_ACTIVE_MEMBERSHIP" }), "DENIED");
  assert.equal(classifyEditProductDraftPageAccess({
    status: "ORGANIZATION_SELECTION_REQUIRED",
    currentUserId: context.userId,
    organizations: [],
  }), "ORGANIZATION_SELECTION_REQUIRED");
  assert.equal(classifyEditProductDraftPageAccess({
    ...resolved,
    context: { ...context, membershipRole: "VIEWER", permissions: ["PRODUCT_READ"] },
  }), "FORBIDDEN");
  assert.equal(classifyEditProductDraftPageAccess(resolved), "FORM");
});

test("shows the detail Edit action only for PRODUCT_EDIT on an active editable current draft", () => {
  for (const status of ["DRAFT", "READY_FOR_REVIEW"] as const) {
    assert.equal(canShowEditProductDraftAction(context, "ACTIVE", status), true);
  }
  assert.equal(canShowEditProductDraftAction(
    { ...context, permissions: ["PRODUCT_READ"] },
    "ACTIVE",
    "DRAFT",
  ), false);
  assert.equal(canShowEditProductDraftAction(context, "ARCHIVED", "DRAFT"), false);
  assert.equal(canShowEditProductDraftAction(context, "ACTIVE", null), false);
});
