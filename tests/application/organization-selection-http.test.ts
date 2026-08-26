import assert from "node:assert/strict";
import test from "node:test";

import { createOrganizationSelectionHttpHandler } from "../../src/application/context/organization-selection-http";

const canonicalOrigin = "https://passvero.eu";

function request(
  body: unknown,
  input: { readonly origin?: string; readonly method?: string } = {},
) {
  return new Request(`${canonicalOrigin}/api/auth/organization-selection`, {
    method: input.method ?? "POST",
    headers: {
      "content-type": "application/json",
      origin: input.origin ?? canonicalOrigin,
      cookie: "provider-session=opaque",
    },
    body: JSON.stringify(body),
  });
}

test("persists only one server-validated target organization", async () => {
  const calls: unknown[] = [];
  const handler = createOrganizationSelectionHttpHandler({
    canonicalOrigin,
    async select(headers, targetOrganizationId) {
      calls.push({
        cookie: headers.get("cookie"),
        targetOrganizationId,
      });
      return { status: "SELECTED" };
    },
  });

  const response = await handler(request({
    targetOrganizationId: "9d901304-4fbf-47aa-a1fe-45ac71da55f5",
  }));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "SELECTED" });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(calls, [{
    cookie: "provider-session=opaque",
    targetOrganizationId: "9d901304-4fbf-47aa-a1fe-45ac71da55f5",
  }]);
});

test("denies unauthenticated and cross-tenant selection without exposing reasons", async () => {
  for (const fixture of [
    { result: { status: "DENIED", reason: "NO_PROVIDER_SESSION" } as const, status: 401 },
    { result: { status: "DENIED", reason: "SELECTED_MEMBERSHIP_INVALID" } as const, status: 403 },
    { result: { status: "DENIED", reason: "ORGANIZATION_INACTIVE" } as const, status: 403 },
  ]) {
    const handler = createOrganizationSelectionHttpHandler({
      canonicalOrigin,
      select: async () => fixture.result,
    });

    const response = await handler(request({
      targetOrganizationId: "9d901304-4fbf-47aa-a1fe-45ac71da55f5",
    }));

    assert.equal(response.status, fixture.status);
    assert.deepEqual(await response.json(), { status: "DENIED" });
  }
});

test("rejects noncanonical origin, non-POST, malformed IDs, and extra client authority", async () => {
  let calls = 0;
  const handler = createOrganizationSelectionHttpHandler({
    canonicalOrigin,
    async select() {
      calls += 1;
      return { status: "SELECTED" };
    },
  });
  const fixtures = [
    request({ targetOrganizationId: "9d901304-4fbf-47aa-a1fe-45ac71da55f5" }, { origin: "https://evil.example" }),
    request({ targetOrganizationId: "9d901304-4fbf-47aa-a1fe-45ac71da55f5" }, { method: "PUT" }),
    request({ targetOrganizationId: "not-a-uuid" }),
    request({
      targetOrganizationId: "9d901304-4fbf-47aa-a1fe-45ac71da55f5",
      role: "OWNER",
    }),
  ];

  for (const candidate of fixtures) {
    const response = await handler(candidate);
    assert.equal(response.status, candidate.method === "POST" && candidate.headers.get("origin") === canonicalOrigin ? 400 : 403);
    assert.deepEqual(await response.json(), {
      status: candidate.method === "POST" && candidate.headers.get("origin") === canonicalOrigin
        ? "INVALID_REQUEST"
        : "DENIED",
    });
  }
  assert.equal(calls, 0);
});

test("fails closed with a generic response when selection persistence fails", async () => {
  const handler = createOrganizationSelectionHttpHandler({
    canonicalOrigin,
    async select() {
      throw new Error("database detail");
    },
  });

  const response = await handler(request({
    targetOrganizationId: "9d901304-4fbf-47aa-a1fe-45ac71da55f5",
  }));

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: "OPERATIONAL_FAILURE" });
});
