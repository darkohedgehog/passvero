import assert from "node:assert/strict";
import test from "node:test";

import {
  createLazyOrganizationContextRepository,
  PrismaOrganizationContextRepository,
} from "../../src/infrastructure/context/prisma-organization-context-repository";

function createHarness() {
  const calls: unknown[] = [];
  const repository = new PrismaOrganizationContextRepository({
    membership: {
      async findMany(query) {
        calls.push(["membership.findMany", query]);
        return [{
          id: "membership-a",
          userId: "user-a",
          organizationId: "organization-a",
          status: "ACTIVE" as const,
          role: "OWNER" as const,
          organization: {
            status: "ACTIVE" as const,
            displayName: "Organization A",
          },
        }];
      },
    },
    authSessionSelection: {
      async findUnique(query) {
        calls.push(["authSessionSelection.findUnique", query]);
        return { selectedOrganizationId: "organization-a" };
      },
      async deleteMany(query) {
        calls.push(["authSessionSelection.deleteMany", query]);
        return { count: 1 };
      },
      async upsert(query) {
        calls.push(["authSessionSelection.upsert", query]);
        return { id: "selection-a" };
      },
    },
  });
  return { calls, repository };
}

const selector = {
  provider: "BETTER_AUTH" as const,
  providerSessionId: "provider-session-a",
};

test("reads only canonical memberships and organization status for the current user", async () => {
  const harness = createHarness();

  assert.deepEqual(await harness.repository.listMembershipsForUser("user-a"), [{
    membershipId: "membership-a",
    userId: "user-a",
    organizationId: "organization-a",
    membershipStatus: "ACTIVE",
    membershipRole: "OWNER",
    organizationStatus: "ACTIVE",
    organizationDisplayName: "Organization A",
  }]);
  assert.deepEqual(harness.calls, [["membership.findMany", {
    where: { userId: "user-a" },
    orderBy: { id: "asc" },
    select: {
      id: true,
      userId: true,
      organizationId: true,
      status: true,
      role: true,
      organization: { select: { status: true, displayName: true } },
    },
  }]]);
});

test("looks up and clears a selector only by provider session identity", async () => {
  const harness = createHarness();

  assert.deepEqual(await harness.repository.findSelection(selector), {
    selectedOrganizationId: "organization-a",
  });
  await harness.repository.deleteSelection(selector);

  const key = {
    provider_providerSessionId: {
      provider: "BETTER_AUTH",
      providerSessionId: "provider-session-a",
    },
  };
  assert.deepEqual(harness.calls, [
    ["authSessionSelection.findUnique", {
      where: key,
      select: { selectedOrganizationId: true },
    }],
    ["authSessionSelection.deleteMany", { where: key.provider_providerSessionId }],
  ]);
});

test("upserts only the selected organization without role or permission authority", async () => {
  const harness = createHarness();

  await harness.repository.upsertSelection({
    ...selector,
    selectedOrganizationId: "organization-a",
  });

  assert.deepEqual(harness.calls, [["authSessionSelection.upsert", {
    where: {
      provider_providerSessionId: {
        provider: "BETTER_AUTH",
        providerSessionId: "provider-session-a",
      },
    },
    create: {
      provider: "BETTER_AUTH",
      providerSessionId: "provider-session-a",
      selectedOrganizationId: "organization-a",
    },
    update: { selectedOrganizationId: "organization-a" },
    select: { id: true },
  }]]);
  assert.doesNotMatch(JSON.stringify(harness.calls), /role|permission|userId/i);
});

test("does not construct business persistence until tenant state is requested", async () => {
  const harness = createHarness();
  let constructions = 0;
  const repository = createLazyOrganizationContextRepository(() => {
    constructions += 1;
    return harness.repository;
  });

  assert.equal(constructions, 0);
  assert.deepEqual(await repository.findSelection(selector), {
    selectedOrganizationId: "organization-a",
  });
  assert.equal(constructions, 1);
  await repository.deleteSelection(selector);
  assert.equal(constructions, 1);
});
