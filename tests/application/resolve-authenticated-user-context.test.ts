import assert from "node:assert/strict";
import test from "node:test";

import {
  createAuthenticatedUserContextResolver,
  createOrganizationSelectionService,
  type OrganizationContextRepository,
  type TenantMembership,
} from "../../src/application/context/resolve-authenticated-user-context";
import type {
  AuthenticatedIdentity,
  CurrentUserResolution,
} from "../../src/application/auth/resolve-current-user";

const identity: AuthenticatedIdentity = {
  provider: "BETTER_AUTH",
  providerSubject: "provider-user-a",
  providerSessionId: "provider-session-a",
  authenticatedAt: new Date("2026-08-25T08:00:00.000Z"),
};

const authenticated: CurrentUserResolution = {
  status: "AUTHENTICATED",
  currentUser: { userId: "user-a" },
  providerSession: {
    provider: "BETTER_AUTH",
    providerSessionId: "provider-session-a",
  },
};

function membership(input: Partial<TenantMembership> = {}): TenantMembership {
  return {
    membershipId: "membership-a",
    userId: "user-a",
    organizationId: "organization-a",
    membershipStatus: "ACTIVE",
    membershipRole: "EDITOR",
    organizationStatus: "ACTIVE",
    organizationDisplayName: "Organization A",
    ...input,
  };
}

function createHarness(input: {
  readonly currentUser?: CurrentUserResolution;
  readonly memberships?: readonly TenantMembership[];
  readonly selectedOrganizationId?: string | null;
} = {}) {
  let selectedOrganizationId = input.selectedOrganizationId ?? null;
  const deletedSelections: string[] = [];
  const repository: OrganizationContextRepository = {
    async listMembershipsForUser() {
      return input.memberships ?? [];
    },
    async findSelection() {
      return selectedOrganizationId === null ? null : { selectedOrganizationId };
    },
    async deleteSelection(selector) {
      deletedSelections.push(selector.providerSessionId);
      selectedOrganizationId = null;
    },
    async upsertSelection(selection) {
      selectedOrganizationId = selection.selectedOrganizationId;
    },
  };
  const currentUser = input.currentUser ?? authenticated;
  const resolver = createAuthenticatedUserContextResolver({
    resolveCurrentUser: async () => currentUser,
    repository,
    correlationId: () => "correlation-1",
  });
  const selectOrganization = createOrganizationSelectionService({
    resolveCurrentUser: async () => currentUser,
    repository,
  });

  return {
    deletedSelections,
    get selectedOrganizationId() { return selectedOrganizationId; },
    resolver,
    selectOrganization,
  };
}

for (const reason of [
  "NO_PROVIDER_SESSION",
  "SESSION_TOO_OLD",
  "IDENTITY_NOT_BOUND",
  "IDENTITY_REVOKED",
  "CANONICAL_USER_NOT_FOUND",
] as const) {
  test(`denies ${reason} before tenant resolution`, async () => {
    const harness = createHarness({
      currentUser: { status: "UNAUTHENTICATED", reason },
      memberships: [membership()],
    });

    assert.deepEqual(await harness.resolver(identity), {
      status: "DENIED",
      reason,
    });
    assert.equal(harness.selectedOrganizationId, null);
  });
}

test("returns NO_ACTIVE_MEMBERSHIP when the canonical user has no eligible tenant", async () => {
  const harness = createHarness({
    memberships: [membership({ membershipStatus: "SUSPENDED" })],
  });

  assert.deepEqual(await harness.resolver(identity), {
    status: "DENIED",
    reason: "NO_ACTIVE_MEMBERSHIP",
  });
});

test("never auto-resolves a membership returned for another canonical user", async () => {
  const harness = createHarness({
    memberships: [membership({ userId: "user-b" })],
  });

  assert.deepEqual(await harness.resolver(identity), {
    status: "DENIED",
    reason: "NO_ACTIVE_MEMBERSHIP",
  });
  assert.equal(harness.selectedOrganizationId, null);
});

test("auto-selects the only active membership and derives role permissions", async () => {
  const harness = createHarness({ memberships: [membership()] });

  assert.deepEqual(await harness.resolver(identity), {
    status: "RESOLVED",
    context: {
      userId: "user-a",
      organizationId: "organization-a",
      membershipId: "membership-a",
      membershipRole: "EDITOR",
      membershipStatus: "ACTIVE",
      permissions: ["PRODUCT_READ", "PRODUCT_CREATE", "PRODUCT_EDIT"],
      correlationId: "correlation-1",
    },
    presentation: {
      organizationName: "Organization A",
    },
  });
  assert.equal(harness.selectedOrganizationId, "organization-a");
});

test("requires a selector when multiple active memberships exist", async () => {
  const harness = createHarness({
    memberships: [
      membership(),
      membership({
        membershipId: "membership-b",
        organizationId: "organization-b",
        membershipRole: "VIEWER",
        organizationDisplayName: "Organization B",
      }),
    ],
  });

  assert.deepEqual(await harness.resolver(identity), {
    status: "ORGANIZATION_SELECTION_REQUIRED",
    currentUserId: "user-a",
    organizations: [
      { organizationId: "organization-a", displayName: "Organization A" },
      { organizationId: "organization-b", displayName: "Organization B" },
    ],
  });
});

test("uses a valid selector only after revalidating the canonical membership", async () => {
  const harness = createHarness({
    selectedOrganizationId: "organization-b",
    memberships: [
      membership(),
      membership({
        membershipId: "membership-b",
        organizationId: "organization-b",
        membershipRole: "VIEWER",
        organizationDisplayName: "Organization B",
      }),
    ],
  });

  const result = await harness.resolver(identity);

  assert.equal(result.status, "RESOLVED");
  if (result.status === "RESOLVED") {
    assert.equal(result.context.organizationId, "organization-b");
    assert.equal(result.context.membershipRole, "VIEWER");
    assert.deepEqual(result.context.permissions, ["PRODUCT_READ"]);
    assert.deepEqual(result.presentation, {
      organizationName: "Organization B",
    });
  }
});

test("clears a stale cross-tenant selector and never reuses another role", async () => {
  const harness = createHarness({
    selectedOrganizationId: "organization-owned-by-user-b",
    memberships: [
      membership(),
      membership({
        membershipId: "membership-b",
        organizationId: "organization-b",
        membershipRole: "VIEWER",
        organizationDisplayName: "Organization B",
      }),
    ],
  });

  assert.deepEqual(await harness.resolver(identity), {
    status: "ORGANIZATION_SELECTION_REQUIRED",
    currentUserId: "user-a",
    organizations: [
      { organizationId: "organization-a", displayName: "Organization A" },
      { organizationId: "organization-b", displayName: "Organization B" },
    ],
  });
  assert.equal(harness.selectedOrganizationId, null);
  assert.deepEqual(harness.deletedSelections, ["provider-session-a"]);
});

test("denies and clears an inactive selected membership", async () => {
  const harness = createHarness({
    selectedOrganizationId: "organization-a",
    memberships: [membership({ membershipStatus: "REMOVED" })],
  });

  assert.deepEqual(await harness.resolver(identity), {
    status: "DENIED",
    reason: "SELECTED_MEMBERSHIP_INVALID",
  });
  assert.equal(harness.selectedOrganizationId, null);
});

test("denies and clears a selector for an inactive organization", async () => {
  const harness = createHarness({
    selectedOrganizationId: "organization-a",
    memberships: [membership({ organizationStatus: "SUSPENDED" })],
  });

  assert.deepEqual(await harness.resolver(identity), {
    status: "DENIED",
    reason: "ORGANIZATION_INACTIVE",
  });
  assert.equal(harness.selectedOrganizationId, null);
});

test("denies a membership whose canonical organization is missing", async () => {
  const harness = createHarness({
    selectedOrganizationId: "organization-a",
    memberships: [membership({ organizationStatus: null })],
  });

  assert.deepEqual(await harness.resolver(identity), {
    status: "DENIED",
    reason: "SELECTED_MEMBERSHIP_INVALID",
  });
});

test("selection mutation validates the canonical user's active target membership", async () => {
  const harness = createHarness({
    memberships: [membership({ organizationId: "organization-a" })],
  });

  assert.deepEqual(
    await harness.selectOrganization(identity, "organization-a"),
    { status: "SELECTED" },
  );
  assert.equal(harness.selectedOrganizationId, "organization-a");

  assert.deepEqual(
    await harness.selectOrganization(identity, "organization-b"),
    { status: "DENIED", reason: "SELECTED_MEMBERSHIP_INVALID" },
  );
  assert.equal(harness.selectedOrganizationId, "organization-a");
});

test("selection mutation rejects inactive organizations without writing authority", async () => {
  const harness = createHarness({
    memberships: [membership({ organizationStatus: "DEACTIVATED" })],
  });

  assert.deepEqual(
    await harness.selectOrganization(identity, "organization-a"),
    { status: "DENIED", reason: "ORGANIZATION_INACTIVE" },
  );
  assert.equal(harness.selectedOrganizationId, null);
});
