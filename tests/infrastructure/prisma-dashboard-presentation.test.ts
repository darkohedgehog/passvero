import assert from "node:assert/strict";
import test from "node:test";

import { PrismaDashboardPresentation } from "../../src/infrastructure/context/prisma-dashboard-presentation";

function createHarness(user: {
  readonly id: string;
  readonly email: string;
  readonly displayName: string | null;
} | null) {
  const calls: unknown[] = [];
  const presentation = new PrismaDashboardPresentation({
    user: {
      async findUnique(query) {
        calls.push(query);
        return user;
      },
    },
  });
  return { calls, presentation };
}

test("uses the canonical display name without moving email into auth resolution", async () => {
  const harness = createHarness({
    id: "user-a",
    email: "person@example.com",
    displayName: "Passvero User",
  });

  assert.equal(await harness.presentation.findUserLabel("user-a"), "Passvero User");
  assert.deepEqual(harness.calls, [{
    where: { id: "user-a" },
    select: { id: true, email: true, displayName: true },
  }]);
});

test("falls back to canonical email and fails closed when the user disappears", async () => {
  const email = createHarness({
    id: "user-a",
    email: "person@example.com",
    displayName: null,
  });
  const missing = createHarness(null);

  assert.equal(await email.presentation.findUserLabel("user-a"), "person@example.com");
  assert.equal(await missing.presentation.findUserLabel("user-a"), null);
});
