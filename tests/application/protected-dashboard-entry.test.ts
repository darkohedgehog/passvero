import assert from "node:assert/strict";
import test from "node:test";

import {
  createProtectedDashboardEntryResolver,
  dashboardDenialOutcome,
} from "../../src/application/context/protected-dashboard-entry";
import type { AuthenticatedIdentity } from "../../src/application/auth/resolve-current-user";
import type { AuthenticatedUserContextResolution } from "../../src/application/context/resolve-authenticated-user-context";

const identity: AuthenticatedIdentity = {
  provider: "BETTER_AUTH",
  providerSubject: "provider-user-a",
  providerSessionId: "provider-session-a",
  authenticatedAt: new Date("2026-08-26T08:00:00.000Z"),
};

const resolved: AuthenticatedUserContextResolution = {
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
  presentation: { organizationName: "Organization A" },
};

test("adds a safe canonical user label only after tenant context resolves", async () => {
  const labels: string[] = [];
  const resolve = createProtectedDashboardEntryResolver({
    resolveContext: async () => resolved,
    async findUserLabel(userId) {
      labels.push(userId);
      return "Passvero User";
    },
  });

  assert.deepEqual(await resolve(identity), {
    ...resolved,
    userLabel: "Passvero User",
  });
  assert.deepEqual(labels, ["user-a"]);
});

test("hydrates chooser identity from the already resolved canonical user only", async () => {
  const selection: AuthenticatedUserContextResolution = {
    status: "ORGANIZATION_SELECTION_REQUIRED",
    currentUserId: "user-a",
    organizations: [
      { organizationId: "organization-a", displayName: "Organization A" },
      { organizationId: "organization-b", displayName: "Organization B" },
    ],
  };
  const resolve = createProtectedDashboardEntryResolver({
    resolveContext: async () => selection,
    findUserLabel: async (userId) => userId === "user-a" ? "person@example.com" : null,
  });

  assert.deepEqual(await resolve(identity), {
    ...selection,
    userLabel: "person@example.com",
  });
});

test("preserves auth and tenant denial without querying presentation data", async () => {
  let presentationCalls = 0;
  const denied: AuthenticatedUserContextResolution = {
    status: "DENIED",
    reason: "IDENTITY_REVOKED",
  };
  const resolve = createProtectedDashboardEntryResolver({
    resolveContext: async () => denied,
    async findUserLabel() {
      presentationCalls += 1;
      return "must-not-be-read";
    },
  });

  assert.deepEqual(await resolve(identity), denied);
  assert.equal(presentationCalls, 0);
});

test("fails closed if the canonical user disappears after context resolution", async () => {
  const resolve = createProtectedDashboardEntryResolver({
    resolveContext: async () => resolved,
    findUserLabel: async () => null,
  });

  assert.deepEqual(await resolve(identity), {
    status: "DENIED",
    reason: "CANONICAL_USER_NOT_FOUND",
  });
});

test("maps only provider and canonical-identity failures to login", () => {
  for (const reason of [
    "NO_PROVIDER_SESSION",
    "SESSION_TOO_OLD",
    "IDENTITY_NOT_BOUND",
    "IDENTITY_REVOKED",
    "CANONICAL_USER_NOT_FOUND",
  ] as const) {
    assert.equal(dashboardDenialOutcome(reason), "LOGIN");
  }
  for (const reason of [
    "NO_ACTIVE_MEMBERSHIP",
    "SELECTED_MEMBERSHIP_INVALID",
    "ORGANIZATION_INACTIVE",
  ] as const) {
    assert.equal(dashboardDenialOutcome(reason), "NO_ACCESS");
  }
});
