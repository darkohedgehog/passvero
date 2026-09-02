import assert from "node:assert/strict";
import test from "node:test";

import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { ApplicationError } from "../../src/application/errors/application-error";
import { createCnClassificationHttpHandler } from "../../src/application/products/cn-classification-current-draft/http";

const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const identifierId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const context: AuthenticatedUserContext = { userId: "user-id", organizationId: "organization-id", membershipId: "membership-id", membershipRole: "EDITOR", membershipStatus: "ACTIVE", permissions: ["PRODUCT_READ", "PRODUCT_EDIT"], correlationId: "correlation-id" };
const evidence = { expectedDraftVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", expectedProductUpdatedAt: "2026-09-01T10:00:00.000Z", expectedDraftUpdatedAt: "2026-09-01T10:01:00.000Z" };

function request(body: unknown, init: { origin?: string; method?: string } = {}) {
  return new Request(`https://passvero.test/api/products/${productId}/cn-classification`, { method: init.method ?? "POST", headers: { origin: init.origin ?? "https://passvero.test", "content-type": "application/json" }, body: JSON.stringify(body) });
}

function fixture(error?: ApplicationError, resolvedContext: AuthenticatedUserContext | null = context) {
  const calls: Array<{ operation: string; command: unknown }> = [];
  const complete = async (operation: string, command: unknown) => { calls.push({ operation, command }); if (error) throw error; return { productId, status: operation === "ADD" ? "ADDED" : operation === "EDIT" ? "UPDATED" : "REMOVED" } as never; };
  return {
    calls,
    handler: createCnClassificationHttpHandler({
      canonicalOrigin: "https://passvero.test",
      resolveContext: async () => resolvedContext === null ? { status: "DENIED", reason: "NO_PROVIDER_SESSION" } : { status: "RESOLVED", context: resolvedContext, userLabel: "User", presentation: { organizationName: "Org" } },
      add: (command) => complete("ADD", command), edit: (command) => complete("EDIT", command), remove: (command) => complete("REMOVE", command),
    }),
  };
}

test("dispatches only exact ADD EDIT REMOVE payloads with route-owned product identity", async () => {
  const subject = fixture();
  const payloads = [
    { operation: "ADD", value: "01012100", nomenclatureYear: 2026, ...evidence },
    { operation: "EDIT", identifierId, value: "0101 21 00", nomenclatureYear: 2026, ...evidence, expectedIdentifierUpdatedAt: "2026-09-01T10:02:00.000Z" },
    { operation: "REMOVE", identifierId, ...evidence, expectedIdentifierUpdatedAt: "2026-09-01T10:02:00.000Z" },
  ] as const;
  for (const payload of payloads) assert.equal((await subject.handler(request(payload), productId)).status, 200);
  assert.deepEqual(subject.calls.map(({ operation }) => operation), ["ADD", "EDIT", "REMOVE"]);
  for (const [index, payload] of payloads.entries()) {
    assert.deepEqual(subject.calls[index].command, { productId, ...Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "operation")) });
  }
});

test("rejects every privileged or out-of-contract client field", async () => {
  const base = { operation: "ADD", value: "01012100", nomenclatureYear: 2026, ...evidence };
  for (const field of ["organizationId", "productVersionId", "userId", "membershipId", "role", "permissions", "type", "issuingAuthority", "notes", "actorId", "audit", "publishedTarget", "expectedIdentifierUpdatedAt"]) {
    const response = await fixture().handler(request({ ...base, [field]: "attacker" }), productId);
    assert.equal(response.status, 400, field);
    assert.deepEqual(await response.json(), { status: "VALIDATION_ERROR" }, field);
  }
  assert.equal((await fixture().handler(request({ ...base, operation: "UPSERT" }), productId)).status, 400);
  assert.equal((await fixture().handler(request({ ...base, nomenclatureYear: "2026" }), productId)).status, 400);
  assert.equal((await fixture().handler(request(base, { origin: "https://attacker.test" }), productId)).status, 403);
  assert.equal((await fixture().handler(request(base, { method: "PUT" }), productId)).status, 403);
  assert.equal((await fixture(undefined, null).handler(request(base), productId)).status, 401);
});

test("maps only safe CN outcomes and never exposes internal details", async () => {
  const cases = [
    [new ApplicationError("CONFLICT", "CN_CLASSIFICATION_STALE_WRITE", "raw", false), 409, "STALE_WRITE"],
    [new ApplicationError("CONFLICT", "CN_CLASSIFICATION_CONFLICT", "raw", false), 409, "CN_CONFLICT"],
    [new ApplicationError("INVALID_STATE", "CN_CLASSIFICATION_DRAFT_NOT_EDITABLE", "raw", false), 409, "DRAFT_NOT_EDITABLE"],
    [new ApplicationError("VALIDATION", "CN_CLASSIFICATION_VALUE_INVALID", "raw", false), 400, "VALIDATION_ERROR"],
    [new ApplicationError("VALIDATION", "CN_CLASSIFICATION_NOMENCLATURE_YEAR_INVALID", "raw", false), 400, "VALIDATION_ERROR"],
    [new ApplicationError("NOT_FOUND", "CN_CLASSIFICATION_NOT_FOUND", "raw", false), 404, "NOT_FOUND"],
    [new ApplicationError("FORBIDDEN", "CN_CLASSIFICATION_FORBIDDEN", "raw", false), 403, "FORBIDDEN"],
    [new ApplicationError("INTERNAL", "CN_CLASSIFICATION_OPERATIONAL_FAILURE", "Prisma constraint secret", false), 503, "OPERATIONAL_FAILURE"],
  ] as const;
  for (const [error, status, safeStatus] of cases) {
    const response = await fixture(error).handler(request({ operation: "ADD", value: "01012100", nomenclatureYear: 2026, ...evidence }), productId);
    assert.equal(response.status, status);
    const body = await response.text();
    assert.match(body, new RegExp(safeStatus));
    assert.doesNotMatch(body, /raw|Prisma|constraint|secret|01012100|2026/);
    assert.equal(response.headers.get("cache-control"), "no-store, private");
  }
});
