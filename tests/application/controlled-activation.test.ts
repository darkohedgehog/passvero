import assert from "node:assert/strict";
import test from "node:test";

import {
  createControlledActivationService,
  type ActivationIntent,
  type ControlledActivationDependencies,
} from "../../src/application/auth/controlled-activation";

const now = new Date("2026-08-25T10:00:00.000Z");
const capability = "A".repeat(43);
const password = `Valid-password-${"z".repeat(8)}`;

function intent(overrides: Partial<ActivationIntent> = {}): ActivationIntent {
  return {
    id: "intent-1",
    status: "ISSUED",
    expiresAt: new Date("2026-08-26T10:00:00.000Z"),
    claimId: null,
    claimExpiresAt: null,
    providerSubject: null,
    intendedEmailDigest: "email-digest",
    user: {
      id: "user-1",
      email: "person@example.com",
      displayName: "Person",
      eligible: true,
    },
    ...overrides,
  };
}

function fixture(overrides: {
  readonly activation?: ActivationIntent | null;
  readonly capabilityDigest?: string | null;
  readonly emailMatches?: boolean;
  readonly claimResult?: boolean;
  readonly captureResult?: "CAPTURED" | "ALREADY_CAPTURED" | "CONFLICT";
  readonly providerEmail?: string;
  readonly deliveryError?: Error;
} = {}) {
  const calls: Array<{ readonly name: string; readonly input: unknown }> = [];
  const dependencies: ControlledActivationDependencies = {
    capabilityDigester: {
      async digest(input) {
        calls.push({ name: "digest", input });
        return overrides.capabilityDigest === undefined
          ? "capability-digest"
          : overrides.capabilityDigest;
      },
    },
    intendedEmailDigester: {
      async matches(input) {
        calls.push({ name: "emailMatches", input });
        return overrides.emailMatches ?? true;
      },
    },
    activationRepository: {
      async findByTokenDigest(input) {
        calls.push({ name: "find", input });
        return overrides.activation === undefined
          ? intent()
          : overrides.activation;
      },
      async claim(input) {
        calls.push({ name: "claim", input });
        return overrides.claimResult ?? true;
      },
      async captureProviderSubject(input) {
        calls.push({ name: "capture", input });
        return overrides.captureResult ?? "CAPTURED";
      },
      async markConflict(input) {
        calls.push({ name: "markConflict", input });
        return true;
      },
    },
    provider: {
      async createCredential(input) {
        calls.push({ name: "createCredential", input });
        return {
          providerSubject: "provider-1",
          normalizedEmail: overrides.providerEmail ?? "person@example.com",
          emailVerified: false,
        };
      },
      async requestEmailVerification(email) {
        calls.push({ name: "requestEmailVerification", input: email });
        if (overrides.deliveryError !== undefined) {
          throw overrides.deliveryError;
        }
      },
    },
    claimIdGenerator: { generate: () => "claim-1" },
    now: () => now,
  };
  return {
    calls,
    activate: createControlledActivationService(dependencies),
  };
}

test("denies invalid, expired, terminal, missing-user, and email-mismatched intents", async () => {
  const cases: Array<Parameters<typeof fixture>[0]> = [
    { capabilityDigest: null },
    { activation: null },
    { activation: intent({ expiresAt: now }) },
    { activation: intent({ status: "REVOKED" }) },
    { activation: intent({ status: "CONFLICT" }) },
    { activation: intent({ user: null }) },
    { activation: intent({ user: { ...intent().user!, eligible: false } }) },
    { emailMatches: false },
  ];

  for (const options of cases) {
    const { activate, calls } = fixture(options);
    assert.deepEqual(await activate({ capability, password }), {
      status: "DENIED",
    });
    assert.equal(calls.some((call) => call.name === "createCredential"), false);
  }
});

test("claims an eligible intent, creates one provider credential, captures subject, then requests verification", async () => {
  const { activate, calls } = fixture();

  const result = await activate({ capability, password });

  assert.deepEqual(result, { status: "VERIFICATION_PENDING" });
  assert.deepEqual(calls.map((call) => call.name), [
    "digest",
    "find",
    "emailMatches",
    "claim",
    "createCredential",
    "capture",
    "requestEmailVerification",
  ]);
  assert.deepEqual(calls.find((call) => call.name === "claim")?.input, {
    intentId: "intent-1",
    claimId: "claim-1",
    claimedAt: now,
    claimExpiresAt: new Date("2026-08-25T10:05:00.000Z"),
    expectedClaimId: null,
  });
  assert.equal(calls.some((call) => call.name.includes("Identity")), false);
});

test("rejects an invalid password before the provider credential operation", async () => {
  const { activate, calls } = fixture();

  assert.deepEqual(await activate({ capability, password: "too short" }), {
    status: "PASSWORD_REJECTED",
    reason: "TOO_SHORT",
  });
  assert.equal(calls.some((call) => call.name === "createCredential"), false);
});

test("replays captured provider state without creating a duplicate credential", async () => {
  const { activate, calls } = fixture({
    activation: intent({
      status: "AUTH_ACCOUNT_CREATED",
      providerSubject: "provider-1",
    }),
  });

  assert.deepEqual(await activate({ capability, password }), {
    status: "VERIFICATION_PENDING",
  });
  assert.equal(calls.some((call) => call.name === "createCredential"), false);
  assert.equal(calls.some((call) => call.name === "capture"), false);
});

test("fails closed on claim or provider-subject conflict and reports retryable email delivery", async () => {
  const lostClaim = fixture({ claimResult: false });
  assert.deepEqual(await lostClaim.activate({ capability, password }), {
    status: "RETRY_REQUIRED",
  });

  const conflict = fixture({ captureResult: "CONFLICT" });
  assert.deepEqual(await conflict.activate({ capability, password }), {
    status: "DENIED",
  });
  assert.equal(
    conflict.calls.some((call) => call.name === "markConflict"),
    true,
  );
  assert.equal(
    conflict.calls.some((call) => call.name === "requestEmailVerification"),
    false,
  );

  const delivery = fixture({ deliveryError: new Error("transport detail") });
  assert.deepEqual(await delivery.activate({ capability, password }), {
    status: "DELIVERY_RETRY_REQUIRED",
  });
});

test("never returns or persists the raw capability or password", async () => {
  const { activate, calls } = fixture();
  const result = await activate({ capability, password });
  const serializedCalls = JSON.stringify(
    calls.filter((call) => call.name !== "digest" && call.name !== "createCredential"),
  );

  assert.doesNotMatch(JSON.stringify(result), new RegExp(capability));
  assert.doesNotMatch(JSON.stringify(result), new RegExp(password));
  assert.doesNotMatch(serializedCalls, new RegExp(capability));
  assert.doesNotMatch(serializedCalls, new RegExp(password));
});
