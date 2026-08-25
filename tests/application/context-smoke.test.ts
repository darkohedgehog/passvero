import assert from "node:assert/strict";
import test from "node:test";

import { createContextSmokeHandler } from "../../src/application/context/context-smoke";
import type { AuthenticatedUserContextResolution } from "../../src/application/context/resolve-authenticated-user-context";

function handler(result: AuthenticatedUserContextResolution) {
  return createContextSmokeHandler({ resolve: async () => result });
}

test("denies unauthenticated and unbound smoke requests with the same safe response", async () => {
  for (const reason of ["NO_PROVIDER_SESSION", "IDENTITY_NOT_BOUND"] as const) {
    const response = await handler({ status: "DENIED", reason })(
      new Request("https://passvero.eu/api/auth/context-smoke"),
    );

    assert.equal(response.status, 401);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), {
      authenticated: false,
      organizationContext: false,
    });
  }
});

test("returns only a safe success shape for a resolved tenant context", async () => {
  const response = await handler({
    status: "RESOLVED",
    context: {
      userId: "user-a",
      organizationId: "organization-a",
      membershipId: "membership-a",
      membershipRole: "OWNER",
      membershipStatus: "ACTIVE",
      permissions: ["PRODUCT_CREATE"],
      correlationId: "correlation-a",
    },
  })(new Request("https://passvero.eu/api/auth/context-smoke"));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    authenticated: true,
    organizationContext: true,
  });
});

test("exposes only safe organization-selection-required behavior", async () => {
  const response = await handler({ status: "ORGANIZATION_SELECTION_REQUIRED" })(
    new Request("https://passvero.eu/api/auth/context-smoke"),
  );

  assert.equal(response.status, 409);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    authenticated: true,
    organizationContext: false,
    organizationSelectionRequired: true,
  });
});

test("a stale selector denial cannot expose tenant state", async () => {
  const response = await handler({
    status: "DENIED",
    reason: "SELECTED_MEMBERSHIP_INVALID",
  })(new Request("https://passvero.eu/api/auth/context-smoke"));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    authenticated: false,
    organizationContext: false,
  });
});
